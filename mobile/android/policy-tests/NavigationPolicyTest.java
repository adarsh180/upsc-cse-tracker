import com.adarsh.upsc.NavigationPolicy;

public final class NavigationPolicyTest {
    public static void main(String[] args) {
        check(NavigationPolicy.isInternal(NavigationPolicy.HOME), "home");
        check(NavigationPolicy.isInternal("https://upsc-cse-tracker-adarsh.vercel.app:443/tests"), "HTTPS port");
        for (String url : new String[]{
            "http://upsc-cse-tracker-adarsh.vercel.app/dashboard",
            "https://upsc-cse-tracker-adarsh.vercel.app.evil.test/dashboard",
            "https://evil.test/?next=https://upsc-cse-tracker-adarsh.vercel.app",
            "https://user@upsc-cse-tracker-adarsh.vercel.app",
            "https://upsc-cse-tracker-adarsh.vercel.app:8443",
            "file:///etc/passwd", "javascript:alert(1)", "intent://dashboard", "not a URL"
        }) check(!NavigationPolicy.isInternal(url), "reject: " + url);
        check(NavigationPolicy.isHttps("https://example.org/"), "external HTTPS");
        check(!NavigationPolicy.isHttps("https://user:secret@example.org/"), "external credentials");
        System.out.println("Navigation origin policy: 13 checks passed");
    }
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
}
