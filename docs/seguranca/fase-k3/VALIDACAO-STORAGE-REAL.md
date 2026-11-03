# Validação com Storage real de teste (K.3-G)

**Estado:** **NÃO executada** (sem credenciais/CLI neste ambiente). Na K.2 a revogação foi testada só com Storage simulado; **continua sem validação real**. Preparado: `scripts/validar-storage-revogacao.js` (ficheiros e casamento fictícios, limpeza no fim, recusa-se a correr fora de `weddy-premium-teste`).

## Passos cobertos pelo script (brief 1–9)
Cria ficheiros fictícios em `documents/`, `memories/`, `sites/` → obtém URLs → remove um co-dono (update do casamento) → espera o trigger → verifica: URLs antigos 403/404, ficheiros existem, novos URLs funcionam, registo de auditoria `done`.

## Passo 10 (falha parcial)
Com o trigger publicado no projeto de teste, aplicar temporariamente uma restrição IAM que impeça `storage.objects.update` à conta de serviço do trigger (ou renomear o prefixo), repetir e confirmar `partial`/`failed` no registo e que **nada é apagado**. Reverter a restrição.

## Pré-requisitos
Deploy das functions **no projeto de teste** (decisão/ação da Rita); regras de Storage atuais; confirmar que o bucket de teste não tem dados reais. **Resultado observado: nenhum.**
