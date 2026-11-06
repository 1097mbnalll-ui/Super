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
        Fresh f = new Fresh();
        JSONObject o = Api.post(api, "/driver/orders", Api.pin(pin));
        if (!o.optBoolean("ok")) return f;
        JSONArray a = o.optJSONArray("orders");
        for (int i = 0; a != null && i < a.length(); i++) {
            JSONObject x = a.optJSONObject(i);
            if (x == null || !"new".equals(x.optString("status"))) continue;
            if (number(x.optString("no")) <= after) continue;
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

    static long number(String no) {
        String d = no == null ? "" : no.replaceAll("\\D", "");
        if (d.length() == 0 || d.length() > 12) return 0;
        return Long.parseLong(d);
    }

    static String money(double v) {
        return new DecimalFormat("0.##", new DecimalFormatSymbols(Locale.US)).format(v);
    }
}
