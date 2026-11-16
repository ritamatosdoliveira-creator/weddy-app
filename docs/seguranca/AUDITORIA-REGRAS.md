# Auditoria das regras Firestore e Storage (local × produção documentada)

Nada foi publicado. A “produção documentada” é o que está no `origin/main` (baseline do repositório). **Não consegui ler as regras realmente implantadas** (precisam do teu login). Para ter a base exata, antes de publicar corre (só leitura):
```
P=weddy-app-bd12f; T=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $T" "https://firebaserules.googleapis.com/v1/projects/$P/releases" | grep -E '"name"|rulesetName'
# para cada rulesetName listado (cloud.firestore e firebase.storage/<bucket>):
curl -s -H "Authorization: Bearer $T" "https://firebaserules.googleapis.com/v1/<rulesetName>" > /tmp/regras-prod.json
```
e compara com `git diff origin/main..HEAD -- firestore.rules storage.rules` (abaixo). (`$T` é um token temporário teu: não o coles em lado nenhum.)

## Alterações face ao baseline (`git diff origin/main..HEAD`)
| # | Regra | Mudança | Quem fica sem acesso | Risco de bloquear legítimos | Dependência Premium / dados antigos |
|---|---|---|---|---|---|
| 1 | `weddings` update/create | `json` tem de ser texto ≤ 900 000 caracteres | quem escrevesse um `json` não-texto ou maior | **Baixo.** Atenção: no *update* o `request.resource.data` inclui o `json` já guardado → se existir algum casamento com `json` **nulo ou não-texto**, TODAS as alterações a esse casamento (até desligar subscrição) seriam negadas. | Campo ausente passa (`'json' in …`). Verificar em produção (script abaixo). |
| 2 | `weddings.subscription` (cliente) | só pode desligar: muda apenas `active` e `updatedAt`, e só se já existia `subscription` | clientes **antigos em cache** que cancelam escrevendo o mapa inteiro (`subscription:{active:false, plan:null,…}`) | **Baixo.** O botão “cancelar” de versões antigas do PWA falha até recarregarem a app (a nova versão usa campos pontilhados). | `premiumUntil` e ids de pagamento deixam de ser reescritos pelo cliente (correção de segurança). |
| 3 | `weddings/{id}/integrations/*` | `write: false` (antes dono podia escrever) | donos | **Nulo se o cliente só lê** (verificado: `index.html` só faz `.get()`; escreve o servidor com Admin SDK). | — |
| 4 | `memories` (Firestore) criação | exige **Premium** do casamento (antes: bastava existir) | convidados de casamentos **sem** Premium (ou com `active` falso) deixam de carregar fotos | **Médio — decisão de produto:** casais gratuitos que já usam Memories perdem o carregamento dos convidados. | `premiumOn`: `subscription.active == true` e, **se existir** `premiumUntil`, `> agora`. Contas antigas sem `premiumUntil` contam pelo `active`. |
| 5 | Storage `memories/…` criação | exige Premium (mesma função) | idem | idem | idem |
| 6 | Storage `documents/{wedding}/…` criar/atualizar | exige dono **e Premium**; ler e apagar continuam sempre permitidos ao dono | donos sem Premium já não carregam documentos novos | **Médio — decisão de produto** (o Comparador exige Premium de qualquer forma). Os ficheiros existentes ficam legíveis. | `premiumOn`. `request.resource.contentType` tem de existir (já era exigido). |
| 7 | Novas coleções `whatsappConsents` (get só dono, resto negado), `whatsappConsentRateLimit`, `notifState`, `weddingStateQuarantine` | só servidor | ninguém legítimo (coleções novas) | Nulo | — |

## Comportamento com dados antigos e campos nulos
- `premiumOn(w)`: usa `'subscription' in w` antes de ler; sem `subscription` → negado (correto). Com `premiumUntil` **ausente** → vale pelo `active`; com `premiumUntil: null` explícito → a comparação `null > timestamp` dá **erro de avaliação** e a regra nega (falha fechada, sem exceção). O backfill (`scripts/backfill-premium-until.js`, não executado) grava Timestamps, nunca `null`; os webhooks gravam Timestamp.
- Pré-existentes e **não alteradas** (o emulador regista-as como avisos): `storage.rules` linha 55 (`s.premiumUntil` quando falta o documento `weddingSites`) e linha 70 (`publicSiteOpen` com documento ausente) → negam por erro, comportamento desejado.
- Um casamento Premium cujo `startedAt` passou os 12 meses mas **sem** `premiumUntil` continua “Premium” para estas regras (o servidor já o trata com a regra dos 12 meses). Só o backfill fecha esta diferença.

## Verificação de dados em produção antes de publicar (só leitura)
`scripts/auditar-dados-para-regras.js` (novo, só lê, imprime contagens e até 5 ids por categoria, nunca conteúdo): conta casamentos com `json` não-texto ou > 900 000, `subscription.active` sem `premiumUntil`, `premiumUntil` não-Timestamp, e casamentos gratuitos com `memories`. Correr no teu computador com o teu login: `GOOGLE_CLOUD_PROJECT=weddy-app-bd12f node scripts/auditar-dados-para-regras.js`.

## Conclusão
Nenhuma regra nova bloqueia funcionalidades **Premium** legítimas. Os pontos que podem surpreender utilizadores legítimos são: (4–6) Memories e Documentos passam a exigir Premium para carregar, e (2) o botão de cancelar de PWA antigo em cache. Os dois primeiros são decisões de produto a confirmar por ti; o terceiro resolve-se com a publicação da app (nova versão do `sw.js`).
