# Inventário de segredos — exposição potencial e ordem de rotação

Nada foi aberto, copiado, impresso ou testado. Esta lista vem **só dos nomes** que o código declara (`index.js`) e do que já foi registado na auditoria. Não rodei, criei, alterei nem revoguei nenhum segredo.

## Evidência de exposição nos pacotes antigos
- **Confirmado:** `OPENAI_API_KEY` — o `.env.weddy-app-bd12f` (no zip de código e como variável de ambiente de todas as functions) tinha esta variável com valor (confirmei só que não estava vazia).
- **Não confirmado para os restantes.** Não registei os nomes das outras variáveis desse `.env`, e o código atual declara os restantes como `defineSecret` (Secret Manager, que **não** vai no zip). Só há risco de exposição se, em algum momento, algum destes valores também tiver sido colocado no `.env`, num `index.js.bak`/`*.antes-*` ou nos scripts administrativos. Para fechar isto sem mostrar valores, corre no teu computador (imprimem **só nomes** ou contagens):
  - Nomes no `.env`: `grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env.weddy-app-bd12f | sort` (mostra só `NOME=`).
  - Padrões de chaves nos backups e scripts (só nomes de ficheiros): `grep -lE "sk_live_|rk_live_|whsec_|-----BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}" *.bak *.antes-* dar-premium.js quem-comprou-premium-apple.js uso-premium-casamento.js 2>/dev/null`
  - Quem pode ler as fontes antigas no bucket: `gcloud storage buckets get-iam-policy gs://gcf-v2-sources-696758255059-europe-west1`
- Quem teve acesso às fontes: o zip esteve no bucket do projeto (acesso por IAM) e foi copiado para `~/weddy-recuperacao`. Mesmo sem prova de saída para fora, trata a chave OpenAI como exposta.

## Inventário (por serviço)
| Segredo (nome) | Funções que o usam | Onde o nome aparece | Exposição no pacote | Rotação interrompe? |
|---|---|---|---|---|
| `OPENAI_API_KEY` | `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport` | `index.js` (agora `defineSecret`); **`.env.weddy-app-bd12f` (com valor)** | **Sim, confirmada** | Só a IA, entre revogar a antiga e o deploy novo. Sem corte se criares a nova primeiro. |
| `SMTP_USER`, `SMTP_PASS` (+ params não secretos `SMTP_HOST/PORT/FROM`) | `sendRsvpReminders`, `sendContactMessage`, `sendCoupleEmailDigest`, `revenueCatWebhook` (alertas) | `index.js` (`defineSecret`) | Sem evidência (a verificar com os comandos acima) | Emails param se a palavra-passe antiga for invalidada antes do deploy. Sem corte se o fornecedor permitir uma 2.ª palavra-passe de aplicação. |
| `STRIPE_SECRET_KEY` | `createSubscriptionCheckout`, `stripeWebhook` | `index.js` | Sem evidência | Sem corte: o Stripe deixa “fazer rolar” a chave com a antiga a expirar mais tarde. |
| `STRIPE_WEBHOOK_SECRET` | `stripeWebhook` | `index.js` | Sem evidência | Sem corte: o Stripe mantém o segredo antigo válido durante a transição (rolagem). Entre o `secrets:set` e o deploy, assinaturas novas podem falhar; o Stripe repete o envio. |
| `REVENUECAT_WEBHOOK_AUTH` | `revenueCatWebhook` | `index.js` | Sem evidência | Janela curta em que a RevenueCat envia com o valor antigo (devolve 401 e repete). Alterar nos dois lados em seguida. |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | 6 funções `googleCalendar*` | `index.js` | Sem evidência | Sem corte se a Google Cloud Console permitir 2 segredos em simultâneo (permite): acrescenta, faz deploy, apaga o antigo. O Client ID não é secreto. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | `googleCalendar*`, `deleteWeddingAccount` | `index.js` | Sem evidência | **Sim, e é a mais delicada:** cifra os tokens de acesso já guardados. Trocar a chave sem recifrar torna os tokens ilegíveis (cada casal tem de voltar a ligar o calendário). **Só rodar se houver prova de exposição, e com um plano de migração.** |
| `APPLE_SIGNIN_PRIVATE_KEY` | `deleteWeddingAccount` | `index.js` (o *Team ID* e o *Key ID* no código não são segredos) | Sem evidência | Só afeta apagar conta de quem entrou com Apple (revogação do token). Rodar = criar chave nova no portal Apple, atualizar `APPLE_KEY_ID` no código e o segredo, deploy. |
| `WHATSAPP_VERIFY_TOKEN` | `whatsappWebhook` | `index.js` | Sem evidência | Só a verificação do callback na Meta; sem API ativa, impacto nulo. |
| `WHATSAPP_APP_SECRET` | `whatsappWebhook` | `index.js` | Sem evidência | Entre rodar na Meta e o deploy novo, a assinatura falha (403) e a Meta repete; STOPs recebidos nesse intervalo podem demorar. |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | `sendWhatsappRsvpReminder` | `index.js` | Sem evidência | Envio por WhatsApp não está ativo (decisão: sem Business API); o ID do número não é secreto. |

## Ordem recomendada
1. **`OPENAI_API_KEY`** (exposição confirmada, risco de custo): sequência 4.1 de `COMPARADOR-SECRETS-E-PACKAGING.md`.
2. **Verificar nomes** no `.env` e padrões nos backups/scripts (comandos acima). Se alguma outra chave aparecer, passa-a para a frente da fila.
3. **SMTP** (se aparecer exposto; senão, rotação normal): nova palavra-passe de aplicação → `secrets:set` → deploy das 4 funções que a usam.
4. **Stripe** (`STRIPE_SECRET_KEY` primeiro, depois `STRIPE_WEBHOOK_SECRET`) e **RevenueCat**: rolar no painel do fornecedor e atualizar o segredo na mesma hora, fora das horas de compra.
5. **Google Calendar** (`CLIENT_SECRET`), **WhatsApp**, **Apple**: só com indício de exposição ou rotina anual.
6. **`GOOGLE_TOKEN_ENCRYPTION_KEY`**: por último e só com plano de migração.
Depois de cada rotação: confirma como em 4.1 (sem imprimir valores) e **apaga** os zips locais e fontes antigas que continham o `.env`.
