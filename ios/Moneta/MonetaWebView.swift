import SwiftUI
import WebKit
import WidgetKit

private let appGroup = "group.com.kirsm11.moneta"

struct MonetaWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "monetaWidget")
        config.userContentController = controller
        let web = WKWebView(frame: .zero, configuration: config)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false

        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            web.loadHTMLString("<html><body style='background:#111;color:white;font-family:-apple-system;padding:40px'><h2>Moneta</h2><p>Web resources missing.</p></body></html>", baseURL: nil)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "monetaWidget",
                  let body = message.body as? [String: Any] else { return }
            let spent = (body["spent"] as? NSNumber)?.doubleValue ?? 0
            let stamp = body["date"] as? String ?? ""
            let defaults = UserDefaults(suiteName: appGroup)
            defaults?.set(spent, forKey: "todaySpent")
            defaults?.set(stamp, forKey: "todayDate")
            defaults?.set(Date().timeIntervalSince1970, forKey: "lastSync")
            WidgetCenter.shared.reloadTimelines(ofKind: "MonetaDailyWidget")
        }
    }
}
