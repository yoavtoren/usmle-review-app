// CloudKit JS backend — Apple-account sync for the WEB build.
//
// Browsers can't see the device's iCloud session, so the user signs in with
// their Apple ID once (the login page renders Apple's official button); the
// session persists in a cookie. Data lives in the same CloudKit private
// database the native builds use: one record per localStorage key, record type
// "KV", single string field "payload" holding JSON {t, v} (t = last-write
// timestamp, v = the raw localStorage value, null when the key was removed).
//
// Record names encode the key as "kv_" + key with ":" → "." (CloudKit record
// names are happier without colons). We only ever fetch by known record names
// (the SYNC_KEYS list), so no queries and no schema indexes are needed.

import { CLOUD_CONFIG, isWebCloudConfigured } from "./cloudConfig.js";

const CDN_URL = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js";
const SIGN_IN_ID = "apple-sign-in-button";
const SIGN_OUT_ID = "apple-sign-out-button";
const RECORD_TYPE = "KV";

let container = null;
let db = null;
let identity = null;               // CloudKit userIdentity when signed in
const changeTags = new Map();      // recordName → recordChangeTag (needed to overwrite)
const listeners = new Set();       // notified on sign-in/out

export function recordNameFor(key) {
  return "kv_" + key.replace(/:/g, ".");
}

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.CloudKit) return resolve();
    const s = document.createElement("script");
    s.src = CDN_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("cloudkit.js failed to load"));
    document.head.appendChild(s);
  });
}

// CloudKit renders its sign-in/out buttons into elements found by id at
// setUpAuth() time — so the elements must exist before auth is set up, even
// though the login page mounts later. We park them offscreen and the login UI
// adopts them into place (see adoptAuthButton).
function ensureButtonHosts() {
  if (document.getElementById(SIGN_IN_ID)) return;
  const holder = document.createElement("div");
  holder.id = "ck-auth-holder";
  holder.style.cssText = "position:fixed;left:-9999px;top:0;";
  for (const id of [SIGN_IN_ID, SIGN_OUT_ID]) {
    const d = document.createElement("div");
    d.id = id;
    holder.appendChild(d);
  }
  document.body.appendChild(holder);
}

/** Move Apple's sign-in/out button into a visible host (React ref). */
export function adoptAuthButton(kind, hostEl) {
  const el = document.getElementById(kind === "out" ? SIGN_OUT_ID : SIGN_IN_ID);
  if (el && hostEl && el.parentElement !== hostEl) hostEl.appendChild(el);
}
/** Park the buttons back offscreen when the login UI unmounts. */
export function releaseAuthButtons() {
  const holder = document.getElementById("ck-auth-holder");
  if (!holder) return;
  for (const id of [SIGN_IN_ID, SIGN_OUT_ID]) {
    const el = document.getElementById(id);
    if (el && el.parentElement !== holder) holder.appendChild(el);
  }
}

function armAuthLoops() {
  // whenUserSignsIn/Out are one-shot promises — re-arm after each firing.
  container.whenUserSignsIn().then((id) => {
    identity = id || null;
    for (const cb of listeners) cb(true);
    armAuthLoops();
  }).catch(() => {});
  container.whenUserSignsOut().then(() => {
    identity = null;
    changeTags.clear();
    for (const cb of listeners) cb(false);
    armAuthLoops();
  }).catch(() => {});
}

/**
 * Load CloudKit JS and restore any existing session. Resolves with
 * { signedIn } — never rejects for the common "not configured" case.
 */
export async function initWebCloud() {
  if (!isWebCloudConfigured()) return { configured: false, signedIn: false };
  await loadScript();
  ensureButtonHosts();

  window.CloudKit.configure({
    containers: [{
      containerIdentifier: CLOUD_CONFIG.containerId,
      apiTokenAuth: {
        apiToken: CLOUD_CONFIG.apiToken,
        persist: true,
        signInButton: { id: SIGN_IN_ID, theme: "black" },
        signOutButton: { id: SIGN_OUT_ID, theme: "black" },
      },
      environment: CLOUD_CONFIG.environment,
    }],
  });

  container = window.CloudKit.getDefaultContainer();
  db = container.privateCloudDatabase;

  identity = await container.setUpAuth().catch(() => null);
  armAuthLoops();
  return { configured: true, signedIn: Boolean(identity) };
}

export function onAuthChange(cb) { listeners.add(cb); }
export function isSignedIn() { return Boolean(identity); }
export function userLabel() {
  const n = identity?.nameComponents;
  if (n && (n.givenName || n.familyName)) {
    return [n.givenName, n.familyName].filter(Boolean).join(" ");
  }
  return identity?.lookupInfo?.emailAddress || "Apple ID";
}

function rememberTag(rec) {
  if (rec?.recordName && rec?.recordChangeTag) changeTags.set(rec.recordName, rec.recordChangeTag);
}

/** Fetch entries for the given localStorage keys → { key: {t, v} }. */
async function getAll(keys) {
  const names = keys.map(recordNameFor);
  const nameToKey = new Map(keys.map((k) => [recordNameFor(k), k]));
  const out = {};
  // fetchRecords tolerates missing records but reports them in .errors —
  // NOT_FOUND there is normal (key never synced yet), anything else is real.
  const resp = await db.fetchRecords(names);
  for (const rec of resp.records || []) {
    rememberTag(rec);
    const raw = rec?.fields?.payload?.value;
    const key = nameToKey.get(rec.recordName);
    if (!key || typeof raw !== "string") continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.t === "number") out[key] = parsed;
    } catch {}
  }
  if (resp.hasErrors) {
    const real = (resp.errors || []).filter((e) => e.serverErrorCode !== "NOT_FOUND");
    if (real.length && !Object.keys(out).length && !(resp.records || []).length) {
      throw new Error(real[0].reason || real[0].serverErrorCode || "fetch failed");
    }
  }
  return out;
}

function buildRecord(key, t, v) {
  const recordName = recordNameFor(key);
  const rec = {
    recordType: RECORD_TYPE,
    recordName,
    fields: { payload: { value: JSON.stringify({ t, v }) } },
  };
  const tag = changeTags.get(recordName);
  if (tag) rec.recordChangeTag = tag;
  return rec;
}

/** Save entries [{key, t, v}] with per-key LWW on conflicts. */
async function setItems(entries) {
  if (!entries.length) return;
  let resp = await db.saveRecords(entries.map((e) => buildRecord(e.key, e.t, e.v)));
  for (const rec of resp.records || []) rememberTag(rec);
  if (!resp.hasErrors) return;

  // Stale/missing change tag (another device wrote first): re-fetch the tags
  // and retry once — but only push entries still newer than the server copy.
  const failedNames = new Set((resp.errors || []).map((e) => e.recordName).filter(Boolean));
  const failed = entries.filter((e) => failedNames.has(recordNameFor(e.key)));
  if (!failed.length) return;
  const server = await getAll(failed.map((e) => e.key));
  const retry = failed.filter((e) => e.t >= (server[e.key]?.t || 0));
  if (!retry.length) return;
  resp = await db.saveRecords(retry.map((e) => buildRecord(e.key, e.t, e.v)));
  for (const rec of resp.records || []) rememberTag(rec);
}

export const webBackend = { kind: "cloudkit-web", getAll, setItems };
