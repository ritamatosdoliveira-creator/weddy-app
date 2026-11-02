# Checklist RGPD/Legal antes de publicar (Fase J)

**Código (após autorização expressa)**
- [ ] Publicar `functions` (J-2 eliminação, J-3 `store:false`) — ver PROCEDIMENTO-PUBLICACAO.md
- [ ] Publicar HTML com fontes locais; verificar que `/fonts/*.woff` são servidos (GitHub Pages) e o aspeto mantém-se
- [ ] Confirmar no browser: Network sem pedidos a fonts.googleapis.com

**Consola / administração**
- [ ] Região de Firestore e Storage (UE?) anotada
- [ ] TTL ativa em `weddingStateQuarantine.expireAt` (e outras com `expireAt`)
- [ ] DPAs aceites/arquivados: Google Cloud, OpenAI, Stripe, EmailJS, SMTP, RevenueCat, Meta
- [ ] OpenAI: opções de retenção/treino da conta confirmadas
- [ ] Backups/PITR: existem? retenção documentada
- [ ] Retenção dos logs (Cloud Logging) definida
- [ ] Rotação da chave OpenAI (pendência anterior)

**Jurídico (validação obrigatória)**
- [ ] Identificação legal, NIF, morada, email de privacidade, DPO (necessidade)
- [ ] Papéis (responsável/subcontratante) e termos com os casais
- [ ] Texto de privacidade corrigido (EmailJS, Meta vs wa.me) + versão EN + subir `CURRENT_PRIVACY_VERSION`
- [ ] Base e aviso para dados art. 9 no RSVP; decisão de produto
- [ ] Informação para convidados; menores/fotos; direito de imagem
- [ ] Termos Premium (reembolso, renovação, informação pré-contratual)
- [ ] Prazos de retenção aprovados (fiscal inclusive)
- [ ] DPIA decidida/preenchida
- [ ] Procedimentos de direitos e incidentes aprovados; registo art. 30 completado
- [ ] Citações legais conferidas em EUR-Lex/DRE/CNPD
