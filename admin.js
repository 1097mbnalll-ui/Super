/* لوحة الإدارة (تنحمّل بس لما أحد يدخل الإدارة، طلب المالك ١٣ نوفمبر ٢٠٢٦ «الموقع ثقيل»).
   تشتغل داخل نطاق صفحة index.html (eval مباشر من loadAdm)، فتقرأ وتعدّل متغيراتها. لا تفتح هالملف لحاله. */
  /* ---------- admin console ---------- */
  function costOf(id){ if (!Object.prototype.hasOwnProperty.call(costEdit, id)) needStk(id); return Object.prototype.hasOwnProperty.call(costEdit, id) ? costEdit[id] : (COST[id] == null ? null : COST[id]); }
  // الإدارة تقرأ مخزون وسعر شراء المنتجات اللي تنعرض بس (دفعات)، بدل ١١ ألف صف كل مرة
  function needStk(id){ if (!STK_OK || STK_KNOWN[id] || !apiUrl()) return; STK_WANT[id] = 1; if (!STK_T) STK_T = setTimeout(fetchStk, 60); }
  function fetchStk(){ STK_T = null; var ids = Object.keys(STK_WANT).slice(0, 500); ids.forEach(function(i){ delete STK_WANT[i]; STK_KNOWN[i] = 1; }); if (!ids.length) return;
    api("/admin/stock", { pin: adminPin, ids: ids }).then(function(j){ if (!j.ok) return; Object.assign(STK, j.stock || {}); Object.assign(COST, j.costs || {});
      if (mode === "admin") { if (aTab === "prods") renderAProds(); else if (aTab === "over") renderOver(); }
      if (Object.keys(STK_WANT).length) STK_T = setTimeout(fetchStk, 60); }); }
  function qtyOf(id){ if (!Object.prototype.hasOwnProperty.call(stockEdit, id)) needStk(id); return Object.prototype.hasOwnProperty.call(stockEdit, id) ? stockEdit[id] : (STK[id] == null ? null : STK[id]); }
  function loadAdminStock(){
    if (!apiUrl() || ordersOnly()) return;
    api("/admin/stock", { pin: adminPin, summary: true }).then(function(j){ if (!j.ok) return;
      if (j.low) { STK = Object.assign({}, j.low); COST = {}; STK_LOW = j.low; COST_N = j.costCount || 0; STK_KNOWN = {}; Object.keys(j.low).forEach(function(i){ STK_KNOWN["~" + i] = 1; }); }
      else { STK = j.stock || {}; COST = j.costs || {}; draft.products.forEach(function(p){ STK_KNOWN[p.id] = 1; }); } // خادم قديم: كل شي
      STK_OK = !!j.hasDB; if (mode === "admin") { renderAProds(); renderOver(); } });
  }
  function uid(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
  function markDirty(){ dirty = true; if($("aSave"))$("aSave").disabled=!!adminProtectionCheck; var s = $("aState"); if (s) { s.textContent = "فيه تعديلات ما انحفظت"; s.className = "adm-state dirty"; } }
  function adminShell(){
    if (typeof markStaffDev === "function") markStaffDev();
    if(staffAuth && staffAuth.user.role === "cashier"){cashierShell();return;}
    if (staffAuth && staffAuth.user.role === "preparer") { preparerShell(); return; }
    if (ordersOnly()) { ordersShell(); return; }
    draft = JSON.parse(JSON.stringify(D)); dirty = false;
    var TABS = [["over","نظرة عامة","home"],["olist","الطلبات","cart"],["cust","استرجاع الزبائن","user"],["rates","التقييمات والاقتراحات","spark"],["sign","ورقة عرض للمحل","tag"],["visits","الزوار والتحويل","user"],["stats","التحليل","chart"],["prods","المنتجات","box"],["cats","الأقسام","grid"],["offers","العروض","tag"],["codes","أكواد الخصم","tag"],["costs","التكاليف ومستشار العروض","chart"],["layout","ترتيب الواجهة","layers"],["bans","البنرات و«لك»","spark"],["look","المظهر واللغة","palette"],["store","بيانات المحل","store"],["orders","المندوب والإشعارات","truck"],["log","سجل العمليات","layers"]];
    app.innerHTML = '<div class="adm">' +
      '<aside class="adm-side"><div class="adm-brand"><img class="logo" src="' + D.imgs.logo + '" alt=""><div><b>' + esc(D.store.name) + '</b><span>لوحة الإدارة</span></div></div>' +
      '<nav class="adm-nav" aria-label="أقسام الإدارة">' + TABS.map(function(x){ return '<button type="button" data-atab="' + x[0] + '"' + (x[0] === aTab ? ' aria-current="page"' : '') + '>' + ic(x[2]) + '<span>' + x[1] + '</span>' + (x[0] === "prods" ? '<em class="n">' + draft.products.length + '</em>' : x[0] === "cats" ? '<em class="n">' + draft.cats.length + '</em>' : '') + '</button>'; }).join("") + '</nav>' +
      '<button class="adm-exit" type="button" id="toStore">' + ic("back") + '<span>عرض المتجر</span></button></aside>' +
      '<div class="adm-main"><div class="adm-top"><div class="adm-title"><h1 id="aTitle"></h1><span class="adm-state" id="aState">كل شي محفوظ</span></div><span class="status" id="aStatus" aria-live="polite"></span>' +
      '<button class="btn btn-brand" type="button" id="aSave">حفظ تغييرات المتجر</button></div><div class="adm-body">' +
      '<section class="adm-panel" data-panel="over" id="aOver"></section>' +
      '<section class="adm-panel" data-panel="stats" id="aStats"></section>' +
      '<section class="adm-panel" data-panel="visits" id="aVisits"></section>' +
      '<section class="adm-panel" data-panel="olist" id="aOList"></section>' +
      '<section class="adm-panel" data-panel="log" id="aLog"></section>' +
      '<section class="adm-panel" data-panel="cust" id="aCust"></section>' +
      '<section class="adm-panel" data-panel="rates" id="aRates"></section>' +
      '<section class="adm-panel" data-panel="sign" id="aSign"></section>' +
      '<section class="adm-panel" data-panel="bans" id="aBans"></section>' +
      '<section class="adm-panel" data-panel="prods"><div class="card" id="aImport"></div><div class="card" id="openItems" hidden></div><div class="card"><div class="adm-tools"><input class="search" id="aQ" type="search" placeholder="ابحث بالاسم أو الباركود…" aria-label="بحث في المنتجات"><select id="aCat" aria-label="فلتر القسم"></select><button class="btn btn-soft" type="button" id="offProds">🔥 منتجات العروض</button><button class="btn btn-brand" type="button" id="addProd">+ منتج جديد</button></div>' +
        '<p class="hint">«قبل الخصم» اختياري: لو كتبته أكبر من السعر، يطلع المنتج في العروض مع نسبة الخصم. اضغط على الصورة لتغييرها أو رفع صورة من جهازك. الأسهم ترتّب المنتج داخل قسمه.</p></div><div class="alist prods" id="aProds"></div></section>' +
      '<section class="adm-panel" data-panel="cats"><div class="card"><div class="sec-head" style="margin:0"><h2>الأقسام</h2><button class="btn btn-brand" type="button" id="addCat">+ قسم جديد</button></div><p class="hint">الأسهم ترتّب الأقسام في المتجر كله: الدوائر والشبكة وصفحة الأقسام.</p><div class="alist" id="aCats"></div></div></section>' +
      '<section class="adm-panel" data-panel="offers"><div class="card" id="aOffProds"></div><div class="card" id="aPromos"></div></section>' +
      '<section class="adm-panel" data-panel="costs" id="aCosts"></section>' +
      '<section class="adm-panel" data-panel="codes" id="aCodes"></section>' +
      '<section class="adm-panel" data-panel="layout"><div class="card" id="aLayout"></div></section>' +
      '<section class="adm-panel" data-panel="look"><div class="card" id="aLook"></div></section>' +
      '<section class="adm-panel" data-panel="store"><div class="card"><h2>بيانات المحل</h2><div class="fields">' +
          field("sName","اسم المحل",draft.store.name) + field("sNameEn","اسم المحل بالإنجليزي",draft.store.name_en || "") +
          field("sTag","الوصف تحت الاسم",draft.store.tagline) + field("sTagEn","الوصف بالإنجليزي",draft.store.tagline_en || "") +
          field("sArea","منطقة التوصيل",draft.store.area) + field("sAreaEn","منطقة التوصيل بالإنجليزي",draft.store.area_en || "") +
          '<label for="sShop">موقع المحل (إحداثيات)<input id="sShop" dir="ltr" value="' + esc(draft.store.shop ? draft.store.shop.join(", ") : "") + '" placeholder="24.8414, 46.8299"></label>' +
          field("sMaxKm","أقصى مسافة للتوصيل (كم، ٠ = بدون حد)",draft.store.maxKm || 0,"number") +
          '<p class="hint wide">وأنت داخل المحل اضغط <button type="button" class="linkbtn" id="sShopHere">استخدم موقعي الحالي</button>. الطلب من أبعد من المسافة ما ينقبل، ويطلع للزبون إنه برّا منطقة التوصيل ويتصل عليكم. <span id="sShopMsg"></span></p>' +
          '<div class="wide zone-ed"><b>منطقة التوصيل على الخريطة</b><p class="hint">اضغط على الخريطة تحط نقاط حول المنطقة اللي توصلون لها (٣ نقاط أو أكثر). اسحب النقطة تعدّلها، واضغط عليها مرتين تشيلها. لو رسمت منطقة، الطلب من برّاها ما ينقبل، والمسافة بالكيلو ما تنحسب.</p><div id="zoneMap" class="zone-map"></div><div class="actions"><button type="button" class="btn btn-soft sm" id="zoneUndo">شيل آخر نقطة</button><button type="button" class="btn btn-ghost sm" id="zoneClear">امسح المنطقة</button><span class="hint" id="zoneInfo"></span></div></div>' +
          '<label class="wide">إلغاء الطلب من الزبون<select id="sCustCancel"><option value="new"' + ((draft.store.custCancel || "new") === "new" ? ' selected' : '') + '>يقدر يلغي قبل ما يبدأ المندوب التجهيز</option><option value="accepted"' + (draft.store.custCancel === "accepted" ? ' selected' : '') + '>يقدر يلغي لين يطلع المندوب</option><option value="off"' + (draft.store.custCancel === "off" ? ' selected' : '') + '>ما يقدر يلغي من الموقع (يتصل بالمحل)</option></select></label>' +
          field("sHours","أوقات العمل",draft.store.hours) + field("sHoursEn","أوقات العمل بالإنجليزي",draft.store.hours_en || "") +
          field("sEta","مدة التوصيل",draft.store.eta) + field("sEtaEn","مدة التوصيل بالإنجليزي",draft.store.eta_en || "") +
          field("sPhone","رقم الاتصال",draft.store.phone,"tel") + field("sWa","رقم الواتساب (بالصيغة الدولية 9665…)",draft.store.wa,"tel") +
          field("sVat","الرقم الضريبي (اختياري، يطلع في إيصال المحل)",draft.store.vat || "") +
          field("sFee","رسوم التوصيل (ريال)",draft.store.fee,"number") + field("sFree","توصيل مجاني فوق (ريال، ٠ = بدون)",draft.store.freeOver,"number") + field("sFeeWas","سعر التوصيل اللي يطلع مشطوب لما يكون مجاني (ريال، ٠ = لا تعرضه)",draft.store.feeWas||0,"number") +
        '</div></div><div class="card"><h2>استقبال الطلبات</h2><div class="fields">' +
          '<label class="chk wide"><input type="checkbox" id="sClosed"' + (draft.store.closed ? ' checked' : '') + '>إيقاف طلبات التوصيل مؤقتًا (يبقى تصفح المتجر متاحًا)</label>' +
          '<label for="sOpenAt">نبدأ نستقبل الطلبات الساعة<input id="sOpenAt" type="time" value="' + esc(draft.store.openAt || "") + '"></label>' +
          '<label for="sCloseAt">نوقف استقبال الطلبات الساعة<input id="sCloseAt" type="time" value="' + esc(draft.store.closeAt || "") + '"></label>' +
          '<p class="hint wide">الموقع والتطبيق والخادم يقفلون ويفتحون لحالهم على هالمواعيد كل يوم (توقيت الرياض). فاضي = مفتوح دايم. لو وقت القفل قبل وقت الفتح (مثل ١٢ الظهر لين ١ بالليل) يعني يقفل بعد منتصف الليل.</p>' +
          field("sClosedMsg", "رسالة للزبائن لما يكون مقفل", draft.store.closedMsg || "") + field("sMin", "أقل مبلغ للطلب (ريال، ٠ = بدون)", draft.store.minOrder || 0, "number") +
          '<label for="sKeep">مدة حفظ تفاصيل الطلبات المنتهية<select id="sKeep">' + [[30,"شهر"],[90,"٣ شهور"],[180,"٦ شهور"],[365,"سنة"],[730,"سنتين"]].map(function(x){ return '<option value="' + x[0] + '"' + ((draft.store.keepDays || 90) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join("") + '</select></label>' +
        '</div><p class="hint">أرقام التحليل (المبيعات والمنتجات والزبائن) تنحفظ دايم. اللي ينحذف بعد المدة هو تفاصيل الطلب نفسه (الجوال والعنوان) عشان خصوصية الزبائن.</p></div>' +
        (apiUrl() && !staffAuth ? '<div class="card"><h2>إشعارات تطبيق الآيفون</h2><p class="hint">ارفع ملف مفتاح آبل (ينتهي بـ .p8) واكتب Key ID. ينحفظ في الخادم بسرية وما يطلع لأحد، وبعدها توصل إشعارات حالة الطلب لزبائن التطبيق.</p><div class="fields">' +
          '<label class="wide">ملف المفتاح (.p8)<input id="apnsFile" type="file" accept=".p8,text/plain,application/octet-stream,application/pkcs8"></label>' +
          '<label class="wide" for="apnsKid">Key ID<input id="apnsKid" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" dir="ltr" placeholder="مثل RG7L4HY9H8"></label>' +
          '</div><div class="actions"><button class="btn btn-teal" type="button" id="apnsSave">احفظ المفتاح</button><button class="btn btn-soft" type="button" id="apnsTest">جرّب إشعار</button></div><p class="status" id="apnsMsg" aria-live="polite"></p></div>' : '') +
        '<div class="card"><h2>نسخة احتياطية</h2><p class="hint">نزّل نسخة من بياناتك على جهازك. يفضّل مرة كل شهر.</p><div class="actions">' +
          '<button class="btn btn-soft" type="button" id="bkData">المنتجات والأسعار والصور</button>' + (apiUrl() ? '<button class="btn btn-soft" type="button" id="bkOrders">الطلبات (Excel)</button><button class="btn btn-soft" type="button" id="bkStats">التحليل لسنة (Excel)</button>' : '') +
          '<label class="btn btn-ghost" for="bkRestore">استرجاع نسخة</label><input id="bkRestore" type="file" accept="application/json,.json" hidden></div><p class="status" id="bkMsg" aria-live="polite"></p></div>' +
        '<div class="card"><h2>الأرقام السرية</h2><div class="fields">' +
          '<label for="sPin">رقم سري جديد للإدارة (اتركه فاضي إذا ما تبغى تغيّره)<input id="sPin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password"></label>' +
          (apiUrl() ? '<p class="hint">أرقام المناديب والكاشيرية صارت في «المندوب والإشعارات» ← «الموظفين»: كل واحد برقمه.</p>' : '') +
        '</div></div></section>' +
      '<section class="adm-panel" data-panel="orders">' + (apiUrl() ? '<div class="card"><h2>المناديب والكاشيرية</h2><p class="hint">تضيفهم وتعدّل أرقامهم من «حسابات الموظفين».</p><button class="btn btn-soft" type="button" data-atab="staff">افتح حسابات الموظفين</button></div>' : '') + '<div class="card" id="apkCard"><h2>تطبيق المندوب (أندرويد)</h2><p class="hint">يوصل المندوب إشعار بصوت لكل طلب جديد حتى والشاشة مقفلة، ويرسل موقعه للزبون وهو يوصّل. حمّله على جوال المندوب، وبعد ما يفتحه يدخل بالرقم السري حقه مرة وحدة.</p><div class="actions"><a class="btn btn-brand" href="driver-app.apk" download>حمّل التطبيق (APK)</a><button class="btn btn-soft" type="button" id="apkCopy">انسخ الرابط</button></div><p class="hint">أول مرة يطلب الجوال السماح بالتثبيت من هذا المصدر، اضغط «سماح». ثم وافق على الموقع والإشعارات والعمل بالخلفية لما التطبيق يسألك.</p><p class="status" id="apkMsg" aria-live="polite"></p></div>' + (apiUrl() ? '<div class="card" id="cashCard"></div><div class="card" id="pushCard"></div><div class="card" id="tgCard"></div>' : '') + (GH && !apiUrl() ? '<div class="card" id="ghCard"></div>' : '') + (!apiUrl() && !GH ? '<div class="card"><p class="hint">الطلبات تشتغل من نسخة الموقع على GitHub.</p></div>' : '') + '</section>' +
      '</div></div></div>' +
      '<div class="sheet" id="pickSheet" hidden><div class="panel" role="dialog" aria-modal="true" aria-labelledby="pickTitle">' +
        '<div class="panel-head"><h2 id="pickTitle">اختر صورة</h2><button class="btn btn-ghost" id="pickClose" type="button">إغلاق</button></div>' +
        '<div class="upload"><label class="btn btn-brand" for="pickFile" style="display:inline-flex">ارفع صورة من جهازك</label><input id="pickFile" type="file" accept="image/*" hidden><span class="hint">تتصغّر تلقائيًا عشان الموقع يبقى سريع</span></div>' +
        '<div class="picker" id="pickGrid"></div></div></div>' +
      '<div class="sheet" id="ppSheet" hidden><div class="panel" role="dialog" aria-modal="true" aria-labelledby="ppTitle">' +
        '<div class="panel-head"><h2 id="ppTitle">اختر المنتجات</h2><button class="btn btn-brand" id="ppDone" type="button">تم</button></div>' +
        '<p class="hint" id="ppHint"></p><div class="pp-sel" id="ppSel"></div>' +
        '<input class="search" id="ppQ" type="search" placeholder="ابحث عن منتج…" aria-label="بحث"><div class="pick pp-grid" id="ppGrid"></div></div></div>';
    var bind = { sName:"name", sTag:"tagline", sPhone:"phone", sWa:"wa", sArea:"area", sHours:"hours", sEta:"eta", sFee:"fee", sFree:"freeOver", sFeeWas:"feeWas", sNameEn:"name_en", sTagEn:"tagline_en", sAreaEn:"area_en", sHoursEn:"hours_en", sEtaEn:"eta_en", sVat:"vat" };
    $("sClosed").addEventListener("change", function(){ if (this.checked) draft.store.closed = true; else delete draft.store.closed; markDirty(); });
    ["sOpenAt", "sCloseAt"].forEach(function(id){ $(id).addEventListener("change", function(){ var k = id === "sOpenAt" ? "openAt" : "closeAt"; if (this.value) draft.store[k] = this.value; else delete draft.store[k]; markDirty(); }); });
    $("sClosedMsg").addEventListener("input", function(){ if (this.value.trim()) draft.store.closedMsg = this.value; else delete draft.store.closedMsg; markDirty(); });
    $("sShop").addEventListener("input", function(){ var m = /(-?\d{1,2}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)/.exec(this.value); if (m) draft.store.shop = [Number(m[1]), Number(m[2])]; else delete draft.store.shop; markDirty(); });
    $("sCustCancel").addEventListener("change", function(){ if (this.value === "new") delete draft.store.custCancel; else draft.store.custCancel = this.value; markDirty(); });
    $("sMaxKm").addEventListener("input", function(){ var v = Number(this.value || 0); if (v > 0) draft.store.maxKm = v; else delete draft.store.maxKm; markDirty(); });
    $("sShopHere").addEventListener("click", function(){ var m = $("sShopMsg"); if (!navigator.geolocation) { m.textContent = "الجهاز ما يدعم تحديد الموقع."; return; } m.textContent = "جاري تحديد الموقع…";
      navigator.geolocation.getCurrentPosition(function(p){ var la = Math.round(p.coords.latitude * 1e5) / 1e5, lo = Math.round(p.coords.longitude * 1e5) / 1e5; draft.store.shop = [la, lo]; $("sShop").value = la + ", " + lo; m.textContent = "تم. اضغط «حفظ تغييرات المتجر»."; markDirty(); }, function(){ m.textContent = "ما قدرنا نحدد موقعك. اسمح بالموقع للمتصفح."; }, { enableHighAccuracy: true, timeout: 15000 }); });
    $("sMin").addEventListener("input", function(){ var v = Number(this.value || 0); if (v > 0) draft.store.minOrder = v; else delete draft.store.minOrder; markDirty(); });
    $("sKeep").addEventListener("change", function(){ draft.store.keepDays = Number(this.value); markDirty(); });
    $("bkData").addEventListener("click", function(){ var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(draft || D)], { type: "application/json" })); a.download = "متاجر-أحد-نسخة-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); }, 500); });
    if ($("bkOrders")) $("bkOrders").addEventListener("click", function(){ var m = $("bkMsg"), all = []; m.className = "status"; m.textContent = "جاري التجهيز…";
      var page = function(before){ api("/admin/orders", { pin: adminPin, limit: 500, before: before }).then(function(j){
        if (!j.ok) { m.className = "status err"; m.textContent = "ما قدرنا نجيب الطلبات (" + (j.code || "?") + ")."; return; }
        all = all.concat(j.orders); m.textContent = "جاري التجهيز… " + all.length + " طلب";
        if (j.more && all.length < 100000) page(j.orders[j.orders.length - 1].no); else { exportOrders(all); m.textContent = "تم: " + all.length + " طلب."; } }); };
      page(); });
    if ($("bkStats")) $("bkStats").addEventListener("click", function(){ var m = $("bkMsg"); m.className = "status"; m.textContent = "جاري التجهيز…"; api("/admin/stats", { pin: adminPin, days: 365 }).then(function(j){ if (!j.ok) { m.className = "status err"; m.textContent = "ما قدرنا نجيب التحليل (" + (j.code || "?") + ")."; return; } exportStats(j); m.textContent = "تم."; }); });
    $("bkRestore").addEventListener("change", function(){ var file = this.files && this.files[0], m = $("bkMsg"); this.value = ""; if (!file) return;
      var r = new FileReader(); r.onload = function(){ var o; try { o = JSON.parse(r.result); } catch(e){}
        if (!o || !o.store || !Array.isArray(o.products) || !Array.isArray(o.cats) || !o.imgs) { m.className = "status err"; m.textContent = "الملف هذا مو نسخة من المتجر."; return; }
        applyData(o); adminShell(); markDirty(); showTab("store"); var m2 = $("bkMsg"); m2.className = "status"; m2.textContent = "انفتحت النسخة (" + o.products.length + " منتج). اضغط «حفظ تغييرات المتجر» عشان تنطبق على المتجر."; }; r.readAsText(file); });
    apnsStatus();
    Object.keys(bind).forEach(function(id){ $(id).addEventListener("input", function(){ var k = bind[id]; draft.store[k] = (k === "fee" || k === "freeOver" || k === "feeWas") ? Number(this.value || 0) : this.value; markDirty(); }); });
    showTab(aTab);
    $("toStore").addEventListener("click", function(){ if (dirty && !window.confirm("عندك تغييرات ما انحفظت. تبي تعرض المتجر وتتركها؟")) return; go("store"); });
    $("aSave").addEventListener("click", publish);
    $("addCat").addEventListener("click", function(){ draft.cats.push({ id: uid("c"), name: "قسم جديد", img: "" }); markDirty(); renderACats(); renderAFilter(); });
    $("addProd").addEventListener("click", function(){
      var cat = aFilter.cat !== "all" ? aFilter.cat : (draft.cats[0] && draft.cats[0].id);
      draft.products.unshift({ id: uid("p"), name: "منتج جديد", unit: "حبة", price: 0, cat: cat, img: "", stock: true });
      aFilter.q = ""; $("aQ").value = ""; aFilter.open = draft.products[0].id; markDirty(); showTab("prods"); renderAProds();
      var first = document.querySelector("#aProds input"); if (first) { first.focus(); first.select(); }
    });
    $("aQ").addEventListener("input", function(){ aFilter.q = this.value.trim(); aFilter.show = 0; renderAProds(); });
    $("aCat").addEventListener("change", function(){ aFilter.cat = this.value; aFilter.show = 0; renderAProds(); });
    $("offProds").addEventListener("click", function(){ aFilter.cat = aFilter.cat === "__offers" ? "all" : "__offers"; aFilter.q = ""; $("aQ").value = ""; aFilter.show = 0; renderAFilter(); renderAProds(); });
    renderImport();
    $("pickClose").addEventListener("click", function(){ $("pickSheet").hidden = true; });
    $("pickSheet").addEventListener("click", function(e){ if (e.target === this) this.hidden = true; });
    $("pickFile").addEventListener("change", onUpload);
    $("ppDone").addEventListener("click", ppClose);
    $("ppSheet").addEventListener("click", function(e){ if (e.target === this) ppClose(); });
    $("ppQ").addEventListener("input", ppRender);
    stockEdit = {}; costEdit = {}; loadAdminStock();
    newPin = ""; newDPin = ""; $("sPin").addEventListener("input", function(){ newPin = this.value.trim(); if (newPin) markDirty(); });
    if ($("sDPin")) $("sDPin").addEventListener("input", function(){ newDPin = this.value.trim(); if (newDPin) markDirty(); });
    if (GH && !apiUrl()) renderGh();
    if (apiUrl()) renderTg();
    if (apiUrl()) renderPush();
    renderPromos(); renderOffProds(); renderLayout(); renderBans(); renderLook(); renderACats(); renderAFilter(); renderAProds(); renderOver();
    adminExtras();
  }
  function showTab(id){
    if (id === "offers") setTimeout(renderOffProds, 0);
    if(staffAuth && staffAuth.user.role==='cashier' && ['pos','settlement'].indexOf(id)<0)return;
    if (staffAuth && staffAuth.user.role === "preparer" && id !== "prep") return;
    if (ordersOnly() && ["olist", "alerts"].indexOf(id) < 0) return;
    if ((id === "staff" || id === "costs") && staffAuth) return;
    if ((id === "pos" || id === "prep") && !(staffAuth && staffAuth.user.role === (id === "pos" ? "cashier" : "preparer"))) return;
    aTab = id;
    if(fullAdminRoot()){if($("adminSectionSearch")?.value){$("adminSectionSearch").value="";$("adminSectionSearch").oninput();}if(adminNavMedia?.matches&&fullAdminRoot().classList.contains("admin-menu-open"))toggleAdminMenu(false);}
    Array.prototype.forEach.call(document.querySelectorAll(".adm-panel"), function(p){ p.hidden = p.dataset.panel !== id; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-atab]"), function(b){ if (b.dataset.atab === id) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if ($("aTitle")) $("aTitle").textContent = TAB_TITLE[id] || "";
    syncAdminChrome(); a2Sync();
    if(fullAdminRoot()&&!dirty&&$('aStatus')&&!$('aStatus').classList.contains('err'))$('aStatus').textContent='';
    if(id === "store"){renderAdminPOSSettings();initZoneEditor();}
    if(id === "costs")renderCosts();
    if(id === "codes")renderCodes();
    if(id === "pos")renderPOS();
    if (id === "prep") renderPreparation();
    if (id === "settlement") renderSettlement();
    if (id === "wallets") renderWalletAdmin();
    if (id === "staff") renderStaffAccounts();
    if (id === "alerts") loadOrderAlerts();
    if (id === "over") renderOver();
    if (id === "stats") renderStats();
    if (id === "visits") renderVisits();
    if (id === "olist") { if (!staffCache && apiUrl()) loadStaff(function(){ if (aTab === "olist") renderOList(); }); renderOList(); }
    if (id === "log") renderLog();
    if (id === "cust") renderWinback();
    if (id === "rates") renderRatings(true);
    if (id === "sign") renderSign();
    if (id === "orders") { renderCash(); renderStaff(); if ($("apkCopy")) $("apkCopy").onclick = function(){ var u = new URL("driver-app.apk", location.href).href, m = $("apkMsg"); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function(){ m.className = "status"; m.textContent = "اننسخ الرابط. أرسله للمندوب بالواتساب."; }, function(){ m.className = "status"; m.textContent = u; }); }; }
    if (id === "bans") renderBans();
    if (id === "prods") loadOpenItems();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest("[data-atab]"); if (t) { showTab(t.dataset.atab); return; }
    t = e.target.closest("[data-theme-pick]"); if (t) { draft.store.theme = t.dataset.themePick; applyTheme(draft.store.theme); markDirty(); renderLook(); return; }
    t = e.target.closest("[data-lang-def]"); if (t) { draft.store.lang = t.dataset.langDef; markDirty(); renderLook(); return; }
  });
  function renderLook(){
    var box = $("aLook"); if (!box) return;
    var cur = draft.store.theme || "kiu", lang = draft.store.lang || "ar";
    box.innerHTML = '<h2>ألوان المتجر</h2><p class="hint">اختر لوحة الألوان، وتشوفها على هذي الصفحة على طول. تنطبق على الزبائن بعد «حفظ تغييرات المتجر».</p>' +
      '<div class="themes">' + Object.keys(THEMES).map(function(id){ var th = THEMES[id];
        return '<button type="button" class="theme' + (id === cur ? ' on' : '') + '" data-theme-pick="' + id + '" aria-pressed="' + (id === cur) + '"><span class="sw" style="background:' + th.v["--sky"] + '"><i style="background:' + th.v["--teal"] + '"></i><i style="background:' + th.v["--orange"] + '"></i><i style="background:' + th.v["--ink"] + '"></i></span><b>' + th.ar + '</b>' + (id === cur ? '<em>المختار</em>' : '') + '</button>'; }).join("") + '</div>' +
      '<h2 style="margin-top:8px">لغة المتجر الافتراضية</h2><p class="hint">اللغة اللي يفتح فيها المتجر أول مرة. الزبون يقدر يغيّرها من زر EN / ع فوق.</p>' +
      '<div class="pays" style="max-width:420px"><button type="button" data-lang-def="ar" aria-pressed="' + (lang === "ar") + '">العربية</button><button type="button" data-lang-def="en" aria-pressed="' + (lang === "en") + '">English</button></div>' +
      '<p class="hint">الأسماء الإنجليزية للمنتجات والأقسام تكتبها في «المنتجات» و«الأقسام». المنتج اللي ما له اسم إنجليزي يطلع بالعربي.</p>' + appLookHTML();
    box.oninput = box.onchange = appLookInput;
    box.onclick = function(e){ var t = e.target.closest("[data-appset]"); if (!t) return; var A = appLook(); var k = t.dataset.appset, v = t.dataset.v;
      if (v === "") delete A[k]; else A[k] = /^\d+$/.test(v) ? Number(v) : v; markDirty(); renderLook(); };
  }
  // «شكل تطبيق الآيفون»: يتحفظ في store.app، والتطبيق يقراه أول ما ينفتح (بدون تحديث للتطبيق)
  var APP_TABS = [["home","الرئيسية",["house.fill","house","storefront.fill","basket.fill"]],["categories","الأقسام",["square.grid.2x2.fill","list.bullet","circle.grid.3x3.fill","rectangle.grid.2x2.fill"]],
    ["offers","العروض",["tag.fill","percent","flame.fill","gift.fill","star.fill"]],["cart","السلة",["bag.fill","cart.fill","basket.fill","handbag.fill"]],["account","حسابي",["person.fill","person.crop.circle.fill","person.circle","house.circle.fill"]]];
  var APP_TAB_ICONS = { "house.fill":"🏠", "house":"⌂", "storefront.fill":"🏪", "basket.fill":"🧺", "square.grid.2x2.fill":"▦", "list.bullet":"☰", "circle.grid.3x3.fill":"⠿", "rectangle.grid.2x2.fill":"▤",
    "tag.fill":"🏷️", "percent":"٪", "flame.fill":"🔥", "gift.fill":"🎁", "star.fill":"⭐", "bag.fill":"👜", "cart.fill":"🛒", "handbag.fill":"👛", "person.fill":"👤", "person.crop.circle.fill":"🧑", "person.circle":"◯", "house.circle.fill":"🏡" };
  function appLook(){ draft.store.app = draft.store.app || {}; return draft.store.app; }
  function appLookHTML(){
    var A = draft.store.app || {}, pct = function(k){ return Math.round((Number(A[k]) || 1) * 100); };
    var slider = function(k, label, lo, hi){ return '<label class="fld" style="display:grid;gap:4px;margin:10px 0"><span><b>' + label + '</b> <em data-applbl="' + k + '">' + pct(k) + '٪</em></span><input type="range" min="' + lo + '" max="' + hi + '" step="5" value="' + pct(k) + '" data-appk="' + k + '"></label>'; };
    var color = function(k, label, def){ return '<label class="fld" style="display:flex;align-items:center;gap:10px;margin:8px 0"><input type="color" value="' + esc(A[k] || def) + '" data-appk="' + k + '" style="width:48px;height:36px;border:0;background:none"><b>' + label + '</b>' + (A[k] ? '<button type="button" class="btn btn-ghost" data-appset="' + k + '" data-v="">رجّع الافتراضي</button>' : '<span class="hint" style="margin:0">الافتراضي</span>') + '</label>'; };
    var seg = function(k, opts, cur){ return '<div class="pays" style="max-width:420px;margin:6px 0 12px">' + opts.map(function(o){ return '<button type="button" data-appset="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>'; }).join("") + '</div>'; };
    var check = function(k, label){ return '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-appk="' + k + '"' + (A[k] === false ? '' : ' checked') + '>' + label + '</label>'; };
    var icons = A.catIcons || {}, tabs = A.tabIcons || {};
    return '<h2 style="margin-top:18px">شكل تطبيق الآيفون</h2><p class="hint">تغيّر هنا وتحفظ («حفظ تغييرات المتجر»)، والتطبيق يتغير عند الزبائن أول ما يفتحونه، بدون تحديث للتطبيق.</p>' +
      '<h3>أحجام الخط</h3>' + slider("textScale", "كل الكتابة", 80, 130) + slider("priceScale", "الأسعار", 80, 140) + slider("bannerScale", "خط البنرات", 75, 140) +
      '<h3>الألوان</h3>' + color("brand", "اللون الأساسي (الأزرار والرأس)", "#0E8A6A") + color("accent", "لون العروض والخصومات", "#EE7417") +
      '<h3>رأس الصفحة الرئيسية</h3>' + seg("header", [["dark","أخضر غامق"],["light","فاتح"]], A.header || "dark") +
      '<h3>المنتجات في الصف</h3>' + seg("columns", [[3,"٣ منتجات"],[2,"منتجين (أكبر)"]], A.columns || 3) +
      '<h3>زر الإضافة للسلة</h3><p class="hint">حجمه يكبر ويصغر مع «كل الكتابة» فوق، فيبقى متناسق مع المنتج والسعر.</p>' + seg("addStyle", [["filled","أخضر مليان"],["outline","أبيض بإطار"]], A.addStyle || "filled") +
      '<h3>حواف الكروت</h3>' + seg("radius", [["round","دائرية"],["soft","خفيفة"],["square","شبه مربعة"]], A.radius || "round") +
      '<h3>خلفية الصفحات</h3>' + seg("background", [["white","أبيض"],["gray","رمادي فاتح"]], A.background || "white") +
      check("showCatChip", "اسم القسم على كرت المنتج") +
      '<h3>الرئيسية</h3>' + check("showChips", "أزرار الأقسام تحت البنرات") + check("showFeatured", "«مختارات لك» (لو قفلتها تطلع العروض بدالها)") +
      '<h3>أيقونة كل قسم</h3><p class="hint">اكتب إيموجي (مثل 🥛 أو 🍫). فاضي = الأيقونة الافتراضية.</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' +
        draft.cats.map(function(c){ return '<label style="display:flex;gap:6px;align-items:center"><input data-appcat="' + esc(c.id) + '" value="' + esc(icons[c.id] || "") + '" maxlength="4" style="width:52px;text-align:center;font-size:20px">' + esc(c.name) + '</label>'; }).join("") + '</div>' +
      '<h3>أيقونات الشريط تحت</h3>' + APP_TABS.map(function(t){ var cur = tabs[t[0]] || t[2][0];
        return '<div style="margin:6px 0"><b>' + t[1] + '</b><div class="pays" style="max-width:520px;margin-top:4px">' + t[2].map(function(n){ return '<button type="button" data-apptab="' + t[0] + '" data-v="' + n + '" aria-pressed="' + (cur === n) + '" style="font-size:20px">' + (APP_TAB_ICONS[n] || n) + '</button>'; }).join("") + '</div></div>'; }).join("");
  }
  function appLookInput(e){
    var t = e.target, A = appLook();
    if (t.dataset.appk) {
      var k = t.dataset.appk;
      if (t.type === "range") { A[k] = Number(t.value) / 100; var l = document.querySelector('[data-applbl="' + k + '"]'); if (l) l.textContent = t.value + "٪"; }
      else if (t.type === "color") A[k] = t.value;
      else if (t.type === "checkbox") A[k] = t.checked;
      markDirty(); if (e.type === "change" && t.type === "color") renderLook(); return;
    }
    if (t.dataset.appcat != null) { A.catIcons = A.catIcons || {}; var v = t.value.trim(); if (v) A.catIcons[t.dataset.appcat] = v; else delete A.catIcons[t.dataset.appcat]; markDirty(); }
  }
  document.addEventListener("click", function(e){ var t = e.target.closest("[data-apptab]"); if (!t || !draft) return; var A = appLook(); A.tabIcons = A.tabIcons || {}; A.tabIcons[t.dataset.apptab] = t.dataset.v; markDirty(); renderLook(); });
  var overCache = null;
  function renderOver(){
    var box = $("aOver"); if (!box || !draft || ordersOnly()) return;
    var ps = draft.products, out = ps.filter(function(p){ return !p.stock; }).length, sale = ps.filter(function(p){ return p.old && p.old > p.price; }).length;
    var noEn = ps.filter(function(p){ return !p.name_en; }).length;
    var stat = function(n, l, tab){ return '<button type="button" class="stat" data-atab="' + tab + '"><b>' + n + '</b><span>' + l + '</span></button>'; };
    box.innerHTML = staffBox() + (apiUrl() ? '<div class="card today" id="aToday"><p class="hint">جاري تحميل أرقام اليوم…</p></div><div class="card tips" id="aTips"></div>' : '') + '<div class="stats">' + stat(ps.length, "منتج", "prods") + stat(draft.cats.length, "قسم", "cats") + stat(sale, "منتج عليه خصم", "prods") + stat(out, "منتج نافد", "prods") + '</div>' +
      (apiUrl() ? '<div class="card" id="aDrvLoc"><div class="sec-head" style="margin:0"><h2>وين المناديب الحين</h2><button class="btn btn-soft" type="button" id="aDrvRe">تحديث</button></div><p class="hint" id="aDrvTxt">جاري التحميل…</p><div class="adm-dmap" id="aDrvMap" hidden></div></div>' : '') +
      (apiUrl() ? '<div class="card"><div class="sec-head" style="margin:0"><h2>آخر الطلبات</h2></div><div id="aOrders" class="hint">جاري التحميل…</div></div>' : '') +
      '<div class="card openbox' + (draft.store.closed ? ' closed' : '') + '"><span class="ic">' + ic(draft.store.closed ? "lock" : "unlock") + '</span><span class="t"><b>' + (draft.store.closed ? 'استقبال طلبات التوصيل متوقف' : 'طلبات التوصيل مفتوحة') + '</b><span>' + (draft.store.minOrder ? 'أقل مبلغ للطلب ' + num(draft.store.minOrder) + ' ر.س' : 'بدون حد أدنى للطلب') + '</span></span><button class="btn ' + (draft.store.closed ? 'btn-brand' : 'btn-ghost') + '" type="button" id="aToggleOpen">' + (draft.store.closed ? 'افتح استقبال الطلبات' : 'أوقف الطلبات مؤقتًا') + '</button></div>' +
      '<div class="card"><h2>اختصارات</h2><div class="quick">' +
        '<button type="button" class="btn btn-brand" data-onew>+ طلب بالتلفون أو الواتساب</button>' + '<button type="button" class="btn btn-ghost" data-atab="prods">تعديل الأسعار</button><button type="button" class="btn btn-ghost" data-atab="offers">عرض اليوم والعروض</button>' +
        '<button type="button" class="btn btn-ghost" data-atab="layout">ترتيب الصفحة الرئيسية</button><button type="button" class="btn btn-ghost" data-atab="look">الألوان واللغة</button></div>' +
        lowHTML() + (noEn ? '<p class="hint">فيه ' + noEn + ' منتج بدون اسم إنجليزي، ويطلعون بالعربي في النسخة الإنجليزية.</p>' : '') + '</div>';
    simplifyOverview(); a2Over();
    if (apiUrl()) { loadToday(); loadDrvLoc(); $("aDrvRe").addEventListener("click", function(){ loadDrvLoc(true); }); }
    $("aToggleOpen").disabled=!catalogSaveAvailable();
    $("aToggleOpen").addEventListener("click", function(){ if(!catalogSaveAvailable()){sToast("تغيير استقبال الطلبات يحتاج تحديث الخدمة أولًا");return;}if(dirty){sToast("احفظ تعديلات المتجر أولًا قبل تغيير استقبال الطلبات");return;}if(!draft.store.closed&&!confirm("إيقاف استقبال طلبات جديدة مؤقتًا؟ الطلبات الحالية تستمر."))return; if (draft.store.closed) delete draft.store.closed; else draft.store.closed = true; if ($("sClosed")) $("sClosed").checked = !!draft.store.closed; markDirty(); renderOver(); publish(); });
    if (apiUrl()) overApi("/driver/orders", { pin: adminPin }).then(function(j){
      var el = $("aOrders"); if (!el) return;
      if (!j.ok) { el.textContent = j.code === "config" ? "قاعدة الطلبات مو مربوطة بعد (الدليل، القسم ٧)." : "ما قدرنا نجيب الطلبات."; return; }
      var day = new Date(); day.setHours(0,0,0,0);
      var today = j.orders.filter(function(o){ return o.created >= day.getTime(); }), sum = today.reduce(function(s, o){ return o.status === "canceled" ? s : s + o.total; }, 0);
      var lbl = { "new": "جديد", accepted: "استلمه المندوب", onway: "في الطريق", delivered: "تم التوصيل", canceled: "ملغي" };
      el.className = "";
      el.innerHTML = '<div class="admin-order-summary"><span><b>' + today.length + '</b> طلب اليوم</span><span><b>' + num(sum) + '</b> ر.س مبيعات</span><span><b>' + j.orders.filter(function(o){ return o.status === "new"; }).length + '</b> بانتظار المندوب</span></div>' +
        (j.orders.length ? '<div class="olist">' + j.orders.slice(0, 6).map(function(o){ return '<button type="button" class="orow" data-over-order="'+esc(o.no)+'"><b dir="ltr">' + esc(o.no) + '</b><span>' + esc(o.phone) + '</span><span>' + num(o.total) + ' ر.س</span><span class="spill ' + o.status + '">' + lbl[o.status] + '</span></button>'; }).join("") + '</div>' : '<p class="hint">ما فيه طلبات للحين.</p>');
      el.querySelectorAll('[data-over-order]').forEach(function(b){b.onclick=function(){oState.q=b.dataset.overOrder;oState.f='all';oState.range=0;showTab('olist');};});
    });
  }
  var overMemo = {};
  function overApi(path, body, ttl){ var m = overMemo[path], now = Date.now(); if (m && m.pin === adminPin && now - m.at < (ttl || 4000)) return m.p; var p = api(path, body); overMemo[path] = { at: now, p: p, pin: adminPin }; return p; }
  function loadDrvLoc(force){
    clearTimeout(admTimer); if (force === true) delete overMemo["/admin/driver-loc"];
    var fold=$("aDrvLoc")?.closest("details");if(fold&&!fold.open)return;
    overApi("/admin/driver-loc", { pin: adminPin }).then(function(j){
      var t = $("aDrvTxt"), m = $("aDrvMap"); if (!t || !m) return;
      if (!j.ok) { t.textContent = j.code === "not_found" ? "حدّث الخادم في Cloudflare عشان يشتغل التتبع." : "ما قدرنا نجيب موقع المندوب."; return; }
      var locs = (j.locs || (j.loc ? [Object.assign({ name: "المندوب" }, j.loc)] : [])).filter(function(l){ return j.now - l.at < 10 * 60e3; });
      var agoT = function(at){ var a = Math.round((j.now - at) / 1000); return a < 20 ? "الحين" : a < 60 ? "قبل " + a + " ثانية" : "قبل " + Math.round(a / 60) + " دقيقة"; };
      if (!locs.length) { t.textContent = j.onway.length ? "فيه " + j.onway.length + " طلب في الطريق، بس ما فيه مندوب يشارك موقعه (يمكن قافل الصفحة أو ما سمح بالموقع)." : "ما فيه مندوب يشارك موقعه الحين. يطلع هنا أول ما المندوب يفتح تطبيقه (أو صفحة المندوب) ويدخل برقمه ويسمح بالموقع."; m.hidden = true; }
      else {
        t.textContent = locs.map(function(l){ var n = j.onway.filter(function(o){ return (o.drv || "admin") === l.drv; }).length; return l.name + ": " + agoT(l.at) + (n ? " · معه " + n + " طلب" : ""); }).join("  ·  ");
        m.hidden = false;
        loadLeaflet(function(){
          if (!$("aDrvMap")) return;
          if (!admMap || admMap.getContainer() !== $("aDrvMap")) { admMap = L.map("aDrvMap", { zoomControl: true }); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(admMap); admLayer = L.layerGroup().addTo(admMap); }
          admLayer.clearLayers();
          var pts = [];
          locs.forEach(function(l){ pts.push([l.lat, l.lng]); L.marker([l.lat, l.lng], { icon: L.divIcon({ className: "trk-pin car", html: ic("truck"), iconSize: [40, 40], iconAnchor: [20, 20] }), zIndexOffset: 500 }).addTo(admLayer).bindTooltip(esc(l.name), { permanent: locs.length > 1, direction: "top", offset: [0, -18] }); });
          j.onway.forEach(function(o){ if (o.lat == null) return; pts.push([o.lat, o.lng]); L.marker([o.lat, o.lng], { icon: L.divIcon({ className: "trk-pin home", html: ic("home"), iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(admLayer).bindTooltip(o.no + (o.name ? " · " + esc(o.name) : "") + (o.drvName ? " · مع " + esc(o.drvName) : "")); });
          admMap.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 16 });
        });
      }
      clearTimeout(admTimer); if (aTab === "over" && mode === "admin") admTimer = setTimeout(loadDrvLoc, 10000);   // مؤقت واحد بس، حتى لو انرسمت الصفحة كذا مرة
    });
  }
  function lowHTML(){
    var la = draft.store.lowAt == null ? 3 : Number(draft.store.lowAt);
    var low = Object.keys(STK_LOW).length ? STK_LOW : STK, l = draft.products.filter(function(p){ var q = Object.prototype.hasOwnProperty.call(stockEdit, p.id) ? stockEdit[p.id] : low[p.id]; return q != null && q <= la; }).sort(function(a, b){ return (low[a.id] || 0) - (low[b.id] || 0); });
    if (!l.length) return '';
    return '<div class="lowlist"><b>منتجات قربت تخلص أو خلصت</b>' + l.slice(0, 12).map(function(p){ var q = qtyOf(p.id);
      return '<button type="button" class="lowrow" data-gostock="' + p.id + '">' + imgTag(p.img, "") + '<span>' + esc(p.name) + '</span><em class="' + (q ? 'low' : 'zero') + '">' + (q ? 'باقي ' + q : 'نفد') + '</em></button>'; }).join("") + '</div>';
  }
  function field(id, label, val, type){ return '<label for="' + id + '">' + label + '<input id="' + id + '" type="' + (type || "text") + '" value="' + esc(val) + '"' + (type === "number" ? ' min="0" step="0.5" inputmode="decimal"' : '') + '></label>'; }
  function catOptions(sel){ return draft.cats.map(function(c){ return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join(""); }
  // مكان خاص لمنتجات العروض (طلب المالك ١٤ نوفمبر ٢٠٢٦): فلتر «العروض» فوق الأقسام، بأنواعها
  function offKind(p){
    if (p.old && Number(p.old) > Number(p.price)) return "sale";
    if ((draft.store.groups || []).some(function(g){ return g && g.on !== false && (g.ids || []).indexOf(p.id) > -1; })) return "grp";
    if ((p.packs || []).some(function(k){ return Number(k.n) > 1 && Number(k.price) > 0 && Number(k.price) < Number(k.n) * Number(p.price) - 0.001; })) return "qty";
    return "";
  }
  var OFF_F = { __offers: "🔥 كل منتجات العروض", __sale: "🔥 خصم (عليها «قبل الخصم»)", __qty: "🔥 عروض الكمية (مثل ٣ بـ ١٠)", __grp: "🔥 اختر من أي نوع (مثل ديمة)" };
  function renderAFilter(){
    var n = { __offers: 0, __sale: 0, __qty: 0, __grp: 0 };
    draft.products.forEach(function(p){ var k = offKind(p); if (k) { n.__offers++; n["__" + k]++; } });
    $("aCat").innerHTML = '<option value="all">كل الأقسام</option><optgroup label="العروض">' + Object.keys(OFF_F).map(function(k){ return '<option value="' + k + '"' + (aFilter.cat === k ? ' selected' : '') + '>' + OFF_F[k] + ' (' + num(n[k]) + ')</option>'; }).join("") + '</optgroup><optgroup label="الأقسام">' + catOptions(aFilter.cat) + '</optgroup>';
  }
  var LAY_LABEL = { featured: "البنر الثابت فوق (عرض المجموعة)", again: "طلباتك المعتادة (وللجديد: الأكثر طلباً)", due: "يمكن خلص عندك؟ (حسب عادة الزبون)", moment: "حسب وقت اليوم (فطور، غدا، عصرية، سهرة، ورمضان)", season: "التقويم (مقاضي الشهر، تجهيزات رمضان، ضيافة العيد)", myoffers: "عروض على أغراض الزبون", promos: "بنرات العروض", catoffers: "عروض الأقسام (مربعات)", free: "بطاقة التوصيل المجاني", catgrid: "الأقسام (مربعات الصور)", offers: "أفضل العروض (صف يتحرك)", deals: "منتجات السعر الرمزي (صف يتحرك)", grid: "الفلاتر والمنتجات" };
  var PROMO_LABEL = { top: "أقوى خصم (تلقائي)", multi: "عرض الكمية (تلقائي)", daily: "عرض اليوم", offers: "عروض الأسبوع", deals: "منتجات السعر الرمزي", bakery: "بطاقة المخبز", free: "التوصيل المجاني", catdeal: "عروض القسم (تلقائي)", night: "طلعات السهرة (المساء بس)", veg: "الخضار والفواكه (قريباً)", welcome: "كود الترحيب (store.welcome)" };
  function mvBtns(kind, id, ends){ return '<span class="mv">' + (ends ? '<button type="button" class="mv-end" data-mv="' + kind + ':' + id + ':-99" aria-label="لأول الصفحة">أول</button>' : '') + '<button type="button" data-mv="' + kind + ':' + id + ':-1" aria-label="فوق">' + ic("up") + '</button><button type="button" data-mv="' + kind + ':' + id + ':1" aria-label="تحت">' + ic("down") + '</button>' + (ends ? '<button type="button" class="mv-end" data-mv="' + kind + ':' + id + ':99" aria-label="لآخر الصفحة">آخر</button>' : '') + '</span>'; }
  function renderLayout(){
    var st = draft.store;
    st.layout = orderOf(st.layout, LAYOUT_DEF); st.promos = orderOf(st.promos, PROMO_DEF.concat((st.bans || []).map(function(b){ return b.id; })));
    var plab = {}; Object.keys(PROMO_LABEL).forEach(function(k){ plab[k] = PROMO_LABEL[k]; }); (st.bans || []).forEach(function(b){ plab[b.id] = "بنر خاص: " + esc(b.title || ""); });
    var rows = function(list, kind, labels){ return list.map(function(x, i){
      return '<div class="lay-row' + (x.on ? '' : ' off') + '"><span class="pos">' + (i + 1) + '</span><b>' + labels[x.id] + '</b>' +
        '<label class="chk"><input type="checkbox" data-layon="' + kind + ':' + x.id + '"' + (x.on ? ' checked' : '') + '>يظهر</label>' + mvBtns(kind, x.id, kind === "lay") + '</div>'; }).join(""); };
    var bh = Number(st.banH) || 200;
    $("aLayout").innerHTML = '<h2>ترتيب الواجهة</h2><p class="hint">رتّب أقسام الصفحة الرئيسية بالأسهم ↑ ↓ (تقدر تنزّل أي قسم لآخر الصفحة أو ترفعه لأولها)، وشيل علامة «يظهر» عشان تخفيه.</p>' +
      '<div class="lay-size"><label for="aBanH">حجم البنرات <b id="aBanHv">' + bh + ' بكسل</b></label><input id="aBanH" type="range" min="140" max="360" step="10" value="' + bh + '"><div class="lay-size-n"><span>أصغر</span><span>أكبر</span></div>' +
      '<div class="lay-prev" id="aBanPrev" style="height:' + Math.round(bh * 0.5) + 'px"><span>معاينة البنر</span></div></div>' +
      '<b style="font-size:.9rem">أقسام الصفحة الرئيسية</b><div class="alist">' + rows(st.layout, "lay", LAY_LABEL) + '</div>' +
      '<b style="font-size:.9rem">بطاقات العروض الكبيرة</b><div class="alist">' + rows(st.promos, "promo", plab) + '</div>';
  }
  document.addEventListener("input", function(e){
    if (mode !== "admin" || !e.target || e.target.id !== "aBanH") return;
    var v = Number(e.target.value); draft.store.banH = v; $("aBanHv").textContent = v + " بكسل"; $("aBanPrev").style.height = Math.round(v * 0.5) + "px"; markDirty();
  });
  function moveIn(arr, i, d){ if (i < 0) return false; if (Math.abs(d) > 1) { var j2 = d < 0 ? 0 : arr.length - 1; if (j2 === i) return false; var y = arr.splice(i, 1)[0]; arr.splice(j2, 0, y); return true; } var j = i + d; if (j < 0 || j >= arr.length) return false; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; return true; }
  document.addEventListener("change", function(e){
    if (mode !== "admin" || !e.target.dataset || !e.target.dataset.layon) return;
    var k = e.target.dataset.layon.split(":"), arr = k[0] === "lay" ? draft.store.layout : draft.store.promos;
    arr.forEach(function(x){ if (x.id === k[1]) x.on = e.target.checked; }); markDirty(); renderLayout();
  });
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest("[data-mv]"); if (!t) return;
    var k = t.dataset.mv.split(":"), kind = k[0], id = k[1], d = Number(k[2]), moved = false;
    if (kind === "lay" || kind === "promo") { var arr = kind === "lay" ? draft.store.layout : draft.store.promos;
      moved = moveIn(arr, arr.map(function(x){ return x.id; }).indexOf(id), d); if (moved) renderLayout(); }
    else if (kind === "fy") { moved = moveIn(draft.store.forYou, draft.store.forYou.indexOf(id), d); if (moved) renderBans(); }
    else if (kind === "cat") { moved = moveIn(draft.cats, draft.cats.map(function(c){ return c.id; }).indexOf(id), d); if (moved) { renderACats(); renderAFilter(); } }
    else if (kind === "prod") {
      var q = aFilter.q, vis = draft.products.filter(function(p){ return (aFilter.cat === "all" || p.cat === aFilter.cat) && (!q || p.name.indexOf(q) > -1); });
      var vi = vis.map(function(p){ return p.id; }).indexOf(id), other = vis[vi + d];
      if (vi > -1 && other) { var a = draft.products.indexOf(vis[vi]), b = draft.products.indexOf(other); draft.products[a] = other; draft.products[b] = vis[vi]; moved = true; renderAProds(); }
    }
    if (moved) { markDirty(); var el = document.querySelector('[data-mv="' + t.dataset.mv + '"]'); if (el) el.focus(); }
  });
  function renderACats(){
    $("aCats").innerHTML = draft.cats.map(function(c){
      var n = draft.products.filter(function(p){ return p.cat === c.id; }).length;
      return '<div class="catrow"><button class="imgbtn" type="button" data-pick="cat:' + c.id + '" aria-label="صورة القسم">' + imgTag(c.img, "") + '</button>' +
        '<div class="cat-names"><label>اسم القسم (' + num(n) + ' منتج)<input data-cat-name="' + c.id + '" value="' + esc(c.name) + '"></label><label>بالإنجليزي<input data-cat-name-en="' + c.id + '" value="' + esc(c.name_en || "") + '" dir="ltr"></label><label>مكانه في المحل<input data-cat-loc="' + c.id + '" value="' + esc(c.loc || "") + '" placeholder="مثال: المخبز · جنب الكاشير"></label>' + (c.id === "print" ? '' : '<label class="chk"><input type="checkbox" data-cat-soon="' + c.id + '"' + (c.soon ? ' checked' : '') + '> «قريباً» (يظهر للزبون «ستتم إضافته قريباً» لين تنضاف المنتجات)</label>') + '</div>' +
        mvBtns('cat', c.id) + '<button class="del" type="button" data-del-cat="' + c.id + '"' + (n ? ' disabled title="انقل منتجاته أو احذفها أول"' : '') + '>حذف</button></div>';
    }).join("");
  }
  var zoneEd = null;
  function initZoneEditor(){
    var el = $("zoneMap"); if (!el) return;
    if (zoneEd && zoneEd.el === el) { setTimeout(function(){ zoneEd.map.invalidateSize(); }, 50); return; }
    loadLeaflet(function(){
      if (!$("zoneMap") || $("zoneMap")._leaflet_id) return;
      var st = draft.store, c = st.shop || (st.zone && st.zone[0]) || S.mapCenter || DEFAULT_CENTER;
      var m = L.map("zoneMap", { attributionControl: true }).setView(c, 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      if (st.shop) L.marker(st.shop, { title: "المحل" }).addTo(m);
      zoneEd = { el: $("zoneMap"), map: m, pts: (st.zone || []).map(function(p){ return [Number(p[0]), Number(p[1])]; }), marks: [], poly: null, circle: null };
      var icon = L.divIcon({ className: "", html: '<div class="zone-pt"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
      var save = function(){ if (zoneEd.pts.length >= 3) st.zone = zoneEd.pts.map(function(p){ return [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]; }); else delete st.zone; markDirty(); };
      var draw = function(){
        zoneEd.marks.forEach(function(x){ m.removeLayer(x); }); zoneEd.marks = [];
        if (zoneEd.poly) { m.removeLayer(zoneEd.poly); zoneEd.poly = null; }
        if (zoneEd.circle) { m.removeLayer(zoneEd.circle); zoneEd.circle = null; }
        if (zoneEd.pts.length >= 2) zoneEd.poly = L.polygon(zoneEd.pts, { color: "#0E9F7B", weight: 2, fillOpacity: zoneEd.pts.length >= 3 ? 0.12 : 0 }).addTo(m);
        else if (st.shop && Number(st.maxKm) > 0) zoneEd.circle = L.circle(st.shop, { radius: Number(st.maxKm) * 1000, color: "#FF8A1F", weight: 1, fillOpacity: 0.05, interactive: false }).addTo(m);
        zoneEd.pts.forEach(function(p, i){ var mk = L.marker(p, { icon: icon, draggable: true }).addTo(m);
          mk.on("dragend", function(){ var ll = mk.getLatLng(); zoneEd.pts[i] = [ll.lat, ll.lng]; save(); draw(); });
          mk.on("dblclick", function(e){ L.DomEvent.stop(e); zoneEd.pts.splice(i, 1); save(); draw(); }); zoneEd.marks.push(mk); });
        $("zoneInfo").textContent = zoneEd.pts.length >= 3 ? "المنطقة فيها " + num(zoneEd.pts.length) + " نقاط. لا تنسَ «حفظ تغييرات المتجر»." : zoneEd.pts.length ? "حط " + num(3 - zoneEd.pts.length) + " نقطة زيادة على الأقل." : (Number(st.maxKm) > 0 ? "ما فيه منطقة مرسومة: الدائرة البرتقالية هي أقصى مسافة (" + num(st.maxKm) + " كم)." : "ما فيه منطقة مرسومة.");
      };
      m.on("click", function(e){ if (zoneEd.pts.length >= 40) return; zoneEd.pts.push([e.latlng.lat, e.latlng.lng]); save(); draw(); });
      m.doubleClickZoom.disable();
      $("zoneUndo").onclick = function(){ zoneEd.pts.pop(); save(); draw(); };
      $("zoneClear").onclick = function(){ if (!zoneEd.pts.length) return; if (!confirm("تمسح منطقة التوصيل المرسومة؟")) return; zoneEd.pts = []; save(); draw(); };
      draw();
      if (zoneEd.pts.length >= 3) m.fitBounds(L.latLngBounds(zoneEd.pts), { padding: [20, 20] });
    });
  }
  /* ----- التكاليف التشغيلية ومستشار العروض (للمالك بس؛ الأرقام سرية في القاعدة) ----- */
  var costsState = { opex: null, fields: null, adv: null, busy: false, msg: "" };
  var OPEX_GROUPS = [["fixed", "المصروفات الثابتة كل شهر (ر.س)"], ["order", "تكلفة كل طلب (ر.س)"], ["pct", "نسب من المبيعات (%)"], ["plan", "توقعاتك (تنفع لين يتجمع سجل طلبات كافي)"]];
  // أكواد الخصم (المالك والمدير): الكود سري في الخادم، والزبون يكتبه في صفحة الدفع
  function codesList(j){
    var L = j.codes || [];
    if (!L.length) return '<p class="hint">ما فيه أكواد للحين.</p>';
    return '<div class="codes-wrap"><table class="codes-tbl"><thead><tr><th>الكود</th><th>الخصم</th><th>أقل طلب</th><th>ينتهي</th><th>الاستخدام</th><th>اللي انخصم</th><th></th></tr></thead><tbody>' + L.map(function(c){
      var exp = c.until && Date.now() > c.until;
      return '<tr' + (c.active && !exp ? '' : ' style="opacity:.55"') + '><td dir="ltr"><b>' + esc(c.code) + '</b>' + (c.note ? '<br><small>' + esc(c.note) + '</small>' : '') + '</td><td>' + (c.kind === "percent" ? num(c.value) + '٪' + (c.cap > 0 ? ' (حتى ' + num(c.cap) + ')' : '') : num(c.value) + ' ر.س') + '</td><td>' + (c.min ? num(c.min) : '—') + '</td><td>' + (c.until ? new Date(c.until).toLocaleDateString("ar-SA-u-nu-latn") + (exp ? ' (انتهى)' : '') : 'بدون') + '</td><td>' + num(c.used) + (c.maxUses ? ' / ' + num(c.maxUses) : '') + (c.perPhone ? '<br><small>' + num(c.perPhone) + ' لكل جوال</small>' : '') + '</td><td>' + num(c.given) + ' ر.س</td><td><button type="button" class="btn btn-ghost" data-cedit="' + esc(c.code) + '">عدّل</button> <button type="button" class="btn btn-soft" data-ctog="' + esc(c.code) + '">' + (c.active ? 'أوقف' : 'فعّل') + '</button> <button type="button" class="btn btn-ghost" data-cdel="' + esc(c.code) + '">احذف</button></td></tr>';
    }).join("") + '</tbody></table></div>';
  }
  var codesCache = [];
  function renderCodes(){
    var box = $("aCodes"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">يحتاج ربط الخادم.</p></div>'; return; }
    box.innerHTML = '<div class="card"><h2>كود جديد</h2><p class="hint">الزبون يكتب الكود في صفحة الدفع. الكود ما يجتمع مع «هدية اعتذار»، وينحسب على المنتجات بس (مو التوصيل). الطلب الملغى ما ينحسب من الاستخدام.</p>' +
      '<form id="codeForm" class="codes-form"><label class="fld">الكود<input id="cdCode" required minlength="3" maxlength="24" dir="ltr" placeholder="مثلاً OHOD10" style="text-transform:uppercase"></label>' +
      '<label class="fld">نوع الخصم<select id="cdKind"><option value="amount">مبلغ ثابت (ريال)</option><option value="percent">نسبة ٪</option></select></label>' +
      '<label class="fld">قيمة الخصم<input id="cdValue" type="number" step="0.5" min="0.5" required inputmode="decimal"></label>' +
      '<label class="fld">أقصى خصم بالريال <small>(للنسبة، اختياري)</small><input id="cdCap" type="number" step="0.5" min="0" inputmode="decimal"></label>' +
      '<label class="fld">أقل مبلغ للمنتجات <small>(اختياري)</small><input id="cdMin" type="number" step="1" min="0" inputmode="decimal"></label>' +
      '<label class="fld">آخر يوم <small>(اختياري)</small><input id="cdUntil" type="date"></label>' +
      '<label class="fld">كم مرة لكل جوال <small>(٠ = بدون حد)</small><input id="cdPer" type="number" min="0" step="1" value="1"></label>' +
      '<label class="fld">عدد الاستخدامات الكلي <small>(٠ = بدون حد)</small><input id="cdMax" type="number" min="0" step="1" value="0"></label>' +
      '<label class="fld" style="grid-column:1/-1">ملاحظة لك <small>(اختياري، ما يشوفها الزبون)</small><input id="cdNote" maxlength="100"></label>' +
      '<div style="grid-column:1/-1"><button class="btn btn-brand" type="submit">احفظ الكود</button> <span class="status" id="cdStatus"></span></div></form></div>' +
      '<div class="card"><h2>الأكواد</h2><div id="codesBox"><p class="hint">جاري التحميل…</p></div></div>';
    var show = function(j){ var b = $("codesBox"); if (!b) return; if (!j.ok) { b.innerHTML = '<p class="status err">' + (j.code === "not_found" ? "حدّث خادم Cloudflare عشان تشتغل الأكواد." : "ما قدرنا نحمّل الأكواد (" + esc(j.code || "?") + ").") + '</p>'; return; } codesCache = j.codes || []; b.innerHTML = codesList(j); };
    var save = function(body, st){ return api("/admin/promo-save", Object.assign({ pin: adminPin }, body)).then(function(j){ if (st) { st.textContent = j.ok ? "انحفظ ✓" : ({ bad_code: "الكود لازم ٣ إلى ٢٤ حرف أو رقم بدون مسافات", bad_value: "قيمة الخصم غلط (النسبة حدها ٩٠٪، والمبلغ ٥٠٠)", forbidden: "ما عندك صلاحية" }[j.code] || "ما انحفظ (" + esc(j.code || "?") + ")"); st.className = "status" + (j.ok ? "" : " err"); } if (j.ok) show(j); return j; }); };
    api("/admin/promos", { pin: adminPin }).then(show);
    $("codeForm").onsubmit = function(e){ e.preventDefault(); var u = $("cdUntil").value;
      save({ code: $("cdCode").value, kind: $("cdKind").value, value: Number($("cdValue").value), cap: Number($("cdCap").value) || 0, min: Number($("cdMin").value) || 0, until: u ? Date.parse(u + "T23:59:59+03:00") : 0, perPhone: Number($("cdPer").value) || 0, maxUses: Number($("cdMax").value) || 0, note: $("cdNote").value, active: this.dataset.active !== "0" }, $("cdStatus")).then(function(j){ if (j.ok) { this.reset(); $("cdCode").readOnly = false; delete this.dataset.active; } }.bind(this)); };
    $("codesBox").onclick = function(e){ var t = e.target.closest("[data-ctog],[data-cdel],[data-cedit]"); if (!t) return;
      var c = codesCache.filter(function(x){ return x.code === (t.dataset.ctog || t.dataset.cdel || t.dataset.cedit); })[0]; if (!c) return;
      if (t.dataset.cedit) { // تعديل: نعبّي النموذج بقيم الكود، والحفظ يحدّث نفس الكود
        $("cdCode").value = c.code; $("cdCode").readOnly = true; $("cdKind").value = c.kind; $("cdValue").value = c.value; $("cdCap").value = c.cap || ""; $("cdMin").value = c.min || "";
        $("cdUntil").value = c.until ? new Date(c.until + 3 * 3600e3).toISOString().slice(0, 10) : ""; $("cdPer").value = c.perPhone; $("cdMax").value = c.maxUses; $("cdNote").value = c.note || "";
        $("codeForm").dataset.active = c.active ? "1" : "0"; $("cdStatus").textContent = "تعدّل الكود " + c.code + " · غيّر اللي تبغاه واضغط احفظ"; $("cdStatus").className = "status"; $("codeForm").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (t.dataset.cdel) { if (confirm("تحذف الكود " + c.code + "؟ الطلبات اللي استخدمته تبقى.")) save({ code: c.code, remove: true }); return; }
      save({ code: c.code, kind: c.kind, value: c.value, cap: c.cap, min: c.min, until: c.until, perPhone: c.perPhone, maxUses: c.maxUses, note: c.note, active: !c.active }); };
  }
  function renderCosts(){
    var box = $("aCosts"); if (!box) return;
    if (staffAuth) { box.innerHTML = '<div class="card"><p class="hint">التكاليف ومستشار العروض لصاحب المتجر بس.</p></div>'; return; }
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">يحتاج ربط الخادم.</p></div>'; return; }
    if (!costsState.opex) { box.innerHTML = '<div class="card"><p class="hint">جاري التحميل…</p></div>'; api("/admin/opex", { pin: adminPin }).then(function(j){ if (!j.ok) { box.innerHTML = '<div class="card"><p class="status err">' + (j.code === "not_found" ? "حدّث خادم Cloudflare عشان تشتغل هالصفحة." : "ما قدرنا نحمّل التكاليف (" + esc(j.code || "?") + ").") + '</p></div>'; return; } costsState.opex = j.opex || {}; costsState.fields = j.fields; loadAdvice(); }); return; }
    var o = costsState.opex, F = costsState.fields || [], miss = F.filter(function(f){ return typeof o[f.k] !== "number"; });
    var h = '<form class="card" id="opexForm"><h2>التكاليف التشغيلية والمصروفات</h2><p class="hint">عبّ كل البنود (حط ٠ إذا البند ما يخصك). الأرقام سرية، ما تطلع لأحد غيرك. مستشار العروض يشتغل بس بعد ما تعتمد التكاليف كاملة.</p>' +
      OPEX_GROUPS.map(function(g){ var fs = F.filter(function(f){ return f.g === g[0]; }); return '<fieldset class="opex-g"><legend>' + g[1] + '</legend><div class="fields">' + fs.map(function(f){ return '<label>' + esc(f.n) + '<input type="number" min="0" step="0.01" inputmode="decimal" data-opex="' + f.k + '" value="' + (typeof o[f.k] === "number" ? o[f.k] : "") + '"' + (typeof o[f.k] === "number" ? '' : ' placeholder="مطلوب"') + '></label>'; }).join("") + '</div></fieldset>'; }).join("") +
      '<label>كم مرة يرجع يطلب الزبون الجديد (تقريباً، اختياري)<input type="number" min="1" max="50" step="0.5" data-opex="repeatOrders" value="' + (o.repeatOrders || "") + '" placeholder="٣"></label>' +
      '<div class="actions"><button type="submit" class="btn btn-brand" value="confirm">احفظ واعتمد التكاليف</button><button type="submit" class="btn btn-soft" value="draft">احفظ بدون اعتماد</button><span class="status" id="opexMsg">' + (o.confirmed ? 'التكاليف معتمدة.' : miss.length ? 'ناقص ' + num(miss.length) + ' بند.' : 'محفوظة، تحتاج «اعتمد».') + '</span></div></form>';
    h += '<div id="advBox">' + adviceHTML() + '</div>';
    box.innerHTML = h;
    $("opexForm").onsubmit = function(e){ e.preventDefault(); var conf = e.submitter && e.submitter.value === "confirm", out = {};
      Array.prototype.forEach.call(this.querySelectorAll("[data-opex]"), function(i){ if (i.value !== "") out[i.dataset.opex] = Number(i.value); });
      var b = e.submitter; if (b) b.disabled = true; $("opexMsg").className = "status"; $("opexMsg").textContent = "جاري الحفظ…";
      api("/admin/opex-save", { pin: adminPin, opex: out, confirm: conf }).then(function(j){ if (b) b.disabled = false;
        if (!j.ok) { $("opexMsg").className = "status err"; $("opexMsg").textContent = j.code === "bad_opex" ? "فيه رقم غلط: لازم يكون موجب، والنسب من ٠ لـ ١٠٠." : "ما انحفظ (" + esc(j.code || "?") + ")."; return; }
        costsState.opex = j.opex; costsState.adv = null; $("opexMsg").className = "status"; $("opexMsg").textContent = j.opex.confirmed ? "انحفظت واعتمدت." : "انحفظت (بدون اعتماد)."; if (conf && j.missing.length) { renderCosts(); $("opexMsg").className = "status err"; $("opexMsg").textContent = "ما انعتمد: ناقص " + num(j.missing.length) + " بند. عبّها (ولو بصفر)."; return; } loadAdvice(); });
    };
  }
  function loadAdvice(){ costsState.adv = null; renderCostsLater(); api("/admin/offers-advice", { pin: adminPin }).then(function(j){ costsState.adv = j; renderCostsLater(); }); }
  function renderCostsLater(){ if (aTab === "costs") { var b = $("advBox"); if (b && costsState.opex) b.innerHTML = adviceHTML(); else renderCosts(); } }
  function adviceHTML(){
    var a = costsState.adv; if (!a) return '<div class="card"><p class="hint">جاري تحليل العروض…</p></div>';
    if (!a.ok) return '<div class="card"><p class="status err">ما قدرنا نحلل (' + esc(a.code || "?") + ').</p></div>';
    if (!a.ready) return '<div class="card"><h2>مستشار العروض</h2><p class="hint">' + (a.error === "no_costs" ? "حط «سعر الشراء» للمنتجات أول (من المنتجات أو ملف الكاشير)، عشان نعرف هوامشك." : a.missing && a.missing.length ? "عبّ التكاليف فوق كاملة واضغط «احفظ واعتمد» عشان يشتغل المستشار." : "اضغط «احفظ واعتمد التكاليف» عشان يشتغل المستشار.") + '</p></div>';
    var e = a.eco, r = function(v){ return num(Math.round(v * 100) / 100) + ' ر.س'; };
    var V = { safe: ['آمن', 'ok'], bait: ['مكلف لكن يجيب زباين', 'warn'], loss: ['خسارة', 'bad'] };
    var K = { deal: 'كل منتج بسعر موحد', daily: 'عرض اليوم', sale: 'خصم على المنتج' };
    var h = '<div class="card"><h2>صحة المحل قبل العروض</h2><div class="kpis">' +
      kpi('صافي كل طلب بعد كل المصروفات', r(e.net), e.net >= 0 ? 'ok' : 'bad') + kpi('صافي الشهر المتوقع', r(e.netMonthly), e.netMonthly >= 0 ? 'ok' : 'bad') +
      kpi('ربح الطلب قبل المصروفات الثابتة', r(e.contribution)) + kpi('نصيب الطلب من المصروفات الثابتة', r(e.fixedPerOrder)) +
      kpi('طلبات شهرية تغطي المصروفات', e.breakEvenOrders == null ? '—' : num(e.breakEvenOrders) + ' طلب') + kpi('ميزانية العروض الشهرية المقترحة', r(e.offersBudgetMonthly)) + '</div>' +
      '<details><summary>كيف حسبناها</summary><ul class="hint">' + a.assumptions.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '<li>المصروفات الثابتة ' + r(e.fixedMonthly) + ' شهرياً، والمتغيرة ' + r(e.varOrder) + ' لكل طلب.</li><li>أقصى خسارة نتحملها لجلب زبون جديد: ' + r(e.acquisitionBudget) + ' (ربح الطلب × ' + num(e.repeatOrders) + ' طلبات يرجع فيها).</li></ul></details>' +
      (a.warnings.length ? '<div class="adv-warn">' + a.warnings.map(function(w){ return '<p>' + esc(w) + '</p>'; }).join("") + '</div>' : '') + '</div>';
    var f = a.freeDelivery;
    if (f && f.minBasket) h += '<div class="card"><h2>التوصيل المجاني</h2><p>أقل سلة تغطي تكلفة التوصيل بدون رسوم: <b>' + r(f.minBasket) + '</b>. ' + (f.freeOver ? 'عندك الحين مجاني فوق <b>' + r(f.freeOver) + '</b>: ' + (f.safe ? '<span class="vd ok">آمن</span>' : '<span class="vd bad">يخسر</span>') : 'ما عندك توصيل مجاني.') + (f.suggested ? ' المقترح: مجاني فوق <b>' + r(f.suggested) + '</b>.' : '') + '</p></div>';
    h += '<div class="card"><h2>عروضك الحالية</h2>' + (a.current.length ? '<div class="adv-t">' + a.current.map(function(x){ return '<div class="adv-r"><b>' + esc(x.name) + '</b><span>' + K[x.kind] + ' · ' + r(x.price) + (x.regular && x.regular !== x.price ? ' <s>' + r(x.regular) + '</s>' : '') + '</span>' + (x.noCost ? '<span class="vd">بدون سعر شراء</span>' : '<span>صافي الحبة ' + r(x.unitNet) + '</span><span class="vd ' + V[x.verdict][1] + '">' + V[x.verdict][0] + '</span>') + '</div>'; }).join("") + '</div>' : '<p class="hint">ما فيه عروض شغالة.</p>') +
      (a.dealSummary ? '<p class="hint">عرض «كل منتج بـ ' + num(a.dealSummary.price) + '»: أسوأ طلب يخسر ' + r(a.dealSummary.worstLoss) + '، وربح سلة الحد الأدنى (' + r(a.dealSummary.minBasket) + ') ' + r(a.dealSummary.marginAtMin) + ' ' + (a.dealSummary.covered ? '<span class="vd ok">يغطي نفسه</span>' : '<span class="vd bad">ما يغطي</span>') + '</p>' : '') + '</div>';
    h += '<div class="card"><h2>عروض آمنة مقترحة</h2><p class="hint">منتجات تتحرك وهامشها يسمح بخصم وأنت رابح.</p>' + (a.safe.length ? '<div class="adv-t">' + a.safe.map(function(x){ return '<div class="adv-r"><b>' + esc(x.name) + '</b><span>' + r(x.price) + ' ← <b>' + r(x.offer) + '</b></span><span>صافي الحبة بعد العرض ' + r(x.unitNet) + '</span><button type="button" class="btn btn-soft sm" data-advapply="' + esc(x.id) + '" data-advprice="' + x.offer + '">طبّقه خصم</button></div>'; }).join("") + '</div>' : '<p class="hint">ما لقينا منتجات بهامش يسمح.</p>') + '</div>';
    h += '<div class="card"><h2>عرض قوي مكلف (يجيب زباين جدد)</h2><p class="hint">سعر تحت التعادل: تخسر فيه شوي عشان تجيب الزبون، والخسارة داخل ميزانية جلب الزبون. حط له حد للكمية لكل طلب.</p>' + (e.net < 0 ? '<p class="status err">ما ننصح بعروض مكلفة الحين: المحل ما غطى مصروفاته بعد.</p>' : '') + (a.strong.length ? '<div class="adv-t">' + a.strong.map(function(x){ return '<div class="adv-r"><b>' + esc(x.name) + '</b><span>' + r(x.price) + ' ← <b>' + r(x.offer) + '</b> (التعادل ' + r(x.breakEven) + ')</span><span>خسارة الحبة ' + r(-x.unitNet) + '</span><button type="button" class="btn btn-soft sm" data-advapply="' + esc(x.id) + '" data-advprice="' + x.offer + '">طبّقه خصم</button></div>'; }).join("") + '</div>' : '<p class="hint">ما فيه اقتراحات.</p>') + '</div>';
    return h;
  }
  function kpi(t, v, c){ return '<div class="kpi' + (c ? ' ' + c : '') + '"><span>' + t + '</span><b>' + v + '</b></div>'; }
  document.addEventListener("click", function(e){ var t = e.target.closest && e.target.closest("[data-advapply]"); if (!t || mode !== "admin") return;
    var p = dById(t.dataset.advapply), np = Number(t.dataset.advprice); if (!p || !(np > 0)) return;
    if (!confirm("تحط «" + p.name + "» بـ " + num(np) + " ر.س بدل " + num(p.price) + "؟ يطلع للزبون كخصم بعد ما تحفظ.")) return;
    if (!(Number(p.old) > Number(p.price))) p.old = p.price; p.price = np; markDirty(); t.disabled = true; t.textContent = "انطبّق، احفظ التغييرات"; });
  // طريقة البيع: حبة / كرتون / شدّة… تنكتب في «الوحدة» نفسها، فتطلع للزبون وفي السلة والطلب وعند المندوب بدون أي تغيير ثاني
  var UNIT_KINDS = ["حبة", "كرتون", "شدّة", "كيس", "علبة", "كيلو"];
  function unitParse(u){
    var m = /^(حبة|حبه|كرتون|شدّة|شدة|كيس|علبة|علبه|كيلو)(?:\s+(\d+)\s*(?:حبة|حبات|حبه|حبتين))?$/.exec(String(u || "").trim());
    if (!m) return { kind: String(u || "").trim() ? "other" : "حبة", n: 0 };
    var k = m[1].replace(/^حبه$/, "حبة").replace(/^شدة$/, "شدّة").replace(/^علبه$/, "علبة");
    return { kind: k, n: Number(m[2] || 0) };
  }
  function unitText(kind, n){
    if (kind === "حبة" || kind === "كيلو" || !(n > 1)) return kind;
    return kind + " " + (n === 2 ? "حبتين" : n + (n <= 10 ? " حبات" : " حبة"));
  }
  function unitFields(p){
    var u = unitParse(p.unit), packs = u.kind !== "حبة" && u.kind !== "كيلو" && u.kind !== "other";
    return '<label>طريقة البيع<select data-f="ukind">' + UNIT_KINDS.concat(["other"]).map(function(k){ return '<option value="' + k + '"' + (u.kind === k ? ' selected' : '') + '>' + (k === "other" ? "غيرها (اكتبها)" : k) + '</option>'; }).join("") + '</select></label>' +
      '<label data-upack' + (packs ? '' : ' hidden') + '>كم حبة فيها<input data-f="upack" type="number" min="0" max="999" step="1" inputmode="numeric" value="' + (u.n || "") + '" placeholder="مثلاً ٢٤"></label>' +
      '<label data-uother' + (u.kind === "other" ? '' : ' hidden') + '>الوحدة<input data-f="unit" value="' + esc(p.unit) + '" placeholder="مثلاً: كيس ٦ حبات"></label>';
  }
  // خيارات بيع إضافية للزبون (شدّة، كرتون…) بسعرها: الزبون يختار من صفحة المنتج، والمخزون ينخصم بعدد الحبات
  var PACK_KINDS = ["شدّة", "كرتون", "كيس", "علبة"];
  function packsFields(p){
    var L = Array.isArray(p.packs) ? p.packs : [];
    return '<div class="wide pk-ed"><b>خيارات بيع إضافية للزبون</b> <small class="hint">مثلاً: شدّة ٦ حبات أو كرتون ٢٤ حبة، ولكل خيار سعره. المخزون ينخصم بالحبات.</small>' +
      L.map(function(x, i){ var u = unitParse(x.u), k = u.kind === "other" ? "كرتون" : u.kind;
        return '<div class="pk-row" data-pk="' + i + '"><select data-pf="kind" aria-label="الوحدة">' + PACK_KINDS.map(function(o){ return '<option' + (o === k ? ' selected' : '') + '>' + o + '</option>'; }).join("") + '</select>' +
          '<label>كم حبة<input data-pf="n" type="number" min="1" max="999" step="1" inputmode="numeric" value="' + esc(x.n || "") + '"></label>' +
          '<label>السعر<input data-pf="price" type="number" min="0" step="0.25" inputmode="decimal" value="' + esc(x.price || "") + '"></label>' +
          '<button type="button" class="del" data-pkdel="' + i + '">شيل</button></div>'; }).join("") +
      (L.length < 5 ? '<button type="button" class="btn btn-soft sm" data-pkadd="' + p.id + '">+ أضف خيار (شدّة / كرتون)</button>' : '') + '</div>';
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest && e.target.closest("[data-pkadd],[data-pkdel]"); if (!t) return;
    var row = t.closest("[data-row]"), p = row && dById(row.dataset.row); if (!p) return;
    if (t.dataset.pkadd != null) { p.packs = (p.packs || []).concat([{ u: "كرتون", n: 0, price: 0 }]); }
    else { p.packs.splice(Number(t.dataset.pkdel), 1); if (!p.packs.length) delete p.packs; }
    markDirty(); renderAProds();
  });
  // صف المنتج الخفيف: الصورة والاسم والسعر والتوفر، و«تعديل» يفتح كل التفاصيل
  function a2Mini(p){
    var q = qtyOf(p.id), sale = p.old && p.old > p.price;
    return '<div class="arow a2-mini' + (p.stock ? '' : ' off') + '" data-row="' + p.id + '">' +
      '<button class="imgbtn" type="button" data-pick="prod:' + p.id + '" aria-label="تغيير صورة ' + esc(p.name) + '">' + imgTag(p.img, "") + '</button>' +
      '<button type="button" class="a2-pn" data-a2open="' + p.id + '"><b>' + esc(p.name) + '</b><small>' + esc(p.unit || "") + (sale ? ' · عرض، كان ' + num(p.old) : '') + (q != null ? ' · المخزون ' + num(q) : '') + (p.stock ? '' : ' · مو متوفر') + '</small></button>' +
      '<label class="a2-price"><span>السعر</span><input data-f="price" type="number" min="0" step="0.25" inputmode="decimal" value="' + esc(p.price) + '" aria-label="سعر ' + esc(p.name) + '"></label>' +
      '<label class="a2-sw" title="متوفر"><input type="checkbox" data-f="stock"' + (p.stock ? ' checked' : '') + ' aria-label="' + esc(p.name) + ' متوفر"><span></span></label>' +
      '<button type="button" class="a2-edit" data-a2open="' + p.id + '">تعديل</button></div>';
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest && e.target.closest("[data-a2open]"); if (!t) return;
    var id = t.dataset.a2open || null; aFilter.open = id; renderAProds();
    var r = id && document.querySelector('#aProds [data-row="' + id + '"]'); if (r) r.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  function renderAProds(){
    var words = normAr(aFilter.q).split(/\s+/).filter(Boolean), shown = aFilter.show || 40;
    var offF = OFF_F[aFilter.cat] ? aFilter.cat : "";
    var all = draft.products.filter(function(p){ if (offF) { var ok = offKind(p); if (!ok || (offF !== "__offers" && "__" + ok !== offF)) return false; } else if (aFilter.cat !== "all" && p.cat !== aFilter.cat) return false; if (!words.length) return true; var h = normAr(p.name + " " + (p.bc || "")); return words.every(function(w){ return h.indexOf(w) > -1; }); });
    var list = all.slice(0, shown);
    var offHint = offF ? '<p class="hint" style="background:#FFF4EA;border-radius:12px;padding:10px 12px">🔥 <b>' + num(all.length) + ' منتج عليه عرض</b>. الخصم: غيّر «السعر» و«قبل الخصم» (امسح «قبل الخصم» عشان تشيل العرض). عروض الكمية من «خيارات بيع إضافية»، وعروض «اختر من أي نوع» من تبويب العروض.</p>' : '';
    $("aProds").innerHTML = offHint + (all.length > 40 ? '<p class="hint">' + num(all.length) + ' منتج' + (all.length > shown ? '، معروض أول ' + num(shown) + '. استخدم البحث أو القسم عشان توصل للمنتج بسرعة.' : '') + '</p>' : '') + (list.length ? list.map(function(p){
      if (aFilter.open !== p.id) return a2Mini(p);
      return '<div class="a2-full arow' + (p.stock ? '' : ' off') + '" data-row="' + p.id + '">' +
        '<div class="a2-fullhead"><b>تعديل المنتج</b><button type="button" class="btn btn-soft sm" data-a2open="">تم، سكّر</button></div>' +
        '<button class="imgbtn" type="button" data-pick="prod:' + p.id + '" aria-label="تغيير صورة ' + esc(p.name) + '">' + imgTag(p.img, "") + '</button>' +
        '<label>الاسم<input data-f="name" value="' + esc(p.name) + '"></label>' +
        '<label>الاسم بالإنجليزي<input data-f="name_en" value="' + esc(p.name_en || "") + '" dir="ltr"></label>' +
        unitFields(p) + packsFields(p) +
        '<label>الوحدة بالإنجليزي<input data-f="unit_en" value="' + esc(p.unit_en || "") + '" dir="ltr"></label>' +
        '<label>الباركود <small>(للكاشير، امسحه هنا)</small><input data-f="bc" value="' + esc(p.bc || "") + '" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="اختياري"></label>' +
        '<label>السعر<input data-f="price" type="number" min="0" step="0.25" inputmode="decimal" value="' + esc(p.price) + '"></label>' +
        '<label>قبل الخصم<input data-f="old" type="number" min="0" step="0.25" inputmode="decimal" value="' + esc(p.old || "") + '" placeholder="—"></label>' +
        '<label class="wide">القسم<select data-f="cat">' + catOptions(p.cat) + '</select></label>' +
        '<label>الكمية بالمخزون<input data-f="qty" type="number" min="0" step="1" inputmode="numeric" value="' + (qtyOf(p.id) == null ? '' : qtyOf(p.id)) + '" placeholder="' + (STK_OK ? 'بدون عدّ' : 'يحتاج قاعدة الطلبات') + '"' + (STK_OK ? '' : ' disabled') + (qtyOf(p.id) != null && qtyOf(p.id) <= (draft.store.lowAt == null ? 3 : draft.store.lowAt) ? ' class="lowq"' : '') + '></label>' +
        '<label>سعر الشراء' + marginTag(p) + '<input data-f="cost" type="number" min="0" step="0.05" inputmode="decimal" value="' + (costOf(p.id) == null ? '' : costOf(p.id)) + '" placeholder="' + (STK_OK ? 'سري، ما يشوفه الزبون' : 'يحتاج قاعدة الطلبات') + '"' + (STK_OK ? '' : ' disabled') + '></label>' +
        '<label class="wide">مكانه في المحل <small>(يطلع للمندوب)</small><input data-f="loc" value="' + esc(p.loc || "") + '" placeholder="' + esc((catOf(p.cat) || {}).loc || "مثال: ثلاجة الألبان · الممر ٢ · الرف الثالث") + '"></label>' +
        '<label class="wide">تأكد قبل لا تاخذه <small>(افصل بفاصلة)</small><input data-f="checks" value="' + esc(p.checks || "") + '" placeholder="مثال: العلبة صفراء، ٢٠٠ جرام مو الكبيرة، شيّك تاريخ الانتهاء"></label>' +
        '<label>الحد لكل طلب<input data-f="max" type="number" min="0" step="1" inputmode="numeric" value="' + esc(p.max || "") + '" placeholder="بدون حد"></label>' +
        '<div class="tools wide"><label class="chk"><input type="checkbox" data-f="stock"' + (p.stock ? ' checked' : '') + '>متوفر</label>' +
        '<input data-f="badge" value="' + esc(p.badge || "") + '" placeholder="شارة: يُخبز يوميًا" aria-label="شارة المنتج" style="width:150px">' +
        '<button class="btn btn-soft sm" type="button" data-sugg="' + p.id + '">المقترحات' + (p.sugg && p.sugg.length ? ' (' + p.sugg.length + ')' : '') + '</button>' +
        mvBtns('prod', p.id) + '<button class="del" type="button" data-del-prod="' + p.id + '">حذف</button></div></div>';
    }).join("") : '<p class="empty">ما فيه منتجات بهذا البحث.</p>') + (all.length > shown ? '<button type="button" class="btn btn-soft" id="aMore" style="justify-self:center">عرض ٤٠ زيادة (باقي ' + num(all.length - shown) + ')</button>' : '');
    var mb = $("aMore"); if (mb) mb.onclick = function(){ aFilter.show = shown + 40; renderAProds(); };
  }
  /* ----- استيراد ملف أصناف الكاشير (Excel): يختار الأهم، يوزعهم على الأقسام، والتكلفة والمخزون تنحفظ سرية ----- */
  var imp = { plan: null, file: "", busy: false, msg: "" };
  function loadScript(src){ return new Promise(function(ok, no){ var x = document.createElement("script"); x.src = src; x.onload = ok; x.onerror = no; document.head.appendChild(x); }); }
  function importLibs(){
    var a = window.XLSX ? Promise.resolve() : loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js").catch(function(){ return loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"); });
    var b = window.catalogPlan ? Promise.resolve() : loadScript("tools/catalog.js?v=6");
    return Promise.all([a, b]);
  }
  function impCatName(id){ var c = draft.cats.filter(function(x){ return x.id === id; })[0]; if (c) return c.name; var r = (window.CATALOG_RULES || []).filter(function(x){ return x[0] === id; })[0]; return r ? r[1] : "المنزل والمنوعات"; }
  function impOpts(){ var st = draft.store || S; return { limit: Number(S.importLimit) || 3000, cats: draft.cats, must: Array.isArray(st.importMust) ? st.importMust : [], zero: !!st.importZero }; }
  function renderImport(){
    var box = $("aImport"); if (!box) return;
    var P = imp.plan, lim = Number(S.importLimit) || 3000;
    var h = '<h2>استيراد الأصناف من ملف الكاشير</h2><p class="hint">ارفع ملف الإكسل حق برنامج الكاشير (رقم الصنف، الاسم، الوحدة، الكمية، التكلفة، وسعر البيع). نختار الأهم على حسب الكمية وقيمة المخزون، ونوزعهم على الأقسام من أسمائهم. التكلفة والكمية تنحفظ سرية، ما يشوفها الزبون. رفع الملف مرة ثانية يحدّث المخزون والتكلفة والأسعار للأصناف الموجودة.</p>' +
      '<div class="adm-tools"><label class="btn btn-ink" style="cursor:pointer;color:#fff;flex:0 0 auto">' + (imp.busy ? 'جاري القراءة…' : 'اختر ملف الإكسل') + '<input type="file" id="impFile" accept=".xlsx,.xls,.csv" hidden></label><label>عدد المنتجات في الموقع<input id="impLimit" type="number" min="50" max="12000" step="50" value="' + lim + '" style="width:110px"></label>' +
      '<label>كلمات لازم تنضاف (افصل بفاصلة)<input id="impMust" type="text" value="' + esc(impOpts().must.join("، ")) + '" placeholder="ليز، بطاطس، تسالي" style="min-width:230px"></label>' +
      '<label style="display:flex;gap:8px;align-items:center"><input id="impZero" type="checkbox"' + (impOpts().zero ? ' checked' : '') + '> أضف حتى اللي مخزونه صفر (يطلع «نفد» للزبون)</label></div>' +
      (imp.msg ? '<p class="status' + (imp.err ? ' err' : '') + '">' + imp.msg + '</p>' : '');
    if (P) {
      var sk = Object.keys(P.skipped).map(function(k){ return '<li>' + esc(k) + ': <b>' + num(P.skipped[k]) + '</b></li>'; }).join("");
      var withPrice = P.pick.length - P.noPrice;
      h += '<div class="imp-sum"><p>في الملف <b>' + num(P.rows) + '</b> صنف. يصلح للموقع <b>' + num(P.eligible) + '</b>' + (sk ? '، وانشال:</p><ul>' + sk + '</ul>' : '.</p>') +
        '<p>الموقع فيه الحين ' + num(draft.products.length) + ' منتج، والحد ' + num(P.limit) + '، فاخترنا <b>' + num(P.pick.length) + '</b> صنف جديد (الأهم فالأهم):</p>' +
        '<div class="imp-cats">' + Object.keys(P.perCat).sort(function(a, b){ return P.perCat[b] - P.perCat[a]; }).map(function(id){ return '<span>' + esc(impCatName(id)) + ' <b>' + num(P.perCat[id]) + '</b></span>'; }).join("") + '</div>' +
        (P.needCats.length ? '<p class="hint">بينضاف قسم جديد: ' + P.needCats.map(function(c){ return esc(c.name); }).join("، ") + '.</p>' : '') +
        (P.must && Object.keys(P.must).length ? '<p>الكلمات المطلوبة: ' + Object.keys(P.must).map(function(w){ return esc(w) + ' <b>' + num(P.must[w]) + '</b>' + (P.must[w] ? '' : ' (ما لقينا شي)'); }).join('، ') + '. دخلت أول بغض النظر عن ترتيبها.</p>' : '') +
        (P.update.length ? '<p>و<b>' + num(P.update.length) + '</b> منتج موجود من قبل بيتحدّث مخزونه وتكلفته' + ' (وسعره لو تغيّر).</p>' : '') +
        (P.noPrice ? '<p class="status err">' + num(P.noPrice) + ' صنف من المختارة ما لها سعر بيع في الملف، فما راح تنضاف. نزّل القائمة تحت، عبّ عمود «سعر البيع» (وتقدر تغيّر «القسم»)، وارفعها هنا.</p>' : '') +
        '<div class="actions"><button type="button" class="btn btn-brand" id="impApply"' + (withPrice || P.update.length ? '' : ' disabled') + '>اعتمد: أضف ' + num(withPrice) + (P.update.length ? ' وحدّث ' + num(P.update.length) : '') + '</button><button type="button" class="btn btn-soft" id="impSheet">نزّل قائمة المختارة (Excel)</button><button type="button" class="btn btn-ghost" id="impCancel">إلغاء</button></div></div>';
    }
    box.innerHTML = h;
    $("impFile").onchange = function(){ var f = this.files && this.files[0]; if (f) importRead(f); };
    var impReplan = function(){ if (imp.rows) { imp.plan = catalogPlan(imp.rows, draft.products, impOpts()); renderImport(); } };
    $("impMust").onchange = function(){ var w = this.value.split(/[,،\n]+/).map(function(x){ return x.trim(); }).filter(Boolean).slice(0, 30); S.importMust = w; if (draft.store) draft.store.importMust = w; impReplan(); };
    $("impZero").onchange = function(){ S.importZero = this.checked; if (draft.store) draft.store.importZero = this.checked; impReplan(); };
    $("impLimit").onchange = function(){ var v = Math.max(50, Math.min(12000, Math.round(Number(this.value) || 3000))); S.importLimit = v; if (draft.store) draft.store.importLimit = v; impReplan(); };
    if (!P) return;
    $("impCancel").onclick = function(){ imp.plan = null; imp.rows = null; imp.msg = ""; renderImport(); };
    $("impSheet").onclick = function(){
      var head = ["رقم الصنف", "اسم الصنف", "الوحدة", "الكمية المتوفرة", "التكلفة", "القسم", "سعر البيع"];
      var rows = P.pick.map(function(x){ return [x.code, x.name, x.unit, x.qty, x.cost, impCatName(x.catId), x.price > 0 ? x.price : null]; });
      var ws = XLSX.utils.aoa_to_sheet([head].concat(rows)); ws["!cols"] = [{ wch: 16 }, { wch: 46 }, { wch: 8 }, { wch: 10 }, { wch: 9 }, { wch: 18 }, { wch: 10 }];
      var wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, "الأصناف"); XLSX.writeFile(wb, "أصناف-الموقع-عبّ-سعر-البيع.xlsx");
    };
    $("impApply").onclick = function(){
      var ap = catalogApply(P, draft.products);
      P.needCats.forEach(function(c){ if (!draft.cats.some(function(x){ return x.id === c.id; })) draft.cats.push(Object.assign({ img: "" }, c)); });
      var mcat = draft.cats.filter(function(x){ return x.id === "misc"; })[0]; if (mcat && !Array.isArray(mcat.subs) && window.CATALOG_SUBS && ap.added.some(function(p){ return p.sub; })) mcat.subs = CATALOG_SUBS.slice();
      draft.products = draft.products.concat(ap.added);
      Object.keys(ap.stock).forEach(function(id){ stockEdit[id] = ap.stock[id]; });
      Object.keys(ap.costs).forEach(function(id){ costEdit[id] = ap.costs[id]; });
      imp.plan = null; imp.rows = null; imp.err = false;
      imp.msg = 'انضاف ' + num(ap.added.length) + ' منتج' + (P.update.length ? ' وتحدّث ' + num(P.update.length) : '') + (ap.priced ? ' (تغيّر سعر ' + num(ap.priced) + ')' : '') + '. راجعهم، وبعدين اضغط «احفظ» عشان ينزلون للموقع.';
      markDirty(); renderImport(); aFilter.show = 0; renderAProds();
    };
  }
  function importRead(f){
    imp.busy = true; imp.msg = ""; imp.err = false; imp.plan = null; renderImport();
    importLibs().then(function(){ return f.arrayBuffer(); }).then(function(buf){
      var wb = XLSX.read(buf, { type: "array", cellDates: true }), aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
      var r = catalogRows(aoa); imp.busy = false;
      if (r.error) { imp.err = true; imp.msg = "ما لقينا سطر العناوين في الملف. لازم يكون فيه عمود «اسم الصنف» وعمود «رقم الصنف» أو «الكمية»."; renderImport(); return; }
      imp.rows = r.rows; imp.file = f.name;
      imp.plan = catalogPlan(r.rows, draft.products, impOpts());
      if (r.cols.indexOf("price") < 0) imp.msg = "الملف ما فيه عمود «سعر البيع»: تقدر تشوف وش بينضاف، بس الإضافة تحتاج السعر.";
      renderImport();
    }).catch(function(){ imp.busy = false; imp.err = true; imp.msg = "ما قدرنا نقرأ الملف (تأكد إنه ملف Excel، وإن النت شغال)."; renderImport(); });
  }
  function pOpts(sel){ return draft.cats.map(function(c){ var ps = draft.products.filter(function(p){ return p.cat === c.id; }); if (!ps.length) return ""; return '<optgroup label="' + esc(c.name) + '">' + ps.map(function(p){ return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + ' · ' + num(p.price) + ' ر.س</option>'; }).join("") + '</optgroup>'; }).join(""); }
  // قائمة منتجات بالآلاف داخل كل اختيار تثقّل الصفحة: نحط المنتج المختار بس، والقائمة الكاملة تنبني أول ما تفتحها
  function pOptsLazy(sel){ var p = dById(sel); return '<option value="' + esc(sel || "") + '" selected>' + (p ? esc(p.name) + ' · ' + num(p.price) + ' ر.س' : '—') + '</option>'; }
  ["mousedown", "focusin", "touchstart", "keydown"].forEach(function(ev){ document.addEventListener(ev, function(e){ var t = e.target && e.target.closest && e.target.closest("select[data-lazyp]"); if (!t) return; t.removeAttribute("data-lazyp"); t.innerHTML = pOpts(t.value); }, true); });
  var dealQ = "";
  function dealResults(){ var box = $("dealRes"); if (!box) return; var st = draft.store, words = normAr(dealQ).split(/\s+/).filter(Boolean);
    if (!words.length) { box.innerHTML = ""; return; }
    var ids = (st.deal95 && st.deal95.ids) || [], out = [];
    for (var i = 0; i < draft.products.length && out.length < 24; i++) { var p = draft.products[i], h = normAr(p.name + " " + (p.bc || "")); if (ids.indexOf(p.id) < 0 && words.every(function(w){ return h.indexOf(w) > -1; })) out.push(p); }
    box.innerHTML = out.length ? out.map(function(p){ return '<button type="button" class="chip" data-dealtoggle="' + p.id + '" aria-pressed="false">' + imgTag(p.img, "") + esc(p.name) + '</button>'; }).join("") : '<span class="hint">ما فيه منتج بهالاسم.</span>';
  }
  document.addEventListener("input", function(e){ if (e.target.id === "dealQ") { dealQ = e.target.value; dealResults(); } if (e.target.id === "prPages") { PR.pages = asciiDigits(e.target.value).replace(/\D/g, "").slice(0, 5); var sm = $("prSum"); if (sm) sm.innerHTML = printSumHTML(); } });
  // تبويب «العروض»: كل المنتجات اللي عليها عرض في مكان واحد (طلب المالك ١٤ نوفمبر ٢٠٢٦)
  var offTab = "";
  function renderOffProds(){
    var box = $("aOffProds"); if (!box) return;
    if (!$("offCss")) { var cs = document.createElement("style"); cs.id = "offCss"; cs.textContent = ".offlist{display:grid;gap:8px}.offrow{display:grid;grid-template-columns:48px 1fr auto;grid-template-areas:'im t pr' 'im bt bt';gap:4px 10px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:14px;background:#fff}.offrow.off{opacity:.55}.offrow .im{grid-area:im;width:48px;height:48px;border-radius:10px;overflow:hidden;background:var(--tile)}.offrow .im img{width:100%;height:100%;object-fit:contain}.offrow .t{grid-area:t;display:grid;min-width:0}.offrow .nm{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.offrow .t small{color:var(--muted)}.offrow .pr{grid-area:pr;text-align:end;font-size:13.5px}.offrow .pr b{color:var(--sale,#F2335B)}.offrow .pr s{color:var(--muted);font-size:12px}.offrow .bt{grid-area:bt;display:flex;gap:6px;justify-content:flex-end}"; document.head.appendChild(cs); }
    var all = draft.products.filter(function(p){ return offKind(p); }), lab = { sale: "خصم", qty: "عرض كمية", grp: "اختر من أي نوع" };
    var cnt = { "": all.length, sale: 0, qty: 0, grp: 0 }; all.forEach(function(p){ cnt[offKind(p)]++; });
    var list = all.filter(function(p){ return !offTab || offKind(p) === offTab; });
    var line = function(p){ var k = offKind(p), pk = k === "qty" ? (p.packs || []).filter(function(x){ return Number(x.n) > 1 && Number(x.price) > 0; })[0] : null, g = k === "grp" ? (draft.store.groups || []).filter(function(x){ return (x.ids || []).indexOf(p.id) > -1; })[0] : null;
      var price = k === "sale" ? '<b>' + num(p.price) + '</b> <s>' + num(p.old) + '</s>' : pk ? '<b>' + num(pk.n) + ' بـ ' + num(pk.price) + '</b> <s>' + num(pk.n * p.price) + '</s>' : g ? '<b>' + num(g.n) + ' بـ ' + num(g.price) + '</b> <small>(' + esc(g.name || "") + ')</small>' : '';
      return '<div class="offrow' + (p.stock === false ? ' off' : '') + '"><span class="im">' + imgTag(p.img, "") + '</span><span class="t"><b class="nm">' + esc(p.name) + '</b><small>' + lab[k] + (p.stock === false ? ' · نفد' : '') + '</small></span><span class="pr">' + price + '</span>' +
        '<span class="bt"><button type="button" class="btn btn-soft sm" data-offedit="' + esc(p.id) + '">عدّل</button>' + (k === "sale" ? '<button type="button" class="btn btn-soft sm" data-offrm="' + esc(p.id) + '">شيل الخصم</button>' : '') + '</span></div>'; };
    var tab = function(id, t){ return '<button type="button" class="chip" data-offtab="' + id + '" aria-pressed="' + (offTab === id) + '">' + t + ' (' + num(cnt[id]) + ')</button>'; };
    box.innerHTML = '<h2>🔥 منتجات العروض <small style="font-weight:600;color:var(--muted)">' + num(all.length) + ' منتج</small></h2><p class="hint">كل منتج عليه عرض. «عدّل» يفتحه في المنتجات، و«شيل الخصم» يرجّعه لسعره العادي (بعدها اضغط «حفظ تغييرات المتجر»).</p>' +
      '<div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + tab("", "الكل") + tab("sale", "خصم") + tab("qty", "عرض كمية") + tab("grp", "اختر من أي نوع") + '</div>' +
      (list.length ? '<div class="offlist">' + list.map(line).join("") + '</div>' : '<p class="empty">ما فيه منتجات بهالنوع.</p>');
  }
  document.addEventListener("click", function(e){
    var t;
    if ((t = e.target.closest("[data-offtab]"))) { offTab = t.dataset.offtab; renderOffProds(); return; }
    if ((t = e.target.closest("[data-offrm]"))) { var p = dById(t.dataset.offrm); if (p) { p.price = Number(p.old) || p.price; delete p.old; markDirty(); renderOffProds(); renderAFilter(); renderAProds(); } return; }
    if ((t = e.target.closest("[data-offedit]"))) { var q = dById(t.dataset.offedit); if (q) { aFilter.q = q.name; aFilter.cat = "all"; aFilter.show = 0; showTab("prods"); $("aQ").value = q.name; renderAFilter(); renderAProds(); } return; }
  });
  function renderPromos(){
    var st = draft.store;
    st.deal95 = st.deal95 || { on: false, min: 250, price: 0.95, limit: 1, ids: [] };
    st.daily = st.daily || { on: false, limit: 2, list: [] };
    var dl = st.deal95, dy = st.daily;
    var todayIdx = (function(){ var l = dy.list.filter(function(x){ var p = dById(x.id); return p && p.stock && x.price > 0; }); if (!l.length) return null; var d = new Date(); return l[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % l.length]; })();
    var todayP = todayIdx && dById(todayIdx.id);
    $("aPromos").innerHTML = '<h2>العروض</h2>' +
      '<div class="pbox"><div class="sec-head" style="margin:0"><b>عروض السعر الرمزي (مثل ٩٥ هللة)</b><label class="chk"><input type="checkbox" data-promo="dl.on"' + (dl.on ? ' checked' : '') + '>مفعّل</label></div>' +
      '<p class="hint">منتجات تنباع بسعر رمزي، وتنفتح للزبون بس لما تتعدى سلته المبلغ اللي تحدده.</p>' +
      '<div class="fields"><label>تنفتح فوق (ريال)<input type="number" min="0" step="1" inputmode="decimal" data-promo="dl.min" value="' + esc(dl.min) + '"></label>' +
      '<label>سعر المنتج في العرض (ريال)<input type="number" min="0" step="0.05" inputmode="decimal" data-promo="dl.price" value="' + esc(dl.price) + '"></label>' +
      '<label>الحد من كل منتج (٠ = بدون حد)<input type="number" min="0" step="1" inputmode="numeric" data-promo="dl.limit" value="' + esc(dl.limit) + '"></label></div>' +
      '<b style="font-size:.85rem">منتجات العرض (' + num(dl.ids.length) + ')</b><div class="pick">' + (dl.ids.length ? dl.ids.map(dById).filter(Boolean).map(function(p){ return '<button type="button" class="chip" data-dealtoggle="' + p.id + '" aria-pressed="true">' + imgTag(p.img, "") + esc(p.name) + '</button>'; }).join("") : '<span class="hint">ما اخترت منتجات للحين.</span>') + '</div>' +
      '<input class="search" id="dealQ" type="search" placeholder="ابحث عن منتج تضيفه للعرض…" value="' + esc(dealQ) + '" aria-label="بحث عن منتج للعرض" style="margin-top:8px"><div class="pick" id="dealRes"></div></div>' +
      '<div class="pbox"><div class="sec-head" style="margin:0"><b>عرض اليوم</b><label class="chk"><input type="checkbox" data-promo="dy.on"' + (dy.on ? ' checked' : '') + '>مفعّل</label></div>' +
      '<p class="hint">حط قائمة منتجات بأسعار العرض. كل يوم يطلع واحد منها بالترتيب، ويتغير لحاله الساعة ١٢ بالليل.' + (todayP ? ' عرض اليوم الحين: <b>' + esc(todayP.name) + '</b> بـ ' + num(todayIdx.price) + ' ر.س.' : '') + '</p>' +
      '<div class="fields"><label>الحد لكل طلب (٠ = بدون حد)<input type="number" min="0" step="1" inputmode="numeric" data-promo="dy.limit" value="' + esc(dy.limit) + '"></label></div>' +
      '<div class="alist">' + dy.list.map(function(x, i){ var p = dById(x.id); return '<div class="drow"><span class="dn">' + (i + 1) + '</span><label>المنتج<select data-daily="' + i + '" data-k="id" data-lazyp="1">' + pOptsLazy(x.id) + '</select></label><label>سعر العرض' + (p ? ' (الأصلي ' + num(p.price) + ')' : '') + '<input type="number" min="0" step="0.25" inputmode="decimal" data-daily="' + i + '" data-k="price" value="' + esc(x.price) + '"></label><button class="del" type="button" data-dailydel="' + i + '">حذف</button></div>'; }).join("") + '</div>' +
      '<button class="btn btn-soft" type="button" id="addDaily" style="justify-self:start">+ أضف يوم</button></div>';
  }
  document.addEventListener("input", onPromoInput);
  document.addEventListener("change", onPromoInput);
  function onPromoInput(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target, st = draft.store;
    if (t.dataset.promo) { var k = t.dataset.promo.split("."), o = k[0] === "dl" ? st.deal95 : st.daily;
      o[k[1]] = t.type === "checkbox" ? t.checked : Number(t.value || 0); markDirty(); return; }
    if (t.dataset.daily) { var x = st.daily.list[Number(t.dataset.daily)]; if (!x) return;
      x[t.dataset.k] = t.dataset.k === "price" ? Number(t.value || 0) : t.value; markDirty(); if (e.type === "change") renderPromos(); }
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t, st = draft.store;
    if ((t = e.target.closest("[data-dealtoggle]"))) { var id = t.dataset.dealtoggle, ids = st.deal95.ids, i = ids.indexOf(id);
      if (i > -1) ids.splice(i, 1); else ids.push(id); markDirty(); renderPromos(); dealResults(); return; }
    if ((t = e.target.closest("[data-dailydel]"))) { st.daily.list.splice(Number(t.dataset.dailydel), 1); markDirty(); renderPromos(); return; }
    if (e.target.closest("#addDaily")) { var p = draft.products[0]; st.daily.list.push({ id: p.id, price: Math.round(p.price * 0.8 * 4) / 4 }); markDirty(); renderPromos(); }
  });
  function dById(id){ for (var i=0;i<draft.products.length;i++) if (draft.products[i].id === id) return draft.products[i]; return null; }
  function onAdminInput(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target;
    if (t.dataset.catName) { draft.cats.forEach(function(c){ if (c.id === t.dataset.catName) c.name = t.value; }); markDirty(); return; }
    if (t.dataset.catSoon) { draft.cats.forEach(function(c){ if (c.id === t.dataset.catSoon) { if (t.checked) c.soon = true; else delete c.soon; } }); markDirty(); return; }
    if (t.dataset.catLoc) { draft.cats.forEach(function(c){ if (c.id === t.dataset.catLoc) { if (t.value.trim()) c.loc = t.value; else delete c.loc; } }); markDirty(); return; }
    if (t.dataset.catNameEn) { draft.cats.forEach(function(c){ if (c.id === t.dataset.catNameEn) { if (t.value.trim()) c.name_en = t.value; else delete c.name_en; } }); markDirty(); return; }
    var row = t.closest("[data-row]"); if (!row || !(t.dataset.f || t.dataset.pf)) return;
    var p = dById(row.dataset.row), f = t.dataset.f;
    if (f === "stock") { p.stock = t.checked; row.classList.toggle("off", !t.checked); }
    else if (f === "price") p.price = Number(t.value || 0);
    else if (f === "old") { var v = Number(t.value || 0); if (v) p.old = v; else delete p.old; }
    else if (f === "cost") { costEdit[p.id] = t.value === "" ? null : Math.max(0, Number(t.value) || 0); var mt = row.querySelector(".mtag"); if (mt) mt.outerHTML = marginTag(p); else { var lb = t.closest("label"); if (lb) lb.insertAdjacentHTML("afterbegin", ""); } }
    else if (f === "qty") { stockEdit[p.id] = t.value === "" ? null : Math.max(0, Math.floor(Number(t.value) || 0)); }
    else if (f === "loc" || f === "checks") { if (t.value.trim()) p[f] = t.value; else delete p[f]; }
    else if (f === "max") { var mx = Math.floor(Number(t.value || 0)); if (mx > 0) p.max = mx; else delete p.max; }
    else if (f === "badge") { if (t.value.trim()) p.badge = t.value.trim(); else delete p.badge; }
    else if (f === "name_en" || f === "unit_en") { if (t.value.trim()) p[f] = t.value; else delete p[f]; }
    else if (f === "bc") { var bv = t.value.replace(/[^\w,، -]/g, "").trim(); if (bv) p.bc = bv; else delete p.bc; }
    else if (t.dataset.pf) {
      var pr = t.closest("[data-pk]"), i = Number(pr.dataset.pk), x = p.packs && p.packs[i]; if (!x) return;
      var kd = pr.querySelector('[data-pf="kind"]').value, nn = Math.floor(Number(pr.querySelector('[data-pf="n"]').value) || 0);
      x.n = nn; x.price = Math.max(0, Number(pr.querySelector('[data-pf="price"]').value) || 0); x.u = unitText(kd, nn);
    }
    else if (f === "ukind" || f === "upack") {
      var kind = row.querySelector('[data-f="ukind"]').value, n = Math.floor(Number(row.querySelector('[data-f="upack"]').value) || 0);
      var packs = kind !== "حبة" && kind !== "كيلو" && kind !== "other";
      row.querySelector("[data-upack]").hidden = !packs; row.querySelector("[data-uother]").hidden = kind !== "other";
      if (kind !== "other") { p.unit = unitText(kind, packs ? n : 0); row.querySelector('[data-f="unit"]').value = p.unit; }
    }
    else p[f] = t.value;
    markDirty();
    if (f === "cat") renderACats();
  }
  document.addEventListener("input", onAdminInput);
  document.addEventListener("change", function(e){ if (e.target.dataset && (e.target.dataset.f === "cat" || e.target.dataset.f === "stock" || e.target.dataset.f === "ukind")) onAdminInput(e); });
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-pick]"))) { pickTarget = t.dataset.pick; openPicker(); return; }
    if ((t = e.target.closest("[data-sugg]"))) { var sp = dById(t.dataset.sugg); ppOpen("مقترحات: " + sp.name, "المنتجات اللي تطلع للزبون تحت «يحلى معه» في صفحة هذا المنتج. بالترتيب اللي تختاره.", sp.sugg || [], function(ids){ if (ids.length) sp.sugg = ids; else delete sp.sugg; renderAProds(); }, sp.id); return; }
    if ((t = e.target.closest("[data-gostock]"))) { var gp = dById(t.dataset.gostock); aFilter.q = gp.name; aFilter.cat = "all"; showTab("prods"); $("aQ").value = gp.name; renderAFilter(); renderAProds(); return; }
    if ((t = e.target.closest("[data-del-prod]"))) {
      if (t.dataset.confirm !== "1") { t.dataset.confirm = "1"; t.textContent = "متأكد؟ اضغط ثاني"; return; }
      draft.products = draft.products.filter(function(p){ return p.id !== t.dataset.delProd; }); markDirty(); renderAProds(); renderACats(); return;
    }
    if ((t = e.target.closest("[data-del-cat]")) && !t.disabled) {
      draft.cats = draft.cats.filter(function(c){ return c.id !== t.dataset.delCat; }); markDirty(); renderACats(); renderAFilter(); return;
    }
    if ((t = e.target.closest("[data-img]"))) { setPicked(t.dataset.img); }
  });
  function openPicker(){
    var used = {}; draft.products.forEach(function(p){ used[p.img] = 1; });
    var keys = Object.keys(draft.imgs).filter(function(k){ return k !== "logo" && isPhoto(k); });
    keys.sort(function(a,b){ return (isPhoto(b) ? 1 : 0) - (isPhoto(a) ? 1 : 0); });
    $("pickGrid").innerHTML = keys.map(function(k){ return '<button type="button" data-img="' + k + '">' + '<img src="' + draft.imgs[k] + '" alt=""' + (isPhoto(k) ? ' class="photo"' : '') + '></button>'; }).join("");
    $("pickSheet").hidden = false;
  }
  function setPicked(k){
    var parts = pickTarget.split(":");
    if (parts[0] === "ban") { beObj(parts[1]).img = k; banOpen[parts[1]] = true; markDirty(); renderBans(); return; }
    if (parts[0] === "cat") draft.cats.forEach(function(c){ if (c.id === parts[1]) c.img = k; });
    else { var p = dById(parts[1]); if (p) p.img = k; }
    markDirty(); $("pickSheet").hidden = true; renderACats(); renderAProds();
  }
  function onUpload(){
    var f = this.files && this.files[0]; this.value = "";
    if (!f) return;
    var r = new FileReader();
    r.onload = function(){
      var im = new Image();
      im.onload = function(){
        var max = String(pickTarget).indexOf("ban:") === 0 ? 1200 : 360, sc = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL("image/webp", 0.78); if (url.indexOf("image/webp") < 0) url = c.toDataURL("image/jpeg", 0.8);
        var k = uid("u"); draft.imgs[k] = url; setPicked(k);
      };
      im.onerror = function(){ $("aStatus").className = "status err"; $("aStatus").textContent = "ما قدرنا نقرأ الصورة. جرّب صورة JPG أو PNG."; };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  }
  var newPin = "", newDPin = "";
  function renderTg(){
    var box = $("tgCard"); if (!box) return;
    box.innerHTML = '<h2>استقبال الطلبات (تيليجرام)</h2><p class="hint" id="tgState">جاري الفحص…</p>';
    api("/tg-status", { pin: adminPin }).then(function(j){
      if (!$("tgCard")) return;
      if (!j.ok) { $("tgState").textContent = "ما قدرنا نفحص الربط (" + (j.code || "?") + ")."; return; }
      var steps = '<ol class="hint" style="margin:0;padding-inline-start:18px;display:grid;gap:4px">' +
        (j.hasToken ? '' : '<li>افتح تيليجرام وكلّم <b>@BotFather</b>، اكتب <b>/newbot</b> وسمّه، وانسخ المفتاح اللي يعطيك.</li><li>حط المفتاح في Cloudflare باسم <b>TELEGRAM_BOT_TOKEN</b> (Secret) واضغط Deploy.</li>') +
        '<li>افتح البوت في تيليجرام واضغط <b>Start</b> وأرسل له أي رسالة. (لو تبغى الطلبات توصل لقروب: أضف البوت للقروب وأرسل فيه رسالة.)</li><li>ارجع هنا واضغط <b>اربط تيليجرام</b>.</li></ol>';
      var drvLink = location.origin + location.pathname + "#driver";
      box.innerHTML = '<h2>الطلبات والمندوب</h2>' +
        (j.hasDB ? (j.driverSet ? '<p class="status">صفحة المندوب شغالة. رابطها: <b dir="ltr" style="user-select:all">' + esc(drvLink) + '</b></p>' : '<p class="status err">صفحة المندوب جاهزة، بس لازم تضيف مندوب من «الموظفين» فوق.</p>')
                 : '<p class="status err">صفحة المندوب تحتاج قاعدة الطلبات (DB) في Cloudflare. الخطوات في الدليل، القسم ٧.</p>') +
        '<h2 style="font-size:1rem;margin-top:6px">تيليجرام (اختياري)</h2>' +
        (j.linked ? '<p class="status">الطلبات توصل الحين إلى: <b>' + esc(j.title) + '</b></p>' : '<p class="status err">الطلبات لسا ما تتربط. اتبع الخطوات:</p>' + steps) +
        '<div class="actions">' + (j.hasToken ? '<button class="btn btn-ink" type="button" id="tgLink">' + (j.linked ? 'غيّر المحادثة' : 'اربط تيليجرام') + '</button>' : '') +
        (j.linked ? '<button class="btn btn-soft" type="button" id="tgTest">أرسل رسالة تجربة</button>' : '') + '<span class="status" id="tgMsg" aria-live="polite"></span></div>' +
        (j.linked ? '<p class="hint">لتغيير المكان: أرسل رسالة للبوت من المحادثة الجديدة أو القروب، ثم اضغط «غيّر المحادثة».</p>' : '');
      if ($("tgLink")) $("tgLink").addEventListener("click", function(){ var b = this; b.disabled = true; $("tgMsg").className = "status"; $("tgMsg").textContent = "جاري الربط…";
        api("/tg-link", { pin: adminPin }).then(function(r){ b.disabled = false;
          if (r.ok) { renderTg(); return; }
          $("tgMsg").className = "status err";
          $("tgMsg").textContent = r.code === "no_message" ? "ما لقينا رسالة. أرسل أي رسالة للبوت في تيليجرام وجرّب مرة ثانية." : r.code === "bad_token" ? "مفتاح البوت غلط. تأكد من TELEGRAM_BOT_TOKEN في Cloudflare." : "ما انربط (" + (r.code || "?") + ").";
        }); });
      if ($("tgTest")) $("tgTest").addEventListener("click", function(){ $("tgMsg").className = "status"; $("tgMsg").textContent = "جاري الإرسال…";
        api("/tg-test", { pin: adminPin }).then(function(r){ $("tgMsg").className = r.ok ? "status" : "status err"; $("tgMsg").textContent = r.ok ? "انرسلت، شيّك تيليجرام." : "ما انرسلت."; }); });
    });
  }
  function ghToken(){ try { return localStorage.getItem("ohod-gh-token") || ""; } catch(e){ return ""; } }
  function renderGh(){
    var has = !!ghToken();
    $("ghCard").innerHTML = '<h2>ربط الحفظ</h2>' + (has
      ? '<p class="hint">هذا الجهاز مربوط، وأي تعديل تحفظه يوصل للزبائن خلال دقيقة تقريبًا.</p><div class="actions"><button class="btn btn-ghost" type="button" id="ghRemove">فك الربط من هذا الجهاز</button></div>'
      : '<p class="hint">عشان تنحفظ تعديلاتك وتوصل للزبائن، يحتاج هذا الجهاز رمز GitHub مرة وحدة بس. صاحب الحساب يسويه من <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">إعدادات GitHub</a>: يختار المستودع <b>' + esc(GHREPO.repo) + '</b> فقط، ويعطيه صلاحية <b>Contents: Read and write</b>.</p>' +
        '<label for="ghTok">رمز GitHub<input id="ghTok" type="password" autocomplete="off" placeholder="github_pat_…" style="direction:ltr"></label><div class="actions"><button class="btn btn-brand" type="button" id="ghSaveTok">اربط هذا الجهاز</button></div>');
    if ($("ghRemove")) $("ghRemove").addEventListener("click", function(){ try { localStorage.removeItem("ohod-gh-token"); } catch(e){} renderGh(); });
    if ($("ghSaveTok")) $("ghSaveTok").addEventListener("click", function(){ var v = $("ghTok").value.trim(); if (!v) return; try { localStorage.setItem("ohod-gh-token", v); } catch(e){} renderGh(); });
  }
  function b64(str){ var bytes = new TextEncoder().encode(str), bin = ""; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function ghSave(data){
    var tok = ghToken(); if (!tok) return Promise.reject({ code: "no_token" });
    var url = "https://api.github.com/repos/" + GHREPO.owner + "/" + GHREPO.repo + "/contents/data.json";
    var h = { "Authorization": "Bearer " + tok, "Accept": "application/vnd.github+json" };
    return fetch(url + "?ref=gh-pages&t=" + Date.now(), { headers: h, cache: "no-store" }).then(function(r){
      if (r.status === 401) throw { code: "bad_token" }; return r.ok ? r.json() : {};
    }).then(function(cur){
      var body = { message: "تحديث المتجر من صفحة الإدارة", content: b64(JSON.stringify(data)), branch: "gh-pages" };
      if (cur && cur.sha) body.sha = cur.sha;
      return fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
    }).then(function(r){
      if (r.status === 401 || r.status === 403 || r.status === 404) throw { code: "bad_token" };
      if (r.status === 409) throw { code: "conflict_gh" };
      if (!r.ok) throw { code: "gh_" + r.status };
      return r.json();
    });
  }
  function gcData(data){
    var used = { logo: 1 };
    data.products.forEach(function(p){ used[p.img] = 1; }); data.cats.forEach(function(c){ used[c.img] = 1; });
    (data.store.bans || []).forEach(function(b){ used[b.img] = 1; }); Object.keys(data.store.banEdit || {}).forEach(function(k){ used[data.store.banEdit[k].img] = 1; });
    Object.keys(data.imgs).forEach(function(k){ if (k !== "logo" && (!isPhoto(k) || !used[k])) delete data.imgs[k]; });
    return data;
  }
  function buildHtml(data){
    var used = { logo: 1 };
    data.products.forEach(function(p){ used[p.img] = 1; }); data.cats.forEach(function(c){ used[c.img] = 1; });
    (data.store.bans || []).forEach(function(b){ used[b.img] = 1; }); Object.keys(data.store.banEdit || {}).forEach(function(k){ used[data.store.banEdit[k].img] = 1; });
    Object.keys(data.imgs).forEach(function(k){ if (k !== "logo" && (!isPhoto(k) || !used[k])) delete data.imgs[k]; });
    var json = JSON.stringify(data).replace(/</g, "\\u003c");
    var parts = KEEP.map(function(h){ return h === null ? '<script type="application/json" id="store-data" data-keep>' + json + '<\/script>' : h; });
    return HEAD + "\n" + parts.join("\n") + "\n</body></html>";
  }
  // دمج ثلاثي: تعديلاتك (مقارنة بالنسخة اللي فتحت عليها) تنحط فوق آخر نسخة محفوظة، فما يضيع حفظ أحد
  function mergeCatalog(base, mine, theirs){
    var J = JSON.stringify, out = JSON.parse(J(theirs)); base = base || { store: {}, products: [], cats: [], imgs: {} };
    out.store = out.store || {}; var ks = {}; [base.store || {}, mine.store || {}].forEach(function(o){ Object.keys(o).forEach(function(k){ ks[k] = 1; }); });
    Object.keys(ks).forEach(function(k){ if (J(mine.store[k]) !== J((base.store || {})[k])) { if (mine.store[k] === undefined) delete out.store[k]; else out.store[k] = mine.store[k]; } });
    ["products", "cats"].forEach(function(key){
      var b = {}, m = {}, t = {}; (base[key] || []).forEach(function(x){ b[x.id] = x; }); (mine[key] || []).forEach(function(x){ m[x.id] = x; }); (out[key] || []).forEach(function(x){ t[x.id] = x; });
      var order = (out[key] || []).map(function(x){ return x.id; });
      Object.keys(m).forEach(function(id){ if (!b[id]) { if (!t[id]) order.push(id); t[id] = m[id]; } else if (J(m[id]) !== J(b[id])) t[id] = m[id]; });
      Object.keys(b).forEach(function(id){ if (!m[id]) delete t[id]; });
      var mo = (mine[key] || []).map(function(x){ return x.id; }), bo = (base[key] || []).map(function(x){ return x.id; });
      if (J(mo) !== J(bo)) order = mo.concat(order.filter(function(id){ return !m[id]; }));
      out[key] = order.filter(function(id, i, a){ return t[id] && a.indexOf(id) === i; }).map(function(id){ return t[id]; });
    });
    out.imgs = out.imgs || {}; Object.keys(mine.imgs || {}).forEach(function(k){ if (!base.imgs || mine.imgs[k] !== base.imgs[k]) out.imgs[k] = mine.imgs[k]; });
    Object.keys(mine).forEach(function(k){ if (["store", "products", "cats", "imgs"].indexOf(k) < 0 && J(mine[k]) !== J(base[k])) out[k] = mine[k]; });
    return out;
  }
  function publish(){
    var st = $("aStatus"), btn = $("aSave");
    if(!catalogSaveAvailable()){recoverAdminSave(true);return;}
    // منتجات «قريباً» (الخضار والفواكه): بدون سعر عمداً، ما نعتبرها خطأ
    var bad = draft.products.filter(function(p){ return !p.name.trim() || (!(p.price > 0) && !p.soon); });
    if (bad.length) { st.className = "status err"; st.textContent = "فيه " + num(bad.length) + " منتج بدون اسم أو سعره صفر. صحّحها وبعدين احفظ."; return; }
    var dyl = (draft.store.daily && draft.store.daily.list) || [];
    if (dyl.some(function(x){ return !dById(x.id) || !(x.price > 0); })) { st.className = "status err"; st.textContent = "فيه يوم في عرض اليوم بدون منتج أو سعره صفر."; return; }
    if (draft.store.deal95) draft.store.deal95.ids = draft.store.deal95.ids.filter(function(id){ return dById(id); });
    btn.disabled = true; st.className = "status"; st.textContent = "جاري الحفظ…";
    if (newDPin && !/^\d{4,12}$/.test(newDPin)) { btn.disabled = false; st.className = "status err"; st.textContent = "رقم المندوب لازم يكون أرقام بس، من ٤ إلى ١٢ رقم."; return; }
    if (newPin && !/^\d{4,12}$/.test(newPin)) { btn.disabled = false; st.className = "status err"; st.textContent = "الرقم السري الجديد لازم يكون أرقام بس، من ٤ إلى ١٢ رقم."; return; }
    if (apiUrl()) {
      var payload = gcData(JSON.parse(JSON.stringify(draft))); delete payload.store.pinHash;
      // خيار بيع ناقص (بدون عدد حبات أو سعر) ما ينحفظ
      payload.products.forEach(function(p){ if (!Array.isArray(p.packs)) return; p.packs = p.packs.filter(function(x){ return Number(x.n) >= 1 && Number(x.price) > 0; }); if (!p.packs.length) delete p.packs; });
      var stockSend = Object.keys(stockEdit).length ? stockEdit : undefined, costSend = Object.keys(costEdit).length ? costEdit : undefined;
      var tries = 0, merged = false;
      var saveOnce = function(data, version){ return api("/save", { pin: adminPin, data: data, newPin: newPin || undefined, newDriverPin: newDPin || undefined, stock: stockSend, costs: costSend, baseVersion: version }, 90000).then(function(j){
        if (j.ok || (j.code !== "data_conflict" && j.code !== "timeout") || tries >= 3) return j;
        // فيه حفظ أحدث، أو الاتصال طوّل: نجيب آخر نسخة، ندمج تعديلاتك عليها، ونحفظ لحالنا
        tries++; merged = true; st.className = "status"; st.textContent = "فيه حفظ أحدث، ندمج تعديلاتك عليه ونحفظ…";
        return api("/admin/catalog", { pin: adminPin }, 90000).then(function(c){
          if (!c.ok || !c.data || !c.version) return j;
          var latest = c.data; delete latest.status;
          if (j.code === "timeout" && JSON.stringify(gcData(JSON.parse(JSON.stringify(latest)))) === JSON.stringify(data)) return { ok: true, version: c.version };
          payload = gcData(mergeCatalog(adminCatalogBase, data, latest)); delete payload.store.pinHash;
          return saveOnce(payload, c.version);
        });
      }); };
      saveOnce(payload, adminCatalogVersion).then(function(j){
        btn.disabled = false;
        if (j.ok) {
          if (j.stock) { STK = j.stock; LIVE = j.stock; } stockEdit = {}; Object.keys(costEdit).forEach(function(k){ if (costEdit[k] == null) delete COST[k]; else COST[k] = costEdit[k]; }); costEdit = {};
          if(j.version)adminCatalogVersion=j.version;adminCatalogBase=JSON.parse(JSON.stringify(payload));applyData(payload); dirty = false; if (merged) { draft = JSON.parse(JSON.stringify(D)); setTimeout(function(){ if (!dirty) adminShell(); }, 900); } if (newPin) adminPin = newPin; newPin = ""; $("sPin").value = ""; newDPin = ""; if ($("sDPin")) $("sDPin").value = ""; if ($("tgCard")) renderTg();
          st.className = "status"; st.textContent = "انحفظ. يوصل للزبائن خلال دقيقة تقريبًا."; $("aState").textContent = "كل شي محفوظ"; return;
        }
        st.className = "status err";
        st.textContent = j.code === "bad_pin" ? "الرقم السري تغيّر من جهاز ثاني. اطلع من الإدارة وادخل بالرقم الجديد." :
          j.code === "driver_pin_same" ? "رقم المندوب لازم يختلف عن رقم الإدارة." :
          j.code === "locked" ? "انقفل الدخول مؤقتًا بسبب محاولات غلط. جرّب بعد شوي." :
          j.code === "too_large" ? "الصور كثيرة أو كبيرة. احذف بعض الصور المرفوعة وجرّب." :
          j.code === "github_auth" ? "مفتاح GitHub اللي في الخادم انتهى أو ما له صلاحية. صاحب الحساب لازم يجدده." :
          j.code === "data_conflict" ? "فيه تعديل أحدث من جهاز ثاني. مسودتك ما انمسحت؛ افتح الإدارة في تبويب جديد وقارن التعديلات قبل الحفظ." :
          j.code === "timeout" ? "انتهت مهلة التأكيد. راجع النسخة المحفوظة قبل إعادة الحفظ؛ مسودتك باقية." :
          j.code === "network" ? "ما قدرنا نوصل لخادم الإدارة. تأكد من النت." :
          "ما انحفظ (" + (j.code || "?") + "). جرّب مرة ثانية.";
      });
      return;
    }
    var pinStep = newPin ? sha(newPin).then(function(h){ draft.store.pinHash = h; }) : Promise.resolve();
    if (GH) {
      pinStep.then(function(){ var data = gcData(JSON.parse(JSON.stringify(draft))); return ghSave(data).then(function(){ return data; }); }).then(function(data){
        applyData(data); dirty = false; newPin = ""; $("sPin").value = ""; btn.disabled = false;
        st.textContent = "انحفظ. يوصل للزبائن خلال دقيقة تقريبًا."; $("aState").textContent = "كل شي محفوظ";
      }).catch(function(err){
        btn.disabled = false; st.className = "status err"; var c = err && err.code;
        st.textContent = c === "no_token" ? "اربط هذا الجهاز أول من خانة «ربط الحفظ» فوق." :
          c === "bad_token" ? "رمز GitHub غلط أو انتهى أو ما له صلاحية على المستودع." :
          c === "conflict_gh" ? "صار تعديل ثاني بنفس الوقت. اضغط احفظ مرة ثانية." :
          "ما انحفظ. تأكد من النت وجرّب مرة ثانية.";
        if (c === "no_token" && $("ghCard")) $("ghCard").scrollIntoView({ behavior: "smooth" });
      });
      return;
    }
    var html;
    pinStep.then(function(){ html = buildHtml(JSON.parse(JSON.stringify(draft))); return claude.use("artifact"); }).then(function(a){
      if (!a) throw { code: "not_granted" };
      try { sessionStorage.setItem("ohod-mode", "admin"); } catch(e){}
      return a.publish(html);
    }).then(function(){
      dirty = false; btn.disabled = false; st.textContent = "انحفظ ونُشر"; $("aState").textContent = "كل شي محفوظ";
    }).catch(function(err){
      btn.disabled = false; st.className = "status err";
      var c = err && err.code;
      st.textContent = c === "conflict" ? "أحد ثاني حفظ تعديل قبلك، الصفحة بتتحدث الحين." :
        (c === "not_writer" || c === "not_granted") ? "ما عندك صلاحية تعديل هذا المتجر." :
        c === "too_large" ? "الصور كثيرة أو كبيرة. احذف بعض الصور المرفوعة وجرّب." :
        "ما انحفظ، جرّب مرة ثانية بعد شوي.";
    });
  }

  
  /* ---------- product picker (suggestions, banners, for-you) ---------- */
  function ppOpen(title, hint, ids, cb, exclude){
    pp = { ids: ids.filter(function(id){ return dById(id); }), cb: cb, ex: exclude || "" };
    $("ppTitle").textContent = title; $("ppHint").textContent = hint || ""; $("ppQ").value = ""; ppRender(); $("ppSheet").hidden = false;
  }
  function ppRender(){
    if (!pp) return;
    var q = $("ppQ").value.trim();
    $("ppSel").innerHTML = pp.ids.length ? pp.ids.map(function(id, i){ var p = dById(id); return '<button type="button" class="chip on" data-pptog="' + id + '" aria-label="شيل ' + esc(p.name) + '"><i>' + (i + 1) + '</i>' + imgTag(p.img, "") + esc(p.name) + '<span aria-hidden="true">×</span></button>'; }).join("") : '<span class="hint">ما اخترت شي للحين. اضغط على المنتجات تحت.</span>';
    // مع آلاف المنتجات: أول ٦٠ نتيجة بس، والبحث يوصلك للباقي (يتجاهل الهمزات والتاء المربوطة، ويقبل الباركود)
    var words = normAr(q).split(/\s+/).filter(Boolean), hits = draft.products.filter(function(p){ if (p.id === pp.ex) return false; if (!words.length) return true; var h = normAr(p.name + " " + (p.name_en || "") + " " + (p.bc || "")); return words.every(function(w){ return h.indexOf(w) > -1; }); });
    $("ppGrid").innerHTML = hits.slice(0, 60).map(function(p){
      var on = pp.ids.indexOf(p.id) > -1; return '<button type="button" class="chip" data-pptog="' + p.id + '" aria-pressed="' + on + '">' + imgTag(p.img, "") + esc(p.name) + '</button>'; }).join("") + (hits.length > 60 ? '<span class="hint" style="flex-basis:100%">و' + num(hits.length - 60) + ' منتج ثاني. اكتب في البحث عشان تلقاه.</span>' : '');
  }
  function ppClose(){ if (!pp) return; var cb = pp.cb, ids = pp.ids.slice(); pp = null; $("ppSheet").hidden = true; cb(ids); markDirty(); }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !pp) return;
    var t = e.target.closest("[data-pptog]"); if (!t) return;
    var id = t.dataset.pptog, i = pp.ids.indexOf(id); if (i > -1) pp.ids.splice(i, 1); else pp.ids.push(id); ppRender();
  });

  /* ---------- banners & for-you ---------- */
  var BAN_COLORS = ["#2E7D5B","#E8394F","#FF7A2F","#1D5FA8","#7A3FC4","#C98A5B","#0F8A8A","#1E1E2A"];
  function thumbs(ids, auto){ var l = (ids || []).map(dById).filter(Boolean); return l.length ? '<span class="thumbs">' + l.slice(0, 6).map(function(p){ return imgTag(p.img, ""); }).join("") + (l.length > 6 ? '<em>+' + (l.length - 6) + '</em>' : '') + '</span>' : '<span class="hint">' + (auto || "ما فيه منتجات") + '</span>'; }
  var banOpen = {};
  function beObj(id){ var st = draft.store, c = (st.bans || []).filter(function(b){ return b.id === id; })[0]; if (c) return c; st.banEdit = st.banEdit || {}; return st.banEdit[id] || (st.banEdit[id] = {}); }
  function banEditor(id, o, custom){
    var f = function(k, label, ph, dir){ return '<label>' + label + '<input data-be="' + id + ':' + k + '" value="' + esc(o[k] || "") + '" placeholder="' + esc(ph || "") + '"' + (dir ? ' dir="' + dir + '"' : '') + '></label>'; };
    var chk = function(k, label){ return '<label class="chk"><input type="checkbox" data-be="' + id + ':' + k + '"' + (o[k] ? ' checked' : '') + '>' + label + '</label>'; };
    var hasImg = o.img && draft.imgs[o.img], col = o.color || "";
    var STY = [["night","ليلي (عرض اليوم)"],["shelf","رف (مقاضي)"],["calm","هادي (منتج واحد)"],["split","نص ونص (سعر بارز)"],["glass","ناعم (زجاج)"]].concat(custom ? [["bundle","باقة بسعر واحد"]] : []);
    var cur = o.style || (custom ? ((o.ids || []).length === 1 ? "calm" : "shelf") : { daily: "night", deals: "split", bakery: "shelf", offers: "glass" }[id]);
    var bsum = 0, bcost = 0, bok = true; if (custom && cur === "bundle") (o.ids || []).slice(0, 4).forEach(function(pid){ var p = dById(pid); if (!p) { bok = false; return; } bsum += Number(p.price); var c = costOf(pid); if (c == null) bok = false; else bcost += c; });
    var bp = Number(o.bprice) || 0;
    return '<details class="bed" data-bed="' + id + '"' + (banOpen[id] ? ' open' : '') + '><summary data-bedsum="' + id + '">' + ic("palette") + 'صمّم البنر على كيفك</summary><div class="bed-in">' +
      '<div class="bed-sec"><b>الشكل</b><div class="pays seg mini">' + STY.map(function(x){ return '<button type="button" data-bestyle="' + id + ':' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
        (custom && cur === "bundle" ? '<div class="fields"><label>سعر الباقة (ريال)<input type="number" min="0" step="0.5" inputmode="decimal" data-be="' + id + ':bprice" value="' + esc(o.bprice || "") + '" placeholder="أقل من ' + num(Math.round(bsum * 100) / 100) + '"></label></div>' +
          '<p class="hint">اختر من ٢ إلى ٤ منتجات للباقة. المنتجات منفصلة بـ ' + num(Math.round(bsum * 100) / 100) + ' ريال. السعر يتطبّق فعليًا في السلة لما الزبون يضغط «أضف الباقة».</p>' +
          (bp && bp >= bsum ? '<p class="sg-marg bad">سعر الباقة لازم يكون أقل من مجموع المنتجات (' + num(Math.round(bsum * 100) / 100) + ' ريال)، وإلا ما تطلع كباقة.</p>' : '') +
          ((o.ids || []).length < 2 ? '<p class="sg-marg mid">اختر منتجين على الأقل من «منتجات البنر».</p>' : '') +
          (bp && bp < bsum && bok && bcost ? '<p class="sg-marg ' + (bp < bcost ? 'bad' : (bp - bcost) / bp < 0.1 ? 'mid' : 'good') + '">' + (bp < bcost ? 'انتبه: سعر الباقة تحت التكلفة (' + num(Math.round(bcost * 100) / 100) + ' ريال)، تخسر في كل باقة.' : 'ربحك في كل باقة ' + num(Math.round((bp - bcost) * 100) / 100) + ' ريال (' + Math.round((bp - bcost) / bp * 100) + '٪).') + '</p>' : (bp ? '<p class="hint">حط «سعر الشراء» لمنتجات الباقة عشان يطلع ربحك.</p>' : '')) : '') + '</div>' +
      '<div class="bed-sec"><b>الكلام</b><div class="fields">' + f("title", "العنوان", custom ? "" : "الافتراضي") + f("sub", "الوصف تحت", custom ? "مثال: خصومات على الألبان" : "الافتراضي") + f("k", "سطر صغير فوق", custom ? "مثال: لفترة محدودة" : "الافتراضي") + f("go", "نص الزر", custom ? "تسوّق الحين" : "الافتراضي") + '</div>' +
        '<details class="bed-en"><summary>بالإنجليزي (اختياري)</summary><div class="fields">' + f("title_en", "Title", "", "ltr") + f("sub_en", "Subtitle", "", "ltr") + f("k_en", "Small line", "", "ltr") + f("go_en", "Button", "", "ltr") + '</div></details>' +
        '<div class="chks">' + chk("noGo", "بدون زر") + chk("dark", "كتابة غامقة (للألوان الفاتحة)") + '</div></div>' +
      '<div class="bed-sec"><b>اللون</b><div class="swatches" role="group" aria-label="لون البنر">' + (custom ? '' : '<button type="button" class="sw1 def" data-becolor="' + id + ':" aria-pressed="' + !col + '" title="الافتراضي">تلقائي</button>') +
        BAN_COLORS.concat(["#FFD84D","#F5EFE6","#FFFFFF"]).map(function(c){ return '<button type="button" class="sw1" style="background:' + c + '" data-becolor="' + id + ':' + c + '" aria-pressed="' + (col === c) + '" aria-label="' + c + '"></button>'; }).join("") +
        '<label class="sw1 custom" title="لون من اختيارك"><input type="color" data-be="' + id + ':color" value="' + esc(col || "#2E7D5B") + '"></label></div>' +
        '<div class="chks"><label class="chk"><input type="checkbox" data-begrad="' + id + '"' + (o.color2 ? ' checked' : '') + '>تدرّج بلونين</label>' + (o.color2 ? '<label class="sw1 custom one" style="background:' + esc(o.color2) + '" title="اللون الثاني"><input type="color" data-be="' + id + ':color2" value="' + esc(o.color2) + '"></label>' : '') + '</div></div>' +
      '<div class="bed-sec"><b>صور المنتجات</b><div class="chks"><label>عدد الصور<select data-be="' + id + ':picsN">' + [3,2,1,0].map(function(n){ return '<option value="' + n + '"' + ((o.picsN == null ? 3 : Number(o.picsN)) === n ? ' selected' : '') + '>' + (n ? n + (n === 1 ? ' صورة كبيرة' : ' صور') : 'بدون صور') + '</option>'; }).join("") + '</select></label>' +
        '<button class="btn btn-soft sm" type="button" ' + (custom ? 'data-banprods="' + id + '">منتجات البنر (' + ((o.ids || []).length) + ')' : 'data-banpick="' + id + '">اختر المنتجات') + '</button></div></div>' +
      '<div class="bed-sec"><b>أو صورة بنر جاهزة</b><p class="hint">ارفع تصميمك الخاص (يفضّل عرضي، مثل ١٢٠٠×٦٠٠). يغطي البنر كامل بدل اللون والصور.</p><div class="chks">' +
        '<button class="btn btn-soft sm" type="button" data-banimg="' + id + '">' + (hasImg ? 'غيّر الصورة' : 'ارفع صورة') + '</button>' + (hasImg ? '<button class="btn btn-ghost sm" type="button" data-banimgdel="' + id + '">شيل الصورة</button>' + chk("showText", "اعرض الكلام فوق الصورة") : '') + '</div></div>' +
      (custom ? '<div class="bed-sec"><b>لما الزبون يضغط عليه</b><label><select data-be="' + id + ':target"><option value="">يطلع له منتجات البنر</option><option value="offers"' + (o.target === "offers" ? ' selected' : '') + '>يروح للعروض</option>' +
        draft.cats.map(function(c){ return '<option value="cat:' + c.id + '"' + (o.target === "cat:" + c.id ? ' selected' : '') + '>يفتح قسم: ' + esc(c.name) + '</option>'; }).join("") + '</select></label></div>' :
        '<div class="bed-sec"><button class="btn btn-ghost sm" type="button" data-bereset="' + id + '">رجّع البنر للشكل الافتراضي</button></div>') +
      '</div></details>';
  }
  /* ---------- محرر البنرات الحي (١٧ نوفمبر ٢٠٢٦، طلب المالك: «البنر نفسه أعدّل عليه») ----------
     كل بنر يطلع مثل ما يشوفه الزبون بالضبط، وتحته كل نص فيه بخانة (اضغط أي كلمة بالبنر وتفتح خانتها)، وتبديل المنتجات والتصميم والإظهار.
     النصوص في store.banText[بنر]["<التصميم>:<رقم النص>"]، المنتجات store.banPicks، التصميم store.banArt (رقم يثبّته، بدونه يتبدّل كل يوم). */
  var BE_LBL = { featured: "العرض المميز (أعلى الصفحة)", top: "أقوى خصم", multi: "عرض الكمية", daily: "عرض اليوم", offers: "عروض الأسبوع", deals: "منتجات السعر الرمزي", bakery: "المخبز", free: "التوصيل المجاني", catdeal: "عروض القسم", night: "طلعات السهرة (من ٧ المساء)", veg: "الخضار والفواكه", welcome: "كود الترحيب" };
  var BE_PICK = { featured: ["صور المنتجات", 0], top: ["المنتج (لازم عليه خصم)", 1], multi: ["المنتج (لازم عليه عرض كمية)", 1], offers: ["صور المنتجات", 0], deals: ["صور المنتجات", 0], bakery: ["صور المنتجات", 0], catdeal: ["صور المنتجات", 0], night: ["المنتجات", 0], veg: ["صور المنتجات", 0] };
  var beOpenId = null, beT = null;
  function beCtx(fn){ var saved = S, imgs = D.imgs; S = draft.store; D.imgs = draft.imgs; try { return fn(); } catch(e){ return null; } finally { S = saved; D.imgs = imgs; } }
  // كل البنرات المتاحة (حتى المخفية) بشكلها الحالي في المسودة
  function beAll(noTextFor){
    var st = draft.store, keepP = st.promos, keepT = noTextFor && st.banText ? st.banText[noTextFor] : null;
    st.promos = orderOf(keepP, promoDefs()).map(function(x){ return { id: x.id, on: true }; }); if (keepT) delete st.banText[noTextFor];
    var out = beCtx(function(){ var o = {}, t = document.createElement("div"); t.innerHTML = banners(); Array.prototype.forEach.call(t.querySelectorAll(".kq-ban[data-bid]"), function(b){ o[b.dataset.bid] = b.outerHTML; });
      var fg = featuredGroup(); if (fg) { var f = featuredArt(fg); if (f) o.featured = f; } return o; }) || {};
    if (keepP === undefined) delete st.promos; else st.promos = keepP; if (keepT) st.banText[noTextFor] = keepT; return out;
  }
  function beDesign(id){ var L = ART[id]; if (!L) return { i: 0, n: 0, auto: true }; return beCtx(function(){ var f = S.banArt && S.banArt[id]; return { i: artPick(id, L.length), n: L.length, auto: !(f != null && f !== "" && !isNaN(f)) }; }); }
  function beShown(id){ if (id === "featured") return true; var x = orderOf(draft.store.promos, promoDefs()).filter(function(y){ return y.id === id; })[0]; return !x || x.on; }
  function beTexts(html){ var d = document.createElement("div"); d.innerHTML = html || ""; return banTextNodes(d).map(function(n){ return n.nodeValue.trim(); }); }
  function beLive(){
    var box = $("beLive"); if (!box || !draft) return;
    var all = beAll(), ids = ["featured"].concat(PROMO_DEF).filter(function(id){ return all[id]; }), missing = PROMO_DEF.filter(function(id){ return !all[id]; });
    box.innerHTML = '<h2>البنرات اللي يشوفها الزبون</h2><p class="hint">كل بنر بشكله الحقيقي. اضغط «عدّل» وغيّر أي كلمة فيه، أو بدّل منتجاته أو تصميمه. الأسعار والنسب تتحدث لحالها من المنتجات. التغييرات تبان هنا على طول، وتوصل للزبائن بعد «حفظ».</p><div class="be-list">' +
      ids.map(function(id){ var on = beShown(id), op = beOpenId === id;
        return '<div class="be-item' + (op ? ' open' : '') + (on ? '' : ' off') + '" data-beid="' + id + '"><div class="be-head"><b>' + (BE_LBL[id] || PROMO_LABEL[id] || id) + '</b><span class="be-st">' + (on ? 'يطلع للزبون' : 'مخفي') + '</span>' +
          '<button type="button" class="btn ' + (op ? 'btn-soft' : 'btn-brand') + ' sm" data-betog="' + id + '">' + (op ? 'تم' : 'عدّل') + '</button></div>' +
          '<div class="be-prev ban-prev" data-beprev="' + id + '">' + all[id] + '</div>' + (op ? beForm(id, all[id]) : '') + '</div>'; }).join("") + '</div>' +
      (missing.length ? '<p class="hint">ما تطلع الحين (ما فيه بيانات لها): ' + missing.map(function(id){ return BE_LBL[id] || id; }).join("، ") + '.</p>' : '');
    setTimeout(function(){ var sv = D.imgs; D.imgs = draft.imgs; applyCuts(box); D.imgs = sv; }, 0);
  }
  function beForm(id, html){
    var st = draft.store, d = beDesign(id), orig = beTexts(beAll(id)[id]), cur = beTexts(html), o = (st.banText && st.banText[id]) || {};
    var pick = BE_PICK[id], picks = (st.banPicks && st.banPicks[id]) || [];
    return '<div class="be-form">' +
      (d.n > 1 ? '<div class="be-row"><span>التصميم</span><div class="be-des"><button type="button" class="btn btn-ghost sm" data-bedes="' + id + ':-1" aria-label="التصميم اللي قبل">›</button><b>' + num(d.i + 1) + ' من ' + num(d.n) + '</b><button type="button" class="btn btn-ghost sm" data-bedes="' + id + ':1" aria-label="التصميم اللي بعد">‹</button></div>' +
        '<label class="chk"><input type="checkbox" data-beauto="' + id + '"' + (d.auto ? ' checked' : '') + '>يتبدّل كل يوم</label></div>' : '') +
      '<div class="be-txts"><b>النصوص</b>' + (orig.length ? orig.map(function(t, i){ var k = d.i + ":" + i, v = o[k] != null ? o[k] : t;
          return '<label class="be-tx" data-betx="' + i + '"><span>' + num(i + 1) + '</span><input type="text" data-bet="' + id + ':' + i + '" value="' + esc(v) + '" placeholder="' + esc(t) + '"' + (o[k] != null ? ' class="ed"' : '') + '>' + (o[k] != null ? '<button type="button" class="linkbtn" data-betr="' + id + ':' + i + '" title="رجّع النص الأصلي">↺</button>' : '') + '</label>'; }).join("") : '<p class="hint">ما فيه نصوص تنعدّل بهالتصميم.</p>') + '</div>' +
      (pick ? '<div class="be-row"><span>' + pick[0] + '</span>' + (picks.length ? '<span class="be-pk">' + picks.slice(0, 4).map(function(x){ var p = dById(x); return p ? '<span class="fy-img" title="' + esc(p.name) + '">' + imgTag(p.img, "") + '</span>' : ''; }).join("") + '</span>' : '<span class="hint">تلقائي</span>') +
        '<button type="button" class="btn btn-soft sm" data-bepick="' + id + '">' + (pick[1] ? 'اختر المنتج' : 'اختر المنتجات') + '</button>' + (picks.length ? '<button type="button" class="linkbtn" data-beauto2="' + id + '">رجّعها تلقائي</button>' : '') + '</div>' : '') +
      (id !== "featured" ? '<label class="chk be-row"><input type="checkbox" data-beshow="' + id + '"' + (beShown(id) ? ' checked' : '') + '>يطلع للزبون</label>' : '<p class="hint">العرض المميز يتحكم فيه «عروض المجموعة» (أول عرض مفعّل).</p>') +
      '<button type="button" class="btn btn-ghost sm" data-bereset2="' + id + '">رجّع البنر مثل ما كان</button></div>';
  }
  function bePrev(id){ var el = document.querySelector('[data-beprev="' + id + '"]'); if (!el) return; var h = beAll()[id]; if (h) { el.innerHTML = h; var sv = D.imgs; D.imgs = draft.imgs; applyCuts(el); D.imgs = sv; } }
  document.addEventListener("input", function(e){
    var t = e.target; if (mode !== "admin" || !draft || !t.dataset || !t.dataset.bet) return;
    var k = t.dataset.bet.split(":"), id = k[0], i = Number(k[1]), st = draft.store, d = beDesign(id).i, key = d + ":" + i, orig = t.placeholder;
    st.banText = st.banText || {}; var o = st.banText[id] = st.banText[id] || {};
    if (!t.value.trim() || t.value.trim() === orig) delete o[key]; else o[key] = t.value.trim();
    if (!Object.keys(o).length) delete st.banText[id]; if (!Object.keys(st.banText).length) delete st.banText;
    t.classList.toggle("ed", !!(st.banText && st.banText[id] && st.banText[id][key])); markDirty();
    clearTimeout(beT); beT = setTimeout(function(){ bePrev(id); }, 150);
  });
  // الضغط على كلمة داخل البنر يفتح خانتها
  document.addEventListener("click", function(e){
    var pv = mode === "admin" && e.target.closest && e.target.closest("[data-beprev]"); if (!pv) return;
    e.preventDefault(); e.stopPropagation(); var id = pv.dataset.beprev;
    if (beOpenId !== id) { beOpenId = id; beLive(); pv = document.querySelector('[data-beprev="' + id + '"]'); }
    var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : (document.caretPositionFromPoint ? (function(p){ return p && { startContainer: p.offsetNode }; })(document.caretPositionFromPoint(e.clientX, e.clientY)) : null);
    var n = r && r.startContainer, idx = n && n.nodeType === 3 ? banTextNodes(pv).indexOf(n) : -1;
    if (idx < 0) { var lst = banTextNodes(pv), best = -1, bd = 1e9; lst.forEach(function(x, j){ var rr = document.createRange(); rr.selectNodeContents(x); var b = rr.getBoundingClientRect(), dx = Math.max(b.left - e.clientX, 0, e.clientX - b.right), dy = Math.max(b.top - e.clientY, 0, e.clientY - b.bottom), dd = dx + dy; if (dd < bd) { bd = dd; best = j; } }); if (bd < 30) idx = best; }
    var inp = idx >= 0 && document.querySelector('[data-bet="' + id + ':' + idx + '"]'); if (inp) { inp.focus(); inp.select(); inp.closest(".be-tx").classList.add("hl"); setTimeout(function(){ inp.closest(".be-tx") && inp.closest(".be-tx").classList.remove("hl"); }, 1200); }
  }, true);
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return; var t, st = draft.store, y = window.scrollY, re = function(){ markDirty(); beLive(); window.scrollTo(0, y); };
    if ((t = e.target.closest("[data-betog]"))) { beOpenId = beOpenId === t.dataset.betog ? null : t.dataset.betog; beLive(); window.scrollTo(0, y); return; }
    if ((t = e.target.closest("[data-bedes]"))) { var k = t.dataset.bedes.split(":"), d = beDesign(k[0]); st.banArt = st.banArt || {}; st.banArt[k[0]] = ((d.i + Number(k[1]) + d.n) % d.n) + 1; re(); return; }
    if ((t = e.target.closest("[data-beauto]"))) { var id = t.dataset.beauto; st.banArt = st.banArt || {}; if (t.checked) delete st.banArt[id]; else st.banArt[id] = beDesign(id).i + 1; re(); return; }
    if ((t = e.target.closest("[data-betr]"))) { var k2 = t.dataset.betr.split(":"), dI = beDesign(k2[0]).i; if (st.banText && st.banText[k2[0]]) { delete st.banText[k2[0]][dI + ":" + k2[1]]; if (!Object.keys(st.banText[k2[0]]).length) delete st.banText[k2[0]]; } re(); return; }
    if ((t = e.target.closest("[data-beshow]"))) { var sid = t.dataset.beshow, on = t.checked; st.promos = orderOf(st.promos, promoDefs()).map(function(x){ return x.id === sid ? { id: x.id, on: on } : x; }); re(); if (typeof renderLayout === "function") renderLayout(); return; }
    if ((t = e.target.closest("[data-beauto2]"))) { if (st.banPicks) delete st.banPicks[t.dataset.beauto2]; re(); return; }
    if ((t = e.target.closest("[data-bereset2]"))) { var rid = t.dataset.bereset2; ["banText", "banPicks", "banArt", "banEdit"].forEach(function(k){ if (st[k]) delete st[k][rid]; }); re(); return; }
    if ((t = e.target.closest("[data-bepick]"))) { var pid = t.dataset.bepick, one = BE_PICK[pid][1];
      ppOpen((BE_LBL[pid] || pid) + ": " + BE_PICK[pid][0], one ? "اختر منتج واحد." + (pid === "top" ? " لازم يكون عليه خصم (سعر قبل)." : " لازم يكون عليه عرض كمية.") : "أول المنتجات (اللي لها صور) تطلع داخل البنر.", (st.banPicks && st.banPicks[pid]) || [], function(ids){
        ids = ids || []; if (one) { ids = ids.filter(function(x){ var p = dById(x); return p && (pid === "top" ? p.old > p.price : (p.packs && p.packs.length) || (typeof mustOf === "function" && mustOf(p))); }).slice(0, 1); if (!ids.length) { sToast(pid === "top" ? "اختر منتج عليه خصم" : "اختر منتج عليه عرض كمية"); return; } }
        st.banPicks = st.banPicks || {}; if (ids.length) st.banPicks[pid] = ids; else delete st.banPicks[pid]; markDirty(); beLive(); }); return; }
  });
  function renderBans(){
    var box = $("aBans"); if (!box || !draft) return;
    var st = draft.store; st.banPicks = st.banPicks || {}; st.bans = st.bans || []; st.banEdit = st.banEdit || {}; st.forYou = (st.forYou || []).filter(function(id){ return dById(id); });
    var saved = S, savedImgs = D.imgs; S = st; D.imgs = draft.imgs; var prev = {};
    try { var tmp = document.createElement("div"); tmp.innerHTML = banners(); Array.prototype.forEach.call(tmp.querySelectorAll(".kq-ban"), function(b){ prev[b.dataset.bid] = b.outerHTML; }); } catch(e){}
    S = saved; D.imgs = savedImgs; setTimeout(beLive, 0); setTimeout(function(){ var bx = $("aBans"); if (bx) { var sv2 = D.imgs; D.imgs = draft.imgs; applyCuts(bx); D.imgs = sv2; } }, 0);
    box.innerHTML = '<div class="card" id="beLive"></div>' +
      '<div class="card"><div class="sec-head" style="margin:0"><h2>بنرات خاصة</h2><button class="btn btn-brand" type="button" id="addBan">+ بنر جديد</button></div><p class="hint">سوّ بنر بعنوانك ولونك وصورك، واختر وش يصير لما الزبون يضغط عليه.</p><div class="alist">' +
        (st.bans.length ? st.bans.map(function(b){
          return '<div class="banrow custom"><div class="ban-prev">' + (prev[b.id] || '') + '</div><div class="ban-side"><div class="sec-head" style="margin:0"><b>' + esc(b.title || "بنر بدون عنوان") + '</b><button class="del" type="button" data-bandel="' + b.id + '">حذف البنر</button></div>' + thumbs(b.ids) + banEditor(b.id, b, true) + '</div></div>'; }).join("") : '<p class="empty">ما فيه بنرات خاصة. اضغط «+ بنر جديد».</p>') + '</div></div>' +
      '<div class="card"><div class="sec-head" style="margin:0"><h2>منتجات «لك»</h2><button class="btn btn-brand" type="button" id="fyPick">اختر المنتجات</button></div><p class="hint">المنتجات اللي تطلع أول شي في فلتر «لك» بالصفحة الرئيسية، بالترتيب اللي تحدده بالأسهم. بعدها تطلع باقي المنتجات، إلا إذا علّمت «المختارة بس».</p>' +
        '<label class="chk"><input type="checkbox" id="fyOnly"' + (st.forOnly ? ' checked' : '') + '>اعرض المنتجات المختارة بس</label><div class="alist">' +
        (st.forYou.length ? st.forYou.map(function(id, i){ var p = dById(id); return '<div class="lay-row"><span class="pos">' + (i + 1) + '</span><span class="fy-img">' + imgTag(p.img, "") + '</span><b>' + esc(p.name) + '</b>' + mvBtns("fy", id, true) + '<button class="del" type="button" data-fydel="' + id + '">شيل</button></div>'; }).join("") : '<p class="empty">ما اخترت منتجات. الحين «لك» يعرض كل المنتجات، والعروض أول.</p>') + '</div></div>';
  }
  function onBanInput(e){
    if (mode !== "admin" || !e.target.dataset || !e.target.dataset.be) return;
    var k = e.target.dataset.be.split(":"), o = beObj(k[0]), f = k[1], t = e.target;
    if (t.type === "checkbox") { if (t.checked) o[f] = true; else delete o[f]; }
    else if (f === "picsN") { if (Number(t.value) === 3) delete o.picsN; else o.picsN = Number(t.value); }
    else if (f === "bprice") { var bv = Number(t.value); if (bv > 0) o.bprice = Math.round(bv * 100) / 100; else delete o.bprice; }
    else if (t.value.trim()) o[f] = t.value; else if (f !== "title" || !o.ids) delete o[f]; else o[f] = "";
    markDirty();
    if (e.type === "change" || t.type === "color") { var y = window.scrollY; renderBans(); window.scrollTo(0, y); }
  }
  document.addEventListener("input", onBanInput); document.addEventListener("change", onBanInput);
  document.addEventListener("change", function(e){ if (mode === "admin" && e.target.id === "fyOnly") { if (e.target.checked) draft.store.forOnly = true; else delete draft.store.forOnly; markDirty(); } });
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t, st = draft.store;
    if ((t = e.target.closest("[data-banpick]"))) { var id = t.dataset.banpick; ppOpen("صور بنر: " + PROMO_LABEL[id], "أول ٣ منتجات تطلع صورها داخل البنر (المنتجات اللي لها صورة حقيقية بس).", st.banPicks[id] || [], function(ids){ if (ids.length) st.banPicks[id] = ids; else delete st.banPicks[id]; renderBans(); }); return; }
    if ((t = e.target.closest("[data-bestyle]"))) { var ks = t.dataset.bestyle.split(":"), os = beObj(ks[0]); os.style = ks[1]; markDirty(); var ys = window.scrollY; renderBans(); window.scrollTo(0, ys); return; }
    if ((t = e.target.closest("[data-bedsum]"))) { var bd = t.parentNode; banOpen[t.dataset.bedsum] = !bd.open; return; }
    if ((t = e.target.closest("[data-becolor]"))) { var kc2 = t.dataset.becolor.split(":"), ob = beObj(kc2[0]); if (kc2[1]) ob.color = kc2[1]; else { delete ob.color; delete ob.color2; } markDirty(); var y1 = window.scrollY; renderBans(); window.scrollTo(0, y1); return; }
    if ((t = e.target.closest("[data-begrad]"))) { var og = beObj(t.dataset.begrad); if (og.color2) delete og.color2; else { og.color2 = "#FFD84D"; if (!og.color) og.color = "#E8394F"; } markDirty(); var y2 = window.scrollY; renderBans(); window.scrollTo(0, y2); return; }
    if ((t = e.target.closest("[data-banimg]"))) { pickTarget = "ban:" + t.dataset.banimg; $("pickFile").click(); return; }
    if ((t = e.target.closest("[data-banimgdel]"))) { delete beObj(t.dataset.banimgdel).img; delete beObj(t.dataset.banimgdel).showText; markDirty(); renderBans(); return; }
    if ((t = e.target.closest("[data-bereset]"))) { delete st.banEdit[t.dataset.bereset]; delete st.banPicks[t.dataset.bereset]; markDirty(); renderBans(); return; }
    if ((t = e.target.closest("[data-banauto]"))) { delete st.banPicks[t.dataset.banauto]; markDirty(); renderBans(); return; }
    if (e.target.closest("#addBan")) { st.bans.push({ id: uid("b"), title: "عرض خاص", color: BAN_COLORS[st.bans.length % BAN_COLORS.length], ids: [] }); markDirty(); renderBans(); renderLayout(); return; }
    if ((t = e.target.closest("[data-bancolor]"))) { var kc = t.dataset.bancolor.split(":"); st.bans.forEach(function(b){ if (b.id === kc[0]) b.color = kc[1]; }); markDirty(); renderBans(); return; }
    if ((t = e.target.closest("[data-banprods]"))) { var bb = st.bans.filter(function(b){ return b.id === t.dataset.banprods; })[0]; ppOpen("منتجات البنر: " + (bb.title || ""), "تطلع للزبون لما يضغط على البنر، وأول ٣ صور تطلع داخل البنر.", bb.ids || [], function(ids){ bb.ids = ids; renderBans(); }); return; }
    if ((t = e.target.closest("[data-bandel]"))) { if (t.dataset.c !== "1") { t.dataset.c = "1"; t.textContent = "متأكد؟ اضغط ثاني"; return; }
      st.bans = st.bans.filter(function(b){ return b.id !== t.dataset.bandel; }); if (st.promos) st.promos = st.promos.filter(function(x){ return x.id !== t.dataset.bandel; }); markDirty(); renderBans(); renderLayout(); return; }
    if (e.target.closest("#fyPick")) { ppOpen("منتجات «لك»", "رتّبها بعدين بالأسهم.", st.forYou || [], function(ids){ st.forYou = ids; renderBans(); }); return; }
    if ((t = e.target.closest("[data-fydel]"))) { st.forYou = st.forYou.filter(function(id){ return id !== t.dataset.fydel; }); markDirty(); renderBans(); return; }
  });

  /* ---------- analytics ---------- */
  var statMetric = "revenue";
  function renderStats(){
    var box = $("aStats"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">التحليل يحتاج خادم الطلبات.</p></div>'; return; }
    box.innerHTML = '<div class="card"><div class="sec-head" style="margin:0"><h2>التحليل</h2><div class="pays seg" role="group" aria-label="المدة">' + [[1,"اليوم"],[7,"٧ أيام"],[30,"٣٠ يوم"],[90,"٣ شهور"],[365,"سنة"]].map(function(x){ return '<button type="button" data-sdays="' + x[0] + '" aria-pressed="' + (statDays === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div></div><div id="aStatBody" class="hint">جاري التحميل…</div></div>';
    api("/admin/stats", { pin: adminPin, days: statDays }).then(function(j){
      var el = $("aStatBody"); if (!el) return;
      if (!j.ok) { el.textContent = j.code === "config" ? "التحليل يحتاج قاعدة الطلبات (DB) في Cloudflare، وتحديث كود الخادم." : j.code === "not_found" ? "حدّث كود الخادم في Cloudflare عشان يشتغل التحليل (الدليل، القسم ٨)." : "ما قدرنا نجيب التحليل (" + (j.code || "?") + ")."; return; }
      statCache = j; statNames = j.names || {}; el.className = "stat-body"; el.innerHTML = statsHTML(j);
    });
  }
  function mny(v){ v = Number(v || 0); return Math.abs(v) >= 10000 ? num(Math.round(v)) : num(v); }   // المبالغ بالهللة لين ١٠ آلاف (المالك يبي الأرقام مضبوطة)، وفوقها ريال صحيح
  var statNames = {};   // أسماء «منتج من عندي» (c:…) يرجعها الخادم مع التحليل
  function pname(id){ var p = dById(id); return p ? p.name : statNames[id] ? statNames[id] + " (من عندنا)" : String(id).indexOf("c:") === 0 ? "منتج من عندنا (بالكتابة)" : "منتج محذوف"; }
  function pct(a, b){ return b ? Math.round(a / b * 100) : 0; }
  var PREV_OK = true;
  function prevOk(j){ var old = j.daily.filter(function(d){ return d.day < j.from && d.orders > 0; }).length; return old >= Math.max(1, Math.floor(j.days * 0.7)); }
  function delta(cur, prev, invert){ if (!PREV_OK) return ''; if (!prev) return cur ? '<em class="dl up">جديد</em>' : ''; var d = Math.round((cur - prev) / Math.abs(prev) * 100); if (!d) return '<em class="dl">نفس الفترة اللي قبل</em>'; var good = invert ? d < 0 : d > 0; return '<em class="dl ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '٪ عن الفترة اللي قبل</em>'; }
  function sumDays(list){ var o = { cost: 0, orders: 0, revenue: 0, items: 0, card: 0, fees: 0, canceled: 0, newc: 0, deliv_ms: 0, deliv_n: 0, deliv_rev: 0, visits: 0, carts: 0, checkouts: 0 }; list.forEach(function(d){ Object.keys(o).forEach(function(k){ o[k] += Number(d[k] || 0); }); }); return o; }
  function sec(title, body, hint){ return '<section class="an-sec"><h3>' + title + '</h3>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + body + '</section>'; }
  var DOW = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  function statsHTML(j){
    var cur = j.daily.filter(function(d){ return d.day >= j.from; }), old = j.daily.filter(function(d){ return d.day < j.from; });
    var A = sumDays(cur), B = sumDays(old), avg = A.orders ? A.revenue / A.orders : 0, avgB = B.orders ? B.revenue / B.orders : 0;
    PREV_OK = prevOk(j);
    var tile = function(v, l, d){ return '<div class="stat"><b>' + v + '</b><span>' + l + '</span>' + (d || '') + '</div>'; };
    var dmin = A.deliv_n ? Math.round(A.deliv_ms / A.deliv_n / 60000) : null;
    var withCost = j.items.filter(function(x){ return x.qty > 0 && x.cost > 0; }), revC = withCost.reduce(function(a, x){ return a + x.revenue; }, 0), costC = withCost.reduce(function(a, x){ return a + x.cost; }, 0);
    var tipsH = tipsHTML(insights(j), true);
    var h = tipsH + '<div class="stats mini an-tiles">' +
      (costC > 0 ? tile(num(Math.round(revC - costC)), "ريال ربح" + (withCost.length < j.items.filter(function(x){ return x.qty > 0; }).length ? " (للمنتجات اللي لها سعر شراء)" : ""), delta(A.revenue - A.cost, B.revenue - B.cost)) + tile(pct(revC - costC, revC) + '٪', "هامش الربح", '') : '') +
      tile(num(A.orders), "طلب", delta(A.orders, B.orders)) + tile(mny(A.revenue), "ريال مبيعات", delta(A.revenue, B.revenue)) +
      tile(A.orders ? num(Math.round(avg * 10) / 10) : '—', "ريال متوسط الطلب", delta(avg, avgB)) + tile(num(A.items), "قطعة انباعت", delta(A.items, B.items)) +
      tile(num((j.customers || {}).fresh || 0), "زبون جديد", delta((j.customers || {}).fresh || 0, (j.customers || {}).freshPrev || 0)) + tile(A.orders + A.canceled ? pct(A.canceled, A.orders + A.canceled) + '٪' : '—', "نسبة الإلغاء (" + num(A.canceled) + ")", delta(A.canceled, B.canceled, true)) +
      tile(dmin == null ? '—' : num(dmin) + ' د', "متوسط وقت التوصيل", dmin == null ? '' : delta(A.deliv_ms / A.deliv_n, B.deliv_n ? B.deliv_ms / B.deliv_n : 0, true)) + tile(A.visits ? pct(A.orders, A.visits) + '٪' : '—', "من الزيارات صارت طلبات", '') + '</div>';
    h += '<div class="st-split"><div><span>انطلب</span><b>' + num(A.orders) + ' طلب</b><em>' + mny(A.revenue) + ' ر.س</em></div><div class="ok"><span>تم توصيله</span><b>' + num(A.deliv_n) + ' طلب</b><em>' + mny(A.deliv_rev) + ' ر.س</em></div><div class="wait"><span>لسا ما توصّل</span><b>' + num(Math.max(0, A.orders - A.deliv_n)) + ' طلب</b><em>' + mny(Math.max(0, Math.round((A.revenue - A.deliv_rev) * 100) / 100)) + ' ر.س</em></div><div class="no"><span>انلغى</span><b>' + num(A.canceled) + ' طلب</b><em>ما ينحسب في المبيعات</em></div></div>' +
      '<div class="verify" id="aVerify"><span class="ic">' + ic("check") + '</span><span class="t"><b>دقة الأرقام</b><span id="aVerifyMsg">تقدر تراجع إن أرقام هذي المدة مطابقة لسجل الطلبات طلب طلب.</span></span><button class="btn btn-soft" type="button" id="aVerifyBtn">راجع الحين</button></div>';
    if (!A.orders && !A.visits) return h + '<p class="hint">ما فيه بيانات في هذي المدة للحين. التحليل يتجمع من بعد تحديث كود الخادم.</p>';
    // chart
    var days = [], map = {}; cur.forEach(function(d){ map[d.day] = d; });
    var start = new Date(j.from + "T00:00:00Z"), n = Math.min(j.days, 366);
    for (var i = 0; i < n; i++) { var ds = new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10); days.push(map[ds] || { day: ds }); }
    if (n > 92) { var wk = []; for (var w = 0; w < days.length; w += 7) { var g = days.slice(w, w + 7), sm = sumDays(g); sm.day = g[0].day; wk.push(sm); } days = wk; }
    var MET = { revenue: ["المبيعات", " ر.س"], orders: ["الطلبات", " طلب"], visits: ["الزيارات", " زيارة"] };
    var val = function(d){ return Number(d[statMetric] || 0); }, mx = Math.max.apply(null, days.map(val)) || 1, W = 640, H = 160, bw = W / days.length;
    var bars = days.map(function(d, i){ var v = val(d), hh = v / mx * (H - 22); return '<g class="bar"><rect class="hit" x="' + (i * bw) + '" y="0" width="' + bw + '" height="' + H + '"></rect>' + (v ? '<rect class="m" x="' + (i * bw + Math.max(0.5, bw * 0.14)) + '" y="' + (H - 18 - hh) + '" width="' + Math.max(1.5, bw * 0.72) + '" height="' + hh + '" rx="' + Math.min(4, bw * 0.3) + '"></rect>' : '') + '<title>' + d.day + (n > 92 ? ' (أسبوع)' : '') + ': ' + num(Math.round(v)) + MET[statMetric][1] + '</title></g>'; }).join("");
    h += sec(MET[statMetric][0] + (n > 92 ? ' كل أسبوع' : ' كل يوم'), '<div class="pays seg mini" role="group">' + Object.keys(MET).map(function(k){ return '<button type="button" data-smetric="' + k + '" aria-pressed="' + (statMetric === k) + '">' + MET[k][0] + '</button>'; }).join("") + '</div>' +
      '<div class="chartbox"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + MET[statMetric][0] + '، أعلى قيمة ' + Math.round(mx) + '" preserveAspectRatio="none"><line class="base" x1="0" x2="' + W + '" y1="' + (H - 18) + '" y2="' + (H - 18) + '"></line>' + bars + '</svg><div class="axis"><span>' + days[0].day.slice(5) + '</span><span>أعلى: ' + num(Math.round(mx)) + MET[statMetric][1] + '</span><span>' + days[days.length - 1].day.slice(5) + '</span></div></div>');
    // funnel
    if (A.visits) { var fun = [["زاروا المتجر", A.visits], ["أضافوا للسلة", A.carts], ["فتحوا صفحة الطلب", A.checkouts], ["أرسلوا الطلب", A.orders]];
      h += sec("رحلة الزبون (تقريبي)", '<p class="hint">الأرقام الدقيقة (زوار مختلفين، مصادر، دقة العدّاد) في <button type="button" class="linkbtn" data-atab="visits">الزوار والتحويل</button>.</p><div class="funnel">' + fun.map(function(x){ return '<div class="frow"><span>' + x[0] + '</span><i class="meter"><i style="width:' + Math.max(2, pct(x[1], A.visits)) + '%"></i></i><b>' + num(x[1]) + '</b><em>' + pct(x[1], A.visits) + '٪</em></div>'; }).join("") + '</div>' +
        (A.carts > A.orders ? '<p class="hint">' + num(A.carts - A.orders) + ' زيارة أضافت للسلة وما كمّلت الطلب. جرّب توصيل مجاني أقل، أو عرض يشجّع.</p>' : ''), "كل زيارة تنحسب مرة. ما نحفظ أي بيانات شخصية للزوار."); }
    // heatmap weekday x hour
    if (j.hours.length) { var hm = {}, hmx = 0, byDow = [0,0,0,0,0,0,0], byH = {};
      j.hours.forEach(function(x){ var dw = new Date(x.day + "T12:00:00Z").getUTCDay(), k = dw + ":" + x.hour; hm[k] = (hm[k] || 0) + x.orders; hmx = Math.max(hmx, hm[k]); byDow[dw] += x.orders; byH[x.hour] = (byH[x.hour] || 0) + x.orders; });
      var bestD = byDow.indexOf(Math.max.apply(null, byDow)), bestH = Object.keys(byH).sort(function(a, b){ return byH[b] - byH[a]; })[0];
      var hl = function(hr){ hr = Number(hr); return (hr % 12 || 12) + (hr < 12 ? ' الصبح' : hr < 17 ? ' الظهر' : ' بالليل'); };
      h += sec("أوقات الطلب", '<p class="an-lead">أكثر يوم: <b>' + DOW[bestD] + '</b> · أكثر ساعة: <b>' + hl(bestH) + '</b></p><div class="heat" role="table" aria-label="الطلبات حسب اليوم والساعة"><div class="hrow head"><span></span>' + [0,3,6,9,12,15,18,21].map(function(x){ return '<em style="grid-column:span 3">' + (x % 12 || 12) + (x < 12 ? 'ص' : 'م') + '</em>'; }).join("") + '</div>' +
        [6,0,1,2,3,4,5].map(function(dw){ var row = ''; for (var hr = 0; hr < 24; hr++) { var v = hm[dw + ":" + hr] || 0, lv = v ? Math.ceil(v / hmx * 4) : 0; row += '<i class="l' + lv + '" title="' + DOW[dw] + ' ' + hl(hr) + ': ' + v + ' طلب"></i>'; } return '<div class="hrow"><span>' + DOW[dw] + '</span>' + row + '</div>'; }).join("") + '</div>', "كل مربع ساعة. كل ما غمق، كثرت الطلبات. استفد منها في وقت المندوب والخبز الحار."); }
    // categories
    var catRev = {}, catQty = {}; j.items.forEach(function(x){ var p = dById(x.id), c = p ? p.cat : "?"; catRev[c] = (catRev[c] || 0) + x.revenue; catQty[c] = (catQty[c] || 0) + x.qty; });
    var cats = Object.keys(catRev).filter(function(c){ return catRev[c] > 0; }).sort(function(a, b){ return catRev[b] - catRev[a]; }), tot = cats.reduce(function(s2, c){ return s2 + catRev[c]; }, 0);
    if (cats.length) h += sec("المبيعات حسب القسم", '<div class="tbl">' + cats.map(function(c){ var cc = draft.cats.filter(function(x){ return x.id === c; })[0]; return '<div class="trow cat"><span class="nm">' + esc(cc ? cc.name : "أخرى") + '<i class="meter"><i style="width:' + pct(catRev[c], catRev[cats[0]]) + '%"></i></i></span><span class="v">' + num(Math.round(catRev[c])) + ' ر.س</span><span class="v muted">' + pct(catRev[c], tot) + '٪ · ' + num(catQty[c]) + ' قطعة</span></div>'; }).join("") + '</div>');
    // top products with trend
    var sold = j.items.filter(function(x){ return x.qty > 0; }), tmax = sold.length ? sold[0].qty : 1;
    if (sold.length) h += sec("الأكثر مبيعًا", '<div class="tbl">' + sold.slice(0, 15).map(function(x, i){ var p = dById(x.id);
      return '<div class="trow"><span class="pos">' + (i + 1) + '</span>' + (p ? imgTag(p.img, "") : '<span></span>') + '<span class="nm">' + esc(pname(x.id)) + '<i class="meter"><i style="width:' + pct(x.qty, tmax) + '%"></i></i></span><span class="v">' + num(x.qty) + ' قطعة' + (x.prev ? (x.qty > x.prev ? ' <em class="dl up">▲</em>' : x.qty < x.prev ? ' <em class="dl down">▼</em>' : '') : '') + '</span><span class="v">' + num(Math.round(x.revenue)) + ' ر.س</span><span class="v muted">' + (x.cost > 0 ? '<b class="' + (x.revenue - x.cost < x.revenue * 0.1 ? 'down' : 'up') + '">ربح ' + num(Math.round(x.revenue - x.cost)) + '</b> · ' : '') + 'في ' + pct(x.orders, A.orders) + '٪ من الطلبات</span></div>'; }).join("") + '</div>');
    // movers
    var movers = j.items.filter(function(x){ return x.prev > 0 || x.qty > 0; }).map(function(x){ return { id: x.id, d: x.qty - x.prev, qty: x.qty, prev: x.prev }; });
    var up = movers.filter(function(m){ return m.d > 0 && m.prev; }).sort(function(a, b){ return b.d - a.d; }).slice(0, 5), down = movers.filter(function(m){ return m.d < 0; }).sort(function(a, b){ return a.d - b.d; }).slice(0, 5);
    if (up.length || down.length) h += sec("اللي زاد واللي نقص", '<div class="two">' + '<div class="tbl"><b class="up">زاد بيعه</b>' + (up.map(moverRow).join("") || '<p class="hint">—</p>') + '</div><div class="tbl"><b class="down">نقص بيعه</b>' + (down.map(moverRow).join("") || '<p class="hint">—</p>') + '</div></div>', "مقارنة بنفس المدة اللي قبلها.");
    // viewed but not bought
    var vmap = {}; j.views.forEach(function(v){ vmap[v.id] = v; }); var smap = {}; j.items.forEach(function(x){ smap[x.id] = x.qty; });
    var cold = j.views.filter(function(v){ return v.views >= 3 && dById(v.id); }).map(function(v){ return { id: v.id, views: v.views, carts: v.carts, sold: smap[v.id] || 0 }; }).filter(function(v){ return v.sold <= v.views * 0.15; }).sort(function(a, b){ return b.views - a.views; }).slice(0, 10);
    if (cold.length) h += sec("يشوفونه وما يشترونه", '<div class="tbl">' + cold.map(function(v){ var p = dById(v.id); return '<div class="trow cold">' + imgTag(p.img, "") + '<span class="nm">' + esc(p.name) + '</span><span class="v">' + num(v.views) + ' مشاهدة</span><span class="v">' + num(v.sold) + ' انباع</span><span class="v muted">' + num(p.price) + ' ر.س</span></div>'; }).join("") + '</div>', "منتجات ينفتح عليها كثير وقليل اللي يشتريها. ممكن السعر عالي، أو الصورة ما توضح.");
    // searches
    if (j.searches.length) { var miss = j.searches.filter(function(x){ return x.miss > 0; }).sort(function(a, b){ return b.miss - a.miss; });
      h += sec("وش يدوّرون عليه", '<div class="two"><div class="tbl"><b>أكثر شي يبحثون عنه</b><div class="tags">' + j.searches.slice(0, 20).map(function(x){ return '<span class="atag">' + esc(x.q) + ' <em>' + x.n + '</em></span>'; }).join("") + '</div></div>' +
        '<div class="tbl"><b class="down">دوّروا عليه وما لقوه</b>' + (miss.length ? '<div class="tags">' + miss.slice(0, 20).map(function(x){ return '<span class="atag miss">' + esc(x.q) + ' <em>' + x.miss + '</em></span>'; }).join("") + '</div><p class="hint">هذي فرص: منتجات يبغونها وما عندك، أو موجودة باسم ثاني.</p>' : '<p class="hint">كل اللي دوّروا عليه لقوه.</p>') + '</div></div>'); }
    // stock forecast + dead stock
    var per = {}; j.items.forEach(function(x){ per[x.id] = x.qty / j.days; });
    var fc = draft.products.filter(function(p){ return per[p.id] > 0 && qtyOf(p.id) != null && qtyOf(p.id) > 0; }).map(function(p){ return { p: p, q: qtyOf(p.id), d: qtyOf(p.id) / per[p.id] }; }).filter(function(x){ return x.d <= 14; }).sort(function(a, b){ return a.d - b.d; });
    var dead = draft.products.filter(function(p){ return p.stock && !(smap[p.id] > 0); });
    h += sec("المخزون", (fc.length ? '<div class="tbl"><b>بيخلص قريب (حسب سرعة البيع)</b>' + fc.slice(0, 12).map(function(x){ return '<div class="trow fc">' + imgTag(x.p.img, "") + '<span class="nm">' + esc(x.p.name) + '</span><span class="v">باقي ' + num(x.q) + '</span><span class="v ' + (x.d < 3 ? 'down' : '') + '"><b>يخلص بعد ' + (x.d < 1 ? 'أقل من يوم' : num(Math.round(x.d)) + ' يوم') + '</b></span></div>'; }).join("") + '</div>' : '<p class="hint">ما فيه منتج بيخلص خلال أسبوعين (للمنتجات اللي حاط لها كمية).</p>') +
      (dead.length && A.orders >= 5 ? '<div class="tbl"><b>ما انباع ولا قطعة في هذي المدة (' + num(dead.length) + ')</b><div class="tags">' + dead.slice(0, 30).map(function(p){ return '<span class="atag">' + esc(p.name) + '</span>'; }).join("") + '</div></div>' : ''));
    // customers
    var C = j.customers || {};
    if (C.total) h += sec("الزبائن", '<div class="stats mini">' + tile(num(C.total || 0), "زبون من البداية") + tile(num(C.active || 0), "طلبوا في هذي المدة") + tile(num(C.fresh || 0), "أول طلب لهم") + tile(num(C.loyal || 0), "رجعوا وطلبوا مرة ثانية") + tile(num(C.gone || 0), "زبائن متكررين ما طلبوا من شهر") + '</div>' +
      (j.topCustomers.length ? '<div class="tbl"><b>أفضل الزبائن</b>' + j.topCustomers.map(function(c, i){ return '<div class="trow cust"><span class="pos">' + (i + 1) + '</span><span class="nm">' + esc(c.name || "زبون") + '<br><span dir="ltr">' + esc(c.phone || ("05•••" + c.tail)) + '</span>' + contactButtons(c.phone) + '</span><span class="v">' + num(c.orders) + ' طلب</span><span class="v">' + num(Math.round(c.revenue)) + ' ر.س</span><span class="v muted">آخر طلب ' + esc(c.last) + '</span></div>'; }).join("") + '</div>' : ''),
      "الزبون يتعرّف برقم جواله، ونحفظ آخر ٤ أرقام بس. «ما طلبوا من شهر» فرصة: كلمهم بعرض.");
    // payment + fees
    h += sec("اختيارات الدفع الأصلية والتوصيل", '<div class="stats mini">' + tile(pct(A.orders - A.card, A.orders) + '٪', "اختار كاش") + tile(pct(A.card, A.orders) + '٪', "اختار شبكة") + tile(num(Math.round(A.fees)), "ريال رسوم توصيل") + tile(num(A.orders ? Math.round(A.items / A.orders * 10) / 10 : 0), "قطعة في الطلب الواحد") + '</div>');
    // bought together
    var rules = [];
    j.pairs.forEach(function(pr){ [[pr.a, pr.b], [pr.b, pr.a]].forEach(function(ab){ var base = j.ordersWith[ab[0]] || 0; if (base >= 2 && pr.n > 0 && dById(ab[0]) && dById(ab[1])) rules.push({ x: ab[0], y: ab[1], n: pr.n, base: base, c: pr.n / base }); }); });
    rules.sort(function(a, b){ return b.c - a.c || b.n - a.n; });
    h += sec("يشترونها مع بعض", rules.length ? '<div class="tbl">' + rules.slice(0, 20).map(function(r){ var px = dById(r.x), already = (px.sugg || []).indexOf(r.y) > -1;
        return '<div class="trow rule">' + imgTag(px.img, "") + '<span class="nm">اللي ياخذون <b>' + esc(px.name) + '</b> ياخذون معه <b>' + esc(pname(r.y)) + '</b></span><span class="v"><b>' + Math.round(r.c * 100) + '٪</b> <small class="muted">(' + r.n + ' من ' + r.base + ' طلب)</small></span>' +
          (already ? '<span class="v muted">مقترح ✓</span>' : '<button class="btn btn-soft sm" type="button" data-mksugg="' + r.x + ':' + r.y + '">حطه مقترح</button>') + '</div>'; }).join("") + '</div>' : '<p class="empty">لسا ما فيه منتجات تتكرر مع بعض في أكثر من طلب.</p>', "من كل الطلبات من البداية. زر «حطه مقترح» يضيفه في «يحلى معه» بصفحة المنتج.");
    h += '<div class="actions an-exp"><button class="btn btn-soft" type="button" id="expStats">' + ic("box") + 'نزّل التحليل (Excel)</button></div>';
    return h;
  }
  function moverRow(m){ var p = dById(m.id); return '<div class="trow mv">' + (p ? imgTag(p.img, "") : '<span></span>') + '<span class="nm">' + esc(pname(m.id)) + '</span><span class="v">' + num(m.prev) + ' ← ' + num(m.qty) + '</span></div>'; }
  function csvDownload(name, rows){
    var csv = "﻿" + rows.map(function(r){ return r.map(function(c){ c = c == null ? "" : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportStats(j){
    var rows = [["اليوم","الطلبات","المبيعات","القطع","شبكة","رسوم التوصيل","ملغي","زبائن جدد","زيارات"]];
    j.daily.filter(function(d){ return d.day >= j.from; }).forEach(function(d){ rows.push([d.day, d.orders, d.revenue, d.items || 0, d.card || 0, d.fees || 0, d.canceled || 0, d.newc || 0, d.visits || 0]); });
    rows.push([]); rows.push(["المنتج","القطع","المبيعات","عدد الطلبات"]);
    j.items.filter(function(x){ return x.qty > 0; }).forEach(function(x){ rows.push([pname(x.id), x.qty, x.revenue, x.orders]); });
    csvDownload("تحليل-متاجر-أحد-" + j.from + ".csv", rows);
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-sdays]"))) { statDays = Number(t.dataset.sdays); renderStats(); return; }
    if ((t = e.target.closest("[data-smetric]"))) { statMetric = t.dataset.smetric; if (statCache) $("aStatBody").innerHTML = statsHTML(statCache); return; }
    if (e.target.closest("#expStats") && statCache) { exportStats(statCache); return; }
    if ((t = e.target.closest("#aVerifyBtn, #aFixBtn")) && statCache) { var fix = t.id === "aFixBtn", m = $("aVerifyMsg"), vb = $("aVerify"); t.disabled = true; m.textContent = fix ? "جاري التصحيح…" : "جاري المراجعة طلب طلب…";
      api("/admin/verify", { pin: adminPin, from: statCache.from, fix: fix }).then(function(v){ t.disabled = false;
        if (!v.ok) { m.textContent = v.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما قدرنا نراجع (" + (v.code || "?") + ")."; return; }
        if (v.clean || v.fixed) { vb.className = "verify good"; m.innerHTML = (v.fixed ? 'تصحّحت، والحين ' : '') + '<b>مطابقة ١٠٠٪</b> لسجل الطلبات: ' + num(v.totals.orders) + ' طلب، ' + mny(v.totals.revenue) + ' ر.س، ' + num(v.totals.canceled) + ' ملغي.' + (v.legacy ? ' (فيه ' + v.legacy + ' طلب قديم لسا ما انضاف، اضغط راجع مرة ثانية)' : ''); var fb = $("aFixBtn"); if (fb) fb.remove(); if (v.fixed) renderStats(); return; }
        vb.className = "verify bad"; m.innerHTML = 'لقينا فرق: ' + v.dayDiffCount + ' رقم يومي، ' + v.itemDiffs + ' منتج، ' + v.hourDiffs + ' ساعة، ' + v.pairDiffs + ' زوج منتجات. سجل الطلبات هو الصح، اضغط «صحّح» عشان التحليل يتطابق معه.';
        if (!$("aFixBtn")) t.insertAdjacentHTML("afterend", '<button class="btn btn-brand" type="button" id="aFixBtn">صحّح</button>'); }); return; }
    if ((t = e.target.closest("[data-mksugg]"))) { var k = t.dataset.mksugg.split(":"), p = dById(k[0]); if (!p) return; p.sugg = (p.sugg || []).filter(function(id){ return id !== k[1]; }); p.sugg.push(k[1]); markDirty();
      if (statCache && $("aStatBody")) $("aStatBody").innerHTML = statsHTML(statCache); return; }
  });

  /* ---------- notifications (admin) ---------- */
  function renderPush(){
    var box = $("pushCard"); if (!box) return;
    var la = draft.store.lowAt == null ? 3 : draft.store.lowAt;
    box.innerHTML = '<h2>الإشعارات</h2><p class="hint">تنبيهات على الجوال: الإدارة يوصلها كل طلب جديد، ولما منتج يقرب يخلص أو يخلص. المندوب يفعّلها من صفحته، والزبون من صفحة طلبه.</p>' +
      '<div class="push-stat" id="pushStat">جاري الفحص…</div>' +
      '<div class="actions"><button class="btn btn-brand" type="button" id="pushAdm">' + ic("bell") + 'فعّل الإشعارات على هذا الجهاز</button><button class="btn btn-soft" type="button" id="pushTest">أرسل إشعار تجربة</button></div><p class="status" id="pushMsgA" aria-live="polite"></p>' +
      (isIOS() && !isApp() ? '<p class="hint">على الآيفون: الإشعارات تشتغل بس لما تضيف المتجر للشاشة الرئيسية (زر المشاركة ← «إضافة إلى الشاشة الرئيسية») وتفتحه من الأيقونة.</p>' : '') +
      '<h2 style="margin-top:14px">تقرير آخر اليوم</h2><p class="hint">يوصل أجهزة الإدارة اللي مفعّلة الإشعارات (وتيليجرام لو مربوط) كل ليلة: الطلبات، المبيعات، الربح، كاش المندوب، والمنتجات اللي بتخلص. يحتاج تفعيل مرة وحدة في Cloudflare (الدليل، القسم ٩).</p>' +
      '<div class="actions"><button class="btn btn-soft" type="button" id="repTest">أرسل تقرير اليوم الحين</button></div><p class="status" id="repMsg" style="white-space:pre-line"></p>' +
      '<div class="fields" style="max-width:420px"><label for="sLow">نبّهني لما يبقى من المنتج (قطعة أو أقل)، ويطلع للزبون «باقي X بس»<input id="sLow" type="number" min="0" step="1" inputmode="numeric" value="' + esc(la) + '"></label></div>';
    $("repTest").addEventListener("click", function(){ var m = $("repMsg"); m.className = "status"; m.textContent = "جاري الإرسال…";
      api("/admin/report-test", { pin: adminPin }).then(function(j){ if (!j.ok) { m.className = "status err"; m.textContent = j.code === "not_found" ? "حدّث كود الخادم أول." : "ما انرسل."; return; } m.textContent = "انرسل:\n" + j.report.title + "\n" + j.report.body; }); });
    $("sLow").addEventListener("input", function(){ var v = Math.max(0, Math.floor(Number(this.value || 0))); draft.store.lowAt = v; markDirty(); });
    $("pushAdm").addEventListener("click", function(){ var b = this, m = $("pushMsgA"); b.disabled = true; m.className = "status"; m.textContent = "جاري التفعيل…";
      pushSub().then(function(sub){ return api("/push/sub", { pin: adminPin, sub: sub }); }).then(function(j){ b.disabled = false; if (!j.ok) throw j; m.textContent = "تفعّلت. بيوصلك إشعار تأكيد الحين."; pushStat(); })
        .catch(function(e){ b.disabled = false; m.className = "status err"; m.textContent = e && e.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول (الدليل، القسم ٨)." : pushErrText(e); }); });
    $("pushTest").addEventListener("click", function(){ var m = $("pushMsgA"); m.className = "status"; m.textContent = "جاري الإرسال…";
      api("/push/test", { pin: adminPin }).then(function(j){ m.className = j.ok && j.sent ? "status" : "status err"; m.textContent = j.ok ? (j.sent ? "انرسل لـ " + j.sent + " جهاز." : "ما فيه جهاز إدارة مفعّل الإشعارات. اضغط «فعّل» أول.") : "ما انرسل (" + (j.code || "?") + ")."; }); });
    pushStat(); promoPushUI(box);
  }
  /* ---------- إشعار للزبائن (العروض وغيرها) بعبارات جاهزة (طلب المالك ١٣ نوفمبر ٢٠٢٦) ---------- */
  // عبارات جاهزة تجذب (طلب المالك ١٤ نوفمبر ٢٠٢٦): قصيرة، بلهجتنا، وفيها أرقام حقيقية من المتجر (أقوى خصم، اسم المنتج وسعره، عرض المجموعة)
  function promoPhrases(){
    var S = D.store, nm = S.name || "متاجر أحد", fo = S.freeOver ? num(S.freeOver) : "30";
    var offs = D.products.filter(function(p){ return p.stock && p.old && Number(p.old) > Number(p.price); })
      .map(function(p){ return { p: p, pct: Math.round((1 - p.price / p.old) * 100) }; }).sort(function(a, b){ return b.pct - a.pct; });
    var mx = offs.length ? offs[0].pct : 30, top = offs[0] && offs[0].p, sh = function(p){ var n = String(p.name); return n.length <= 32 ? n : n.split(" ").slice(0, 5).join(" "); };
    var g = (S.groups || []).filter(function(x){ return x && x.on !== false; })[0];
    var cc = {}; offs.forEach(function(o){ cc[o.p.cat] = (cc[o.p.cat] || 0) + 1; });
    var bestCat = Object.keys(cc).sort(function(a, b){ return cc[b] - cc[a]; })[0], bc = bestCat && D.cats.filter(function(c){ return c.id === bestCat; })[0];
    return [
      ["🔥 أقوى خصم", "🔥 خصم " + num(mx) + "٪ ينتظرك!", top ? sh(top) + " صار بـ " + num(top.price) + " ر.س بدل " + num(top.old) + ". الكمية محدودة، الحق عليه 👀" : "عروض نار على منتجات مختارة. الحق قبل لا تخلص 👀", "offers"],
      ["⏰ قبل لا تخلص", "⏰ باقي كم حبة بس!", "العروض اللي عجبتك قاربت تخلص. افتح واطلب قبل غيرك.", "offers"],
      g ? ["🍪 " + (g.name || "عرض المجموعة"), "🍪 " + (g.name || "العرض") + ": أي " + num(g.n) + " بـ " + num(g.price) + " ر.س", "اخلط النكهات على كيفك 😋 العرض لفترة محدودة.", ""] : null,
      bc ? ["🛒 عروض " + bc.name, "🛒 عروض " + bc.name + " نزلت", num(cc[bestCat]) + " منتج عليها خصم في " + bc.name + ". شوفها الحين 👇", "o:" + bc.id] : null,
      ["🛵 توصيل مجاني", "🛵 التوصيل علينا اليوم!", "أي طلب فوق " + fo + " ر.س يوصلك مجاناً لين باب بيتك 🏠", ""],
      ["🎁 كود هدية", "🎁 عندك هدية منا", "اكتب الكود (اكتبه هنا) في السلة وخذ خصمك على طلبك الجاي 💚", ""],
      ["☕ صباح الخير", "☕ صباح الخير يا جار!", "حليب طازج وخبز حار وقهوتك… اطلبها وتوصلك قبل لا تبرد.", ""],
      ["🍽️ الغدا", "🍽️ وش ناقص غداك؟", "طماطم؟ رز؟ زيت؟ اطلب اللي ناقصك بدقيقة ونوصله لك بسرعة 🛵", ""],
      ["🌙 السهرة", "🌙 السهرة ما تحلى بدونها", "شيبس ومشروبات وحلا 🍫 جهّز سهرتك ونوصلك لين آخر الليل.", ""],
      // ——— العشاء والليل (طلب المالك ١٦ نوفمبر ٢٠٢٦)
      ["🍽️ العشاء", "🍽️ وش عشاكم الليلة؟", "خبز حار وجبن ولبنة وبيض… عشاكم كامل يوصلكم خلال دقايق 🛵", ""],
      ["🥙 عشا خفيف", "🥙 عشا خفيف وسريع؟", "فطاير طازجة من مخبزنا وعصير… جاهز بدون طبخ 😋", "o:bakery"],
      ["🍳 بيض وجبن للعشا", "🍳 عشا البيت الأصيل", "بيض وجبن وزيتون وخبز… اطلبها الحين وتوصلك قبل لا يجوعون العيال 🏠", "o:dairy"],
      ["🍗 عزيمة الليلة", "🍗 عندكم عزيمة الليلة؟", "دجاج ولحم ورز وكل لوازم الطبخة… نوصلها لين باب المطبخ 🔥", "o:meat"],
      ["🥐 الفطاير", "🥐 الفطاير طالعة من الفرن", "زعتر وجبن ولبنة وعسل وبيتزا… كلها بـ ٣٫٤٥ وتوصلك دافية 🔥", "o:bakery"],
      ["🌙 ليلتك حلوة", "🌙 ليلتك تحلى بشي حلو", "شوكولاتة وبسكويت وكيك مع كوب حليب… دلّع نفسك قبل النوم 🍫", "o:sweets"],
      ["🌃 جوعان بالليل؟", "🌃 جوعان بالليل؟", "البقالة مسكرة؟ حنا لا 😉 اطلب سناكك ونوصله لين بابك.", ""],
      ["🥛 حليب الصبح", "🥛 لا يطلع الصبح والحليب خالص", "اطلب حليب وخبز الفطور من الليل وارتاح بكرة ☀️", "o:dairy"],
      ["🍵 شاي الليل", "🍵 شاي بعد العشا؟", "شاي وقهوة وتمر وكعك… قعدة الليل تكمل فيها 🫖", ""],
      ["🎬 سهرة العيال", "🎬 سهرة العيال الليلة؟", "فشار وشيبس وعصيرات وآيسكريم 🍿 نوصلها قبل لا يبدأ الفيلم.", "o:sweets"],
      ["🏠 جمعة العائلة", "🏠 جمعتكم اليوم؟", "خلّ المقاضي علينا: كل اللي تحتاجه للعزيمة يوصلك لين الباب.", "offers"],
      ["🆕 وصلنا جديد", "🆕 وصلتنا أصناف جديدة", "تشكيلة جديدة في " + nm + " 😍 أول من يشوفها أنت.", ""],
      ["💚 اشتقنا لك", "💚 اشتقنا لك!", "صار لك فترة ما طلبت. رجّعنا لك عروض حلوة، تعال شوفها 👀", "offers"],
      ["⚡ عرض اليوم بس", "⚡ عرض اليوم بس!", "ينتهي الليلة 🕛 لا يفوتك.", "offers"],
      ["🟢 فتحنا", "🟢 فتحنا وحيّاك الله!", "نستقبل طلباتك من الحين. اطلب ونوصلك خلال ١٥–٣٠ دقيقة.", ""],
      ["📱 التطبيق", "📱 " + nm + " صار بجوالك", "حمّل التطبيق واطلب بضغطة، وتابع مندوبك لين بابك 🛵", ""],
      ["💸 الراتب نزل", "💸 الراتب نزل!", "دلّع بيتك: عروض المقاضي الشهرية جاهزة، وتوصيلك علينا 🛵", "offers"],
      ["🎉 الويكند", "🎉 جاك الويكند", "جمعتكم الليلة؟ كل اللي تحتاجه للعزيمة يوصلك لين الباب 🏠", ""],
      ["🌧️ جو مطر", "🌧️ جو مطر ☔", "لا تطلع من بيتك… مقاضيك توصلك وأنت مرتاح بالبيت.", ""],
      ["🥵 حر اليوم", "🥵 الحر ما يرحم!", "موية باردة وعصيرات وآيسكريم 🍦 نوصلها لك قبل لا تذوب.", "o:drinks"],
      ["⚽ مباراة الليلة", "⚽ المباراة الليلة!", "جهّز القعدة: شيبس ومشروبات ومكسرات 🥜 تصلك قبل صافرة البداية.", ""],
      ["🧺 مقاضي الأسبوع", "🧺 مقاضي الأسبوع بضغطة", "رز، زيت، حليب، بيض… اطلبها كلها مرة وحدة ونوصلها لين بابك.", ""],
      // ——— المزيد (طلب المالك «كثّرها»)
      ["🥚 البيض والحليب", "🥚 خلص البيض؟", "لا تنزل للبقالة… بيض وحليب طازج يوصلك خلال دقايق 🛵", "o:dairy"],
      ["🍞 خبز حار", "🍞 الخبز حار الحين!", "طالع من الفرن 🔥 اطلبه ويوصلك وهو دافي.", ""],
      ["🍫 حلا", "🍫 نفسك بحلا؟", "شوكولاتة وبسكويت وكيك… دلّع نفسك اليوم 😋", "o:sweets"],
      ["🥤 مشروبات باردة", "🥤 شي بارد؟", "مشروبات غازية وعصيرات وموية باردة، توصلك على طول ❄️", "o:drinks"],
      ["🧼 المنظفات", "🧼 وقت التنظيف!", "منظفات ومعطرات بأسعار حلوة… بيتك يلمع وأنت مرتاح ✨", "o:clean"],
      ["🍗 الدجاج واللحم", "🍗 وش طبختك اليوم؟", "دجاج ولحوم طازجة ومجمدة، اطلب وتوصلك بسرعة 🛵", "o:meat"],
      ["👶 الأطفال", "👶 أغراض الصغار", "حفايض ومناديل وحليب أطفال… كل اللي يحتاجه صغيرك يوصلك لين الباب 💚", "o:care"],
      ["🍳 الفطور", "🍳 فطور اليوم علينا", "بيض، جبن، لبنة، خبز… كل الفطور بطلب واحد ☀️", ""],
      ["🫖 الشاي والقهوة", "🫖 قهوة العصر؟", "قهوة وشاي وتمر ☕ اطلبها الحين وتلحق على العصرية.", ""],
      ["🍿 فيلم الليلة", "🍿 فيلم الليلة؟", "فشار وشيبس ومشروبات… جهّز السهرة بضغطة 🎬", "o:sweets"],
      ["📦 كرتون أوفر", "📦 الكرتون أوفر!", "اشترِ بالكرتون ووفّر أكثر على مشروباتك ومقاضيك 💰", "o:cartons"],
      ["🔁 اطلب مرة ثانية", "🔁 طلبك المعتاد؟", "رجّع نفس طلبك اللي فات بضغطة وحدة من «حسابي» ⚡", ""],
      ["🛒 سلتك تنتظرك", "🛒 نسيت شي؟", "سلتك لسا فيها أغراض 👀 كمّل طلبك قبل لا تخلص الكمية.", ""],
      ["⭐ قيّمنا", "⭐ رأيك يهمنا", "كيف كان طلبك الأخير؟ قيّمه بثانيتين وساعدنا نصير أحسن 💚", ""],
      ["🕛 نوصل لين متأخر", "🕛 ساهر؟ حنا موجودين", "نوصلك لين آخر الليل 🌙 أي شي ناقصك اطلبه الحين.", ""],
      ["🧊 آيسكريم", "🧊 آيسكريم؟ ليش لا!", "أنواع الآيسكريم توصلك وهي باردة 🍦", "o:sweets"],
      ["🥗 صحي", "🥗 تبي تاكل صحي؟", "زبادي وحليب قليل الدسم ومكسرات… خيارات صحية توصلك اليوم 💪", ""],
      ["🏫 المدرسة", "🏫 لفّة المدرسة جاهزة؟", "عصيرات وبسكويت وسناكس للفسحة 🎒 اطلبها من الليل.", ""],
      ["🕌 الجمعة", "🕌 جمعة مباركة", "غداء الجمعة على كيفك… كل المقاضي توصلك قبل الصلاة 🍽️", ""],
      ["🎁 هدية الطلب", "🎁 طلبك اليوم فيه مفاجأة", "اطلب اليوم وخذ هدية مع طلبك 🎁 (غيّر النص حسب الهدية)", ""],
      ["🏷️ أسعار نزلت", "🏷️ أسعار نزلت اليوم", "خصومات جديدة على منتجات تحبها 👇 شوفها قبل لا تخلص.", "offers"],
      ["🤝 جارنا العزيز", "🤝 يا جارنا العزيز", "حنا جنبك في حي الرمال 💚 أي شي تحتاجه يوصلك خلال ١٥–٣٠ دقيقة.", ""],
      ["🙏 اعتذار", "🙏 نعتذر منك", "صار ضغط بالطلبات اليوم. شكراً لصبرك، وطلبك الجاي علينا نهتم فيه أكثر 💚", ""]
    ].filter(Boolean).map(function(x){ x[4] = PP_SUGG[x[0]] || "all"; return x; });
  }
  // الشريحة المقترحة لكل عبارة (تنختار لحالها لما يضغط المالك العبارة، ويقدر يغيّرها)
  var PP_SUGG = { "🛒 سلتك تنتظرك": "cart", "💚 اشتقنا لك": "lapsed", "🔁 اطلب مرة ثانية": "ordered", "⭐ قيّمنا": "ordered", "🙏 اعتذار": "ordered", "🤝 جارنا العزيز": "never", "🎁 كود هدية": "never", "🆕 وصلنا جديد": "all" };
  // لمين؟ شرائح المشتركين (الخادم يحسبها من جهاز الزبون المجهول: سلته وطلباته، بدون اسم ولا جوال)
  var PP_SEGS = [["all", "الكل"], ["cart", "سلتهم فيها أغراض وما كمّلوا (من ساعتين وأكثر)"], ["never", "ما طلبوا أبداً"], ["ordered", "طلبوا قبل"], ["lapsed", "طلبوا وانقطعوا"], ["loyal", "الزبائن الدائمين (٣ طلبات وأكثر)"]];
  function promoPushUI(box){
    var wrap = document.createElement("div"); wrap.id = "promoPush"; wrap.style.marginTop = "18px";
    var ph = promoPhrases();
    wrap.innerHTML = '<h2>إشعار للزبائن (التطبيق والموقع)</h2><p class="hint">يوصل للزبائن اللي فعّلوا إشعارات العروض من التطبيق أو الموقع. اختر عبارة جاهزة، عدّلها لو تبي، وجرّبها على جوالك أول. الحد ٤ إرسالات في اليوم عشان ما نزعج الزبون.</p>' +
      '<div class="pp-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">' + ph.map(function(x, i){ return '<button type="button" class="btn btn-soft" data-ppph="' + i + '" style="padding:6px 12px;font-size:12.5px">' + esc(x[0]) + '</button>'; }).join("") + '</div>' +
      '<div class="fields" style="max-width:460px"><label>العنوان (٦٠ حرف)<input id="ppT" maxlength="60" placeholder="مثال: عروض الأسبوع نزلت"></label><label>النص (١٨٠ حرف)<textarea id="ppB" maxlength="180" rows="3" placeholder="نص قصير يشجع الزبون يفتح التطبيق"></textarea></label>' +
      '<label>لمين؟<select id="ppS">' + PP_SEGS.map(function(g){ return '<option value="' + g[0] + '">' + esc(g[1]) + '</option>'; }).join("") + '</select></label>' +
      '<label id="ppDw" hidden>ما طلبوا من كم يوم؟ (٣–٩٠)<input id="ppD" type="number" min="3" max="90" step="1" inputmode="numeric" value="14"></label>' +
      '<label>لما يضغط عليه<select id="ppG"><option value="">يفتح الرئيسية</option><option value="offers">يفتح العروض</option>' + D.cats.filter(function(c){ return !c.soon; }).map(function(c){ return '<option value="o:' + esc(c.id) + '">يفتح قسم ' + esc(c.name) + '</option>'; }).join("") + '</select></label></div>' +
      '<div class="push-stat" id="ppStat">جاري الفحص…</div><div class="actions"><button class="btn btn-soft" type="button" id="ppTest">جرّبها على جوالي</button><button class="btn btn-brand" type="button" id="ppSend">' + ic("bell") + 'أرسل للزبائن</button></div><p class="status" id="ppMsg" style="white-space:pre-line"></p>' +
      '<h3 style="margin-top:14px">تذكير السلة التلقائي</h3><p class="hint">لو الزبون حط أغراض بسلته وما كمّل الطلب، يوصله إشعار واحد «🛒 سلتك تنتظرك» بعد المدة اللي تختارها. مرة وحدة لكل سلة، وما يطلع بين ١١ الليل و٩ الصبح ولا والمتجر مقفل.</p>' +
      '<div class="fields" style="max-width:460px"><label class="chk wide"><input type="checkbox" id="ppR">شغّل التذكير التلقائي</label><label>بعد كم ساعة من آخر تعديل للسلة؟ (١–٤٨)<input id="ppRh" type="number" min="1" max="48" step="1" inputmode="numeric" value="3"></label></div>' +
      '<div class="actions"><button class="btn btn-soft" type="button" id="ppRs">احفظ التذكير</button></div><p class="status" id="ppRm"></p>';
    box.appendChild(wrap);
    var T = $("ppT"), B = $("ppB"), G = $("ppG"), M = $("ppMsg"), SG = $("ppS"), DY = $("ppD"), segN = null, segT = 0;
    var segName = function(){ var g = PP_SEGS.filter(function(x){ return x[0] === SG.value; })[0]; return g ? g[1] : "الكل"; };
    var paintSegs = function(){ var e = $("ppStat"); if (!e) return;
      $("ppDw").hidden = SG.value !== "lapsed";
      if (!segN) return;
      Array.prototype.forEach.call(SG.options, function(o, i){ o.textContent = PP_SEGS[i][1] + " (" + num(segN[o.value] || 0) + ")"; });
      e.innerHTML = '<span class="pchip">' + ic("bell") + 'مشتركين بإشعارات العروض: <b>' + num(segN.all || 0) + '</b></span><span class="pchip">بيوصل لـ: <b>' + num(segN[SG.value] || 0) + '</b></span>'; };
    var loadSegs = function(){ api("/admin/promo-segs", { pin: adminPin, days: Number(DY.value) || 14 }).then(function(j){
      if (!j.ok) { // خادم قديم: نرجع للعدد الكلي بس، والإرسال للكل
        SG.value = "all"; SG.disabled = true; $("ppR").disabled = $("ppRs").disabled = true; $("ppRm").textContent = j.code === "not_found" ? "الشرائح والتذكير يحتاجون تحديث كود الخادم في Cloudflare." : "";
        return api("/push/status", { pin: adminPin }).then(function(k){ var e = $("ppStat"); if (e) e.innerHTML = '<span class="pchip">' + ic("bell") + 'مشتركين بإشعارات العروض: <b>' + num(k.promo || 0) + '</b></span>'; }); }
      segN = j.segs; if (j.remind && !segT) { $("ppR").checked = !!j.remind.on; $("ppRh").value = j.remind.hours || 3; } segT = 1; paintSegs(); }); };
    loadSegs();
    SG.addEventListener("change", paintSegs);
    var dT = 0; DY.addEventListener("input", function(){ clearTimeout(dT); dT = setTimeout(loadSegs, 600); });
    $("ppRs").addEventListener("click", function(){ var m = $("ppRm"), h = Math.floor(Number($("ppRh").value)); m.className = "status";
      if (!(h >= 1 && h <= 48)) { m.className = "status err"; m.textContent = "المدة من ساعة لين ٤٨ ساعة."; return; }
      m.textContent = "جاري الحفظ…";
      api("/admin/promo-segs", { pin: adminPin, days: Number(DY.value) || 14, remind: { on: $("ppR").checked, hours: h } }).then(function(j){
        if (!j.ok) { m.className = "status err"; m.textContent = j.code === "forbidden" ? "ما عندك صلاحية." : "ما انحفظ (" + (j.code || "?") + ")."; return; }
        segN = j.segs; paintSegs(); m.textContent = j.remind.on ? "تشغّل: التذكير يوصل بعد " + num(j.remind.hours) + " ساعة من آخر تعديل للسلة." : "التذكير التلقائي متوقف."; }); });
    wrap.addEventListener("click", function(e){ var b = e.target.closest("[data-ppph]"); if (!b) return; var x = ph[Number(b.dataset.ppph)]; T.value = x[1]; B.value = x[2]; G.value = x[3] || ""; if (!SG.disabled) SG.value = x[4] || "all"; paintSegs(); M.textContent = ""; });
    var send = function(test){
      if (!T.value.trim() || !B.value.trim()) { M.className = "status err"; M.textContent = "اكتب العنوان والنص، أو اختر عبارة جاهزة."; return; }
      var body = { pin: adminPin, title: T.value, body: B.value, go: G.value, test: !!test, seg: SG.disabled ? "all" : SG.value, days: Number(DY.value) || 14 };
      var go = function(offset, sent){ body.offset = offset || 0; return api("/admin/promo-push", body).then(function(j){
        if (!j.ok) { M.className = "status err"; M.textContent = j.code === "daily_limit" ? "وصلت الحد اليومي (٤ إرسالات). جرّب بكرة." : j.code === "bad_message" ? "العنوان والنص مطلوبين." : j.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما انرسل (" + (j.code || "?") + ")."; return; }
        if (test) { M.className = "status"; M.textContent = j.sent ? "وصلتك التجربة على " + num(j.sent) + " جهاز." : "ما فيه جهاز إدارة مفعّل الإشعارات. فعّلها من فوق (فعّل الإشعارات على هذا الجهاز) وجرّب."; return; }
        sent += j.sent || 0; if (j.next) return go(j.next, sent);
        M.className = "status"; M.textContent = j.total ? "انرسل لـ " + num(sent) + " جهاز من " + num(j.total) + " مشترك (" + segName() + ")." : "ما فيه مشتركين بهالشريحة (" + segName() + ")، وما انحسب من الحد اليومي."; }); };
      return go(0, 0).catch(function(){ M.className = "status err"; M.textContent = "تعذّر الاتصال، جرّب مرة ثانية."; });
    };
    $("ppTest").addEventListener("click", function(){ M.className = "status"; M.textContent = "جاري الإرسال…"; send(true); });
    $("ppSend").addEventListener("click", function(){ if (!T.value.trim() || !B.value.trim()) return send(false); var cnt = segN && !SG.disabled ? segN[SG.value] : null; if (cnt === 0) { M.className = "status err"; M.textContent = "ما فيه مشتركين بهالشريحة (" + segName() + ")."; return; } if (!confirm("ترسل «" + T.value + "» لـ" + (SG.disabled || SG.value === "all" ? "كل مشتركين العروض" : "«" + segName() + "»") + (cnt != null ? " (" + num(cnt) + " جهاز)" : "") + "؟ ما تقدر تتراجع.")) return; M.className = "status"; M.textContent = "جاري الإرسال…"; send(false); });
  }
  function pushStat(){
    api("/push/status", { pin: adminPin }).then(function(j){ var el = $("pushStat"); if (!el) return;
      if (!j.ok) { el.innerHTML = '<span class="status err">' + (j.code === "not_found" ? "الإشعارات تحتاج تحديث كود الخادم في Cloudflare (الدليل، القسم ٨)." : "ما قدرنا نفحص.") + '</span>'; return; }
      el.innerHTML = '<span class="pchip">' + ic("bell") + 'أجهزة الإدارة: <b>' + j.admin + '</b></span><span class="pchip">' + ic("truck") + 'أجهزة المندوب: <b>' + j.driver + '</b></span><span class="pchip">' + ic("user") + 'زبائن ينتظرون طلباتهم: <b>' + j.customer + '</b></span>'; });
  }

  /* ---------- orders list ---------- */
  var SRC = { phone: "اتصال", whatsapp: "واتساب", store: "من المحل" };
  function renderOList(force){
    var box = $("aOList"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">قائمة الطلبات تحتاج خادم الطلبات.</p></div>'; return; }
    if ((!oState.list || force) && !oState.loading) { oState.loading = true; api("/admin/orders", { pin: adminPin, limit: 500, src: oState.src || "online" }).then(function(j){ oState.loading = false; oState.list = j.ok ? j.orders : []; oState.more = !!j.more; oState.err = j.ok ? "" : j.code; if (aTab === "olist") renderOList(); }); }
    var seg = function(arr, key){ return '<div class="pays seg mini" role="group">' + arr.map(function(x){ return '<button type="button" data-of="' + key + ':' + x[0] + '" aria-pressed="' + (String(oState[key]) === String(x[0])) + '">' + x[1] + '</button>'; }).join("") + '</div>'; };
    var head = '<div class="card"><div class="o-tools"><input class="search" id="oQ" type="search" placeholder="ابحث برقم الطلب أو الجوال أو الاسم…" value="' + esc(oState.q) + '" aria-label="بحث في الطلبات">' +
      (ordersOnly() ? '' : '<button class="btn btn-brand" type="button" data-onew>+ طلب جديد</button>') + '<button class="btn btn-soft" type="button" id="oRefresh">تحديث</button><button class="btn btn-soft" type="button" id="oExport">نزّل Excel</button></div>' +
      seg([["active","الجارية"],["new","جديدة"],["delivered","تم التوصيل"],["canceled","ملغية"],["all","الكل"]], "f") + seg([[1,"اليوم"],[7,"٧ أيام"],[30,"٣٠ يوم"],[0,"الكل"]], "range") + '</div>';
    if (!oState.list) { box.innerHTML = head + '<div class="card"><p class="hint">جاري التحميل…</p></div>'; bindOTools(); return; }
    if (oState.err) { box.innerHTML = head + '<div class="card"><p class="status err">' + (oState.err === "not_found" ? "حدّث كود الخادم في Cloudflare (الدليل، القسم ٨)." : "ما قدرنا نجيب الطلبات (" + esc(oState.err) + ").") + '</p></div>'; bindOTools(); return; }
    var l = oFiltered(), sum = l.reduce(function(a, o){ return o.status === "canceled" ? a : a + o.total; }, 0);
    box.innerHTML = head + '<div class="card"><div class="sec-head" style="margin:0"><b>' + num(l.length) + ' طلب</b><span class="hint">' + mny(sum) + ' ر.س (بدون الملغي)</span></div>' +
      (l.length ? '<div class="olist2">' + l.slice(0, oState.show || 200).map(function(o){ return '<button type="button" class="orow2" data-oopen="' + esc(o.no) + '"><b dir="ltr">' + esc(o.no) + '</b><span class="t">' + oTime(o.created) + '</span><span class="w">' + (o.src === "pos" ? '<em class="src store">' + esc(o.cashier || "المحل") + '</em>' : o.source ? '<em class="src ' + o.source + '">' + SRC[o.source] + '</em>' : '') + (o.drvName ? '<em class="drvchip">' + ic("truck") + esc(o.drvName) + '</em>' : '') + (o.src === "pos" ? num(o.count) + ' قطعة' : esc(o.name || "زبون")) + (o.phone ? ' · <span dir="ltr">' + esc(o.phone) + '</span>' : '') + (o.free ? ' · 🥬 بالكتابة' : '') + '</span><span class="m">' + num(o.total) + ' ر.س · ' + collectionLabel(o) + '</span><span class="spill ' + o.status + '">' + OST[o.status] + '</span>' + (lateOrderIds[o.no] ? '<span class="status err">متأخر · ' + num(lateOrderIds[o.no].waitingMinutes) + ' دقيقة</span>' : '') + '</button>'; }).join("") + '</div>' : '<p class="empty">ما فيه طلبات بهذا الفلتر.</p>') +
      (l.length > (oState.show || 200) || oState.more ? '<button class="btn btn-ghost" type="button" id="oMore" style="justify-self:center;margin-top:10px">اعرض طلبات أقدم</button>' : '') + '</div>';
    bindOTools();
  }
  function oFiltered(){
    var q = oState.q.replace(/\s/g, ""), since = oState.range ? (function(){ var d = new Date(); d.setHours(0,0,0,0); return d.getTime() - (oState.range - 1) * 864e5; })() : 0;
    return (oState.list || []).filter(function(o){
      if (o.created < since) return false;
      if (oState.f === "active" && ["new","accepted","onway"].indexOf(o.status) < 0) return false;
      if (oState.f === "sold" && o.status !== "sold") return false;
      if (oState.f !== "active" && oState.f !== "all" && oState.f !== "sold" && o.status !== oState.f) return false;
      return !q || o.no.indexOf(q) > -1 || String(o.phone).indexOf(q) > -1 || String(o.name || "").indexOf(oState.q.trim()) > -1;
    });
  }
  function bindOTools(){
    var qi = $("oQ"); if (qi) qi.addEventListener("input", function(){ oState.q = this.value; var p = this.selectionStart; renderOList(); var n = $("oQ"); n.focus(); try { n.setSelectionRange(p, p); } catch(e){} });
    if ($("oRefresh")) $("oRefresh").addEventListener("click", function(){ renderOList(true); });
    if ($("oExport")) $("oExport").addEventListener("click", function(){ exportOrders(oFiltered()); });
    if ($("oMore")) $("oMore").addEventListener("click", function(){ var b = this; oState.show = (oState.show || 200) + 200; if (!oState.more) { renderOList(); return; }
      b.disabled = true; var last = oState.list[oState.list.length - 1];
      api("/admin/orders", { pin: adminPin, limit: 500, before: last && last.no, src: oState.src || "online" }).then(function(j){ if (j.ok) { oState.list = oState.list.concat(j.orders); oState.more = !!j.more; } renderOList(); }); });
  }
  function exportOrders(list){
    var rows = [["رقم الطلب","التاريخ","الحالة","الجوال","الاسم","المنتجات","عدد القطع","المنتجات (ر.س)","التوصيل","الإجمالي","الدفع","تفاصيل البيت","ملاحظات","الموقع"]];
    list.forEach(function(o){ rows.push([o.no, new Date(o.created).toLocaleString("en-GB"), OST[o.status], o.phone, o.name || "", (o.lines || []).map(function(l){ return l.name + " ×" + l.qty; }).concat(o.free ? ["طلب بالكتابة: " + String(o.free).replace(/\n/g, "، ")] : []).join(" / "), o.count, o.subtotal, o.fee, o.total, o.pay === "online" ? "إلكتروني" : o.pay === "card" ? "شبكة" : "كاش", o.details || "", o.note || "", o.map || ""]); });
    csvDownload("طلبات-متاجر-أحد-" + new Date().toISOString().slice(0, 10) + ".csv", rows);
  }
  function oFind(no){ return (oState.list || []).filter(function(o){ return o.no === no; })[0]; }
  // رمز الاستلام وفحص مكان المندوب عند التسليم (١٦ نوفمبر ٢٠٢٦)
  function dkm(m){ return m >= 1000 ? num(Math.round(m / 100) / 10) + " كم" : num(m) + " م"; }
  function dchkHTML(o){
    var d = o.dchk;
    if (!d) return o.dc && ["new", "accepted", "onway"].indexOf(o.status) > -1 ? '<p class="hint">رمز الاستلام عند الزبون: <b dir="ltr">' + esc(o.dc) + '</b> (لو الزبون ضيّعه)</p>' : '';
    var far = d.dist != null && d.dist > 300;
    return '<p class="o-dchk ' + (d.warn ? 'bad' : 'good') + '">' + (d.code ? '✓ سلّم بالرمز' : d.skip ? '⚠️ سلّم بدون رمز: ' + esc(d.skip) : '✓ تم التسليم') +
      (d.dist != null ? ' · ' + (far ? '<b>على بعد ' + dkm(d.dist) + ' من بيت الزبون</b>' : 'عند البيت (' + dkm(d.dist) + ')') : ' · ما وصلنا موقع المندوب وقت التسليم') + '</p>';
  }
  function openOrder(no){
    var o = oFind(no); if (!o) return;
    var old = $("oSheet"); if (old) old.remove();
    var nx = { "new": [["accepted","اقبل الطلب","btn-brand"]], accepted: [["onway","طلع للتوصيل","btn-ink"]], onway: [["delivered","تم التوصيل","btn-teal"]] }[o.status] || [];
    var w = document.createElement("div");
    w.innerHTML = '<div class="sheet" id="oSheet"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="oTitle"><div class="panel-head"><h2 id="oTitle" dir="ltr">' + esc(o.no) + '</h2><span class="spill ' + o.status + '">' + OST[o.status] + '</span><button class="btn btn-ghost" type="button" data-oclose>إغلاق</button></div>' +
      (o.src === "pos" ? '<p class="hint">' + oTime(o.created) + ' · بيعة في المحل · الكاشير: ' + esc(o.cashier || "") + ' · ' + (o.pay === "card" ? "شبكة" : "كاش" + (o.paid ? ' (دفع ' + num(o.paid) + '، الباقي ' + num(o.change || 0) + ')' : '')) + (o.discount ? ' · خصم ' + num(o.discount) : '') + '</p>' :
      '<p class="hint">' + oTime(o.created) + ' · ' + collectionLabel(o) + (o.pay === "online" ? (o.paid && Math.round(o.total * 100) !== Number(o.paid.amount || 0) ? ' · <b style="color:#B3261E">الإجمالي تغيّر عن المدفوع، راجع الفرق</b>' : '') + '</p>' : ' عند الاستلام</p>')) +
      (o.src !== "pos" && ["new", "accepted", "onway"].indexOf(o.status) > -1 && staffCache ? '<label class="o-assign">المندوب<select data-oassign="' + esc(o.no) + '"><option value="">' + (o.status === "new" ? 'لأول مندوب يمسكه' : 'بدون (يرجع للكل)') + '</option>' + staffCache.filter(function(x){ return x.role === "driver" && (x.active || x.id === o.drv); }).map(function(x){ return '<option value="' + esc(x.id) + '"' + (o.drv === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join("") + '</select></label>' : (o.drvName ? '<p class="hint">المندوب: <b>' + esc(o.drvName) + '</b></p>' : '')) +
      '<div class="o-who"><b>' + esc(o.name || "زبون") + '</b><span dir="ltr">' + esc(o.phone) + '</span>' + (o.details ? '<span>' + esc(o.details) + '</span>' : '') + (o.note ? '<span class="note">ملاحظة: ' + esc(o.note) + '</span>' : '') + '</div>' +
      '<div class="actions">' + (o.phone ? '<a class="btn btn-soft sm" href="tel:' + esc(o.phone) + '">' + ic("phone") + 'اتصل</a><a class="btn btn-soft sm" target="_blank" rel="noopener" href="https://wa.me/966' + esc(String(o.phone).replace(/^0/, "")) + '">واتساب</a>' : '') + (o.map ? '<a class="btn btn-soft sm" target="_blank" rel="noopener" href="' + esc(o.map) + '">' + ic("pin") + 'الموقع</a>' : '') + '<button class="btn btn-soft sm" type="button" data-oprint="' + esc(o.no) + '">طباعة الفاتورة</button>' + (o.status === 'delivered' && !ordersOnly() ? '<button class="btn btn-soft sm" type="button" data-payment="'+esc(o.no)+'">تفصيل وتصحيح التحصيل</button>' : '') + (o.status !== "canceled" && !ordersOnly() ? '<button class="btn btn-soft sm" type="button" data-oedit="' + esc(o.no) + '">عدّل الطلب</button>' : '') + '</div>' +
      (o.edits && o.edits.length ? '<p class="hint">انعدّل ' + o.edits.length + ' مرة. آخر تعديل: من ' + num(o.edits[o.edits.length - 1].before) + ' إلى ' + num(o.edits[o.edits.length - 1].after) + ' ر.س</p>' : '') + (o.anon ? '<p class="hint">بيانات الزبون انمسحت بعد مدة الحفظ، والطلب وأرقامه باقية.</p>' : '') +
      dchkHTML(o) + freeBlock(o) + '<div class="o-lines">' + (o.lines || []).map(function(l){ return '<div><span>' + esc(l.name) + ' <small class="hint">' + esc(l.unit || "") + '</small>' + (l.tag ? ' <span class="ltag deal">' + esc(l.tag) + '</span>' : '') + (String(l.id || "").indexOf("c:") === 0 ? ' <span class="ltag day">من عندي</span>' : '') + '</span><b>× ' + l.qty + '</b><span>' + num(Math.round(l.qty * l.price * 100) / 100) + '</span></div>'; }).join("") +
        '<div class="sum"><span>المنتجات</span><b></b><span>' + num(o.subtotal) + '</span></div><div class="sum"><span>التوصيل</span><b></b><span>' + (o.fee ? num(o.fee) : 'مجاني') + '</span></div>' + (o.gift ? '<div class="sum"><span>هدية اعتذار</span><b></b><span>−' + num(o.gift) + '</span></div>' : '') + (o.promoAmt ? '<div class="sum"><span>كود ' + esc(o.promo) + '</span><b></b><span>−' + num(o.promoAmt) + '</span></div>' : '') + '<div class="sum grand"><span>الإجمالي</span><b></b><span>' + num(o.total) + ' ر.س</span></div></div>' +
      '<div class="actions">' + nx.map(function(x){ return '<button class="btn ' + x[2] + '" type="button" data-ost="' + x[0] + '" data-no="' + esc(o.no) + '">' + x[1] + '</button>'; }).join("") +
        (o.status !== "canceled" && o.status !== "delivered" ? '<button class="btn btn-ghost" type="button" data-ost="canceled" data-no="' + esc(o.no) + '" style="color:var(--sale)">إلغاء الطلب</button>' : '') +
        (o.status === "canceled" && o.src !== "pos" ? '<button class="btn btn-ghost" type="button" data-ost="new" data-no="' + esc(o.no) + '">رجّع الطلب</button>' : '') + '<span class="status" id="oMsg"></span></div></div></div>';
    document.body.appendChild(w.firstChild);
  }
  // «طلب بالكتابة» (الخضار بالوزن...): الزبون كتبه وسعره يتحدد عند التجهيز. التسعير: «عدّل الطلب» ← «منتج من عندي»
  (function(){ if (document.getElementById("freeCss")) return; var cs = document.createElement("style"); cs.id = "freeCss"; cs.textContent = ".o-free{display:grid;gap:4px;margin:10px 0;padding:10px 12px;border-radius:12px;background:#EAF6EF;color:#14532D}.o-free>span{white-space:pre-line;font-weight:600;line-height:1.6}.o-free textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid #CFE6D8;border-radius:10px;padding:8px}.nf-custom{margin:8px 0;padding:8px 10px;border:1px dashed var(--line,#ddd);border-radius:12px}.nf-custom summary{cursor:pointer;font-weight:700;color:var(--teal,#0E8A6A)}.nf-custom .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:8px}.nf-custom .fields .wide{grid-column:1/-1}.nf-custom input{width:100%;box-sizing:border-box}"; document.head.appendChild(cs); })();
  function freeBlock(o){ return o && o.free ? '<div class="o-free"><b>🥬 طلب بالكتابة:</b><span>' + esc(o.free) + '</span>' + (["new", "accepted", "onway", "delivered"].indexOf(o.status) > -1 && !(o.lines || []).length ? '<small class="hint">سعّره من «عدّل الطلب» ← «منتج من عندي»، أو بلّغ الزبون بالسعر.</small>' : '') + '</div>' : ''; }
  function printOrder(o){
    var win = window.open("", "_blank", "width=420,height=640"); if (!win) return;
    var rows = (o.lines || []).map(function(l){ return '<tr><td>' + esc(l.name) + (l.unit ? ' <small>' + esc(l.unit) + '</small>' : '') + '</td><td>' + l.qty + '</td><td>' + num(Math.round(l.qty * l.price * 100) / 100) + '</td></tr>'; }).join("");
    win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(o.no) + '</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:16px;font-size:13px;color:#000}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{padding:5px 2px;border-bottom:1px dashed #999;text-align:start}td:nth-child(2),td:nth-child(3),th:nth-child(2),th:nth-child(3){text-align:center;width:16%}.c{text-align:center}.g{font-size:16px;font-weight:bold}small{color:#555}@media print{button{display:none}}</style></head><body>' +
      '<div class="c"><img src="' + D.imgs.logo + '" style="width:64px;height:64px;object-fit:contain"><h1>' + esc(D.store.name) + '</h1><div>' + esc(D.store.phone || "") + '</div></div><hr>' +
      '<div>رقم الطلب: <b dir="ltr">' + esc(o.no) + '</b></div><div>التاريخ: ' + new Date(o.created).toLocaleString("ar-SA-u-nu-latn") + '</div><div>الزبون: ' + esc(o.name || "") + ' <span dir="ltr">' + esc(o.phone) + '</span></div>' + (o.details ? '<div>العنوان: ' + esc(o.details) + '</div>' : '') +
      '<table><tr><th>المنتج</th><th>الكمية</th><th>ر.س</th></tr>' + rows + '</table>' + (o.free ? '<div style="white-space:pre-line;margin:6px 0">🥬 طلب بالكتابة:\n' + esc(o.free) + '</div>' : '') +
      '<div>المنتجات: ' + num(o.subtotal) + ' ر.س</div><div>التوصيل: ' + (o.fee ? num(o.fee) + ' ر.س' : 'مجاني') + '</div>' + (o.gift ? '<div>هدية اعتذار: −' + num(o.gift) + ' ر.س</div>' : '') + (o.promoAmt ? '<div>كود ' + esc(o.promo) + ': −' + num(o.promoAmt) + ' ر.س</div>' : '') + '<div class="g">الإجمالي: ' + num(o.total) + ' ر.س</div><div>الدفع: ' + collectionLabel(o) + ' عند الاستلام</div>' + (o.note ? '<div>ملاحظات: ' + esc(o.note) + '</div>' : '') +
      '<hr><div class="c">شكرًا لطلبك من ' + esc(D.store.name) + '</div><p class="c"><button onclick="print()">طباعة</button></p><script>setTimeout(function(){print()},300)<\/script></body></html>');
    win.document.close();
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-of]"))) { var k = t.dataset.of.split(":"); if (k[0] === "src" && (oState.src || "online") !== k[1]) { oState.list = null; oState.more = false; oState.f = k[1] === "pos" ? "all" : "active"; } oState[k[0]] = k[0] === "range" ? Number(k[1]) : k[1]; renderOList(); return; }
    if ((t = e.target.closest("[data-oopen]"))) { openOrder(t.dataset.oopen); return; }
    if (e.target.closest("[data-oclose]") || e.target.id === "oSheet") { var sh = $("oSheet"); if (sh) sh.remove(); return; }
    if ((t = e.target.closest("[data-oprint]"))) { printOrder(oFind(t.dataset.oprint)); return; }
    if ((t = e.target.closest("[data-ost]"))) {
      if (t.dataset.ost === "canceled" && t.dataset.c !== "1") { t.dataset.c = "1"; t.textContent = "متأكد؟ اضغط مرة ثانية"; return; }
      t.disabled = true; var no = t.dataset.no, stt = t.dataset.ost;
      api("/driver/status", { pin: adminPin, no: no, status: stt }).then(function(j){
        if (!j.ok) { t.disabled = false; var m = $("oMsg"); if (m) { m.className = "status err"; m.textContent = ({ not_ready: "الطلب ما جهز في شاشة التجهيز (فيه منتجات ناقصة أو ما خلص).", pos_required: "لازم الكاشير يعتمد إيصال الطلب أول.", taken: "أحد غيّر الطلب قبلك، حدّث الصفحة.", conflict: "أحد غيّر الطلب قبلك، حدّث الصفحة.", not_found: "الطلب ما انلقى." }[j.code]) || (j.code === "timeout" || j.code === "network" ? "ما فيه اتصال، جرّب مرة ثانية." : "ما انحفظ (" + (j.code || "?") + ")، جرّب مرة ثانية."); } return; }
        var o = oFind(no); if (o) { o.status = stt; o.updated = Date.now(); } openOrder(no); renderOList(); loadOrderAlerts(); if (stt === "canceled" || stt === "new") loadAdminStock();
      });
    }
  });

  /* ---------- «منتج من عندي»: سطر باسم ووحدة وسعر يكتبها الموظف (خضار بالوزن، منتج مو بالمتجر) ---------- */
  // الخادم يعطيه رقم c:… وما يمس المخزون ولا سعر الشراء. يحتاج نشر الخادم (قبله يرجع bad_line)
  function customFormHTML(px, open){
    return '<details class="nf-custom"' + (open ? ' open' : '') + '><summary>+ منتج من عندي</summary><div class="fields">' +
      '<label class="wide">اسم المنتج<input id="' + px + 'CN" maxlength="60" placeholder="مثال: طماط بلدي"></label>' +
      '<label>الوحدة أو الوزن<input id="' + px + 'CU" maxlength="20" placeholder="كيلو، 2 كيلو، حبة" list="cuList' + px + '"><datalist id="cuList' + px + '"><option value="كيلو"><option value="نص كيلو"><option value="2 كيلو"><option value="حبة"><option value="ربطة"><option value="درزن"><option value="كرتون"></datalist></label>' +
      '<label>الكمية<input id="' + px + 'CQ" type="number" min="1" max="500" step="1" value="1" inputmode="numeric"></label>' +
      '<label>السعر (للوحدة)<input id="' + px + 'CP" type="number" min="0" step="0.25" inputmode="decimal" placeholder="0"></label></div>' +
      '<div class="actions"><button type="button" class="btn btn-soft" data-cadd="' + px + '">أضف السطر</button><span class="status" id="' + px + 'CMsg" role="status"></span></div></details>';
  }
  function readCustom(px){
    var v = function(k){ var el = $(px + k); return el ? String(el.value || "").trim() : ""; }, m = $(px + "CMsg");
    var name = v("CN").replace(/\s+/g, " ").slice(0, 60), unit = v("CU").replace(/\s+/g, " ").slice(0, 20), qty = Math.floor(Number(asciiDigits(v("CQ")) || 1)), price = Number(asciiDigits(v("CP")).replace("٫", "."));
    var bad = !name ? "اكتب اسم المنتج." : !(qty >= 1 && qty <= 500) ? "الكمية من ١ إلى ٥٠٠." : v("CP") === "" || !(price >= 0 && price < 100000) ? "اكتب السعر." : "";
    if (bad) { if (m) { m.className = "status err"; m.textContent = bad; } return null; }
    return { custom: true, name: name, unit: unit, qty: qty, price: Math.round(price * 100) / 100 };
  }
  function isCustom(l){ return !!(l && (l.custom || String(l.id || "").indexOf("c:") === 0)); }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest && e.target.closest("[data-cadd]"); if (!t) return;
    var px = t.dataset.cadd, c = readCustom(px); if (!c) return;
    var list = px === "nf" ? nf && nf.lines : oEdit && oEdit.lines; if (!list) return;
    var ex = list.filter(function(l){ return l.custom && !l.id && l.name === c.name && l.unit === c.unit && l.price === c.price; })[0];
    if (ex) ex.qty = Math.min(500, ex.qty + c.qty); else list.push(c);
    if (px === "nf") { ["CN", "CU", "CP"].forEach(function(k){ $("nf" + k).value = ""; }); $("nfCQ").value = "1"; $("nfCN").focus(); nfLinesRender(); } else { oEdit.cOpen = true; renderEdit(); }
    sToast("انضاف «" + c.name + "»");
  });

  /* ---------- edit an order (after a call with the customer) ---------- */
  var oEdit = null;
  function openEdit(no){
    if (ordersOnly()) return;
    var o = oFind(no); if (!o) return;
    oEdit = { no: no, fee: o.fee, hasFree: !!o.free, free: o.free || "", lines: (o.lines || []).map(function(l){ return { id: l.id, name: l.name, unit: l.unit, qty: l.qty, price: l.price }; }) };
    renderEdit();
  }
  function renderEdit(){
    var old = $("oSheet"); if (old) old.remove(); if (!oEdit) return;
    if (!$("oeCss")) { var cs = document.createElement("style"); cs.id = "oeCss"; cs.textContent = ".oe-name{width:100%;font:inherit;font-weight:600;border:1px solid var(--line);border-radius:8px;padding:5px 7px;background:#fff}"; document.head.appendChild(cs); }
    var sub = oEdit.lines.reduce(function(a, l){ return a + l.qty * l.price; }, 0);
    var w = document.createElement("div");
    w.innerHTML = '<div class="sheet" id="oSheet"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="oeTitle"><div class="panel-head"><h2 id="oeTitle">تعديل الطلب <span dir="ltr">' + esc(oEdit.no) + '</span></h2><button class="btn btn-ghost" type="button" data-oeback>رجوع</button></div>' +
      '<p class="hint">عدّل الاسم أو الكمية أو السعر أو أضف منتج، حتى بعد التوصيل (مثل فرق سعر أو اسم غلط). المخزون والتحليل والتحصيل يتعدلون معه.</p>' +
      '<section class="nf-sec oe-add"><b>أضف منتج للطلب</b><input class="search" id="oeQ" type="search" placeholder="اكتب اسم المنتج أو الباركود…" autocomplete="off" value="' + esc(oEdit.q || "") + '"><div class="nf-res" id="oeRes"></div></section><div class="oe-lines">' +
      oEdit.lines.map(function(l, i){ return '<div class="oe-row"><span class="nm"><input class="oe-name" data-oen="' + i + '" value="' + esc(l.name) + '" aria-label="اسم المنتج" maxlength="120"> <small class="hint">' + esc(l.unit || "") + (isCustom(l) ? ' · من عندي' : '') + '</small></span><span class="stp"><button type="button" data-oeq="' + i + ':-1" aria-label="نقص">−</button><b>' + l.qty + '</b><button type="button" data-oeq="' + i + ':1" aria-label="زيادة">+</button></span><label class="pr">السعر<input type="number" min="0" step="0.25" inputmode="decimal" data-oep="' + i + '" value="' + l.price + '"></label><button class="del" type="button" data-oedel="' + i + '">شيل</button></div>'; }).join("") + '</div>' +
      '<div class="actions"><label class="pr">التوصيل<input type="number" min="0" step="0.5" id="oeFee" value="' + oEdit.fee + '"></label></div>' + customFormHTML("oe", oEdit.cOpen) +
      (oEdit.hasFree ? '<label class="o-free" style="display:grid;gap:6px"><b>🥬 طلب بالكتابة (من الزبون)</b><textarea id="oeFree" rows="4" maxlength="600">' + esc(oEdit.free) + '</textarea><small class="hint">سعّر الأغراض بـ«منتج من عندي» فوق، وبعدها امسح النص (أو خلّه للمندوب).</small></label>' : '') +
      '<div class="o-lines"><div class="sum grand"><span>الإجمالي الجديد</span><b></b><span id="oeTot">' + num(Math.round((sub + Number(oEdit.fee || 0)) * 100) / 100) + ' ر.س</span></div></div>' +
      '<label class="oe-fix" style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:.9rem"><input type="checkbox" id="oeFix"' + (oEdit.fix ? ' checked' : '') + '> صحّح المنتج في المتجر بعد (الاسم والسعر الجديد يطلع للزبائن الجايين)</label>' +
      '<div class="actions"><button class="btn btn-brand" type="button" id="oeSave">احفظ التعديل</button><span class="status" id="oeMsg"></span></div></div></div>';
    document.body.appendChild(w.firstChild);
    // إضافة منتج بالبحث (مراجعة ١٦ نوفمبر: القائمة المنسدلة كان فيها ١١ ألف منتج ومستحيل تختار منها بالجوال)
    $("oeQ").addEventListener("input", function(){ oEdit.q = this.value; oeResRender(); });
    $("oeQ").addEventListener("keydown", function(e){ if (e.key === "Enter") { var f = document.querySelector("#oeRes [data-oeadd]"); if (f) { e.preventDefault(); f.click(); } } });
    oeResRender();
    $("oeFee").addEventListener("input", function(){ oEdit.fee = Number(this.value || 0); upTot(); });
    if ($("oeFree")) $("oeFree").addEventListener("input", function(){ oEdit.free = this.value; });
    $("oeFix").addEventListener("change", function(){ oEdit.fix = this.checked; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-oen]"), function(inp){ inp.addEventListener("input", function(){ oEdit.lines[Number(this.dataset.oen)].name = this.value; }); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-oep]"), function(inp){ inp.addEventListener("input", function(){ oEdit.lines[Number(this.dataset.oep)].price = Number(this.value || 0); upTot(); }); });
  }
  function oeResRender(){
    var el = $("oeRes"); if (!el || !oEdit) return; var q = String(oEdit.q || "").trim();
    if (!q) { el.innerHTML = ''; return; }
    var res = admFind(q, draft.products).slice(0, 12);
    el.innerHTML = res.length ? res.map(function(p){ var inO = oEdit.lines.filter(function(l){ return l.id === p.id; })[0];
      return '<button type="button" class="nf-pr" data-oeadd="' + p.id + '">' + imgTag(p.img, "") + '<span class="nm">' + esc(p.name) + ' <small class="hint">' + esc(p.unit || "") + '</small></span>' + (inO ? '<em>بالطلب ' + num(inO.qty) + '</em>' : !p.stock ? '<em class="out">مو متوفر</em>' : '') + '<b>' + num(p.price) + ' ر.س</b><span class="plus">+</span></button>'; }).join("") : '<p class="hint">ما لقينا منتج بهذا الاسم. تقدر تضيفه من «+ منتج من عندي» تحت.</p>';
  }
  function upTot(){ var sub = oEdit.lines.reduce(function(a, l){ return a + l.qty * l.price; }, 0); $("oeTot").textContent = num(Math.round((sub + Number(oEdit.fee || 0)) * 100) / 100) + " ر.س"; }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-oedit]"))) { openEdit(t.dataset.oedit); return; }
    if (!oEdit) return;
    if (e.target.closest("[data-oeback]")) { var no0 = oEdit.no; oEdit = null; openOrder(no0); return; }
    if ((t = e.target.closest("[data-oeadd]"))) { var pa = dById(t.dataset.oeadd); if (!pa) return; var exa = oEdit.lines.filter(function(l){ return l.id === pa.id && l.price === pa.price; })[0];
      if (exa) exa.qty++; else oEdit.lines.push({ id: pa.id, name: pa.name, unit: pa.unit, qty: 1, price: pa.price });
      oEdit.q = ""; renderEdit(); sToast("انضاف «" + pa.name + "» للطلب"); var qi = $("oeQ"); if (qi) qi.focus(); return; }
    if ((t = e.target.closest("[data-oeq]"))) { var k = t.dataset.oeq.split(":"), l = oEdit.lines[Number(k[0])]; l.qty = Math.max(1, l.qty + Number(k[1])); renderEdit(); return; }
    if ((t = e.target.closest("[data-oedel]"))) { oEdit.lines.splice(Number(t.dataset.oedel), 1); renderEdit(); return; }
    if (e.target.closest("#oeSave")) { var m = $("oeMsg"), b = $("oeSave"); if (!oEdit.lines.length && !(oEdit.hasFree && String(oEdit.free).trim())) { m.className = "status err"; m.textContent = "الطلب لازم فيه منتج واحد على الأقل. لو تبغى تلغيه استخدم «إلغاء الطلب»."; return; }
      b.disabled = true; m.className = "status"; m.textContent = "جاري الحفظ…";
      var oeBody = { pin: adminPin, no: oEdit.no, fee: oEdit.fee, lines: oEdit.lines.map(function(l){ return l.custom && !l.id ? { custom: true, name: l.name, unit: l.unit || "", qty: l.qty, price: l.price } : { id: l.id, qty: l.qty, price: l.price, name: String(l.name || "").trim() }; }) };
      if (oEdit.hasFree) oeBody.free = String(oEdit.free || "");
      api("/admin/order-edit", oeBody).then(function(j){
        if (!j.ok) { b.disabled = false; m.className = "status err"; m.textContent = j.code === "not_found" ? "حدّث كود الخادم أول." : j.code === "payment_locked" ? "الطلب مدفوع كاش وشبكة مع بعض: صحّح التحصيل أول من «تفصيل وتصحيح التحصيل»، بعدين عدّل الطلب." : j.code === "day_closed" ? "يوم هالطلب مقفل (إقفال اليوم)، ما ينفع يتعدل بعد الإقفال." : "ما انحفظ (" + (j.code || "?") + ")." + (j.code === "bad_line" || j.code === "empty" ? " لو أضفت «منتج من عندي» أو شلت كل المنتجات: حدّث كود الخادم في Cloudflare أول." : ""); return; }
        // تصحيح المنتج في المتجر نفسه (الاسم والسعر)، والمالك يحفظ تغييرات المتجر بعدها
        if (oEdit.fix) { var fx = 0; oEdit.lines.forEach(function(l){ var p = dById(l.id); if (!p || String(l.id).indexOf("~") > -1) return; var nm = String(l.name || "").trim(); if (nm && nm !== p.name) { p.name = nm; fx++; } if (l.price > 0 && l.price !== p.price) { if (p.old && l.price >= p.old) delete p.old; p.price = l.price; fx++; } }); if (fx) { markDirty(); renderAProds(); renderAFilter(); } }
        var o = oFind(oEdit.no); if (o) { Object.keys(j.order).forEach(function(k){ o[k] = j.order[k]; }); }
        var no1 = oEdit.no; oEdit = null; openOrder(no1); renderOList(); loadAdminStock(); }); }
  });

  /* ---------- new order typed by staff (phone / WhatsApp / in store) ---------- */
  var nf = null;
  function nfReset(){ nf = { src: "phone", phone: "", name: "", details: "", loc: "", note: "", pay: "cash", fee: "", lines: [], q: "", force: false, done: null }; }
  function nfSub(){ return Math.round(nf.lines.reduce(function(a, l){ return a + l.qty * l.price; }, 0) * 100) / 100; }
  function nfAutoFee(){ var st = draft.store, sub = nfSub(); return st.freeOver && sub >= st.freeOver ? 0 : Number(st.fee || 0); }
  function nfFee(){ return nf.fee === "" ? nfAutoFee() : Number(nf.fee) || 0; }
  function openNewOrder(){
    if (ordersOnly()) return;
    if (!nf || nf.done) nfReset();
    if (!oState.list && !oState.loading) { oState.loading = true; api("/admin/orders", { pin: adminPin, limit: 500 }).then(function(j){ oState.loading = false; oState.list = j.ok ? j.orders : []; oState.more = !!j.more; if (nf && $("nfKnown")) nfKnownRender(); }); }
    var old = $("nfSheet"); if (old) old.remove();
    var w = document.createElement("div");
    w.innerHTML = '<div class="sheet" id="nfSheet"><div class="panel nf" role="dialog" aria-modal="true" aria-labelledby="nfTitle"><div class="panel-head"><h2 id="nfTitle">طلب جديد</h2><button class="btn btn-ghost" type="button" data-nfclose>إغلاق</button></div><div id="nfBody"></div></div></div>';
    document.body.appendChild(w.firstChild); nfRender();
  }
  function nfRender(){
    var b = $("nfBody"); if (!b) return;
    if (nf.done) { var o = nf.done, tlink = location.origin + location.pathname + "?t=" + String(o.no).replace(/\D/g, "") + (o.phone && /^05\d{8}$/.test(o.phone) ? "&k=" + Number(o.phone).toString(36) : "") + "&s=" + Number(o.total || 0) + "&p=" + (o.pay === "card" ? "card" : "cash"), msg = "هلا" + (o.name ? " " + o.name : "") + "، وصلنا طلبك رقم " + o.no + " 🌿\nتابعه من موقعنا الإلكتروني الجديد، يطلع لك طلبك على طول: " + tlink;
      b.innerHTML = '<div class="nf-done"><span class="ic">' + ic("check") + '</span><h3>انسجّل الطلب <span dir="ltr">' + esc(o.no) + '</span></h3><p class="hint">' + num(o.count) + ' قطعة · ' + num(o.total) + ' ر.س · وصل لشاشة التجهيز والمندوب، والمخزون والتحليل انحسبوا.</p>' +
        '<div class="actions">' + (o.phone ? '<a class="btn btn-teal" target="_blank" rel="noopener" href="https://wa.me/966' + esc(o.phone.replace(/^0/, "")) + '?text=' + encodeURIComponent(msg) + '">أرسل تأكيد للزبون على الواتساب</a><button class="btn btn-soft" type="button" data-nfcopy="' + esc(tlink) + '">انسخ رابط المتابعة</button>' : '<p class="hint">ما فيه رقم جوال، فما فيه رابط متابعة للزبون.</p>') +
        '<button class="btn btn-soft" type="button" data-oprint="' + esc(o.no) + '">اطبع الفاتورة</button><button class="btn btn-brand" type="button" data-nfagain>طلب جديد ثاني</button></div></div>'; return; }
    b.innerHTML = '<div class="pays seg mini nf-src" role="group" aria-label="الطلب جاء من">' + [["phone","اتصال"],["whatsapp","واتساب"],["store","في المحل"]].map(function(x){ return '<button type="button" data-nfsrc="' + x[0] + '" aria-pressed="' + (nf.src === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
      '<section class="nf-sec"><b>الزبون</b><div class="fields">' +
        '<label>رقم الجوال<input id="nfPhone" type="tel" inputmode="numeric" dir="ltr" placeholder="05XXXXXXXX" value="' + esc(nf.phone) + '"></label>' +
        '<label>الاسم<input id="nfName" value="' + esc(nf.name) + '" placeholder="اختياري"></label>' +
        '<label class="wide">العنوان أو وصف البيت<input id="nfDetails" value="' + esc(nf.details) + '" placeholder="مثال: فيلا ٨، باب بني، جنب المسجد"></label>' +
        '<label class="wide">موقع البيت<input id="nfLoc" dir="ltr" value="' + esc(nf.loc) + '" placeholder="الصق رابط الموقع من الواتساب (اختياري)"><span class="hint" id="nfLocHint" aria-live="polite"></span></label>' +
        '<label class="wide">ملاحظة<input id="nfNote" value="' + esc(nf.note) + '" placeholder="مثال: الخبز يكون حار"></label></div><div id="nfKnown"></div></section>' +
      '<section class="nf-sec"><b>المنتجات</b><input class="search" id="nfQ" type="search" placeholder="اكتب اسم المنتج…" value="' + esc(nf.q) + '" autocomplete="off"><div class="nf-res" id="nfRes"></div>' + customFormHTML("nf") + '<div class="nf-lines" id="nfLines"></div></section>' +
      '<section class="nf-sec"><div class="nf-tot" id="nfTot"></div><div class="pays" style="max-width:320px"><button type="button" data-nfpay="cash" aria-pressed="' + (nf.pay === "cash") + '">كاش</button><button type="button" data-nfpay="card" aria-pressed="' + (nf.pay === "card") + '">شبكة</button></div></section>' +
      '<div id="nfErr"></div><div class="actions"><button class="btn btn-brand nf-save" type="button" id="nfSave">سجّل الطلب</button></div>';
    var bind = { nfPhone: "phone", nfName: "name", nfDetails: "details", nfLoc: "loc", nfNote: "note" };
    Object.keys(bind).forEach(function(id){ $(id).addEventListener("input", function(){ nf[bind[id]] = this.value; if (id === "nfPhone") nfKnownRender(); if (id === "nfLoc") nfLocHint(); }); });
    $("nfQ").addEventListener("input", function(){ nf.q = this.value; nfResRender(); });
    $("nfQ").addEventListener("keydown", function(e){ if (e.key === "Enter") { var f = document.querySelector("#nfRes [data-nfadd]"); if (f) { e.preventDefault(); f.click(); } } });
    nfKnownRender(); nfResRender(); nfLinesRender(); nfLocHint();
  }
  // رابط الموقع المنسوخ من الواتساب يجي فيه الفاصلة مشفّرة (%2C): نفكها عشان الخادم يقرأ الإحداثيات ويحسب للزبون وقت الوصول
  function nfLocNorm(v){ v = String(v || "").trim(); try { v = decodeURIComponent(v); } catch(e){ v = v.replace(/%2C/gi, ","); } return v; }
  function nfLocHint(){ var el = $("nfLocHint"); if (!el) return; var v = nfLocNorm(nf.loc);
    if (!v) { el.textContent = ""; return; }
    var m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(v), ok = m && +m[1] >= 16 && +m[1] <= 33 && +m[2] >= 34 && +m[2] <= 56;
    el.className = "hint"; el.style.display = "block"; el.style.marginTop = "4px"; el.style.color = ok ? "#0E8A6A" : "#B4540A";
    el.textContent = ok ? "✓ فهمنا الموقع: الزبون بيشوف المندوب على الخريطة وكم باقي يوصله." : /goo\.gl|google\./i.test(v) ? "رابط مختصر: المندوب يقدر يفتحه، بس الزبون ما بيشوف كم دقيقة باقية. لو تقدر، الصق رابط فيه أرقام الموقع (مثل 24.71,46.67)." : "ما فهمنا الموقع. الصق رابط قوقل ماب أو الأرقام (مثل 24.71,46.67)، أو اكتب العنوان فوق."; }
  function nfKnownRender(){
    var el = $("nfKnown"); if (!el) return;
    var ph = normPhone(nf.phone);
    if (!ph) { el.innerHTML = nf.phone.replace(/\D/g, "").length >= 10 ? '<p class="status err">رقم الجوال مو صحيح. لازم يبدأ بـ 05 ويكون ١٠ أرقام.</p>' : ''; return; }
    var mine = (oState.list || []).filter(function(o){ return o.phone === ph && !o.anon; });
    if (!mine.length) { el.innerHTML = '<p class="hint">زبون جديد' + (oState.list ? '' : ' (جاري البحث في الطلبات السابقة…)') + '</p>'; return; }
    var last = mine[0], done = mine.filter(function(o){ return o.status !== "canceled"; });
    el.innerHTML = '<div class="nf-known"><span class="ic">' + ic("user") + '</span><span class="t"><b>زبون سابق' + (last.name ? ': ' + esc(last.name) : '') + '</b><span>' + num(done.length) + ' طلب · ' + num(Math.round(done.reduce(function(a, o){ return a + o.total; }, 0))) + ' ر.س · آخر طلب ' + oTime(last.created) + '</span>' + (last.details ? '<span>' + esc(last.details) + '</span>' : '') + '</span>' +
      '<span class="acts"><button class="btn btn-soft sm" type="button" data-nffill>عبّي بياناته</button><button class="btn btn-soft sm" type="button" data-nfrepeat>كرر آخر طلب</button></span></div>';
  }
  // بحث المنتجات بالإدارة كلها = بحث الموقع الذكي (ترتيب الكلمات، ة/ه، الهمزات، المرادفات، الإنجليزي، الباركود، حرف غلط)، طلب المالك ١٥ نوفمبر
  // + المنتجات الجديدة بالإدارة اللي ما انحفظت للموقع بعد. list: المنتجات المسموحة (مثلاً قسم واحد)
  function admFind(q, list){
    var res = [], ok = {}; list.forEach(function(p){ ok[p.id] = p; });
    try { searchProducts(q).forEach(function(x){ var p = ok[x.id]; if (p && res.indexOf(p) < 0) res.push(p); }); } catch(e){}
    var ws = normAr(asciiDigits(q)).split(/\s+/).filter(Boolean);
    list.forEach(function(p){ if (res.indexOf(p) < 0) { var h = normAr(asciiDigits(p.name + " " + (p.name_en || "") + " " + (p.bc || ""))); if (ws.every(function(w){ return h.indexOf(w) > -1; })) res.push(p); } });
    return res;
  }
  function nfResRender(){
    var el = $("nfRes"); if (!el) return;
    var q = nf.q.trim().toLowerCase();
    if (!q) { el.innerHTML = ''; return; }
    var res = admFind(nf.q, draft.products).slice(0, 12);
    el.innerHTML = res.length ? res.map(function(p){ var left = qtyOf(p.id);
      return '<button type="button" class="nf-pr" data-nfadd="' + p.id + '">' + imgTag(p.img, "") + '<span class="nm">' + esc(p.name) + ' <small class="hint">' + esc(p.unit || "") + '</small></span>' + (!p.stock ? '<em class="out">مو متوفر</em>' : left != null ? '<em class="' + (left <= 3 ? 'out' : '') + '">باقي ' + num(left) + '</em>' : '') + '<b>' + num(p.price) + ' ر.س</b><span class="plus">+</span></button>'; }).join("") : '<p class="hint">ما لقينا منتج بهذا الاسم.</p>';
  }
  function nfLinesRender(){
    var ne = $("nfErr"); if (ne && nf.lines.length && /منتج واحد/.test(ne.textContent)) ne.innerHTML = "";   // رسالة «أضف منتج» تختفي أول ما ينضاف منتج
    var el = $("nfLines"); if (!el) return;
    el.innerHTML = nf.lines.length ? nf.lines.map(function(l, i){ var p = l.custom ? null : dById(l.id);
      return '<div class="oe-row">' + '<span class="nm">' + esc(l.custom ? l.name : p ? p.name : l.id) + ' <small class="hint">' + esc(l.custom ? (l.unit || "") + ' · من عندي' : p ? p.unit || "" : "") + '</small></span><span class="stp"><button type="button" data-nfq="' + i + ':-1" aria-label="نقص">−</button><b>' + l.qty + '</b><button type="button" data-nfq="' + i + ':1" aria-label="زيادة">+</button></span><label class="pr">السعر<input type="number" min="0" step="0.25" inputmode="decimal" data-nfp="' + i + '" value="' + l.price + '"></label><button class="del" type="button" data-nfdel="' + i + '">شيل</button></div>'; }).join("") : '<p class="hint">ابحث فوق واضغط على المنتج عشان ينضاف.</p>';
    Array.prototype.forEach.call(el.querySelectorAll("[data-nfp]"), function(inp){ inp.addEventListener("input", function(){ nf.lines[Number(this.dataset.nfp)].price = Number(this.value || 0); nfTotRender(); }); });
    nfTotRender();
  }
  function nfTotRender(){
    var el = $("nfTot"); if (!el) return;
    var sub = nfSub(), fee = nfFee(), cnt = nf.lines.reduce(function(a, l){ return a + l.qty; }, 0);
    el.innerHTML = '<div><span>المنتجات (' + num(cnt) + ')</span><b>' + num(sub) + ' ر.س</b></div><div><span>التوصيل</span><label class="pr inline"><input type="number" min="0" step="0.5" id="nfFee" value="' + esc(nf.fee) + '" placeholder="' + nfAutoFee() + '" aria-label="رسوم التوصيل"></label></div><div class="grand"><span>الإجمالي</span><b>' + num(Math.round((sub + fee) * 100) / 100) + ' ر.س</b></div>';
    $("nfFee").addEventListener("input", function(){ nf.fee = this.value; var g = el.querySelector(".grand b"); g.textContent = num(Math.round((nfSub() + nfFee()) * 100) / 100) + " ر.س"; });
  }
  function nfAdd(id, qty){ var p = dById(id); if (!p) return; var ex = nf.lines.filter(function(l){ return l.id === id && l.price === p.price; })[0]; if (ex) ex.qty += qty || 1; else nf.lines.push({ id: id, qty: qty || 1, price: p.price }); }
  function nfSave(){
    var err = $("nfErr"), btn = $("nfSave"), ph = nf.phone.trim();
    err.innerHTML = "";
    if (!nf.lines.length) { err.innerHTML = '<p class="status err">أضف منتج واحد على الأقل.</p>'; $("nfQ").focus(); return; }
    if (ph && !normPhone(ph)) { err.innerHTML = '<p class="status err">رقم الجوال مو صحيح. اكتبه مثل 05XXXXXXXX أو خله فاضي.</p>'; $("nfPhone").focus(); return; }
    if (nf.src !== "store" && !ph && !nf.details.trim() && !nf.loc.trim()) { err.innerHTML = '<p class="status err">المندوب يحتاج جوال الزبون أو عنوانه. لو الطلب في المحل اختر «في المحل».</p>'; return; }
    btn.disabled = true; btn.textContent = "جاري التسجيل…";
    api("/admin/order-new", { pin: adminPin, source: nf.src, phone: ph, name: nf.name, details: nf.details, loc: nfLocNorm(nf.loc), note: nf.note, pay: nf.pay, fee: nf.fee === "" ? null : Number(nf.fee), force: nf.force, lines: nf.lines }).then(function(j){
      btn.disabled = false; btn.textContent = "سجّل الطلب";
      if (j.ok) { nf.done = j.order; if (oState.list) oState.list.unshift(j.order); if (aTab === "olist") renderOList(); loadAdminStock(); nfRender(); return; }
      if (j.code === "unavailable") { var p = dById(j.id); err.innerHTML = '<div class="alert soft">المخزون في النظام يقول باقي ' + num(j.left) + ' بس من «' + esc(p ? p.name : j.id) + '». عدّل الكمية، أو لو المنتج موجود عندك فعلًا: <label class="chk"><input type="checkbox" data-nfforce>سجّله على أي حال (المخزون ينزل لصفر)</label></div>'; return; }
      err.innerHTML = '<p class="status err">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : j.code === "bad_line" && nf.lines.some(function(l){ return l.custom; }) ? "«منتج من عندي» يحتاج تحديث كود الخادم في Cloudflare أول." : j.code === "bad_phone" ? "رقم الجوال مو صحيح." : j.code === "network" ? "ما فيه اتصال. تأكد من النت." : "ما انسجل (" + esc(j.code || "?") + ").") + '</p>';
    });
  }
  document.addEventListener("change", function(e){ if (mode === "admin" && nf && e.target.dataset && e.target.dataset.nfforce !== undefined) nf.force = e.target.checked; });
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if (e.target.closest("[data-onew]")) { openNewOrder(); return; }
    if ((t = e.target.closest("[data-nfcopy]"))) { var u = t.dataset.nfcopy; if (navigator.clipboard) navigator.clipboard.writeText(u).then(function(){ sToast("انتسخ رابط المتابعة، الصقه للزبون بالواتساب"); }, function(){ prompt("انسخ الرابط:", u); }); else prompt("انسخ الرابط:", u); return; }
    if (!nf || !$("nfSheet")) return;
    if (e.target.closest("[data-nfclose]") || e.target.id === "nfSheet") { $("nfSheet").remove(); if (nf.done) nf = null; return; }
    if (e.target.closest("[data-nfagain]")) { nfReset(); nfRender(); $("nfPhone").focus(); return; }
    if ((t = e.target.closest("[data-nfsrc]"))) { nf.src = t.dataset.nfsrc; Array.prototype.forEach.call(document.querySelectorAll("[data-nfsrc]"), function(b){ b.setAttribute("aria-pressed", b.dataset.nfsrc === nf.src); }); return; }
    if ((t = e.target.closest("[data-nfpay]"))) { nf.pay = t.dataset.nfpay; Array.prototype.forEach.call(document.querySelectorAll("[data-nfpay]"), function(b){ b.setAttribute("aria-pressed", b.dataset.nfpay === nf.pay); }); return; }
    if ((t = e.target.closest("[data-nfadd]"))) { nfAdd(t.dataset.nfadd, 1); nf.q = ""; $("nfQ").value = ""; nfResRender(); nfLinesRender(); $("nfQ").focus(); return; }
    if ((t = e.target.closest("[data-nfq]"))) { var k = t.dataset.nfq.split(":"), l = nf.lines[Number(k[0])]; l.qty = Math.max(1, l.qty + Number(k[1])); nfLinesRender(); return; }
    if ((t = e.target.closest("[data-nfdel]"))) { nf.lines.splice(Number(t.dataset.nfdel), 1); nfLinesRender(); return; }
    if (e.target.closest("[data-nffill]") || e.target.closest("[data-nfrepeat]")) {
      var ph = normPhone(nf.phone), last = (oState.list || []).filter(function(o){ return o.phone === ph && !o.anon; })[0]; if (!last) return;
      if (e.target.closest("[data-nffill]")) { nf.name = last.name || nf.name; nf.details = last.details || nf.details; if (last.map) nf.loc = last.map; nfRender(); return; }
      nf.name = nf.name || last.name || ""; nf.details = nf.details || last.details || ""; if (!nf.loc && last.map) nf.loc = last.map;
      nf.lines = []; (last.lines || []).forEach(function(l){ if (isCustom(l)) nf.lines.push({ custom: true, name: l.name, unit: l.unit || "", qty: l.qty, price: l.price }); else if (l.id && dById(l.id)) nfAdd(l.id, l.qty); }); nfRender(); return; }
    if (e.target.closest("#nfSave")) { nfSave(); return; }
  });

  /* ---------- staff name (for the activity log) ---------- */
  function staffBox(){
    if (staffAuth) return '<div class="staffline">' + ic("user") + '<span>أنت داخل باسم <b>' + esc(staffAuth.user.name) + '</b> · مدير</span></div>';
    if (STAFF) return '<div class="staffline">' + ic("user") + '<span>أنت داخل باسم <b>' + esc(STAFF) + '</b></span><button type="button" class="linkbtn" data-staffchg>غيّر</button></div>';
    return '<div class="card staffask"><b>وش اسمك؟</b><p class="hint">عشان يطلع اسمك في «سجل العمليات» لما تغيّر سعر أو تلغي طلب. ينحفظ على هذا الجهاز بس.</p><div class="o-tools"><input id="staffIn" maxlength="30" placeholder="مثال: فهد"><button class="btn btn-brand" type="button" id="staffSave">احفظ</button></div></div>';
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    if (staffAuth) return;
    if (e.target.closest("[data-staffchg]")) { STAFF = ""; try { localStorage.removeItem("ohod-staff"); } catch(x){} renderOver(); var i = $("staffIn"); if (i) i.focus(); return; }
    if (e.target.closest("#staffSave")) { var v = ($("staffIn").value || "").trim().slice(0, 30); if (!v) return; STAFF = v; try { localStorage.setItem("ohod-staff", v); } catch(x){} renderOver(); }
  });
  function marginTag(p){ var c = costOf(p.id); if (c == null || !(p.price > 0)) return ''; var m = Math.round((p.price - c) / p.price * 100); return ' <em class="mtag ' + (m < 10 ? 'bad' : m < 20 ? 'mid' : 'good') + '">ربح ' + m + '٪</em>'; }

  /* ---------- today so far + tips ---------- */
  function loadToday(){
    overApi("/admin/today", { pin: adminPin }).then(function(j){ var el = $("aToday"); if (!el) return;
      if (!j.ok) { el.innerHTML = '<p class="hint">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare عشان تطلع أرقام اليوم." : "ما قدرنا نجيب أرقام اليوم.") + '</p>'; return; }
      todayCache = j; el.innerHTML = todayHTML(j); });
    if (!stat30) overApi("/admin/stats", { pin: adminPin, days: 30 }, 30000).then(function(j){ if (!j.ok) return; stat30 = j; if (j.names) statNames = j.names; var el = $("aTips"); if (el) el.innerHTML = tipsHTML(insights(j).slice(0, 4), false); });
    else { var el = $("aTips"); if (el) el.innerHTML = tipsHTML(insights(stat30).slice(0, 4), false); }
  }
  function todayHTML(j){
    var d = j.today, w = j.lastWeek, hl = (j.hour % 12 || 12) + (j.hour < 12 ? ' الصبح' : j.hour < 17 ? ' الظهر' : ' بالليل');
    var cmp = function(a, b){ if (!b) return a ? '<em class="dl up">أول مرة</em>' : '<em class="dl">—</em>'; var x = Math.round((a - b) / b * 100); return '<em class="dl ' + (x >= 0 ? 'up' : 'down') + '">' + (x >= 0 ? '▲ ' : '▼ ') + Math.abs(x) + '٪</em>'; };
    var open = 0; (j.open || []).forEach(function(o){ open += o.n; });
    var profit = d.cost > 0 ? Math.round(d.revenue - d.cost) : null, profitW = w.cost > 0 ? Math.round(w.revenue - w.cost) : null;
    return '<div class="sec-head" style="margin:0"><h2>اليوم حتى الحين</h2><span class="hint">مقارنة بنفس اليوم الأسبوع اللي طاف لين الساعة ' + hl + '</span></div>' +
      '<div class="stats mini today-tiles"><div class="stat"><b>' + num(d.orders - (d.pos_n || 0)) + '</b><span>طلب توصيل</span>' + cmp(d.orders - (d.pos_n || 0), w.orders - (w.pos_n || 0)) + '<small>الأسبوع اللي طاف: ' + num(w.orders - (w.pos_n || 0)) + '</small></div>' +
      (d.pos_n || w.pos_n ? '<button type="button" class="stat" data-atab="olist" data-posview><b>' + num(d.pos_n || 0) + '</b><span>بيعة في المحل</span>' + cmp(d.pos_n || 0, w.pos_n || 0) + '<small>' + mny(d.pos_rev || 0) + ' ر.س</small></button>' : '') +
      '<div class="stat"><b>' + mny(d.revenue) + '</b><span>ريال مبيعات</span>' + cmp(d.revenue, w.revenue) + '<small>الأسبوع اللي طاف: ' + mny(w.revenue) + '</small></div>' +
      (profit != null ? '<div class="stat"><b>' + num(profit) + '</b><span>ريال ربح</span>' + (profitW != null ? cmp(profit, profitW) : '') + '</div>' : '<button type="button" class="stat ghost" data-atab="prods"><b>؟</b><span>الربح</span><small>حط «سعر الشراء» للمنتجات عشان يطلع ربحك</small></button>') +
      '<button type="button" class="stat" data-atab="olist"><b>' + num(open) + '</b><span>طلب جاري الحين</span><small>' + (open ? 'اضغط تشوفها' : 'كل الطلبات خلصت') + '</small></button>' +
      '<button type="button" class="stat" data-atab="settlement"><b>' + mny(j.cashBalance || 0) + '</b><span>ريال كاش عند المناديب</span><small>' + ((j.drivers || []).filter(function(x){ return x.balance > 0.009; }).map(function(x){ return esc(x.name) + ' ' + mny(x.balance); }).join(" · ") || 'اضغط تسجّل الاستلام') + '</small></button></div>';
  }
  document.addEventListener('click', function(e){ if (mode === 'admin' && e.target.closest('[data-tip-canceled]')) { oState.f='canceled'; oState.range=30; showTab('olist'); } });
  function tipsHTML(list, inStats){
    if (!list.length) return inStats ? '' : '<h2>نصائح من أجلك</h2><p class="hint">تبدأ التوصيات بعد توفر بيانات كافية. راجع صور المنتجات وأرقام التواصل والأسعار الآن.</p>';
    return (inStats ? '<div class="tips-box">' : '') + '<h2>' + ic("spark") + 'نصائح من أجلك</h2><p class="hint">مرتّبة حسب الأولوية. التقديرات تساعدك على القرار ولا تضمن نتيجة.</p><div class="tips-list">' + list.map(function(t){ return '<div class="tip ' + (t.k || '') + '"><span class="ic">' + ic(t.ic) + '</span><span class="t"><small class="tip-priority">' + (t.k === 'warn' ? 'أولوية عالية' : t.k === 'good' ? 'فرصة تحسين' : 'خطوة مقترحة') + '</small>' + t.html + '</span>' + (t.act ? '<button type="button" class="btn btn-soft sm" ' + t.act[0] + '>' + t.act[1] + '</button>' : '') + '</div>'; }).join("") + '</div>' + (inStats ? '</div>' : '');
  }
  function insights(j){
    var out = [], cur = j.daily.filter(function(d){ return d.day >= j.from; }), old = j.daily.filter(function(d){ return d.day < j.from; });
    var A = sumDays(cur), B = sumDays(old);
    // 1) stock running out soon
    var per = {}; j.items.forEach(function(x){ per[x.id] = x.qty / j.days; });
    var soon = draft.products.filter(function(p){ if (!(p.stock && per[p.id] > 0)) return false; var q = qtyOf(p.id); return q != null && q / per[p.id] <= 3; }).map(function(p){ return { p: p, d: qtyOf(p.id) / per[p.id] }; }).sort(function(a, b){ return a.d - b.d; });
    soon.slice(0, 2).forEach(function(x){ out.push({ ic: "box", k: "warn", html: '<b>' + esc(x.p.name) + '</b> ' + (x.d <= 0 ? 'نفد مخزونه' : x.d < 1 ? 'قد ينفد خلال يوم' : 'قد ينفد خلال ' + Math.ceil(x.d) + ' يوم') + ' حسب سرعة البيع (باقي ' + num(qtyOf(x.p.id)) + '). متوسط البيع خلال ' + num(j.days) + ' يوم؛ راجع التوريد قبل تعديل الكمية.', act: ['data-gostock="' + x.p.id + '"', 'عدّل الكمية'] }); });
    // 2) trend
    if (prevOk(j) && B.orders >= 20 && A.orders >= 20 && B.revenue > 0 && A.revenue > 0) { var ch = Math.round((A.revenue - B.revenue) / B.revenue * 100); if (Math.abs(ch) >= 10) out.push({ ic: "chart", k: ch > 0 ? "good" : "warn", html: 'المبيعات ' + (ch > 0 ? 'زادت' : 'نقصت') + ' <b>' + Math.abs(ch) + '٪</b> عن الفترة اللي قبلها (' + mny(A.revenue) + ' مقابل ' + num(Math.round(B.revenue)) + ' ريال). راجع تغيّر عدد الطلبات ومتوسط السلة قبل تعديل الأسعار.', act: ['data-atab="stats"', 'راجع التحليل'] }); }
    // 3) busiest time
    if (j.hours.length >= 5) { var byDow = [0,0,0,0,0,0,0], byH = {}; j.hours.forEach(function(x){ byDow[new Date(x.day + "T12:00:00Z").getUTCDay()] += x.orders; byH[x.hour] = (byH[x.hour] || 0) + x.orders; });
      var bd = byDow.indexOf(Math.max.apply(null, byDow)), bh = Number(Object.keys(byH).sort(function(a, b){ return byH[b] - byH[a]; })[0]);
      out.push({ ic: "truck", html: 'أكثر يوم طلبات: <b>' + DOW[bd] + '</b>، وأكثر ساعة عبر جميع الأيام <b>' + (bh % 12 || 12) + (bh < 12 ? ' الصبح' : bh < 17 ? ' الظهر' : ' بالليل') + '</b> بتوقيت الرياض. جهّز الموظفين والمندوب قبل الذروة؛ اليوم والساعة محسوبان بشكل مستقل.' }); }
    // 4) lost customers
    var C = j.customers || {};
    if (C.gone >= 3) out.push({ ic: "user", k: "warn", html: '<b>' + num(C.gone) + ' زبون</b> كانوا يطلبون منك أكثر من مرة وما طلبوا من شهر. رسالة عرض بسيطة ممكن ترجّعهم.', act: ['data-atab="cust"', 'راسلهم'] });
    // 5) searched but not found
    var miss = (j.searches || []).filter(function(x){ return x.miss >= 3; }).sort(function(a, b){ return b.miss - a.miss; })[0];
    if (miss) out.push({ ic: "search", html: 'الزبائن دوّروا على <b>«' + esc(miss.q) + '»</b> ' + num(miss.miss) + ' مرة دون نتائج. راجع توفر المنتج وتهجئة اسمه قبل طلب بضاعة جديدة.', act: ['data-atab="prods"', 'راجع المنتجات'] });
    // 6) low margin best seller
    var lm = j.items.filter(function(x){ return x.qty > 0 && x.revenue > 0 && x.cost > 0 && dById(x.id); }).slice(0, 10).filter(function(x){ return (x.revenue - x.cost) / x.revenue < 0.1; })[0];
    if (lm) out.push({ ic: "tag", k: "warn", html: '<b>' + esc(pname(lm.id)) + '</b> من الأكثر مبيعًا بس ربحه <b>' + Math.round((lm.revenue - lm.cost) / lm.revenue * 100) + '٪</b> بس. راجع سعره أو سعر شرائه.', act: ['data-gostock="' + lm.id + '"', 'افتح المنتج'] });
    // 7) viewed but not bought
    var sm = {}; j.items.forEach(function(x){ sm[x.id] = x.qty; });
    var cold = (j.views || []).filter(function(v){ return v.views >= 10 && dById(v.id) && (sm[v.id] || 0) <= v.views * 0.1; }).sort(function(a, b){ return b.views - a.views; })[0];
    if (cold) out.push({ ic: "spark", html: '<b>' + esc(pname(cold.id)) + '</b> انفتح ' + num(cold.views) + ' مرة وانباع ' + num(sm[cold.id] || 0) + ' قطعة. المشاهدات ليست زبائن فريدين؛ افحص التوفر والصورة والسعر أولًا.', act: ['data-gostock="' + cold.id + '"', 'راجع المنتج'] });
    // 8) frequent pair not yet suggested
    var bestPair = null;
    (j.pairs || []).forEach(function(pr){ [[pr.a, pr.b], [pr.b, pr.a]].forEach(function(ab){ var base = j.ordersWith[ab[0]] || 0, px = dById(ab[0]); if (base >= 5 && px && dById(ab[1]) && (px.sugg || []).indexOf(ab[1]) < 0) { var c = pr.n / base; if (c >= 0.35 && (!bestPair || c > bestPair.c)) bestPair = { x: ab[0], y: ab[1], c: c }; } }); });
    if (bestPair) out.push({ ic: "plus", k: "good", html: '<b>' + Math.round(bestPair.c * 100) + '٪</b> من اللي ياخذون ' + esc(pname(bestPair.x)) + ' ياخذون معه <b>' + esc(pname(bestPair.y)) + '</b>. حطه مقترح في صفحة المنتج.', act: ['data-mksugg="' + bestPair.x + ':' + bestPair.y + '"', 'حطه مقترح'] });
    // 9) cancel rate
    if (A.orders + A.canceled >= 20 && A.canceled / (A.orders + A.canceled) > 0.08) out.push({ ic: "lock", k: "warn", html: 'نسبة الإلغاء <b>' + pct(A.canceled, A.orders + A.canceled) + '٪</b> من ' + num(A.orders + A.canceled) + ' طلبًا. راجع أسباب الإلغاء قبل تقديم خصومات.', act: ['data-tip-canceled', 'راجع الملغية'] });
    // 10) missing purchase prices
    var noCost = Math.max(0, draft.products.filter(function(p){ return p.stock; }).length - COST_N);
    if (noCost && STK_OK) out.push({ ic: "tag", html: '<b>' + num(noCost) + ' منتج</b> بدون «سعر الشراء»، فالربح ما ينحسب لها.', act: ['data-atab="prods"', 'حط الأسعار'] });
    var noPhoto = draft.products.filter(function(p){ return p.stock && !(p.img && draft.imgs[p.img]); }).length;
    if (noPhoto) out.push({ ic: 'box', html: '<b>' + num(noPhoto) + ' منتج متاح</b> بدون صورة فعلية. ابدأ بالأكثر مبيعًا وصوّر الحجم والعلامة بوضوح.', act: ['data-atab="prods"', 'أكمل الصور'] });
    return out.map(function(t,i){ return { t:t, i:i }; }).sort(function(a,b){ return (a.t.k === 'warn' ? 0 : a.t.k === 'good' ? 2 : 1) - (b.t.k === 'warn' ? 0 : b.t.k === 'good' ? 2 : 1) || a.i-b.i; }).slice(0,7).map(function(x){ return x.t; });
  }

  /* ---------- driver cash ---------- */
  function renderCash(){
    var box = $("cashCard"); if (!box) return;
    box.innerHTML = '<h2>كاش المندوب</h2><p class="hint">جاري التحميل…</p>';
    api("/admin/cash", { pin: adminPin }).then(cashRender);
  }
  function cashRender(j){
    var box = $("cashCard"); if (!box) return;
    if (!j.ok) { box.innerHTML = '<h2>كاش المناديب</h2><p class="status err">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما قدرنا نجيب الحساب.") + '</p>'; return; }
    var ds = (j.drivers || []).slice(); if (!ds.length) ds = [{ id: "d0", name: "المندوب", balance: j.balance }];
    box.innerHTML = '<div class="sec-head" style="margin:0"><h2>كاش المناديب</h2>' + (j.since ? '<span class="hint">من ' + new Date(j.since).toLocaleDateString("ar-SA-u-nu-latn") + '</span>' : '') + '</div>' +
      '<p class="hint">كل طلب كاش يوصّله المندوب يزيد اللي عنده، وكل استلام تسجله له ينقص. كل مندوب حسابه لحاله.</p>' +
      '<div class="cash-drv">' + ds.map(function(d){ return '<div class="cdrow' + (d.balance > 0.009 ? ' due' : '') + '"><div class="n"><b>' + esc(d.name) + '</b><span>' + (d.balance > 0.009 ? 'عنده <b>' + num(d.balance) + '</b> ر.س' : d.balance < -0.009 ? 'استلمت منه أكثر بـ ' + num(-d.balance) : 'سلّم كل شي') + '</span></div>' +
        (d.id !== "" ? '<input type="number" min="0" step="0.5" inputmode="decimal" placeholder="المبلغ" data-camt="' + esc(d.id) + '" aria-label="المبلغ المستلم من ' + esc(d.name) + '"><button class="btn btn-brand sm" type="button" data-cadd="' + esc(d.id) + '">سجّل الاستلام</button>' + (d.balance > 0.009 ? '<button class="btn btn-soft sm" type="button" data-cadd="' + esc(d.id) + '" data-v="' + d.balance + '">استلمت الكل</button>' : '') : '<span class="hint">طلبات تسجّلت «تم التوصيل» من الإدارة بدون مندوب</span>') + '</div>'; }).join("") + '</div>' +
      '<input id="cashNote" class="cash-note" maxlength="100" placeholder="ملاحظة على الاستلام (اختياري)"><p class="status" id="cashMsg" aria-live="polite"></p>' +
      (j.days.length ? '<div class="tbl"><b>آخر الأيام (كل المناديب)</b>' + j.days.map(function(d){ return '<div class="trow cashd"><span class="nm">' + esc(d.day) + '</span><span class="v">' + num(d.n) + ' طلب كاش</span><span class="v">' + num(d.cash) + ' ر.س</span><span class="v muted">استلمت ' + num(d.got) + '</span></div>'; }).join("") + '</div>' : '') +
      (j.history.length ? '<div class="tbl"><b>الاستلامات</b>' + j.history.slice(0, 12).map(function(h){ return '<div class="trow cashd"><span class="nm">' + oTime(h.at) + '</span><span class="v">' + esc(h.drvName || "") + '</span><span class="v">' + num(h.amount) + ' ر.س</span><span class="v muted">' + esc(h.who) + (h.note ? ' · ' + esc(h.note) : '') + '</span></div>'; }).join("") + '</div>' : '');
    Array.prototype.forEach.call(box.querySelectorAll("[data-cadd]"), function(b){ b.addEventListener("click", function(){
      var id = this.dataset.cadd, inp = box.querySelector('[data-camt="' + id + '"]'), v = this.dataset.v ? Number(this.dataset.v) : Number(inp && inp.value), m = $("cashMsg");
      if (!(v > 0)) { m.className = "status err"; m.textContent = "اكتب المبلغ."; return; }
      m.className = "status"; m.textContent = "جاري الحفظ…";
      api("/admin/cash", { pin: adminPin, add: v, drv: id, note: $("cashNote").value }).then(function(r){ if (!r.ok) { m.className = "status err"; m.textContent = "ما انحفظ."; return; } cashRender(r); if (todayCache) { todayCache.cashBalance = r.balance; todayCache.drivers = r.drivers; } }); }); });
  }

  /* ---------- الموظفين: المناديب والكاشيرية ---------- */
  var staffCache = null, staffLast = null, staffEdit = "";
  function loadStaff(cb){ api("/admin/team", { pin: adminPin }).then(function(j){ if (j.ok) staffCache = j.staff; if (cb) cb(j); }); }
  function renderStaff(){
    var box = $("staffCard"); if (!box) return;
    box.innerHTML = '<h2>الموظفين</h2><p class="hint">جاري التحميل…</p>';
    loadStaff(staffHTML);
  }
  function staffHTML(j){
    var box = $("staffCard"); if (!box) return; staffLast = j;
    if (!j.ok) { box.innerHTML = '<h2>الموظفين</h2><p class="status err">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare عشان تقدر تضيف مناديب." : "ما قدرنا نجيب القائمة.") + '</p>'; return; }
    var base = location.origin + location.pathname;
    var rows = j.staff.map(function(s){ var t = s.today || {}, ed = staffEdit === s.id;
      return '<div class="srow' + (s.active ? '' : ' off') + '"><span class="rl ' + s.role + '">' + (s.role === "cashier" ? "كاشير (موقوف)" : "مندوب") + '</span><b>' + esc(s.name) + '</b><span class="hint">' +
        (!s.active ? 'موقوف، ما يقدر يدخل' : s.role === "cashier" ? 'البيع في المحل انشال من الموقع' : 'وصّل اليوم ' + num(t.done) + (t.open ? ' · معه ' + num(t.open) + ' طلب الحين' : '')) + '</span>' +
        '<button type="button" class="btn btn-soft sm" data-sedit="' + esc(s.id) + '">' + (ed ? 'إغلاق' : 'تعديل') + '</button></div>' +
        (ed ? '<div class="sedit" data-sid="' + esc(s.id) + '"><label>الاسم<input data-se="name" value="' + esc(s.name) + '" maxlength="30"></label><label>رقم سري جديد<input data-se="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" placeholder="اتركه فاضي إذا ما تبغى تغيّره"></label><label class="chk"><input type="checkbox" data-se="active"' + (s.active ? ' checked' : '') + '>شغّال (يقدر يدخل)</label><button class="btn btn-brand sm" type="button" data-ssave="' + esc(s.id) + '">احفظ</button></div>' : '');
    }).join("");
    box.innerHTML = '<h2>المناديب</h2><p class="hint">كل مندوب له رقم سري خاص، واسمه يطلع في الطلبات والكاش وسجل العمليات. يدخل برقمه من زر الدخول أو من تطبيق المندوب. لو ترك أحد الشغل، اضغط «تعديل» وشيل علامة «شغّال».</p>' +
      (rows ? '<div class="slist">' + rows + '</div>' : '<p class="hint">ما فيه موظفين للحين.</p>') +
      '<div class="sadd"><b>أضف مندوب</b><label>الاسم<input id="sNew" maxlength="30" placeholder="مثال: سعيد"></label><label>الرقم السري<input id="sNewPin" type="password" inputmode="numeric" maxlength="12" autocomplete="new-password" placeholder="٤ إلى ١٢ رقم"></label><button class="btn btn-brand" type="button" id="sAdd">أضف</button></div>' +
      '<p class="status" id="sMsg" aria-live="polite"></p>' +
      '<div class="actions"><button class="btn btn-soft" type="button" data-scopy="' + esc(base + "#driver") + '">انسخ رابط المندوب</button></div>';
    $("sAdd").addEventListener("click", function(){ staffSave({ name: $("sNew").value, role: "driver", newPin: $("sNewPin").value.trim() }); });
  }
  function staffErr(c){ return c === "pin_taken" ? "هالرقم مستخدم لموظف ثاني أو للإدارة. اختر رقم ثاني." : c === "bad_pin_format" ? "الرقم السري لازم يكون أرقام بس، من ٤ إلى ١٢ رقم." : c === "pin_required" ? "اكتب رقم سري للموظف الجديد." : c === "bad_name" ? "اكتب الاسم." : c === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما انحفظ (" + (c || "?") + ")."; }
  function staffSave(body){
    var m = $("sMsg"); m.className = "status"; m.textContent = "جاري الحفظ…";
    api("/admin/team-save", Object.assign({ pin: adminPin }, body)).then(function(j){
      if (!j.ok) { var m1 = $("sMsg"); m1.className = "status err"; m1.textContent = staffErr(j.code); return; }
      staffCache = j.staff; staffEdit = ""; staffHTML(j); var m2 = $("sMsg"); m2.className = "status"; m2.textContent = body.id ? "انحفظ." : "انضاف. أعطه الرقم السري ورابط الدخول.";
    });
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-sedit]"))) { staffEdit = staffEdit === t.dataset.sedit ? "" : t.dataset.sedit; if (staffLast) staffHTML(staffLast); return; }
    if ((t = e.target.closest("[data-ssave]"))) { var w = t.closest(".sedit"); staffSave({ id: t.dataset.ssave, name: w.querySelector('[data-se="name"]').value, newPin: w.querySelector('[data-se="pin"]').value.trim(), active: w.querySelector('[data-se="active"]').checked }); return; }
    if ((t = e.target.closest("[data-scopy]"))) { var u = t.dataset.scopy, m = $("sMsg"); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function(){ m.className = "status"; m.textContent = "اننسخ: " + u; }, function(){ m.className = "status"; m.textContent = u; }); return; }
  });
  document.addEventListener("change", function(e){
    if (mode !== "admin" || !e.target.dataset || !e.target.dataset.oassign) return;
    var sel = e.target, no = sel.dataset.oassign, m = $("oMsg"); sel.disabled = true;
    api("/admin/assign", { pin: adminPin, no: no, drv: sel.value }).then(function(j){
      sel.disabled = false;
      if (!j.ok) { if (m) { m.className = "status err"; m.textContent = j.code === "closed" ? "الطلب خلص، ما يتحوّل." : "ما انحفظ."; } return; }
      var o = oFind(no); if (o) { o.drv = j.drv || ""; o.status = j.state || o.status; var x = (staffCache || []).filter(function(s){ return s.id === j.drv; })[0]; o.drvName = x ? x.name : ""; }
      openOrder(no); renderOList(); var m2 = $("oMsg"); if (m2) { m2.className = "status"; m2.textContent = j.drv ? "انحوّل، ووصله إشعار." : "رجع لكل المناديب."; }
    });
  });

  /* ---------- أصناف انباعت في المحل وهي مو مسجلة ---------- */
  function loadOpenItems(){
    var box = $("openItems"); if (!box || !apiUrl()) return;
    api("/admin/openitems", { pin: adminPin }).then(function(j){
      if (!j.ok || !j.items.length) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = '<h2>أصناف انباعت في المحل وهي مو في المتجر</h2><p class="hint">الكاشير باعها بباركود جديد أو كصنف يدوي. أضفها للمتجر عشان تنباع بسعرها ومخزونها، أو تجاهلها.</p>' +
        '<div class="oi-list">' + j.items.map(function(x, i){ return '<div class="oi-row"><b>' + esc(x.name) + '</b><span dir="ltr">' + esc(x.bc || "—") + '</span><span>' + num(x.price) + ' ر.س</span><span class="hint">انباع ' + num(x.n) + '</span><button class="btn btn-brand sm" type="button" data-oiadd="' + i + '">أضف للمتجر</button><button class="btn btn-ghost sm" type="button" data-oidel="' + i + '">تجاهل</button></div>'; }).join("") + '</div>';
      box.onclick = function(e){
        var t = e.target.closest("[data-oiadd],[data-oidel]"); if (!t) return;
        var x = j.items[Number(t.dataset.oiadd != null ? t.dataset.oiadd : t.dataset.oidel)];
        if (t.dataset.oiadd != null) {
          var cat = aFilter.cat !== "all" ? aFilter.cat : (draft.cats[0] && draft.cats[0].id), np = { id: uid("p"), name: x.name, unit: "حبة", price: x.price, cat: cat, img: "", stock: true };
          if (x.bc) np.bc = x.bc; draft.products.unshift(np); aFilter.q = ""; if ($("aQ")) $("aQ").value = ""; markDirty(); renderAProds();
        }
        api("/admin/openitems", { pin: adminPin, del: { bc: x.bc, name: x.name } }).then(loadOpenItems);
        if (t.dataset.oiadd != null) { var st = $("aStatus"); if (st) { st.className = "status"; st.textContent = "انضاف «" + x.name + "» فوق. اختر قسمه وصورته، وبعدين «حفظ تغييرات المتجر»."; } }
      };
    });
  }

  /* ---------- activity log ---------- */
  var LOGROLE = { manager: "مدير", orders: "موظف طلبات", preparer: "مجهّز", cashier: "كاشير توصيل", driver: "مندوب" };
  var LOGACT = {
    staff_account: function(i, r){ return 'حفظ حساب الموظف <b>' + esc(i.name || r) + '</b> · ' + (i.active ? 'مفعّل' : 'موقوف') + ' · ' + (LOGROLE[i.role] || 'موظف') + (i.pin ? ' · رقم سري جديد' : ''); },
    staff_add: function(i){ return 'أضاف ' + (LOGROLE[i.role] || 'موظف') + ' <b>' + esc(i.name || "") + '</b>'; },
    staff_edit: function(i){ return 'عدّل ' + (LOGROLE[i.role] || 'موظف') + ' <b>' + esc(i.name || "") + '</b> · ' + (i.active ? 'مفعّل' : 'موقوف') + (i.pin ? ' · رقم سري جديد' : ''); },
    order_add: function(i, r){ return 'أضاف لطلبه <b dir="ltr">' + esc(r) + '</b>: «' + esc(i.add || "") + '»'; },
    suggestion: function(i, r){ return 'كتب رأيه' + (r ? ' بعد الطلب <b dir="ltr">' + esc(r) + '</b>' : '') + (i.stars ? ' (' + num(i.stars) + '★)' : '') + (i.text ? ': «' + esc(i.text) + '»' : ''); },
    cancel_order: function(i, r){ return '<b class="down">لغى</b> طلبه <b dir="ltr">' + esc(r) + '</b>' + (i.reason ? ' · السبب: ' + esc(i.reason) : ''); },
    rate_order: function(i, r){ return 'قيّم الطلب <b dir="ltr">' + esc(r) + '</b> بـ <b>' + num(i.stars) + '★</b>' + (i.from ? ' (كان ' + num(i.from) + '★)' : ''); },
    sub_propose: function(i, r){ return 'اقترح بديل في الطلب <b dir="ltr">' + esc(r) + '</b>: «' + esc(i.to || "") + '» بدل «' + esc(i.from || "") + '»'; },
    prep: function(i, r){ return (i.stage === "ready" ? 'جهّز الطلب <b dir="ltr">' + esc(r) + '</b> وصار جاهز للمندوب' : 'بدأ يجهّز الطلب <b dir="ltr">' + esc(r) + '</b>') + (i.missing ? ' · ' + num(i.missing) + ' ناقص' : ''); },
    claim: function(i, r){ return 'مسك الطلب <b dir="ltr">' + esc(r) + '</b>'; },
    assign: function(i, r){ return 'حوّل الطلب <b dir="ltr">' + esc(r) + '</b>' + (i.from ? ' من ' + esc(i.from) : '') + (i.to ? ' إلى <b>' + esc(i.to) + '</b>' : ' (بدون مندوب)'); },
    driver_settlement: function(i, r){ return 'أكّد استلام <b>' + num((i.actual || 0) / 100) + ' ر.س</b> كاش من المندوب ليوم <span dir="ltr">' + esc(r) + '</span>' + (i.difference ? ' · <b class="down">فرق ' + num(i.difference / 100) + ' ر.س</b>' : ''); },
    promo_push: function(i, r){ return 'أرسل إشعار للزبائن «' + esc(r) + '» لـ ' + num(i.total || 0) + ' جهاز'; },
    cart_remind_set: function(i){ return (i.on ? 'شغّل' : 'أوقف') + ' تذكير السلة التلقائي' + (i.on && i.hours ? ' (بعد ' + num(i.hours) + ' ساعة)' : ''); },
    cart_remind: function(i){ return 'تذكير السلة: انرسل لـ ' + num(i.sent || 0) + ' جهاز'; },
    apns_fail: function(){ return 'إشعارات الآيفون ما انرسلت (راجع مفتاح APNs)'; },
    apns_key: function(){ return 'حفظ مفتاح إشعارات الآيفون'; },
    opex: function(i){ return 'حدّث التكاليف' + (i.confirmed ? ' واعتمدها' : ''); },
    prep_mode: function(i){ return 'غيّر وضع التجهيز إلى «' + ({ on: "شغّال", off: "موقوف", auto: "تلقائي" }[i.mode] || esc(i.mode || "تلقائي")) + '»' + (i.lateMin ? ' · مهلة التأخير ' + num(i.lateMin) + ' د' : ''); },
    cashback_policy: function(i){ return (i.enabled ? 'شغّل' : 'أوقف') + ' الكاش باك' + (i.enabled && i.rate ? ' (' + num(i.rate) + '٪)' : ''); },
    wallet_account: function(i, r){ return 'فتح محفظة لزبون (…' + esc(r) + ')'; },
    pos_policy: function(i){ return (i.requireReceipt ? 'شغّل' : 'أوقف') + ' اشتراط اعتماد الكاشير قبل خروج المندوب'; },
    pos_issue: function(i, r){ return 'اعتمد إيصال الطلب <b dir="ltr">' + esc(r) + '</b> (نسخة ' + num(i.revision || 1) + ') بـ ' + num((i.total || 0) / 100) + ' ر.س'; },
    pos_close: function(){ return 'قفل وردية الكاشير'; },
    price: function(i){ return 'غيّر سعر <b>' + esc(i.name) + '</b> من ' + num(i.from) + ' إلى ' + num(i.to) + ' ر.س'; },
    sale: function(i){ return i.to ? 'حط خصم على <b>' + esc(i.name) + '</b> (قبل الخصم ' + num(i.to) + ')' : 'شال الخصم عن <b>' + esc(i.name) + '</b>'; },
    avail_on: function(i){ return 'رجّع <b>' + esc(i.name) + '</b> متوفر'; }, avail_off: function(i){ return 'خلّى <b>' + esc(i.name) + '</b> غير متوفر'; },
    prod_add: function(i){ return 'أضاف منتج <b>' + esc(i.name) + '</b> بـ ' + num(i.price) + ' ر.س'; }, prod_del: function(i){ return 'حذف منتج <b>' + esc(i.name) + '</b>'; },
    bulk_import: function(i){ return 'استيراد أصناف من ملف: انضاف <b>' + num(i.added || 0) + '</b> منتج، تغيّر سعر ' + num(i.prices || 0) + '، مخزون ' + num(i.stock || 0) + '، تكلفة ' + num(i.costs || 0) + (i.removed ? '، انحذف ' + num(i.removed) : ''); },
    stock: function(i){ return 'عدّل مخزون <b>' + esc(i.name) + '</b> من ' + (i.from == null ? 'بدون عدّ' : num(i.from)) + ' إلى ' + (i.to == null ? 'بدون عدّ' : num(i.to)); },
    cost: function(i){ return 'عدّل سعر الشراء لـ <b>' + esc(i.name) + '</b>'; },
    store_close: function(){ return '<b>قفل المحل</b> (وقف الطلبات)'; }, store_open: function(){ return '<b>فتح المحل</b>'; },
    fees: function(i){ return 'غيّر رسوم التوصيل إلى ' + num(i.fee) + ' ر.س' + (i.freeOver ? '، ومجاني فوق ' + num(i.freeOver) : ''); },
    pin_admin: function(){ return 'غيّر <b>الرقم السري للإدارة</b>'; }, pin_driver: function(){ return 'غيّر <b>رقم المندوب</b>'; },
    order_new: function(i, r){ return 'سجّل طلب ' + ({ phone: "بالاتصال", whatsapp: "بالواتساب", store: "في المحل" }[i.src] || "") + ' <b dir="ltr">' + esc(r) + '</b> بـ ' + num(i.total) + ' ر.س' + (i.force ? ' (تجاوز المخزون)' : ''); },
    order_edit: function(i, r){ return 'عدّل الطلب <b dir="ltr">' + esc(r) + '</b> من ' + num(i.before) + ' إلى ' + num(i.after) + ' ر.س'; },
    status: function(i, r){ return (i.to === "canceled" ? '<b class="down">لغى</b> الطلب ' : i.from === "canceled" ? 'رجّع الطلب الملغي ' : 'غيّر حالة الطلب ') + '<b dir="ltr">' + esc(r) + '</b>' + (i.to !== "canceled" && i.from !== "canceled" ? ' إلى «' + (OST[i.to] || i.to) + '»' : '') + ' (' + num(i.total) + ' ر.س)'; },
    promo_save: function(i, r){ return (i.active === false ? 'أوقف' : 'حفظ') + ' كود الخصم <b dir="ltr">' + esc(r) + '</b>' + (i.value ? ' (' + num(i.value) + (i.kind === 'percent' ? '٪' : ' ر.س') + ')' : ''); },
    promo_remove: function(i, r){ return 'حذف كود الخصم <b dir="ltr">' + esc(r) + '</b>'; },
    winback: function(i){ return 'راسل زبون ما رجع (…' + esc(i.tail || "") + ') بالواتساب'; },
    cash_in: function(i){ return 'استلم <b>' + num(i.amount) + ' ر.س</b> كاش من المندوب' + (i.note ? ' (' + esc(i.note) + ')' : ''); }
  };
  function renderLog(force){
    var box = $("aLog"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">السجل يحتاج خادم الطلبات.</p></div>'; return; }
    if (!logState.list || force) { box.innerHTML = '<div class="card"><p class="hint">جاري التحميل…</p></div>'; api("/admin/log", { pin: adminPin }).then(function(j){ logState.list = j.ok ? j.log : []; logState.err = j.ok ? "" : j.code; renderLog(); }); return; }
    var F = { imp: "المهم", all: "الكل", price: "الأسعار", order: "الطلبات", cancel: "الإلغاء", stock: "المخزون", cash: "الكاش" };
    var match = function(x){ var f = logState.f; return f === "all" || (f === "imp" && !(x.act === "status" && x.info.to !== "canceled" && x.info.from !== "canceled")) || (f === "price" && (x.act === "price" || x.act === "sale" || x.act === "cost")) || (f === "order" && /^order_|status|^prep$|sub_propose|claim|assign|cancel_order|rate_order/.test(x.act)) || (f === "cancel" && (x.act === "cancel_order" || (x.act === "status" && (x.info.to === "canceled" || x.info.from === "canceled")))) || (f === "stock" && /^stock|avail_/.test(x.act)) || (f === "cash" && (x.act === "cash_in" || x.act === "driver_settlement")); };
    var l = logState.list.filter(match), lastDay = "";
    box.innerHTML = '<div class="card"><div class="sec-head" style="margin:0"><h2>سجل العمليات</h2><button class="btn btn-soft" type="button" id="logRef">تحديث</button></div><p class="hint">كل تغيير في الأسعار والمخزون والطلبات، مين سواه ومتى. الأسماء من «وش اسمك؟» في النظرة العامة.</p>' +
      '<div class="pays seg mini" role="group">' + Object.keys(F).map(function(k){ return '<button type="button" data-logf="' + k + '" aria-pressed="' + (logState.f === k) + '">' + F[k] + '</button>'; }).join("") + '</div>' +
      (logState.err ? '<p class="status err">' + (logState.err === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما قدرنا نجيب السجل.") + '</p>' :
        l.length ? '<div class="logl">' + l.map(function(x){ var d = new Date(x.at), day = d.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }), f = LOGACT[x.act];
          var head = day !== lastDay ? '<div class="logday">' + esc(day) + '</div>' : ''; lastDay = day;
          return head + '<div class="logrow' + (x.act === "status" && x.info.to === "canceled" ? ' bad' : '') + '"><span class="tm">' + d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }) + '</span><span class="who">' + esc(x.who) + '</span><span class="what">' + (f ? f(x.info || {}, x.ref) : esc(x.act)) + '</span></div>'; }).join("") + '</div>' : '<p class="empty">ما فيه عمليات بهذا الفلتر.</p>') + '</div>';
    $("logRef").addEventListener("click", function(){ renderLog(true); });
  }
  document.addEventListener("click", function(e){ if (mode !== "admin" || !draft) return; var t = e.target.closest("[data-logf]"); if (t) { logState.f = t.dataset.logf; renderLog(); } });

  /* ---------- win back customers who did not return ---------- */
  var WB_DEF = "هلا {الاسم}، معك {المتجر}\nاشتقنا لك! طلبك الجاي نوصّله لين بابك، والطلب صار أسهل من الموقع:\n{الرابط}";
  function wbMsg(){ try { return localStorage.getItem("ohod-wb-msg") || WB_DEF; } catch(e){ return WB_DEF; } }
  function wbAgo(t){ var d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? "اليوم" : d === 1 ? "أمس" : "قبل " + num(d) + " يوم"; }
  function renderWinback(force){
    var box = $("aCust"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">هذي الميزة تحتاج خادم الطلبات.</p></div>'; return; }
    if ((!wb.data || force) && !wb.loading) { wb.loading = true; api("/admin/winback", { pin: adminPin, kind: wb.kind, days: wb.days }).then(function(j){ wb.loading = false; wb.data = j; if (aTab === "cust") renderWinback(); }); }
    var seg = function(arr, key){ return '<div class="pays seg mini" role="group">' + arr.map(function(x){ return '<button type="button" data-wbf="' + key + ':' + x[0] + '" aria-pressed="' + (String(wb[key]) === String(x[0])) + '">' + x[1] + '</button>'; }).join("") + '</div>'; };
    var j = wb.data, st = (j && j.stats) || {};
    var h = '<div class="card"><h2>زبائن ما رجعوا</h2><p class="hint">زبائن طلبوا منك قبل وما رجعوا. أرسل لكل واحد رسالة واتساب بضغطة، والنظام يتابع مين رجع بعدها وكم طلب.</p>' +
      (st.contacted ? '<div class="wb-res"><div><b>' + num(st.contacted) + '</b><span>زبون راسلته</span></div><div class="ok"><b>' + num(st.back || 0) + '</b><span>رجعوا وطلبوا (' + num(Math.round((st.back || 0) / st.contacted * 100)) + '٪)</span></div><div class="ok"><b>' + num(Math.round(st.rev || 0)) + '</b><span>ريال طلبوا بعد الرسالة</span></div></div>' : '') +
      '<div class="wb-f">' + seg([["once","طلبوا مرة وحدة"],["loyal","كانوا يتكررون ووقفوا"],["all","الكل"]], "kind") + seg([[14,"من أسبوعين"],[30,"من شهر"],[60,"من شهرين"],[90,"من ٣ شهور"]], "days") + '</div>' +
      '<details class="wb-tpl"><summary>نص الرسالة</summary><label for="wbMsg" class="hint">تقدر تكتب {الاسم} و{المتجر} و{الرابط} وتتبدل لحالها.</label><textarea id="wbMsg" rows="4">' + esc(wbMsg()) + '</textarea><button type="button" class="linkbtn" id="wbReset">رجّع النص الأصلي</button></details></div>';
    if (!j) { box.innerHTML = h + '<div class="card"><p class="hint">جاري التحميل…</p></div>'; bindWb(); return; }
    if (!j.ok) { box.innerHTML = h + '<div class="card"><p class="status err">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : "ما قدرنا نجيب القائمة (" + esc(j.code || "?") + ").") + '</p></div>'; bindWb(); return; }
    h += '<div class="card"><div class="sec-head" style="margin:0"><b>' + num(j.list.length) + ' زبون</b>' + (j.noPhone ? '<span class="hint">و' + num(j.noPhone) + ' ما بقى رقمهم (انمسح بعد مدة الحفظ في «بيانات المحل»)</span>' : '') + '</div>' +
      (j.list.length ? '<div class="wbl">' + j.list.slice().sort(function(x, y){ return ((x.cat ? 1 : 0) - (y.cat ? 1 : 0)) || (x.cat && y.cat ? x.cat - y.cat : y.rev - x.rev); }).map(function(c){ var back = c.cat && c.last > c.cat;
        return '<div class="wbr"><span class="ic">' + ic("user") + '</span><span class="t"><b>' + esc(c.name || "زبون") + ' <span dir="ltr" class="ph">' + esc(c.phone) + '</span></b>' + contactButtons(c.phone) + '<span>' + (c.n > 1 ? num(c.n) + ' طلبات' : 'طلب مرة وحدة') + ' · ' + num(Math.round(c.rev)) + ' ر.س · آخر طلب ' + wbAgo(c.last) + '</span>' +
          (c.cat ? '<em class="' + (back ? 'back' : '') + '">' + (back ? 'رجع وطلب بعد رسالتك ✓' : 'راسلته ' + wbAgo(c.cat) + (c.cwho ? ' (' + esc(c.cwho) + ')' : '')) + '</em>' : '') + '</span>' +
          '<a class="btn btn-teal sm" target="_blank" rel="noopener" data-wbsend="' + esc(c.ch) + '" data-tail="' + esc(String(c.phone).slice(-4)) + '" href="https://wa.me/966' + esc(String(c.phone).replace(/^0/, "")) + '?text=' + encodeURIComponent(wbText(c)) + '">' + (c.cat ? 'راسله مرة ثانية' : 'واتساب') + '</a></div>'; }).join("") + '</div>'
        : '<p class="empty">ما فيه زبائن بهذا الفلتر. جرّب مدة أقصر أو «الكل».</p>') + '<p class="hint">نصيحة: لا ترسل لنفس الزبون أكثر من مرة في الشهر، عشان ما يحسها إزعاج.</p></div>';
    box.innerHTML = h; bindWb();
  }
  function contactButtons(phone){
    var n = normPhone(phone); if (!n) return '<small class="hint">رقم التواصل غير متاح بعد مدة الحفظ</small>';
    var intl = '966' + n.slice(1);
    return '<span class="customer-contact"><a class="btn btn-soft sm" href="tel:' + n + '">اتصال</a><a class="btn btn-soft sm" target="_blank" rel="noopener" href="https://wa.me/' + intl + '">واتساب</a><button class="btn btn-soft sm" type="button" data-copyphone="' + n + '">نسخ الرقم</button></span>';
  }
  document.addEventListener('click', function(e){
    var b=e.target.closest('[data-copyphone]'); if (mode !== 'admin' || !b) return;
    if (!navigator.clipboard) { sToast('حدّد الرقم الظاهر وانسخه يدويًا'); return; }
    navigator.clipboard.writeText(b.dataset.copyphone).then(function(){ sToast('تم نسخ رقم العميل'); }, function(){ sToast('تعذر النسخ؛ حدّد الرقم وانسخه يدويًا'); });
  });
  function wbText(c){ return wbMsg().replace(/\{الاسم\}/g, c.name || "").replace(/\{المتجر\}/g, D.store.name || "").replace(/\{الرابط\}/g, location.origin + location.pathname).replace(/هلا ،/g, "هلا،"); }
  function bindWb(){
    var t = $("wbMsg"); if (t) t.addEventListener("change", function(){ try { localStorage.setItem("ohod-wb-msg", this.value); } catch(e){} renderWinback(); });
    var r = $("wbReset"); if (r) r.addEventListener("click", function(){ try { localStorage.removeItem("ohod-wb-msg"); } catch(e){} renderWinback(); });
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-wbf]"))) { var k = t.dataset.wbf.split(":"); wb[k[0]] = k[0] === "days" ? Number(k[1]) : k[1]; wb.data = null; renderWinback(); return; }
    if ((t = e.target.closest("[data-wbsend]"))) { var ch = t.dataset.wbsend; api("/admin/winback-mark", { pin: adminPin, ch: ch, tail: t.dataset.tail });
      (wb.data && wb.data.list || []).forEach(function(c){ if (c.ch === ch) { c.cat = Date.now(); c.cwho = STAFF || ""; } }); setTimeout(function(){ if (aTab === "cust") renderWinback(); }, 300); }
  });

  /* ---------- تقييمات الطلبات (الزبون يقيّم بعد التوصيل) ---------- */
  var rt = { days: 30, low: false, data: null, loading: false };
  var RT_TAG = { driver: "المندوب ممتاز", fast: "وصل بسرعة", fresh: "المنتجات طازجة", packing: "تغليف مرتب", late: "تأخر", missing: "منتج ناقص", wrong: "منتج غلط", damaged: "منتج تالف" };
  function rtStars(n){ var h = ""; for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? "on" : "") + '">★</i>'; return '<span class="rt-st" role="img" aria-label="' + num(n) + ' من ٥">' + h + '</span>'; }
  /* اقتراحات الزبائن بعد الطلب (طلب المالك ١٦ نوفمبر ٢٠٢٦): كل اقتراح معه رد جاهز يتعدّل، وزر يفتح واتساب الزبون والرد مكتوب */
  var SG_TOPICS = [
    [/صور|صوره|الصورة/, "بخصوص الصور: نصوّر المنتجات أول بأول، وكل يوم تنضاف صور جديدة 📸"],
    [/ابل باي|أبل باي|apple|مدى|بطاق|الكتروني|إلكتروني|اون لاين|أونلاين|الدفع/i, "بخصوص الدفع: الدفع الإلكتروني (آبل باي ومدى) قريب إن شاء الله، وحالياً تقدر تدفع كاش أو شبكة عند الاستلام 💳"],
    [/تفتح|افتح|باقي الأقسام|الأقسام|خضار|فواكه|مخبز|خبز|اجبان|أجبان|محمص|قهوة/, "بخصوص الأقسام: الخضار والفواكه والمخبز والأجبان والمحمصة بنفتحها قريب، وحالياً أي غرض تبيه اكتبه في «ما لقيت غرضك؟ اكتبه» ونجيبه لك 🥬"],
    [/تأخر|تاخر|متأخر|بطيء|بطي|سرعة|التوصيل/, "بخصوص التوصيل: نعتذر لك لو تأخرنا، ونشتغل على إن الطلب يوصلك أسرع 🛵"],
    [/غالي|الأسعار|الاسعار|سعر|خصم|عروض/, "بخصوص الأسعار: نحرص تكون أسعارنا مثل المحل، وعروضنا تتجدد كل يوم، وبنحط اقتراحك في بالنا 🏷️"],
    [/تطبيق|ايفون|آيفون|اندرويد|أندرويد/, "بخصوص التطبيق: تطبيقنا للآيفون نازل قريب إن شاء الله 📱"],
    [/ناقص|ما لقيت|مو موجود|غير موجود|توفير|توفرون|وفروا/, "بخصوص المنتجات: أي منتج تبيه وما لقيته اكتبه لنا ونوفّره لك إن شاء الله 🛒"]
  ];
  function sgReply(x){
    var t = String(x.text || ""), first = String(x.name || "").trim().split(/\s+/)[0] || "", pts = [];
    SG_TOPICS.forEach(function(k){ if (k[0].test(t)) pts.push(k[1]); });
    var low = x.stars && x.stars <= 2;
    return "هلا" + (first ? " " + first : "") + "، معك متاجر أحد 🌿\n" +
      (low ? "شكراً على صراحتك، ونعتذر لك إن تجربتك ما كانت مثل ما تستاهل." : "شكراً على اقتراحك" + (x.stars >= 4 ? " وعلى تقييمك الحلو" : "") + "، وصلنا وقريناه.") + "\n" +
      (pts.length ? pts.join("\n") + "\n" : "اقتراحك وصل للإدارة ونشتغل عليه.\n") +
      (low ? "ودّنا تعطينا فرصة ثانية، وطلبك الجاي علينا نهتم فيه بنفسنا." : "رأيك يهمنا ويساعدنا نتحسن، ونسعد بخدمتك دايماً 🤍");
  }
  var sgOpenDone = false;
  function sgCardHTML(list){
    if (!list.length) return '<div class="card"><h2>💡 اقتراحات الزبائن</h2><p class="empty">ما فيه اقتراحات بهالفترة للحين.</p></div>';
    var wait = list.filter(function(x){ return !x.replied; }), done = list.filter(function(x){ return x.replied; });
    return '<div class="card sg-card"><h2>💡 اقتراحات الزبائن</h2><p class="hint">اللي يكتبه الزبون بعد ما يطلب. لكل اقتراح رد جاهز تقدر تعدّله، واضغط «أرسل على الواتساب» ويفتح لك محادثة الزبون والرد مكتوب، وينتقل لـ«تم الرد عليها».</p>' +
      '<h3 class="sg-sub">ينتظر رد (' + num(wait.length) + ')</h3>' + (wait.length ? '<div class="sgl">' + wait.map(sgRowHTML).join("") + '</div>' : '<p class="empty">رديت على كل الاقتراحات 👌</p>') +
      (done.length ? '<details class="sg-done"' + (sgOpenDone ? ' open' : '') + '><summary>✓ تم الرد عليها (' + num(done.length) + ')</summary><div class="sgl">' + done.map(sgRowHTML).join("") + '</div></details>' : '') + '</div>';
  }
  function sgRowHTML(x){
    var d = new Date(x.at), done = x.replied, rd = done ? new Date(done.at) : null;
    return (function(){
        return '<div class="sgr' + (done ? ' done' : '') + '"><div class="sg-h"><b>' + esc(x.name || "زبون") + '</b>' + (x.no ? ' <span dir="ltr">' + esc(x.no) + '</span>' : '') + (x.stars ? ' ' + rtStars(x.stars) : '') + '<small>' + esc(d.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long" })) + ' ' + esc(d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" })) + (done ? ' · ✓ انرد عليه ' + esc(rd.toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long" })) + (done.who && done.who !== "الإدارة" ? ' (' + esc(done.who) + ')' : '') : '') + '</small></div>' +
          '<p class="sg-q">«' + esc(x.text) + '»</p>' +
          '<label class="sg-rl">الرد الجاهز<textarea rows="8" data-sgtx="' + x.id + '">' + esc(sgReply(x)) + '</textarea></label>' +
          '<div class="sg-act">' + (x.phone ? '<button type="button" class="btn btn-teal" data-sgwa="' + x.id + '" data-ph="' + esc(x.phone) + '">أرسل على الواتساب</button>' : '<span class="hint">ما فيه جوال (الاقتراح بدون رقم طلب)</span>') +
          '<button type="button" class="btn btn-soft" data-sgcp="' + x.id + '">نسخ الرد</button>' + (x.phone ? '<a class="btn btn-ghost" href="tel:' + esc(x.phone) + '">اتصال · <span dir="ltr">' + esc(x.phone) + '</span></a>' : '') +
          (done ? '<button type="button" class="btn btn-ghost" data-sgundo="' + x.id + '">رجّعه لـ«ينتظر رد»</button>' : '<button type="button" class="btn btn-ghost" data-sgmark="' + x.id + '">رديت عليه</button>') + '</div></div>'; })();
  }
  function sgMark(id, undo){
    var j = rt.data, x = j && (j.suggestions || []).filter(function(y){ return String(y.id) === String(id); })[0]; if (!x) return;
    x.replied = undo ? null : { at: Date.now(), who: STAFF || "" }; if (!undo) sgOpenDone = false; renderRatings();
    api("/admin/sg-done", { pin: adminPin, id: Number(id), undo: !!undo, by: STAFF || "" }).then(function(r){ if (!r.ok) { sToast(r.code === "not_found" ? "حدّث كود الخادم أول" : "ما انحفظ، جرّب مرة ثانية"); x.replied = undo ? x.replied : null; renderRatings(); } });
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft || !e.target.closest) return;
    var m = e.target.closest("[data-sgmark],[data-sgundo]"); if (m) { sgMark(m.dataset.sgmark || m.dataset.sgundo, !!m.dataset.sgundo); return; }
    var t = e.target.closest("[data-sgwa],[data-sgcp]"); if (!t) return;
    var id = t.dataset.sgwa || t.dataset.sgcp, ta = document.querySelector('[data-sgtx="' + id + '"]'), txt = ta ? ta.value : "";
    if (t.dataset.sgwa) { var ph = String(t.dataset.ph || "").replace(/\D/g, "").replace(/^0/, "966"); window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(txt), "_blank", "noopener"); }
    else { var ok = function(){ sToast("انسخ الرد، الصقه في الواتساب"); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function(){ ta.select(); document.execCommand("copy"); ok(); }); else { ta.select(); document.execCommand("copy"); ok(); } }
    // بعد الإرسال أو النسخ: ينتقل لـ«تم الرد عليها» (بعد لحظة عشان يمديه يلصق)
    var j0 = rt.data, x0 = j0 && (j0.suggestions || []).filter(function(y){ return String(y.id) === String(id); })[0];
    if (x0 && !x0.replied) setTimeout(function(){ sgMark(id, false); }, t.dataset.sgwa ? 600 : 1500);
  });
  function renderRatings(force){
    var box = $("aRates"); if (!box) return;
    if (!apiUrl()) { box.innerHTML = '<div class="card"><p class="hint">هذي الميزة تحتاج خادم الطلبات.</p></div>'; return; }
    if ((!rt.data || force) && !rt.loading) { rt.loading = true; api("/admin/ratings", { pin: adminPin, days: rt.days, low: rt.low }).then(function(j){ rt.loading = false; rt.data = j; if (aTab === "rates") renderRatings(); }); }
    var seg = function(arr, key){ return '<div class="pays seg mini" role="group">' + arr.map(function(x){ return '<button type="button" data-rtf="' + key + ':' + x[0] + '" aria-pressed="' + (String(rt[key]) === String(x[0])) + '">' + x[1] + '</button>'; }).join("") + '</div>'; };
    var h = '<div class="card"><h2>تقييمات الطلبات</h2><p class="hint">بعد ما يوصل الطلب، الزبون يقيّمه من ١ لـ ٥ نجوم ويختار ملاحظة سريعة. التقييم ٢ أو أقل يوصلك تنبيه على طول (الإشعارات وتيليجرام).</p>' +
      '<div class="wb-f">' + seg([[7, "آخر أسبوع"], [30, "آخر شهر"], [90, "آخر ٣ شهور"]], "days") + seg([["false", "كل التقييمات"], ["true", "المنخفضة بس (٢ أو أقل)"]], "low") + '</div></div>';
    var j = rt.data;
    if (!j) { box.innerHTML = h + '<div class="card"><p class="hint">جاري التحميل…</p></div>'; return; }
    if (!j.ok) { box.innerHTML = h + '<div class="card"><p class="status err">' + (j.code === "not_found" ? "حدّث كود الخادم في Cloudflare أول." : j.code === "forbidden" ? "ما عندك صلاحية تشوف التقييمات." : "ما قدرنا نجيب التقييمات (" + esc(j.code || "?") + ").") + '</p></div>'; return; }
    var S2 = j.summary || {}, dist = S2.dist || [0, 0, 0, 0, 0], mx = Math.max(1, Math.max.apply(null, dist));
    var trend = S2.prevN ? (S2.avg > S2.prevAvg + 0.05 ? '<em class="up">أحسن من قبل (' + num(S2.prevAvg) + ')</em>' : S2.avg < S2.prevAvg - 0.05 ? '<em class="down">أقل من قبل (' + num(S2.prevAvg) + ')</em>' : '<em>نفس الفترة اللي قبل</em>') : '';
    h += '<div class="card"><div class="wb-res"><div><b>' + (S2.n ? num(S2.avg) + ' ★' : '—') + '</b><span>متوسط التقييم ' + trend + '</span></div><div><b>' + num(S2.n || 0) + '</b><span>تقييم' + (S2.delivered ? ' من ' + num(S2.delivered) + ' طلب وصل (' + num(Math.round((S2.n || 0) / S2.delivered * 100)) + '٪)' : '') + '</span></div><div class="' + (S2.low ? 'bad' : 'ok') + '"><b>' + num(S2.low || 0) + '</b><span>تقييم منخفض (٢ أو أقل)</span></div></div>' +
      '<div class="rt-dist">' + [5, 4, 3, 2, 1].map(function(k){ var n = dist[k - 1] || 0; return '<div><span>' + num(k) + ' ★</span><i><b style="width:' + Math.round(n / mx * 100) + '%"></b></i><span>' + num(n) + '</span></div>'; }).join("") + '</div>' +
      ((j.tags || []).length ? '<p class="hint" style="margin-top:10px">أكثر الملاحظات</p><div class="rt-tags">' + j.tags.map(function(t){ return '<span class="' + (["late", "missing", "wrong", "damaged"].indexOf(t.t) > -1 ? 'bad' : '') + '">' + esc(RT_TAG[t.t] || t.t) + ' <b>' + num(t.n) + '</b></span>'; }).join("") + '</div>' : '') +
      ((j.drivers || []).length > 1 || ((j.drivers || [])[0] && (j.drivers[0].name || "")) ? '<p class="hint" style="margin-top:10px">حسب المندوب</p><div class="rt-tags">' + j.drivers.map(function(d){ return '<span><b>' + esc(d.name || (d.id === "admin" ? "الإدارة" : "مندوب")) + '</b>: ' + num(d.avg) + '★ من ' + num(d.n) + ' تقييم' + (d.low ? '، منها ' + num(d.low) + ' منخفض' : '') + '</span>'; }).join("") + '</div>' : '') + '</div>';
    h += sgCardHTML(j.suggestions || []);
    h += '<div class="card"><div class="sec-head" style="margin:0"><b>' + num(j.list.length) + (j.low ? ' تقييم منخفض' : ' تقييم') + '</b><button class="btn btn-soft" type="button" id="rtRef">تحديث</button></div>' +
      (j.list.length ? '<div class="wbl">' + j.list.map(function(r){ var d = new Date(r.at);
        return '<div class="wbr rtr' + (r.stars <= 2 ? ' bad' : '') + '"><span class="t">' + rtStars(r.stars) + '<b>طلب ' + esc(r.no) + (r.name ? ' · ' + esc(r.name) : '') + (r.total != null ? ' · ' + num(r.total) + ' ر.س' : '') + '</b>' +
          ((r.tags || []).length ? '<span>' + r.tags.map(function(t){ return esc(RT_TAG[t] || t); }).join(" · ") + '</span>' : '') + (r.note ? '<span class="rt-note">«' + esc(r.note) + '»</span>' : '') +
          '<span>' + esc(d.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long" })) + ' ' + esc(d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" })) + (r.drvName ? ' · المندوب: ' + esc(r.drvName) : '') + (r.edits ? ' · عدّله الزبون' : '') + '</span>' +
          (r.stars <= 2 && r.phone ? contactButtons(r.phone) : '') + '</span></div>'; }).join("") + '</div>'
        : '<p class="empty">' + (j.low ? 'ما فيه تقييمات منخفضة بهالفترة 👌' : 'ما فيه تقييمات بهالفترة للحين.') + '</p>') + '</div>';
    box.innerHTML = h;
    if ($("rtRef")) $("rtRef").onclick = function(){ rt.data = null; renderRatings(true); };
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t = e.target.closest("[data-rtf]"); if (!t) return;
    var k = t.dataset.rtf.split(":"); rt[k[0]] = k[0] === "days" ? Number(k[1]) : k[1] === "true"; rt.data = null; renderRatings(true);
  });

  /* ---------- printable in-store offer sign ---------- */
  var sg = { tpl: "market", paper: "a4", pid: "", name: "", unit: "", price: "", old: "", top: "عرض", line: "لفترة محدودة", until: "", img: "", q: "" };
  var SIGN_CSS = '@page{size:A4 portrait;margin:0}' +
    '*{box-sizing:border-box}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.sg{--u:1mm;width:calc(210*var(--u));height:calc(297*var(--u));position:relative;overflow:hidden;background:#fff;color:#111;font-family:"Readex Pro",Tahoma,sans-serif;direction:rtl;display:flex;flex-direction:column;align-items:center;page-break-after:always;break-after:page}' +
    '.sg.a5{--u:0.7071mm}' +
    '.sg .band{width:100%;height:calc(62*var(--u));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(2*var(--u));position:relative}' +
    '.sg .band b{font-size:calc(34*var(--u));line-height:1;font-weight:700;letter-spacing:-.01em}' +
    '.sg .band span{font-size:calc(7.5*var(--u));font-weight:500}' +
    '.sg .logo{position:absolute;top:calc(8*var(--u));left:calc(9*var(--u));width:calc(24*var(--u));height:calc(24*var(--u));border-radius:50%;background:#fff;object-fit:contain;padding:calc(2*var(--u))}' +
    '.sg .pic{flex:1;width:100%;min-height:0;display:flex;align-items:center;justify-content:center;padding:calc(6*var(--u)) calc(20*var(--u)) calc(2*var(--u))}' +
    '.sg .pic img{width:100%;height:100%;object-fit:contain}' +
    '.sg .pic .ph{width:calc(110*var(--u));height:calc(90*var(--u));border:calc(.8*var(--u)) dashed #bbb;border-radius:calc(6*var(--u));display:grid;place-items:center;color:#999;font-size:calc(6*var(--u))}' +
    '.sg .nm{font-weight:700;text-align:center;line-height:1.15;padding:0 calc(12*var(--u));max-width:100%}' +
    '.sg .un{font-size:calc(7*var(--u));color:#555;margin-top:calc(1.5*var(--u))}' +
    '.sg .pr{display:flex;align-items:center;justify-content:center;gap:calc(8*var(--u));width:100%;padding:calc(5*var(--u)) calc(12*var(--u)) calc(10*var(--u))}' +
    '.sg .now{display:flex;align-items:baseline;gap:calc(2.5*var(--u));direction:rtl;font-weight:700;line-height:.9}' +
    '.sg .now .n{direction:ltr;font-variant-numeric:tabular-nums;letter-spacing:-.03em}' +
    '.sg .now .c{font-size:calc(11*var(--u));font-weight:600}' +
    '.sg .was{font-size:calc(8.5*var(--u));color:#555;text-align:center;margin-bottom:calc(-2*var(--u))}' +
    '.sg .was s{text-decoration-thickness:calc(.8*var(--u))}' +
    '.sg .save{width:calc(44*var(--u));height:calc(44*var(--u));border-radius:50%;display:grid;place-items:center;align-content:center;text-align:center;font-weight:700;line-height:1.1;flex:none;transform:rotate(-8deg)}' +
    '.sg .save small{display:block;font-size:calc(5.5*var(--u));font-weight:600}.sg .save b{font-size:calc(11*var(--u))}' +
    '.sg .till{position:absolute;bottom:calc(4*var(--u));left:0;right:0;text-align:center;font-size:calc(5*var(--u));color:#666}' +
    /* red */
    '.sg.red .band{background:#D7192D;color:#fff}.sg.red .now{color:#D7192D}.sg.red .save{background:#FFD21F;color:#111}' +
    '.sg.red::after{content:"";position:absolute;left:0;right:0;bottom:0;height:calc(3*var(--u));background:#D7192D}' +
    /* yellow */
    '.sg.yellow{background:#FFD21F}.sg.yellow .band{color:#111}.sg.yellow .band b{color:#D7192D}' +
    '.sg.yellow .pic{margin:0 calc(14*var(--u));width:auto;align-self:stretch;background:#fff;border-radius:calc(10*var(--u));padding:calc(8*var(--u))}' +
    '.sg.yellow .nm{margin-top:calc(6*var(--u))}.sg.yellow .un{color:#333}.sg.yellow .was{margin-bottom:calc(2*var(--u))}' +
    '.sg.yellow .now{background:#D7192D;color:#fff;border-radius:calc(8*var(--u));padding:calc(4*var(--u)) calc(9*var(--u)) calc(5*var(--u))}' +
    '.sg.yellow .save{background:#111;color:#FFD21F}.sg.yellow .was{color:#222}.sg.yellow .till{color:#333}' +
    /* black and white, ink saver */
    '.sg.bw{border:calc(4*var(--u)) solid #111}.sg.bw .band{height:calc(54*var(--u));border-bottom:calc(1.6*var(--u)) solid #111}' +
    '.sg.bw .band b{font-size:calc(30*var(--u))}.sg.bw .now{color:#111}.sg.bw .save{border:calc(1.4*var(--u)) solid #111;color:#111;transform:none}' +
    '.sg.bw .logo{border:calc(.5*var(--u)) solid #111;top:calc(7*var(--u));left:calc(8*var(--u))}';
  SIGN_CSS += ' .sg.market{background:#FFF7EE;color:#512719;border:calc(3*var(--u)) solid #E96621}.sg.market .band{background:#E96621;color:white;height:calc(58*var(--u));border-radius:0 0 calc(24*var(--u)) 0}.sg.market .now{color:#C7460A}.sg.market .save{background:#512719;color:#fff;border-radius:calc(7*var(--u));transform:rotate(-6deg)}.sg.market .pic{padding:calc(10*var(--u)) calc(24*var(--u))}.sg.market .till{color:#512719} .sg.fresh{background:#F1F6EB;color:#193C2D;border:calc(3*var(--u)) solid #193C2D}.sg.fresh .band{background:#193C2D;color:#fff;height:calc(52*var(--u))}.sg.fresh .band b{font-size:calc(28*var(--u))}.sg.fresh .pic{margin:calc(8*var(--u)) calc(18*var(--u));width:calc(174*var(--u));background:#fff;border-radius:50%;padding:calc(10*var(--u))}.sg.fresh .now{color:#193C2D}.sg.fresh .save{background:#C7E49A;color:#193C2D;transform:none}.sg.fresh .un{color:#365E46} .sg.night{background:#142437;color:#fff}.sg.night .band{align-items:flex-start;padding-right:calc(14*var(--u));height:calc(56*var(--u));border-bottom:calc(1*var(--u)) solid #D5AF64}.sg.night .band b{color:#F3D38C;font-size:calc(29*var(--u))}.sg.night .pic{margin:calc(8*var(--u)) calc(20*var(--u));width:calc(170*var(--u));background:#fff;border-radius:calc(8*var(--u))}.sg.night .now{color:#F3D38C}.sg.night .save{background:#F3D38C;color:#142437;transform:none;border-radius:calc(5*var(--u))}.sg.night .un,.sg.night .was,.sg.night .till{color:#DDD8CC} .sg.clean{border:calc(1*var(--u)) solid #222;background:#fff}.sg.clean .band{height:calc(48*var(--u));border-bottom:calc(1*var(--u)) solid #222;margin:0 calc(10*var(--u));width:calc(190*var(--u))}.sg.clean .band b{font-size:calc(26*var(--u))}.sg.clean .logo{width:calc(20*var(--u));height:calc(20*var(--u))}.sg.clean .save{border:calc(1*var(--u)) solid #222;border-radius:0;transform:none}.sg.clean .nm{border-bottom:calc(.4*var(--u)) solid #bbb;padding-bottom:calc(6*var(--u))}.sg.clean .now{color:#111} ';
  var SIGN_TEMPLATES = [["market","سوق أحد","برتقالي واضح للعروض اليومية"],["fresh","طازج","أخضر للمنتجات الطازجة"],["night","فاخر","كحلي وذهبي للعروض المميزة"],["clean","اقتصادي","أبيض وأسود بطباعة خفيفة"],["red","أحمر","التصميم الكلاسيكي"],["yellow","أصفر","عرض قوي وواضح"],["bw","إطار أسود","بسيط وموفر للحبر"]];
  function sgFit(text, maxMm, perChar, maxW){ var n = Math.max(1, String(text).length); return Math.max(maxMm * 0.42, Math.min(maxMm, maxW / (n * perChar))); }
  function signHTML(o){
    var price = Number(o.price) || 0, old = Number(o.old) || 0, save = old > price ? Math.round((old - price) * 100) / 100 : 0;
    var pTxt = num(price), nmSize = sgFit(o.name || "اسم المنتج", 17, 0.62, 175), prSize = sgFit(pTxt, save ? 54 : 64, 0.6, save ? 120 : 170);
    return '<div class="sg ' + o.tpl + (o.paper === "a5" ? ' a5' : '') + '">' +
      '<div class="band"><img class="logo" src="' + D.imgs.logo + '" alt=""><b>' + esc(o.top || "عرض") + '</b>' + (o.line ? '<span>' + esc(o.line) + '</span>' : '') + '</div>' +
      '<div class="pic">' + (o.img ? '<img src="' + o.img + '" alt="">' : '<div class="ph">صورة المنتج</div>') + '</div>' +
      '<div class="nm" style="font-size:calc(' + nmSize.toFixed(1) + '*var(--u))">' + esc(o.name || "اسم المنتج") + '</div>' + (o.unit ? '<div class="un">' + esc(o.unit) + '</div>' : '') +
      '<div class="pr">' + (save ? '<div class="save"><small>وفّر</small><b>' + num(save) + '</b><small>ريال</small></div>' : '') +
        '<div>' + (save ? '<div class="was">بدل <s>' + num(old) + '</s> ريال</div>' : '') + '<div class="now"><span class="n" style="font-size:calc(' + prSize.toFixed(1) + '*var(--u))">' + pTxt + '</span><span class="c">ريال</span></div></div></div>' +
      (o.until ? '<div class="till">العرض ساري لين ' + esc(o.until) + ' أو حتى نفاد الكمية</div>' : '') + '</div>';
  }
  function signGalleryHTML(){ return SIGN_TEMPLATES.slice(0,4).map(function(t){ var sample=Object.assign({},sg,{tpl:t[0],paper:'a4',name:sg.name || 'جبنة شيدر',unit:sg.unit || 'عبوة ٢٠٠ جرام',price:sg.price || '9.95',old:sg.old || (!sg.pid && !sg.name ? '14.95' : '')}); return '<button type="button" class="sign-choice" data-sgt="'+t[0]+'" aria-pressed="'+(sg.tpl===t[0])+'"><span class="sign-thumb">'+signHTML(sample)+'</span><b>'+t[1]+'</b><small>'+t[2]+'</small></button>'; }).join(''); }
  function renderSign(){
    var box = $("aSign"); if (!box) return;
    if (!$("sgCss")) { var st = document.createElement("style"); st.id = "sgCss"; st.textContent = SIGN_CSS.replace(/@page\{[^}]*\}/, "").replace("body{margin:0;", "body{"); document.head.appendChild(st); }
    var q = sg.q.trim(), res = q ? admFind(q, draft.products).slice(0, 8) : [];
    box.innerHTML = '<div class="sign-wrap"><div class="card sign-form"><h2>ورقة عرض للمحل</h2><p class="hint">اختر المنتج وينحط اسمه وصورته وسعره لحالها، أو اكتب اسم منتج وارفع صورته. بعدها اضغط «اطبع».</p>' +
      '<label>اختر منتج من المتجر<input id="sgQ" type="search" value="' + esc(sg.q) + '" placeholder="اكتب اسم المنتج…" autocomplete="off"></label>' +
      (res.length ? '<div class="sg-res">' + res.map(function(x){ return '<button type="button" data-sgp="' + x.id + '">' + imgTag(x.img, "") + '<span>' + esc(x.name) + '</span><b>' + num(x.price) + '</b></button>'; }).join("") + '</div>' : '') +
      '<div class="fields">' +
        '<label class="wide">اسم المنتج<input data-sg="name" value="' + esc(sg.name) + '" placeholder="مثال: جبنة شيدر"></label>' +
        '<label>الحجم (اختياري)<input data-sg="unit" value="' + esc(sg.unit) + '" placeholder="٢٠٠ جرام"></label>' +
        '<label>سعر العرض<input data-sg="price" type="number" step="0.05" min="0" inputmode="decimal" value="' + esc(sg.price) + '"></label>' +
        '<label>السعر قبل (اختياري)<input data-sg="old" type="number" step="0.05" min="0" inputmode="decimal" value="' + esc(sg.old) + '" placeholder="يطلع مشطوب"></label>' +
        '<label>العرض لين (اختياري)<input data-sg="until" value="' + esc(sg.until) + '" placeholder="مثال: نهاية الشهر"></label>' +
        '<label>الكلمة الكبيرة<input data-sg="top" value="' + esc(sg.top) + '" placeholder="عرض"></label>' +
        '<label>السطر تحتها<input data-sg="line" value="' + esc(sg.line) + '" placeholder="لفترة محدودة"></label>' +
      '</div>' +
      '<div class="sg-img"><label class="btn btn-soft sm" for="sgFile">' + (sg.img ? 'غيّر الصورة' : 'ارفع صورة من الجوال') + '</label><input id="sgFile" type="file" accept="image/*" hidden>' + (sg.img ? '<button type="button" class="linkbtn" id="sgNoImg">بدون صورة</button>' : '') + '</div>' +
      '<div id="sgInfo">' + sgInfo() + '</div>' +
      '<b class="sg-l">التصميم</b><div class="pays seg mini">' + SIGN_TEMPLATES.map(function(x){ return '<button type="button" data-sgt="' + x[0] + '" aria-pressed="' + (sg.tpl === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
      '<b class="sg-l">حجم الورقة</b><div class="pays seg mini">' + [["a4","A4 (ورقة كاملة)"],["a5","A5 (نص ورقة)"]].map(function(x){ return '<button type="button" data-sgs="' + x[0] + '" aria-pressed="' + (sg.paper === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>' +
      '<div class="actions"><button class="btn btn-brand" type="button" id="sgPrint">اطبع</button></div>' +
      '<p class="hint">في نافذة الطباعة: اختر الطابعة، وخلّ «الهوامش: بدون» و«خلفية الرسومات» مفعّلة عشان تطلع الألوان.</p></div>' +
      '<div class="sign-prev" aria-label="معاينة الورقة"><b>معاينة التصميم المختار</b><div class="sg-scale ' + sg.paper + '">' + signHTML(sg) + '</div></div></div><div class="card"><h2>قارن التصاميم</h2><p class="hint">اضغط أي نموذج لتطبيقه. كل النماذج تستخدم نفس بيانات المنتج.</p><div class="sign-gallery">' + signGalleryHTML() + '</div></div>';
    $("sgQ").addEventListener("input", function(){ sg.q = this.value; var pos = this.selectionStart; renderSign(); var n = $("sgQ"); n.focus(); try { n.setSelectionRange(pos, pos); } catch(e){} });
    Array.prototype.forEach.call(box.querySelectorAll("[data-sg]"), function(inp){ inp.addEventListener("input", function(){ sg[this.dataset.sg] = this.value; if (this.dataset.sg === "name" && sg.pid && dById(sg.pid) && this.value !== dById(sg.pid).name) sg.pid = "";
      var pv = box.querySelector(".sg-scale"); if (pv) pv.innerHTML = signHTML(sg); var inf = $("sgInfo"); if (inf) inf.innerHTML = sgInfo(); var gallery=box.querySelector(".sign-gallery"); if(gallery) gallery.innerHTML=signGalleryHTML(); }); });
    $("sgFile").addEventListener("change", function(){ var f = this.files && this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function(){ var im = new Image(); im.onload = function(){ var mx = 1400, k = Math.min(1, mx / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); sg.img = cv.toDataURL("image/jpeg", 0.9); renderSign(); }; im.src = r.result; }; r.readAsDataURL(f); });
    if ($("sgNoImg")) $("sgNoImg").addEventListener("click", function(){ sg.img = ""; renderSign(); });
    $("sgPrint").addEventListener("click", printSign);
  }
  function sgInfo(){
    var p = sg.pid && dById(sg.pid), c = p ? costOf(p.id) : null, pr = Number(sg.price) || 0, marg = c != null && pr > 0 ? Math.round((pr - c) / pr * 100) : null;
    return (marg != null ? '<p class="sg-marg ' + (marg < 0 ? 'bad' : marg < 10 ? 'mid' : 'good') + '">' + (marg < 0 ? 'انتبه: هذا السعر تحت سعر الشراء (' + num(c) + ' ريال)، يعني تخسر في كل حبة.' : 'ربحك بهذا السعر ' + num(Math.round((pr - c) * 100) / 100) + ' ريال في الحبة (' + marg + '٪).') + '</p>' : '') +
      (p && pr && pr !== Number(p.price) ? '<p class="hint">سعر المنتج في الموقع ' + num(p.price) + ' ريال. الورقة ما تغيّر سعر الموقع؛ لو تبغاه في الموقع بعد، عدّله من «المنتجات».</p>' : '');
  }
  function printSign(){
    if (!sg.name.trim() || !(Number(sg.price) > 0) || !Number.isFinite(Number(sg.price))) { sToast("اكتب اسم المنتج وسعر عرض صحيحًا قبل الطباعة"); return; }
    var win = window.open("", "_blank"); if (!win) return;
    var css = SIGN_CSS.replace("size:A4 portrait", sg.paper === "a5" ? "size:A5 portrait" : "size:A4 portrait");
    win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(sg.name || "عرض") + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap"><style>' + css + '</style></head><body>' + signHTML(sg) +
      '<script>(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ var ims = Array.prototype.slice.call(document.images); return Promise.all(ims.map(function(i){ return i.complete ? 0 : new Promise(function(r){ i.onload = i.onerror = r; }); })); }).then(function(){ setTimeout(function(){ print(); }, 250); });<\/script></body></html>');
    win.document.close();
  }
  document.addEventListener("click", function(e){
    if (mode !== "admin" || !draft) return;
    var t;
    if ((t = e.target.closest("[data-sgp]"))) { var p = dById(t.dataset.sgp); if (!p) return; sg.pid = p.id; sg.name = p.name; sg.unit = p.unit || "";
      var onS = p.old && p.old > p.price; sg.price = String(p.price); sg.old = onS ? String(p.old) : ""; sg.img = isPath(p.img) ? p.img : isPhoto(p.img) && draft.imgs[p.img] ? draft.imgs[p.img] : ""; sg.q = ""; renderSign(); return; }
    if ((t = e.target.closest("[data-sgt]"))) { sg.tpl = t.dataset.sgt; renderSign(); return; }
    if ((t = e.target.closest("[data-sgs]"))) { sg.paper = t.dataset.sgs; renderSign(); return; }
  });

  /* ---------- الزوار والتحويل (١٧ نوفمبر ٢٠٢٦): من عدّاد /hit الدقيق. زائر = جهاز مختلف، وأجهزة الموظفين مستثناة ---------- */
  var visDays = 7, visData = null;
  var VIS_SRC = { "": "مباشر (كتب الرابط أو من المفضلة)", qr: "ملصق QR", bag: "ورقة الكيس", google: "قوقل", bing: "بنق", instagram: "انستقرام", facebook: "فيسبوك", tiktok: "تيك توك", snapchat: "سناب شات", x: "إكس (تويتر)", whatsapp: "واتساب", wa: "واتساب", "wa-group": "قروب واتساب الحي", push: "إشعار من المتجر", track: "رابط تتبع الطلب", "home-icon": "أيقونة على شاشة الجوال" };
  var VIS_LINKS = [["qr", "ملصق QR عند الكاشير"], ["bag", "ورقة داخل الكيس"], ["wa-group", "قروب واتساب الحي"], ["instagram", "انستقرام"], ["snapchat", "سناب شات"]];
  function visPct(a, b){ return b ? Math.round(a / b * 1000) / 10 : 0; }
  function visBar(v, max, label, sub){ var w = max ? Math.max(2, Math.round(v / max * 100)) : 0; return '<div class="vis-bar"><span class="l">' + label + '</span><span class="t"><i style="width:' + w + '%"></i></span><b>' + num(v) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  function renderVisits(){
    var box = $("aVisits"); if (!box) return;
    if (!$("visCss")) { var st = document.createElement("style"); st.id = "visCss"; st.textContent = [
      ".vis-chips{display:flex;gap:6px;flex-wrap:wrap}.vis-chips button{min-height:36px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font:inherit;font-weight:700;font-size:13px;padding:0 14px;cursor:pointer}.vis-chips button[aria-pressed=true]{background:#17212B;color:#fff;border-color:#17212B}",
      ".vis-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.vis-kpi{background:#F4F5F7;border-radius:12px;padding:12px;display:grid;gap:2px}.vis-kpi b{font-size:26px;font-variant-numeric:tabular-nums;line-height:1.2}.vis-kpi span{font-size:12.5px;color:#66707C}.vis-kpi small{font-size:12px;font-weight:700}.vis-kpi small.up{color:#0E8A6A}.vis-kpi small.down{color:#B3261E}",
      ".vis-bar{display:grid;grid-template-columns:minmax(90px,170px) minmax(0,1fr) 52px;align-items:center;gap:10px;font-size:13.5px;padding:4px 0}.vis-bar .t{height:12px;background:#EEF0F3;border-radius:6px;overflow:hidden}.vis-bar .t i{display:block;height:100%;background:#0E8A6A;border-radius:6px}.vis-bar b{font-variant-numeric:tabular-nums;text-align:end}.vis-bar small{grid-column:2/-1;color:#66707C;font-size:12px;margin-top:-4px}",
      ".vis-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.vis-tbl th,.vis-tbl td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:start}.vis-tbl td.n,.vis-tbl th.n{text-align:end;font-variant-numeric:tabular-nums}.vis-wrap{overflow-x:auto}",
      ".vis-hours{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px;align-items:end;height:120px;padding-top:8px}.vis-hours div{background:#CFE9E0;border-radius:3px 3px 0 0;position:relative;min-height:2px}.vis-hours div.o{background:#0E8A6A}.vis-hlbl{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));font-size:9.5px;color:#66707C;text-align:center}",
      ".vis-acc{display:flex;gap:12px;align-items:center}.vis-acc .big{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}.vis-acc.good .big{color:#0E8A6A}.vis-acc.warn .big{color:#B5530A}",
      ".vis-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.vis-link code{font-size:12px;direction:ltr;overflow-wrap:anywhere;color:#334}",
      ".vh-ctl{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:6px 0}.vh-ctl label{display:grid;gap:4px;font-size:12.5px}.vh-ctl input{min-height:38px}.vh-peak{margin:4px 0 8px;font-size:14px}",
      ".vh-bars{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;align-items:end;height:150px}.vh-b{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;border:0;background:none;padding:0;cursor:pointer;border-radius:4px;min-width:0}",
      ".vh-b i{display:block;width:100%;min-height:2px;background:#CFE9E0;border-radius:4px 4px 0 0}.vh-b.o i{background:#0E8A6A}.vh-b.on i{background:#EE7417}.vh-b small{font-size:9.5px;color:#66707C;order:-1}.vh-b:hover i{filter:brightness(.92)}.vh-b:focus-visible{outline:2px solid #EE7417}",
      ".vh-lbl{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));font-size:9.5px;color:#66707C;text-align:center;margin-top:4px}.vh-det{margin-top:12px;border-top:1px solid var(--line);padding-top:10px;display:grid;gap:10px}.vh-det h3{margin:0;font-size:15px}.vh-new{background:#E3F3EE;color:#0A5E49;border-radius:6px;padding:0 5px;font-size:11px}",
      ".nd-main{font-size:16px;margin:6px 0 10px}.nd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:12px}.nd-grid fieldset{border:1px solid var(--line);border-radius:12px;padding:12px;margin:0;display:grid;gap:8px;min-width:0}.nd-grid fieldset .hint{margin:0}",
      ".nd-grid label{display:grid;grid-template-columns:minmax(0,1fr) 120px;align-items:center;gap:8px;font-size:13px}.nd-in{display:flex;align-items:center;gap:4px}.nd-in input{width:100%;min-width:0;min-height:38px}.nd-in small{color:#66707C}.nd-tg{display:flex!important;gap:8px}.nd-tg b{font-size:15px}",
      ".nd-pz{display:grid;grid-template-columns:minmax(0,1.2fr) repeat(4,minmax(0,1fr)) auto;gap:6px}.nd-pz input,.nd-pz select{min-width:0;min-height:36px;padding:4px 6px}",
      "@media (max-width:600px){.vis-bar{grid-template-columns:96px minmax(0,1fr) 40px;font-size:12.5px}}"
    ].join("\n"); document.head.appendChild(st); }
    var chips = '<div class="vis-chips" role="group" aria-label="المدة">' + [[1, "اليوم"], [7, "٧ أيام"], [30, "٣٠ يوم"], [90, "٣ شهور"]].map(function(x){ return '<button type="button" data-visd="' + x[0] + '" aria-pressed="' + (visDays === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div>';
    box.innerHTML = '<div class="card"><div class="sec-head" style="margin:0 0 10px"><h2>الزوار والتحويل</h2><button class="btn btn-soft sm" type="button" id="visRe">تحديث</button></div>' + chips + '<p class="hint" id="visMsg">جاري التحميل…</p></div><div id="visBody"></div>';
    box.querySelectorAll("[data-visd]").forEach(function(b){ b.onclick = function(){ visDays = Number(b.dataset.visd); renderVisits(); }; });
    $("visRe").onclick = renderVisits;
    api("/admin/visits", { pin: adminPin, days: visDays }).then(function(j){
      var msg = $("visMsg"); if (!msg) return;
      if (!j.ok) { msg.textContent = j.code === "not_found" ? "هذا القسم يحتاج تحديث الخادم في Cloudflare." : "ما قدرنا نجيب الأرقام (" + (j.code || "خطأ") + ")."; return; }
      visData = j; msg.textContent = "من " + j.from + (j.days > 1 ? " لين اليوم" : "") + " · زائر = جهاز مختلف · أجهزة الموظفين مستثناة (" + num(j.staffDevices) + " جهاز)";
      var f = j.funnel, ch = j.prevVisitors ? Math.round((j.visitors - j.prevVisitors) / j.prevVisitors * 100) : null;
      var kpi = function(v, l, sub, cls){ return '<div class="vis-kpi"><b>' + v + '</b><span>' + l + '</span>' + (sub ? '<small class="' + (cls || "") + '">' + sub + '</small>' : '') + '</div>'; };
      var acc = j.coverage.orders ? visPct(j.coverage.seen, j.coverage.orders) : null;
      var maxH = 1, hmap = {}; (j.hours || []).forEach(function(h){ hmap[h.h] = h; if (h.visitors > maxH) maxH = h.visitors; });
      var base = location.origin + location.pathname;
      $("visBody").innerHTML =
        '<div class="card"><div class="vis-kpis">' +
          kpi(num(j.visitors), "زائر مختلف", ch == null ? "" : (ch >= 0 ? "▲ " : "▼ ") + Math.abs(ch) + "٪ عن الفترة اللي قبلها", ch == null ? "" : ch >= 0 ? "up" : "down") +
          kpi(num(j.fresh), "زائر جديد", num(Math.max(0, j.visitors - j.fresh)) + " راجعين") +
          kpi(num(j.visits), "زيارة (جلسة)", num(j.opens) + " فتحة للصفحة") +
          kpi(visPct(f.ordered, j.visitors) + "٪", "نسبة اللي طلبوا", num(f.ordered) + " زبون طلب") +
          kpi(num(j.live), "متواجدين الحين", "آخر ٥ دقايق") +
        '</div></div>' +
        '<div class="card"><h2>رحلة الزبون</h2><p class="hint">كل رقم = أجهزة مختلفة. يوريك وين يوقف الزباين.</p>' +
          visBar(f.visited, f.visited, "زاروا الموقع") + visBar(f.viewed, f.visited, "شافوا منتج", visPct(f.viewed, f.visited) + "٪ من الزوار") +
          visBar(f.carted, f.visited, "أضافوا للسلة", visPct(f.carted, f.visited) + "٪ من الزوار") + visBar(f.checkout, f.visited, "وصلوا صفحة الطلب", visPct(f.checkout, f.carted) + "٪ من اللي أضافوا") +
          visBar(f.ordered, f.visited, "طلبوا فعلاً", visPct(f.ordered, f.checkout) + "٪ من اللي وصلوا صفحة الطلب") +
          (f.checkout > f.ordered ? '<p class="hint">' + num(f.checkout - f.ordered) + ' وصلوا صفحة الطلب وما طلبوا. شيّك رسوم التوصيل والحد الأدنى ومنطقة التوصيل.</p>' : '') + '</div>' +
        '<div class="card"><h2>دقة العدّاد</h2>' + (acc == null ? '<p class="hint">ما فيه طلبات من الموقع بهالفترة نقيس عليها.</p>' :
          '<div class="vis-acc ' + (acc >= 98 ? "good" : "warn") + '"><span class="big">' + acc + '٪</span><span>من طلبات الموقع (' + num(j.coverage.orders) + ' طلب) لقينا زيارة صاحبها مسجلة بنفس اليوم. ' + (acc >= 98 ? 'العدّاد ما فوّت أحد.' : 'فيه طلبات ما انسجلت زيارتها: يمكن من نسخة قديمة للموقع أو التطبيق.') + '</span></div>' +
          (j.coverage.missing.length ? '<p class="hint">طلبات بدون زيارة: ' + j.coverage.missing.map(function(n){ return '#' + n; }).join("، ") + '</p>' : '')) +
          (j.ordersNoDev ? '<p class="hint">' + num(j.ordersNoDev) + ' طلب بدون جهاز (مدخل من الإدارة بالتلفون أو الواتساب، أو من نسخة قديمة) ما ينحسب بالزوار.</p>' : '') + '</div>' +
        '<div class="card"><h2>من وين جوا الزوار</h2><div class="vis-wrap"><table class="vis-tbl"><thead><tr><th>المصدر</th><th class="n">زوار</th><th class="n">طلبوا</th><th class="n">النسبة</th></tr></thead><tbody>' +
          (j.sources.length ? j.sources.map(function(s){ return '<tr><td>' + esc(VIS_SRC[s.src] || s.src) + '</td><td class="n">' + num(s.visitors) + '</td><td class="n">' + num(s.buyers) + '</td><td class="n">' + visPct(s.buyers, s.visitors) + '٪</td></tr>'; }).join("") : '<tr><td colspan="4">ما فيه زوار بهالفترة.</td></tr>') +
          '</tbody></table></div></div>' +
        '<div class="card" id="visHours"></div>' +
        (j.daily.length > 1 ? '<div class="card"><h2>يوم بيوم</h2><div class="vis-wrap"><table class="vis-tbl"><thead><tr><th>اليوم</th><th class="n">زوار</th><th class="n">جدد</th><th class="n">زيارات</th></tr></thead><tbody>' +
          j.daily.slice().reverse().map(function(d){ return '<tr><td>' + esc(d.day) + '</td><td class="n">' + num(d.visitors) + '</td><td class="n">' + num(d.fresh || 0) + '</td><td class="n">' + num(d.visits) + '</td></tr>'; }).join("") + '</tbody></table></div></div>' : '') +
        '<div class="card"><h2>الأجهزة</h2>' + (j.kinds.length ? j.kinds.map(function(k){ return visBar(k.visitors, j.visitors, k.kind === "m" ? "جوال" : k.kind === "d" ? "كمبيوتر" : k.kind === "ios" ? "تطبيق الآيفون" : k.kind || "غير معروف"); }).join("") : '<p class="hint">—</p>') + '</div>' +
        '<div class="card" id="nudgeCard"><h2>عروض الرجعة</h2><p class="hint">جاري التحميل…</p></div>' +
        '<div class="card"><h2>روابط تعرف منها مصدر الزبون</h2><p class="hint">استخدم هالروابط في الملصقات والقروبات، ويطلع لك هنا كم زبون جا من كل واحد وكم طلب.</p>' +
          VIS_LINKS.map(function(x){ var u = base + "?src=" + x[0]; return '<div class="vis-link"><div><b>' + x[1] + '</b><br><code>' + esc(u) + '</code></div><button type="button" class="btn btn-soft sm" data-viscp="' + esc(u) + '">انسخ</button></div>'; }).join("") + '</div>' +
        '<div class="card"><h2>تقارير مساعدة</h2><div class="quick"><button type="button" class="btn btn-ghost" data-atab="stats">المنتجات الأكثر مبيعاً والبحث بدون نتيجة</button><button type="button" class="btn btn-ghost" data-atab="cust">الزباين اللي ما رجعوا</button><button type="button" class="btn btn-ghost" data-atab="rates">التقييمات</button></div></div>' +
        '<div class="card"><h2>أجهزة الموظفين</h2><p class="hint">أي جهاز دخل الإدارة أو صفحة المندوب ينعلّم تلقائياً وما ينحسب بالزوار. لو عندك جهاز ثاني تتصفح فيه المتجر ودخلت منه الإدارة، انعلّم خلاص.</p>' +
          '<div class="quick"><button type="button" class="btn btn-soft" id="visMe">استثني هالجهاز</button><button type="button" class="btn btn-ghost" id="visClr">صفّر القائمة (' + num(j.staffDevices) + ')</button></div><p class="status" id="visStMsg" aria-live="polite"></p>' +
          '<p class="hint">كيف ينحسب: الجهاز يرسل لحظة فتح الموقع (مو وقت الطلوع)، ولو ما وصل ينحفظ بالجهاز وينرسل بعدين بوقته. الروبوتات ما تنحسب. اللي ما يقدر نعدّه: متصفح قافل الجافاسكربت (نادر جداً). تطبيق الآيفون ينحسب من تحديثه الجاي.</p></div>';
      renderNudge(); renderVisHours();
      $("visBody").querySelectorAll("[data-viscp]").forEach(function(b){ b.onclick = function(){ var u = b.dataset.viscp; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function(){ b.textContent = "انسخ ✓"; }).catch(function(){ window.prompt("انسخ الرابط:", u); }); }; });
      $("visMe").onclick = function(){ markStaffDev(); api("/admin/staff-dev", { pin: adminPin, dev: devId() }).then(function(x){ $("visStMsg").textContent = x.ok ? "تم، هالجهاز ما ينحسب." : "ما زبط، جرّب مرة ثانية."; }); };
      $("visClr").onclick = function(){ if (!window.confirm("تصفير القائمة يخلّي أجهزة الموظفين تنحسب لين يدخلون الإدارة مرة ثانية. متأكد؟")) return; api("/admin/staff-dev", { pin: adminPin, clear: 1, dev: devId() }).then(function(x){ if (x.ok) renderVisits(); }); };
    });
  }
  /* ---------- الزيارات بالساعة (١٧ نوفمبر ٢٠٢٦): اختر أي يوم وأي ساعة، ويطلع كم زائر وكم زيارة وكم طلب، ومتى دخل كل واحد ---------- */
  var visH = { day: "", h: null };
  function hName(h){ return h === 0 ? "١٢ بالليل" : h < 12 ? num(h) + " الصبح" : h === 12 ? "١٢ الظهر" : h < 16 ? num(h - 12) + " الظهر" : h < 18 ? num(h - 12) + " العصر" : num(h - 12) + " المساء"; }
  function hRange(h){ return hName(h) + " – " + hName((h + 1) % 24); }
  function renderVisHours(){
    var box = $("visHours"); if (!box) return;
    box.innerHTML = '<div class="sec-head" style="margin:0"><h2>الزيارات بالساعة</h2></div><div class="vh-ctl"><label>يوم معيّن<input type="date" id="vhDay" value="' + esc(visH.day) + '" max="' + new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10) + '"></label>' + (visH.day ? '<button type="button" class="btn btn-ghost sm" id="vhAll">رجوع لكل الفترة</button>' : '<span class="hint">أو المدة المختارة فوق</span>') + '</div><p class="hint" id="vhMsg">جاري التحميل…</p><div id="vhBody"></div>';
    $("vhDay").onchange = function(){ visH.day = this.value; visH.h = null; renderVisHours(); };
    if ($("vhAll")) $("vhAll").onclick = function(){ visH.day = ""; visH.h = null; renderVisHours(); };
    api("/admin/visit-hours", visH.day ? { pin: adminPin, day: visH.day, h: visH.h } : { pin: adminPin, days: visDays, h: visH.h }).then(function(j){
      if (!$("vhBody")) return;
      if (!j.ok) { $("vhMsg").textContent = j.code === "not_found" ? "يحتاج تحديث الخادم." : "ما قدرنا نجيب الأرقام."; return; }
      var hs = j.hours, mx = Math.max.apply(null, hs.map(function(x){ return x.visitors; }).concat([1])), peak = hs.slice().sort(function(a, b){ return b.visitors - a.visitors || b.opens - a.opens; })[0];
      var pOrd = hs.slice().sort(function(a, b){ return b.orders - a.orders; })[0];
      $("vhMsg").textContent = (j.days === 1 ? "يوم " + j.from : "من " + j.from + " لين " + j.to) + " · " + num(j.visitors) + " زائر · " + num(j.opens) + " زيارة · اضغط أي ساعة تشوف تفاصيلها";
      $("vhBody").innerHTML = (peak && peak.visitors ? '<p class="vh-peak">أكثر ساعة زوار: <b>' + hRange(peak.h) + '</b> (' + num(peak.visitors) + ' زائر)' + (pOrd && pOrd.orders ? ' · أكثر ساعة طلبات: <b>' + hRange(pOrd.h) + '</b> (' + num(pOrd.orders) + ' طلب)' : '') + '</p>' : '<p class="hint">ما فيه زيارات مسجلة بهالفترة.</p>') +
        '<div class="vh-bars" role="group" aria-label="الساعات">' + hs.map(function(x){ return '<button type="button" class="vh-b' + (visH.h === x.h ? ' on' : '') + (x.orders ? ' o' : '') + '" data-vh="' + x.h + '" title="' + hRange(x.h) + ': ' + x.visitors + ' زائر"><i style="height:' + Math.round(x.visitors / mx * 100) + '%"></i><small>' + (x.visitors || "") + '</small></button>'; }).join("") + '</div>' +
        '<div class="vh-lbl">' + hs.map(function(x){ return '<span>' + (x.h % 3 === 0 ? (x.h === 0 ? "١٢ص" : x.h < 12 ? num(x.h) + "ص" : x.h === 12 ? "١٢ظ" : num(x.h - 12) + "م") : "") + '</span>'; }).join("") + '</div>' +
        (j.h != null ? (function(){ var x = hs[j.h], L = j.list || [];
          return '<div class="vh-det"><h3>' + hRange(j.h) + '</h3><div class="vis-kpis"><div class="vis-kpi"><b>' + num(x.visitors) + '</b><span>زائر مختلف</span></div><div class="vis-kpi"><b>' + num(x.opens) + '</b><span>زيارة</span></div><div class="vis-kpi"><b>' + num(x.orders) + '</b><span>طلب</span></div></div>' +
            (L.length ? '<div class="vis-wrap"><table class="vis-tbl"><thead><tr><th>الوقت</th><th>الزائر</th><th>من وين</th><th>الجهاز</th><th>طلب بعدها؟</th></tr></thead><tbody>' + L.map(function(v){ var d = new Date(v.at + 3 * 36e5);
              return '<tr><td>' + (j.days > 1 ? d.toISOString().slice(5, 10).replace("-", "/") + ' · ' : '') + String(d.getUTCHours() % 12 || 12) + ':' + String(d.getUTCMinutes()).padStart(2, "0") + (d.getUTCHours() < 12 ? ' ص' : ' م') + '</td><td>#' + esc(v.who) + (v.fresh ? ' <span class="vh-new">جديد</span>' : '') + '</td><td>' + esc(VIS_SRC[v.src] || v.src || "مباشر") + '</td><td>' + (v.kind === "m" ? "جوال" : v.kind === "d" ? "كمبيوتر" : esc(v.kind)) + '</td><td>' + (v.ordered ? '✅ طلب' : '—') + '</td></tr>'; }).join("") + '</tbody></table></div>' + (L.length >= 300 ? '<p class="hint">أول ٣٠٠ زيارة بس.</p>' : '') : '<p class="hint">ما فيه زيارات بهالساعة.</p>') +
            '<p class="hint">«#» آخر ٤ حروف من رقم الجهاز (بدون أي بيانات شخصية): نفس الرقم = نفس الزبون.</p></div>'; })() : '');
      $("vhBody").querySelectorAll("[data-vh]").forEach(function(b){ b.onclick = function(){ var h = Number(b.dataset.vh); visH.h = visH.h === h ? null : h; renderVisHours(); }; });
    });
  }
  /* ---------- عروض الرجعة: الإعدادات والتقرير (داخل «الزوار والتحويل») ---------- */
  var NUDGE_SRC = { cart: "سلة متروكة", view: "منتج يبغاه", wheel: "عجلة الهدايا" };
  function renderNudge(){
    var box = $("nudgeCard"); if (!box) return;
    api("/admin/nudge", { pin: adminPin, days: Math.max(30, visDays) }).then(function(j){
      if (!$("nudgeCard")) return;
      if (!j.ok) { box.innerHTML = '<h2>عروض الرجعة</h2><p class="hint">' + (j.code === "not_found" ? "يحتاج تحديث الخادم في Cloudflare." : "ما قدرنا نجيب الإعدادات.") + '</p>'; return; }
      var c = j.cfg, nf = function(id, label, v, step, suf){ return '<label>' + label + '<span class="nd-in"><input id="' + id + '" type="number" inputmode="decimal" step="' + (step || 1) + '" value="' + esc(v) + '">' + (suf ? '<small>' + suf + '</small>' : '') + '</span></label>'; };
      var tg = function(id, on, label){ return '<label class="chk nd-tg"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><b>' + label + '</b></label>'; };
      var st = j.stats || [], tot = st.reduce(function(a, x){ a.g += x.given; a.u += x.used; a.c += x.cost; a.s += x.sales; return a; }, { g: 0, u: 0, c: 0, s: 0 });
      box.innerHTML = '<div class="sec-head" style="margin:0"><h2>عروض الرجعة (حوّل الزائر لزبون)</h2></div>' +
        '<p class="hint">الزائر اللي رجع وما طلب قبل ياخذ عرض شخصي لجواله بس: لو ترك سلة، أو شاف منتج وطلع، أو زارنا كثير بدون طلب. العرض ينطبق تلقائي في صفحة الطلب، ومرة وحدة لكل جوال، وما ينزل السعر تحت التكلفة.</p>' +
        '<label class="chk nd-main"><input type="checkbox" id="ndOn"' + (c.on ? ' checked' : '') + '><b>' + (c.on ? 'شغّال' : 'مطفي') + '</b></label>' +
        '<div class="nd-grid">' +
          '<fieldset>' + tg("ndCartOn", c.cart.on, "ترك سلة") + '<p class="hint">رجع بعد يوم أو أكثر وسلته فيها أغراض.</p>' + nf("ndCartPct", "الخصم", c.cart.pct, 1, "٪") + nf("ndCartCap", "أقصى خصم", c.cart.cap, 1, "ر.س") + nf("ndCartH", "صالح لمدة", c.cart.hours, 1, "ساعة") + '</fieldset>' +
          '<fieldset>' + tg("ndViewOn", c.view.on, "منتج يبغاه وما اشتراه") + '<p class="hint">يختار المنتج اللي يبغاه أكثر شي: شافه أيام أكثر وأضافه للسلة أكثر (الإضافة تحسب ٣ أضعاف المشاهدة)، ويصير أرخص له (لو السعر الجديد رقم صحيح ينقص ٥ هللات).</p>' + nf("ndViewPct", "الخصم", c.view.pct, 1, "٪") + nf("ndViewH", "صالح لمدة", c.view.hours, 1, "ساعة") + '</fieldset>' +
          '<fieldset>' + tg("ndWheelOn", c.wheel.on, "عجلة الهدايا") + '<p class="hint">زارنا أيام كثيرة وما طلب: يلف العجلة، والجائزة يختارها النظام بالنسب تحت.</p>' + nf("ndWheelV", "بعد كم يوم زيارة", c.wheel.visits, 1, "أيام") + nf("ndWheelH", "صالح لمدة", c.wheel.hours, 1, "ساعة") +
            '<div class="nd-prizes" id="ndPrizes">' + c.wheel.prizes.map(function(x, i){ return '<div class="nd-pz" data-pz="' + i + '"><select aria-label="نوع الجائزة"><option value="percent"' + (x.kind === "percent" ? " selected" : "") + '>نسبة ٪</option><option value="amount"' + (x.kind === "amount" ? " selected" : "") + '>ريال</option></select><input type="number" step="1" aria-label="القيمة" value="' + x.value + '" title="القيمة"><input type="number" step="1" aria-label="أقصى خصم" value="' + (x.cap || 0) + '" title="أقصى خصم (للنسبة)"><input type="number" step="1" aria-label="أقل طلب" value="' + x.min + '" title="أقل طلب"><input type="number" step="1" aria-label="فرصتها" value="' + x.w + '" title="فرصتها"><button type="button" class="del" data-pzdel="' + i + '">شيل</button></div>'; }).join("") +
            '</div><p class="hint">الأعمدة: النوع · القيمة · أقصى خصم للنسبة (ر.س) · أقل طلب (ر.س) · فرصتها (كل ما كبر الرقم تطلع أكثر).</p><button type="button" class="btn btn-soft sm" id="ndPzAdd">+ جائزة</button></fieldset>' +
          '<fieldset><b>حماية الربح</b>' + nf("ndMargin", "أقل ربح فوق سعر الشراء", c.minMargin, 1, "٪") + nf("ndNoCost", "أقصى خصم لمنتج ما له سعر شراء", c.noCostPct, 1, "٪") + nf("ndCool", "بين عرض وعرض للجهاز", c.cooldown, 1, "يوم") + nf("ndMax", "أقصى عدد عروض للجهاز", c.maxPerDev, 1, "") +
            '<p class="hint">أغلب منتجاتك ما لها سعر شراء، فالخصم عليها ما يتعدى النسبة هذي. لو تبغى خصومات أقوى وآمنة: أضف سعر الشراء للمنتجات المهمة.</p></fieldset>' +
        '</div><button type="button" class="btn btn-brand" id="ndSave">احفظ إعدادات العروض</button><p class="status" id="ndMsg" aria-live="polite"></p>' +
        '<h3 style="margin:14px 0 6px;font-size:15px">النتيجة آخر ' + num(Math.max(30, visDays)) + ' يوم</h3><div class="vis-wrap"><table class="vis-tbl"><thead><tr><th>العرض</th><th class="n">انعطى</th><th class="n">طلبوا فيه</th><th class="n">النسبة</th><th class="n">كلفة الخصم</th><th class="n">مبيعاتها</th></tr></thead><tbody>' +
          (st.length ? st.map(function(x){ return '<tr><td>' + (NUDGE_SRC[x.src] || x.src) + '</td><td class="n">' + num(x.given) + '</td><td class="n">' + num(x.used) + '</td><td class="n">' + visPct(x.used, x.given) + '٪</td><td class="n">' + num(x.cost) + '</td><td class="n">' + num(x.sales) + '</td></tr>'; }).join("") + '<tr><th>المجموع</th><th class="n">' + num(tot.g) + '</th><th class="n">' + num(tot.u) + '</th><th class="n">' + visPct(tot.u, tot.g) + '٪</th><th class="n">' + num(Math.round(tot.c * 100) / 100) + '</th><th class="n">' + num(Math.round(tot.s * 100) / 100) + '</th></tr>' : '<tr><td colspan="6">ما انعطى أي عرض للحين.</td></tr>') +
        '</tbody></table></div>';
      $("ndOn").onchange = function(){ this.nextElementSibling.textContent = this.checked ? "شغّال" : "مطفي"; };
      box.querySelectorAll("[data-pzdel]").forEach(function(b){ b.onclick = function(){ if (box.querySelectorAll(".nd-pz").length > 2) b.closest(".nd-pz").remove(); }; });
      $("ndPzAdd").onclick = function(){ var l = $("ndPrizes"); if (l.children.length >= 8) return; l.insertAdjacentHTML("beforeend", '<div class="nd-pz"><select aria-label="نوع الجائزة"><option value="percent">نسبة ٪</option><option value="amount">ريال</option></select><input type="number" aria-label="القيمة" value="5"><input type="number" aria-label="أقصى خصم" value="10"><input type="number" aria-label="أقل طلب" value="30"><input type="number" aria-label="فرصتها" value="10"><button type="button" class="del" onclick="this.parentNode.remove()">شيل</button></div>'); };
      $("ndSave").onclick = function(){
        var v = function(id){ return Number($(id).value); }, b = this; b.disabled = true; $("ndMsg").textContent = "جاري الحفظ…";
        var prizes = Array.prototype.map.call(box.querySelectorAll(".nd-pz"), function(r){ var f = r.querySelectorAll("input"), k = r.querySelector("select").value; return { kind: k, value: Number(f[0].value), cap: k === "percent" ? Number(f[1].value) : 0, min: Number(f[2].value), w: Number(f[3].value) }; });
        var cfg = { on: $("ndOn").checked, minMargin: v("ndMargin"), noCostPct: v("ndNoCost"), cooldown: v("ndCool"), maxPerDev: v("ndMax"),
          cart: { on: $("ndCartOn").checked, pct: v("ndCartPct"), cap: v("ndCartCap"), hours: v("ndCartH") }, view: { on: $("ndViewOn").checked, pct: v("ndViewPct"), hours: v("ndViewH") },
          wheel: { on: $("ndWheelOn").checked, visits: v("ndWheelV"), hours: v("ndWheelH"), prizes: prizes } };
        api("/admin/nudge", { pin: adminPin, cfg: cfg }).then(function(x){ b.disabled = false; $("ndMsg").className = "status" + (x.ok ? " ok" : " err"); $("ndMsg").textContent = x.ok ? (x.cfg.on ? "انحفظ، والعروض شغّالة." : "انحفظ، والعروض مطفية.") : "ما انحفظ، جرّب مرة ثانية."; if (x.ok) setTimeout(renderNudge, 900); });
      };
    });
  }
  /* ---------- لوحة الإدارة الجديدة (adm2، ١٧ نوفمبر ٢٠٢٦): شريط سفلي للجوال، قائمة كاملة، شريط حفظ عائم، منتجات خفيفة ---------- */
  var A2_TABS = [["over", "الرئيسية", "home"], ["olist", "الطلبات", "cart"], ["prods", "المنتجات", "box"], ["offers", "العروض", "tag"]];
  var A2_CSS = [
    ".adm2{--a2-bg:#F4F5F7;--a2-card:#FFFFFF;--a2-ink:#17212B;--a2-muted:#66707C;--a2-line:#E4E7EB;--a2-side:#14202B;--a2-side-ink:#C9D2DB;--a2-brand:#0E8A6A;--a2-brand-soft:#E3F3EE;--a2-hot:#EE7417;--a2-hot-soft:#FFF1E4;--a2-r:14px;background:var(--a2-bg);grid-template-columns:248px minmax(0,1fr);font-size:15px}",
    /* القائمة الجانبية (مكتب) */
    ".adm2 .adm-side{background:var(--a2-side);color:var(--a2-side-ink);border:0;padding:16px 12px;gap:10px}",
    ".adm2 .adm-brand{border-color:rgba(255,255,255,.08)}.adm2 .adm-brand b{color:#fff}.adm2 .adm-brand span{color:var(--a2-side-ink)}",
    ".adm2 .admin-nav-search{color:var(--a2-side-ink);font-size:12px}.adm2 .admin-nav-search input{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff}",
    ".adm2 .adm-nav{gap:2px}.adm2 .admin-nav-group{border:0!important;padding:6px 0 2px;margin:0}",
    ".adm2 .admin-nav-group>h2{font-size:11px;letter-spacing:.04em;color:#7F8C99;margin:8px 10px 4px;font-weight:700}",
    ".adm2 .adm-nav [data-atab]{min-height:40px;border-radius:10px;color:var(--a2-side-ink);background:transparent;font-weight:600;font-size:14px;padding:6px 10px;gap:10px}",
    ".adm2 .adm-nav [data-atab]:hover{background:rgba(255,255,255,.06);color:#fff}",
    ".adm2 .adm-nav [data-atab][aria-current=page]{background:var(--a2-brand);color:#fff}.adm2 .adm-nav [data-atab] svg{width:18px;height:18px;opacity:.85}",
    ".adm2 .adm-nav [data-atab] b,.adm2 .adm-nav [data-atab] .cnt{background:rgba(255,255,255,.12);color:#fff}",
    ".adm2 .a2-sidefoot{display:grid;gap:6px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;margin-top:auto}",
    ".adm2 .a2-sidefoot button,.adm2 .adm-exit{min-height:40px;border-radius:10px;border:0;background:rgba(255,255,255,.06);color:var(--a2-side-ink);font:inherit;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;padding:0 10px;cursor:pointer}",
    /* الرأس */
    ".adm2 .adm-top{position:sticky;top:0;z-index:20;background:rgba(244,245,247,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--a2-line);padding:12px 24px;display:flex;align-items:center;gap:10px;flex-wrap:nowrap;min-height:60px}",
    ".adm2 .adm-title{flex:1;min-width:0}.adm2 .adm-title h1{font-size:20px;margin:0;line-height:1.3}.adm2 .admin-page-hint{margin:2px 0 0;font-size:12.5px;color:var(--a2-muted)}",
    ".adm2 #aState,.adm2 #aSave,.adm2 #adminLogout,.adm2 .admin-menu-toggle{display:none!important}",
    ".adm2 #oaSnd{min-height:36px!important;border-radius:999px;background:var(--a2-card)!important;border:1px solid var(--a2-line)!important;color:var(--a2-ink);font-size:12.5px!important;white-space:nowrap}",
    ".adm2 #aStatus:empty{display:none}",
    /* المحتوى */
    ".adm2 .adm-body{padding:20px 24px 120px;max-width:1180px;width:100%;box-sizing:border-box;margin:0 auto}",
    ".adm2 .adm-panel{display:grid;gap:14px}.adm2 .adm-panel[hidden]{display:none}",
    ".adm2 .card{background:var(--a2-card);border:1px solid var(--a2-line);border-radius:var(--a2-r);box-shadow:none;padding:16px}",
    ".adm2 .card h2,.adm2 .sec-head h2{font-size:16px}",
    ".adm2 .btn{border-radius:12px;min-height:42px;font-weight:700}.adm2 .btn-brand{background:var(--a2-brand);color:#fff}.adm2 .btn-soft{background:var(--a2-brand-soft);color:#0A5E49}",
    ".adm2 input,.adm2 select,.adm2 textarea{border-radius:10px}",
    ".adm2 .admin-fold>summary{font-weight:700;cursor:pointer}",
    /* الرئيسية */
    ".adm2 .admin-start{background:var(--a2-card);border:1px solid var(--a2-line);box-shadow:none;padding:14px 16px}.adm2 .admin-start>div:first-child{display:none}",
    ".adm2 .admin-task-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
    ".adm2 .admin-task-grid button{min-height:0;padding:12px;border-radius:12px;border:1px solid var(--a2-line);background:var(--a2-bg);display:grid;gap:4px;text-align:start}",
    ".adm2 .admin-task-grid button b{font-size:14px}.adm2 .admin-task-grid button span{font-size:12px;color:var(--a2-muted)}.adm2 .admin-task-grid svg{width:20px;height:20px;color:var(--a2-hot)}",
    ".adm2 .admin-order-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 12px}",
    ".adm2 .admin-order-summary>span{background:var(--a2-bg);border-radius:12px;padding:12px;display:grid;gap:2px;font-size:12.5px;color:var(--a2-muted)}",
    ".adm2 .admin-order-summary>span b{font-size:24px;color:var(--a2-ink);font-variant-numeric:tabular-nums;line-height:1.2}",
    ".adm2 .a2-hello{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}.adm2 .a2-hello h2{margin:0;font-size:18px}.adm2 .a2-hello span{color:var(--a2-muted);font-size:13px}",
    /* المنتجات: صف خفيف */
    ".adm2 #aProds{display:grid;gap:8px}",
    ".adm2 .a2-mini{display:grid!important;grid-template-columns:52px minmax(0,1fr) 92px 46px auto;align-items:center;gap:10px;padding:8px 10px!important;border:1px solid var(--a2-line);border-radius:12px;background:var(--a2-card);box-shadow:none}",
    ".adm2 .a2-mini .imgbtn{width:52px;height:52px;border-radius:10px;overflow:hidden;padding:0;border:1px solid var(--a2-line);background:#fff}.adm2 .a2-mini .imgbtn img{width:100%;height:100%;object-fit:contain}",
    ".adm2 .a2-pn{background:none;border:0;padding:0;text-align:start;font:inherit;color:inherit;cursor:pointer;min-width:0;display:grid;gap:2px}",
    ".adm2 .a2-pn b{font-size:14px;font-weight:700;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.adm2 .a2-pn small{font-size:12px;color:var(--a2-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".adm2 .a2-price{display:grid;gap:2px;font-size:11px;color:var(--a2-muted);margin:0}.adm2 .a2-price input{min-height:38px;padding:0 8px;font-weight:700;font-variant-numeric:tabular-nums;width:100%;box-sizing:border-box}",
    ".adm2 .a2-sw{position:relative;width:46px;height:28px;margin:0;cursor:pointer}.adm2 .a2-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}",
    ".adm2 .a2-sw span{position:absolute;inset:0;border-radius:999px;background:#CDD3DA;transition:background .15s}.adm2 .a2-sw span::after{content:'';position:absolute;top:3px;inset-inline-start:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:inset-inline-start .15s}",
    ".adm2 .a2-sw input:checked+span{background:var(--a2-brand)}.adm2 .a2-sw input:checked+span::after{inset-inline-start:21px}.adm2 .a2-sw input:focus-visible+span{outline:3px solid var(--a2-hot);outline-offset:2px}",
    ".adm2 .a2-edit{min-height:38px;border-radius:10px;border:1px solid var(--a2-line);background:var(--a2-bg);font:inherit;font-weight:700;font-size:13px;padding:0 12px;cursor:pointer;color:var(--a2-ink)}",
    ".adm2 .a2-mini>*{min-width:0}.adm2 .a2-mini input{min-width:0}.adm2 .a2-mini{box-sizing:border-box;max-width:100%}",
    ".adm2 .a2-mini.off{opacity:1}.adm2 .a2-mini.off .a2-pn b{color:var(--a2-muted)}",
    ".adm2 #aProds>p,.adm2 #aProds>button,.adm2 .a2-full{grid-column:1/-1}",
    ".adm2 .openbox{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px}.adm2 .openbox>button{width:auto!important;min-width:170px}",
    ".adm2 .a2-full{border:2px solid var(--a2-brand)!important;border-radius:var(--a2-r)!important;background:var(--a2-card)}",
    ".adm2 .a2-fullhead{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--a2-line);padding-bottom:8px;margin-bottom:4px}.adm2 .a2-fullhead b{font-size:15px}",
    /* شريط الحفظ العائم */
    ".adm2 .a2-savebar{position:fixed;z-index:31;inset-inline:calc(248px + 24px) 24px;bottom:calc(16px + var(--sa-bottom,0px));background:var(--a2-ink);color:#fff;border-radius:16px;padding:10px 10px 10px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(20,32,43,.25)}",
    ".adm2 .a2-savebar span{flex:1;font-weight:600;font-size:14px}.adm2 .a2-savebar button{min-height:42px;border:0;border-radius:12px;background:var(--a2-hot);color:#fff;font:inherit;font-weight:800;padding:0 18px;cursor:pointer}.adm2 .a2-savebar button:disabled{opacity:.6}",
    /* الشريط السفلي (جوال) */
    ".adm2 .a2-tabs{display:none}",
    "@media (max-width:980px){",
    ".adm2{grid-template-columns:minmax(0,1fr);width:100%;max-width:100vw;overflow-x:clip}.adm2 .adm-main{min-width:0;width:100%}",
    ".adm2 .adm-top{flex-wrap:wrap;row-gap:4px}.adm2 #aStatus{order:5;flex-basis:100%;font-size:12.5px;margin:0}",
    ".adm2 .adm-top{padding:10px max(16px,var(--sa-left,0px));padding-top:calc(10px + var(--sa-top,0px));min-height:56px}.adm2 .adm-title h1{font-size:18px}.adm2 .admin-page-hint{display:none}",
    ".adm2 #oaSnd{width:40px;padding:0!important;font-size:0!important}.adm2 #oaSnd::before{content:attr(data-ic);font-size:18px}",
    ".adm2 .adm-body{padding:14px 12px calc(96px + var(--sa-bottom,0px))}",
    ".adm2 .card{padding:14px;border-radius:12px}",
    ".adm2 .a2-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;z-index:30;inset:auto 0 0 0;background:var(--a2-card);border-top:1px solid var(--a2-line);padding:6px 4px calc(6px + var(--sa-bottom,0px))}",
    ".adm2 .a2-tabs button{background:none;border:0;font:inherit;color:var(--a2-muted);display:grid;justify-items:center;gap:2px;font-size:11px;font-weight:700;min-height:50px;padding:4px 0;cursor:pointer;position:relative}",
    ".adm2 .a2-tabs svg{width:22px;height:22px}.adm2 .a2-tabs button[aria-current=page]{color:var(--a2-brand)}.adm2 .a2-tabs button[aria-current=page] svg{stroke-width:2.4}",
    ".adm2 .a2-tabs .dot{position:absolute;top:4px;inset-inline-end:calc(50% - 18px);min-width:16px;height:16px;border-radius:8px;background:var(--a2-hot);color:#fff;font-size:10px;line-height:16px;padding:0 4px}",
    ".adm2 .a2-savebar{inset-inline:12px;bottom:calc(74px + var(--sa-bottom,0px))}",
    /* القائمة الكاملة (المزيد) */
    ".adm2.admin-menu-open .adm-side{position:fixed;inset:0;z-index:60;width:auto;max-width:none;height:100%;overflow:auto;padding:calc(16px + var(--sa-top,0px)) 16px calc(24px + var(--sa-bottom,0px));transform:none}",
    ".adm2 .admin-menu-close{background:rgba(255,255,255,.1)!important;color:#fff!important;border:0}",
    ".adm2.admin-menu-open .admin-group-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}",
    ".adm2.admin-menu-open .adm-nav [data-atab]{min-height:56px;background:rgba(255,255,255,.05);align-items:center}",
    ".adm2 .admin-task-grid{grid-template-columns:repeat(2,minmax(0,1fr))}",
    ".adm2 .openbox{grid-template-columns:auto minmax(0,1fr)}.adm2 .openbox>button{grid-column:1/-1;width:100%!important}",
    ".adm2 .a2-mini{grid-template-columns:48px minmax(0,1fr) 78px 46px;grid-template-areas:'img name price sw';row-gap:0}",
    ".adm2 .a2-mini .imgbtn{grid-area:img;width:48px;height:48px}.adm2 .a2-mini .a2-pn{grid-area:name}.adm2 .a2-mini .a2-price{grid-area:price}.adm2 .a2-mini .a2-sw{grid-area:sw}.adm2 .a2-mini .a2-edit{display:none}",
    ".adm2 .a2-mini .a2-price span{display:none}",
    "}",
    "@media (prefers-reduced-motion:reduce){.adm2 .a2-sw span,.adm2 .a2-sw span::after{transition:none}}"
  ].join("\n");
  var a2Obs = null;
  function a2Sync(){
    var root = document.querySelector(".adm2"); if (!root) return;
    var inTabs = A2_TABS.some(function(x){ return x[0] === aTab; });
    root.querySelectorAll(".a2-tabs [data-a2more]").forEach(function(b){ if (!inTabs) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    var bar = root.querySelector(".a2-savebar"), save = $("aSave");
    if (bar && save) { bar.hidden = !dirty; var bb = bar.querySelector("button"); bb.textContent = save.textContent || "احفظ"; bb.disabled = save.disabled && !dirty; }
    var late = $("lateCount"), dot = root.querySelector(".a2-tabs [data-atab=olist] .dot"), n = late ? parseInt(late.textContent, 10) : 0;
    if (dot) { dot.hidden = !(n > 0); dot.textContent = n > 9 ? "9+" : String(n || ""); }
    if (late && late.hidden !== !(n > 0)) late.hidden = !(n > 0);
    var sb = $("oaSnd"); if (sb) { var icn = (sb.textContent.match(/^\S+/) || [""])[0]; if (sb.dataset.ic !== icn) sb.dataset.ic = icn; sb.title = sb.textContent; if (!sb.__a2 && a2Obs) { sb.__a2 = 1; a2Obs.observe(sb, { childList: true, characterData: true, subtree: true }); } }
  }
  function adm2(){
    var root = document.querySelector(".adm[data-simple-admin]"); if (!root || root.classList.contains("adm2")) return;
    if (!$("a2css")) { var st = document.createElement("style"); st.id = "a2css"; st.textContent = A2_CSS.replace(/\.adm2/g, ".adm.adm2[data-simple-admin]"); document.head.appendChild(st); }
    root.classList.add("adm2");
    // القائمة الجانبية: كل المجموعات مفتوحة (بدون طي)
    root.querySelectorAll(".adm-nav details.admin-nav-group").forEach(function(d){
      var s = document.createElement("section"); s.className = d.className; s.dataset.primary = "false";
      var h = document.createElement("h2"); h.textContent = d.querySelector("summary").textContent; s.appendChild(h);
      Array.prototype.slice.call(d.children).forEach(function(c){ if (c.tagName !== "SUMMARY") s.appendChild(c); }); d.replaceWith(s);
    });
    var side = root.querySelector(".adm-side"), exit = $("toStore"), lo = $("adminLogout");
    if (side && !side.querySelector(".a2-sidefoot")) {
      var foot = document.createElement("div"); foot.className = "a2-sidefoot"; side.appendChild(foot);
      if (exit) foot.appendChild(exit);
      if (lo) { var b2 = document.createElement("button"); b2.type = "button"; b2.innerHTML = ic("back") + "<span>تسجيل الخروج</span>"; b2.onclick = function(){ lo.click(); }; foot.appendChild(b2); }
    }
    if ($("aImport")) foldAdminCard($("aImport"), "استيراد الأصناف من ملف الكاشير (Excel)", false);
    // شريط الحفظ العائم (يطلع بس لو فيه تغييرات)
    var bar = document.createElement("div"); bar.className = "a2-savebar"; bar.hidden = true; bar.setAttribute("role", "status");
    bar.innerHTML = '<span>عندك تغييرات ما انحفظت</span><button type="button">احفظ</button>';
    bar.querySelector("button").onclick = function(){ var s = $("aSave"); if (s) { s.disabled = false; s.click(); } };
    root.appendChild(bar);
    // الشريط السفلي للجوال
    var tabs = document.createElement("nav"); tabs.className = "a2-tabs"; tabs.setAttribute("aria-label", "أقسام الإدارة الرئيسية");
    tabs.innerHTML = A2_TABS.map(function(x){ return '<button type="button" data-atab="' + x[0] + '">' + ic(x[2]) + '<span>' + x[1] + '</span>' + (x[0] === "olist" ? '<i class="dot" hidden></i>' : '') + '</button>'; }).join("") +
      '<button type="button" data-a2more>' + ic("grid") + '<span>المزيد</span></button>';
    tabs.querySelector("[data-a2more]").onclick = function(){ toggleAdminMenu(true); };
    root.appendChild(tabs);
    if (a2Obs) a2Obs.disconnect();
    a2Obs = new MutationObserver(a2Sync);
    ["aState", "aSave", "lateCount"].forEach(function(id){ var el = $(id); if (el) a2Obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true }); });
    var top = root.querySelector(".adm-top"); if (top) a2Obs.observe(top, { childList: true });
    Array.prototype.forEach.call(document.querySelectorAll("[data-atab]"), function(b){ if (b.dataset.atab === aTab) b.setAttribute("aria-current", "page"); });
    a2Sync();
  }
  // الرئيسية: الأرقام وآخر الطلبات أول شي، والاختصارات بعدها
  function a2Over(){
    var box = $("aOver"); if (!box || !document.querySelector(".adm2")) return;
    var latest = $("aOrders") && $("aOrders").closest(".card"), start = box.querySelector(".admin-start"), open = box.querySelector(".openbox");
    if (latest) { box.prepend(latest); var h = latest.querySelector("h2"); if (h && !latest.querySelector(".a2-hello")) { var d = new Date(), hr = d.getHours(); h.parentElement.outerHTML = '<div class="a2-hello"><h2>' + (hr < 12 ? "صباح الخير" : "مساء الخير") + '</h2><span>' + d.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }) + '</span></div>'; } }
    if (open && latest) latest.after(open);
    if (start) box.append(start);
  }
  ADMX = { adminShell: adminShell, showTab: showTab, loadDrvLoc: loadDrvLoc, publish: publish, renderOList: renderOList, oFind: oFind, openOrder: openOrder, loadToday: loadToday, renderStaff: renderStaff, adm2: adm2 };

  /* ---------- تنبيه الطلب الجديد داخل لوحة الإدارة بصوت (طلب المالك ١٥ نوفمبر ٢٠٢٦) ----------
     كل ١٠ ثواني نسأل الخادم عن آخر الطلبات؛ أي طلب جديد من الزبون (مو اللي تدخله أنت) يطلع له شريط فوق وصوت يتكرر لين تضغط «تمام».
     الصوت يحتاج أن الصفحة مفتوحة وقدامك (المتصفح يوقف الصوت لو الصفحة بالخلفية أو الشاشة مقفلة). لو تبي إشعار والشاشة مقفلة فعّل «الإشعارات» من تبويب الإشعارات. */
  var oa = { seen: null, pending: [], on: true, ring: 0, busy: false, title: "" };
  try { oa.on = localStorage.getItem("ohod-admin-sound") !== "0"; } catch(e){}
  // تطبيق أندرويد (WebView) والمتصفحات يمنعون الصوت لين تلمس الشاشة مرة: أول لمسة داخل لوحة الإدارة تفتح الصوت (نشغّل نغمة صامتة)
  function oaUnlock(){
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.resume) audioCtx.resume();
      var b = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource(); src.buffer = b; src.connect(audioCtx.destination); src.start(0); } catch(e){}
    oaUi();
  }
  ["touchstart", "pointerdown", "click", "keydown"].forEach(function(ev){ document.addEventListener(ev, function(){ if (mode === "admin" && (!audioCtx || audioCtx.state !== "running")) oaUnlock(); }, true); });
  function oaChime(){
    if (!oa.on) return;
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.resume) audioCtx.resume();
      [[0, 784], [0.18, 988], [0.36, 1175], [0.62, 784], [0.8, 988], [0.98, 1175]].forEach(function(n){ var t0 = audioCtx.currentTime + n[0], o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "triangle"; o.frequency.value = n[1]; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.32); });
    } catch(e){}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e){}
  }
  function oaUi(){
    if (mode !== "admin") return;
    var top = document.querySelector(".adm-top"), b = $("oaSnd");
    if (top && !b) { b = document.createElement("button"); b.id = "oaSnd"; b.type = "button"; b.className = "btn btn-soft"; b.style.cssText = "min-height:36px;padding:4px 12px;font-size:.82rem"; top.appendChild(b);
      b.addEventListener("click", function(){ oa.on = !oa.on; try { localStorage.setItem("ohod-admin-sound", oa.on ? "1" : "0"); } catch(e){} if (oa.on) oaChime(); else oaStop(); oaUi(); }); }
    if (b) b.textContent = !oa.on ? "🔕 الصوت مقفل" : (audioCtx && audioCtx.state === "running") ? "🔔 صوت الطلبات شغّال" : "🔔 المس الشاشة لتفعيل الصوت";
    var bar = $("oaBar");
    if (!oa.pending.length) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "oaBar"; bar.setAttribute("role", "alert");
      bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:200;background:#0E8A6A;color:#fff;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.25)";
      document.body.appendChild(bar); }
    var o = oa.pending[oa.pending.length - 1];
    bar.innerHTML = '<span style="flex:1;min-width:180px">🛎 طلب جديد ' + esc(o.no) + (o.total ? ' · ' + num(o.total) + ' ر.س' : '') + (o.name ? ' · ' + esc(o.name) : '') + (oa.pending.length > 1 ? ' (و ' + num(oa.pending.length - 1) + ' غيره)' : '') + '</span>' +
      '<button type="button" class="btn" id="oaOpen" style="background:#fff;color:#0E8A6A;min-height:38px">افتح الطلبات</button><button type="button" class="btn" id="oaOk" style="background:rgba(255,255,255,.2);color:#fff;min-height:38px">تمام</button>';
    bar.querySelector("#oaOk").onclick = oaStop; bar.querySelector("#oaOpen").onclick = function(){ oaStop(); if (typeof showTab === "function") { oState.list = null; showTab("olist"); if (typeof renderOList === "function") renderOList(); } };
  }
  function oaStop(){ oa.pending = []; clearInterval(oa.ring); oa.ring = 0; if (oa.title) { document.title = oa.title; oa.title = ""; } oaUi(); }
  function oaPoll(){
    if (mode !== "admin" || !adminPin || oa.busy || !apiUrl()) return;
    if (staffAuth && ["cashier", "preparer"].indexOf(staffAuth.user.role) > -1) return;
    oa.busy = true; oaUi();
    api("/admin/orders", { pin: adminPin, limit: 20, since: Date.now() - 36 * 3600e3, src: "online" }).then(function(j){
      oa.busy = false; if (!j || !j.ok || !j.orders) return;
      var fresh = [];
      if (oa.seen === null) { oa.seen = {}; j.orders.forEach(function(o){ oa.seen[o.no] = 1; }); return; }
      j.orders.forEach(function(o){ if (!oa.seen[o.no]) { oa.seen[o.no] = 1; if ((o.src === "web" || !o.src) && o.status === "new") fresh.push(o); } });
      if (!fresh.length) return;
      oa.pending = oa.pending.concat(fresh.reverse()); if (!oa.title) oa.title = document.title; document.title = "🛎 طلب جديد · " + oa.title;
      oaChime(); clearInterval(oa.ring); var n = 0; oa.ring = setInterval(function(){ if (++n > 14 || !oa.pending.length) { clearInterval(oa.ring); oa.ring = 0; return; } oaChime(); }, 8000);
      oaUi(); if (aTab === "olist" && !$("oSheet")) { oState.list = null; if (typeof renderOList === "function") renderOList(); }
    }).catch(function(){ oa.busy = false; });
  }
  if (!window.__oaTimer) { window.__oaTimer = setInterval(function(){ if (mode === "admin" && adminPin) oaPoll(); else if (oa.seen !== null || oa.pending.length) { oa.seen = null; oaStop(); } }, 10000); }
  oa.seen = null; setTimeout(function(){ oaUi(); oaPoll(); }, 1500);
