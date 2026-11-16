# Plano de rotação da chave OpenAI (K.2-4, atualizado)

**Estado:** procedimento preparado e atualizado na K.2. **Rotação NÃO executada. Nenhum segredo foi acedido, copiado, revogado ou substituído.** Nenhuma chave real aparece neste documento.

## 1. Auditoria (factos verificados no repositório local)
| Verificação | Resultado |
|---|---|
| Declaração | `const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')` (Secret Manager) — `index.js` |
| Uso | `OPENAI_API_KEY.value()` apenas em funções com `secrets: [OPENAI_API_KEY]`: `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport` (teste `packaging` confirma: declarado == necessário, também em execução) |
| Frontend | Nenhuma referência à chave nem a `api.openai.com` em `app/`, `rsvp.html`, `memorias.html`, `demo-app.html`, site |
| Padrões de chave (`sk-…`) no repositório, incluindo `docs/`, `tests/`, `recuperado-producao/` | **Nenhum**. Os testes usam valores falsos óbvios (`fake-test-key-NOT-REAL`) |
| Histórico git (pesquisa de `sk-proj`) | Nenhum resultado |
| `.env`, ficheiros `.bak`/`.antes-*` com chaves | Não existem na árvore versionada; `firebase.json` ignora `.env*`, `*.key`, `*.pem`, `*.log` no deploy |
| Logs | Erros da OpenAI registam só o código HTTP (nunca o corpo); a chave não é registada |
| Limitação | Não foi verificado o que está no Secret Manager, no painel da OpenAI nem em ficheiros **fora** do repositório (ex.: o computador da Rita, antigos zips, histórico de chats). A exposição original veio de fora do repositório → [X] |

## 2. Passos (quem faz o quê)
Legenda: **[RITA]** exige a tua autorização e intervenção · **[CLAUDE]** posso preparar/verificar localmente.

1. **[RITA] Decidir a janela**. Rodar primeiro no projeto de teste (`weddy-premium-teste`), depois no de produção (`weddy-app-bd12f`). O Copilot, Compare e AI Seating deixam de responder (e devolvem a quota) enquanto a chave nova não estiver ativa — as funções já tratam a falta de chave sem erro fatal.
2. **[RITA] Criar a chave nova** no painel da OpenAI (Settings → API keys → *Create new secret key*), com nome identificável (ex.: `weddy-prod-2026-11`). Se o painel permitir, usar um **projeto OpenAI dedicado** com limite mensal de gastos (hard limit) e só o modelo usado ativado. Copiar a chave uma única vez para o terminal do passo seguinte — nunca para chat, email, ficheiro ou captura de ecrã.
3. **[RITA] Guardar no Secret Manager** (no terminal, projeto certo; a chave é pedida de forma interativa, não escrita no comando):
   `firebase use <teste|prod>` → `firebase functions:secrets:set OPENAI_API_KEY`
   Quando o CLI perguntar, colar a chave. Isto cria uma **nova versão** do segredo.
4. **[RITA] Voltar a publicar as 4 funções** para que apanhem a nova versão: `firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport` (as funções v2 só leem a versão nova após novo deploy ou nova revisão).
5. **[CLAUDE/RITA] Verificar a associação** sem revelar a chave: `firebase functions:secrets:access OPENAI_API_KEY` **não deve ser usado** (imprime o valor). Usar em vez disso `gcloud secrets versions list OPENAI_API_KEY --project <id>` (mostra versões e estado, não o valor) e a consola Cloud Run → função → *Variáveis e segredos* (mostra o segredo e a versão referenciada, não o valor).
6. **[RITA] Testar a integração** com conta Premium de teste no projeto de teste: pedir uma pergunta no Assistente Weddy; gerar uma proposta no AI Seating; gerar um relatório Compare. Resultado esperado: resposta normal e uma linha de log `INFO` sem a chave. Em caso de `unavailable`/`UNKNOWN` consistente, rever o passo 3–4.
7. **[RITA] Revogar a chave antiga** no painel da OpenAI (*Revoke*) **depois** de o teste do passo 6 passar — nunca antes, para evitar corte de serviço — e **desativar/destruir** as versões antigas do segredo: `gcloud secrets versions disable <n> --secret OPENAI_API_KEY --project <id>` (ou `destroy`, irreversível).
8. **[RITA] Verificar que a chave antiga morreu**: no painel da OpenAI, a chave antiga aparece como revogada e o *Usage* mostra 0 pedidos novos com ela; opcionalmente, um único pedido de teste com a chave antiga (feito por ti, num terminal, sem colar o resultado) deve devolver 401. Verificar também o painel de utilização nos dias seguintes para detetar uso indevido anterior à revogação.
9. **[RITA] Rever custos/uso** dos últimos 30 dias na OpenAI (picos anómalos = chave usada por terceiros) e definir alerta de orçamento.
10. **[CLAUDE] Depois da rotação**: atualizar `SEGREDOS-INVENTARIO.md` (data e quem rodou, sem valores) e correr `tests/packaging`.

## 3. O que nunca fazer
Não criar `.env`; não pôr a chave no frontend; não a colar em chats, issues, commits ou documentação; não reutilizar a mesma chave em teste e produção (usar chaves distintas, ideal: projetos OpenAI distintos).

## 4. Decisões que dependem de ti
Janela de rotação; se queres um projeto OpenAI dedicado com limite de gasto; quem tem acesso ao painel; se revogas a antiga imediatamente após o teste de teste ou só após a produção (recomendado: revogar a antiga só quando **ambos** os ambientes usarem chaves novas, usando chaves diferentes por ambiente).

## 5. Atualizações K.2
- Passo 4 passa a incluir uma verificação prévia: confirmar que `WHATSAPP_API_ENABLED` **não** é alterado na mesma publicação (a rotação não deve misturar mudanças).
- Passo 7: antes de revogar a chave antiga, confirmar no painel OpenAI 24 h sem pedidos novos com ela.
- Pré-requisito novo: correr `tests/run-all.js --only packaging` após o deploy no projeto de teste (garante que as 4 funções declaram o segredo).
- Reafirma-se: **não** executar nenhum passo sem autorização expressa da Rita.
