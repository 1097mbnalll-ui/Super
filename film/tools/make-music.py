#!/usr/bin/env python3
# موسيقى أصلية للمقطعين، تتولّد بالكامل بالكود (بدون عينات ولا مكتبات موسيقى)، فما عليها حقوق لأحد.
# تقرأ أوقات المشاهد من film/index.html، فلو تغيّرت المدد تتغيّر الموسيقى معها.
# التشغيل: python3 film/tools/make-music.py <مجلد الإخراج>      (يحتاج numpy و ffmpeg)
# الإخراج: film-music.wav و sales-music.wav (ستيريو 44.1 كيلوهرتز)
import json, os, re, subprocess, sys
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
rng = np.random.default_rng(7)

# ---------- أوقات المشاهد من الصفحة ----------
html = open(os.path.join(HERE, '..', 'index.html'), encoding='utf-8').read()
def scene_durs(name, nxt):
    blk = html[html.index('var ' + name + ' = ['):html.index('var ' + nxt + ' = [')]
    return [float(x) for x in re.findall(r'\{ id:"[a-z]\d+", ch:"[a-z]+", title:"[^"]+", dur:([\d.]+)', blk)]
def starts(durs):
    s, t = [], 0.0
    for d in durs: s.append(t); t += d
    return s, t

# ---------- أدوات ----------
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
class Bus:
    def __init__(self, total): self.b = np.zeros((2, int((total + 6) * SR)))
    def add(self, at, sig, gain=1.0, pan=0.0):
        i = int(at * SR); j = min(self.b.shape[1], i + len(sig))
        if j <= i: return
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.b[0, i:j] += sig[:j - i] * gain * l * 1.41; self.b[1, i:j] += sig[:j - i] * gain * r * 1.41

def pluck(m, d=1.8, bright=1.0, decay=1.0):
    """وتر مقروص بطابع قريب من العود: توافقيات تخمد بسرعة مختلفة + نقرة ريشة."""
    f, t = hz(m), tt(d); s = np.zeros_like(t)
    for k in range(1, 12):
        if k * f > 9000: break
        amp = abs(np.sin(np.pi * k * 0.22)) / k ** (1.25 - 0.25 * bright)
        s += amp * np.sin(2 * np.pi * k * f * (1 + 0.0006 * k * k) * t) * np.exp(-t * decay * (2.4 + 1.1 * k))
    n = min(len(t), int(0.006 * SR)); s[:n] += rng.normal(0, 0.35, n) * np.linspace(1, 0, n)
    s[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return s / (np.abs(s).max() + 1e-9)

def pad(ms, d, att=1.2, rel=1.6, cutoff=1600, vib=0.0012):
    """وسادة وتريات: أصوات منحرفة قليلاً عن بعض، مع ترشيح ناعم."""
    t = tt(d + rel); s = np.zeros_like(t)
    for m in ms:
        for cents in (-8, 0, 7):
            f = hz(m) * 2 ** (cents / 1200); ph = rng.uniform(0, 6.28)
            lfo = 1 + vib * np.sin(2 * np.pi * rng.uniform(4.5, 5.5) * t)
            for k in range(1, 9):
                a = (1 / k) / (1 + (k * f / cutoff) ** 2)
                s += a * np.sin(2 * np.pi * k * f * t * lfo + ph * k)
    env = np.minimum(1, t / att) * np.clip((d + rel - t) / rel, 0, 1)
    s *= env
    return s / (np.abs(s).max() + 1e-9)

def bass(m, d=1.2):
    f, t = hz(m), tt(d)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)) * np.exp(-t * 1.6)
    s[: int(0.006 * SR)] *= np.linspace(0, 1, int(0.006 * SR))
    return s / np.abs(s).max()

def kick():
    t = tt(0.45); f = 44 + 90 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 8.5)

def hat(d=0.07):
    t = tt(d); n = rng.normal(0, 1, len(t)); n = np.diff(np.concatenate([[0], n]))
    return n * np.exp(-t * 70) * 0.5

def shaker():
    t = tt(0.12); n = rng.normal(0, 1, len(t)); n = np.diff(np.concatenate([[0], n]))
    return n * np.sin(np.pi * np.minimum(1, t / 0.12)) * 0.35

def tick():
    t = tt(0.05); return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 140)

def stab(m, d=0.2):
    """ضربة وتريات قصيرة متوترة."""
    f, t = hz(m), tt(d); s = np.zeros_like(t)
    for k in range(1, 14):
        s += (1 / k) / (1 + (k * f / 2600) ** 2) * np.sin(2 * np.pi * k * f * t)
    env = np.minimum(1, t / 0.008) * np.exp(-t * 9)
    return s * env / (np.abs(s).max() + 1e-9)

def riser(d):
    t = tt(d); n = rng.normal(0, 1, len(t))
    k = np.exp(np.linspace(np.log(0.02), np.log(0.4), len(t)))  # فلتر يفتح تدريجياً
    y = np.zeros_like(n); acc = 0.0
    for i in range(0, len(n), 64):
        seg = n[i:i + 64]; a = k[i]
        for j in range(len(seg)):
            acc += a * (seg[j] - acc); y[i + j] = acc
    return y * (t / d) ** 2 / (np.abs(y).max() + 1e-9)

