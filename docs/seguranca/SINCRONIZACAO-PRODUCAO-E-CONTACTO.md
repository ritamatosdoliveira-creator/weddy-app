# Sincronização do código de produção e proteção do contacto

Estado: **só local** (branch `v325-import-guests`). Nada foi publicado, enviado (push), fundido (merge) nem feito deploy.

## 1. Funções incorporadas em `index.js`
| Função | Origem | Alteração face à produção |
|---|---|---|
| `analyzeCompareProposal` | produção 2026-10-30 (recuperada) | só `secrets: [OPENAI_API_KEY]` (D) |
| `generateCompareReport` | produção 2026-10-30 | só `secrets: [OPENAI_API_KEY]` (D) |
| `sendContactMessage` | produção 2026-10-27 | + proteção contra abuso (B) — resto idêntico |
| `APP_BASE_URL` | produção | `https://www.weddy.pt/app/` (corrige o valor local anterior) |

A reescrita anterior do contacto (`handleContactRequest`, `validateContactBody`, `contactEmailHtml`) foi **removida**. O trabalho A.1–A.4 e B.1 mantém-se. Sem exports duplicados.

## 2. Diferenças código local final vs produção recuperada
1. `OPENAI_API_KEY`: `defineString` (produção, valor em `.env`) → `defineSecret` (Secret Manager); `secrets:[OPENAI_API_KEY]` em `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport`. Comentários de instalação atualizados.
2. `sendContactMessage`: acrescentadas `CONTACT_LIMITS`, `contactClientIp`, `contactReserve`, `contactRelease` e 3 pontos no handler (reserva → 429/duplicado; libertar em falha SMTP). Mesmos campos, destinatário, assunto, formato, CORS, `maxInstances: 3`, honeypot e códigos 400/500.
3. Tudo o resto do ficheiro = `origin/main` + trabalho A.1–A.4/B.1 (inalterado).
Referências sem segredos em `recuperado-producao/`.

## 3. Proteção do formulário
- Por IP: 8/hora e 20/dia. Global: 30/hora e 100/dia. Excedido → `429 {ok:false}` (o site mostra o texto "escreve-nos para geral@weddy.pt").
- Duplicado (mesmo email + texto) 1×/24 h → `200 {ok:true}` sem reenviar.
- IP = **último** valor de `X-Forwarded-For` (acrescentado pela Google; o início é controlável pelo cliente), senão `req.ip`. Guardado só como hash SHA-256 com sal; nunca em claro.
- Armazenamento: coleção existente `siteRateLimits` (só servidor), docs `contact_ip_h_*`, `contact_ip_d_*`, `contact_g_h`, `contact_g_d`, `contact_dd_*` com `start`, `count`, `expireAt`. A limpeza diária existente apaga documentos com `start` > 24 h. `expireAt` permite um TTL opcional (não ativado).
- Concorrência: uma única transação Firestore lê todos os contadores e só escreve se todos passam (testado: 20 pedidos em paralelo → exatamente 8).
- Falha SMTP: a quota é devolvida. Falha Firestore: **fail-open** (aviso no log) para não perder contactos legítimos.
- Custo: ~5 leituras + 5 escritas por pedido válido — desprezável (<0,001 €/1000 pedidos). Sem impacto no SMTP dos lembretes de RSVP (partilham o transporte mas não o estado).
- IPs partilhados (escritórios/operadoras móveis): 8/h tolera várias pessoas; ajustável em `CONTACT_LIMITS`.
- Sem bloqueio CORS adicional.

## 4. OpenAI / Secret Manager (D)
- Código pronto: nenhum valor no projeto. **Não** foi criado nem alterado qualquer segredo.
- **Antes do deploy (ação da Rita):** `firebase functions:secrets:set OPENAI_API_KEY` (introduz o valor de forma interativa), rodar a chave e remover `OPENAI_API_KEY` do `.env.weddy-app-bd12f`. Sem o segredo criado, o deploy das 4 funções falha de propósito.
- Achados: o `.env.weddy-app-bd12f` com a chave em texto simples vai no zip de deploy; scripts de administração e cópias de segurança vão no pacote. O repositório não tem `firebase.json` com `functions.ignore` — adicionado `.gitignore` (`.env*`, `*.bak`, `*.zip`, chaves…). No diretório de deploy real deve existir um `.gcloudignore`/`functions.ignore` equivalente.

## 5. `sendRsvpReminders` e `whatsappWebhook` (C)
Não alterados. Quando existirem os zips de produção: `diff <(sed 's/\r//' producao.js) index.js` restrito ao bloco de cada função, e registar diferenças aqui antes de qualquer decisão.
