# Proposta de política para `_incident_log` (K-7) — K.1-D

**Estado:** PROPOSTA. Nenhum registo foi eliminado ou alterado; retenção definitiva depende de aprovação administrativa.

## 1. Auditoria
| Pergunta | Resposta (verificada) |
|---|---|
| Onde | Coleção Firestore `_incident_log` (raiz) |
| Quem escreve | (a) Cliente autenticado com email verificado (regra: só `create`, ≤12 campos; valores sem limite de tamanho); (b) servidor: webhooks Stripe/RevenueCat, falhas de escrita |
| Quem lê | **Ninguém pelo cliente** (sem `get/list`); só Admin SDK/consola |
| Conteúdo (cliente) | `weddingId`, `type`, `at`, `userAgent`, e conforme o tipo: `errorMessage`/`error` (texto de erro), `paths` de campos reparados, contagens `before/after`, `failedTokens` (até 50 **tokens de convite RSVP**, que funcionam como credencial de acesso a `guests/{token}`), caminhos de ficheiros pendentes de apagar |
| Conteúdo (servidor) | motivo, `weddingId`, tipo de evento, ids de sessão/transação; podem incluir identificadores de pagamento |
| Dados pessoais | Indiretos: `userAgent`, `weddingId`, nomes de ficheiros (`storagePath` pode ter nome original), mensagens de erro que possam incluir valores. Fase J: pode haver cópias de estado noutros pontos (quarentena), não aqui |
| Retenção atual | **Nenhuma** (cresce indefinidamente; apagado na eliminação do casamento por `weddingId`) |
| Crescimento | Imprevisível: um bug de cliente em ciclo pode criar milhares de documentos (cada utilizador verificado pode criar sem limite) |
| Custo | Documentos pequenos (<2 KB): milhares custam cêntimos; o risco é de **abuso/loop** e de ruído que esconde incidentes reais |
| Alertas | **Nenhum automático**: só se descobre a ler a consola |

## 2. Proposta (a aprovar)
1. **Limite de tamanho por registo** nas regras (ex.: `errorMessage`/`error` ≤ 500 caracteres; `failedTokens` ≤ 50 de ≤ 64 caracteres; `userAgent` ≤ 300; `request.resource.data.keys().hasOnly([...])` com lista fechada). Muda regras → publicação com aprovação; testável em emulador. Compatível com os campos atuais.
2. **Retenção recomendada** (a decidir): registos técnicos de cliente 90 dias; registos de pagamento (`stripeWebhook`, `revenueCatWebhook`) enquanto o incidente estiver por resolver + período fiscal/contabilístico a validar; eliminação por `expireAt` + TTL **só depois** de política aprovada.
3. **Agregação**: para repetições do mesmo `type`+`weddingId` no mesmo dia, incrementar contador em vez de novo documento (reduz o risco de loop); implementado no servidor (função `onDocumentCreated`) ou no cliente com *throttle* (máx. 1 por tipo por sessão).
4. **Sem dados pessoais**: nunca gravar tokens de convite completos (guardar só os últimos 6 caracteres + contagem); sem nomes de ficheiros originais; truncar mensagens de erro; remover `userAgent` completo (guardar família do browser).
5. **Alertas para erros críticos**: Cloud Monitoring/Logging com alerta (email) sobre (i) `type in (stripeWebhook, revenueCatWebhook)` → pagamento possivelmente não ativado; (ii) `possible_data_loss_snapshot_blocked` / `outgoing_write_blocked_*` (perda de dados evitada); (iii) taxa anómala (>N docs/hora). Alternativa sem custo: o servidor envia email à administração (já existe `notifySalesAlert`/SMTP) para (i)–(ii).
6. **Arquivo**: opcional exportação mensal agregada (BigQuery/CSV) sem identificadores — só se a administração o quiser.

## 3. Decisões necessárias
Prazo de retenção por categoria; se se envia alerta por email; quem recebe; aceitar limitar campos (impede campos futuros sem rever regras); aprovar remoção de tokens/`userAgent` completo. **Nada é ativado nesta fase.**
