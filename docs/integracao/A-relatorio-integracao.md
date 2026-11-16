# A — Relatório de integração (app + servidor)

Data: 2026-11-16 · Branch: `integracao/app-servidor` (local, **sem push**) · Sem deploy · `main` intacta.

## 1. Commits de origem (confirmados depois de `git fetch --all --prune`)

| Referência | Análise preliminar | Confirmado | Nota |
|---|---|---|---|
| `origin/main` | `82df2c8` | **`59a8399`** | +2 commits (PR #79 «Respostas dos convidados: ações em várias linhas»; 5 linhas em `app/index.html` e `app/sw.js`). Diferença não significativa. |
| `feat/convites-envio-backend` (local = origin) | `30111d7` | **`30111d7`** | Igual. |
| Base comum | `b9d2fd2` | **`b9d2fd2`** | Igual. |

Commits exclusivos: 154 no `main`, 78 no servidor (o LEIAME ainda diz 67/60 — está desatualizado).

Estado inicial do repositório (antes de qualquer operação):
- Repositório principal: `~/weddy-producao/web` (branch atual `fix-header-ios`, limpa — **não** está em `main`, ao contrário do que o LEIAME indica).
- `~/weddy-producao/servidor` é um **worktree** do mesmo repositório, branch `feat/convites-envio-backend`, limpa exceto um ficheiro não rastreado: `package-lock.json` (não tocado).
- 14 worktrees adicionais em `/private/tmp/.../scratchpad/wt-*` (sessões anteriores), todos sem alterações; alguns marcados `prunable`. Nenhum foi alterado nem removido.
- Sem stashes.

## 2. Estratégia

1. Worktree novo, isolado: `git worktree add -b integracao/app-servidor <scratchpad>/integracao origin/main` (não mexe em `web/` nem em `servidor/`). Upstream removido (`git branch --unset-upstream`) para evitar qualquer push acidental para `main`.
2. `git merge --no-ff --no-commit origin/feat/convites-envio-backend`.
3. Resolução manual de cada conflito e revisão dos ficheiros fundidos automaticamente que os dois lados alteraram.
4. Commit de merge local `e9a5aae` (pais: `59a8399` e `30111d7`).

## 3. Ficheiros alterados nos dois lados

| Ficheiro | Tipo | Resolução |
|---|---|---|
| `app/index.html` | conflito (36 blocos) | Manual — ver §4 |
| `app/sw.js` | conflito | Lista de cache do `main` (inclui `/weddyinvite.js`), nova cache `weddy-v380-integracao`; o `notificationclick` já era igual nos dois lados |
| `rsvp.html` | conflito (1 bloco) | O `main` já continha **todo** o trabalho do servidor + 4 correções próprias (campos de data no iPhone, link «weddy» no rodapé, mensagem `sendErrorRejected`, ordenação do programa depois da meia-noite). Resultado = `main`, verificado com diff vazio |
| `demo-app.html` | fusão automática | `main` + mudança RGPD do servidor (fontes alojadas em `fonts/` em vez de Google Fonts). Ficheiros de fonte confirmados no repositório |
| `memorias.html` | fusão automática | Resultado = `main` (que já tinha o trabalho do servidor) |
| `promo-video.html` | fusão automática | Igual nos dois lados |
| `index.js`, `firestore.rules`, `storage.rules` | modificar/apagar | Versão do servidor. O `main` apagou-os (commit `00f97d3`, «Lote 11») **sem os ter alterado** desde a base — só para os tirar do site público. Nenhuma alteração do `main` se perde |

## 4. `app/index.html` — decisão

O merge automático é perigoso neste ficheiro: o `main` já portou as fases A–I do servidor nos «Lotes 1–14» (6/11), muitas vezes **redesenhadas** (importador de convidados, notificações sem email, modos do AI Seating, campos de dinheiro com vírgula no Android). O git voltava a introduzir versões antigas do servidor em zonas que não colidiam (ex.: CSS `.seat-tag` antigo que se sobrepunha ao design atual).

Por isso: **partiu-se da versão do `main`** e reaplicaram-se, uma a uma, as alterações do servidor que lá não existiam. O método foi verificável: para cada linha acrescentada pelo servidor (base→servidor) ausente no `main`, identificou-se o commit de origem (`git blame`).

Reaplicado (do servidor):
- **K.2** (`ea85a2e`) — `incidentAdd()`/`incidentSanitize()`: o `_incident_log` deixa de gravar tokens completos ou cópias do estado, limita tamanhos e acrescenta `expireAt` (+90 dias). As 6 escritas do `main` em `_incident_log` passam por `incidentAdd`. **Necessário**: as novas regras recusam campos fora da lista.
- **K.3-A** (`11424e5`) — `GuestCommsService._waApiEnabled`, `refreshWhatsappApiStatus()`, `whatsappApiVisible()`; o envio pela API do WhatsApp falha fechado se o servidor não o der como ativo. Os links manuais `wa.me` não são afetados.
- **A.4** (`8f3a059`) — mensagens de erro em inglês (Apple, reautenticação, eliminação de conta, sessão, manutenção) e indicativos de país em inglês.
- **A.1** (`b1e0b4d`, 1 linha) — a ficha do telefone do convidado pré-preenche o número importado (`entry.phone || entry.importedPhone`), como o próprio comentário do importador do `main` descreve.

Não reaplicado (justificado):
| Linhas | Commit do servidor | Motivo |
|---|---|---|
| 88 | `b1e0b4d` A.1–A.3 | Importador v1 (substituído pelo redesenho dos Lotes 12/14 do `main`) e preferências de **email** nas notificações (o Lote 2 do `main` é «centro in-app, sem email» — omissão deliberada; ver pendente no doc. B) |
| 3 | `b12885c` Sanitização | `type="number"` substituído no `main` por campos `data-num` (correção da vírgula no Android); a sanitização em si já está no `main` (`249d56c`, mesmo conteúdo) |
| 3 | `29de244` B.2 | CSS `.seat-tag` antigo; o `main` tem a versão redesenhada |
| 2 | `e6a41fc` Fase D | Botões de modo do AI Seating; o `main` tem os cartões do Lote 4.1 |
| 1 | `9a3b7f0` Fase J | Linha de fontes; o `main` tem a mesma + Pinyon Script |

Verificações: 0 linhas removidas pelo servidor continuam presentes; 0 marcadores de conflito; os 6 blocos `<script>` passam `node --check`; todas as 26 funções chamadas pela app existem no `index.js`.

## 5. Ficheiros novos trazidos do servidor (sem conflito)

`docs/` (113), `tests/` (88), `scripts/` (6), `recuperado-producao/` (6), `.github/workflows/pages.yml`, `.gitignore`, `.firebaserc`, `firebase.json`, `package.json`, `index.js`, `firestore.rules`, `storage.rules`.

Ajustes feitos na integração (para compatibilidade com o `main`):
- `scripts/build-public.js`: a allowlist passa a incluir `app/invedit.js` (editor de convites) e `.svg` em `convites8/` (7 ficheiros). Sem isto, publicar pelo workflow partia o editor e os modelos de convite.
- `firebase.json` → `functions.ignore`: acrescentados `convites8`, `weddyinvite.js`, `weddyinvite-w.js`, `_site` (não entram no pacote das Cloud Functions).

## 6. Ficheiros preservados do `main`

`convites8/`, `fonts/`, `inicio/`, `convite.html`, `weddyinvite.js`, `weddyinvite-w.js`, `app/invedit.js`, `weddysite.js`, `index.html`, `404.html`, `demonstracao.html`, `privacidade.html`, `suporte.html` — inalterados (o servidor não lhes tocou).

## 7. Commits na branch

- `e9a5aae` — merge de integração.
- commit seguinte — esta documentação (A–E).
