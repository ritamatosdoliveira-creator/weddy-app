# Resumo executivo — Fase K.1

**Natureza:** preparação operacional, administrativa e jurídica. Alterações de código: 2 comentários (preço/duração). Sem deploy, publicação, push, merge, alterações a produção, secrets, regiões, TTL, backups, OAuth ou Stripe. Suite completa: ver resultado no relatório final desta entrega.

**Principais conclusões**
1. **Chave OpenAI:** não existe nenhuma chave no repositório nem no histórico git; procedimento de rotação (10 passos) pronto — a execução é tua.
2. **WhatsApp/Meta:** existe código de servidor para a API Business (dormente na interface). A política em `privacidade.html` e a da app contradizem-se; recomenda-se uma *feature flag* para a desativar (aprovação tua).
3. **Termos Premium:** o texto diz que o acesso se mantém após cancelar, o código corta de imediato; não há consentimento expresso para a perda do direito de livre resolução; sem política de reembolso nem faturação definidas.
4. **Reembolsos Stripe:** hoje não alteram o Premium; desenho seguro proposto (guardar `payment_intent`, registar eventos, parcial = alerta manual).
5. **Uploads públicos / URLs / `_incident_log`:** recomendações em camadas, nenhuma aplicada.
6. **Firebase:** só europe-west1 (Functions) está provado; Firestore, Storage, PITR e TTL por confirmar.

**Decisões tuas necessárias:** 27 perguntas em `PENDENCIAS-ADMINISTRATIVAS-LEGAIS-K1.md`.
**Riscos que impedem a Beta:** chave por rodar; privacidade/entidade; base art. 9.º; região/DPAs/backups; termos Premium; testes reais por fazer; alertas de custo.
**Sequência recomendada:** (1) responder às perguntas A–D → (2) rodar a chave no projeto de teste, depois produção → (3) jurista valida privacidade/termos/art. 9.º → (4) aprovar e implementar numa fase curta K.2: flag WhatsApp, limites `_incident_log`, quota de uploads, eventos de reembolso, rodar tokens → (5) testes reais N4 → (6) publicar por etapas → (7) só então decidir a Fase L (Beta).
