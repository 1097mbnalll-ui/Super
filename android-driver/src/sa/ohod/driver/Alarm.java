package sa.ohod.driver;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * صوت إنذار قوي للطلب الجديد (طلب المالك ١٥ نوفمبر ٢٠٢٦: «صوت إشعار قوي عشان ينتبه»).
 * يشتغل على مجرى المنبّه (يطلع حتى والجوال على الصامت أو الاهتزاز) بأعلى صوت للمنبّه، ٨ ثواني، ويرجع الصوت مثل ما كان.
 */
final class Alarm {
    private Alarm() {}
    private static final String TAG = "OhodAlarm";
    private static final long PLAY_MS = 8000;
    private static MediaPlayer mp;
    private static int oldVol = -1;

    static synchronized void play(Context c) {
        try {
            stop(c);
            Context app = c.getApplicationContext();
            AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                oldVol = am.getStreamVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            }
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            MediaPlayer p = new MediaPlayer();
            p.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            p.setDataSource(app, u);
            p.setLooping(true);
            p.prepare();
            p.start();
            mp = p;
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override public void run() { stop(app); }
            }, PLAY_MS);
        } catch (Exception e) {
            Log.w(TAG, "play", e);
            stop(c);
        }
    }

    /** يوقف الصوت (يتنادى بعد ٨ ثواني، أو لما المندوب يفتح التطبيق) */
    static synchronized void stop(Context c) {
        if (mp != null) {
            try { mp.stop(); } catch (Exception ignored) { }
            try { mp.release(); } catch (Exception ignored) { }
            mp = null;
        }
        if (oldVol >= 0) {
            try {
                AudioManager am = (AudioManager) c.getApplicationContext().getSystemService(Context.AUDIO_SERVICE);
                if (am != null) am.setStreamVolume(AudioManager.STREAM_ALARM, oldVol, 0);
            } catch (Exception ignored) { }
            oldVol = -1;
        }
    }
}
