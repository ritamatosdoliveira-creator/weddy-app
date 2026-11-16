# A.2 — O que falta: push em segundo plano e email resumo (arquitetura e custos)

Estado: **só proposta**. Nada disto está implementado nem deve ser implementado sem aprovação da Rita (pedido de 2026-11-01).
Contexto: A.2 (notificações inteligentes) está concluída **localmente**: centro de notificações dentro da app, preferências, prioridades, limites diários, silêncio 22h–8h e avisos do sistema **com a app aberta ou recentemente aberta**.

## 1. O que já existe e o que falta

| Canal | Estado | Detalhe |
|---|---|---|
| Notificações internas (centro + sino) | **Feito (local)** | Calculadas no dispositivo a partir dos dados do casal. Aparecem quando a app é aberta. |
| Aviso do sistema com a app aberta/em segundo plano recente (`Notification` do browser) | **Feito (local)** | Só onde o browser o suporta; máx. 2 por dia, só urgentes. **Não funciona** na app iOS (Capacitor/WKWebView) nem com a app fechada. |
| Push em segundo plano (app fechada) | **Falta** | Precisa de servidor, tokens por dispositivo e (nas apps das lojas) uma nova versão nativa. |
| Email resumo para o casal | **Falta** | Precisa de função agendada e lógica de avisos no servidor. O SMTP e o agendador já existem (lembretes RSVP a convidados). |
| Lembretes a convidados por email | **Já existe** | `sendRsvpReminders` (9:00 Lisboa, 7/3/1 dias antes do prazo). Não é A.2. |

Limitação estrutural: hoje os avisos são calculados **no cliente**, a partir de `state` (que é o `json` do casamento). Para avisar com a app fechada, o servidor tem de **recalcular** os mesmos avisos.

## 2. Arquitetura proposta (comum aos dois canais)

```
Cloud Scheduler (1x/hora, por fuso)
        │
        ▼
  notifyCouples()  ── lê weddings ativos (só os que têm canais ligados)
        │              └─ parse json → geradores partilhados (mesma lógica do cliente)
        ▼
  notifState/{weddingId}   (documento do SERVIDOR; o cliente só lê)
        │   chaves já enviadas, contador diário, último resumo, preferências efetivas
        ▼
  ┌─────────────┬───────────────────┐
  │ Push (FCM)  │ Email (SMTP/ESP)  │
  └─────────────┴───────────────────┘
```

Princípios:
1. **Uma só fonte de regras.** Extrair os geradores (`ntGenRsvp`, `ntGenTasks`, `ntGenPayments`, `ntGenChanges`, `ntGenHealth`, …) para um módulo partilhado, testado uma vez, usado pelo cliente e pelo servidor. Sem isto, o centro dentro da app e o email divergem (avisos duplicados ou contraditórios).
2. **Estado de envio no servidor** (`notifState/{weddingId}`, escrita só pelas funções, regras `write:false`). Hoje as chaves de deduplicação vivem em `state.notif` (no `json`, editável pelo cliente e com "o local ganha" na fusão): não serve para limitar envios fora da app.
3. **Mesmos limites anti-spam** que o cliente: tetos diários, silêncio, agrupamento, prioridade mínima, e novos tetos semanais para email.
4. **Consentimento explícito e por canal:** push só depois de a pessoa o ativar (e de o sistema o permitir); email resumo ligado/desligado em Preferências, com ligação de anular subscrição em cada email.
5. **Primeira execução silenciosa** (como no cliente): nunca avisar de tudo o que já estava em atraso.
6. **Mínimo de dados no push/email:** títulos curtos e neutros ("Tens 2 pagamentos por rever"), sem valores nem nomes de fornecedores no ecrã de bloqueio.
7. **Falhar em silêncio:** se o envio falhar, não repete em ciclo; regista e tenta no próximo ciclo, no máximo 1 vez.

## 3. Push em segundo plano

### 3.1 Opções
| Opção | Cobre | Exige | Prós | Contras |
|---|---|---|---|---|
| **A. Web Push (FCM web / VAPID)** | Web e PWA instalada; Android Chrome | Chave VAPID, `firebase-messaging-sw.js` ou extensão do `sw.js` (já existe com `notificationclick`), pedido de permissão, tokens | Sem nova versão das lojas; rápido | **Não cobre a app iOS da loja** (Capacitor/WKWebView); no iPhone, push web só em PWA adicionada ao ecrã principal (iOS 16.4+), o que contraria a decisão de levar todos para as lojas |
| **B. Push nativo (FCM no Android, APNs via FCM no iOS)** | Apps das lojas | Plugin Capacitor de push, capability Push Notifications + chave APNs (Apple Developer), **nova versão** em iOS e Android, textos de permissão | Fiável, é o que as apps das lojas esperam | Nova submissão às lojas (a Rita não quer assumir isso por defeito); manutenção nativa |
| **C. Só email** | Todos | SMTP/ESP | Sem lojas, sem permissões de sistema | Menos imediato |