def reverb(x, secs=2.6, mix=0.32):
    """صدى بغرفة كبيرة: التفاف مع استجابة ضوضاء متلاشية (FFT)."""
    n = int(secs * SR); t = np.arange(n) / SR
    out = np.zeros_like(x)
    for c in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-t * 6.9 / secs)
        ir = np.convolve(ir, np.ones(6) / 6, 'same'); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
        L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        wet = np.fft.irfft(np.fft.rfft(x[c], L) * np.fft.rfft(ir, L), L)[: x.shape[1]]
        out[c] = x[c] * (1 - mix) + wet * mix * 1.6
    return out

def master(dry, wet_bus, total, fade_out=2.5):
    y = dry.b + reverb(wet_bus.b)
    y = y[:, : int(total * SR)]
    f = int(fade_out * SR); y[:, -f:] *= np.linspace(1, 0, f) ** 1.5
    y = np.tanh(y / (np.abs(y).max() + 1e-9) * 1.3) / np.tanh(1.3) * 0.89
    return y

# الهارموني: ري صغير، دورة رجاء (i – VI – III – VII)
PROG = [(50, [62, 65, 69]), (46, [58, 62, 65]), (53, [57, 60, 65]), (48, [55, 60, 64])]
BEAT = 60 / 96; BAR = BEAT * 4

def groove(dry, wet, t0, t1, drums_from=None, full_from=None, hats_from=None, gain=1.0):
    t = t0; bar = 0
    while t < t1 - 0.3:
        root, ch = PROG[bar % 4]
        full = full_from is not None and t >= full_from
        wet.add(t, pad(ch, min(BAR, t1 - t), att=0.25, rel=1.2, cutoff=1900 if full else 1300), 0.22 * gain * (1.25 if full else 1))
        if full: wet.add(t, pad([c + 12 for c in ch[1:]], min(BAR, t1 - t), att=0.6, rel=1.4, cutoff=2600), 0.09 * gain)
        dry.add(t, bass(root - 12, BEAT * 2), 0.30 * gain); dry.add(t + BEAT * 2, bass(root - 12, BEAT * 2), 0.26 * gain)
        pat = [0, 2, 1, 2, 0, 2, 1, 2]; notes = [c + 12 for c in ch]
        for i, p in enumerate(pat):
            at = t + i * BEAT / 2
            if at >= t1: break
            wet.add(at, pluck(notes[p] if i != 4 else notes[0] + 12, 1.2, decay=1.3), 0.075 * gain, pan=-0.35 if i % 2 else 0.35)
        if drums_from is not None and t >= drums_from:
            for b in (0, 2):
                if t + b * BEAT < t1: dry.add(t + b * BEAT, kick(), 0.42 * gain)
        if hats_from is not None and t >= hats_from:
            for i in range(8):
                at = t + i * BEAT / 2
                if at < t1: dry.add(at, hat() if i % 2 else shaker(), (0.11 if i % 2 else 0.06) * gain, pan=0.25)
        t += BAR; bar += 1
    return t

# لحن «العود» على مقام حجاز من ري (الدفتر القديم)، ويرجع في الختام
MOTIF_A = [(62, 1.0), (63, .5), (66, .5), (67, 1.5), (66, .5), (63, .5), (62, 2.0)]
MOTIF_B = [(69, 1.0), (67, .5), (66, .5), (67, 1.0), (69, 1.0), (70, .5), (69, .5), (67, 1.0), (66, 1.0), (62, 2.2)]
def play(wet, t, motif, speed=0.62, gain=0.5, oct=0):
    for m, d in motif:
        wet.add(t, pluck(m + oct, max(1.4, d * speed * 2.2), bright=0.8, decay=0.8), gain, pan=-0.1)
        t += d * speed
    return t

