package sa.ohod.driver;

import org.json.JSONObject;

/** يشغّل منطق التطبيق (Core/Api) على جافا عادية ضد خادم حقيقي. يطبع سطر JSON لكل خطوة. */
public class CoreTestMain {
    public static void main(String[] a) throws Exception {
        String step = a[0], base = a[1], pin = a[2];
        JSONObject out = new JSONObject();
        if (step.equals("pending")) {
            Core.Pend p = Core.pending(base, pin);
            out.put("ok", p.ok).put("status", p.status).put("code", p.code).put("last", p.last).put("fresh", p.fresh).put("onway", p.onway).put("retry", p.retry).put("ready", p.ready).put("readyAt", p.readyAt);
        } else if (step.equals("fresh")) {
            Core.Fresh f = Core.fresh(base, pin, Long.parseLong(a[3]), a.length > 4 && a[4].equals("ready"));
            out.put("count", f.count).put("text", f.text);
        } else if (step.equals("loc")) {
            out = Core.loc(base, pin, Double.parseDouble(a[3]), Double.parseDouble(a[4]), Float.parseFloat(a[5]), Boolean.parseBoolean(a[6]));
        } else if (step.equals("locoff")) {
            out = Core.locOff(base, pin);
        }
        System.out.println("RESULT " + out.toString());
    }
}
