# Auditoria e recuperação das Cloud Functions de produção (2026-11-02)

Âmbito: **só leitura**. Nenhum deploy, push, merge, alteração de dados/secrets/configuração Firebase. Único ficheiro criado: este documento.
Listagem oficial fornecida pela Rita: produção `weddy-app-bd12f` tem `generateCompareReport`, `analyzeCompareProposal`, `sendContactMessage`, `sendRsvpReminders`, `whatsappWebhook` (v2, europe-west1, Node 22); `weddy-premium-teste` só tem `sendRsvpReminders` e `whatsappWebhook` (Node 20).

## 1. Onde procurei (resultado: código das 3 funções NÃO encontrado)
| Local | Resultado |
|---|---|
| Worktrees `g293`, `g286`, repositórios `weddy-app`, `weddy-premium-app-teste` | `index.js` sem definição das 3 funções |
| Histórico git (324 commits, `-S` por nome e por `exports.<nome>`), 44 branches locais + remotas (`comparador-*`, `v2xx-*`), tags (nenhuma), stash, objetos pendentes (`git fsck`: 1 commit pendente, é só `app/index.html`) | Nomes só aparecem em `app/index.html` (cliente), `contactos.html` (cliente) e nos meus commits locais (`b1e0b4d`, `8f3a059`) |
| Commits "Comparador: lançamento" (`0e1ef1e`) e site/contactos (`012e3ff`) | Só alteram cliente (`app/index.html`, `app/sw.js`, `contactos.html`) |
| Pesquisa no sistema de ficheiros desta sessão (backups, zips, `functions*`, `.firebase`, artefactos de build/deploy) | Nada. Não existe `functions-deliverable/` aqui |
| Código-fonte no GCP/Firebase (bucket de fontes das functions v2, Artifact Registry) | **Não acessível:** esta sessão não tem credenciais Google/Firebase e não iniciei sessão (regra) |

Conclusão: **o código-fonte original não está disponível localmente**. As funções estão de facto implantadas em produção (a hipótese "nunca implantadas" fica descartada; a hipótese "só no projeto de teste" também, porque o projeto de teste não as tem). Não reconstruí nenhuma como se fosse a original.

## 2. Como recuperar o fonte original (procedimento seguro, só leitura; a executar pela Rita)
O código das functions v2 fica guardado pela Google no deploy. Em qualquer terminal da Rita já autenticado:
```
# 1) onde está o fonte de cada função (não altera nada)
for f in generateCompareReport analyzeCompareProposal sendContactMessage sendRsvpReminders whatsappWebhook; do
  gcloud functions describe $f --gen2 --region europe-west1 --project weddy-app-bd12f \
    --format='value(name,updateTime,buildConfig.runtime,buildConfig.source.storageSource.bucket,buildConfig.source.storageSource.object)'
done
# 2) copiar o zip para uma pasta FORA do repositório (leitura)
mkdir -p ~/weddy-recuperacao && gsutil cp gs://<bucket>/<object> ~/weddy-recuperacao/<funcao>.zip
# 3) descomprimir e enviar-me os ficheiros (ou pôr numa branch nova, nunca em main)
cd ~/weddy-recuperacao && unzip <funcao>.zip -d <funcao>
```
Notas: (a) o zip é **código-fonte original** tal como foi implantado (inclui `package.json`; não inclui secrets); (b) os nomes dos secrets/params vêem-se com `gcloud functions describe … --format='yaml(serviceConfig.secretEnvironmentVariables,serviceConfig.environmentVariables)'` (mostra nomes e versões, não valores); (c) se o fonte já tiver sido apagado do bucket, o fallback é a imagem do contentor no Artifact Registry (artefacto compilado, não fonte — deve ser rotulado como tal); (d) ver também a pasta `functions-deliverable/` no Mac da Rita (referida em comentários) e `grep -rl generateCompareReport ~/` .
Até lá, qualquer análise do comportamento real destas funções é **inferência** a partir do cliente.

## 3. Auditoria por função
Legenda: **[original]** = código recuperado · **[artefacto]** = compilado · **[inferência]** = deduzido do cliente publicado.

