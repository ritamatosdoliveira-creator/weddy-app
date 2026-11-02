# Perguntas para a Rita (Fase K.1) — pendências administrativas e legais

Responde com o que souberes; não preenchas por dedução. Cada resposta desbloqueia o item indicado. (Nada é decidido pelo código.)

## A. Segurança operacional
1. **Chave OpenAI:** autorizas a rotação? Em que dia? Queres um projeto OpenAI separado para teste e produção, com limite mensal de gastos? Quem tem acesso ao painel? (`PLANO-ROTACAO-OPENAI.md`)
2. **Alertas de custo:** autorizas criar alertas de orçamento em Google Cloud, OpenAI e Stripe? A que email?
3. **Uploads públicos (K-4):** aceitas a recomendação em camadas? Que limite de fotos por casamento e por convite (sugestão a discutir, não definida)? Aceitas reCAPTCHA/App Check (implica Google reCAPTCHA como novo subprocessador)?
4. **URLs de download (K-5):** queres que remover um co-dono revogue links já partilhados de Documents/Memories? Há na consola ficheiros com links públicos antigos que te preocupem?
5. **`_incident_log` (K-7):** retenção desejada (sugestão técnica: 90 dias; pagamentos: período a validar)? Queres alertas por email para erros de pagamento e perda de dados evitada? A que email?

## B. Firebase
6. Região do **Firestore** (consola → Firestore → Dados)? 7. Região do **bucket de Storage**? 8. **PITR** está ativo (qual a retenção)? Há **exports** agendados? 9. **Versionamento/soft delete** no Storage? 10. Qual o valor de `STATE_VALIDATE_MODE` em produção (se souberes)? 11. Aprovas **30 dias** para a quarentena (ou outro valor)? Aprovas TTL já para `siteRateLimits` e para a quarentena só depois? (Não ativado.)

## C. Pagamentos
12. **Cancelamento:** num pagamento único, queres (a) retirar o botão "Cancelar" na web, (b) transformá-lo em "desligar" com acesso até ao fim, (c) outra? 13. **Reembolsos:** política (prazo, parcial/proporcional, motivos)? Quem aprova e regista? 14. **Klarna:** manter? 15. **Faturação:** emites faturas? Com que software/regime de IVA? Os recibos automáticos do Stripe ficam ativos? 16. **Livre resolução:** aprovas acrescentar, antes do pagamento, o pedido de acesso imediato com reconhecimento da perda do direito (texto a validar por jurista)? 17. **Preço na App Store/RevenueCat:** confirmas 30 €?

## D. Legal e privacidade
18. **Identificação:** quem é o responsável (tu enquanto pessoa singular, ou uma sociedade)? Nome legal, NIF, morada, email de privacidade, telefone a publicar? Precisas de DPO? 19. **WhatsApp:** confirmas que a Weddy **não** usa a API Meta? Opção 1 (manter dormente), 2 (feature flag — recomendada) ou 3 (não publicar essas funções)? Os segredos `WHATSAPP_*` existem em produção? 20. **EmailJS:** manténs? (Podes substituí-lo pelo SMTP que já usas e eliminar um subprocessador.) 21. **Dados de saúde dos convidados:** manténs a recolha opcional de alergias/acessibilidade no RSVP? Aceitas fazer a pergunta do consentimento explícito ao jurista (`REVISAO-PRIVACIDADE-WEDDY.md` §3)? 22. **DPAs:** tens as aceitações de Google Cloud, OpenAI, Stripe, EmailJS, SMTP, RevenueCat arquivadas? Qual é o fornecedor SMTP? 23. **Jurista/advogado:** quem valida os textos? Quando? 24. **DPIA:** aceitas que o jurista a prepare/valide?

## E. Beta
25. A Beta é gratuita? Quantos casais? Duração? Quem convidas? O que aceitas como critério de saída? 26. Que dispositivos reais tens para testar (iPhone/Android)? 27. Podes criar contas de teste (email, Google, cartão Stripe de teste) em `weddy-premium-teste`? (Eu não crio contas.)
