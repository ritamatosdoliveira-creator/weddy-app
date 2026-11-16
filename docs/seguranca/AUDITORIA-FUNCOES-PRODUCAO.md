# ATUALIZAÇÃO (2026-11-02, 09:50) — código original RECUPERADO

A Rita copiou os zips de fonte do deploy (`gcloud functions describe` + `gsutil cp`, só leitura). **Recuperado código-fonte original** (não compilado) de `generateCompareReport`, `analyzeCompareProposal` e `sendContactMessage`. Cópia de consulta em `recuperado-producao/` (ver README aí). As secções 1–5 abaixo foram escritas **antes** da recuperação; onde divergem, vale esta atualização.

## A. O que está em produção
- Produção = `origin/main:index.js` + 904 linhas do Comparador (`analyzeCompareProposal` L2254, `generateCompareReport` L2678 + ~900 linhas de apoio) + `sendContactMessage` (31 linhas, L5291) + **uma linha alterada**: `APP_BASE_URL` = `https://www.weddy.pt/app/` (em `main` é `…/index.html`).
- Os dois zips do Comparador são idênticos (mesmo `index.js` completo). O zip de `sendContactMessage` (27 Out) é anterior e tem o mesmo `sendContactMessage`.
- `sendRsvpReminders`/`whatsappWebhook` (deploy de 27 Out 20:24:28/35): não recebi os zips deles, mas o `index.js` do zip do `sendContactMessage` (deploy 20:24:34) difere de `main` só no contacto e no `APP_BASE_URL` → **inferência forte** de que o código implantado destas duas é o de `main` (identificação definitiva: ver passo opcional no fim).
- O `index.js` da minha branch **não contém** o Comparador. O diff `producao-vs-origin-main.diff` aplica-se limpo à minha branch (`patch --dry-run`: 3 hunks OK). **Alerta:** um `firebase deploy --only functions` feito a partir da minha branch tal como está **removeria** (ou pediria para remover) `generateCompareReport` e `analyzeCompareProposal` e substituiria `sendContactMessage`. Antes de qualquer deploy é obrigatório incorporar o código recuperado.

## B. `analyzeCompareProposal` (callable v2, 1 GiB, 180 s) — auditoria do original
- **Auth:** exige sessão com `email_verified === true`; `weddingId` opcional do cliente é validado contra `ownerEmails` (mesma resposta para "não existe" e "não és dono") ✔.
- **Premium:** `assertCompareWedding` (lógica isolada `compareSubscriptionValid`: `active === true`, 12 meses desde `startedAt`, ausente = válido, ilegível = recusado) ✔. É **uma regra de Premium diferente** da que a A.3 introduz (`premiumUntil`); coexistem sem conflito, mas convém uniformizar mais tarde.
- **Entrada/validação:** `compareId`/`proposalId` ≤ 80, até 3 ficheiros; cada caminho tem de estar em `documents/{este weddingId}/`, sem `..`, e registado em `state.weddingDocuments` dessa proposta ✔ (sem acesso a ficheiros de outros casamentos). Tipo pelos primeiros bytes (PDF/PNG/JPEG/WEBP/GIF; recusa SVG/HEIC), ≤ 15 MB/ficheiro e 25 MB total, PDF ≤ 30 págs/60 totais (contagem própria, recusa PDF cifrado/ilegível) ✔.
- **Quota:** 10/dia/casamento em transação (`aiUsage/{id}.compare`), devolvida uma só vez em falha técnica ✔.
- **IA/segurança:** chave só no servidor; documento tratado como dados (instruções a ignorar ordens no documento); saída sanitizada (`sanitizeCompareAnalysis`); timeout 140 s; logs sem corpo nem conteúdo ✔.
- **Riscos residuais (baixos/médios):** (1) os ficheiros são lidos e descarregados **antes** de contar a quota → um Premium pode gerar leituras de Storage repetidas sem gastar quota; (2) a lista `weddingDocuments` vem de um JSON escrito pelo cliente (protegido pelo prefixo do casamento, ok); (3) dados dos fornecedores seguem para a OpenAI (a UI avisa); (4) sem App Check.
## C. `generateCompareReport` (callable v2, 512 MiB, 120 s) — auditoria do original
- Mesma auth/posse/Premium. **Os dados vêm sempre do documento do casamento, nunca do pedido** (só `compareId`, `lang`, `weddingId?`). ≥ 2 propostas com dados confirmados; só campos confirmados pelo casal.
- Quota 20/dia/casamento (`aiUsage/{id}.compareReport`) em transação, devolvida em falha; filtros determinísticos no servidor (números só dos dados enviados; sem "o melhor/mais barato" quando os preços não são comparáveis; sem ranking); comparabilidade de preço e "informação em falta" calculadas em código. Coincide com o contrato inferido (`docs/seguranca/generateCompareReport-contrato.md`): `{compareId, lang, weddingId?}`, timeout cliente 115 s ✔.
- **Compatibilidade com o frontend publicado:** é a função que o cliente já chama; não há divergência de contrato a assinalar.
- Riscos residuais: prompt injection via texto livre dos campos (mitigada por regras + sanitização); custo OpenAI limitado pela quota; sem App Check.
## D. `sendContactMessage` (HTTPS v2, 256 MiB, `maxInstances: 3`) — original vs a minha reescrita
| Aspeto | Original (produção) | Minha reescrita (local) |
|---|---|---|
| CORS | opção `cors` (`www.weddy.pt`, `weddy.pt`) — igual | igual + 403 explícito a outras origens |
| Método | POST (405 caso contrário) | POST (+ OPTIONS 204) |
| Honeypot `website` | 200 sem enviar | igual |
| Campos | nome ≤100, email ≤200 (regex), assunto **texto livre** ≤80, msg ≤4000, sem mínimo | assunto só da lista fixa (outros → "Outro assunto"), msg 10–4000, corpo ≤ 8 KB, tipo JSON |
| Email | só texto; `replyTo` = email do visitante; assunto sem CR/LF | HTML escapado, Reply-To, CRLF removidos |
| Limites de abuso | **só `maxInstances: 3`** (sem limite por IP/dia) | 5/h por IP (hash), 200/dia globais |
| Erros | 400 / 500 `{ok:false}` | 400/403/405/413/415/429/502 |
| Destinatário/SMTP | fixo `geral@weddy.pt`; mesmo SMTP (`SMTP_USER/PASS` secrets, `SMTP_FROM`) | igual |
- O original é **seguro quanto a relay** (destinatário fixo, CRLF tratados) mas **sem proteção contra volume** (inundação da caixa `geral@weddy.pt`; pode esgotar a quota do SMTP e prejudicar os lembretes, que usam o mesmo SMTP). A minha versão acrescenta essa proteção e é compatível com o formulário (`contactos.html`: mesmos campos, 2xx = sucesso, assuntos = lista fixa).
- Diferenças de comportamento que a minha versão introduz e **que mudam produção** (decisão da Rita): limites (5/h/IP pode afetar redes partilhadas, ex. feira/escritório), 403 a pedidos sem a origem esperada (clientes não-browser com `Origin` diferente), assunto normalizado, mensagem mínima de 10 caracteres.
- Recomendação: **não substituir já**. Opção prudente: manter a de produção e acrescentar só o limite por IP/dia (alteração mínima), ou adotar a minha após a Rita aceitar as diferenças acima.

