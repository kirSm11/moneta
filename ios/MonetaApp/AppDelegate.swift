import UIKit
import WebKit
import LocalAuthentication
import WidgetKit

private let appGroupID = "group.com.kirsm11.moneta.shared"

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var window: UIWindow?
    private var webView: WKWebView!

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(self, name: "monetaNative")
        config.userContentController.addUserScript(WKUserScript(source: Self.bridgeJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black

        let controller = UIViewController()
        controller.view = webView
        controller.view.backgroundColor = .black

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window

        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            assertionFailure("web/index.html missing from bundle")
            return true
        }
        let webRoot = indexURL.deletingLastPathComponent()
        webView.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
        return true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        let requestID = body["id"] as? String

        switch type {
        case "faceID":
            handleFaceID(body, requestID: requestID)
        case "shareFile":
            handleShare(body, requestID: requestID)
        case "widgetUpdate":
            handleWidgetUpdate(body)
            resolve(requestID, value: true)
        default:
            resolve(requestID, ok: false, value: "Unknown native action")
        }
    }

    private func handleWidgetUpdate(_ body: [String: Any]) {
        let spent = (body["spent"] as? NSNumber)?.doubleValue ?? 0
        let date = body["date"] as? String ?? Self.localDateString(Date())
        guard let shared = UserDefaults(suiteName: appGroupID) else { return }
        shared.set(max(0, spent), forKey: "spentToday")
        shared.set(date, forKey: "spentDate")
        shared.set(Date().timeIntervalSince1970, forKey: "updatedAt")
        WidgetCenter.shared.reloadTimelines(ofKind: "MonetaDailyBudget")
    }

    private func handleFaceID(_ body: [String: Any], requestID: String?) {
        let action = body["action"] as? String ?? "status"
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if action == "status" {
            let reason: Any = available ? NSNull() : (error?.localizedDescription ?? "Face ID unavailable")
            resolve(requestID, value: ["available": available, "reason": reason])
            return
        }

        guard available else {
            resolve(requestID, value: false)
            return
        }

        let reason = (body["reason"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Подтверди вход в Moneta"
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { [weak self] success, _ in
            DispatchQueue.main.async { self?.resolve(requestID, value: success) }
        }
    }

    private func handleShare(_ body: [String: Any], requestID: String?) {
        guard let text = body["text"] as? String else {
            resolve(requestID, ok: false, value: "No file data")
            return
        }
        let filename = (body["filename"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "moneta-backup.json"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try text.data(using: .utf8)?.write(to: url, options: .atomic)
            let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = activity.popoverPresentationController, let view = window?.rootViewController?.view {
                pop.sourceView = view
                pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            }
            window?.rootViewController?.present(activity, animated: true)
            resolve(requestID, value: true)
        } catch {
            resolve(requestID, ok: false, value: error.localizedDescription)
        }
    }

    private func resolve(_ id: String?, ok: Bool = true, value: Any) {
        guard let id else { return }
        let payload: [String: Any] = ["value": value]
        let json = (try? JSONSerialization.data(withJSONObject: payload))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{\"value\":null}"
        let valueJSON = String(json.dropFirst("{\"value\":".count).dropLast())
        let safeID = id.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        webView.evaluateJavaScript("window.__monetaNativeResolve && window.__monetaNativeResolve('\(safeID)', \(ok ? "true" : "false"), \(valueJSON));")
    }

    private static func localDateString(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = .current
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private static let bridgeJS = #"""
    window.__MONETA_NATIVE_IOS__ = true;
    (function(){
      var seq = 0, pending = Object.create(null);
      function call(payload){
        return new Promise(function(resolve,reject){
          var id = 'm' + Date.now().toString(36) + '_' + (++seq);
          pending[id] = {resolve:resolve,reject:reject};
          payload.id = id;
          window.webkit.messageHandlers.monetaNative.postMessage(payload);
        });
      }
      window.__monetaNativeResolve = function(id,ok,value){
        var p=pending[id]; if(!p)return; delete pending[id];
        ok ? p.resolve(value) : p.reject(new Error(String(value||'Native error')));
      };
      window.MonetaNative = {
        faceID:function(action,reason){ return call({type:'faceID',action:action,reason:reason||''}); },
        shareFile:function(filename,text,mime){ return call({type:'shareFile',filename:filename,text:text,mime:mime||'application/json'}); },
        updateWidget:function(spent,date){ return call({type:'widgetUpdate',spent:Number(spent)||0,date:String(date||'')}); }
      };
    })();
    """#
}
