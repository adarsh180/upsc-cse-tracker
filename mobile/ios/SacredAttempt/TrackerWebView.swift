import SwiftUI
import WebKit

final class TrackerModel: ObservableObject {
    let webView: WKWebView
    @Published var failed = false
    @Published var loading = true
    @Published var externalURL: URL?
    @Published var downloadNotice = false
    var lastInternal = NavigationPolicy.home

    init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.applicationNameForUserAgent = "SacredAttemptIOS/1.0"
        webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
    }
    func open(_ path: String) {
        guard let url = URL(string: path, relativeTo: NavigationPolicy.home)?.absoluteURL,
              NavigationPolicy.isInternal(url) else { return }
        webView.load(URLRequest(url: url))
    }
    func retry() { webView.load(URLRequest(url: lastInternal)) }
}

struct TrackerWebView: UIViewRepresentable {
    @ObservedObject var model: TrackerModel
    func makeCoordinator() -> Coordinator { Coordinator(model) }
    func makeUIView(context: Context) -> WKWebView {
        model.webView.navigationDelegate = context.coordinator
        model.webView.uiDelegate = context.coordinator
        model.open("/dashboard")
        return model.webView
    }
    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let model: TrackerModel
        init(_ model: TrackerModel) { self.model = model }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if NavigationPolicy.isInternal(url) { decisionHandler(.allow); return }
            // External destinations never receive an in-app authenticated browser or native bridge.
            if action.navigationType == .linkActivated && NavigationPolicy.isHTTPS(url) {
                model.externalURL = url
            }
            decisionHandler(.cancel)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                if NavigationPolicy.isInternal(url) { webView.load(action.request) }
                else if NavigationPolicy.isHTTPS(url) { model.externalURL = url }
            }
            return nil
        }
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.failed = false; model.loading = true
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.loading = false
            if let url = webView.url, NavigationPolicy.isInternal(url), url.path != "/sign-in" { model.lastInternal = url }
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            failure(error)
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failure(error) }
        private func failure(_ error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            model.failed = true; model.loading = false
        }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.failed = true; model.loading = false
        }
        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
                model.failed = true; model.loading = false; decisionHandler(.cancel); return
            }
            if !response.canShowMIMEType { model.downloadNotice = true; model.loading = false; decisionHandler(.cancel); return }
            decisionHandler(.allow)
        }
        // Default WebKit TLS validation remains enabled; no authentication-challenge bypass.
    }
}
