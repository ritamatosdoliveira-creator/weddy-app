# Comparador, Secret Manager e packaging — preparação local

Estado: **só local** (branch `v325-import-guests`). Nada foi publicado, enviado (push), fundido, nem foram criados ou alterados segredos ou dados de produção.

## 1. Comparador — testes (`tests/compare/compare.test.js`, 140 verificações)
Storage e OpenAI são simulados; emulador Firestore; nenhuma chave real. Cobrem as duas funções:
- Autenticação: sem sessão, email não verificado, `email_verified` como texto → recusados.
- Posse: casamento alheio e casamento inexistente dão a **mesma** resposta (não revela que casamentos existem); `weddingId` inválido; conta sem casamento.
- Premium: sem subscrição, `active:false`, `active:"true"` (texto), expirada (13 meses), `startedAt` ilegível → recusados, **sem** chamar a IA e **sem** gastar quota. Conta antiga sem `startedAt` continua válida (regra de produção).
- Isolamento: ficheiros de outro casamento, `..`, fora de `documents/`, não registados na proposta, registados noutra proposta, prefixo parecido (`W10`).
- Ficheiros: tipo pelos bytes (texto com extensão .pdf, SVG, HEIC recusados), vazio, >15 MB, total >25 MB, ausente no Storage; PDF >30 páginas, `/Count` forjado, PDF com palavra-passe, PDF ilegível, soma >60 páginas. Nenhum gasta quota.
- Quotas: 10 análises/dia e 20 relatórios/dia por casamento, contadores independentes, reposição noutro dia, **concorrência** (16 pedidos → exatamente 10; 24 → exatamente 20), devolução da quota em falha.
- Falhas da OpenAI (HTTP 500/401/429, JSON inválido, resposta vazia, estrutura errada, erro de rede com “segredo” na mensagem, sem chave, sem resposta até ao limite de tempo): erro genérico `internal`/`deadline-exceeded`/`failed-precondition`, quota devolvida, **sem** corpo da resposta, chave, ids, emails ou caminhos na mensagem.
- Dados do cliente nunca são fonte de verdade: no relatório, `proposals`, `fields`, `priceFacts` e `report` enviados no pedido são ignorados; só entram campos **confirmados** guardados no Firestore (rascunhos da IA ficam de fora); o pedido à IA não leva id do casamento nem email; `store:false`.
- Texto não confiável: instrução dentro de um documento/campo não chega ao resultado; saída da IA filtrada (“o melhor”, recomendações, números inventados, afirmações sem base, prioridades não escolhidas, perguntas a fornecedores inexistentes); campos extra descartados; valores truncados; explícito sem citação é rebaixado a inferido. O cliente escapa (`escapeHTML`) valores e citações antes de os mostrar (verificado em `app/index.html`).

**Resultado: 0 falhas.** Não foi encontrado nenhum defeito no código do Comparador; por isso **não alterei o seu comportamento**.

## 2. Problemas encontrados
| # | Gravidade | Problema | Estado |
|---|---|---|---|
| 1 | **Alta** (corrigida no código; falta ação tua) | A `OPENAI_API_KEY` estava em texto simples no `.env.weddy-app-bd12f`. Pelo código do firebase-tools (`deploy/functions/prepare.js`), **todo** o `.env` é publicado como variáveis de ambiente de **todas** as functions (visível na consola) e o ficheiro ia também no zip de código. | Código passou a `defineSecret`. Falta: criar o segredo, rodar a chave, tirar a linha do `.env` (secção 4). |
| 2 | Média (bloqueio de deploy) | Se o segredo não existir, o deploy das 4 funções falha (o firebase-tools valida os segredos antes — verificado no código). Se `OPENAI_API_KEY` continuar também no `.env`, o mesmo nome ficaria como variável normal **e** como segredo, o que o Cloud Run costuma recusar (não verificado contra o serviço real). | Intencional; instruções na secção 4. |
| 3 | Média | Pacote de deploy real (pasta de functions da Rita) incluía scripts administrativos (`dar-premium.js`, `quem-comprou-premium-apple.js`, `uso-premium-casamento.js`), `*.bak`/`*.antes-*` e `.env`. O repositório não tinha `firebase.json`, `package.json` nem `.gitignore`. | `firebase.json` com `functions.ignore` explícito, `package.json`, `.gitignore`, `.firebaserc` (secção 5), com teste. |
| 4 | Baixa | Os zips que já estão em `~/weddy-recuperacao` e as fontes antigas no bucket `gcf-v2-sources-…` contêm o `.env` com a chave antiga. | Ficam inofensivos após revogar a chave; apaga os zips locais. |
| 5 | Baixa | Sem App Check nem limite por utilizador; o custo está limitado só pelas quotas por casamento (10 análises + 20 relatórios/dia, + chat/mesas). | Informativo; proposta futura. |
| 6 | Baixa | Contas Premium sem `startedAt` valem sem fim (regra decidida por ti). | Informativo. |
| 7 | Info | As chaves web `AIza…` em `app/index.html` etc. são públicas por desenho do Firebase; convém restringi-las por domínio (referrer) na Google Cloud Console. | Ação opcional tua. |

