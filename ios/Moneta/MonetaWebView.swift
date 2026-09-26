import SwiftUI
import WebKit
import WidgetKit
import LocalAuthentication

private func sharedDefaults() -> UserDefaults? {
    guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
          let data = try? Data(contentsOf: url),
          let raw = String(data: data, encoding: .isoLatin1),
          let xmlStart = raw.range(of: "<?xml"),
          let xmlEnd = raw.range(of: "</plist>", range: xmlStart.lowerBound..<raw.endIndex) else {
        return UserDefaults(suiteName: "group.com.kirsm11.moneta")
    }
    let xml = String(raw[xmlStart.lowerBound..<xmlEnd.upperBound])
    guard let xmlData = xml.data(using: .utf8),
          let plist = try? PropertyListSerialization.propertyList(from: xmlData, format: nil) as? [String: Any],
          let entitlements = plist["Entitlements"] as? [String: Any],
          let groups = entitlements["com.apple.security.application-groups"] as? [String],
          let group = groups.first else {
        return UserDefaults(suiteName: "group.com.kirsm11.moneta")
    }
    return UserDefaults(suiteName: group)
}

struct MonetaWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "monetaWidget")
        controller.add(context.coordinator, name: "monetaNative")
        config.userContentController = controller
        let web = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = web
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        weak var webView: WKWebView?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            if message.name == "monetaWidget" {
                let spent = (body["spent"] as? NSNumber)?.doubleValue ?? 0
                let defaults = sharedDefaults()
                defaults?.set(spent, forKey: "todaySpent")
                defaults?.set(Date().timeIntervalSince1970, forKey: "lastSync")
                WidgetCenter.shared.reloadTimelines(ofKind: "MonetaDailyWidget")
                return
            }
            guard message.name == "monetaNative",
                  let action = body["action"] as? String,
                  let requestId = body["requestId"] as? String else { return }
            if action == "biometricStatus" { biometricStatus(requestId) }
            if action == "authenticateBiometric" { authenticate(requestId) }
        }

        private func reply(_ requestId: String, _ payload: [String: Any]) {
            guard JSONSerialization.isValidJSONObject(payload),
                  let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            let rid = requestId.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript("window.MonetaNativeReply && window.MonetaNativeReply('\(rid)', \(json));")
            }
        }

        private func biometricStatus(_ requestId: String) {
            let ctx = LAContext()
            var error: NSError?
            let available = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            reply(requestId, ["ok": true, "available": available])
        }

        private func authenticate(_ requestId: String) {
            let ctx = LAContext()
            ctx.localizedCancelTitle = "Ввести PIN"
            var error: NSError?
            guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
                reply(requestId, ["ok": false, "error": "Face ID недоступен"])
                return
            }
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Войти в Монету") { [weak self] success, error in
                self?.reply(requestId, success ? ["ok": true] : ["ok": false, "error": error?.localizedDescription ?? "Не удалось распознать лицо"])
            }
        }
    }
}
