# Checklist de prontidão para Beta (Fase K)

**Conclusão do Hardening ≠ autorização para a Beta.** A decisão é da administração.

## Requisitos técnicos
- [x] Suite completa verde (ver RESUMO-EXECUTIVO-FASE-K.md)
- [x] Sem vulnerabilidades críticas nem falhas de integridade abertas no repositório
- [x] Pagamentos: idempotência verificada (simulado)
- [ ] Publicar código (functions, regras, HTML) — **só com autorização**
- [ ] Testes pós-publicação em ambiente real (ver CHECKLIST-PUBLICACAO-PRODUCAO.md)

## Segurança
- [x] Autenticação/autorização por função (matriz automática)
- [x] Regras Firestore/Storage adversariais
- [ ] **Bloqueador administrativo**: rodar a chave OpenAI exposta (K-14)
- [ ] App Check ou quota de upload público (K-4) — recomendado antes de abrir a Beta a muitos casais
- [ ] Alertas de orçamento Google Cloud/OpenAI/Stripe

## Privacidade
- [x] Cascata de eliminação testada; sem terceiros de fontes; `store:false`
- [ ] **Bloqueador jurídico**: texto de privacidade corrigido (EmailJS, Meta) e identificação legal — ver PENDENCIAS-ADMINISTRATIVAS-LEGAIS.md
- [ ] **Bloqueador jurídico**: base/consentimento para alergias/acessibilidade de convidados
- [ ] Região UE de Firestore/Storage confirmada; DPAs; TTL; backups

## Desempenho
- [x] 1000 convidados dentro dos limites do documento (36%); AI Seating limitado a 800 (produto)
- [ ] Medição real de leituras Firestore em produção (X)

## Testes
- [x] Todos os testes B.1–J preservados + 7 novos
- [ ] Testes manuais em dispositivos reais iOS/Android (X)
- [ ] Testes com OAuth Google real e Stripe modo teste (X)

## Classificação
- **Bloqueadores para abrir a Beta**: chave OpenAI (K-14), texto legal/identificação (J-4), regime art. 9 dos convidados (J-6), região/DPAs (K-13).
- **Riscos elevados**: nenhum aberto no código.
- **Moderados**: K-4, K-5, K-7, K-8, K-9.
- **Melhorias**: K-6, K-10, K-11, K-12, K-15.
