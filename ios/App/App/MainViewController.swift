import UIKit
import Capacitor

/// App's bridge view controller. Capacitor only auto-registers plugins that ship
/// as npm packages; plugins living in the app target (ICloudKVPlugin) must be
/// registered here or JS calls to them reject with "not implemented".
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudKVPlugin())
    }
}
