# Resumo executivo — Fase I (Google Calendar e Wedding Website)

**Estado:** Fase I concluída **localmente**, com a ressalva de que as integrações reais (Google, publicação) não foram validadas por exigirem credenciais externas. Suite completa **47/47** (41+1 anteriores + 5 novas: `gcal`, `site`, `rules-site`, `ui-gcal-lapsed`, `ui-site`). Sem P0/P1 em aberto.

- Ambas as integrações **já existiam e estavam bem construídas** no servidor; faltavam testes e havia 2 problemas P1 e 3 P2, todos corrigidos (ver relatório): login-CSRF no OAuth, impossibilidade de desligar o Calendar sem Premium, e-mail da conta nunca obtido, falhas parciais ocultas, `oauthStates` sem limpeza.
- Google Calendar: unidirecional Weddy→Google, scopes mínimos, tokens cifrados no servidor, sync sem duplicados, desligar não apaga eventos nem dados.
- Wedding Website: publicação/despublicação/suspensão por Premium sem apagar nada, snapshot público sem dados privados, noindex por omissão, RSVP só pelo link individual existente (sem conta, sem instalação).
- 5 suites novas (gcal 145, site 74, rules-site 38, ui-gcal-lapsed 69, ui-site 90), todas com Google/Storage **simulados**.
- **Por validar com externos:** OAuth e API do Google reais, verificação da app OAuth (scope sensível — risco de calendário), publicação real. Cliente e Functions publicam-se juntos.
- Sem push, merge, deploy, publicação, contas Google reais, DNS ou alterações a segredos.
- Próxima fase: **FASE J — RGPD e Legal.**
