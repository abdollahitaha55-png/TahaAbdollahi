import math, sys
out=sys.argv[1]
W,H=1600,820
col='#1f3a93'
nodes={
 'SL':(1330,410,215,140,['رهبر خدمتگزار']),
 'MW':(800,165,200,118,['معنای کار']),
 'ID':(800,655,200,118,['همزادپنداری','با رهبر']),
 'UPB':(270,410,215,160,['رفتار غیراخلاقی','حامی سازمان']),
}
def edge(a,b,gap=10):
    ax,ay,arx,ary,_=nodes[a]; bx,by,brx,bry,_=nodes[b]
    dx,dy=bx-ax,by-ay
    ta=1/math.sqrt((dx/arx)**2+(dy/ary)**2)
    tb=1/math.sqrt((dx/brx)**2+(dy/bry)**2)
    L=math.hypot(dx,dy)
    x1,y1=ax+dx*ta+dx/L*gap, ay+dy*ta+dy/L*gap
    x2,y2=bx-dx*tb-dx/L*(gap+4), by-dy*tb-dy/L*(gap+4)
    return x1,y1,x2,y2
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
 '<defs><marker id="ah" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">'
 f'<path d="M0,0 L12,6 L0,12 L3,6 z" fill="{col}"/></marker></defs>',
 f'<rect width="{W}" height="{H}" fill="#ffffff"/>']
for a,b in [('SL','MW'),('SL','ID'),('SL','UPB'),('MW','UPB'),('ID','UPB')]:
    x1,y1,x2,y2=edge(a,b)
    svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="4" marker-end="url(#ah)"/>')
for k,(cx,cy,rx,ry,lines) in nodes.items():
    svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#ffffff" stroke="{col}" stroke-width="5"/>')
    n=len(lines); lh=62
    y0=cy-(n-1)*lh/2+18
    for i,t in enumerate(lines):
        svg.append(f'<text x="{cx}" y="{y0+i*lh:.0f}" text-anchor="middle" direction="rtl" font-family="Naskh" font-weight="700" font-size="48" fill="#111">{t}</text>')
svg.append('</svg>')
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:"Naskh";src:url("naskh700.woff2") format("woff2");font-weight:700;}}
html,body{{margin:0;padding:0;background:#fff}}</style></head><body>{''.join(svg)}</body></html>'''
open(out,'w',encoding='utf8').write(html)
