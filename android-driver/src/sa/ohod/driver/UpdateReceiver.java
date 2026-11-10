package sa.ohod.driver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** نتيجة التثبيت من مثبّت أندرويد: يطلب تأكيد المندوب، وإذا فشل ينبّهه. */
public class UpdateReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -1);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = (Intent) i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    c.startActivity(confirm);
                } catch (Exception e) {
                    Notif.alert(c, "التحديث جاهز", "افتح التطبيق وجرّب «حدّث الآن» مرة ثانية.");
                }
            }
        } else if (st != PackageInstaller.STATUS_SUCCESS) {
            Notif.alert(c, "ما تم التحديث", "جرّب مرة ثانية. لو تكررت المشكلة كلّم الإدارة.");
        }
    }
}
