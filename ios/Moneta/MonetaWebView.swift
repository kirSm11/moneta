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
        if let url = URL(string: "https://kirsm11.github.io/moneta/") {
            web.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
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
