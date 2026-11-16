# Checklist de publicação — Weddy Compare

## Validado localmente
- Lógica cliente (preços, origem, assinatura, relatório, histórico, duplicar, eliminar, despesas) — 160 verificações.
- PDF real gerado com jsPDF 2.5.1 + autotable 3.8.2 e verificado (texto, páginas, renderização).
- Servidor `analyzeCompareProposal` / `generateCompareReport` — 140 verificações (OpenAI simulado).
- Isolamento entre casamentos e Premium no servidor.

## Precisa de publicação (não feito — nada foi publicado)
- Frontend `app/index.html` (alterações: `cmpStorageDelete`, normalização em `cmpList`).
- Nenhuma alteração de Functions ou Rules nesta fase.

## Precisa de configuração
- Nenhuma nova. `OPENAI_API_KEY` mantém-se como `defineSecret`.

## Precisa de validação em produção / casamento de teste
- Análise real de PDF digitalizado e de fotografia (exige chamadas reais à OpenAI — não feitas).
- Exportação em telemóvel real (partilha nativa) e em iOS Safari.
- Carregamento das bibliotecas jsPDF a partir da CDN em rede real.
- Pendência conhecida (não rodar nesta fase): chave OpenAI exposta no pacote de produção.
