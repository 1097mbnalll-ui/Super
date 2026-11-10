package sa.ohod.driver;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.View;

import java.io.OutputStream;
import java.security.MessageDigest;

/**
 * التحديث من داخل التطبيق: نسأل الموقع عن آخر إصدار، وإذا فيه أحدث تطلع رسالة «حدّث الآن».
 * نضغط، ينزل الملف وينثبّت فوق القديم (أندرويد يطلب تأكيد المندوب مرة وحدة). ما يروح لأي رابط.
 */
final class Updater {
    private Updater() {}

    static final String ACTION = "sa.ohod.driver.INSTALL_RESULT";
    private static final long EVERY_MS = 20 * 60 * 1000L;
    private static volatile boolean busy;
    private static long last;
    private static AlertDialog shown;

    static int installed(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    /** يفحص (بالخلفية). {@code force}: يتجاوز فترة الانتظار بين الفحوص. */
    static void check(final Activity a, boolean force) {
        if (busy || shown != null) return;
        long now = System.currentTimeMillis();
        if (!force && now - last < EVERY_MS) return;
        last = now;
        busy = true;
        new Thread(new Runnable() {
            @Override public void run() {
                final Core.Upd u;
                try {
                    u = Core.checkUpdate(MainActivity.SITE, installed(a));
                } finally {
                    busy = false;
                }
                if (u.available && u.url.length() > 0) a.runOnUiThread(new Runnable() { @Override public void run() { offer(a, u); } });
            }
        }, "ohod-update-check").start();
    }

    private static void rtl(AlertDialog d) {
        d.show();
        d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
    }

    private static void offer(final Activity a, final Core.Upd u) {
        if (a.isFinishing() || shown != null) return;
        AlertDialog.Builder b = new AlertDialog.Builder(a)
                .setTitle("فيه تحديث جديد")
                .setMessage((u.note.length() > 0 ? u.note : "نزل إصدار أحدث من التطبيق فيه تحسينات.") + (u.name.length() > 0 ? "\n\nالإصدار " + u.name : ""))
                .setCancelable(!u.force)
                .setPositiveButton("حدّث الآن", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface di, int which) { shown = null; start(a, u); }
                });
        if (!u.force) {
            b.setNegativeButton("لاحقاً", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface di, int which) { shown = null; }
            });
            b.setOnCancelListener(new DialogInterface.OnCancelListener() {
                @Override public void onCancel(DialogInterface di) { shown = null; }
            });
        }
        shown = b.create();
        rtl(shown);
    }

    private static void start(final Activity a, final Core.Upd u) {
        // من أندرويد ٨: لازم المندوب يسمح للتطبيق «تثبيت التطبيقات»، مرة وحدة بس
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            AlertDialog d = new AlertDialog.Builder(a)
                    .setTitle("اسمح بالتحديث")
                    .setMessage("فعّل «السماح من هذا المصدر» للتطبيق، وارجع. بعدها يتحدث بضغطة وحدة.")
                    .setPositiveButton("فتح الإعدادات", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface di, int which) {
                            try {
                                a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
                            } catch (Exception ignored) {
                            }
                        }
                    })
                    .setNegativeButton("لاحقاً", null)
                    .create();
            rtl(d);
            return;
        }
        final AlertDialog p = new AlertDialog.Builder(a).setTitle("جاري التحديث").setMessage("ننزّل الإصدار الجديد…").setCancelable(false).create();
        rtl(p);
        new Thread(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    err = download(a, u);
                } catch (Throwable t) {
                    err = "تعذر التحديث";
                }
                final String e = err;
                a.runOnUiThread(new Runnable() {
                    @Override public void run() {
                        p.dismiss();
                        if (e != null) {
                            AlertDialog d = new AlertDialog.Builder(a).setTitle("ما تم التحديث").setMessage(e).setPositiveButton("حسناً", null).create();
                            rtl(d);
                        }
                    }
                });
            }
        }, "ohod-update").start();
    }

    /** ينزّل ويسلّم الملف لمثبّت أندرويد. يرجع نص الخطأ، أو null لو نجح (والتأكيد يطلع بعدها). */
    private static String download(Context c, Core.Upd u) throws Exception {
        byte[] apk = Api.download(u.url, 30 * 1024 * 1024);
        if (apk == null || apk.length < 10000) return "ما قدرنا ننزّل الملف. تأكد من الإنترنت وجرّب مرة ثانية.";
        if (u.sha.length() > 0) {
            StringBuilder sb = new StringBuilder();
            for (byte x : MessageDigest.getInstance("SHA-256").digest(apk)) sb.append(String.format("%02x", x));
            if (!sb.toString().equals(u.sha)) return "الملف المنزّل غير سليم. جرّب مرة ثانية بعد شوي.";
        }
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int id = pi.createSession(sp);
        PackageInstaller.Session s = pi.openSession(id);
        try {
            OutputStream os = s.openWrite("ohod-driver.apk", 0, apk.length);
            os.write(apk);
            s.fsync(os);
            os.close();
            Intent i = new Intent(c, UpdateReceiver.class).setAction(ACTION).setPackage(c.getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(c, id, i, flags).getIntentSender());
        } finally {
            s.close();
        }
        return null;
    }
}