## 3. Secret Manager — estado
- `OPENAI_API_KEY = defineSecret(...)`; nenhuma variável local, `defineString` ou `process.env` em produção (teste estático + em execução).
- Declaram `secrets:[OPENAI_API_KEY]` exatamente estas 4 funções (e mais nenhuma): `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport` — confirmado também pelo *endpoint* que o Firebase lerá (`secretEnvironmentVariables`).
- Não foi criado, alterado nem lido nenhum segredo.

## 4. Instruções para a Rita (rotação da chave) — nenhum passo mostra o valor
Cuidado com a ordem: as 4 funções em produção ainda usam a chave do `.env`. Se revogas a chave **antes** do deploy novo, a IA (chat, mesas, Comparador) fica sem funcionar até o deploy acabar. Se isso não for problema, segue 1→4 como pediste; se preferires zero indisponibilidade, faz 2→3→(deploy)→1.
1. **Revogar a chave antiga**: platform.openai.com → API keys → clica no lixo da chave antiga → confirma. Em *Usage* confirma que não há consumo estranho.
2. **Criar a chave nova**: *Create new secret key*, com nome (ex.: `weddy-prod-2026-11`). Copia-a **uma vez** (não a colas em chats, ficheiros nem emails).
3. **Configurar no Firebase de produção** (no terminal, na pasta do projeto):
   `firebase functions:secrets:set OPENAI_API_KEY --project weddy-app-bd12f`
   O comando pede o valor com a escrita oculta: cola a chave nova e Enter. Depois **remove a linha** do `.env`:
   `grep -v '^OPENAI_API_KEY=' .env.weddy-app-bd12f > /tmp/env.novo && mv /tmp/env.novo .env.weddy-app-bd12f`
   e confirma que já não existe (mostra só a contagem): `grep -c '^OPENAI_API_KEY=' .env.weddy-app-bd12f` → deve dar `0`.
   Só depois, o deploy das 4 funções (autorizado por ti): `firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport --project weddy-app-bd12f`
4. **Confirmar sem revelar o valor**:
   - Existe e tem versão ativa (só metadados): `gcloud secrets versions list OPENAI_API_KEY --project weddy-app-bd12f`
   - Cada função aponta para o segredo (mostra nome e versão, nunca o valor): `gcloud functions describe analyzeCompareProposal --gen2 --region europe-west1 --project weddy-app-bd12f --format="value(serviceConfig.secretEnvironmentVariables)"` (repete para as outras três).
   - Já não há chave em texto simples (tem de dar `0`): `gcloud functions describe analyzeCompareProposal --gen2 --region europe-west1 --project weddy-app-bd12f --format="value(serviceConfig.environmentVariables)" | grep -c OPENAI_API_KEY`
   - Uso real: faz uma análise de teste na app e confirma que responde (e na OpenAI → *Usage* aparece consumo da chave nova).
   - **Não uses** `firebase functions:secrets:get/access`: esses comandos imprimem o valor.
5. Apaga os zips antigos: `rm -rf ~/weddy-recuperacao` (contêm o `.env` antigo).

## 5. Packaging proposto
Estrutura real: o repositório é o site (GitHub Pages, `CNAME www.weddy.pt`) **e** guarda `index.js` (todas as functions v2 num ficheiro) na raiz; as regras estão em `firestore.rules` e `storage.rules`; **não há Firebase Hosting**; scripts administrativos em `scripts/` (só computador da Rita); código recuperado em `recuperado-producao/`.
- `package.json` (novo): `main: index.js`, Node 22, dependências de produção (`firebase-admin`, `firebase-functions`, `nodemailer`, `stripe`).
- `firebase.json` (novo): `functions` a partir da raiz com `ignore` explícito (`.env*`, `*.bak`, `*.antes-*`, backups, `scripts/`, os 3 scripts administrativos, credenciais, `tests/`, `docs/`, `recuperado-producao/`, todo o site estático e as regras); `firestore` e `storage` apontam para as regras; **sem** `hosting`.
- `.firebaserc` (novo): aliases `prod` (`weddy-app-bd12f`) e `teste` (`weddy-premium-teste`), **sem** `default`: todo o comando exige `--project`/`use`, para nunca ir parar ao projeto errado.
- `.gitignore` (novo): `.env*`, chaves, backups, zips, `node_modules`.
- Como `.env` não vai no zip, os parâmetros não secretos (`SMTP_HOST`, `SMTP_FROM`, …) continuam a funcionar: o Firebase lê o `.env.<projeto>` do disco no deploy e injeta-os como variáveis de ambiente (ver `prepare.js`).
- **Teste local do pacote** (`tests/packaging`): corre o empacotador do próprio firebase-tools sobre uma cópia do repositório com 26 ficheiros-isco (`.env`, `.env.weddy-app-bd12f`, `*.bak`, `*.antes-*`, scripts administrativos, chaves `.pem/.p8`, backups, zip, etc.) e confirma que o pacote final tem **exatamente `index.js` e `package.json`**, sem nenhum padrão de segredo.
- Se o deploy continuar a sair de uma pasta `functions/` separada no teu computador, copia para lá os mesmos `package.json` e `functions.ignore`.

## 6. Pendente
`sendRsvpReminders` e `whatsappWebhook`: continuam por recuperar e **não foram tocados**. Quando tiveres os zips, compara-os com `index.js` antes de qualquer alteração (`recuperado-producao/README.md` explica como).
