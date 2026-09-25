import SwiftUI
import WebKit
import LocalAuthentication
import UIKit

struct MonetaWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()

        let bridgeScript = """
        window.__MONETA_NATIVE_IOS__ = true;
        window.MonetaNative = {
          faceID: function(action, reason) {
            return window.webkit.messageHandlers.monetaNative.postMessage({
              command: 'faceID',
              action: action || 'status',
              reason: reason || ''
            });
          },
          shareFile: function(filename, text, type) {
            return window.webkit.messageHandlers.monetaNative.postMessage({
              command: 'shareFile',
              filename: filename || 'moneta-backup.json',
              text: text || '',
              type: type || 'application/json'
            });
          }
        };
        """

        controller.addUserScript(
            WKUserScript(
                source: bridgeScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        controller.addScriptMessageHandler(
            context.coordinator,
            contentWorld: .page,
            name: "monetaNative"
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        context.coordinator.webView = webView

        do {
            let startURL = try LocalWebApp.prepare()
            let readRoot = startURL.deletingLastPathComponent()
            webView.loadFileURL(startURL, allowingReadAccessTo: readRoot)
        } catch {
            let html = """
            <html>
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <body style="background:#0b0b0e;color:white;font-family:-apple-system;padding:40px">
                <h2>Не удалось запустить Кошелёк</h2>
                <p>\(error.localizedDescription)</p>
              </body>
            </html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(
            forName: "monetaNative",
            contentWorld: .page
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
        weak var webView: WKWebView?

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage,
            replyHandler: @escaping (Any?, String?) -> Void
        ) {
            guard
                message.name == "monetaNative",
                let body = message.body as? [String: Any],
                let command = body["command"] as? String
            else {
                replyHandler(nil, "Некорректная команда нативного моста")
                return
            }

            switch command {
            case "faceID":
                handleFaceID(body, replyHandler: replyHandler)
            case "shareFile":
                handleShare(body, replyHandler: replyHandler)
            default:
                replyHandler(nil, "Неизвестная команда: \(command)")
            }
        }

        private func handleFaceID(
            _ body: [String: Any],
            replyHandler: @escaping (Any?, String?) -> Void
        ) {
            let action = body["action"] as? String ?? "status"
            let context = LAContext()
            context.localizedCancelTitle = "Отмена"

            var authError: NSError?
            let available = context.canEvaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                error: &authError
            )

            if action == "status" {
                var biometry = "none"
                if available {
                    switch context.biometryType {
                    case .faceID: biometry = "faceID"
                    case .touchID: biometry = "touchID"
                    default: biometry = "unknown"
                    }
                }

                replyHandler(
                    [
                        "available": available,
                        "biometryType": biometry,
                        "reason": available ? NSNull() : "native"
                    ],
                    nil
                )
                return
            }

            guard available else {
                replyHandler(false, nil)
                return
            }

            let reason = (body["reason"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let prompt = (reason?.isEmpty == false)
                ? reason!
                : "Подтверди вход в Кошелёк"

            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: prompt
            ) { success, _ in
                replyHandler(success, nil)
            }
        }

        private func handleShare(
            _ body: [String: Any],
            replyHandler: @escaping (Any?, String?) -> Void
        ) {
            let rawName = body["filename"] as? String ?? "moneta-backup.json"
            let filename = rawName.replacingOccurrences(of: "/", with: "-")
            let text = body["text"] as? String ?? ""

            do {
                let url = FileManager.default.temporaryDirectory
                    .appendingPathComponent(filename, isDirectory: false)

                try text.write(to: url, atomically: true, encoding: .utf8)

                DispatchQueue.main.async {
                    self.presentShareSheet(for: url)
                    replyHandler("native", nil)
                }
            } catch {
                replyHandler(nil, "Не удалось подготовить файл: \(error.localizedDescription)")
            }
        }

        private func presentShareSheet(for fileURL: URL) {
            guard let presenter = Self.topViewController() else { return }

            let activity = UIActivityViewController(
                activityItems: [fileURL],
                applicationActivities: nil
            )

            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.midX,
                    y: presenter.view.bounds.maxY - 1,
                    width: 1,
                    height: 1
                )
            }

            presenter.present(activity, animated: true)
        }

        private static func topViewController() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }

            var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController

            while let presented = top?.presentedViewController {
                top = presented
            }

            if let navigation = top as? UINavigationController {
                return navigation.visibleViewController ?? navigation
            }

            if let tabs = top as? UITabBarController {
                return tabs.selectedViewController ?? tabs
            }

            return top
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard
                navigationAction.navigationType == .linkActivated,
                let url = navigationAction.request.url,
                ["http", "https"].contains(url.scheme?.lowercased() ?? "")
            else {
                decisionHandler(.allow)
                return
            }

            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }
}

private enum LocalWebApp {
    static func prepare() throws -> URL {
        let fm = FileManager.default

        guard let bundledWeb = Bundle.main.resourceURL?
            .appendingPathComponent("web", isDirectory: true),
              fm.fileExists(atPath: bundledWeb.path)
        else {
            throw NSError(
                domain: "Moneta",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "В приложении нет папки web."]
            )
        }

        let support = try fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )

        let destination = support.appendingPathComponent("MonetaWeb", isDirectory: true)
        let marker = destination.appendingPathComponent(".bundle-version")
        let version = [
            Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
            Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        ].joined(separator: "-")

        let installedVersion = try? String(contentsOf: marker, encoding: .utf8)

        if installedVersion != version || !fm.fileExists(atPath: destination.path) {
            if fm.fileExists(atPath: destination.path) {
                try fm.removeItem(at: destination)
            }

            try fm.copyItem(at: bundledWeb, to: destination)
            try version.write(to: marker, atomically: true, encoding: .utf8)
        }

        let index = destination.appendingPathComponent("index.html")
        guard fm.fileExists(atPath: index.path) else {
            throw NSError(
                domain: "Moneta",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Не найден index.html."]
            )
        }

        return index
    }
}
