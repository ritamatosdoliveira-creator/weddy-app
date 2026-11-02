import asyncio, json
exec(open('/tmp/sx/a4/t4.py').read().split("BAD=[")[0])
BAD=[None,'texto',5,True,[],{},[None,1,'a'],{'a':1}]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await newpage(b)
        paths=await pg.evaluate("""()=>{ const s=window.__a4.seed(); const out=[]; Object.keys(s).forEach(k=>{ const v=s[k]; if(v && typeof v==='object' && !Array.isArray(v)) Object.keys(v).forEach(k2=>out.push([k,k2])); }); return out; }""")
        fails=[]; n=0
        for k,k2 in paths:
            for v in BAD:
                res=await pg.evaluate("""([k,k2,v])=>{ const a=window.__a4; const s=a.seed(); s[k][k2]=v; let out; try{ out=a.san(JSON.parse(JSON.stringify(s))); }catch(e){ return {thrown:String(e)}; }
                  a.state=out.state; try{ a.render(); }catch(e){ return {renderThrown:String(e)}; }
                  const body=document.getElementById('app-body'); return { viewerr:body.querySelectorAll('[data-viewerr]').length, kinds:Object.keys(a.errs()) }; }""",[k,k2,v]); n+=1
                if 'thrown' in res or 'renderThrown' in res or res.get('viewerr',0)>0: fails.append((k+'.'+k2,json.dumps(v),res.get('kinds') or res))
        print(len(paths),'caminhos',n,'casos; falhas:',len(fails))
        seen=set()
        for f in fails:
            if f[0] not in seen: seen.add(f[0]); print(f)
        await b.close()
asyncio.run(main())
