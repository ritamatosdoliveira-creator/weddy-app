# D — GitHub Pages: situação e decisão pendente

**Nada foi alterado** nas definições do repositório nem no GitHub Pages. Nenhum workflow foi ativado. Nenhum push.

## 1. Como funciona hoje

Verificado só com informação pública (o `gh` não tem sessão iniciada e a API de Pages exige autenticação):
- Repositório `weddy-app` é **público** (`visibility: public`, `has_pages: true`).
- O `main` não tem `.github/workflows/` → a publicação é **«Deploy from a branch»** (`main`, raiz).
- `https://www.weddy.pt/CNAME` → 200; `/index.js` e `/firestore.rules` → 404 (o «Lote 11» tirou-os da raiz); `/app/invedit.js` → 200.
- Consequência: **tudo o que estiver na raiz do `main` é servido em www.weddy.pt**.

## 2. Bloqueio para o merge no `main`

Esta branch volta a pôr na raiz `index.js`, `firestore.rules`, `storage.rules`, `docs/`, `tests/`, `scripts/`, `recuperado-producao/`, `package.json`, `firebase.json`, `.firebaserc`.

**Se esta branch entrar no `main` com a publicação atual, todos esses ficheiros passam a ser servidos em www.weddy.pt.** O código já é visível no GitHub (repositório público, e a branch do servidor já está no `origin`), mas servi-lo no domínio aumenta a exposição (indexação, `weddy.pt/docs/seguranca/...`, `weddy.pt/recuperado-producao/...`).

→ **Não fazer merge no `main` antes de decidir a publicação.**

## 3. Como funcionaria com `build-public.js` + `pages.yml`

- `scripts/build-public.js` copia para `_site/` **só** uma allowlist explícita: ficheiros da raiz listados um a um; `feira/` (.png), `inicio/` (.jpg, .mp4), `fonts/` (.woff, .txt); e, se `convite.html` existir, `convite.html`, `weddyinvite*.js` e `convites8/` recursivo (.js, .jpg, .png, .svg, .woff2, .txt). Falha se faltar algum ficheiro listado. Não faz rede nem publica.
- `.github/workflows/pages.yml` (push no `main` ou manual): `node scripts/build-public.js _site` → `node tests/k4/public-artifact.test.js _site` → `upload-pages-artifact` → `deploy-pages`.
- O teste `tests/k4/public-artifact.test.js` falha se: entrar algo privado (`docs/`, `tests/`, `scripts/`, `.md`, `.rules`, `index.js`, `package*.json`, segredos…); houver ficheiro/pasta novo na raiz sem classificação público/privado; uma página pública referir um ficheiro local ausente; houver padrões de segredo.
- Ficheiros novos: **não são publicados** até serem acrescentados à allowlist (falha segura: pode partir uma página, nunca expõe código). O teste de classificação obriga a decidir.

### Problemas encontrados na auditoria (corrigidos nesta branch)
A allowlist original deixava de fora 8 ficheiros que o `main` usa: `app/invedit.js` e 7 `.svg` de `convites8/img/`. Publicar assim partia o editor e os modelos de convite. Corrigido em `scripts/build-public.js`. Verificação: todos os ficheiros rastreados que não são privados estão agora na allowlist (209 → 217 ficheiros).

### Limitação do teste
A verificação de referências só lê `href`/`src` em `.html`; referências feitas em JavaScript (ex.: SVG carregados por `m-romantico.js`) não são apanhadas. Por isso, a validação recomendada inclui a comparação abaixo.

## 4. Alterações necessárias nas definições (decisão da proprietária)

1. GitHub → Settings → Pages → *Build and deployment* → *Source*: **GitHub Actions** (em vez de *Deploy from a branch*).
2. Confirmar que o domínio personalizado `www.weddy.pt` se mantém (o `CNAME` vai no artefacto) e que *Enforce HTTPS* continua ativo.
3. Ambiente `github-pages`: permitir deploy a partir de `main`.

Ordem segura: (a) mudar a origem para Actions **antes** do merge; (b) fazer merge do PR; (c) confirmar a execução do workflow e o site. Enquanto a origem for «branch», o workflow, se existir no `main`, falha no passo `deploy-pages` (não publica nada, mas fica vermelho).

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Merge no `main` com publicação por branch expõe ficheiros internos | Não fazer merge antes do passo 4 |
| Ficheiro público novo esquecido na allowlist → página partida | Teste de classificação + comparação abaixo antes de cada PR |
| Workflow falha → site não atualiza (o anterior mantém-se) | Falha segura; corrigir e voltar a correr |
| Ações de terceiros (`actions/*@v4/v3`) | São as oficiais do GitHub; fixar por SHA é uma melhoria possível |
| Allowlist inclui páginas que já não são usadas | Rever a lista com a proprietária |

## 6. Como validar a lista de ficheiros públicos (local, sem publicar)

```bash
node scripts/build-public.js /tmp/site-teste
node tests/k4/public-artifact.test.js /tmp/site-teste
# Ficheiros rastreados que NÃO seriam publicados (deve listar só ficheiros privados):
node -e "const B=require('./scripts/build-public.js');const p=new Set(B.listPublic());require('child_process').execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(f=>f&&!p.has(f)).forEach(f=>console.log(f))"
```

## 7. Como reverter

- Settings → Pages → Source: voltar a **Deploy from a branch** (`main`, `/ (root)`).
- **Atenção:** se nessa altura a raiz do `main` já tiver os ficheiros do servidor, eles passam a ser servidos. Reverter com segurança implica também voltar a retirá-los da raiz (como o «Lote 11») ou reverter o merge no `main` através de um PR de *revert*.
- O workflow pode ser desativado em Actions → «Publicar site (allowlist)» → *Disable workflow*.

## 8. Alternativa (se não se quiser mudar a publicação)

Manter o `main` só com o site e o backend numa branch/repositório próprio (situação atual). Custa manter duas linhas em paralelo — que é precisamente a divergência que esta integração resolve.
