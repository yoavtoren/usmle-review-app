// Native (Capacitor/iOS) bootstrap. No-ops on the web build.
import { Capacitor } from "@capacitor/core";

export function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  // Mark the document so CSS can add safe-area padding only on device.
  document.documentElement.classList.add("native-ios");

  // Status bar: dark icons/text on the light editorial background.
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  });

  // Hide the splash once the first paint is done.
  import("@capacitor/splash-screen").then(({ SplashScreen }) => {
    requestAnimationFrame(() => SplashScreen.hide().catch(() => {}));
  });
}
