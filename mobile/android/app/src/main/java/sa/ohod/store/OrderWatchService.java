package sa.ohod.store;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * تطبيق المالك فقط (طلب المالك ١٧ نوفمبر ٢٠٢٦): يتابع الطلبات بالخلفية كل ٣٠ ثانية، حتى لو التطبيق مقفول
 * أو انشال من قائمة التطبيقات المفتوحة، ويرجع يشتغل بعد إعادة تشغيل الجوال.
 * أي طلب جديد من الزبون = إشعار عادي بصوت واحد (مو إنذار مثل المندوب). الطلب اللي ينلغى = إشعار.
 * فيه إشعار صغير ثابت وصامت «متابعة الطلبات» لأن أندرويد يطلبه لأي خدمة تشتغل بالخلفية.
 */
public class OrderWatchService extends Service {
    static final String PREFS = "owner_watch";
    private static final String CH_WATCH = "watch", CH_ORDERS = "orders2";
    private static final String ORIGIN = "https://1097mbnalll-ui.github.io";
    private static final long EVERY_MS = 30_000;

    private HandlerThread thread;
    private Handler handler;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, MODE_PRIVATE); }

    /** يبدأ المتابعة (بعد دخول المالك بالرقم السري) */
    static void start(Context c, String pin, String api) {
        if (pin != null && api != null && !pin.isEmpty() && api.startsWith("https://")) {
            prefs(c).edit().putString("pin", pin).putString("api", api.replaceAll("/+$", "")).apply();
        }
        if (!prefs(c).contains("pin")) return;
        Intent i = new Intent(c, OrderWatchService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignored) { }
    }

    static void stop(Context c) {
        prefs(c).edit().clear().apply();
        c.stopService(new Intent(c, OrderWatchService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        channels();
        thread = new HandlerThread("order-watch");
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = base(CH_WATCH)
            .setContentTitle("متابعة الطلبات شغّالة")
            .setContentText("يوصلك إشعار مع كل طلب جديد")
            .setOngoing(true)
            .build();
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(1, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        handler.removeCallbacksAndMessages(null);
        handler.post(tick);
        return START_STICKY;
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            try { poll(); } catch (Exception ignored) { }
            handler.postDelayed(this, EVERY_MS);
        }
    };

    private void poll() throws Exception {
        SharedPreferences p = prefs(this);
        String pin = p.getString("pin", null), api = p.getString("api", null);
        if (pin == null || api == null) { stopSelf(); return; }
        JSONObject body = new JSONObject();
        body.put("pin", pin);
        body.put("limit", 25);
        body.put("src", "online");
        body.put("since", System.currentTimeMillis() - 36L * 3600_000L);
        JSONObject j = post(api + "/admin/orders", body);
        if (j == null) return;
        if (!j.optBoolean("ok")) {
            String code = j.optString("code");
            if ("bad_pin".equals(code) || "unauthorized".equals(code)) {
                alert(9, "سجّل دخول تطبيق الإدارة من جديد", "الرقم السري تغيّر، فوقفت إشعارات الطلبات", CH_ORDERS);
                stop(this);
            }
            return;
        }
        JSONArray orders = j.optJSONArray("orders");
        if (orders == null) return;
        JSONObject seen;
        try { seen = new JSONObject(p.getString("seen", "{}")); } catch (Exception e) { seen = new JSONObject(); }
        boolean first = !p.getBoolean("primed", false);
        JSONObject next = new JSONObject();
        for (int i = 0; i < orders.length(); i++) {
            JSONObject o = orders.optJSONObject(i);
            if (o == null) continue;
            String no = o.optString("no"), st = o.optString("status"), src = o.optString("src", "web");
            if (no.isEmpty()) continue;
            next.put(no, st);
            if (first) continue;
            String was = seen.optString(no, null);
            boolean manual = "phone".equals(src) || "whatsapp".equals(src) || "store".equals(src) || "pos".equals(src);
            if (was == null && !manual && ("new".equals(st) || "accepted".equals(st))) {
                String name = o.optString("name", "").trim();
                double total = o.optDouble("total", 0);
                int count = o.optInt("count", 0);
                String text = money(total) + " ر.س" + (count > 0 ? " · " + count + " منتج" : "") + (name.isEmpty() ? "" : " · " + name);
                alert(no.hashCode(), "🛎 طلب جديد " + no, text, CH_ORDERS);
            } else if (was != null && !"canceled".equals(was) && "canceled".equals(st)) {
                alert(no.hashCode() + 1, "انلغى الطلب " + no, "الطلب انلغى", CH_ORDERS);
            }
        }
        // نحتفظ بالطلبات القديمة اللي طلعت من القائمة عشان ما تتكرر إشعاراتها
        java.util.Iterator<String> it = seen.keys();
        int kept = 0;
        while (it.hasNext() && kept < 80) { String k = it.next(); if (!next.has(k)) { next.put(k, seen.optString(k)); kept++; } }
        p.edit().putString("seen", next.toString()).putBoolean("primed", true).apply();
    }

    private static String money(double v) {
        double r = Math.round(v * 100) / 100.0;
        return r == Math.floor(r) ? String.valueOf((long) r) : String.format(java.util.Locale.US, "%.2f", r);
    }

    private void alert(int id, String title, String text, String ch) {
        Notification n = base(ch)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .build();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(id, n);
    }

    private Notification.Builder base(String ch) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, ch) : new Notification.Builder(this);
        Intent open = new Intent(this, OwnerActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return b.setSmallIcon(R.drawable.ic_stat_order).setColor(0xFF0E8A6A).setContentIntent(pi).setShowWhen(true);
    }

    private void channels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel w = new NotificationChannel(CH_WATCH, "متابعة الطلبات (صامت)", NotificationManager.IMPORTANCE_MIN);
        w.setShowBadge(false);
        nm.createNotificationChannel(w);
        // إشعار عادي يطلع فوق الشاشة بصوت الإشعار الافتراضي مرة وحدة
        NotificationChannel o = new NotificationChannel(CH_ORDERS, "الطلبات الجديدة", NotificationManager.IMPORTANCE_HIGH);
        o.setDescription("إشعار مع كل طلب جديد أو طلب ينلغى");
        o.enableVibration(true);
        nm.createNotificationChannel(o);
    }

    private static JSONObject post(String url, JSONObject body) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setUseCaches(false);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Origin", ORIGIN);
            try (OutputStream os = c.getOutputStream()) { os.write(body.toString().getBytes("UTF-8")); }
            int code = c.getResponseCode();
            InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (is == null) return null;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
            return new JSONObject(bo.toString("UTF-8"));
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
