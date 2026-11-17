package sa.ohod.store;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** تطبيق المالك: بعد إعادة تشغيل الجوال (أو تحديث التطبيق) ترجع متابعة الطلبات لحالها */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a) || "android.intent.action.QUICKBOOT_POWERON".equals(a)) {
            OrderWatchService.start(c, null, null);
        }
    }
}
