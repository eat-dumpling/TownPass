"""把 items.json 每條規則和官方資料逐條比對，一致的標 status: "verified"。

1. 回收一點通整理檔（data/回收一點通_1031筆.tsv）：品項名稱出現在某幾筆的品名裡，且那幾筆的大類全部和規則一致。
2. 否則看 data.taipei「資源回收分類方式」（web/src/data/categories.json）：品項名稱都列在規則所屬子類的說明欄，且回收一點通沒有相反的說法。
沒對上的保持 unknown，正式版不顯示。用法：python3 scripts/verify_items.py [--write]
"""
import json,re,sys
import os
H=os.path.dirname(os.path.abspath(__file__))+'/..'
items_p=H+'/web/src/data/items.json'; tsv_p=H+'/data/回收一點通_1031筆.tsv'; cat_p=H+'/web/src/data/categories.json'
write='--write' in sys.argv
it=json.load(open(items_p,encoding='utf-8')); cats=json.load(open(cat_p,encoding='utf-8'))
R=[l.rstrip('\n').split('\t') for l in open(tsv_p,encoding='utf-8')]
def cat(r):
    rec=r[1].startswith('可回收'); m=r[2]
    if '廚餘' in r[3]: return 'food'
    if '約定時間' in m: return 'bulky'
    if '一般垃圾' in m: return 'general'
    if '立體類' in m: return 'recycle_3d'
    if '平面類' in m: return 'recycle_flat'
    if '其他類' in m: return 'other' if rec else 'general'
    return '?'
def nm(r):
    note=r[6] if len(r)>6 else ''
    return r[3] if r[3] not in ('無','無none') else re.split('為不可回收|，|：|屬',note)[0]
n1=n2=0
for i in it:
    if i['status']=='conflict': continue
    kws=[k for k in re.split('[、／/（）()，, ]',i['name']['zh']) if len(k)>=2]
    hits=[(n,cat(r)) for n,r in enumerate(R,1) if any(k in nm(r) for k in kws)]
    if hits and {h[1] for h in hits}=={i['category']}:
        i['status']='verified'; i['verified_by']='回收一點通整理檔（data/回收一點通_1031筆.tsv）第 '+'、'.join(str(h[0]) for h in hits[:3])+' 筆，分類一致'; n1+=1; continue
    c=next((c for c in cats if c['id']==i.get('sub')),None)
    if c and kws and (not hits or i['category'] in {h[1] for h in hits}) and all(any(k==e or k in e for e in c['examples']) for k in kws):
        i['status']='verified'; i['verified_by']='臺北市環保局資源回收分類方式（data.taipei）'+c['major']+'・'+c['sub']+' 說明欄'; n2+=1; print('csv',i['id'],kws)
print(n1,n2,sum(x['status']=='verified' for x in it))
if write: open(items_p,'w',encoding='utf-8').write(json.dumps(it,ensure_ascii=False,indent=1)+'\n')
