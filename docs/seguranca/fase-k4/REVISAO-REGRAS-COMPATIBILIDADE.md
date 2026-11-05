# Revisão das regras Firestore/Storage — local vs "produção" (só análise; nada implantado)

**Referência usada.** As regras realmente implantadas **não existem como ficheiro no repositório** (`recuperado-producao/` só tem código de Functions; `AUDITORIA-REGRAS.md` já registava que não as conseguiu ler). Usou-se `origin/main` (`firestore.rules` 340 linhas, `storage.rules` 100) como "produção documentada" e o cliente de `origin/main` (v324) como "cliente antigo". **Não está provado que seja o que está implantado** — exportar as regras implantadas é pré-requisito (`PLANO-DEPLOY-EXPLICITO.md` §2). As regras locais (467 e 120 linhas) não foram alteradas pela K.4 nem por esta tarefa. Revisão feita por leitura de código; nenhum teste de regras foi usado como prova de compatibilidade com o cliente antigo.

## 1. O que muda (regra a regra)
| Caminho | Antigo | Novo | Tipo |
|---|---|---|---|
| `weddings` create/update, `json` | livre | string ≤ 900000 | validação |
| `weddings` update, `subscription` | bastava `active == false` (mapa reescrevível) | `active == false` e o diff só pode afetar `active` e `updatedAt` | **restrição** |
| `weddings/*/integrations/*` | donos escrevem | `write: false` | restrição |
| `guests` update anónimo | lista de campos | + `logistics` (chaves fechadas) | alargada (pequena) |
| `memories` create | caminho `memories/{w}/.*`; `exists(casamento)` | 4 segmentos, `[1]==weddingId`, `[2]==token`; **Premium**; recusa se `memoryQuota.full` | **restrição** |
| `memoryQuota/{w}` / `items` | negado | dono lê o contador; escrita negada; `items` negado | nova (leitura) |
| `_incident_log` create | `size ≤ 12` | esquema fechado (14 chaves, limites de tamanho, `before/after` só `guests, todos, keys`) | **restrição** |
| `whatsappConsents` | negado | `get` pelo dono | leitura alargada |
| Storage `memories` create | tamanho, tipo, convidado/QR | + `resource == null` e **Premium** | **restrição** |
| Storage `documents` create/update | dono, <15 MB, pdf/imagem | + **Premium** (leitura e remoção sem Premium) | **restrição** |
| restantes (`guests` casal, `feedback`, `creators`, `userPrefs`, `snapshots`, `activity`, `weddingSites`, `siteSlugs`, `sites/`, `public-sites/`, filas e coleções de servidor) | — | iguais / negado por omissão | sem alteração |
As filas `memoryQuotaCleanupQueue`, `memoryQuotaPending` e `memoryQuotaOrphans` não têm regra → **negadas** a clientes (testado).

## 2. O que pode bloquear clientes antigos (PWA v324 em cache)
| # | Operação do cliente antigo | Condição nova | Efeito visível |
|---|---|---|---|
| A | **Cancelar subscrição** grava `subscription:{active:false, plan:null, startedAt, updatedAt}` (mapa inteiro) | o diff toca em `plan`/ids → falha `hasOnly(['active','updatedAt'])` | `permission-denied`; mostra "não foi possível cancelar"; **falha segura** (a subscrição fica ativa). **Praticamente todas as contas Premium seriam rejeitadas** |
| B | Guardar estado (`json`) | `json` não-string ou > 900000 faz falhar **todas** as gravações desse casamento (também no cliente novo) | perda silenciosa (`.catch` vazio) → medir com `scripts/auditar-dados-para-regras.js` |
| C | `_incident_log.add` `outgoing_write_blocked_*` com estado completo | esquema fechado | só se perde o registo forense (silencioso) |
| D | `memorias.html`/`rsvp.html` antigos, casamento sem Premium | Storage recusa primeiro | foto não chega; mensagem enganadora ("verifica a internet") |
| E | Idem com álbum cheio | Firestore recusa o `memories.add` (o Storage aceitou) | "link inválido" enganador; ficheiro órfão (agora recolhido pela rotina R4) |
| F | Documentos/contratos/lua de mel/PDFs sem Premium | Storage recusa | **registo gravado sem ficheiro** (parece sucesso) |
| G | Comparador, Papelaria sem Premium | idem | mostra erro, sem registo |
| I | Galeria do casal no cliente antigo | `quotaState:'pending'` não filtrado | miniatura vazia/partida |
Compatíveis: `rsvp.html` e `memorias.html` antigos (campos, caminho de 4 segmentos), `site.html`, `integrations` (só leitura), coleções iguais.
**Inverso (mais importante):** o `rsvp.html` **novo** contra as regras Firestore **antigas** falha — envia `logistics` e o `affectedKeys().hasOnly` antigo recusa o `update` inteiro. Logo: **regras Firestore antes do cliente novo**.
Incoerência de documentação: o comentário das regras diz que o cancelar antigo "limpa `plan`" e fica permitido; o código só permite `active` e `updatedAt`.

