import Foundation
import Capacitor
import CloudKit

/// Bridges the app's CloudKit PRIVATE database to JS — the same per-Apple-ID
/// database the web build reaches through CloudKit JS, so progress made in a
/// browser and on this device stay in lockstep. One record per localStorage
/// key: record type "KV", string field "payload" = JSON {t, v}. Record name is
/// "kv_" + key with ":" → "." (must match recordNameFor in cloudkitWeb.js).
/// Conflict policy is .allKeys (blind overwrite) — per-key last-write-wins is
/// enforced by the JS reconcile layer before anything is pushed.
@objc(CloudKitKVPlugin)
public class CloudKitKVPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudKitKVPlugin"
    public let jsName = "CloudKitKV"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getItems", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setItems", returnType: CAPPluginReturnPromise),
    ]

    /// Must match App.entitlements and src/lib/cloudConfig.js.
    private static let containerID = "iCloud.com.yoavtoren.usmlereview"
    private let recordType = "KV"

    private var database: CKDatabase {
        CKContainer(identifier: Self.containerID).privateCloudDatabase
    }

    private func recordName(for key: String) -> String {
        "kv_" + key.replacingOccurrences(of: ":", with: ".")
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        CKContainer(identifier: Self.containerID).accountStatus { status, _ in
            call.resolve(["available": status == .available])
        }
    }

    /// { keys: [localKey] } → { items: { localKey: payloadString } }.
    /// Missing records (key never synced) are simply absent from the result.
    @objc func getItems(_ call: CAPPluginCall) {
        guard let keys = call.getArray("keys", String.self), !keys.isEmpty else {
            call.resolve(["items": [:]])
            return
        }
        var nameToKey: [CKRecord.ID: String] = [:]
        for k in keys { nameToKey[CKRecord.ID(recordName: recordName(for: k))] = k }

        var items: [String: String] = [:]
        let lock = NSLock()
        let op = CKFetchRecordsOperation(recordIDs: Array(nameToKey.keys))
        op.perRecordResultBlock = { recordID, result in
            guard case .success(let record) = result,
                  let key = nameToKey[recordID],
                  let payload = record["payload"] as? String else { return }
            lock.lock(); items[key] = payload; lock.unlock()
        }
        op.fetchRecordsResultBlock = { result in
            switch result {
            case .success:
                call.resolve(["items": items])
            case .failure(let error):
                // Partial failure is expected when some keys don't exist yet;
                // return what we got. Reject only on a total failure.
                if let ck = error as? CKError, ck.code == .partialFailure {
                    call.resolve(["items": items])
                } else {
                    call.reject("CloudKit fetch failed: \(error.localizedDescription)")
                }
            }
        }
        op.qualityOfService = .userInitiated
        database.add(op)
    }

    /// { items: [{ key, value }] } — value is the JSON {t, v} payload string.
    @objc func setItems(_ call: CAPPluginCall) {
        guard let raw = call.getArray("items") as? [[String: Any]], !raw.isEmpty else {
            call.resolve()
            return
        }
        var records: [CKRecord] = []
        for entry in raw {
            guard let key = entry["key"] as? String, let value = entry["value"] as? String else { continue }
            let record = CKRecord(recordType: recordType,
                                  recordID: CKRecord.ID(recordName: recordName(for: key)))
            record["payload"] = value as CKRecordValue
            records.append(record)
        }
        let op = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: nil)
        op.savePolicy = .allKeys
        op.modifyRecordsResultBlock = { result in
            switch result {
            case .success:
                call.resolve()
            case .failure(let error):
                call.reject("CloudKit save failed: \(error.localizedDescription)")
            }
        }
        op.qualityOfService = .userInitiated
        database.add(op)
    }
}