### 3.1 `generateCompareReport` (callable, 512 MB)
- Original: não recuperado. Local: não existe implementação local (o contrato esperado está em `docs/seguranca/generateCompareReport-contrato.md`).
- Contrato **[inferência]** (de `cmpGenerateReport`): `{compareId, lang:'pt'|'en', weddingId?}`, timeout cliente 115 s; lê `weddings/{id}.json`; devolve relatório estruturado (secções `cmpRep*`) que o cliente guarda em `compare.report`.
- Autenticação/Premium **[inferência]**: o cliente só abre o ecrã com `hasActiveSubscription()`; **não sei** se o servidor verifica login, posse do casamento (não confiar em `weddingId`), Premium, quota (o texto da UI promete "máximo 20 relatórios por dia"), nem se limita o tamanho.
- Riscos: IDOR por `weddingId`, Premium só no cliente, custo OpenAI sem teto, prompt injection via texto dos fornecedores/propostas. Todos **não verificáveis** sem o fonte.
- Recomendação: recuperar fonte (§2); auditar contra a lista acima; **não publicar nada com este nome**.
- Pronta para futura publicação: **N/A** (nada local a publicar; manter a de produção intacta).

### 3.2 `analyzeCompareProposal` (callable, 1024 MB)
- Original: não recuperado; sem versão local.
- Contrato **[inferência]** (`cmpAnalyze`): recebe referência a ficheiros (PDF/foto) já carregados no Storage (máx. 3, 10 análises/dia segundo a UI), envia-os à OpenAI, devolve campos propostos (`explicit/inferred/none`) que o casal confirma.
- Riscos prováveis (não verificáveis): leitura de ficheiros de outro casamento (caminhos do Storage), Premium só no cliente, quota/limite por dia só no cliente, retenção/privacidade dos ficheiros enviados à OpenAI (a UI avisa), tamanho/tipo de ficheiro.
- Recomendação e estado: como 3.1.

### 3.3 `sendContactMessage` (HTTPS público, 256 MB)
- Original: **não recuperado**. Local: **reescrita minha** (`index.js`, `sendContactMessage`, commits `b1e0b4d`/`8f3a059`) — **não é a original**.
- Contrato do cliente publicado (`contactos.html`, igual desde `012e3ff`): `POST` JSON `{nome,email,assunto,msg,website}`; sucesso = qualquer resposta 2xx (o corpo não é lido); erro = qualquer não-2xx (mostra "escreve-nos para geral@weddy.pt").
- Compatibilidade da versão local com esse cliente: ✔ campos e verbo; ✔ resposta 200 `{ok:true}`; ✔ as 5 opções de `assunto` do formulário coincidem com a lista local (outras → "Outro assunto"); ✔ honeypot `website` devolve 200 sem enviar (UX igual); ⚠ **CORS/origem**: a local só aceita `https://www.weddy.pt` e `https://weddy.pt` — se a original aceitava `*` ou outras origens (ex.: pré-visualizações em `github.io`, `localhost`), o formulário nessas origens passaria a falhar; ⚠ limites novos (5/hora por IP, 200/dia, corpo 8 KB, mensagem 10–4000, email validado) podem recusar pedidos que a original aceitava; ⚠ destinatário fixo `geral@weddy.pt` (a original pode usar outro) e remetente via `SMTP_FROM`/SMTP existente — **não sei** que secrets/params a original usa.
- Diferenças face ao original: **desconhecidas** (sem fonte). Riscos da original por inferir: relay de spam, injeção de cabeçalhos, HTML no corpo, sem limites (um endpoint anónimo que envia email).
- Recomendação: **não fazer deploy da versão local sobre a de produção** antes de recuperar e comparar o original (um deploy com o mesmo nome substitui-a). Se o original for fraco, a local serve de base, com a lista de compatibilidade acima.
- Pronta para publicação: **não** (bloqueada pela comparação).

