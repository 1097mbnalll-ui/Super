import numpy as np, json, sys, os
from PIL import Image
def leak(path):
    a=np.asarray(Image.open(path).convert('RGBA'))[...,3]; obj=a>40; bg=a<10
    if obj.sum()==0: return 1.0
    rows=np.zeros_like(obj); cols=np.zeros_like(obj)
    for y in range(obj.shape[0]):
        xs=np.where(obj[y])[0]
        if len(xs): rows[y,xs[0]:xs[-1]+1]=True
    for x in range(obj.shape[1]):
        ys=np.where(obj[:,x])[0]
        if len(ys): cols[ys[0]:ys[-1]+1,x]=True
    inner=rows&cols&bg
    return round(float(inner.sum()/obj.sum()),3)
if __name__=='__main__':
    d=sys.argv[1]; print(json.dumps({f:leak(os.path.join(d,f)) for f in sys.argv[2:]}))
