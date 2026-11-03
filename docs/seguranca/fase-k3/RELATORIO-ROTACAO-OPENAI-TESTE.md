# Rotação OpenAI no projeto de teste (K.3-F)

**Estado:** **NÃO executada.** Motivos: (1) este ambiente não tem credenciais Firebase/Google Cloud nem `firebase` CLI; (2) o procedimento exige que a Rita crie e cole a chave de forma interativa — eu não crio, vejo nem manipulo chaves. Nenhum segredo foi tocado; produção intocada.

## Verificado localmente (sem segredos)
- Funções que usam o segredo (`secrets: [OPENAI_API_KEY]`): `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport` (teste `packaging` confirma).
- Nenhuma chave em repositório, frontend, docs ou testes; erros da OpenAI não registam a chave.
- `PLANO-ROTACAO-OPENAI.md` (K.2) continua a ser o procedimento aprovado; `scripts/rotacao-openai-teste-verificacoes.sh` faz só verificações sem valor (versões do segredo, função↔segredo).

## Para a Rita executar no projeto de teste
Passos 2–7 do plano com `firebase use teste`/`--project weddy-premium-teste` (guard obrigatório); testar Copilot, AI Seating e Compare com conta de teste; só então desativar a versão antiga **do projeto de teste**. A chave antiga de produção não se toca. Resultado documentar sem valores: data, versão do segredo (número), funções testadas, OK/NOK.
