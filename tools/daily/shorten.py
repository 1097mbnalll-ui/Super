"""أسماء أقصر (طلب المالك ١٧ نوفمبر ٢٠٢٦، مثال: «ميرندا مشروب غازي حمضيات كويتي 150 مل» ← «ميرندا حمضيات» والسطر الرمادي «150 مل»).
القواعد:
 ١) الحجم آخر الاسم يروح للسطر الرمادي (unit) لو الوحدة «حبة» أو فاضية وما للمنتج خيارات بيع.
 ٢) نشيل نوع المنتج العام بعد الماركة (مشروب غازي، رقائق بطاطس…) لو بقى بعده وصف، وكلمات ما تفيد مع الحجم (كويتي، حبة).
 ٣) الكلمات المشالة تنحفظ في kw (البحث يلقاها، والزبون ما يشوفها).
يتكرر بأمان: python3 tools/daily/shorten.py data.json [--dry]"""
import json, re, sys

TYPES = ["مشروب غازي", "رقائق بطاطس", "مشروب طاقة", "شراب غازي"]
DROP = ["كويتي", "حبة"]
SIZE = re.compile(r"\s+((?:\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:جم|كجم|مل|لتر|غم|ملي|ك)\b(?:\s*[×x]\s*\d+)?(?:\s*·\s*\d+\s*قطعة)?))\s*$")

def shorten(p):
    name, unit, kw = p["name"], p.get("unit") or "", []
    if p.get("packs"): return None
    if not re.fullmatch(r"\d{6,14}", str(p.get("bc") or "")): return None   # بدون باركود صحيح: update.py يطابقه بالاسم
    if unit in ("", "حبة"):
        m = SIZE.search(name)
        if m and name[:m.start()].split() and not re.search(r"[×x]\s*$", name[:m.start()]):
            unit = m.group(1).strip(); name = name[:m.start()].strip()
    for t in TYPES:
        i = (name + " ").find(" " + t + " ")
        rest = (name[:i] + " " + name[i + len(t) + 2:]).split() if i > 0 else []
        if i > 0 and (len(rest) >= 2 or t == "مشروب غازي"):   # فيه ماركة قبله، وما يبقى اسم غامض
            name = (name[:i] + " " + name[i + len(t) + 2:]).strip(); kw.append(t)
    words = name.split(); keep = []
    for j, w in enumerate(words):
        if w in DROP and len(words) > 2 and not (j and re.match(r"^[\d.]+$", words[j - 1])): kw.append(w); continue
        keep.append(w)
    name = " ".join(keep)
    if name == p["name"] and unit == (p.get("unit") or ""): return None
    return name, unit or p.get("unit"), " ".join(kw)

def main():
    path = sys.argv[1]; dry = "--dry" in sys.argv
    d = json.load(open(path)); n = 0
    for p in d["products"]:
        r = shorten(p)
        if not r: continue
        n += 1
        if dry:
            if n <= 40: print(p["name"], "|", p.get("unit"), "  ←→  ", r[0], "|", r[1])
            continue
        p["name"], p["unit"] = r[0], r[1]
        if r[2]: p["kw"] = " ".join(sorted(set((p.get("kw", "") + " " + r[2]).split())))
    print("تغيّر", n, "منتج")
    if not dry: json.dump(d, open(path, "w"), ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__": main()
