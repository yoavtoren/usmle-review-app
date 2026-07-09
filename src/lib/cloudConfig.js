// Apple CloudKit configuration — the one place to wire the app to your
// iCloud container. Native builds only need CONTAINER_ID (the device's iCloud
// sign-in provides auth). The web build additionally needs a CloudKit JS API
// token so browsers can show the "Sign in with Apple" page.
//
// How to get the token: iCloud Console (https://icloud.developer.apple.com)
// → your container → API Access → CloudKit JS → New Token. Full walkthrough in
// ICLOUD_SETUP.md. The token is safe to ship in the bundle — it only lets the
// signed-in user read/write their OWN private database.

export const CLOUD_CONFIG = {
  // Must match the container in ios/App/App/App.entitlements and Xcode's
  // Signing & Capabilities → iCloud → Containers.
  containerId: "iCloud.com.yoavtoren.usmlereview",

  // CloudKit JS API token (web sign-in). Empty = web sync stays off and the
  // login page explains what's missing.
  apiToken: "",

  // "production" so the web, TestFlight and Mac builds all share one database.
  // (The entitlement pins native debug builds to Production too.)
  environment: "production",
};

export function isWebCloudConfigured() {
  return Boolean(CLOUD_CONFIG.containerId && CLOUD_CONFIG.apiToken);
}
