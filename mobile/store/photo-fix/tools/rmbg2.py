# يشيل الخلفية البيضاء بس: أبيض صافي متصل بحافة الصورة، وما يعدّي خط حدود المنتج (حتى لو المنتج أبيض)
import sys,os,json
import numpy as np
from PIL import Image
from scipy import ndimage
def run(src,dst):
    a=np.asarray(Image.open(src).convert('RGB')).astype(np.int16); h,w=a.shape[:2]
    mn=a.min(2); mx=a.max(2); g=a.astype(float).mean(2)
    gm=np.hypot(ndimage.sobel(g,0),ndimage.sobel(g,1))
    barrier=ndimage.binary_dilation(gm>8,iterations=1)
    near=(mn>=248)&((mx-mn)<=10)&~barrier
    lab,n=ndimage.label(near)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    # حواف المنتج الفاتحة (التنعيم): شفافية جزئية
    ring=ndimage.binary_dilation(bg,iterations=2)&~bg
    alpha=np.full((h,w),255.0); alpha[bg]=0
    light=ring&(mn>=215)&((mx-mn)<=25)
    alpha[light]=np.clip((255-mn[light])/40*255,0,255)
    rgb=a.astype(float); al=(alpha/255.)[...,None]; part=(alpha>0)&(alpha<255)
    rgb[part]=np.clip((rgb[part]-255*(1-al[part]))/np.maximum(al[part],0.25),0,255)
    Image.fromarray(np.dstack([rgb.astype(np.uint8),alpha.astype(np.uint8)]),'RGBA').save(dst,'WEBP',quality=92,method=6)
    # خطر: المنتج فاتح جداً عند الحد مع الخلفية (ممكن الإزالة دخلت فيه)
    edge=ndimage.binary_dilation(bg,iterations=1)&~bg
    risk=float(((mn>=240)&edge).sum()/max(1,edge.sum()))
    return {'bg':round(float(bg.mean()),3),'risk':round(risk,3)}
if __name__=='__main__':
    srcdir,dstdir=sys.argv[1],sys.argv[2]; os.makedirs(dstdir,exist_ok=True); res={}
    for f in sys.argv[3:]:
        try: res[f]=run(os.path.join(srcdir,f),os.path.join(dstdir,f))
        except Exception as e: res[f]={'err':str(e)[:60]}
    print(json.dumps(res))
