# الخطوة الأخيرة: يشيل البقع الصغيرة، ويوسّط كل منتج بنفس الهامش. اللي فيه تسريب (leak) يبقى بخلفيته ويتوسّط بس
import sys,os,json
import numpy as np
from PIL import Image
from scipy import ndimage
S=300; FIT=264
L=json.load(open('leak.json'))
def center(rgba, white):
    a=np.asarray(rgba)
    m=(a[...,3]>20) if not white else (np.asarray(rgba.convert('RGB')).astype(int).min(2)<245)
    ys,xs=np.where(m)
    if len(xs)==0: return rgba
    x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    crop=rgba.crop((x0,y0,x1,y1)); w,h=crop.size
    sc=min(FIT/w,FIT/h,1.6); crop=crop.resize((max(1,round(w*sc)),max(1,round(h*sc))),Image.LANCZOS)
    can=Image.new('RGBA',(S,S),(255,255,255,255 if white else 0))
    can.alpha_composite(crop,((S-crop.width)//2,(S-crop.height)//2)) if not white else can.paste(crop,((S-crop.width)//2,(S-crop.height)//2))
    return can
def run(f,srcdir,bgdir,dst):
    if L.get(f,0)>0.01:
        im=Image.open(os.path.join(srcdir,f)).convert('RGBA'); out=center(im,True); tag='manual'
    else:
        im=Image.open(os.path.join(bgdir,f)).convert('RGBA'); a=np.array(im)
        op=a[...,3]>40; lab,n=ndimage.label(op)
        if n>1:
            sz=ndimage.sum(op,lab,range(1,n+1)); big=sz.max()
            for i,s in enumerate(sz,1):
                if s<max(40,0.02*big): a[...,3][lab==i]=0
        out=center(Image.fromarray(a,'RGBA'),False); tag='ok'
    out.save(os.path.join(dst,f),'WEBP',quality=92,method=6)
    return tag
if __name__=='__main__':
    srcdir,bgdir,dst=sys.argv[1:4]; os.makedirs(dst,exist_ok=True)
    print(json.dumps({f:run(f,srcdir,bgdir,dst) for f in sys.argv[4:]}))
