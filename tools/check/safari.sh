#!/usr/bin/env bash
# فحص الموقع على محرك آبل الحقيقي (إجباري قبل أي تنزيل يغيّر index.html أو admin.js، قرار المالك ١٥ نوفمبر ٢٠٢٦).
# يرفع النسخة الحالية لفرع site-test-<sha> ويخلي سير عمل site-safari (فرع site-safari) يفحصها:
#   Playwright WebKit (أرقام ✅/❌: الرأس، البنرات، السحب، التحية) + صور Safari الحقيقي في محاكي آيفون.
# النتيجة في فرع shots-site/<رقم التشغيل>: summary.txt وصور sim/*.png — لازم تشوف صور sim بعينك.
set -euo pipefail
sha=$(git rev-parse --short HEAD)
git push -q origin "HEAD:refs/heads/site-test-$sha"
tmp=$(mktemp -d)
git fetch -q origin site-safari
git worktree add -q "$tmp" origin/site-safari
( cd "$tmp" && echo "site-test-$sha" > tools/safari/site-ref && git add tools/safari/site-ref && git commit -qm "فحص Safari للنسخة $sha" && git push -q origin HEAD:site-safari )
git worktree remove --force "$tmp"
echo "انرفع للفحص: site-test-$sha. انتظر فرع shots-site/<رقم> (حوالي ٦ دقايق) وشوف summary.txt وصور sim."
