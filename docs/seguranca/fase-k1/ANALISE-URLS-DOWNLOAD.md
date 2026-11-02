# Análise: URLs de download com token (K-5) — K.1-C

**Estado:** análise. Nenhum URL invalidado, nenhum ficheiro alterado.

## 1. Como os URLs nascem e onde ficam (verificado em `app/index.html`, `storage.rules`, `index.js`)
| Contexto | Criação | Persistência | Observação |
|---|---|---|---|
| Documents, Memories, Cake/Stationery (fotos), anexos de fornecedores | `storage.ref(path).getDownloadURL()` **no momento da consulta** (a app guarda `storagePath`, não o URL) | Em memória durante a sessão; não é gravado no estado | Um URL só existe se o utilizador o abriu; "liveUrl" renovado a cada abertura |
| Rascunho do Website (fotos) | `getDownloadURL()` e guardado no rascunho (`siteSet`) | Firestore `weddingSites/{id}` (legível só pelos donos) | Fase I: ao expirar o Premium o servidor **roda os tokens** (`siteRotatePhotoTokens`) |
| Website público | Servidor **copia** as fotos para `public-sites/{slug}/` (sem token; leitura via regras enquanto publicado e válido) | Snapshot público | Despublicar/expirar → regras negam |
| Feedback (capturas) | Upload com URL não necessário | Só `storagePath` | Ninguém lê pelo cliente |

Conclusão: **links persistentes com token só existem no rascunho do Website** (já tratado). Para Documents/Memories, o risco é um URL **já obtido e copiado** por alguém com acesso na altura (casal ou co-dono).

## 2. Comportamento atual por cenário
| Cenário | Acesso pelas regras | URLs já obtidos |
|---|---|---|
| Co-dono removido | Perde leitura/escrita/apagar (testado: `rules-hardening`) | Continuam a funcionar até o token ser rodado/o ficheiro apagado |
| Casamento eliminado | Ficheiros apagados em cascata (`deleteStoragePrefix`) | Deixam de funcionar (ficheiro não existe) |
| Premium expira | Documents/Memories: leitura e apagar mantêm-se ao casal; criar bloqueado | URLs mantêm-se (o conteúdo continua do casal) — comportamento pretendido |
| Revogação individual | Possível via Admin SDK (`setMetadata({firebaseStorageDownloadTokens: novo})`) ficheiro a ficheiro; **não existe** hoje fluxo na app | — |
| Links públicos antigos | Não identificados no repositório; **verificar na consola** (ficheiros com tokens em produção) → [X] |

## 3. Opções
| Opção | Descrição | Prós | Contras / custo |
|---|---|---|---|
| 0. Aceitar e documentar | Informar que URLs partilhados mantêm-se até apagar/rodar | Zero custo | Risco residual quando um co-dono é removido |
| 1. Rodar tokens ao remover co-dono | Trigger `onDocumentUpdated(weddings)` que deteta `ownerEmails` a encolher e roda tokens de `documents/`, `memories/`, `sites/` do casamento (padrão já existente na Fase I) | Fecha o cenário principal; invisível ao casal | Custo O(ficheiros) por remoção; **quebra URLs abertos noutro dispositivo** (a app volta a pedir URL → ok); nova função (deploy); testes em emulador com Storage simulado |
| 2. Rodar tokens periodicamente / ao expirar Premium | Como Fase I para todo o Storage | Cobre expiração | Custo recorrente; links partilhados legitimamente pelo casal deixam de funcionar |
| 3. Deixar de usar URLs com token (URLs assinados curtos via função) | Função devolve *signed URL* de 15 min após validar o dono | Revogação imediata e granular | Reescreve todos os pontos de leitura; mais latência/custo; maior risco de regressão |

## 4. Recomendação
**Opção 1** (rodar tokens quando um dono é removido), com âmbito limitado a `documents/{id}/` e `memories/{id}/` e execução idempotente e não bloqueante; **Opção 0 documentada** até lá. Não rodar nada agora. Decisões: aprovar o comportamento ("remover co-dono revoga links já partilhados"), e confirmar na consola se existem links públicos antigos. Plano de testes: emulador (remoção de co-dono → tokens novos só nesse casamento; outro casamento intacto; repetição idempotente; falha a meio não perde ficheiros), teste real: abrir documento antes/depois com dois dispositivos.
