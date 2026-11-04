# تركيب خادم الإدارة (مرة وحدة بس)

بعد التركيب، أي شخص من الإدارة يدخل من المتجر: **حسابي ← الدخول للإدارة ← الرقم السري**، ويعدّل ويحفظ. ما يحتاج مفاتيح ولا حسابات.

يفضّل تسويها من **كمبيوتر**. تاخذ حوالي ١٠ دقايق.

---

## ١. مفتاح GitHub

1. افتح https://github.com/settings/personal-access-tokens/new
2. **Token name:** `خادم متاجر أحد`
3. **Expiration:** اختر أطول مدة.
4. **Repository access:** اختر **Only select repositories** ثم **Super**.
5. **Permissions ← Repository permissions ← Contents:** اختر **Read and write**.
6. اضغط **Generate token** وانسخ المفتاح (يبدأ بـ `github_pat_`). خله مفتوح، بتحتاجه في الخطوة ٤.

## ٢. حساب Cloudflare والخادم

1. سوّ حساب مجاني: https://dash.cloudflare.com/sign-up
2. من القائمة: **Compute (Workers) ← Workers & Pages ← Create**.
3. اختر **Start with Hello World!**، وسمّه `ohod-admin`، واضغط **Deploy**.
4. اضغط **Edit code**، امسح كل الكود اللي فيه، والصق محتوى الملف [`worker.js`](worker.js) كامل.
5. اضغط **Deploy**.

## ٣. مخزن الأقفال (KV)

1. من القائمة: **Storage & Databases ← KV ← Create**. سمّه `ohod-locks`.
2. ارجع للخادم `ohod-admin` ← **Settings ← Bindings ← Add ← KV namespace**.
3. **Variable name:** `LOCKS`، واختر `ohod-locks`، واضغط **Save**.

## ٤. الإعدادات

في الخادم `ohod-admin` ← **Settings ← Variables and Secrets ← Add**، وأضف هذي:

| الاسم | النوع | القيمة |
|---|---|---|
| `GITHUB_TOKEN` | Secret | المفتاح من الخطوة ١ |
| `ADMIN_PIN` | Secret | الرقم السري للإدارة (أرقام، ٦ أرقام أفضل) |
| `SECRET` | Secret | أي كلام عشوائي طويل، مثلاً ٣٠ حرف |
| `REPO` | Text | `1097mbnalll-ui/Super` |
| `BRANCH` | Text | `gh-pages` |
| `ALLOWED_ORIGIN` | Text | `https://1097mbnalll-ui.github.io` |

اضغط **Deploy** بعد ما تخلص.

## ٥. أرسل العنوان

انسخ عنوان الخادم من أعلى صفحته، شكله كذا: `https://ohod-admin.اسمك.workers.dev`

وأرسله لـ Claude عشان يربطه بالمتجر. (العنوان مو سر، عادي ترسله.)

---

## ٦. استقبال الطلبات على تيليجرام

1. **حدّث كود الخادم:** في Cloudflare افتح `ohod-admin` ← **Edit code**، امسح الكود والصق [`worker.js`](worker.js) الجديد، واضغط **Deploy**.
2. **سوّ بوت:** في تيليجرام كلّم **@BotFather**، اكتب `/newbot`، اختر له اسم ومعرّف ينتهي بـ `bot`، وانسخ المفتاح اللي يعطيك.
3. **حط المفتاح في الخادم:** `ohod-admin` ← **Settings ← Variables and Secrets ← Add**:
   - **Key:** `TELEGRAM_BOT_TOKEN` ، **Value:** مفتاح البوت، وعلّم **Secret**. **Production** فقط. ثم **Deploy**.
4. **افتح البوت** في تيليجرام، اضغط **Start** وأرسل له أي رسالة.
   - تبغى الطلبات توصل لقروب الموظفين؟ أضف البوت للقروب وأرسل فيه رسالة.
5. **في المتجر:** حسابي ← الدخول للإدارة ← **استقبال الطلبات** ← **اربط تيليجرام**.

بعدها أي طلب من الموقع يوصلكم في تيليجرام: المنتجات، الإجمالي، رقم الجوال، تفاصيل البيت، وزر يفتح الموقع في قوقل ماب.

---

## الحماية

- مفتاح GitHub يبقى في الخادم فقط، ما يوصل لأي جوال.
- بعد ٥ محاولات رقم سري غلط من نفس الجهاز، يتقفل الدخول ١٥ دقيقة.
- بعد ٤٠ محاولة غلط من كل الأجهزة، يتقفل الدخول ساعة.
- الخادم يقبل الطلبات من موقع المتجر بس.
- تغيّر الرقم السري من صفحة الإدارة: **بيانات المحل ← رقم سري جديد للإدارة**.