# ---------- الفيلم السينمائي ----------
def film():
    durs = scene_durs('FILM', 'SALES'); S, T = starts(durs)
    dry, wet = Bus(T), Bus(T)
    # ١) الدفتر: درون خافت، والعود يدخل عند الثانية ١٠
    wet.add(2.0, pad([38, 45], S[2] - 2.0, att=6, rel=3, cutoff=500), 0.12)
    t = 10.0
    t = play(wet, t, MOTIF_A) + 1.4
    t = play(wet, t, MOTIF_B) + 1.6
    t = play(wet, t, MOTIF_A, gain=0.42) + 1.0
    # ٢) الرفوف تطول: إيقاع خفيف تحت العود
    x = S[1]
    while x < S[2]:
        dry.add(x, shaker(), 0.07, pan=0.3); dry.add(x + BEAT, tick(), 0.035, pan=-0.3); x += BEAT * 2
    while t < S[2] - 2.5:
        t = play(wet, t, MOTIF_B, gain=0.36, speed=0.55) + 1.0
    # ٣ و٤) التشتّت: نبض يتسارع ووتريات متوترة، ثم قطع كامل قبل «كم ربحنا فعلًا؟»
    cut = S[3] + 18.5
    x, bpm = S[2], 100.0
    seq = [50, 50, 51, 50, 53, 50, 51, 48]
    i = 0
    while x < cut - 0.05:
        step = 60 / bpm / 2
        dry.add(x, stab(seq[i % 8], 0.18), 0.17 + 0.12 * (x - S[2]) / (cut - S[2]), pan=0.3 if i % 2 else -0.3)
        if i % 2 == 0: dry.add(x, kick(), 0.18 + 0.2 * (x - S[2]) / (cut - S[2]))
        if x > S[2] + 8: dry.add(x + step / 2, hat(), 0.07, pan=0.4)
        x += step; i += 1; bpm = 100 + 46 * ((x - S[2]) / (cut - S[2])) ** 1.4
    wet.add(S[2], pad([38, 45, 51], cut - S[2], att=8, rel=0.05, cutoff=900), 0.16)
    wet.add(cut - 4.0, riser(4.0), 0.22)
    # ٥) التحوّل: صمت، ثم نغمة عود وحدة ووتريات دافئة
    one = S[4] + 2.5
    wet.add(one, pluck(50, 4.0, bright=0.6, decay=0.45), 0.6)
    wet.add(one + 0.3, pad([53, 57, 60, 65], S[5] - one + 2, att=3.5, rel=2.5, cutoff=1500), 0.22)
    # ٦–٩) متاجر أحد: نبض حديث هادئ، يتسع مع الوقت
    end_g = groove(dry, wet, S[5], S[9], drums_from=S[5] + BAR * 2, hats_from=S[6], full_from=S[7])
    wet.add(S[8], pad([74, 77, 81], S[9] - S[8], att=4, rel=2, cutoff=3000), 0.08)
    # ١٠) الدفتر القادم: يرجع لحن العود فوق آخر وتريات، ثم نغمة أخيرة
    wet.add(S[9], pad([50, 57, 62, 66], T - S[9], att=1.5, rel=2.5, cutoff=1400), 0.2)
    t = play(wet, S[9] + 0.8, MOTIF_A, gain=0.5)
    wet.add(t + 0.4, pluck(50, 5, bright=0.6, decay=0.4), 0.55)
    y = master(dry, wet, T, fade_out=3.0)
    # صمت تام بين القطع والنغمة الأولى (حتى ذيل الصدى ينقطع)
    a, b = int((cut + 0.35) * SR), int((one - 0.02) * SR); r = int(0.3 * SR)
    y[:, a - r:a] *= np.linspace(1, 0, r); y[:, a:b] = 0
    return y, T, S

# ---------- النسخة البيعية ----------
def sales():
    durs = scene_durs('SALES', 'SHOTS'); S, T = starts(durs)
    dry, wet = Bus(T), Bus(T)
    # السؤال: توتر خفيف (درون + دقّات ساعة)
    wet.add(0, pad([38, 45], S[1] + 0.5, att=1.5, rel=0.8, cutoff=500), 0.18)
    x = 0.0
    while x < S[1] - 0.2: dry.add(x, tick(), 0.06, pan=0.2 if int(x * 2) % 2 else -0.2); x += 0.5
    wet.add(S[1] - 2.2, riser(2.2), 0.14)
    # متجرك أونلاين: نغمة دافئة وتريات تكبر
    wet.add(S[1], pluck(74, 3, bright=0.7, decay=0.6), 0.5)
    wet.add(S[1], pad([53, 57, 60, 65], S[2] - S[1] + 0.6, att=2.2, rel=1.0, cutoff=1500), 0.24)
    for k, m in enumerate([69, 72, 74]): wet.add(S[1] + 2.4 + k * 1.6, pluck(m, 1.8, decay=0.9), 0.22)
    # من «زبونك يطلب» لين قبل الدعوة: نبض واثق
    groove(dry, wet, S[2], S[9], drums_from=S[2], hats_from=S[4], full_from=S[6], gain=0.95)
    # الدعوة: الإيقاع يهدأ، وتريات وختام على فا الكبير
    wet.add(S[9], pad([53, 57, 60, 64, 67], T - S[9], att=1.2, rel=2.0, cutoff=1700), 0.24)
    for k, m in enumerate([69, 72, 76, 77]): wet.add(S[9] + 0.5 + k * 0.9, pluck(m, 2.2, decay=0.8), 0.2)
    dry.add(S[9], bass(41, 3.5), 0.25)
    return master(dry, wet, T, fade_out=2.5), T, S

def save(y, path):
    data = (np.clip(y.T, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=data, check=True)

os.makedirs(OUT, exist_ok=True)
info = {}
for name, fn in (('sales', sales), ('film', film)):
    y, T, S = fn(); save(y, os.path.join(OUT, name + '-music.wav')); info[name] = {'total': T, 'starts': S}
    print(name, round(T, 2), 'ث')
json.dump(info, open(os.path.join(OUT, 'music-info.json'), 'w'))
