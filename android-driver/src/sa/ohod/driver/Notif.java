package sa.ohod.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/** كل الإشعارات: شريط «التطبيق شغال» الثابت، وإشعار الطلب الجديد (بصوت واهتزاز)، وتنبيهات الأخطاء. */
final class Notif {
    private Notif() {}

    static final String CH_STATUS = "status";
    /** قناة جديدة (إعدادات القناة القديمة ما تتغير بعد ما تنسوى): الإشعار بدون صوت، والصوت إنذار قوي من Alarm (١٥ نوفمبر ٢٠٢٦) */
    static final String CH_ORDERS = "orders_loud";
    static final int ID_STATUS = 1, ID_ORDER = 2, ID_ALERT = 3;

    static void ensure(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel s = new NotificationChannel(CH_STATUS, "التطبيق شغال", NotificationManager.IMPORTANCE_LOW);
        s.setShowBadge(false);
        nm.createNotificationChannel(s);
        try { nm.deleteNotificationChannel("orders"); } catch (Exception ignored) { }   // القناة القديمة بصوت الإشعار العادي
        NotificationChannel o = new NotificationChannel(CH_ORDERS, "طلبات جديدة (إنذار)", NotificationManager.IMPORTANCE_HIGH);
        o.enableVibration(true);
        o.setVibrationPattern(new long[] {0, 800, 300, 800, 300, 800, 300, 1200});
        o.enableLights(true);
        o.setBypassDnd(true);
        o.setSound(null, null);   // الصوت يشغّله Alarm على مجرى المنبّه (عالي حتى والجوال صامت)
        nm.createNotificationChannel(o);
    }

    private static Notification.Builder builder(Context c, String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, channel) : new Notification.Builder(c);
    }

    private static PendingIntent open(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** الشريط الثابت: ما يختفي لين المندوب يوقف الاستقبال. */
    static Notification status(Context c, String text) {
        Notification.Builder b = builder(c, CH_STATUS)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("مندوب متاجر أحد")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(open(c));   // زر «إنهاء الدوام» انشال (المالك ١٥ نوفمبر ٢٠٢٦): الموقع ظاهر للإدارة على طول
        if (Build.VERSION.SDK_INT >= 26) b.setColor(0xFF13213C);
        return b.build();
    }

    static void newOrder(Context c, int count, String text) {
        newOrder(c, count, text, false);
    }

    static void newOrder(Context c, int count, String text, boolean ready) {
        Notification.Builder b = builder(c, CH_ORDERS)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(ready ? (count == 1 ? "طلب جاهز للتوصيل" : count + " طلبات جاهزة للتوصيل") : (count == 1 ? "طلب جديد" : count + " طلبات جديدة"))
                .setContentText(text)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(open(c));
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS);
        }
        notify(c, ID_ORDER, b.build());
        Alarm.play(c);
    }

    static void alert(Context c, String title, String text) {
        Notification.Builder b = builder(c, CH_ORDERS)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(open(c));
        notify(c, ID_ALERT, b.build());
    }

    static void notify(Context c, int id, Notification n) {
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id, n);
        } catch (Exception ignored) {
        }
    }
}
