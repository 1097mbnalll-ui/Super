package sa.ohod.store;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * تطبيق المالك (إدارة أحد): متصفح مدمج بسيط (بدون Capacitor) يفتح الموقع الحي ويوصّلك لشاشة كلمة السر على طول.
 * بدون Capacitor الموقع يتصرف كموقع عادي (فيه زر الدخول للإدارة)، فيشتغل مع الموقع الحالي بدون أي تحديث له.
 * يُستخدم فقط في بناء المالك (sa.ohod.owner)؛ بناء الزبائن يستخدم MainActivity.
 */
public class OwnerActivity extends AppCompatActivity {
    private static final String SITE = "https://1097mbnalll-ui.github.io/Super/?app=owner";
    private static final int FILE_REQ = 77;

    // يضغط «حسابي» ثم «الدخول» لين تطلع شاشة كلمة السر، ولو اختفت (تحديث بيانات متأخر) يفتحها من جديد
    // لين تلمس الشاشة أول مرة. الموقع الجديد يفتحها بنفسه.
    private static final String GO_JS =
        "(function(){if(window.__ownerGo)return;window.__ownerGo=1;var touched=false;" +
        "['touchstart','pointerdown','mousedown','keydown'].forEach(function(e){addEventListener(e,function(){touched=true;},true);});" +
        "var n=0;var iv=setInterval(function(){n++;if(touched||n>150){clearInterval(iv);return;}" +
        "if(document.getElementById('pinSheet'))return;" +
        "var t=document.getElementById('toAdmin');if(t){t.click();return;}" +
        "var m=[].slice.call(document.querySelectorAll('[data-nav=\"more\"]')).pop();if(m)m.click();},400);})();";

    private static final String OFFLINE_HTML =
        "<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;" +
        "background:linear-gradient(#DDF1EA,#fff 60%);color:#0D1420;font:16px/1.7 sans-serif;text-align:center;padding:24px}" +
        "button{min-height:52px;min-width:200px;border:0;border-radius:16px;background:#0E8A6A;color:#fff;font:700 16px sans-serif}" +
        "small{color:#596171;direction:ltr}</style></head>" +
        "<body><h2>ما فيه اتصال بالإنترنت</h2><p>تأكد من الواي فاي أو البيانات، وبنحاول نرجع لك تلقائياً</p>" +
        "<button onclick=\"location.href='" + SITE + "'\">جرّب مرة ثانية</button><small id=e>%ERR%</small>" +
        "<script>setInterval(function(){location.href='" + SITE + "'},7000);</script></body></html>";

    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private long lastBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFFDDF1EA);
        web = new WebView(this);
        web.setBackgroundColor(0xFFFFFFFF);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setAllowFileAccess(false);
        st.setAllowContentAccess(false);
        st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        st.setBuiltInZoomControls(false);
        st.setSupportZoom(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String h = u.getHost();
                if ("https".equals(u.getScheme()) && h != null && (h.endsWith("github.io") || h.endsWith("workers.dev"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith("https://")) view.evaluateJavascript(GO_JS, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadDataWithBaseURL("https://1097mbnalll-ui.github.io/", OFFLINE_HTML.replace("%ERR%", err.getErrorCode() + " " + err.getDescription()), "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQ);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // رجوع داخل الموقع أول؛ لو ما فيه، ضغطتين للخروج
                web.evaluateJavascript("(function(){var b=document.querySelector('[data-nav=\"back\"]');if(b){b.click();return 1}return 0})()", v -> {
                    if ("1".equals(v)) return;
                    long now = System.currentTimeMillis();
                    if (now - lastBack < 2200) { finish(); return; }
                    lastBack = now;
                    Toast.makeText(OwnerActivity.this, "اضغط رجوع مرة ثانية للخروج", Toast.LENGTH_SHORT).show();
                });
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState); else web.loadUrl(SITE);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
