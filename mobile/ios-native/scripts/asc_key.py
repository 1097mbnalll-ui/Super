#!/usr/bin/env python3
"""يلقى مفتاح App Store Connect (.p8) على جهاز Codemagic ويكتب /tmp/asc.json. المتغير APP_STORE_CONNECT_PRIVATE_KEY مو محتوى المفتاح، والمفتاح الحقيقي ملف في ~/.appstoreconnect/private_keys"""
import base64, glob, json, os, re, subprocess
E = os.environ
names = sorted(k for k in E if "APP_STORE" in k or k.startswith("ASC") or "PRIVATE_KEY" in k or "CM_APP_STORE" in k)
print("env names:", names)
def kind(v):
    if not v: return "empty"
    if "BEGIN" in v: return "pem(lines=%d,len=%d)" % (v.count("\n") + 1, len(v))
    if os.path.exists(v.strip()): return "path-to-existing-file"
    if v.strip().startswith("/"): return "path-missing"
    return "other(len=%d)" % len(v)
for n in names:
    if n != "APP_STORE_CONNECT_KEY_IDENTIFIER" and n != "APP_STORE_CONNECT_ISSUER_ID": print(" ", n, "=", kind(E[n]))
cands = []
for n in names:
    v = E[n]
    if not v: continue
    if "BEGIN" in v: cands.append(("env:" + n, v.replace("\\n", "\n")))
    elif os.path.exists(v.strip()) and os.path.isfile(v.strip()): cands.append(("file:" + n, open(v.strip()).read()))
    else:
        try:
            d = base64.b64decode(v).decode()
            if "BEGIN" in d: cands.append(("b64:" + n, d))
        except Exception: pass
for pat in ["~/.appstoreconnect/private_keys/*.p8", "~/.private_keys/*.p8", "/Users/builder/clone/*.p8"]:
    for f in glob.glob(os.path.expanduser(pat))[:5]:
        print("found key file:", f); cands.append(("file:" + f, open(f).read()))
print("candidates:", [c[0] for c in cands])
ok = None
for name, raw in cands:
    body = re.sub(r"-----[^-]+-----|\s+", "", raw)
    pem = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(body[i:i+64] for i in range(0, len(body), 64)) + "\n-----END PRIVATE KEY-----\n"
    open("/tmp/AuthKey.p8", "w").write(pem)
    r = subprocess.run(["openssl", "pkey", "-in", "/tmp/AuthKey.p8", "-noout"], capture_output=True)
    print("try", name, "chars", len(body), "->", "OK" if r.returncode == 0 else "no")
    if r.returncode == 0: ok = pem; break
if not ok: print("KEY_NOT_FOUND"); raise SystemExit(1)
json.dump({"key_id": E["APP_STORE_CONNECT_KEY_IDENTIFIER"], "issuer_id": E["APP_STORE_CONNECT_ISSUER_ID"], "key": ok, "in_house": False}, open("/tmp/asc.json", "w"))
