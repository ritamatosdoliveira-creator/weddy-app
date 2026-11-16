# Relatório da Fase G — Memories e Documents (Premium)

Ramo `v325-import-guests`. Commit inicial `1662f5a` (Fase F); commit final indicado no resumo. Tudo local; sem push, merge, deploy nem publicação.

## Estado inicial (auditado)
- **Memories** é a galeria das fotos que os **convidados** enviam (link de RSVP / QR público). O casal consulta, filtra (Todas/Convite/QR), abre o original e elimina. Não existe criar/editar/categorias — por desenho, e não foi acrescentado.
- **Documents** guarda PDFs (com texto extraído para o Assistente). A página lista, abre e elimina. Anexos de fornecedor/comparação/lua-de-mel vivem nas respetivas áreas. Não existem categorias nem pesquisa na página (a pesquisa por texto é do Assistente) — não planeado, não acrescentado.
- Regras Storage/Firestore já isolavam por casamento e exigiam Premium para novos uploads; ler e eliminar ficam sempre permitidos ao casal.
- Nenhuma função do servidor apaga memórias/documentos quando o Premium acaba (só `deleteWeddingAccount`, pedido pelo utilizador).

## Problemas encontrados e corrigidos
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | P1 | Memories: se a leitura falhava, a página repetia o pedido em ciclo (custo de leituras Firestore) | `memoriesError`: não repete sozinha; aviso + «Atualizar» |
| 2 | P1 | Documents: se o envio ao Storage falhava (rede, Premium, regras, nome inválido), ficava um registo **sem ficheiro**, em silêncio | Sem registo; mensagem clara (Premium vs. tentar de novo) |
| 3 | P2 | Falhas ao apagar ficheiros no Storage (memórias e documentos, incl. anexos de fornecedor) eram silenciosas | `weddyStorageDelete`: regista o caminho pendente em `_incident_log`; «não encontrado» não é erro |
| 4 | P2 | Memories: foto em falta no Storage aparecia como imagem vazia | Marcador «esta foto já não está disponível» |
| 5 | P2 | Memories: `url` legado (ex. `javascript:`) ia para o `href` | Só `https:` (ou imagem `data:`) é renderizado |
| 6 | P2 | Documents: nome do ficheiro ia cru para o caminho do Storage | `weddySafeFileName` (sem caminhos, acentos nem caracteres especiais) |
| 7 | P2 | Documents: duplo envio simultâneo criava dois registos | Guarda de envio em curso |
| 8 | P2 | Documents: abrir um documento sem ficheiro não fazia nada | Mensagem clara |
| 9 | P1 | Storage: foto existente em `memories/` podia ser substituída (`update: false` não era respeitado no emulador, nem pelo dono) | `allow create: if resource == null && …` em `storage.rules` |

Alterações de ficheiros: `app/index.html`, `storage.rules`; testes `tests/ui/memdocs.py`, `tests/rules/memdocs-rules.test.mjs`, gancho `md` em `tests/ui/common.py`, `tests/run-all.js`.

## Testes novos
- **Cliente (automatizado)** `ui-memdocs`: 94/94 — ciclo, ordenação, filtros, upload/erros, nomes malformados, 15 MB exatos, duplo envio, eliminação, Premium (incl. chamada direta), dados antigos, 390/768/1360 em PT e EN.
- **Regras reais no emulador (automatizado)** `rules-memdocs`: 87/87 — A vs. B, anónimo, e-mail não verificado, subpastas, tipos/limites exatos, substituição, tokens, campos extra, Premium ativo/cancelado/expirado/estado inválido (conteúdo antigo legível e eliminável, novos uploads recusados).

## Suite completa
**41/41 suites aprovadas** (`tests/reports/last-run.json`): as 38 anteriores às Fases F/G, mais `ui-compare` (160), `ui-memdocs` (94) e `rules-memdocs` (87). `rules-premium` 72/72, `compare` 140/140, `contact-stress` 22/22.

### Caso `contact-stress` (resolvido)
Na primeira corrida da Fase G (e já numa corrida completa da Fase F) falhou o cenário «IP único, 40/60 em paralelo» por esperar **exatamente** 8 pedidos aceites.
- **Causa técnica (demonstrada):** o limitador (`contactReserveRetry`) repete a transação até 12 vezes; se continuar contendida, trata o pedido como `limited` — a contenção num contador é sinal de rajada (antes era fail-open e deixava passar tudo; corrigido na Fase C). Com 40–60 pedidos simultâneos no mesmo contador e CPU partilhada, alguns dos 8 pedidos legítimos esgotam as tentativas e são recusados. É o lado **seguro**. Observado: 40 em paralelo sob carga → 3–8 aceites; 60 → 1–8 aceites; `fail-open=0`; nunca mais de 8; sem emails duplicados.
- **O teste já previa este conceito** (`atMost`, usado no cenário dos 40 IPs). Código de produção **não foi alterado**.
- **Ajuste ao teste (`tests/contact/concurrency-stress.test.js`):** os cenários de 40 e 60 do mesmo IP passam a `atMost` (1 ≤ aceites ≤ 8). Mantém-se: nunca acima do limite; nenhum email duplicado; contorno do limite (mais emails do que o permitido). **Acrescentado:** piso de 1 aceite (em concorrência otimista pelo menos uma transação confirma por ronda; recusar tudo seria falha real) e coerência «cada 200 = exatamente 1 email». Os cenários de 10 e 20 pedidos continuam com expectativa **exata** (8). O isolado mantém 22/22 verificações. A razão técnica está no cabeçalho do teste.
- **Nota de ambiente:** o `run-all` corta cada suite aos 15 min; com carga de CPU artificial o `contact-stress` completo ultrapassa esse limite (resultado «exit null», não uma verificação falhada). Os cenários alterados foram por isso validados sob carga em separado. Processos de carga órfãos (de corridas cortadas) falseiam as medições: matar `node -e for(;;){}` antes de medir.

## Limitações (não testado)
- Atualização entre dois dispositivos reais, partilha/pré-visualização num telemóvel real.
- Envio real de fotos pelos convidados (rsvp.html/memorias.html) — fora desta fase; só as regras foram validadas.
- Memories carrega todas as fotos do casamento de uma vez (sem paginação) — adequado ao volume atual; a rever se houver milhares de fotos.
- Regras confirmadas apenas no emulador (não em produção).

## Estado final
**Concluída (local).** Os 14 critérios estão cumpridos: ciclos de Memories e Documents validados, uploads/eliminações protegidos, isolamento e regras Premium validados, dados preservados após expiração, sem P0/P1 em aberto, testes novos a passar, suite completa 41/41, testes anteriores preservados, 4 documentos, árvore limpa e commit local. Nada foi publicado.
