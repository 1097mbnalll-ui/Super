package sa.ohod.driver;

import android.Manifest;
import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONObject;

/**
 * خدمة تشتغل بالخلفية حتى والشاشة مقفلة:
 *  ١. كل ١٠ ثواني تسأل الخادم: فيه طلب جديد؟ لو فيه، إشعار بصوت واهتزاز.
 *  ٢. لو فيه طلب «في الطريق»، تشغّل الـ GPS وترسل موقع المندوب للخادم (الزبون يشوفه على الخريطة).
 *  ٣. أول ما ما يبقى طلب في الطريق، توقف الـ GPS وتمسح الموقع من الخادم.
 */
public class TrackService extends Service implements LocationListener {
    private static final String TAG = "OhodTrack";
    static final String ACTION_STOP = "sa.ohod.driver.STOP";
    static final long POLL_MS = 10000;

    static volatile boolean running;
    static volatile String track = "off";   // off | wait | on | denied | gpsoff
    static volatile int onway;
    static volatile int pendingNew;

    private HandlerThread ht;
    private Handler h;
    private ExecutorService net;
    private PowerManager.WakeLock wl;
    private LocationManager lm;
    private volatile boolean locOn;
    private volatile boolean everSent;
    private volatile long sentAt;
    private volatile Location sentLoc;
    private final AtomicBoolean sending = new AtomicBoolean(false);
    private String shownText = "";

    static void start(Context c) {
        Intent i = new Intent(c, TrackService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception e) {
            Log.w(TAG, "start failed", e);
        }
    }

