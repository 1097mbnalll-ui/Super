"""تقديم نسخة متاجر أحد للمراجعة عن طريق App Store Connect API.
الوضع من mobile/ios-native/submit.mode (سطر واحد):
  status  ← يطبع الحالة بس (النسخ، البناءات، المراجعات) بدون أي تعديل
  submit  ← ينشئ/يجهز نسخة MARKETING_VERSION، يربط آخر بناء صالح لها، يحط «وش الجديد»، releaseType = AFTER_APPROVAL، ويقدّمها للمراجعة
خط أحمر: ما يسحب أي نسخة ولا يوقف النسخة الحالية، والنسخة الجديدة تنزل للكل بعد موافقة آبل."""
import os, re, sys, time, json
import jwt, requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODE = open(os.path.join(ROOT, "submit.mode")).read().strip() if os.path.exists(os.path.join(ROOT, "submit.mode")) else "status"
VER = re.search(r'MARKETING_VERSION:\s*"?([\d.]+)', open(os.path.join(ROOT, "project.yml")).read()).group(1)
NOTES = open(os.path.join(ROOT, "whatsnew.txt")).read().strip() if os.path.exists(os.path.join(ROOT, "whatsnew.txt")) else ""
NOTES_EN = open(os.path.join(ROOT, "whatsnew.en.txt")).read().strip() if os.path.exists(os.path.join(ROOT, "whatsnew.en.txt")) else ""

kid, iss = os.environ["KID"].strip(), os.environ["ISS"].strip()
body = re.sub(r"[^A-Za-z0-9+/=]", "", "".join(l for l in os.environ["P8"].replace("\r", "").split("\n") if "-----" not in l))
KEY = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(body[i:i + 64] for i in range(0, len(body), 64)) + "\n-----END PRIVATE KEY-----\n"
API = "https://api.appstoreconnect.apple.com"


def H():
    t = jwt.encode({"iss": iss, "iat": int(time.time()), "exp": int(time.time()) + 900, "aud": "appstoreconnect-v1"}, KEY, algorithm="ES256", headers={"kid": kid, "typ": "JWT"})
    return {"Authorization": "Bearer " + t, "Content-Type": "application/json"}


def call(method, path, data=None, ok=(200, 201, 204)):
    r = requests.request(method, API + path, headers=H(), data=json.dumps(data) if data is not None else None, timeout=60)
    if r.status_code not in ok:
        print("❌", method, path, r.status_code, r.text[:900]); sys.exit(1)
    return r.json() if r.text else {}


print("الوضع:", MODE, "| النسخة:", VER)
app = call("GET", "/v1/apps?filter[bundleId]=sa.ohod.store")["data"][0]
AID = app["id"]
print("رابط التطبيق: https://apps.apple.com/sa/app/id" + AID)
vers = call("GET", f"/v1/apps/{AID}/appStoreVersions?filter[platform]=IOS&limit=10")["data"]
for v in vers:
    a = v["attributes"]; print("  نسخة", a["versionString"], "→", a.get("appStoreState") or a.get("appVersionState"), "| release:", a.get("releaseType"))
builds = call("GET", f"/v1/builds?filter[app]={AID}&sort=-uploadedDate&limit=8&include=preReleaseVersion")
pre = {x["id"]: x["attributes"]["version"] for x in builds.get("included", []) if x["type"] == "preReleaseVersions"}
for b in builds["data"]:
    a = b["attributes"]; pv = pre.get((b["relationships"]["preReleaseVersion"]["data"] or {}).get("id"), "?")
    print("  بناء", pv, "(", a["version"], ")", a["processingState"], "| رفع:", a["uploadedDate"][:16], "| تشفير:", a.get("usesNonExemptEncryption"))
subs = call("GET", f"/v1/reviewSubmissions?filter[app]={AID}&limit=5")["data"]
for s in subs:
    print("  مراجعة", s["id"][:8], s["attributes"].get("state"), s["attributes"].get("submittedDate"))

if MODE != "submit":
    print("قراءة بس، ما تغيّر شي"); sys.exit(0)

# ١) آخر بناء صالح لهالنسخة
cand = [b for b in builds["data"] if pre.get((b["relationships"]["preReleaseVersion"]["data"] or {}).get("id")) == VER and b["attributes"]["processingState"] == "VALID" and not b["attributes"].get("expired")]
if not cand:
    print("❌ ما فيه بناء صالح للنسخة", VER, "(ارفع البناء أول وانتظر آبل تعالجه)"); sys.exit(1)
build = cand[0]
print("البناء المختار:", build["attributes"]["version"])
if build["attributes"].get("usesNonExemptEncryption") is None:
    call("PATCH", f"/v1/builds/{build['id']}", {"data": {"type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False}}})
    print("  التشفير: بدون تشفير خاص ✓")

# ٢) النسخة: موجودة وقابلة للتعديل أو نسويها
editable = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"}
ver = next((v for v in vers if v["attributes"]["versionString"] == VER), None)
if ver and (ver["attributes"].get("appStoreState") not in editable):
    print("❌ النسخة", VER, "حالتها", ver["attributes"].get("appStoreState"), "وما تنعدّل. ارفع رقم النسخة في project.yml"); sys.exit(1)
if not ver:
    ver = call("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "IOS", "versionString": VER, "releaseType": "AFTER_APPROVAL"},
                                                     "relationships": {"app": {"data": {"type": "apps", "id": AID}}}}})["data"]
    print("  أنشأت النسخة", VER)
VID = ver["id"]
call("PATCH", f"/v1/appStoreVersions/{VID}", {"data": {"type": "appStoreVersions", "id": VID, "attributes": {"releaseType": "AFTER_APPROVAL"}}})
call("PATCH", f"/v1/appStoreVersions/{VID}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
print("  ربطت البناء، والنزول بعد الموافقة مباشرة (AFTER_APPROVAL) ✓")

# ٣) «وش الجديد»
locs = call("GET", f"/v1/appStoreVersions/{VID}/appStoreVersionLocalizations")["data"]
for l in locs:
    loc = l["attributes"]["locale"]; txt = NOTES if loc.startswith("ar") else (NOTES_EN or NOTES)
    if txt:
        call("PATCH", f"/v1/appStoreVersionLocalizations/{l['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": l["id"], "attributes": {"whatsNew": txt}}})
        print("  وش الجديد:", loc, "✓")

# ٤) التقديم للمراجعة (نستخدم مراجعة مفتوحة لو موجودة)
open_sub = next((s for s in subs if s["attributes"].get("state") in ("READY_FOR_REVIEW",)), None)
if not open_sub:
    open_sub = call("POST", "/v1/reviewSubmissions", {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"},
                                                                 "relationships": {"app": {"data": {"type": "apps", "id": AID}}}}})["data"]
SID = open_sub["id"]
items = call("GET", f"/v1/reviewSubmissions/{SID}/items")["data"]
if not items:
    call("POST", "/v1/reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems", "relationships": {
        "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": SID}}, "appStoreVersion": {"data": {"type": "appStoreVersions", "id": VID}}}}})
call("PATCH", f"/v1/reviewSubmissions/{SID}", {"data": {"type": "reviewSubmissions", "id": SID, "attributes": {"submitted": True}}})
print("✅ انقدّمت النسخة", VER, "للمراجعة. تنزل للكل أول ما آبل توافق، والنسخة الحالية تبقى شغّالة لين ذاك.")
