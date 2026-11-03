# Revogação de tokens de download ao remover co-dono (K.2-2)

**Estado:** implementado localmente, testado com Storage **simulado** (mock). Não publicado. Nenhum ficheiro real tocado.

## Mecanismo
Novo trigger `revokeDownloadTokensOnOwnerRemoval` (`onDocumentUpdated` em `weddings/{weddingId}`, europe-west1). Compara `ownerEmails`/`ownerUids` antes e depois (emails sem distinção de maiúsculas). Se alguém foi **removido**, roda `firebaseStorageDownloadTokens` de todos os ficheiros em `documents/{id}/`, `memories/{id}/` e `sites/{id}/` (mesmo padrão já usado em `siteRotatePhotoTokens`, Fase I). Os URLs antigos deixam de funcionar.

## Garantias
- **Nenhum ficheiro é apagado.** Só se muda o token.
- Os membros que ficam mantêm acesso: a app obtém URLs novos on-demand (`getDownloadURL`, guarda-se `storagePath`); as regras de Storage continuam a autorizar pelos donos atuais. A galeria do site refresca os URLs sozinha.
- Outros casamentos (inclusive ids com prefixo parecido), `public-sites/` e `feedback/` não são tocados (prefixo termina em `/`).
- Acrescentar dono, mudar maiúsculas, criação/eliminação do casamento: nada acontece.
- Idempotência: registo `downloadTokenRevocations/{eventId}` (só servidor, sem emails, só contagens e estado `done/partial/failed`); evento repetido não repete. Falhas parciais/totais são registadas e **nunca lançam** (não há retry em loop).
- `deleteWeddingAccount` apaga também esses registos.

## Limitações
- Quem já descarregou o ficheiro mantém a cópia. Revoga-se o *link*, não o conteúdo já obtido.
- Em falha parcial a revogação fica incompleta (estado `partial`); repetir exige nova alteração de donos ou reexecução manual [X].
- O trigger corre em cada atualização do casamento (retorno imediato se ninguém foi removido): custo de invocação, sem custo de Storage.
- Memórias: links partilhados a convidados (`memories/{id}/publico/…`) também são invalidados; os convidados voltam a obtê-los pela página pública de memórias.
- Não testado com Storage real (só mock) → validar no projeto de teste antes de produção.
