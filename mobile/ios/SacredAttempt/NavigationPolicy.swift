import Foundation

enum NavigationPolicy {
    static let host = "upsc-cse-tracker-adarsh.vercel.app"
    static let home = URL(string: "https://\(host)/dashboard")!

    static func isHTTPS(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host != nil && url.user == nil
            && url.password == nil && (url.port == nil || url.port == 443)
    }
    static func isInternal(_ url: URL) -> Bool {
        isHTTPS(url) && url.host?.lowercased() == host
    }
}
