# يخلط صوت التعليق مع الموسيقى: الموسيقى تنخفض تلقائياً لما يتكلم المعلّق (ducking)
import numpy as np, subprocess, sys
SR=44100
def load(p, ch):
    return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',p,'-ac',str(ch),'-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout,dtype=np.float32).reshape(-1,ch).T.copy()
voice=load(sys.argv[1],1)[0]; music=load(sys.argv[2],2); n=min(len(voice),music.shape[1]); voice=voice[:n]; music=music[:,:n]
hop=441; m=n//hop
env=np.sqrt((voice[:m*hop].reshape(m,hop)**2).mean(1)); talk=(20*np.log10(env+1e-9) > -42).astype(float)
# هجوم سريع (٨٠ مللي) ورجوع هادئ (٥٠٠ مللي)
g=np.zeros(m); cur=0.0
for i in range(m):
    tgt=talk[i]; k=0.25 if tgt>cur else 0.02; cur+= (tgt-cur)*k; g[i]=cur
duck=10**(-(10*g)/20)          # تنخفض ١٠ ديسيبل وقت الكلام
duck=np.repeat(duck,hop); duck=np.concatenate([duck,np.full(n-len(duck),duck[-1])])
vr=np.sqrt((voice**2).mean()); mr=np.sqrt((music**2).mean())
music=music*(vr/mr)*10**(-14/20)*duck     # الموسيقى أخفض من الصوت بـ١٤ ديسيبل قبل الخفض
out=music+voice[None,:]
out/=np.abs(out).max()/0.95
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-af','loudnorm=I=-16:TP=-1.5:LRA=11',sys.argv[3]],input=out.T.astype('<f4').tobytes(),check=True)