## 3. Fluxos Premium
- `premiumOn` passa a ser exigido em: `memories` (Firestore e Storage) e `documents` (Storage create/update). Já era exigido em `sites/` e `publicWeddingSites`.
- `active:true` sem `premiumUntil` → **permitido** (vale o `active`) — contas pagas antes dos webhooks novos. Com `startedAt` > 12 meses e sem `premiumUntil`: as regras permitem, o cliente/servidor tratam como caducado (só o backfill fecha a diferença). **Sem `startedAt` e sem `premiumUntil`: permitido para sempre** (o backfill ignora-os; decisão humana). `premiumUntil` de tipo errado → regra nega (falha fechada). `active:false`/ausente → negado.
- **Premium caducado/cancelado:** nega-se criar/substituir ficheiros em `documents/**`, `memories/**` (convidados) e `sites/**`, e criar `memories`. **Continua permitido:** ler/listar/descarregar documentos e fotos, apagar, gravar `json`, convidados e RSVP. Um casal com Premium caducado **não perde a leitura**.
- `PROCEDIMENTO-PUBLICACAO.md` diz que as regras exigem `premiumUntil`: **não corresponde ao código**. O backfill estreita o acesso, não o protege.

## 4. Dependências e ordem
- `memories` create depende de `memoryQuota/{w}.full`, mantido só pelas Functions K.4. Sem elas: não há contador e a regra passa (sem limite de fotos). Com elas e regras antigas: contam e apagam o excesso mas as regras não bloqueiam.
- Storage→Firestore (`firestore.get` nas regras de Storage): `memories` com convidado usa 2 chamadas (limite de 10 por pedido), `documents` 1, `sites` 2. Exige a permissão cruzada do agente de serviço das regras — **confirmar em ambiente real**.
- Webhooks de produção escrevem o mapa `subscription` inteiro sem `premiumUntil`; os novos (esta tarefa) escrevem campos pontilhados e `premiumUntil`.
- **Ordem recomendada:** exportar regras e auditar dados → Functions (lotes 1–4) → **regras Firestore** → **cliente** (com `CACHE_NAME` novo) → **regras Storage** → Functions de quota (staging validado). Os três documentos anteriores discordavam; esta é a que respeita os fluxos reais.
- Ordem errada: cliente antes das regras Firestore → RSVP com logística falha; regras Storage antes do cliente → documentos sem ficheiro e mensagens enganadoras no cliente antigo; regras Firestore antes de o PWA antigo atualizar → cancelar falha (não se resolve só com a ordem).

## 5. Estado
**Seguro tal como está (compatibilidade):** todas as regras sem alteração; `integrations` `write:false`; `guests`/`logistics` com o `rsvp.html` antigo; coerência `storagePath`/`token`; coleções de servidor; a maior parte dos tipos de `_incident_log`; `site.html`.
**Precisa de decisão da proprietária:** (1) Memories e Documentos passam a exigir Premium (casais gratuitos que hoje os usam); (2) aceitar que o cancelar do PWA antigo falha, ou ajustar a regra para o permitir temporariamente; (3) quem são as contas `active:true` sem `startedAt` ou > 12 meses sem `premiumUntil`; (4) aceitar o esquema fechado de `_incident_log`; (5) mensagens enganadoras do `memorias.html` antigo e documentos sem ficheiro (aceitar ou antecipar o cliente novo).
**Precisa de validação em ambiente real:** exportar e comparar as regras implantadas; auditoria de dados (`json`, `premiumUntil`); permissão Storage→Firestore; Eventarc das 5 `memoryQuota*` e a transição para `full=true`; semântica real de `request.time`, `Map.get(k, default)` e `resource == null`; teste manual com PWA antigo em cache (cancelar, RSVP, upload).
