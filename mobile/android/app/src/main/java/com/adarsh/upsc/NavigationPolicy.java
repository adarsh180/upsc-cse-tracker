package com.adarsh.upsc;

import java.net.URI;

/** Only the owner's exact HTTPS origin may remain inside the authenticated WebView. */
public final class NavigationPolicy {
    public static final String HOST = "upsc-cse-tracker-adarsh.vercel.app";
    public static final String HOME = "https://" + HOST + "/dashboard";
    public static boolean isHttps(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (IllegalArgumentException error) { return false; }
    }
    public static boolean isInternal(String value) {
        return isHttps(value) && HOST.equalsIgnoreCase(URI.create(value).getHost());
    }
    private NavigationPolicy() {}
}
