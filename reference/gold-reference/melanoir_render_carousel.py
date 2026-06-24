#!/usr/bin/env python3
# Melanoir IG 캐러셀 렌더러 (재사용) — JSON 스펙 → 슬라이드 PNG
# 사용:  python3 melanoir_render_carousel.py carousel_specs/carousel_01.json
#   - 배경은 bg/lib/ 의 실사 이미지(파일명만 지정)
#   - 출력: cards/carousel_<id>/s1..sN.png + cards/carousel_<id>_preview.png
# 슬라이드 type: cover_stmt | cover_data | body | closing
# 변형(mode): A(디밍+비네팅) B(블러) C(헤더밴드+순흑) D(순흑) E(가운데 숫자)
# 핵심 강조: segments=[["회색문장",false],["핵심문장",true]] → 핵심은 흰색+골드밑줄(문단 인라인)
import sys, os, json, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

BASE = os.path.dirname(os.path.abspath(__file__))
LIB  = os.path.join(BASE, "bg", "lib")
W, H = 1080, 1350
GOLD=(194,161,90); GRAY=(202,202,205); WHITE=(255,255,255); TITLE_Y=600
_s = ImageDraw.Draw(Image.new("RGB",(10,10)))

FONTS_B = [os.path.join(BASE,"fonts","Pretendard-Bold.otf"),
           "/Library/Fonts/Pretendard-Bold.otf","/System/Library/Fonts/AppleSDGothicNeo.ttc",
           "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]
FONTS_R = [os.path.join(BASE,"fonts","Pretendard-Regular.otf"),
           "/Library/Fonts/Pretendard-Regular.otf","/System/Library/Fonts/AppleSDGothicNeo.ttc",
           "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]
def _pick(c): return next((p for p in c if os.path.exists(p)), c[-1])
FB,FR=_pick(FONTS_B),_pick(FONTS_R)
def fo(sz,b=True): return ImageFont.truetype(FB if b else FR, sz)
def fit(t,mw,start,mn=36,b=True):
    sz=start
    while sz>mn and _s.textlength(t,font=fo(sz,b))>mw: sz-=3
    return fo(sz,b)
def imgpath(name): return name if os.path.isabs(name) else os.path.join(LIB, os.path.basename(name))

def cover(img, zoom=1.0, fx=0.5, fy=0.5, flip=False):
    # zoom>1 = 확대 / fx,fy = 초점(0~1, 0.5=가운데) / flip = 좌우반전.
    # 같은 이미지를 한 캐러셀에서 2번 쓸 때 변형으로 반복감을 줄이기 위함.
    im=Image.open(imgpath(img)).convert("RGB")
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    iw,ih=im.size; s=max(W/iw,H/ih)*max(1.0,float(zoom))
    im=im.resize((int(iw*s+1),int(ih*s+1)),Image.LANCZOS); iw,ih=im.size
    x=int((iw-W)*min(max(fx,0.0),1.0)); y=int((ih-H)*min(max(fy,0.0),1.0))
    return im.crop((x,y,x+W,y+H))
# 검정 오버레이 그라데이션: 위에서 아래로 불투명도가 '서서히' 증가.
#   top  = 화면 상단(워드마크 아래)에서의 검정 불투명도(낮을수록 이미지 선명)
#   bot  = 본문 영역(~0.90H)에서의 상한 불투명도(255 미만 → 순흑 아님, 배경 비침)
#   ease = >1이면 상단을 더 오래 밝게 유지하다 하단에서 빠르게 어두워짐(점진적)
# 하단 워터마크 영역(0.93H~)만 짧게 솔리드로 차폐.
def gmask(top, bot, ease=1.8, wm=True, topband=150, topband_to=0.15):
    g=Image.new("L",(1,H),0)
    for y in range(H):
        fy=y/H
        t=max(0.0,min(1.0,fy/0.90))
        a=top+(bot-top)*(t**ease)
        if topband>0 and fy<topband_to:                 # 상단 워드마크 가독용 약한 디밍
            a=max(a, topband*((topband_to-fy)/topband_to))
        if wm:                                          # 워터마크 차폐: 0.80~0.88 넓게 램프 → 완전 불투명(전 폭, 좌우반전 대비). 솔리드 두께(0.88~) 유지.
            a=max(a, 255*min(1.0,max(0.0,(fy-0.80)/0.08)))
        g.putpixel((0,y),int(min(255,max(0,a))))
    return g.resize((W,H))
def dim(base, top, bot, ease=1.8):
    return Image.composite(Image.new("RGB",(W,H),(0,0,0)), base, gmask(top,bot,ease))
def vmask():
    m=Image.new("L",(W,H),0); ImageDraw.Draw(m).ellipse([-W*0.25,-H*0.2,W*1.25,H*1.2],fill=255)
    return m.filter(ImageFilter.GaussianBlur(240))
def imgkw(sl): return {k:sl[k] for k in ("zoom","fx","fy","flip") if k in sl}
def bg(mode,img=None,zoom=1.0,fx=0.5,fy=0.5,flip=False):
    if mode=="D": return Image.new("RGB",(W,H),(0,0,0))
    base=cover(img,zoom,fx,fy,flip)
    # 디밍 곡선: 상단 밝게(이미지 후킹) → 절반 높이쯤 충분히 어둡게(본문 가독) → 하단 넓고 완만하게 솔리드로.
    if mode=="A":                                       # 디밍+비네팅
        va=Image.composite(ImageEnhance.Brightness(base).enhance(0.80),
                           ImageEnhance.Brightness(base).enhance(0.50), vmask())
        return dim(va, 30, 255, 0.95)
    if mode=="B":                                       # 블러
        return dim(ImageEnhance.Brightness(base.filter(ImageFilter.GaussianBlur(28))).enhance(0.70), 34, 255, 0.95)
    if mode=="C":                                       # 헤더형: 상단 선명 → 완만한 점진 디밍
        return dim(base, 30, 255, 0.95)
    if mode=="E":                                       # 가운데 숫자: 숫자 대비 위해 약간 더 어둡게
        return dim(base, 70, 255, 0.90)
    return dim(base, 18, 255, 1.20)                     # full(cover_stmt): 상단 이미지 후킹 강조
def wm(d,c=False): d.text((W/2 if c else 60,62 if c else 58),"M E L A N O I R",font=fo(25),fill=WHITE,anchor=("ma" if c else "la"))
def flow(d,segments,x0,y0,max_w,font,lh):
    sw=_s.textlength(" ",font=font); x,y=x0,y0; pkx=None; py=None; toks=[]
    for txt,key in segments:
        for wd in txt.split(" "):
            if wd: toks.append((wd,key))
    for wd,key in toks:
        ww=_s.textlength(wd,font=font)
        if x+ww>x0+max_w and x>x0: x=x0; y+=lh; pkx=None
        d.text((x,y),wd,font=font,fill=(WHITE if key else GRAY))
        if key:
            d.line([(x,y+45),(x+ww,y+45)],fill=GOLD,width=3)
            if pkx is not None and py==y: d.line([(pkx,y+45),(x,y+45)],fill=GOLD,width=3)
            pkx=x+ww; py=y
        else: pkx=None
        x+=ww+sw
    return y+lh

def s_cover_stmt(sl):
    im=bg("full",sl["image"],**imgkw(sl))
    tg=Image.new("L",(1,H),0)                          # 상단 스크림: 밝은 배경에서도 워드마크 가독
    for yy in range(H): tg.putpixel((0,yy),int(180*max(0,min(1,(H*0.18-yy)/(H*0.18)))))
    im=Image.composite(Image.new("RGB",(W,H),(0,0,0)),im,tg.resize((W,H)))
    d=ImageDraw.Draw(im); wm(d)
    lines=sl["lines"]; sz=76                              # 폭 초과 시 균일 자동 축소(오버플로 방지)
    while sz>40 and max(_s.textlength(ln,font=fo(sz)) for ln in lines) > W-120: sz-=2
    lh=int(sz*1.18); y=1245-lh*len(lines)
    for ln in lines: d.text((60,y),ln,font=fo(sz),fill=WHITE); y+=lh
    return im
def s_cover_data(sl):
    im=bg("E",sl["image"],**imgkw(sl)); d=ImageDraw.Draw(im); wm(d,True)
    d.text((W/2,560),sl["number"],font=fit(sl["number"],W-150,300,120),fill=WHITE,anchor="mm")
    d.line([(W/2-140,720),(W/2+140,720)],fill=GOLD,width=4)
    d.text((W/2,775),sl["label"],font=fo(44,False),fill=GRAY,anchor="ma")
    if sl.get("hook"): d.text((W/2,980),sl["hook"],font=fo(40),fill=WHITE,anchor="ma")
    return im
def s_body(sl):
    im=bg(sl.get("mode","A"),sl["image"],**imgkw(sl)); d=ImageDraw.Draw(im); wm(d); ty=TITLE_Y
    nf=fo(50); d.text((60,ty),sl["num"],font=nf,fill=GOLD); nw=_s.textlength(sl["num"]+"  ",font=nf)
    d.text((60+nw,ty),sl["title"],font=fit(sl["title"],W-(60+nw)-60,50),fill=WHITE); ty+=116
    flow(d,sl["segments"],60,ty,W-120,fo(35,False),56)
    return im
def s_closing(sl):
    im=bg("D"); d=ImageDraw.Draw(im); wm(d,True); lines=sl["lines"]
    cy=int(H/2 - len(lines)*44 - 30)
    for ln in lines: d.text((W/2,cy),ln,font=fit(ln,W-150,58,40),fill=WHITE,anchor="ma"); cy+=88
    cy+=30; d.line([(W/2-55,cy),(W/2+55,cy)],fill=GOLD,width=3)
    return im
RENDER={"cover_stmt":s_cover_stmt,"cover_data":s_cover_data,"body":s_body,"closing":s_closing}

def main(spec_path):
    spec=json.load(open(spec_path,encoding="utf-8")); cid=spec["id"]
    out=os.path.join(BASE,"cards",f"carousel_{cid:02d}"); os.makedirs(out,exist_ok=True)
    paths=[]
    for i,sl in enumerate(spec["slides"],1):
        im=RENDER[sl["type"]](sl); p=os.path.join(out,f"s{i}.png"); im.save(p); paths.append(p)
    print(f"rendered {len(paths)} slides → {out}")
    try:
        subprocess.run(["montage",*paths,"-tile",f"4x{(len(paths)+3)//4}","-geometry","280x350+5+5",
                        "-background","#1a1a1a",os.path.join(BASE,"cards",f"carousel_{cid:02d}_preview.png")],check=True)
        print("preview 생성")
    except Exception as e: print("montage 건너뜀:",e)

if __name__=="__main__":
    main(sys.argv[1] if len(sys.argv)>1 else os.path.join(BASE,"carousel_specs","carousel_01.json"))
