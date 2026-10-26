import XCTest
@testable import SacredAttempt

final class NavigationPolicyTests: XCTestCase {
    func testOnlyExactHTTPSOriginIsInternal() {
        XCTAssertTrue(NavigationPolicy.isInternal(NavigationPolicy.home))
        XCTAssertTrue(NavigationPolicy.isInternal(URL(string: "https://upsc-cse-tracker-adarsh.vercel.app:443/goals")!))
        for value in ["http://upsc-cse-tracker-adarsh.vercel.app", "https://upsc-cse-tracker-adarsh.vercel.app.evil.test",
                      "https://evil.test/?next=https://upsc-cse-tracker-adarsh.vercel.app",
                      "https://user@upsc-cse-tracker-adarsh.vercel.app", "https://upsc-cse-tracker-adarsh.vercel.app:8443", "file:///etc/passwd"] {
            XCTAssertFalse(NavigationPolicy.isInternal(URL(string: value)!), value)
        }
    }
}
