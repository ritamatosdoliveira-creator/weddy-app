# Resumo executivo K.3

- **Feito localmente e testado (60/60 suites):** estado da API WhatsApp só do servidor (oculta por defeito); quota de fotos (por convite, QR, casamento, bytes) resistente a pedidos simultâneos; deteção e registo de reembolsos/disputas Stripe **sem mexer no Premium** (política `record_only`).
- **Não feito (precisa de ti, projeto de teste):** App Check em monitor, TTL, rotação OpenAI, Storage real, Stripe em modo teste. Este ambiente não tem credenciais nem CLI; deixei scripts e passos prontos. Nada externo foi tocado; produção intocada.
- **Decisões tuas:** limites de quota (20/300/2000/5 GB propostos), política de reembolsos, retenção financeira, reCAPTCHA, tetos de custo.
- **Beta:** não declarada pronta. Publicação só com autorização separada.