### 3.4 `sendRsvpReminders` (agendada, 09:00 Lisboa)
- Original: **código idêntico ao `origin/main:index.js`** (`diff` vazio entre `origin/main` e a branch de trabalho nesta função) — presumo que é o implantado, **[inferência]** porque não pude comparar com o implantado (§2). Premium-teste tem uma versão antiga (Node 20, 2643 linhas).
- **A "implementação local em preparação" com intervalo/máximo configuráveis não existe**: não a escrevi (ficou marcada como alteração de comportamento em produção a pedir autorização). Só o lado cliente (Autopilot da app, B.1) lê `settings.rsvpAutopilot`.
- Estado face aos requisitos pedidos:
| Requisito | Estado atual |
|---|---|
| Intervalo configurável 2–30 dias (defeito 5) | ✘ Não existe. Envia só quando faltam exatamente **7, 3 ou 1** dias para `rsvpDeadline` (`REMINDER_DAYS_BEFORE`) |
| Máximo configurável 1–10 (defeito 3) | ✘ Fixo `MAX_REMINDERS = 3` (igual ao defeito) |
| Não enviar a quem já respondeu | ✔ sim/não; "talvez" continua a receber (coerente com o cliente) |
| Não ultrapassar o máximo | ✔ `remindersSent >= MAX_REMINDERS` (conta também lembretes preparados manualmente no Autopilot, que incrementam o mesmo contador) |
| Não duplicar envios | ⚠ parcial: `lastReminderDay === daysLeft` evita repetir no mesmo marco, mas a atualização do contador só acontece **depois** do envio e sem transação; falha no `update` após `sendMail` ou reexecução concorrente pode duplicar |
| Compatível com casamentos sem as novas definições | n/a (não lê definições); seria trivial ao ler com defeitos 5/3 |
- Outros pontos: só Premium (verificado por `isSubscriptionStillValid`), email validado, teto 150/casamento/execução, só envia por email (sem WhatsApp). Não respeita `settings.rsvpAutopilot` → o casal pode configurar "máx 2" na app e o servidor continuar a enviar o 3.º.
- Recomendação: alinhar com um desenho que mantenha os marcos 7/3/1 como defeito quando não há definições e, havendo, use intervalo/máximo (lendo `weddings/{id}.settings.rsvpAutopilot` com cache por casamento); marcar o envio de forma idempotente (reservar o contador antes de enviar, ou transação). Requer a tua autorização (muda produção).
- Pronta para publicação: **não** (a alteração não está feita).

### 3.5 `whatsappWebhook` (HTTPS)
- Código: **idêntico ao de `origin/main`** (corpo da função sem diferenças; confirmado por `diff`). O implantado em produção é presumivelmente este **[inferência]**.
- Comportamento: GET = verificação Meta (`hub.verify_token`); POST valida `X-Hub-Signature-256`, devolve 200 e processa cada mensagem em `handleIncomingWhatsappMessage`.
- **Confirmação automática de consentimento por mensagens recebidas: NÃO existe.** Em `origin/main` o webhook só trata opt-out (STOP/PARAR etc. → `recordWhatsappOptOut`). O consentimento no modelo antigo é gravado pela callable `updateGuestPhone` (caixa marcada pelo casal) — é esse o risco que a A.3 corrige.
- Local: igual, mais um comentário a registar que "SIM <código>" **não** confirma nada; `confirmWhatsappConsentByReply` existe no ficheiro mas **sem ligação** (nenhum endpoint a chama). Sem WhatsApp Business API nova, sem custos, fluxo não alterado.
- Pronta: o webhook em si não precisa de alteração. O fluxo de consentimento (callables `get/setGuestWhatsappConsent`, regras, RSVP) é que depende do restante deploy da A.3.

## 4. Tabela resumo
| Função | Código original recuperado? | Localização | Diferenças face à local | Riscos | Recomendação | Pronta para publicar? |
|---|---|---|---|---|---|---|
| generateCompareReport | **Não** | Só no GCP (fonte do deploy v2); não acessível | Sem versão local | Premium/IDOR/quota/custo OpenAI não verificáveis | Recuperar via §2 e auditar; não substituir | N/A |
| analyzeCompareProposal | **Não** | Idem | Sem versão local | Acesso a ficheiros de outros casamentos, quotas, privacidade | Idem | N/A |
| sendContactMessage | **Não** | Idem | Local é reescrita (35 testes); diferenças reais desconhecidas; ver riscos de CORS/limites/destinatário | Spam relay se a original for fraca; regressão se a local for mais restritiva | Recuperar e comparar antes de qualquer deploy | **Não** |
| sendRsvpReminders | Sim (= `origin/main`, por inferência igual ao implantado) | `index.js` (todas as branches) | Local idêntica; **config 2–30/1–10 não implementada** | Duplicação possível (sem transação); ignora definições do Autopilot | Implementar com defeitos 5/3 + idempotência, com a tua autorização | **Não** (não feita) |
| whatsappWebhook | Sim (= `origin/main`) | `index.js` | Só comentário novo no handler; sem confirmação automática | Nenhuma confirmação automática existe; opt-out STOP funciona | Manter; sem API/custos | Sim (sem alterações necessárias) |

## 5. Ficheiros
- **Recuperados:** nenhum (o fonte original das 3 funções não está disponível).
- **Apenas analisados:** `index.js` (branch e `origin/main`), `contactos.html`, `app/index.html` (chamadas), `docs/seguranca/generateCompareReport-contrato.md`, `weddy-premium-app-teste/index.js`, histórico git de todas as branches.
- **Alterados:** nenhum ficheiro de código. **Criado:** este documento (`docs/seguranca/AUDITORIA-FUNCOES-PRODUCAO.md`), ainda sem commit.
