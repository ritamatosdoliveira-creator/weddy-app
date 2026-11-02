# Nov 2026 — sendContactMessage, double opt-in WhatsApp e email resumo (A.2)

Estado: **local, sem commit de publicação, nada implantado**. Decisões da Rita de 2026-11-02.

## 1. Origem das 3 funções (`firebase functions:list`)
Não consegui executar: esta sessão não tem credenciais Firebase/Google (`firebase login` e `gcloud auth` sem conta) e o computador da Rita não estava ligado à sessão. Não iniciei sessão nem usei credenciais. **Comandos para a Rita correr** (só leem):
```
firebase functions:list --project weddy-app-bd12f
firebase functions:list --project weddy-premium-teste
grep -rl "generateCompareReport\|sendContactMessage\|analyzeCompareProposal" ~/weddy-app ~/Desktop ~/Downloads 2>/dev/null
```
Se `sendContactMessage` já existir em produção, **o deploy da versão deste repositório substitui-a** (mesmo nome): comparar antes com o código antigo, se aparecer.

## 2. `sendContactMessage` — auditoria e reescrita local
Sem o código original, a auditoria foi feita sobre o contrato do cliente (`contactos.html`) e a função foi **reescrita** em `index.js` com as defesas abaixo. Riscos de um endpoint anónimo que envia email com o remetente da Weddy (o que uma versão sem estas proteções permitiria): relay de spam, injeção de cabeçalhos (Bcc), HTML/phishing no corpo, abuso por volume.
| Defesa | Detalhe |
|---|---|
| Método/formato | só POST JSON; corpo ≤ 8 KB; OPTIONS tratado |
| CORS | só `https://www.weddy.pt` e `https://weddy.pt`; outras origens → 403 |
| Destinatário fixo | `geral@weddy.pt`; o email do visitante vai só em `Reply-To` (nunca é destinatário) |
| Cabeçalhos | CR/LF removidos de nome/email/assunto; assunto só de lista fixa; email validado (sem `,;<>"`) |
| HTML | tudo escapado |
| Honeypot | campo `website` preenchido → 200 sem enviar |
| Limites | 5/hora por IP (hash), 200/dia globais, em transação |
| Tamanhos | nome ≤ 100, email ≤ 254, mensagem 10–4000 |
| Erros/logs | sem dados pessoais nos logs; SMTP em baixo → 502 genérico |
Testes: `tests/contact/send-contact.test.js` (35). Limitações: sem CAPTCHA (decisão de produto; o limite por IP é a defesa principal); `req.ip` depende do proxy do Google (aceitável); confirmar que o limite global de 200/dia serve.

## 3. Double opt-in WhatsApp
- Marcar a caixa em `rsvp.html` → registo `pending` (código de 6 dígitos, só o hash fica guardado, validade 72 h, 5 tentativas). **Nenhum envio é permitido em `pending`.**
- O convidado envia **"SIM <código>"** do próprio WhatsApp para o número da Weddy; o webhook (remetente autenticado pela Meta) valida número + código → `granted` (`source: rsvp_page+whatsapp_reply`).
- Fecha o risco residual (o casal fazer-se passar pelo convidado): o casal vê o link, mas não controla o telemóvel do convidado.
- Retirar/cancelar: desmarcar, STOP, mudar/remover número → cancela também o pedido pendente.
- Novo parâmetro de deploy **`WHATSAPP_PUBLIC_NUMBER`** (número do WhatsApp Business, só dígitos; `firebase functions:config`/`.env`). Sem ele, o convidado vê o código mas não o botão "Abrir o WhatsApp".
- Limitação: o webhook **não responde** ao convidado ("confirmado") — responder fora de template exige a janela de 24 h e chamadas à Meta, que não testei; é um passo opcional futuro.
- Nota: o casal consegue ler o `codeHash` (regras permitem `get` do registo); não permite confirmar (exige o telemóvel do convidado).
- Testes: `tests/consent/whatsapp-consent.test.js` (71), UI `t_rsvp.py` (42), ficha `t_sheet.py` (11).

## 4. Email resumo (A.2, 1.ª fase)
- `sendCoupleEmailDigest` (diário 10:00 Lisboa; resumo à segunda) e `unsubscribeNotify` (HTTP).
- **Desligado por defeito**: só envia com o parâmetro `NOTIFY_EMAIL_ENABLED=true`. Desligado, calcula e regista apenas contagens nos logs.
- Defeito para o casal: resumo semanal ligado + alertas extraordinários (pagamentos/tarefas em atraso, prazo do RSVP ≤ 3 dias com convidados por responder, casamento ≤ 7 dias). Tetos: 1/dia e 3/semana; alertas repetidos só após 14 dias. Preferências na app (Notificações → Preferências → Email).
- Estado de envio no servidor (`notifState`, sem acesso do cliente). Anulação sem login (HMAC por casamento, GET confirma / POST anula, `List-Unsubscribe` one-click).
- Conteúdo: contagens + títulos de tarefas do próprio casal; **sem valores nem fornecedores**; secção de convidados só em Premium.
- Reutiliza o SMTP atual (`buildTransporter`). Adequação: volume baixo OK; confirmar limites do alojamento partilhado (ver `docs/produto/A2-push-e-email-resumo.md`).
- Custo: o agendador varre `weddings` em páginas de 100 (máx. 2000/execução) — a otimizar com um índice de "canais ativos" quando crescer.
- Testes: `tests/notify/email-digest.test.js` (61), UI das preferências `t3.py` (14), regressão A.2 `t1.py` (28) e `t2.py` (32).
- Limitações: texto só em PT (EN fica para A.4/fase i18n); sem push (fase 2); URL de anulação fixa no projeto `weddy-app-bd12f`.

## 5. Para publicar (acrescenta a PROCEDIMENTO-PUBLICACAO.md)
Functions novas/alteradas: `sendContactMessage`, `unsubscribeNotify`, `sendCoupleEmailDigest`, `setGuestWhatsappConsent`, `getGuestWhatsappConsent`, `whatsappWebhook`, `updateGuestPhone`. Parâmetros novos: `WHATSAPP_PUBLIC_NUMBER`, `NOTIFY_EMAIL_ENABLED` (deixar `false` até testar com uma conta própria). Regras: `notifState`.
