package com.adarsh.upsc;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.util.Locale;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends ComponentActivity {
    private WebView web;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private TextView timerText;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ValueCallback<Uri[]> upload;
    private boolean failed;
    private String lastInternal = NavigationPolicy.HOME;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (timerText != null) timerText.setText(timerLabel());
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(250, 250, 252));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView brand = new TextView(this);
        brand.setText("Sacred Attempt"); brand.setTextSize(18); brand.setTextColor(Color.rgb(25, 30, 40));
        brand.setPadding(dp(16), dp(10), 0, dp(10));
        bar.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
        bar.addView(button("Focus", v -> showFocus()));
        bar.addView(button("Menu", v -> showMenu()));
        root.addView(bar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        FrameLayout content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL); errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(Color.rgb(250, 250, 252));
        TextView error = new TextView(this);
        error.setText("Your tracker couldn’t load\n\nCheck your connection and try again. The focus timer works offline. Unsaved web forms may need to be entered again.");
        error.setTextSize(18); error.setGravity(Gravity.CENTER); error.setTextColor(Color.DKGRAY);
        errorPanel.addView(error);
        errorPanel.addView(button("Try again", v -> web.loadUrl(lastInternal)));
        errorPanel.addView(button("Open focus timer", v -> showFocus()));
        errorPanel.setVisibility(View.GONE);
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack(); else finish();
            }
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " SacredAttemptAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return !NavigationPolicy.isInternal(request.getUrl().toString());
                return route(request.getUrl().toString(), request.hasGesture());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (!NavigationPolicy.isInternal(url)) { view.stopLoading(); return; }
                lastInternal = url; failed = false; errorPanel.setVisibility(View.GONE); progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE); CookieManager.getInstance().flush();
                if (!failed) errorPanel.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler ssl, SslError error) {
                ssl.cancel(); showError(); // Never bypass certificate errors.
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message message) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (NavigationPolicy.isInternal(url)) web.loadUrl(url); else route(url, true);
                        child.destroy(); return true;
                    }
                });
                ((WebView.WebViewTransport) message.obj).setWebView(popup); message.sendToTarget(); return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!NavigationPolicy.isInternal(view.getUrl())) return false;
                if (upload != null) upload.onReceiveValue(null);
                upload = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(picker, 10); }
                catch (ActivityNotFoundException error) { upload.onReceiveValue(null); upload = null; }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> new AlertDialog.Builder(this)
                .setTitle("Download in your browser")
                .setMessage("For this download, open the tracker in your browser and sign in there. Your app session stays private.")
                .setPositiveButton("Open tracker", (d, which) -> openBrowser(NavigationPolicy.HOME))
                .setNegativeButton("Cancel", null).show());
        // A fresh GET avoids restoring or replaying a submitted password/form body.
        web.loadUrl(NavigationPolicy.HOME);
    }

    private boolean route(String url, boolean gesture) {
        if (NavigationPolicy.isInternal(url)) return false;
        if (gesture && NavigationPolicy.isHttps(url)) new AlertDialog.Builder(this)
            .setTitle("Open external website?").setMessage(Uri.parse(url).getHost())
            .setPositiveButton("Open browser", (d, which) -> openBrowser(url)).setNegativeButton("Cancel", null).show();
        return true;
    }
    private void openBrowser(String url) {
        if (!NavigationPolicy.isHttps(url)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, "No browser is available.", Toast.LENGTH_LONG).show(); }
    }
    private void showError() { failed = true; errorPanel.setVisibility(View.VISIBLE); progress.setVisibility(View.GONE); }
    private Button button(String text, View.OnClickListener action) {
        Button button = new Button(this); button.setText(text); button.setAllCaps(false);
        button.setMinHeight(dp(48)); button.setOnClickListener(action); return button;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private SharedPreferences focus() { return getSharedPreferences("focus", MODE_PRIVATE); }
    private String timerLabel() {
        long end = focus().getLong("end", 0);
        if (end == 0) return "Choose a focus session";
        long seconds = Math.max(0, (end - System.currentTimeMillis() + 999) / 1000);
        if (seconds == 0) return "Timer finished\nRecord your actual work in Goals.";
        return String.format(Locale.getDefault(), "%02d:%02d", seconds / 60, seconds % 60);
    }
    private PendingIntent alarmIntent() {
        return PendingIntent.getBroadcast(this, 1, new Intent(this, TimerReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private void startFocus(int minutes) {
        if (focus().getLong("end", 0) > System.currentTimeMillis()) {
            new AlertDialog.Builder(this).setTitle("Replace your running timer?")
                .setMessage("This starts a new " + minutes + " minute session.")
                .setPositiveButton("Replace", (d,w) -> setFocus(minutes)).setNegativeButton("Keep timer", null).show();
        } else setFocus(minutes);
    }
    private void setFocus(int minutes) {
        long end = System.currentTimeMillis() + minutes * 60000L;
        focus().edit().putLong("end", end).apply();
        getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, alarmIntent());
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 11);
        if (timerText != null) timerText.setText(timerLabel());
    }
    private void showFocus() {
        LinearLayout panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL); panel.setPadding(dp(20), dp(12), dp(20), dp(12));
        timerText = new TextView(this); timerText.setTextSize(28); timerText.setGravity(Gravity.CENTER); timerText.setText(timerLabel()); panel.addView(timerText);
        for (int minutes : new int[]{25, 50, 90}) panel.addView(button(minutes + " minutes", v -> startFocus(minutes)));
        panel.addView(button("Clear timer", v -> {
            if (focus().getLong("end", 0) == 0) return;
            new AlertDialog.Builder(this).setTitle("Clear this timer?").setPositiveButton("Clear", (d,w) -> {
                focus().edit().remove("end").apply(); getSystemService(AlarmManager.class).cancel(alarmIntent());
                getSystemService(NotificationManager.class).cancel(1); timerText.setText(timerLabel());
            }).setNegativeButton("Keep", null).show();
        }));
        TextView note = new TextView(this); note.setText("Works offline on this device. Time is not automatically logged as study. Finish alerts require notifications and may be delayed by battery settings.");
        note.setTextSize(16); panel.addView(note);
        new AlertDialog.Builder(this).setTitle("Focus timer").setView(panel).setPositiveButton("Back to tracker", null).show();
    }
    private void showMenu() {
        String[] items = {"Dashboard", "Daily goals", "Tests", "Report card", "Open in browser"};
        String[] paths = {"/dashboard", "/goals", "/tests", "/report-card"};
        new AlertDialog.Builder(this).setTitle("Your workspace").setItems(items, (d, i) -> {
            if (i == 4) openBrowser(NavigationPolicy.HOME);
            else web.loadUrl("https://" + NavigationPolicy.HOST + paths[i]);
        }).show();
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 10 && upload != null) {
            Uri[] values = null;
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    values = new Uri[data.getClipData().getItemCount()];
                    for (int i = 0; i < values.length; i++) values[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) values = new Uri[]{data.getData()};
            }
            upload.onReceiveValue(values); upload = null;
        }
    }
    @Override protected void onResume() { super.onResume(); handler.post(tick); }
    @Override protected void onPause() { handler.removeCallbacks(tick); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacks(tick); if (upload != null) upload.onReceiveValue(null); web.destroy(); super.onDestroy(); }
}
