# Checklist de publicação — Weddy Copilot (Fase E)

Estado: **nada foi publicado, enviado (push), fundido ou implementado.** Tudo está em commits locais no ramo `v325-import-guests`.

## 1. Validado localmente
- [x] Classificação PT/EN (60 frases, erros de escrita, ordem diferente) — `tests/ui/copilot.py`
- [x] Consultas sobre dados reais; listas vazias e dados antigos sem `undefined`/`NaN`
- [x] Escritas L2/L3: gravação confirmada antes de responder; falha → estado local revertido e resposta honesta
- [x] Confirmação de uso único, expira (5 min), invalidada por qualquer outra pergunta, revalidada contra o estado atual
- [x] Trinco contra duplo clique / confirmações simultâneas (1 só gravação)
- [x] IA nunca obtém escritas sensíveis; texto vindo da IA é saneado e exige confirmação
- [x] Premium em código (ativo, expirado, reativado) e dados preservados
- [x] Servidor: isolamento entre casamentos, quota 60/dia atómica, falhas da OpenAI devolvem a quota, payload à OpenAI só com a pergunta
- [x] UI a 390/768/1360 px, sem erros JS, sem scroll horizontal
- [x] Suite completa e regressão (ver relatório)

## 2. Precisa de publicação (só com autorização explícita da Rita)
- [ ] **Cloud Function `classifyWeddyIntent`** (`index.js`): novas intenções de leitura, `refundAiUsage`, flag `noKey`. Sem isto, o cliente novo funciona (reconhece tudo por regras) mas a IA não sugere as intenções novas e falhas da OpenAI continuam a consumir quota.
- [ ] **App (`app/index.html`)**: Copilot consolidado. Publicar depois da função (a ordem não é crítica: o cliente novo aceita respostas da função antiga).
- [ ] Nenhuma alteração de regras Firestore/Storage nesta fase.

## 3. Precisa de configuração
- [ ] Nada novo. `OPENAI_API_KEY` continua a ser o segredo existente (`defineSecret`); não foi criado, alterado nem rodado nenhum segredo. A exposição conhecida da chave no pacote de produção mantém-se como pendência separada.

## 4. Precisa de validação em produção (depois de publicar, com conta de teste)
- [ ] Uma pergunta livre (UNKNOWN nas regras) que passe pela IA real → resposta de leitura; confirmar que `aiUsage/{id}.count` sobe 1.
- [ ] Forçar uma falha da OpenAI (chave inválida em ambiente de teste) → `count` não sobe.
- [ ] Criar/concluir/apagar uma tarefa pelo chat num casamento de teste e ver o resultado noutro dispositivo.
- [ ] Conta sem Premium: o chat recusa e a função devolve `permission-denied`.
- [ ] Testar em `weddy-premium-teste` antes de `weddy-app-bd12f`.
