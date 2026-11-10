package sa.ohod.driver;

import android.content.Context;
import android.content.SharedPreferences;

/** اللي يتذكره التطبيق: عنوان الخادم والرقم السري (داخل التطبيق بس) وآخر طلب شافه. */
final class Prefs {
    private Prefs() {}

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("ohod", Context.MODE_PRIVATE);
    }

    static String api(Context c) { return p(c).getString("api", ""); }
    static String pin(Context c) { return p(c).getString("pin", ""); }
    static String role(Context c) { return p(c).getString("role", "driver"); }
    static boolean share(Context c) { return p(c).getBoolean("share", false); }
    static long lastOrder(Context c) { return p(c).getLong("last", -1); }
    /** وضع «للتوصيل بس»: وقت آخر طلب صار جاهز، عشان ننبّه على الجاهز الجديد بس */
    static long lastReady(Context c) { return p(c).getLong("readyAt", -1); }
    static void setLastReady(Context c, long v) { p(c).edit().putLong("readyAt", v).apply(); }
    static boolean flag(Context c, String k) { return p(c).getBoolean(k, false); }

    static void setLastOrder(Context c, long n) { p(c).edit().putLong("last", n).apply(); }
    static void setShare(Context c, boolean v) { p(c).edit().putBoolean("share", v).apply(); }
    static void setFlag(Context c, String k) { p(c).edit().putBoolean(k, true).apply(); }

    static void save(Context c, String api, String pin, String role) {
        p(c).edit().putString("api", api).putString("pin", pin).putString("role", role)
                .putLong("last", -1).putBoolean("share", false).apply();
    }

    static void clear(Context c) {
        p(c).edit().remove("api").remove("pin").remove("role").remove("last").remove("share").apply();
    }
}