**Recomendação:** começar por **C (email resumo)**, que cobre todos e não exige lojas; só depois **B** quando houver uma versão nativa planeada por outros motivos; **A** apenas para quem usa a versão web (computador/Android PWA).

### 3.2 Componentes (para A e B)
- Coleção `pushDevices/{uid_deviceId}` escrita **só** por callable `registerPushDevice` (valida sessão e posse do casamento): `{ weddingId, token, platform, createdAt, lastSeenAt, lang }`. Regras: cliente sem acesso. Tokens inválidos (`UNREGISTERED`) são apagados no envio.
- Preferências de push no estado do casamento (já existem em `notif.prefs`); o servidor copia só o necessário para `notifState`.
- Envio: `admin.messaging().sendEachForMulticast` com `data` mínimo + `notification` curta; clique abre `/app/` na rota certa (o `notificationclick` do `sw.js` já abre/foca a app).
- Retirar: botão "Desligar neste dispositivo" apaga o token; apagar conta apaga todos (`deleteWeddingAccount` inclui `pushDevices`).
- iOS Capacitor: `@capacitor/push-notifications` + APNs; permissão pedida **só** quando a pessoa liga "Avisos neste telemóvel" (nunca no arranque).

### 3.3 Custos de operação (estimativas; confirmar na calculadora do Google Cloud)
- **FCM:** sem custo por mensagem.
- **Cloud Scheduler:** 1 tarefa horária (o plano gratuito inclui 3 tarefas por conta de faturação; o seguinte custa cêntimos por mês).
- **Cloud Functions (Blaze, que a Rita já tem):** 24 execuções/dia × 30 = ~720/mês só do agendador; o plano gratuito cobre 2 milhões de invocações/mês. O custo relevante é **leitura de Firestore**: ler só casamentos com canais ativos (consulta indexada) para não varrer a coleção toda.
- **Firestore:** com 500 casamentos ativos e 24 ciclos/dia, o pior caso são ~12 000 leituras/dia (~360 000/mês) se se lesse tudo todas as horas; reduz-se muito lendo só por fuso/hora de envio e só quem tem canais ligados. Ordem de grandeza: **poucos euros/mês** até milhares de casais; cresce linearmente.
- **Apple Developer/Play:** já pagos; push nativo não tem custo extra por mensagem.
- **Custo humano:** B implica nova build, revisão da Apple e testes em dispositivo real (maior custo do projeto).

## 4. Email resumo para o casal

### 4.1 Conteúdo e frequência
- **Resumo semanal** (por defeito desligado; ligado em Preferências) + **alerta único** para itens de prioridade alta (ex.: pagamento em atraso, prazo de RSVP em 3 dias), no máximo **1 email por dia e 3 por semana**, nunca fora das 9h–20h.
- Estrutura: título editorial curto; 3–5 itens agrupados (RSVP, prazos, pagamentos, Wedding Health); um botão "Abrir a Weddy"; rodapé com "Gerir avisos" e anular subscrição.
- Sem valores de pagamentos nem listas de convidados no corpo (só contagens e nomes de tarefas escritos pelo casal, que já são deles).
- Linguagem e visual: identidade Weddy (Cormorant nos títulos como imagem/fonte web segura, Manrope→sans-serif de fallback em email, creme/terracota). **Ver `docs/design/DESIGN-SYSTEM.md`.** Clientes de email limitam fontes: usar fallback `Georgia`/`Helvetica`.

### 4.2 Componentes
- `notifyCouples` (agendada, hora a hora, `Europe/Lisbon`) escolhe os casamentos cuja hora de envio coincide.
- Geradores partilhados → lista de itens → agrupar → render HTML/texto simples → enviar → gravar em `notifState` (`lastDigestAt`, chaves enviadas).
- Destinatários: `ownerEmails` do casamento **com a opção ativa por pessoa**; cada dono tem a sua preferência (`userPrefs/{uid}`).
- Anular subscrição: ligação com token assinado (HMAC) a uma função HTTP `unsubscribeNotify` (sem login), regista a opção e confirma numa página simples na identidade Weddy.
- Cabeçalhos `List-Unsubscribe` (+ one-click) e `Reply-To: geral@weddy.pt`.

