package sa.ohod.store;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * تطبيق الزبون: يفتح الموقع الحي. لو ما فيه نت نعرض صفحة «ما فيه نت» (الشعار بالخوذة) من داخل التطبيق بأنفسنا،
 * بدل errorPath حق Capacitor (اللي يبني الرابط على دومين الموقع فيطلع أبيض)، ونرجع للموقع لحاله أول ما يرجع النت.
 */
public class MainActivity extends BridgeActivity {
    private static final String BASE = "https://1097mbnalll-ui.github.io/";
    private volatile boolean showingOffline = false;
    private ConnectivityManager.NetworkCallback netCb;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { OfflinePage.show(MainActivity.this, view, BASE, error.getErrorCode() + " " + error.getDescription()); showingOffline = true; return; }
                super.onReceivedError(view, request, error);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.startsWith(BASE + "Super")) showingOffline = false;
            }
        });
        if (!OfflinePage.online(this)) { OfflinePage.show(this, bridge.getWebView(), BASE, "no network"); showingOffline = true; }
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm != null) {
            netCb = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    if (!showingOffline) return;
                    WebView w = bridge.getWebView();
                    w.postDelayed(() -> { if (showingOffline) w.loadUrl(bridge.getServerUrl() != null ? bridge.getServerUrl() : BASE + "Super/?app=android"); }, 1500);
                }
            };
            try { cm.registerDefaultNetworkCallback(netCb); } catch (Exception ignored) { netCb = null; }
        }
    }

    @Override
    public void onDestroy() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm != null && netCb != null) { try { cm.unregisterNetworkCallback(netCb); } catch (Exception ignored) { } }
        super.onDestroy();
    }
}
