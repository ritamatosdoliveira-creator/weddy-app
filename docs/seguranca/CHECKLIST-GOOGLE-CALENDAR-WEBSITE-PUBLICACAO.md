# Checklist de publicação — Fase I (NADA publicado)

**Pré-requisitos (decisão da Rita)**
- [ ] Autorização expressa para push/merge/deploy.
- [ ] Suite completa verde no commit a publicar.
- [ ] Decidir se o Calendar sai agora: a app OAuth do Google (scope sensível) precisa de verificação para sair do modo «Testing».

**Ficheiros a publicar (em conjunto!)**
- [ ] `index.js` (Functions): nova `googleCalendarFinalizeOAuth`; callback alterado; sync `partial`; e-mail da conta; limpeza de `oauthStates`.
- [ ] `app/index.html` (cliente): finalização do OAuth no regresso; vista «Premium terminado» do Calendar; conta e sync parcial.
- [ ] Não há alterações a `firestore.rules`, `storage.rules`, `weddysite.js`, `site.html`.
- [ ] ⚠ Cliente e Functions TÊM de ir juntos (fluxo OAuth novo). Com versões misturadas a ligação não conclui.

**Configuração externa (não feita)**
- [ ] Google Cloud (projeto de produção): ativar Google Calendar API; ecrã de consentimento com os 2 scopes; cliente OAuth «Web» com o redirect de produção.
- [ ] `GOOGLE_CALENDAR_REDIRECT_URI` = URL da função `googleCalendarOAuthCallback` em produção (o valor por omissão aponta ao projeto de teste).
- [ ] Secrets já existentes (`GOOGLE_CALENDAR_CLIENT_ID/SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`): confirmar que existem no projeto de produção. **Não rodar** `GOOGLE_TOKEN_ENCRYPTION_KEY` sem plano de migração (os refresh tokens ficariam ilegíveis).

**Validação pós-publicação (projeto de teste primeiro)**
- [ ] Ligar com conta Google de teste → regresso à app mostra «ligado» e o e-mail da conta.
- [ ] Escolher calendário → eventos criados; repetir sync → sem duplicados.
- [ ] Alterar hora / apagar item na Weddy → sync atualiza/remove.
- [ ] Abrir o link de autorização num browser com OUTRA conta Weddy → deve falhar (login-CSRF).
- [ ] Premium expirado (conta de teste): Calendar só deixa desligar; site publicado passa a «indisponível»; renovar → volta.
- [ ] Desligar → confirmar revogação em myaccount.google.com; eventos mantêm-se no Google.
- [ ] Site: publicar em teste, abrir `/c/<slug>` sem sessão, confirmar noindex, RSVP com link individual; despublicar.

**Rollback**: repor `index.js` e `app/index.html` anteriores. Dados compatíveis (campos novos opcionais: `lastSyncFailedItems`; `oauthStates.pending`).
