# Checklist de preparação para Beta (K.1)

**Concluir a K.1 não torna a Weddy pronta para Beta nem autoriza a Fase L.** Este documento separa o estado. Complementa `docs/seguranca/CHECKLIST-PRONTIDAO-BETA.md` (Fase K).

## Resolvido (no repositório, local)
- [x] Comentários de preço/duração do checkout corrigidos (30 €/12 meses)
- [x] Auditoria: nenhuma chave OpenAI no repositório/histórico; secret via `defineSecret`; funções declaram o secret (teste `packaging`)
- [x] Análises comparadas e riscos classificados: uploads, URLs, `_incident_log`, reembolsos, regiões/backups/TTL, privacidade, termos Premium
- [x] Situação real do EmailJS e do WhatsApp/Meta esclarecida

## Preparado, mas depende de autorização tua
- [ ] Rotação da chave OpenAI (`PLANO-ROTACAO-OPENAI.md`)
- [ ] Alerta de orçamento Google Cloud/OpenAI/Stripe
- [ ] *Feature flag* para desativar a API WhatsApp no servidor
- [ ] Quota de uploads por casamento (função nova) e App Check em modo monitor
- [ ] Rodar tokens de download ao remover co-dono
- [ ] Limites de campos no `_incident_log` (regras) e alertas de erros críticos
- [ ] Tratamento de `charge.refunded`/disputas no Stripe (após decisão de política)
- [ ] Publicação por etapas (primeiro `weddy-premium-teste`) — `CHECKLIST-PUBLICACAO-PRODUCAO.md`

## Depende de decisão administrativa (ver `PENDENCIAS-ADMINISTRATIVAS-LEGAIS-K1.md`)
- [ ] Regiões Firestore/Storage; PITR e backups; retenção; TTL
- [ ] Identificação legal, NIF, morada, contacto de privacidade, DPO
- [ ] Opção para WhatsApp (manter dormente / flag / não publicar)
- [ ] Beta: gratuita ou paga? número de casais? critérios de saída

## Depende de validação jurídica
- [ ] Texto de privacidade (EmailJS, Meta, transferências, retenção, direitos)
- [ ] Base e consentimento para alergias/acessibilidade; menores; direito de imagem
- [ ] Termos Premium (cancelamento, reembolso, livre resolução e consentimento expresso, faturação, Klarna)
- [ ] Citações legais e DPIA

## Depende de testes externos (N4/N5 — nenhum executado)
- [ ] Toda a lista de `MATRIZ-TESTES-INTEGRACOES-REAIS.md`

## Bloqueadores para abrir a Beta (proposta)
1. Chave OpenAI rodada. 2. Texto de privacidade corrigido e entidade identificada. 3. Decisão/base para dados de saúde dos convidados. 4. Regiões/DPAs/backups confirmados. 5. Termos Premium alinhados com o comportamento real (cancelamento, consentimento de livre resolução). 6. Testes reais mínimos (login, pagamento de teste, upload/download, dois dispositivos, iOS/Android). 7. Alertas de custo.
