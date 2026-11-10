// يولّد صور الأقسام (بطاقة ٢٤٠×٢٤٠ بلون هادي وثلاث إيموجي) ويحفظها PNG مؤقت، ثم gen.py يحوّلها WebP صغيرة.
// التشغيل: node tools/cat-images/gen.cjs <مجلد-الإخراج>   (يحتاج Playwright وChromium)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const fs = require('fs'), path = require('path');
const out = process.argv[2] || '.';
// القسم: [لون أول، لون ثاني، الإيموجي الكبير في الوسط، الصغير يسار فوق، الصغير يمين تحت]
const CATS = {
  bakery:     ['#FFF0D6', '#FFD9A3', '🥖', '🥐', '🍞'],
  dairy:      ['#EAF4FF', '#CBE4FF', '🥛', '🧀', '🥚'],
  veg:        ['#E8F8E4', '#C6EDBD', '🥬', '🍅', '🍎'],
  meat:       ['#FFE9E4', '#FFC9BE', '🍗', '🥩', '🍖'],
  pantry:     ['#FFF6D6', '#FFE79C', '🍚', '🫒', '🥫'],
  drinks:     ['#E3F5FF', '#BDE6FF', '🥤', '🧃', '☕'],
  sweets:     ['#FFE6F2', '#FFC4E1', '🍫', '🍪', '🍿'],
  clean:      ['#E2F8F5', '#B9EDE6', '🧴', '🧽', '🧼'],
  care:       ['#F1E7FF', '#DAC6FF', '🪥', '🧴', '🪒'],
  misc:       ['#EEF1F5', '#D5DBE5', '🏠', '🔌', '🕯️'],
  kitchen:    ['#FFEDE0', '#FFD2B5', '🍳', '🥄', '🍽️'],
  stationery: ['#FFF8D9', '#FFEBA6', '✏️', '📒', '📎'],
  bbq:        ['#FFE8D6', '#FFC8A0', '🔥', '🍢', '⛺'],
  toys:       ['#E7EDFF', '#C9D8FF', '🧸', '🚗', '🎈'],
  pets:       ['#EAF7E2', '#CFEBBF', '🐱', '🐶', '🦴'],
};
const card = (id, [a, b, big, l, r]) => `<div id="${id}" style="position:relative;width:240px;height:240px;overflow:hidden;background:linear-gradient(145deg,${a},${b});font-family:'Noto Color Emoji',sans-serif">
  <div style="position:absolute;left:-30px;top:-40px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.45)"></div>
  <div style="position:absolute;right:-40px;bottom:-50px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.28)"></div>
  <div style="position:absolute;left:18px;top:16px;font-size:62px;transform:rotate(-12deg);filter:drop-shadow(0 4px 5px rgba(0,0,0,.16))">${l}</div>
  <div style="position:absolute;right:16px;bottom:14px;font-size:66px;transform:rotate(10deg);filter:drop-shadow(0 4px 5px rgba(0,0,0,.16))">${r}</div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);font-size:112px;line-height:1;filter:drop-shadow(0 7px 7px rgba(0,0,0,.2))">${big}</div></div>`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 260, height: 260 }, deviceScaleFactor: 1 });
  for (const [id, v] of Object.entries(CATS)) {
    await pg.setContent('<body style="margin:0">' + card(id, v) + '</body>'); await pg.waitForTimeout(150);
    await (await pg.$('#' + id)).screenshot({ path: path.join(out, id + '.png') });
  }
  await b.close(); console.log('تم', Object.keys(CATS).length);
})();
