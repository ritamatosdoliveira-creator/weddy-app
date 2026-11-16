# Código recuperado das Cloud Functions de produção (só consulta)

**Origem (código-fonte original, não compilado):** zips de fonte das functions v2 do projeto `weddy-app-bd12f` (bucket `gcf-v2-sources-696758255059-europe-west1`), copiados pela Rita para o computador dela e enviados para análise em 2026-11-02.

| Ficheiro aqui | Zip de origem | updateTime da function | sha256 do `index.js` |
|---|---|---|---|
| `index.js.producao-2026-10-30` | `generateCompareReport` e `analyzeCompareProposal` (zips idênticos, sha256 do zip `80caf12a…`) | 2026-10-30 | `4ca82efd…` |
| `index.js.producao-2026-10-27-contactos` | `sendContactMessage` (sha256 do zip `232d2ef0…`) | 2026-10-27 | `4e5f5b56…` |
| `package.json.producao` | idem | — | — |
| `producao-vs-origin-main.diff` | diff de `origin/main:index.js` para o `index.js` de 2026-10-30 | — | — |

- Em v2 todas as functions partilham o mesmo `index.js`; cada zip é o `index.js` completo à data de cada deploy.
- **Não foram copiados** (de propósito): `.env.weddy-app-bd12f` (contém uma chave da OpenAI em texto simples), `.DS_Store`, `*.bak`/`*.antes-*` (versões antigas) e os scripts administrativos `dar-premium.js`, `quem-comprou-premium-apple.js`, `uso-premium-casamento.js`.
- Isto **não é código a publicar**: é o registo do que está em produção. Não editar; qualquer evolução faz-se no `index.js` da raiz.
