# Relatório da Fase F — Weddy Compare

## Estado inicial
Compare implementado no cliente (`app/index.html`, ~L14175–16800) e servidor (`index.js`: `analyzeCompareProposal`, `generateCompareReport`). Testes: 140 verificações do servidor; nenhum do cliente.

## Arquitetura
`state.compares[]` → propostas → `fields{k:{v,src,confirmed}}`; documentos em `state.weddingDocuments` com `compareId/proposalId`; Storage `documents/{weddingId}/…`. Origem: `cmpConfirmed` só devolve valores manuais ou confirmados. Relatório com assinatura (`cmpSigOf`) + idioma.

## Funcionalidades auditadas
Ciclo de vida, upload/remoção, análise e revisão, 12 critérios, preços, relatório (válido/desatualizado), histórico/filtros, duplicar/eliminar, despesas e fornecedores, PDF, Premium.

## Lacunas e correções
| # | Gravidade | Problema | Ação |
|---|---|---|---|
| 1 | P2 | Falha ao apagar ficheiro no Storage era silenciosa | `cmpStorageDelete` regista a falha |
| 2 | P2 | Comparação antiga sem `proposals` rebentava `cmpRows` | `cmpList` normaliza |

Sem P0/P1 encontrados.

## Segurança e privacidade
Servidor: auth com e-mail verificado, Premium, isolamento por casamento, limites de ficheiros (15 MB / 25 MB total / páginas), quotas diárias, `defineSecret`. Ao servidor só vão ids e idioma (verificado). Nada de segredos criados/alterados.

## Custos
Sem alterações a quotas ou modelo. Não se geram relatórios sem necessidade: nome e notas não invalidam a assinatura; duplo clique faz uma só chamada.

## PDF
Motor mantido (jsPDF + autotable). Verificado: cabeçalho/rodapé, paginação, sem páginas vazias, acentos PT, inferidos por confirmar nunca presentes, relatório desatualizado nunca exportado, falhas tratadas.

## Integração financeira
Despesa só por ação explícita, `paid=0`, sem duplicados, preço por pessoa não vira total; eliminar comparação preserva despesas e fornecedores.

## Limitações
Análise IA real e partilha móvel não testadas (exigiriam serviços externos). Caracteres fora do alfabeto do PDF podem ser substituídos (sem corrupção).

## Testes
Compare servidor 140; Compare cliente 160 (novo); resto da suite: ver resultado final.
