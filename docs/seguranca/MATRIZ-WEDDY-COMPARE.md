# Matriz de validação — Weddy Compare (Fase F)

Teste do servidor: `tests/compare/compare.test.js` (140 verificações, inalteradas). Teste do cliente: `tests/ui/compare.py` (160 verificações, novo; usa a lógica real da app, jsPDF real e valida os PDFs com `pdftotext`/`pdftoppm`).

| Requisito | Implementação | Teste | Resultado | Observações |
|---|---|---|---|---|
| A. Ciclo de vida (criar, estados, relatório, decisão) | `cmpStatusOf`, `cmpExportState` | compare.py §I/J | OK | estados: rascunho / pronta / por rever / relatório / desatualizado / decidida |
| B. Propostas, duplicar | `cmpDuplicate` | compare.py §J | OK | nova identidade; sem IA, sem relatório, sem despesa; docs não duplicados |
| C. Upload / eliminar ficheiros | `CMP_MAX_FILE` 15 MB; regras Storage; `cmpStorageDelete` | servidor (140) + compare.py §J | OK | falha ao apagar no Storage passa a ficar registada (antes: silenciosa) |
| D. Análise IA (servidor) | `analyzeCompareProposal` | servidor (140) | OK | auth, Premium, quotas 10/dia, tamanhos, páginas, timeouts, respostas inválidas |
| E. Origem dos dados | `cmpConfirmed`, `cmpApplyReview` | compare.py §E | OK | 4 origens preservadas; por confirmar nunca entra |
| F. 12 critérios | `CMP_CRITERIA` | compare.py §G/H | OK | critérios em falta identificados |
| G. Comparação | `cmpRows`, `cmpPriceFacts` | compare.py §G/H | OK | não altera originais |
| H. Preços | `cmpParsePrice` | 32 formas de escrita | OK | por pessoa ≠ total; IVA misto/desconhecido não compara; sinais/prestações recusados |
| I. Relatório e assinatura | `cmpSigOf`, `cmpGenerateReport` | compare.py §I | OK | desatualizado por valor/campo/prioridade/ordem/idioma; falha preserva anterior; 1 chamada em duplo clique |
| J. Histórico, pesquisa, filtros | `cmpMatches` | compare.py §J + UI | OK | filtros só com ≥3 comparações (por desenho) |
| K. Despesas / fornecedores | `cmpCreateExpense` | compare.py §K | OK | nunca duplica, `paid=0`, preço por pessoa exige valor total |
| L. PDF real | `cmpBuildPdf` | compare.py §L | OK | 2/3/5 propostas, 12 critérios, texto longo, acentos, sem páginas vazias, rodapé; inferidos nunca presentes |
| M. Premium | `assertPremiumWedding`, `cmpExportFlowInner` | servidor + compare.py | OK | conteúdo preservado quando Premium termina |
| N. Segurança / isolamento | regras + servidor | servidor (140) | OK | |
| O. Concorrência | guardas de reentrada e cooldown | compare.py §I/L | OK | |
| P. Falhas | rede, timeout, quota, resposta inválida, jsPDF em falta | compare.py §I/L | OK | |
| Q. Privacidade | só ids e idioma vão ao servidor | compare.py §I | OK | |
| R. Compatibilidade | `cmpList` normaliza `proposals` | compare.py §R | OK (corrigido) | comparações antigas sem `proposals` rebentavam em `cmpRows` |
| T. PT/EN, 390/768/1360 | UI | compare.py UI | OK | sem scroll horizontal nem erros JS |
