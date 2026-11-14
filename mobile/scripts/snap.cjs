// يحفظ لقطة شاشة adb ويقص أي نص تحذير قبل ترويسة PNG (الأجهزة متعددة الشاشات مثل القابل للطي تطبع تحذير)
const fs = require('node:fs');
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const b = Buffer.concat(chunks), i = b.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(process.argv[2], i > 0 ? b.subarray(i) : b);
});
