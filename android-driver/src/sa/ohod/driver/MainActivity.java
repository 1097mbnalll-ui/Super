package sa.ohod.driver;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONObject;

/**
 * التطبيق نفسه: يفتح صفحة المندوب من موقع المتجر (فأي تعديل على الموقع يوصل التطبيق لحاله)،
 * وخدمة بالخلفية (TrackService) تستقبل الطلبات وترسل موقع المندوب حتى والشاشة مقفلة.
 */
public class MainActivity extends Activity {
    static final String HOST = "1097mbnalll-ui.github.io";
    static final String SITE = "https://" + HOST + "/Super/";
    static final String START = SITE + "?app=driver&native=1#driver";
    private static final int REQ_PERM = 11;

    static volatile boolean visible;
    private WebView wv;

    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.setStatusBarColor(0xFF13213C);
        w.setNavigationBarColor(0xFF13213C);
        Notif.ensure(this);

        wv = new WebView(this);
        wv.setBackgroundColor(0xFF13213C);
        setContentView(wv);

        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // صوت تنبيه الطلب الجديد داخل الصفحة
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " OhodDriverApp/4");
        WebView.setWebContentsDebuggingEnabled(false);
        wv.addJavascriptInterface(new Bridge(), "OhodApp");

        wv.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String sc = u.getScheme();
                if ("about".equals(sc)) return false;
                if ("https".equals(sc) && HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/Super")) {
                    // التطبيق للمندوب بس: أي صفحة ثانية من الموقع (المتجر مثلاً) ترجع لصفحة المندوب
                    String q = u.getQuery(), f = u.getFragment();
                    if ("driver".equals(f) || (q != null && q.contains("app=driver"))) return false;
                    v.loadUrl(START);
                    return true;
                }
                try {   // الخرائط والاتصال والواتساب تنفتح بتطبيقاتها
                    startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOffline();
            }

            @Override public void onPageStarted(WebView v, String url, Bitmap icon) { }
        });
        wv.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, hasLocation(), false);
            }
        });

        wv.setDownloadListener(new android.webkit.DownloadListener() {
            @Override public void onDownloadStart(String url, String ua, String cd, String mime, long len) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            }
        });

        if (saved != null) wv.restoreState(saved);
        else wv.loadUrl(START);
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        wv.saveState(out);
    }

    @Override protected void onResume() {
        super.onResume();
        visible = true;
        wv.onResume();
        if (Prefs.pin(this).length() > 0 && !TrackService.running) TrackService.start(this);
        Updater.check(this, false);   // فيه تحديث؟ تطلع رسالة «حدّث الآن»
    }

    @Override protected void onPause() {
        visible = false;
        wv.onPause();
        super.onPause();
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
    }

    @Override protected void onDestroy() {
        visible = false;
        wv.removeJavascriptInterface("OhodApp");
        wv.destroy();
        super.onDestroy();
    }

    /** زر الرجوع: الصفحة تتصرف أول (ترجع للقائمة)، وإلا نصغّر التطبيق بدون ما نقفله (عشان الخدمة تكمل). */
    @Override public void onBackPressed() {
        wv.evaluateJavascript("(function(){try{return window.__ohodBack?window.__ohodBack():false}catch(e){return false}})()", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                if ("true".equals(v)) return;
                moveTaskToBack(true);   // ما نرجع بالصفحات أبداً (عشان ما يطلع المتجر)، نصغّر التطبيق بس
            }
        });
    }

    private void showOffline() {
        String html = "<html dir='rtl' lang='ar'><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='margin:0;background:#13213C;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh;text-align:center'>"
                + "<div style='padding:24px'><h2 style='margin:0 0 8px'>ما فيه اتصال</h2><p style='opacity:.8;margin:0'>تأكد من الإنترنت وجرّب مرة ثانية</p>"
                + "<a href='" + START + "' style='display:inline-block;margin-top:18px;background:#FF8A1F;color:#2B1300;padding:14px 30px;border-radius:14px;text-decoration:none;font-weight:700'>إعادة المحاولة</a></div></body></html>";
        wv.loadDataWithBaseURL("about:blank", html, "text/html", "UTF-8", null);
    }

    // ---------- الصلاحيات ----------
    private boolean hasLocation() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotif() {
        return ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled();
    }

    private boolean ignoringBattery() {
        return Build.VERSION.SDK_INT < 23 || ((PowerManager) getSystemService(Context.POWER_SERVICE)).isIgnoringBatteryOptimizations(getPackageName());
    }

    private void ensurePermissions() {
        List<String> need = new ArrayList<String>();
        if (!hasLocation()) {
            need.add(Manifest.permission.ACCESS_FINE_LOCATION);
            need.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            need.add("android.permission.POST_NOTIFICATIONS");
        }
        if (need.isEmpty()) {
            afterPermissions();
        } else {
            Prefs.setFlag(this, "askedPerm");
            requestPermissions(need.toArray(new String[0]), REQ_PERM);
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_PERM) afterPermissions();
    }

    private void afterPermissions() {
        TrackService.start(this);
        if (!ignoringBattery() && !Prefs.flag(this, "askedBattery")) {
            Prefs.setFlag(this, "askedBattery");
            AlertDialog d = new AlertDialog.Builder(this)
                    .setTitle("عشان توصلك الطلبات")
                    .setMessage("اسمح للتطبيق يشتغل بالخلفية بدون توفير بطارية. وإلا الجوال يوقفه لما الشاشة تنقفل وتفوتك طلبات.")
                    .setPositiveButton("اسمح", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface di, int which) { openBatterySettings(); }
                    })
                    .setNegativeButton("لاحقاً", null)
                    .create();
            d.show();
            d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        }
    }

    private void openBatterySettings() {
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignored) { }
        }
    }

    private void openAppSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        } catch (Exception ignored) {
        }
    }

    /** الجسر بين صفحة المندوب (جافاسكربت) والتطبيق. ما ينكشف إلا لصفحات موقعنا فقط (شوف shouldOverrideUrlLoading). */
    private final class Bridge {
        @JavascriptInterface public String version() { return String.valueOf(Updater.installed(MainActivity.this)); }

        @JavascriptInterface public String savedPin() { return Prefs.pin(MainActivity.this); }

        @JavascriptInterface public void session(String api, String pin, String role) {
            if (api == null || !api.startsWith("https://") || pin == null || pin.length() == 0) return;
            Prefs.save(MainActivity.this, api, pin, "admin".equals(role) ? "admin" : "driver");
            runOnUiThread(new Runnable() { @Override public void run() { ensurePermissions(); } });
        }

        @JavascriptInterface public void resume() {
            if (Prefs.pin(MainActivity.this).length() == 0) return;
            runOnUiThread(new Runnable() { @Override public void run() { ensurePermissions(); } });
        }

        @JavascriptInterface public void logout() {
            Prefs.clear(MainActivity.this);
            runOnUiThread(new Runnable() { @Override public void run() { TrackService.stop(MainActivity.this); } });
        }

        @JavascriptInterface public void share(boolean on) { Prefs.setShare(MainActivity.this, on); }

        @JavascriptInterface public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface public void askPermissions() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    // أندرويد ما يعيد سؤال الصلاحية بعد الرفض، فنفتح إعدادات التطبيق
                    if (!hasLocation() && Prefs.flag(MainActivity.this, "askedPerm") && !shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) openAppSettings();
                    else ensurePermissions();
                }
            });
        }

        @JavascriptInterface public void battery() {
            runOnUiThread(new Runnable() { @Override public void run() { openBatterySettings(); } });
        }

        @JavascriptInterface public String state() {
            JSONObject j = new JSONObject();
            try {
                j.put("running", TrackService.running);
                j.put("track", TrackService.running ? TrackService.track : "off");
                j.put("onway", TrackService.onway);
                j.put("role", Prefs.role(MainActivity.this));
                j.put("perm", hasLocation());
                j.put("notif", hasNotif());
                j.put("battery", ignoringBattery());
            } catch (Exception ignored) {
            }
            return j.toString();
        }
    }
}
