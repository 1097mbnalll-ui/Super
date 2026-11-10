#!/usr/bin/env python3
# يحوّل لقطات film/shots/raw (PNG) إلى webp خفيفة في film/shots، ويطلّع الشعار من data.json.
# التشغيل: python3 film/tools/pack-shots.py   (يحتاج Pillow)
import base64, glob, json, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); shots = os.path.join(here, '..', 'shots'); raw = os.path.join(shots, 'raw')
total = 0
for f in sorted(glob.glob(os.path.join(raw, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    limit = 1600 if name.startswith('a') else 780
    if im.width > limit: im = im.resize((limit, round(im.height * limit / im.width)), Image.LANCZOS)
    out = os.path.join(shots, name + '.webp'); im.save(out, 'WEBP', quality=80, method=6); total += os.path.getsize(out)
data = json.load(open(os.path.join(here, '..', '..', 'data.json'), encoding='utf-8'))
logo = data.get('imgs', {}).get('logo', '')
if logo.startswith('data:'):
    open(os.path.join(shots, 'logo.webp'), 'wb').write(base64.b64decode(logo.split(',', 1)[1]))
print('packed', len(glob.glob(os.path.join(shots, '*.webp'))), 'files,', round(total / 1024), 'KB')
