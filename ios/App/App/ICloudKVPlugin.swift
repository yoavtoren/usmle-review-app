import Foundation
import Capacitor

/// Bridges Apple's iCloud Key-Value Store (NSUbiquitousKeyValueStore) to JS.
/// Small JSON blobs (this app's progress) sync automatically across the
/// signed-in Apple ID's devices. Total budget is 1 MB / 1024 keys — far more
/// than this app needs. Requires the iCloud "Key-value storage" capability
/// enabled in Xcode (see ICLOUD_SETUP.md).
@objc(ICloudKVPlugin)
public class ICloudKVPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudKVPlugin"
    public let jsName = "ICloudKV"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    ]

    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeDidChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// Fired when another device (or iCloud) changes values while we're running.
    @objc private func storeDidChange(_ notification: Notification) {
        var changedKeys: [String] = []
        if let info = notification.userInfo,
           let keys = info[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] {
            changedKeys = keys
        }
        notifyListeners("icloudChange", data: ["keys": changedKeys])
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        // Token is non-nil only when the user is signed into iCloud and the
        // app's iCloud entitlement is present.
        let available = FileManager.default.ubiquityIdentityToken != nil
        call.resolve(["available": available])
    }

    @objc func setItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }

    @objc func removeItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        store.removeObject(forKey: key)
        store.synchronize()
        call.resolve()
    }

    /// Returns every string value currently in the store, keyed by its iCloud key.
    @objc func getAll(_ call: CAPPluginCall) {
        var out: [String: String] = [:]
        for (k, v) in store.dictionaryRepresentation {
            if let s = v as? String { out[k] = s }
        }
        call.resolve(["items": out])
    }

    @objc func sync(_ call: CAPPluginCall) {
        let ok = store.synchronize()
        call.resolve(["ok": ok])
    }
}
