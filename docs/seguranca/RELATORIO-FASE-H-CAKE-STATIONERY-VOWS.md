# Relatório — Fase H: Cake, Stationery e Vows (Premium)

Branch `v325-import-guests`, commit inicial `fd7a686`. Tudo local: **sem push, merge, deploy ou publicação**.

## 1. Estado real encontrado (auditoria)
- **Bolo** (`viewBolo`): modelo/pisos/tamanhos/sabores/recheios/alergénios, provas (nome, data, local, estado, sabores, recheios, texturas, notas, avaliação 1-5, escolha final) e inspirações (estilo, descrição, notas, foto). Sem secção «Ideias», sem fornecedores.
- **Papelaria** (`viewPapelaria`): itens (predefinidos + próprios, ocultáveis), estado, notas, paleta, tipos de letra, monograma, ficheiros (PDF/imagem até 15 MB, aprovação). Sem fornecedores.
- **Votos** (`viewVotos`): votos de cada noivo (privados ao casal), discursos (autor, momento, estado, notas privadas), leituras, músicas, momentos. Gravação por *debounce* com `flush` ao sair (`__vwFlush`), `pushRemote(true)` em `change`.
- Persistência: tudo vive no JSON do casamento (`weddings/{id}.json`); ficheiros em `documents/{weddingId}/`. Não há IA nem envio a serviços externos nestas áreas.

## 2. Problemas encontrados e corrigidos
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| H1 | P1 | Fotos de inspiração do bolo só em `localStorage` do browser (não sincronizavam, perdiam-se ao limpar dados). | Upload para `documents/{weddingId}/{ts}_cakeinsp_{id}.jpg` (reduzida 1080px), `photoPath` guardado na inspiração; URL resolvido via Storage; cópia local mantida como reserva; fotos antigas migram sozinhas (com Premium); apagar remove também o ficheiro. |
| H2 | P1 | Sem Premium, Bolo/Papelaria/Votos mostravam só a página de venda: conteúdo existente inacessível (incoerente com a política de Memories/Documentos). | Modo «Premium terminado»: o conteúdo continua visível para consultar e **apagar**; criar/editar/carregar bloqueado (campos só de leitura + bloqueio em fase de captura) e aviso com ligação ao Premium. Sem conteúdo → página de venda como antes. Nada é apagado. |
| H3 | P2 | Apagar ficheiro da Papelaria ignorava falhas do Storage (órfãos silenciosos). | `weddyStorageDelete(path,'stationery-file-delete-failed')` — falhas ficam em `_incident_log`. |
| H4 | P2 | Sem testes dedicados. | `tests/ui/cakestatvows.py` (129 verificações) + 7 casos em `rules-memdocs`. |

## 3. Premium e permissões
- Ativo: tudo normal. Sem Premium e sem conteúdo: página de venda. Expirado/cancelado com conteúdo: consulta + apagar (cliente) e Storage bloqueia novos uploads (regras `premiumOn`), leitura/apagar dos donos mantida (testado na emulação).
- Limite conhecido: o conteúdo de Bolo/Votos/Papelaria é texto no JSON do casamento; as regras do Firestore não distinguem campos dentro do JSON, por isso o bloqueio de edição sem Premium é **de cliente** (igual às fases anteriores). Não há migração nem limpeza destrutiva.

## 4. Segurança
- Firestore: sem regras específicas (dados no documento do casamento, já isolado por dono/weddingId — testado nas fases B–G).
- Storage: ficheiros em `documents/{weddingId}/` — A vs B (ler/criar/apagar/atualizar), anon, e-mail não verificado, expirado/cancelado, tipos, tamanho: cobertos por `rules-memdocs` (agora com casos `_cakeinsp_`). **Nenhuma regra alterada nesta fase → nada novo a publicar nas regras.**

## 5. Não validado / limitações
- Upload real para o Storage de produção e sincronização entre dois dispositivos reais: não executados (só emulador e testes de cliente).
- Teste manual em browsers reais: não executado.
- Fotos de inspiração antigas só migram quando o dispositivo que as tem abre a aba «Inspirações» com Premium.
- Compatibilidade PT/EN do aviso testada; restantes textos já existiam.

## 6. Publicação (não feita)
Publicar apenas `app/index.html` (nenhuma alteração a rules/functions). Ver `CHECKLIST-CAKE-STATIONERY-VOWS-PUBLICACAO.md`.
