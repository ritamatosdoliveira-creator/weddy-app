# Pendências administrativas e legais (Fases J + K)

Nada aqui foi decidido ou assumido pelo código. Estado: **pendente** salvo indicação.

| # | Pendência | Responsável | Origem | Bloqueia Beta? |
|---|---|---|---|---|
| 1 | Identificação legal da entidade, NIF, morada, email de privacidade, DPO (necessidade) | Administração | J | Sim (política pública) |
| 2 | Corrigir `privacidade.html`/texto in-app: EmailJS ausente; contradição Meta API vs WhatsApp pessoal; subir `CURRENT_PRIVACY_VERSION` | Jurídico + produto | J-4 | Sim |
| 3 | Decisão e base legal para alergias/acessibilidade de convidados (art. 9) e aviso no RSVP | Produto + jurídico | J-6 | Sim |
| 4 | Papéis responsável/subcontratante e termos com os casais | Jurídico | J | Recomendado |
| 5 | Regiões Firebase (Firestore/Storage) confirmadas na consola; documentar | Administração | J/K-13 | Sim |
| 6 | DPAs/termos de tratamento: Google Cloud, OpenAI, Stripe, EmailJS, SMTP, RevenueCat, Meta; mecanismo de transferência EUA | Administração + jurídico | J | Sim |
| 7 | Política de retenção aprovada (logs, `_incident_log`, quarentena, snapshots, suporte, faturação) **antes** de ativar qualquer TTL/eliminação automática | Administração | J/K | Não (mas TTL fica por ativar) |
| 8 | TTL do Firestore em `weddingStateQuarantine.expireAt` (e outras `expireAt`): configurar só após o ponto 7 | Administração | J/K | Não |
| 9 | Backups/PITR: existência, retenção, procedimento de restauro; informação aos utilizadores | Administração | J/K | Sim (informação) |
| 10 | DPIA: decidir/preencher (esqueleto em RASCUNHOS-LEGAIS-WEDDY.md) | Administração + jurista | J | Recomendado |
| 11 | OAuth Google: ecrã de consentimento, verificação da app para scopes sensíveis (`calendar.events`), domínios autorizados, política de privacidade ligada | Administração | I/K | Sim para Google Calendar |
| 12 | Termos Premium: reembolso, renovação, informação pré-contratual, faturação/IVA | Jurídico | J | Sim |
| 13 | Rodar a chave OpenAI exposta anteriormente | Administração | A.3/K-14 | Sim |
| 14 | Procedimento para reembolsos Stripe (revogação manual do Premium) | Administração | K-9 | Não |
| 15 | App Check / alertas de custo / quota do upload público | Administração + produto | K-4 | Recomendado |
| 16 | Validar citações legais em EUR-Lex/DRE/CNPD | Jurídico | J | Sim (antes de publicar) |
| 17 | Direito de imagem/menores em fotos dos convidados e no site | Jurídico + produto | J | Recomendado |
