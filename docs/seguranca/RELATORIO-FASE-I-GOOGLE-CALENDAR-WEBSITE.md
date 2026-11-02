# Relatório — Fase I: Google Calendar e Wedding Website

Branch `v325-import-guests`, commit inicial `ece8dff`. Tudo local: **sem push, merge, deploy, publicação, contas Google reais, DNS ou domínios**. Nenhum segredo criado, alterado ou rodado; `OPENAI_API_KEY` continua a ser `defineSecret`.

## 1. Arquitetura (o que já existia e foi auditado)
**Google Calendar** (`index.js`, Cloud Functions v2, região europe-west1; sem dependências novas, `fetch` nativo)
- `googleCalendarStartOAuth` (callable) → cria `oauthStates/{state}` (uid + weddingId do servidor) e devolve o URL do Google.
- `googleCalendarOAuthCallback` (HTTP) → valida o state (uso único, TTL 10 min), troca o code, **não liga nada** (ver §3, H-I-1) e redireciona para a app.
- `googleCalendarFinalizeOAuth` (callable, novo) → liga a conta à sessão que iniciou o fluxo.
- `googleCalendarListCalendars`, `…ConnectCalendar` (escolhe calendário + 1.ª sync), `…Sync`, `…ListEvents/CreateEvent/DeleteEvent` (agenda dentro da Weddy), `…Disconnect`.
- Tokens: o refresh token vive cifrado (AES-256-GCM, `GOOGLE_TOKEN_ENCRYPTION_KEY`) em `weddings/{id}/privateIntegrations/googleCalendar` (sem leitura por clientes — regras por omissão = negado). O estado público (`integrations/googleCalendar`, só leitura para os donos) não tem tokens. O access token nunca é guardado.
- **Direção: Weddy → Google (unidirecional).** A Weddy é a fonte de verdade; nada é lido do Google para a Weddy. Eventos: programa do dia (com hora), prazo RSVP, pagamentos por pagar, visitas, ideias da lua de mel (informativos). IDs de evento determinísticos (`evt`+sha256(weddingId:itemId)) + mapeamentos por item + hash de conteúdo ⇒ sincronizações repetidas não duplicam nem chamam a API sem necessidade.
- Sincronização **manual** (botão) e um disparo diferido de 3 s no cliente; **não há tarefa agendada** de Calendar no servidor (nada fica a correr após desligar).

**Wedding Website** (`index.js` + `weddysite.js` + `site.html`)
- Rascunho: `saveWeddingSiteDraft` (Premium, sanitização por lista branca, ≤80 KB, rate limit). Slug: `checkWeddingSiteSlug` (formato, reservados, unicidade via `siteSlugs`, sem revelar o dono). Publicação: `publishWeddingSite` (Premium; nomes/data/programa vêm SEMPRE do casamento no servidor; só momentos «Mostrar aos convidados»; fotos copiadas para `public-sites/{slug}/` sem token). `unpublishWeddingSite` (sem Premium, nunca apaga). Ciclo de vida: `syncWeddingSiteLifecycle` (hora a hora) + `refreshWeddingSite` ao abrir o editor: Premium terminado ⇒ site **suspenso** (cópia pública sem snapshot, tokens das fotos rodados), **nada apagado**; `reactivateWeddingSite` repõe a versão que estava publicada.
- Página pública `site.html` lê `publicWeddingSites/{slug}` (regra: só `published` e `validUntil > now`; sem listagem). **noindex por omissão**; indexável só com opt-in.
- **RSVP**: o site não tem sistema próprio. O botão leva a `https://www.weddy.pt/rsvp.html?g=<token individual>` (token validado `[A-Za-z0-9_-]{8,64}`); sem token há um campo para colar o convite individual. Sem conta, sem instalação, sem lista nem pesquisa de convidados; individual/familiar, duplicados e tokens continuam a ser os do fluxo RSVP existente (Fases B.1/B.2/C).

