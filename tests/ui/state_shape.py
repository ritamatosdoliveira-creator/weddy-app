"""Paridade cliente/servidor: STATE_SHAPE (index.js, validador do servidor) tem de refletir seedData() da app.
Se alguém acrescentar um campo ao estado da app, este teste falha até o servidor ser atualizado."""
from common import *
newpage = functools.partial(newpage, mode='bare')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await newpage(b)
        client = await pg.evaluate("""()=>{ const s=window.__a4.seed(); const K=v=>v===null?'null':Array.isArray(v)?'array':typeof v; const o={}; Object.keys(s).forEach(k=>{ const v=s[k]; o[k]=K(v); if(K(v)==='object'){ o[k]={}; Object.keys(v).forEach(k2=>{ const w=v[k2]; o[k][k2]=K(w); if(K(w)==='object'){ o[k][k2]={}; Object.keys(w).forEach(k3=>o[k][k2][k3]=K(w[k3])); } }); } }); return o; }""")
        src = (ROOT / 'index.js').read_text(encoding='utf-8')
        m = re.search(r"const STATE_SHAPE = (\{.*?\});\n", src)
        ok(bool(m), 'STATE_SHAPE encontrado em index.js')
        server = json.loads(m.group(1))
        def diff(a, b, pth=''):
            out = []
            for k in set(a) | set(b):
                if k not in a: out.append(f'só no cliente: {pth}{k}')
                elif k not in b: out.append(f'só no servidor: {pth}{k}')
                elif isinstance(a[k], dict) and isinstance(b[k], dict): out += diff(a[k], b[k], pth + k + '.')
                elif a[k] != b[k]: out.append(f'{pth}{k}: cliente={a[k]} servidor={b[k]}')
            return out
        d = diff(client, server)
        ok(not d, f'STATE_SHAPE do servidor == seedData() do cliente {d[:5]}')
        # Todo o campo que o saneador do cliente repara é também sinalizado pelo servidor (tipos errados).
        res = await pg.evaluate("""()=>{ const a=window.__a4; const out=[]; const s0=a.seed(); const keys=Object.keys(s0).filter(k=>s0[k]!==null && typeof s0[k]!=='number' && typeof s0[k]!=='boolean');
          keys.forEach(k=>{ [null,'texto',5,true].forEach(bad=>{ const s=a.seed(); s[k]=bad; const r=a.san(JSON.parse(JSON.stringify(s))); out.push({k, bad:String(bad), repaired:r.repairs.length>0, json:JSON.stringify(s)}); }); }); return out; }""")
        import subprocess
        node_check = r"""
          const fns=require(process.argv[1]); const T=fns._test; const cases=JSON.parse(require('fs').readFileSync(0,'utf8'));
          console.log(JSON.stringify(cases.map(c=>({k:c.k,bad:c.bad,sev:T.validateWeddingState(c.json).severity}))));"""
        env = dict(__import__('os').environ, WEDDY_EXPOSE_INTERNALS_FOR_TESTS='1', GCLOUD_PROJECT='demo-weddy',
                   NODE_PATH=str(ROOT / 'tests' / 'node_modules'))
        out = subprocess.run(['node', '-e', node_check, str(ROOT / 'index.js')], input=json.dumps(res), capture_output=True, text=True, env=env)
        sev = json.loads(out.stdout.strip().splitlines()[-1]) if out.stdout.strip() else []
        miss = [f"{r['k']}={r['bad']}" for r, s in zip(res, sev) if r['repaired'] and s['sev'] != 'repairable']
        ok(len(sev) == len(res) and not miss, f'{len(res)} corrupções: tudo o que o cliente repara, o servidor sinaliza {miss[:6]}')
        await b.close()
    summary()
asyncio.run(main())
