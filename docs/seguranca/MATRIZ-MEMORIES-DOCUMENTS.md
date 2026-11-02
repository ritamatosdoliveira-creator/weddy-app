# Matriz — Memories e Documents (Fase G)

Legenda de evidência: **AUT-C** teste automatizado de cliente (`tests/ui/memdocs.py`, Firestore/Storage simulados); **AUT-R** teste automatizado de regras reais no emulador (`tests/rules/memdocs-rules.test.mjs` e `premium-rules.test.mjs`); **INSP** só inspeção de código (não é teste).

| Funcionalidade | Cenários | Resultado | Evidência | Estado |
|---|---|---|---|---|
| Memories — receber fotos | convidado envia pelo link/QR (rsvp.html/memorias.html, fora desta fase) | regras: token válido, Premium ativo, <8 MB, só imagem, só ficheiro novo | AUT-R | OK |
| Memories — criar/editar | o casal NÃO cria nem edita memórias (são fotos dos convidados) | não existe por desenho | INSP | N/A (não implementar) |
| Memories — consultar | ordenação (mais recentes), só do casamento atual, um pedido por carga | OK | AUT-C | OK |
| Memories — organizar | filtros Todas / Convite / QR; estado vazio; sem categorias (não planeado) | OK | AUT-C | OK |
| Memories — ver/guardar original | clique abre o original (https); `url` legado perigoso ignorado | corrigido | AUT-C | OK |
| Memories — ficheiro em falta | mostrado como «foto já não disponível» (antes: imagem vazia partida) | corrigido | AUT-C | OK |
| Memories — falha de leitura | sem ciclo de pedidos; aviso + «Atualizar» (antes: recarga em ciclo) | corrigido | AUT-C | OK |
| Memories — eliminar | confirmação; cancelar não apaga; falha Firestore mantém ficheiro; falha Storage registada | corrigido | AUT-C | OK |
| Documents — carregar | só PDF, ≤15 MB (limite exato), nome seguro, sem duplo envio | OK/corrigido | AUT-C | OK |
| Documents — falha de upload | rede/Premium/regras → mensagem, **nenhum registo sem ficheiro** | corrigido | AUT-C | OK |
| Documents — PDF ilegível | mensagem, nada guardado nem carregado | OK | AUT-C | OK |
| Documents — consultar | abre o documento certo (índice real); sem ficheiro → mensagem | corrigido | AUT-C | OK |
| Documents — eliminar | confirmação; documento certo; falha Storage registada; «não encontrado» não é erro | corrigido | AUT-C | OK |
| Documents — organização/pesquisa | lista simples sem categorias nem pesquisa na página (a pesquisa vive no Assistente) — não planeado, não acrescentado | — | INSP | N/A |
| Documents — anexos ligados | fornecedor/comparação/lua-de-mel excluídos da lista geral | OK | AUT-C | OK |
| Storage — isolamento | B lê/apaga/substitui/cria em W1; anónimo; e-mail não verificado; subpastas; fora da pasta | bloqueado | AUT-R | OK |
| Storage — tipos/limites | pdf/imagem; html, svg, zip bloqueados; 15 MB e 8 MB: limite exato | OK | AUT-R | OK |
| Storage — substituir foto de Memories | bloqueado (corrigido com `resource == null`) | corrigido | AUT-R | OK |
| Firestore memories | B/anónimo lêem/apagam; update; campos extra; guestName; token; casamento inexistente | bloqueado | AUT-R | OK |
| Premium ativo | upload/receção permitidos | OK | AUT-R, AUT-C | OK |
| Sem Premium / cancelado / expirado / estado inválido | novos uploads recusados; leitura e eliminação do conteúdo antigo permitidas | OK | AUT-R, AUT-C | OK |
| Preservação após expiração | nenhum cron/função apaga memórias/documentos (só `deleteWeddingAccount`, pedido pelo utilizador) | OK | INSP (grep a `index.js`) + AUT-C | OK |
| Contornar a interface | chamada direta ao upload sem Premium → registo não é criado | OK | AUT-C + AUT-R | OK |
| Interface 390/768/1360, PT/EN | sem scroll horizontal, sem português em EN, sem erros JS | OK | AUT-C | OK |
| Atualização entre dispositivos | Documents segue o estado do casamento (sincronização existente, testada noutras fases); Memories relê ao abrir/Atualizar | — | INSP | não testado em dois dispositivos reais |
| Regressão | suite completa | ver relatório | `run-all.js` | ver relatório |
