# Checklist de publicação em produção (Fase K) — NADA FOI PUBLICADO

Sequência proposta (cada passo só com autorização expressa; primeiro no projeto de teste `weddy-premium-teste`):

1. **Pré-requisitos**: ramo revisto; suite 100%; backup/exportação do Firestore (PITR confirmado); janela de baixa utilização.
2. **Secrets** (não alterados nesta fase): confirmar existência de `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `WHATSAPP_*`, `GOOGLE_*`, `SMTP_*`, `APPLE_SIGNIN_PRIVATE_KEY`; rodar a chave OpenAI (pendência K-14) **antes** da Beta.
3. **Regras**: `firestore.rules`, `storage.rules` (inalteradas na Fase K; alterações J/I já documentadas) → testar com emulador, publicar e correr verificação manual (ler/escrever como dono; negado como outro).
4. **Functions** (alterações J+K): `index.js` — `deleteWeddingAccount` (cascata), `store:false` (classify/seating), `createSubscriptionCheckout` (allowlist), log sem email. Publicar função a função; verificar logs.
5. **Ficheiros estáticos**: `app/index.html`, `rsvp.html`, `memorias.html`, `demo-app.html`, `promo-video.html`, `fonts/*`. Confirmar que `/fonts/*.woff` são servidos e que não há pedidos a fonts.googleapis.com.
6. **Configuração**: TTL Firestore para `weddingStateQuarantine.expireAt` **só após política aprovada**; alertas de orçamento; App Check (se aprovado); `STATE_VALIDATE_MODE` continua `off`.
7. **Serviços externos**: webhook Stripe (endpoint + segredo); RevenueCat; WhatsApp; OAuth Google (ecrã de consentimento, domínios, scopes).
8. **Testes pós-publicação** (manuais): registo/login; criar casamento; RSVP individual e família; checkout em modo teste (cartão de teste) e verificação de `subscription`; MB WAY pendente; eliminação de conta de teste; site publicado/despublicado; contacto; Copilot/Compare/Seating com conta Premium de teste.
9. **Reversão**: manter commit anterior (9a3b7f0) e regras anteriores à mão; sem migrações de dados nesta fase, logo reversão = republicar versões anteriores.

Ficheiros alterados desde a Fase J: `index.js`, `tests/**` (novos testes), docs. Nenhum alterado em `firestore.rules`/`storage.rules`.
