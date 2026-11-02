# Checklist de publicação — Fase H (NADA publicado)

- [ ] Rita autoriza expressamente push/merge/deploy.
- [ ] Publicar **apenas** `app/index.html` (hosting). Sem alterações a `firestore.rules`, `storage.rules` ou Functions nesta fase.
- [ ] Antes: suite completa verde no commit a publicar.
- [ ] Em teste (`weddy-premium-teste`): conta Premium → adicionar inspiração com foto no bolo → abrir noutro dispositivo/browser e confirmar que a foto aparece.
- [ ] Em teste: conta com Premium expirado e conteúdo → Bolo/Papelaria/Votos abrem em consulta, com aviso; não deixam criar/editar; deixam apagar.
- [ ] Em teste: apagar inspiração com foto remove o ficheiro `documents/{id}/…_cakeinsp_…` (ou deixa registo em `_incident_log`).
- [ ] Verificar em mobile (390 px) e PT/EN.
- [ ] Sem migração de dados de produção; sem rotação de chaves (pendência OpenAI mantém-se fora destas fases).
- [ ] Rollback: repor o `app/index.html` anterior (sem dependências de dados novos além de `photoPath` opcional).
