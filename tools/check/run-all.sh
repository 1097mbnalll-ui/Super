#!/usr/bin/env bash
# «راجع الآن» (قرار المالك ١٣ نوفمبر ٢٠٢٦): فحص شامل للكود والأمان والاختبارات والمحاكاة والإنتاج.
# الاستخدام: bash tools/check/run-all.sh   (من جذر المستودع، node 22 + python3)
# ما يغيّر شي في الإنتاج: يقرأ بس. النتيجة: سطر لكل فحص (✅/❌/⚠️) وملخص في الآخر.
cd "$(dirname "$0")/../.." || exit 1
OUT=$(mktemp -d); PASS=0; FAIL=0; WARN=0
ok(){ echo "✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "❌ $1"; FAIL=$((FAIL+1)); }
warn(){ echo "⚠️ $1"; WARN=$((WARN+1)); }
run(){ local name="$1"; shift; if timeout "${T:-600}" "$@" >"$OUT/log" 2>&1; then ok "$name"; else bad "$name"; tail -5 "$OUT/log" | sed 's/^/    /'; fi; }

echo "## ١) الكود"
run "الخادم ينقرأ كوحدة (يكشف القوس الزايد)" node --input-type=module -e "import('./server/worker.js')"
node -e '
const fs=require("fs");const h=fs.readFileSync("index.html","utf8");let n=0,bad=0;
for(const m of h.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)){n++;try{new Function(m[1])}catch(e){bad++;console.log("    سكربت "+n+": "+e.message)}}
process.exit(bad?1:0)' >"$OUT/js" 2>&1 && ok "سكربتات الواجهة سليمة (بدون أخطاء صياغة)" || { bad "خطأ صياغة في index.html"; cat "$OUT/js"; }
python3 -c "import json;json.load(open('data.json'))" && ok "data.json سليم" || bad "data.json خربان"
python3 - <<'PY' && ok "كل صور المنتجات موجودة كملفات" || bad "صور مفقودة"
import json,os,sys
d=json.load(open('data.json'));miss=[p['id'] for p in d['products'] if isinstance(p.get('img'),str) and p['img'].startswith('p/') and not os.path.exists(p['img'])]
if miss: print('    مفقودة:',len(miss),miss[:5]); sys.exit(1)
PY
for f in tools/daily/*.py tools/photos/process.py; do python3 -m py_compile "$f" 2>/dev/null || bad "بايثون خربان: $f"; done; ok "سكربتات بايثون تنترجم"

echo "## ٢) الأمان"
if git grep -nIE '(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----[A-Za-z0-9+/=]{40,}|xox[bp]-[0-9A-Za-z-]{20,}|AIza[0-9A-Za-z_-]{35})' -- . ':!*.webp' ':!*.png' ':!*.jpg' >"$OUT/sec"; then bad "فيه مفتاح أو سر في المستودع (عام!)"; head -5 "$OUT/sec" | sed 's/^/    /'; else ok "ما فيه مفاتيح أو أسرار في المستودع"; fi
if git grep -nIE '[A-Za-z0-9._%+-]+@gmail\.com' -- . ':!*.webp' >"$OUT/pii"; then warn "إيميل شخصي في المستودع: $(head -1 "$OUT/pii" | cut -d: -f1)"; else ok "ما فيه إيميلات شخصية"; fi
grep -q 'allowed.includes(origin)' server/worker.js && ok "الخادم يفحص مصدر الطلب (Origin)" || bad "فحص Origin ناقص"
grep -q 'function sameText' server/worker.js && ok "مقارنة الأرقام السرية ثابتة الوقت" || warn "ما لقيت مقارنة ثابتة الوقت"
grep -q 'rateHit' server/worker.js && ok "حدود المعدل موجودة (الطلب، الكود، الدخول)" || bad "حدود المعدل ناقصة"
[ "$(grep -c 'staffMay(' server/worker.js)" -ge 2 ] && ok "الصلاحيات تنفرض في الخادم (staffMay)" || bad "staffMay ناقص"
T=900 run "اختبار الصلاحيات (موظف ما يوصل للي مو له)" node --test server/test/admin-access.mjs

echo "## ٣) الاختبارات"
T=900 run "اختبارات التشغيل والكاشير والاعتمادية" node --test server/test/operations.mjs server/test/pos.mjs server/test/reliability.mjs
for t in staff-and-pos packs ops-features prep-mode unified-login native-push promo-codes apology-gift catalog-import hours print; do
  [ -f server/test/$t.mjs ] && run "اختبار $t" node server/test/$t.mjs
done

echo "## ٤) المحاكاة"
T=900 run "محاكاة ٤ أشهر (الأرقام والتحليل بصفر فروقات)" node server/test/sim-4-months.mjs
T=900 run "محاكاة ٥ أشهر بكل الأدوار" node server/test/sim-5-months-all-roles.mjs
python3 -c "import json;d=json.load(open('data.json'));d['store']['openAt']='';d['store']['closeAt']='';json.dump(d,open('$OUT/sim.json','w'),ensure_ascii=False)"
node server/test/sim-live-catalog.mjs "$OUT/sim.json" >"$OUT/live" 2>&1
grep -E "طلبات" "$OUT/live" | sed 's/^/    /'
grep -q "اختلاف سعر 0" "$OUT/live" && grep -q "مخزون مطابق \([0-9]*\)/\1" "$OUT/live" && ok "محاكاة ٩٠٠ طلب بالكتالوج الحي: صفر فرق أسعار ومخزون" || bad "محاكاة الكتالوج الحي فيها فرق"

echo "## ٥) البيانات والعروض"
python3 tools/daily/review.py data.json > "$OUT/rev"; grep -E "^- ⚠️" "$OUT/rev" | while read -r l; do echo "⚠️ ${l#- ⚠️ }"; done
WARN=$((WARN+$(grep -c "^- ⚠️" "$OUT/rev")))

echo "## ٦) الإنتاج (قراءة بس)"
API=$(python3 -c "import json;print(json.load(open('data.json'))['store'].get('api',''))")
code=$(curl -s -o "$OUT/st" -w '%{http_code}' -m 20 "$API/stock"); [ "$code" = 200 ] && grep -q '"ok":true' "$OUT/st" && ok "الخادم الحي يرد ($API)" || bad "الخادم الحي ما يرد صح (HTTP $code)"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -X POST -H 'content-type: application/json' -H 'Origin: https://evil.example' "$API/order" -d '{}'); [ "$code" = 403 ] && ok "الخادم الحي يرفض مصدر غريب" || bad "الخادم الحي ما رفض مصدر غريب (HTTP $code)"
git fetch -q origin gh-pages main 2>/dev/null
[ "$(git rev-parse origin/gh-pages)" = "$(git rev-parse origin/main)" ] && ok "main و gh-pages نفس النسخة" || warn "main و gh-pages مختلفين"
[ -z "$(git log --oneline HEAD..origin/gh-pages)" ] && ok "النسخة المحلية فيها كل تعديلات الموقع" || warn "فيه تعديلات على الموقع ما اندمجت محلياً"
ahead=$(git log --oneline origin/gh-pages..HEAD | wc -l); [ "$ahead" = 0 ] && ok "ما فيه تعديلات محلية ما نزلت" || warn "$ahead تعديل جاهز محلياً وما نزل (ينتظر «نزّله»)"
python3 tools/check/live.py "$OUT" || true

echo; echo "## الملخص: ✅ $PASS · ❌ $FAIL · ⚠️ $WARN"