    static void stop(Context c) {
        c.stopService(new Intent(c, TrackService.class));
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        Notif.ensure(this);
        ht = new HandlerThread("ohod-poll");
        ht.start();
        h = new Handler(ht.getLooper());
        net = Executors.newSingleThreadExecutor();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        goForeground(Notif.status(this, shownText.length() > 0 ? shownText : "جاري الاتصال…"));
        if (Prefs.pin(this).length() == 0) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!running) {
            running = true;
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ohod:poll");
                wl.setReferenceCounted(false);
                wl.acquire();
            } catch (Exception e) {
                Log.w(TAG, "wakelock", e);
            }
            h.post(tick);
        }
        return START_STICKY;
    }

    @Override public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        stopLoc(true);
        track = "off";
        onway = 0;
        pendingNew = 0;
        net.shutdown();   // يخلّي طلب «مسح الموقع» الأخير يكمل
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        ht.quitSafely();
        super.onDestroy();
    }

    private void goForeground(Notification n) {
        boolean loc = Build.VERSION.SDK_INT < 23
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                int t = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE | (loc ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
                startForeground(Notif.ID_STATUS, n, t);
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(Notif.ID_STATUS, n, loc ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
            } else {
                startForeground(Notif.ID_STATUS, n);
            }
        } catch (Exception e) {
            Log.w(TAG, "startForeground typed failed, retry plain", e);
            try { startForeground(Notif.ID_STATUS, n); } catch (Exception e2) { stopSelf(); }
        }
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!running) return;
            long delay = POLL_MS;
            try {
                delay = doTick();
            } catch (Throwable t) {
                Log.w(TAG, "tick", t);
            }
            if (running) h.postDelayed(this, delay);
        }
    };

    private long doTick() {
        String api = Prefs.api(this), pin = Prefs.pin(this);
        if (api.length() == 0 || pin.length() == 0) {
            stopSelf();
            return POLL_MS;
        }
        Core.Pend p = Core.pending(api, pin);
        if (p.status == 401) {   // الرقم السري تغيّر
            Prefs.clear(this);
            Notif.alert(this, "سجّل دخول من جديد", "الرقم السري تغيّر. افتح التطبيق وادخل بالرقم الجديد.");
            stopSelf();
            return POLL_MS;
        }
        if (p.status == 429) {
            setText("الدخول موقوف مؤقتاً، نعيد المحاولة…");
            return Math.max(30000, p.retry * 1000);
        }
        if (!p.ok) {
            setText("ما فيه اتصال بالإنترنت، نعيد المحاولة…");
            return POLL_MS;
        }
        onway = p.onway;
        pendingNew = p.fresh;

        long base = Prefs.lastOrder(this);
        if (base < 0 || p.last < base) {
            Prefs.setLastOrder(this, p.last);   // أول مرة: نبدأ من الطلبات الموجودة، بدون إشعار عليها
        } else if (p.last > base) {
            Core.Fresh f = Core.fresh(api, pin, base);
            Prefs.setLastOrder(this, p.last);
            if (f.count > 0 && !MainActivity.visible) Notif.newOrder(this, f.count, f.text);   // والتطبيق مفتوح الصفحة نفسها تنبّه
        }

        boolean want = p.onway > 0 && (!"admin".equals(Prefs.role(this)) || Prefs.share(this));
        if (want) startLoc(); else stopLoc(true);

        if ("denied".equals(track)) setText("اسمح للتطبيق بالموقع عشان الزبون يشوفك");
        else if ("gpsoff".equals(track)) setText("شغّل الموقع (GPS) في الجوال");
        else if (p.onway > 0) setText("في الطريق: " + p.onway + (want ? ("on".equals(track) ? " · الزبون يشوف موقعك" : " · نحدد موقعك…") : ""));
        else if (p.fresh > 0) setText(p.fresh + (p.fresh == 1 ? " طلب جديد ينتظرك" : " طلبات جديدة تنتظرك"));
        else setText("جاهز لاستقبال الطلبات");
        return POLL_MS;
    }

    private void setText(String t) {
        if (t.equals(shownText)) return;
        shownText = t;
        Notif.notify(this, Notif.ID_STATUS, Notif.status(this, t));
    }

    // ---------- الموقع ----------
    private void startLoc() {
        if (locOn) return;
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            track = "denied";
            return;
        }
        if (lm == null) lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        boolean any = false;
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 0, this, ht.getLooper());
                any = true;
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 0, this, ht.getLooper());
                any = true;
            }
        } catch (SecurityException e) {
            track = "denied";
            return;
        } catch (Exception e) {
            Log.w(TAG, "requestLocationUpdates", e);
        }
        if (!any) {
            track = "gpsoff";
            return;
        }
        locOn = true;
        track = "wait";
        sentAt = 0;
        sentLoc = null;
        try {   // آخر موقع معروف، عشان الزبون يشوف المندوب فوراً
            Location k = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (k != null && System.currentTimeMillis() - k.getTime() < 30000) onLocationChanged(k);
        } catch (Exception ignored) {
        }
    }

    private void stopLoc(boolean sendOff) {
        if (locOn) {
            try { lm.removeUpdates(this); } catch (Exception ignored) { }
            locOn = false;
        }
        track = "off";
        if (everSent && sendOff) {
            everSent = false;
            final String api = Prefs.api(this), pin = Prefs.pin(this);
            if (api.length() > 0 && pin.length() > 0) {
                try {
                    net.execute(new Runnable() {
                        @Override public void run() { Core.locOff(api, pin); }
                    });
                } catch (Exception ignored) {   // الخدمة تتوقف: الخادم ينسى الموقع القديم بعد ١٠ دقايق لحاله
                }
            }
        }
    }

    @Override public void onLocationChanged(Location l) {
        if (l == null || !locOn) return;
        if (l.hasAccuracy() && l.getAccuracy() > 300f && sentLoc != null) return;
        long now = System.currentTimeMillis();
        long gap = now - sentAt;
        float moved = sentLoc == null ? 1e9f : l.distanceTo(sentLoc);
        if (!(sentLoc == null || gap >= 15000 || (gap >= 4000 && moved >= 8f))) return;   // يرسل كل ٤ ثواني وهو يتحرك، وكل ١٥ ثانية لو واقف
        if (!sending.compareAndSet(false, true)) return;
        final String api = Prefs.api(this), pin = Prefs.pin(this);
        final boolean share = Prefs.share(this);
        final Location lc = l;
        try {
            net.execute(new Runnable() {
                @Override public void run() {
                    try {
                        JSONObject j = Core.loc(api, pin, lc.getLatitude(), lc.getLongitude(), lc.hasAccuracy() ? lc.getAccuracy() : 0f, share);
                        if (j.optBoolean("ok") && !j.has("skipped")) {
                            sentAt = System.currentTimeMillis();
                            sentLoc = lc;
                            everSent = true;
                            if (locOn) track = "on";
                        }
                    } finally {
                        sending.set(false);
                    }
                }
            });
        } catch (Exception e) {
            sending.set(false);
        }
    }

    // لازم نعرّفها: أندرويد القديم (قبل ١١) يناديها وما عندها تنفيذ افتراضي
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }
}