### 4.3 Entrega e custos
- **SMTP atual** (cPanel, plano "Web Domain 1 GB" na Dominios.pt): serve para volumes baixos, mas alojamentos partilhados limitam o envio por hora/dia e a reputação do domínio pode ser prejudicada se aumentar. **Confirmar os limites com o fornecedor.**
- **Alternativa recomendada à escala:** um fornecedor transacional (Brevo, Postmark, Amazon SES, etc.) com SPF/DKIM/DMARC configurados para `weddy.pt`. Custo de ordem de grandeza: de **0 a poucos euros/mês** até alguns milhares de emails/mês (muitos têm plano gratuito de centenas por dia); confirmar preços atuais antes de decidir.
- Volume estimado: 500 casais × 1 resumo/semana ≈ 2 000 emails/mês + alertas ≈ 3 000–4 000/mês.
- **Custo de Functions/Firestore** idêntico ao do §3.3.

## 5. Privacidade e conformidade (RGPD)
- Base legal: **consentimento** para push; para email resumo, preferência explícita ligada pelo utilizador (não é marketing, mas é comunicação opcional: manter opt-in e anulação).
- Guardar o mínimo: tokens de dispositivo e estado de envio; sem conteúdo dos avisos.
- Atualizar a política de privacidade (finalidades, fornecedor de envio/FCM, retenção, direitos) **antes** de ativar.
- Direito ao apagamento: `deleteWeddingAccount` passa a apagar `pushDevices` e `notifState`.
- Menores e convidados: estes canais são **só para os noivos**; nunca para convidados (para eles, o consentimento WhatsApp novo e os lembretes RSVP existentes).

## 6. Riscos
| Risco | Mitigação |
|---|---|
| Avisos duplicados entre centro interno, push e email | Módulo de geradores único; `notifState` do servidor é a fonte do que já foi enviado |
| Spam percebido | Mesmos tetos e silêncio; semanal por defeito; pausa automática após N emails sem abrir (se houver rastreio, com consentimento) |
| Deriva cliente/servidor | Testes de paridade: o mesmo estado dá a mesma lista no cliente e no servidor |
| Custo de leitura a crescer | Consulta só de casamentos com canais ativos; índice por hora de envio; limites por execução |
| Reputação do domínio | ESP transacional + DKIM/SPF/DMARC; separar subdomínio (`avisos.weddy.pt`) |
| Rejeição das lojas | Pedir permissão de push só após ação do utilizador; texto claro; sem push promocional |
| Fusos horários | Usar o fuso do casal (guardado nas definições) e não o do servidor |

## 7. Plano de testes (antes de qualquer ativação)
1. Paridade de geradores (cliente × servidor) com dezenas de estados de teste, incluindo extremos (500 tarefas, 300 pagamentos, JSON corrompido, `notif` malformado).
2. Limites: não enviar mais de 1/dia, 3/semana; silêncio; fuso; verão/inverno.
3. Consentimento: ligar, desligar, anular por ligação; nunca enviar sem opt-in.
4. Idempotência: repetir a execução não reenvia.
5. Falhas: SMTP em baixo, token expirado, casamento apagado.
6. Segurança: regras (cliente não escreve `notifState`/`pushDevices`), anulação com token falsificado.
7. Emulador + envio para caixa de teste; nunca para utilizadores reais até aprovação.

## 8. Decisões necessárias da Rita
1. **Email resumo primeiro?** (recomendado) E qual a frequência por defeito (semanal, desligado por defeito).
2. **Fornecedor de envio:** manter o SMTP atual (volume baixo) ou passar a um fornecedor transacional.
3. **Push nativo (B):** só quando houver uma nova versão das lojas por outros motivos?
4. **Web push (A):** vale a pena só para a versão web?
5. Aprovação do texto de privacidade e do desenho dos emails antes de implementar.

## 9. Estimativa de esforço (ordem de grandeza)
- Módulo partilhado de geradores + testes de paridade: 2–3 dias.
- Email resumo (função, estado, modelo, anulação, testes): 3–4 dias.
- Web push (A): 2–3 dias.
- Push nativo (B): 4–6 dias + ciclo de revisão das lojas.
