# Relatório da Fase G — Memories e Documents (Premium)

Ramo `v325-import-guests`. Commit inicial `1662f5a` (Fase F). Tudo local; sem push, merge, deploy nem publicação.

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
41 suites: **40 passam**; falha `contact-stress` (formulário de contacto, 20 OK / 2 FAIL), tal como já tinha falhado numa corrida completa da Fase F.
- **Causa (confirmada):** sob carga, no cenário «IP único, 40/60 em paralelo», o limitador admite **menos** pedidos do que o limite (5–8 em vez de 8). É o lado seguro: nunca deixa passar mais (`bypass=0`, `fail-open=0`). O teste exige o número exato. Reproduzido com `CPU_LOAD=1`; passa isolado (22/22).
- Não tem relação com esta fase (`sendContactMessage` não foi tocado). **Não alterei o teste** (regra: não alterar testes para os fazer passar).

## Limitações (não testado)
- Atualização entre dois dispositivos reais, partilha/pré-visualização num telemóvel real.
- Envio real de fotos pelos convidados (rsvp.html/memorias.html) — fora desta fase; só as regras foram validadas.
- Memories carrega todas as fotos do casamento de uma vez (sem paginação) — adequado ao volume atual; a rever se houver milhares de fotos.
- Regras confirmadas apenas no emulador (não em produção).

## Estado final
**Parcialmente concluída.** Cumpridos: ciclos de Memories e Documents, uploads/eliminações protegidos, isolamento, regras Premium, preservação após expiração, sem P0/P1 em aberto, testes novos a passar, testes anteriores preservados, 4 documentos, commit local. **Falta:** o critério 10 (suite completa a 41/41) devido ao `contact-stress`, que depende de decisão sobre esse teste.
