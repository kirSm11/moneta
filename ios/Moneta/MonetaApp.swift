import SwiftUI

@main
struct MonetaApp: App {
    var body: some Scene {
        WindowGroup {
            MonetaWebView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
        }
    }
}
