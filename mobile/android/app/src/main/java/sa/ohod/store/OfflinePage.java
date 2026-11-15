package sa.ohod.store;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.webkit.WebView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** صفحة «ما فيه نت» المشتركة (public/offline.html داخل التطبيق) لتطبيق الزبون وتطبيق المالك. */
final class OfflinePage {
    private OfflinePage() { }

    static boolean online(Context c) {
        try {
            ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);
            if (cm == null) return true;
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception e) {
            return true;   // ما نعرف: نخلي الموقع يحاول
        }
    }

    static String html(Context c, String err, String retry) {
        try (InputStream in = c.getAssets().open("public/offline.html")) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) > 0) o.write(b, 0, n);
            String s = o.toString("UTF-8").replace("__ERR__", err == null ? "" : err);
            return retry == null ? s : s.replace("__RETRY__", retry);
        } catch (Exception e) {
            return "<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'></head>"
                + "<body style='font:16px sans-serif;text-align:center;padding:40px'><h1>ما فيه اتصال بالإنترنت</h1><p>تأكد من الواي فاي أو البيانات</p></body></html>";
        }
    }

    static void show(Context c, WebView v, String base, String err) {
        String page = html(c, err, null);
        v.post(() -> v.loadDataWithBaseURL(base, page, "text/html", "utf-8", null));
    }
}