## E. Achados de segurança novos (da recuperação)
1. **`OPENAI_API_KEY` em texto simples** dentro do zip de fonte implantado: o ficheiro `.env.weddy-app-bd12f` (parâmetros `defineString`) vai no pacote e fica no bucket `gcf-v2-sources-…` e como variável de ambiente em claro. Não li nem copiei o valor (só confirmei que não está vazia). **Recomendação (ação da Rita):** rodar a chave na OpenAI, passá-la para `defineSecret` (`firebase functions:secrets:set OPENAI_API_KEY`) e retirar o `.env` do que é implantado; verificar quem tem acesso ao bucket. Isto não depende de nenhuma alteração minha.
2. O pacote implantado inclui scripts administrativos (`dar-premium.js`, `quem-comprou-premium-apple.js`, `uso-premium-casamento.js`) e backups (`index.js.bak`, `*.antes-*`): não correm como functions, mas não deviam ir no deploy (usar `.gcloudignore`/`firebase.json` `ignore`).
3. O código do Comparador **nunca esteve no Git**: ficou só no computador da Rita e no bucket. Agora há cópia de consulta em `recuperado-producao/` (sem segredos).

## F. Tabela atualizada
| Função | Original recuperado? | Localização | Diferenças face à versão local | Riscos | Recomendação | Pronta para futura publicação? |
|---|---|---|---|---|---|---|
| generateCompareReport | **Sim** (fonte) | `recuperado-producao/index.js.producao-2026-10-30` L2678+ | Local não a tem (deploy da branch atual **apagaria** a função) | Baixos (ver C) | Incorporar o bloco recuperado tal como está no `index.js` da raiz (patch aplica limpo); testá-lo em emulador | Só depois de incorporada e testada; sem alterações ao comportamento |
| analyzeCompareProposal | **Sim** (fonte) | idem L2254+ | idem | Baixos/médios (ver B) | idem; opcional: contar quota antes de descarregar ficheiros | idem |
| sendContactMessage | **Sim** (fonte) | `…-2026-10-27-contactos` L4387+ e L5291 | Ver tabela D | Original sem limites de volume | Decisão da Rita (mínimo vs. minha versão) | Não até haver decisão |
| sendRsvpReminders | Sim (= `main`, inferência forte; zip dela não analisado) | `index.js` | Local idêntica; sem configuração 2–30/1–10 | Duplicação possível; ignora Autopilot | Implementar (defeitos 5/3 + idempotência) com autorização | Não (não feito) |
| whatsappWebhook | Sim (= `main`, idem) | `index.js` | Só comentário no handler | — | Manter; sem confirmação automática de consentimento | Sim |

## G. Ficheiros
- **Recuperados (fonte original):** `recuperado-producao/index.js.producao-2026-10-30`, `recuperado-producao/index.js.producao-2026-10-27-contactos`, `recuperado-producao/package.json.producao` (+ `producao-vs-origin-main.diff` e `README.md` criados por mim).
- **Apenas analisados:** `.env.weddy-app-bd12f` (só nomes das variáveis; valores **não** lidos), `dar-premium.js`/`quem-comprou-…`/`uso-premium-…` (só verificar marcadores de credenciais: nenhum), `*.bak`/`*.antes-*` (tamanho), `index.js` local e `origin/main`.
- **Alterados:** nenhum ficheiro de código. Criados: `recuperado-producao/*` e esta atualização.
- Cópias temporárias com a chave (extração do zip) apagadas da sessão.
- **Passo opcional (leitura) para fechar a inferência de `sendRsvpReminders`/`whatsappWebhook`:** `cd ~/weddy-recuperacao && for f in sendRsvpReminders whatsappWebhook; do read B O <<< "$(gcloud functions describe $f --gen2 --region europe-west1 --project weddy-app-bd12f --format='value(buildConfig.source.storageSource.bucket,buildConfig.source.storageSource.object)')"; gsutil cp "gs://$B/$O" "./$f.zip"; done`

---

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
- **Alterados:** nenhum ficheiro de código. **Criado:** este documento (`docs/seguranca/AUDITORIA-FUNCOES-PRODUCAO.md`).
