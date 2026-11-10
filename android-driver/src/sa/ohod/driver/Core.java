package sa.ohod.driver;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONObject;

/** منطق التطبيق مع الخادم، بدون أي شي من أندرويد، عشان نقدر نختبره على الجهاز العادي. */
final class Core {
    private Core() {}

    static final class Pend {
        boolean ok;
        int status;
        String code = "";
        long last;     // آخر رقم طلب (مثل 1006)
        int fresh;     // كم طلب جديد ينتظر
        int onway;     // كم طلب في الطريق
        long retry;    // ثواني الانتظار لو الدخول موقوف
        boolean ready; // وضع «للتوصيل بس»: الطلب يوصل بعد ما يجهزه المجهز
        long readyAt;  // وقت آخر طلب صار جاهز
    }

    static final class Fresh {
        int count;
        String text = "";
    }

    /** يسأل الخادم: فيه طلب جديد؟ كم طلب في الطريق؟ لو الخادم قديم ما عنده المسار الخفيف نقرأ قائمة الطلبات. */
    static Pend pending(String api, String pin) {
        Pend r = new Pend();
        JSONObject j = Api.post(api, "/driver/pending", Api.pin(pin));
        r.status = j.optInt("status");
        r.code = j.optString("code", "");
        r.retry = j.optLong("retryAfter");
        if (j.optBoolean("ok")) {
            r.ok = true;
            r.last = j.optLong("last");
            r.fresh = j.optInt("new");
            r.onway = j.optInt("onway");
            r.ready = "ready".equals(j.optString("mode"));
            r.readyAt = j.optLong("readyAt");
            return r;
        }
        if (r.status == 404 && "not_found".equals(r.code)) {
            JSONObject o = Api.post(api, "/driver/orders", Api.pin(pin));
            r.status = o.optInt("status");
            r.code = o.optString("code", "");
            if (!o.optBoolean("ok")) return r;
            r.ok = true;
            JSONArray a = o.optJSONArray("orders");
            for (int i = 0; a != null && i < a.length(); i++) {
                JSONObject x = a.optJSONObject(i);
                if (x == null) continue;
                long n = number(x.optString("no"));
                if (n > r.last) r.last = n;
                String st = x.optString("status");
                if ("new".equals(st)) r.fresh++;
                else if ("onway".equals(st)) r.onway++;
            }
        }
        return r;
    }

    /** الطلبات الجديدة اللي رقمها أكبر من {@code after}، عشان نكتب نص الإشعار. */
    static Fresh fresh(String api, String pin, long after) {
        return fresh(api, pin, after, false);
    }

    /** {@code ready}: الطلبات الجاهزة للتوصيل (ما مسكها زميل) بدل الجديدة، و{@code after} يصير رقم أكبر طلب جاهز شفناه. */
    static Fresh fresh(String api, String pin, long after, boolean ready) {
        Fresh f = new Fresh();
        JSONObject o = Api.post(api, "/driver/orders", Api.pin(pin));
        if (!o.optBoolean("ok")) return f;
        JSONArray a = o.optJSONArray("orders");
        JSONObject me = o.optJSONObject("me");
        String myId = me == null ? "" : me.optString("id", "");
        for (int i = 0; a != null && i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null) continue;
            String st = x.optString("status"), drv = x.optString("drv", "");
            if (ready) {
                if (!("new".equals(st) || "accepted".equals(st)) || !"ready".equals(x.optString("prepStage"))) continue;
                if (drv.length() > 0 && !drv.equals(myId)) continue;
            } else {
                if (!"new".equals(st)) continue;
                if (number(x.optString("no")) <= after) continue;
            }
            f.count++;
            if (f.text.length() == 0) {
                String name = x.optString("name", "").trim();
                f.text = x.optString("no") + (name.length() > 0 ? " · " + name : "") + " · " + money(x.optDouble("total", 0)) + " ر.س";
            }
        }
        return f;
    }

    static JSONObject loc(String api, String pin, double lat, double lng, float acc, boolean share) {
        try {
            JSONObject b = Api.pin(pin);
            b.put("lat", lat);
            b.put("lng", lng);
            b.put("acc", Math.round(acc));
            b.put("share", share);
            return Api.post(api, "/driver/loc", b);
        } catch (Exception e) {
            return Api.fail("bad_body");
        }
    }

    static JSONObject locOff(String api, String pin) {
        return Api.post(api, "/driver/loc-off", Api.pin(pin));
    }

    static final class Upd {
        boolean available;   // فيه إصدار أحدث من اللي مثبّت
        boolean force;       // الإصدار المثبّت أقدم من الحد الأدنى: لازم يحدّث
        int code;
        String name = "";
        String url = "";
        String sha = "";
        String note = "";
    }

    /** يقرأ ملف الإصدار (driver-app.json). الرابط لازم يكون من موقعنا نفسه (https)، وإلا نتجاهل التحديث. */
    static Upd parseUpdate(String json, int installed, String site) {
        Upd u = new Upd();
        try {
            JSONObject j = new JSONObject(json);
            u.code = j.optInt("code");
            u.name = j.optString("name", "");
            u.sha = j.optString("sha256", "").toLowerCase(Locale.US);
            u.note = j.optString("note", "");
            String url = j.optString("url", "driver-app.apk");
            if (!url.startsWith("https://")) url = site + url;
            if (!url.startsWith(site)) return u;
            u.url = url;
            u.available = u.code > installed;
            u.force = j.optInt("min") > installed;
        } catch (Exception ignored) {
        }
        return u;
    }

    static Upd checkUpdate(String site, int installed) {
        String s = Api.get(site + "driver-app.json?t=" + (System.currentTimeMillis() / 60000));
        return s == null ? new Upd() : parseUpdate(s, installed, site);
    }

    static long number(String no) {
        String d = no == null ? "" : no.replaceAll("\\D", "");
        if (d.length() == 0 || d.length() > 12) return 0;
        return Long.parseLong(d);
    }

    static String money(double v) {
        return new DecimalFormat("0.##", new DecimalFormatSymbols(Locale.US)).format(v);
    }
}