## 2. APIs, scopes, custos, configuração externa (nada executado)
| Item | Detalhe |
|---|---|
| API | Google Calendar API (a ativar no projeto Google Cloud que aloja o OAuth; hoje o redirect por omissão aponta ao projeto de **teste** `weddy-premium-teste`) |
| Scopes | `calendar.events` + `calendar.calendarlist.readonly` (mínimos; não pede e-mail, contactos, Drive nem `calendar` total). A conta ligada é identificada pelo calendário principal (id = e-mail), sem scope extra |
| Redirect URI | `GOOGLE_CALENDAR_REDIRECT_URI` (defineString). Em produção tem de ser o URL da função em produção e **igual** ao URI autorizado no Google Cloud Console |
| Secrets | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` (já definidos como `defineSecret`; **não** criados/alterados nesta fase) |
| Custos/quotas | A API do Google Calendar é gratuita (quota por projeto/utilizador; 429/5xx tratados com recuo exponencial). Custos de Cloud Functions/Firestore dentro do uso normal; nenhum serviço pago novo |
| Verificação Google | `calendar.events` é scope **sensível**: para uso fora de «Testing» o Google exige verificação da app OAuth (política de privacidade, domínio, vídeo de demonstração) — pode demorar semanas. **Risco de calendário de lançamento** |
| Pós-configuração | ligar com conta de teste → escolher calendário → sync → alterar/apagar na Weddy → sync → desligar → confirmar revogação em myaccount.google.com |

## 3. Problemas encontrados e corrigidos
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| I-1 | **P1** | **Login-CSRF no OAuth**: o `state` provava que o fluxo foi iniciado por alguém com sessão, não que quem consentiu no Google fosse o mesmo browser/pessoa. Um atacante podia iniciar o fluxo no seu casamento e levar a vítima a autorizar; a Weddy do atacante ficava com escrita no calendário da vítima. | O callback guarda os tokens (cifrados) em espera no state e redireciona com um segredo só conhecido do browser que voltou do Google; `googleCalendarFinalizeOAuth` exige o **mesmo uid** + o segredo (comparação em tempo constante), Premium, ≤10 min, uso único; uma tentativa falhada queima o state. O cliente chama-o ao regressar. |
| I-2 | P1 | Com Premium terminado a página do Google Calendar mostrava só a venda ⇒ quem tinha ligação **não conseguia desligá-la** pela app (o servidor permite). | Vista «Premium terminado»: mostra conta e calendário, explica que não há novas sincronizações nem se apaga nada, e deixa **Desligar**. Sem ligação ⇒ venda. |
| I-3 | P2 | O e-mail da conta Google nunca era obtido (pedia `/userinfo`, que exige o scope de e-mail que — bem — não pedimos). | Passa a usar o calendário principal (`calendarList`, já coberto); mostrado na UI. |
| I-4 | P2 | Falhas parciais da sincronização (ex.: 500 num evento) apareciam como «success». | Estado `partial` + contagem; mensagem na UI sem códigos internos. |
| I-5 | P2 | `oauthStates` nunca eram limpos. | Limpeza diária (>24 h) na tarefa `cleanupActivityLog` existente. |
| I-6 | P2 (justificado) | Premium terminado e site **nunca publicado**: o rascunho fica guardado (nada se apaga) mas a UI mostra a venda em vez de o consultar. | Mantido: o rascunho é reposto ao renovar; um site publicado/suspenso já mostra o aviso «Não apagámos nada». Consulta do rascunho sem Premium fica como melhoria futura. |

## 4. Comportamento documentado
- **Desligar**: revoga o refresh token (falha de rede não bloqueia), apaga credenciais e mapeamentos, estado `DISCONNECTED`. **Não apaga** eventos já criados no Google nem dados da Weddy. Eventos já criados deixam de ser atualizados.
- **Premium terminado** (Calendar): ligação mantém-se só para consulta/desligar; `start/list/connect/sync/events/create/delete/finalize` são recusados no servidor (`permission-denied`); desligar é permitido. Eventos no Google e dados da Weddy preservados.
- **Edição direta no Google**: a Weddy não lê o Google. Um evento editado no Google só volta ao valor da Weddy quando esse item muda na Weddy (hash); apagado no Google é recriado quando o item muda. Não há deteção de conflitos porque não há sincronização bidirecional; **não foi implementada** (risco de conflitos/ciclos sem benefício claro).
- **Website expirado**: suspenso, não apagado; reativação ao renovar; despublicar sempre permitido.
- **Domínio personalizado**: não existe suporte no código; não tocado.

## 5. Segurança e privacidade — resultados
- Isolamento: o casamento é sempre resolvido no servidor pelo e-mail/uid autenticado; `weddingId` no pedido é ignorado (testado A vs B). Sem sessão ⇒ `unauthenticated`; e-mail não verificado e `email_verified:"true"` (string) recusados.
- Tokens: cifrados em repouso; nunca em URL, `localStorage`, logs ou documentos públicos (verificado nos logs do teste).
- Site público: snapshot sem convidados, contactos, orçamento, momentos privados, e-mails/UIDs (teste de padrões). Fotos de outro casamento recusadas. Renderizador escapa HTML e recusa `javascript:`/`data:`.
- Regras: nenhuma regra alterada nesta fase (Firestore/Storage já corretas; agora cobertas por 38 verificações novas).

## 6. Testes (todos locais; Google e Storage SIMULADOS)
| Suite | Tipo | Resultado |
|---|---|---|
| `gcal` | emulador + Google simulado (mock) | 145 verificações |
| `site` | emulador + Storage simulado | 74 |
| `rules-site` | regras reais no emulador | 38 |
| `ui-gcal-lapsed` | UI Playwright, 390/768/1360, PT/EN | 69 |
| `ui-site` | UI + renderizador, 390/768/1360, PT/EN | 90 |
Suite completa: ver resumo executivo (resultado final).

**NÃO validado (exige credenciais/serviços externos):** troca real de code por tokens, refresh/revogação reais, criação real de eventos no Google, quotas reais, verificação da app OAuth, publicação real do site e leitura pública em produção, upload real ao Storage de produção, regresso do navegador ao `?googleCalendar=pending` (o fluxo do cliente foi revisto no código, não executado de ponta a ponta com o Google).

## 7. Riscos de publicação
1. **Cliente e Functions têm de ir juntos**: o novo fluxo OAuth (`pending` + `googleCalendarFinalizeOAuth`) exige as duas peças; com a app antiga e as Functions novas a ligação não conclui (e vice-versa).
2. `GOOGLE_CALENDAR_REDIRECT_URI` por omissão aponta ao projeto de teste — confirmar o valor em produção antes de ligar.
3. Verificação OAuth do Google (scope sensível) pode atrasar o lançamento do Calendar.
4. A tarefa `cleanupActivityLog` passa a apagar `oauthStates` antigos (pequeno efeito colateral novo).
