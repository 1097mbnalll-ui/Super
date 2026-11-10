package sa.ohod.driver;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.JSONObject;

/** نداء واحد للخادم (Cloudflare Worker). ما يرمي استثناء أبداً: عند الفشل يرجع {ok:false, code:"network"}. */
final class Api {
    /** الخادم يقبل بس الطلبات اللي جاية من موقع المتجر، فنرسل نفس الـ Origin حق الموقع. */
    static final String ORIGIN = "https://1097mbnalll-ui.github.io";

    private Api() {}

    static JSONObject post(String base, String path, JSONObject body) {
        HttpURLConnection c = null;
        try {
            URL u = new URL(base.replaceAll("/+$", "") + path);
            c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(12000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setUseCaches(false);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Origin", ORIGIN);
            byte[] b = body.toString().getBytes("UTF-8");
            OutputStream os = c.getOutputStream();
            os.write(b);
            os.close();
            int code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            String s = is == null ? "" : read(is);
            JSONObject j;
            try {
                j = new JSONObject(s);
            } catch (Exception e) {
                j = new JSONObject();
                j.put("ok", false);
                j.put("code", "http_" + code);
            }
            j.put("status", code);
            return j;
        } catch (Exception e) {
            return fail("network");
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** نداء GET بسيط (ملف الإصدار). يرجع null لو فشل. */
    static String get(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(12000);
            c.setUseCaches(false);
            if (c.getResponseCode() != 200) return null;
            return read(c.getInputStream());
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** تنزيل ملف (التحديث). يرجع null لو فشل أو كبر عن الحد. */
    static byte[] download(String url, int max) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(30000);
            c.setUseCaches(false);
            if (c.getResponseCode() != 200) return null;
            InputStream is = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > max) return null;
            }
            is.close();
            return out.toByteArray();
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static JSONObject fail(String code) {
        JSONObject j = new JSONObject();
        try {
            j.put("ok", false);
            j.put("code", code);
            j.put("status", 0);
        } catch (Exception ignored) {
        }
        return j;
    }

    static JSONObject pin(String pin) {
        JSONObject j = new JSONObject();
        try {
            j.put("pin", pin);
        } catch (Exception ignored) {
        }
        return j;
    }

    private static String read(InputStream is) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) {
            out.write(buf, 0, n);
            if (out.size() > 4 * 1024 * 1024) break;
        }
        is.close();
        return out.toString("UTF-8");
    }
}
