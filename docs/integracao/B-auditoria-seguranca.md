# B — Auditoria de segurança da integração

Âmbito: o que muda em segurança ao juntar `origin/main` (`59a8399`) e `feat/convites-envio-backend` (`30111d7`). Leitura de código + testes em emulador (`demo-weddy`). **Nada foi publicado** e nenhum teste falou com produção.

## 1. Firestore Rules (`firestore.rules`, base `b9d2fd2` → integração)

Todas as alterações são **restrições** ou coleções novas fechadas por omissão:

| Alteração | Efeito |
|---|---|
| `premiumOn(w)` (ativo **e** dentro de `premiumUntil`) | Premium verificado nas regras, não só no cliente |
| `weddings`: `json` tem de ser texto ≤ 900 000 caracteres | Limita o tamanho do estado |
| `weddings`: o cliente só pode pôr `subscription.active=false` alterando apenas `active`/`updatedAt` | Impede autoconceder ou mexer noutros campos da subscrição |
| `.../integrations/{id}`: `write: false` (só leitura do dono) | Tokens do Google Calendar só pelo servidor |
| `guests/{token}` (RSVP): `logistics` validada campo a campo (chaves permitidas, tamanhos, intervalos); `openedAt`/`respondedAt` só `timestamp` | Evita injeção de dados arbitrários pelo convidado |
| `memories`: `storagePath` = `memories/<weddingId>/<token>/<ficheiro>` (4 segmentos exatos), Premium ativo e álbum não cheio (`memoryQuota.full`) | Fecha IDOR por caminho e abuso de quota |
| `_incident_log`: lista fechada de campos, tamanhos máximos, `before/after` só contagens | Minimização (K.2) |
| Novas coleções só-servidor (`read, write: false`): `weddingInvitations`, `invitationSlugs`, `whatsappConsentRateLimit`, `weddingStateQuarantine`, `notifState`, `invitationQuota`, `rsvpReminderSends`, `memoryQuota/*/items` | Negação por omissão |
| Leitura só do dono (email verificado + `ownerEmails`): `memoryQuota`, `whatsappConsents` (`get`), `invitationDeliveries` | Sem `list` |
| `publicInvitations/{slug}`: `get` público só se `status=='published'` e `validUntil > agora`; `list`/escrita fechados | Não é possível enumerar convites |

Compatibilidade com a app do `main` verificada:
- As 6 escritas em `_incident_log` usam só campos permitidos (passam por `incidentAdd`).
- A app não escreve diretamente em nenhuma coleção só-servidor (só leituras de `integrations`, `publicInvitations`, `whatsappConsents`, `invitationDeliveries`).

## 2. Storage Rules (`storage.rules`)

| Alteração | Efeito |
|---|---|
| Fotos de Memories: `resource == null` (não substitui), Premium ativo, token do convidado tem de pertencer ao casamento (ou `publico`) | Sem sobreposição de fotos; IDOR fechado |
| `invitations/{weddingId}/*` (novo): ler/apagar só o dono; criar só o dono, Premium, imagem jpeg/png/webp < 5 MB; `update: false` | Fotos dos convites protegidas |
| Documentos: escrita só dono + Premium (`canWriteDocument`) | Antes bastava ser dono |

A troca `firestore.exists(...)` → `true` dentro de Memories vem acompanhada de `premiumOn(firestore.get(...))`, que já exige que o casamento exista — **não** é um enfraquecimento.

## 3. Cloud Functions (`index.js`)

- **Nenhuma função de produção se perde**: as 32 funções do `index.js` recuperado de produção (30/10) e as 30 do de 27/10 existem todas na integração; há 21 novas (convites, quotas de fotos, WhatsApp, email-resumo, validação do estado, revogação de tokens).
- Todas as 26 funções chamadas pela app integrada existem no servidor.
- Parâmetros com valor seguro por omissão: `WHATSAPP_API_ENABLED=false`, `NOTIFY_EMAIL_ENABLED=false`.
- `OPENAI_API_KEY` via Secret Manager (teste `packaging`); `store:false` nos pedidos à OpenAI (teste `privacy-static`).
- Matriz de autenticação/autorização de todas as funções: teste `hard-auth-matrix`.

## 4. Segredos e configuração

- Nenhum ficheiro `.env*` rastreado; nenhum foi aberto nesta integração.
- Pesquisa de padrões (`sk_live_`, `whsec_`, `rk_live_`, chaves privadas, `ghp_`, `sk-…`, `xox…`) nos ficheiros rastreados: só aparecem prefixos em documentação/regex (`docs/seguranca/SEGREDOS-INVENTARIO.md`, `tests/k4/public-artifact.test.js`). As chaves `AIza…` nas páginas são a configuração web do Firebase (pública por desenho; a proteção está nas regras e no App Check).
- `.gitignore` novo exclui `.env*`, chaves, `node_modules`, `_site`, etc.
- `firebase.json` → `functions.ignore` exclui o site, docs, testes, scripts e (acrescentado nesta integração) `convites8`, `weddyinvite*.js`, `_site`.

## 5. Publicação pública

- O artefacto da allowlist não contém nada privado (teste `k4-public-artifact`).
- **Risco principal**: com o GitHub Pages a publicar a partir da branch, um merge desta integração no `main` serviria `index.js`, regras, `docs/`, `tests/` e `recuperado-producao/` em www.weddy.pt. Ver doc. D. Bloqueio para o merge.

## 6. Riscos e pendentes

| # | Risco / pendente | Gravidade | Ação recomendada |
|---|---|---|---|
| 1 | Merge no `main` com Pages por branch expõe ficheiros internos | Alta | Decidir doc. D antes do merge |
| 2 | Email-resumo: por omissão envia semanal + alertas a todos os casais (`notifyEmailPrefs`); a app do `main` **não** tem o interruptor (Lote 2 «sem email»). Hoje está desligado (`NOTIFY_EMAIL_ENABLED=false` por omissão) | Média (RGPD) | Não ligar a flag nem publicar `sendCoupleEmailDigest` sem decidir: repor a preferência na app ou mudar o padrão para «off» |
| 3 | Não se sabe com exatidão que versão do `index.js`/regras está hoje em produção depois de 30/10 | Média | Antes de publicar a partir da linha integrada, comparar com produção (só leitura) |
| 4 | `recuperado-producao/` (código de produção) está no repositório público | Baixa/Média | Já está no `origin` desde a branch do servidor; avaliar se deve continuar público |
| 5 | Scripts de publicação apontam para `servidor/` + `feat/convites-envio-backend` | Informativo | Atualizar só quando a integração for aprovada e estiver no `main` |
| 6 | Ações do GitHub no workflow fixadas por versão, não por SHA | Baixa | Melhoria opcional |

## 7. Testes de segurança executados

Ver doc. C (resultados completos).
