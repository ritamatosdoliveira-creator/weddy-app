# `sendRsvpReminders` e `whatsappWebhook` — comparação e recuperação

Estado: **nada foi alterado** nestas duas funções por esta fase. Comparação **indireta** (os zips destas duas ainda não foram recuperados).

## 1. Recuperação (só leitura; sem deploy)
Os zips ainda não estão em `~/weddy-recuperacao` (lá só estão `analyzeCompareProposal`, `generateCompareReport` e `sendContactMessage`). No teu terminal (usa o teu login do gcloud; apenas lê o bucket de fontes e **extrai só `index.js` e `package.json`, nunca o `.env`**):
```
cd ~/weddy-recuperacao
for f in sendRsvpReminders whatsappWebhook; do
  B=$(gcloud functions describe $f --gen2 --region europe-west1 --project weddy-app-bd12f --format='value(buildConfig.source.storageSource.bucket)')
  O=$(gcloud functions describe $f --gen2 --region europe-west1 --project weddy-app-bd12f --format='value(buildConfig.source.storageSource.object)')
  gsutil cp "gs://$B/$O" "./$f.zip"
  unzip -p "$f.zip" index.js > "index.js.producao-$f"
  unzip -p "$f.zip" package.json > "package.json.producao-$f"
  gcloud functions describe $f --gen2 --region europe-west1 --project weddy-app-bd12f --format='value(updateTime,serviceConfig.availableMemory,serviceConfig.timeoutSeconds)'
done
ls -l index.js.producao-*
```
Depois, só com os dois `index.js.producao-*` (nunca os zips) a comparação é uma linha:
`node recuperado-producao/comparar-funcao.js sendRsvpReminders,whatsappWebhook ~/weddy-recuperacao/index.js.producao-sendRsvpReminders ~/weddy-recuperacao/index.js.producao-whatsappWebhook index.js`
O script (`recuperado-producao/comparar-funcao.js`) é só leitura, compara cada função e as funções/constantes de que depende (sem comentários nem espaços) e omite qualquer texto que pareça um segredo.

## 2. Comparação indireta já feita (`origin/main` × produção de 27/10 × código local)
A produção de 27/10 (`index.js` do zip do `sendContactMessage`, deploy 20:24:34) é do mesmo lote de deploys que `sendRsvpReminders` (20:24:28) e `whatsappWebhook` (20:24:35). Em v2 todas as funções de um deploy usam o mesmo `index.js`; isto é **forte indício**, não prova, de que o implantado nas duas é esse ficheiro.

| Função | `origin/main` × produção 27/10 | Local × `origin/main` |
|---|---|---|
| `sendRsvpReminders` (+ 21 unidades de que depende) | **idênticas** | **idênticas** (nenhuma alteração local) |
| `whatsappWebhook` (o próprio handler) | **idêntico** | **idêntico** |
| …dependências do webhook | idênticas | **3 diferenças locais, minhas (A.1–A.3):** `recordWhatsappOptOut` (um STOP passa também a revogar o registo em `whatsappConsents`, em transação), e as novas `consentRevocationPatch` e `WHATSAPP_CONSENT_HISTORY_MAX` |

**Consequência:** publicar o `index.js` local muda o efeito de um STOP recebido pelo `whatsappWebhook` (revoga também o consentimento guardado no servidor). É a intenção da A.3, mas é uma mudança de comportamento em produção que só deve sair com a tua autorização explícita.

## 3. Comportamento confirmado (pelo código; produção por confirmar com os zips)
- `sendRsvpReminders` (agendada, 09:00 Lisboa): só Premium válido; envia por **email** quando faltam exatamente **7, 3 ou 1** dias para `rsvpDeadline`; máximo fixo 3 por convidado (`MAX_REMINDERS`); não envia a quem já respondeu sim/não ("talvez" continua a receber); teto 150 por casamento por execução; email validado. **Não** tem intervalo 2–30 dias nem máximo 1–10 configuráveis (defeitos 5 e 3 não existem) e **não lê** `settings.rsvpAutopilot`: um casal que configure "máx. 2" no Autopilot continua a receber do servidor o 3.º. Duplicação possível (contador atualizado depois do envio, sem transação).
- `whatsappWebhook`: GET = verificação Meta (`hub.verify_token`); POST valida `X-Hub-Signature-256`, responde 200 e processa cada mensagem; só trata opt-out (STOP/PARAR…); **não** confirma consentimento por resposta (a `confirmWhatsappConsentByReply` existe mas não está ligada); não envia mensagens.

## 4. Antes de alterar qualquer uma
1. Recuperar os zips e correr a comparação acima (se as duas saírem idênticas a `origin/main`, esta tabela passa de indício a confirmação).
2. Só então decidir, com autorização tua, o alinhamento do `sendRsvpReminders` com o Autopilot (2–30 dias, 1–10 lembretes, defeitos 5 e 3, idempotência) e a publicação da revogação por STOP.
