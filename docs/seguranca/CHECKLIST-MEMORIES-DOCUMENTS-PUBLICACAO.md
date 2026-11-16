# Checklist de publicação — Memories e Documents (Fase G)

**Nada foi publicado.** Estado: tudo local no commit da Fase G.

## Ficheiros a publicar
- `app/index.html` (frontend: correções de Memories/Documents, novas mensagens PT/EN).
- `storage.rules` (**alterado**): memórias só aceitam criação de ficheiro novo (`resource == null`).

## Regras Firestore
- Sem alterações nesta fase.

## Regras Storage
- Publicar `storage.rules`. Impacto: reenviar para um caminho já existente em `memories/` passa a ser recusado. Os envios reais usam caminhos únicos (data + sufixo aleatório), por isso o fluxo normal não é afetado.

## Cloud Functions
- Nenhuma alteração.

## Configuração / dependências
- Sem novas configurações, secrets ou serviços. `jspdf`/`jspdf-autotable` continuam só como devDependencies de teste (Fase F).

## Testes pós-publicação (manuais, casamento de teste)
1. Convidado envia foto pelo link de RSVP e pelo QR público → aparece em Weddy Memories.
2. Eliminar uma memória → o ficheiro desaparece do Storage.
3. Carregar um PDF em Documentos → abrir → eliminar.
4. Com Premium expirado: documentos e fotos antigas abrem e podem ser eliminados; novos uploads são recusados com mensagem clara.
5. Confirmar no `_incident_log` que não aparecem `*-file-delete-failed` inesperados.
