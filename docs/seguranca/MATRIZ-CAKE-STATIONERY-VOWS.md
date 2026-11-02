# Matriz — Cake, Stationery e Vows (Fase H)

Legenda: **A** automático (UI Playwright), **R** regras (emulador), **M** manual não executado, **—** n/a.

| Cenário | Bolo | Papelaria | Votos | Teste |
|---|---|---|---|---|
| Premium ativo: uso normal, sem aviso | ✔ | ✔ | ✔ | A |
| Sem Premium, sem conteúdo → venda | ✔ | ✔ | ✔ | A |
| Premium terminado, com conteúdo → consulta | ✔ | ✔ | ✔ | A |
| Terminado: criar prova/inspiração bloqueado | ✔ | — | — | A |
| Terminado: edição de texto bloqueada (mesmo forçando o DOM) | — | — | ✔ | A |
| Terminado: upload de ficheiro bloqueado | — | ✔ | — | A (+R no Storage) |
| Terminado: apagar permitido | ✔ | ✔ | ✔ | A (cliente), R (Storage) |
| Dados preservados após expirar | ✔ | ✔ | ✔ | A |
| Cancelado / assinatura inválida | ✔ | ✔ | ✔ | R (Storage) |
| Escrever voto, gravar, re-render | — | — | ✔ | A |
| PT / EN sem texto misto | ✔ | ✔ | ✔ | A |
| 390 / 768 / 1360 px, sem scroll horizontal | ✔ | ✔ | ✔ | A |
| Foto de inspiração no Storage (criar A, negar B/anon/expirado) | ✔ | — | — | R |
| Apagar ficheiro com falha registada | ✔ | ✔ | — | código (`weddyStorageDelete`) |
| A vs B leitura/escrita/apagar em `documents/` | ✔ | ✔ | — | R |
| Sync real entre dispositivos / Storage de produção | M | M | M | não executado |
