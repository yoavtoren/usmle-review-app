// Haptic feedback — native builds only, always fire-and-forget. Every call is
// safe on the web (no-op) and never blocks or throws into the UI.
import { Capacitor } from "@capacitor/core";

let mod = null;
function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!mod) mod = import("@capacitor/haptics").catch(() => null);
  return mod;
}

export function impact(style = "light") {
  const p = plugin();
  if (!p) return;
  p.then((m) => {
    if (!m) return;
    const styles = { light: m.ImpactStyle.Light, medium: m.ImpactStyle.Medium, heavy: m.ImpactStyle.Heavy };
    return m.Haptics.impact({ style: styles[style] ?? m.ImpactStyle.Light });
  }).catch(() => {});
}

export function notification(type = "success") {
  const p = plugin();
  if (!p) return;
  p.then((m) => {
    if (!m) return;
    const types = { success: m.NotificationType.Success, warning: m.NotificationType.Warning, error: m.NotificationType.Error };
    return m.Haptics.notification({ type: types[type] ?? m.NotificationType.Success });
  }).catch(() => {});
}

export function selection() {
  const p = plugin();
  if (!p) return;
  p.then((m) => m && m.Haptics.selectionChanged()).catch(() => {});
}
