# E — Base técnica para a Weddy Planning

Documento de levantamento. **Não foi iniciado nenhum desenvolvimento** da Weddy Planning e a branch `feature/weddy-planning` **não** foi criada (aguarda aprovação desta integração).

## 1. O que já está disponível (nesta branch)

| Área | Estado |
|---|---|
| App do casal | `app/index.html` (SPA de ~33 000 linhas, PT/EN), PWA (`app/sw.js`, `manifest.json`) |
| Dados do casamento | Documento `weddings/{id}` com o estado completo num único campo `json` (texto, **máx. 900 000 caracteres** nas regras; a app corta PDFs aos 800 000) |
| Acesso | `ownerEmails` (lista) e `ownerUids` no documento do casamento; email verificado obrigatório; seletor de casamento ativo (`userPrefs`) |
| Servidor | 53 Cloud Functions v2 num só `index.js` (~8 000 linhas), todas em `europe-west1`; parâmetros por `defineString` com valores seguros por omissão (WhatsApp API e email-resumo **desligados**) |
| Regras | Firestore e Storage com negação por omissão nas coleções do servidor; Premium validado em regras (`premiumOn`) e no servidor |
| Convidados | RSVP individual e familiar por token (`guests/{token}`), logística validada em regras, consentimento WhatsApp com double opt-in |
| Convites digitais | 8 modelos (`convites8/`), editor (`app/invedit.js`), publicação por função (`publishInvitation`), página pública `convite.html`, envio por email/WhatsApp manual com limite diário |
| Pagamentos | Stripe (checkout, webhooks, reembolsos `record_only`) e RevenueCat (Apple) |
| Testes | 50 suites Node/emulador + 26 suites de interface (Playwright), runner único `tests/run-all.js` |
| Publicação | Scripts com confirmação (`publicar-regras.sh`, `publicar-funcoes.sh`), allowlist do site (`build-public.js`) |

## 2. O que pode ser reutilizado

- Autenticação, verificação de email, App Check (fase de medição).
- Padrão de funções «callable» com verificação de dono + Premium + quotas (ver `tests/hardening/auth-matrix.test.js`).
- Validação do estado no servidor (`validateWeddingStateOnWrite`) e quarentena.
- Registo de incidentes minimizado (`incidentAdd`), retenção 90 dias.
- Motor de convites, RSVP por token, envio de email com anti-injeção (`tests/k4/email-injection.test.js`).
- i18n PT/EN com teste de paridade.
- Infraestrutura de testes com emuladores (`demo-weddy`).

## 3. O que necessita de alterações para a Weddy Planning

| Tema | Limitação atual | Implicação |
|---|---|---|
| Modelo de dados | Um casamento = um documento com um JSON até 900 KB | Um planner com muitos casamentos precisa de leitura agregada sem descarregar N estados completos (índices/resumos por casamento) |
| Permissões | Só «dono» (`ownerEmails`); sem papéis | Planner ≠ casal: papéis (planner, assistente, casal, fornecedor) e permissões por secção exigem regras novas |
| Multi-tenancy | Não existe entidade «organização» | Coleção nova (organizações, membros) e ligação casamento↔organização; impacto em todas as regras que hoje verificam `ownerEmails` |
| Premium | Por casamento (`subscription` no documento) | Faturação por organização/planner é outro modelo |
| `index.js` monolítico | 8 000 linhas, um único pacote | Considerar codebases separadas no `firebase.json` para funções da Planning |
| App | SPA única | Interface de planner provavelmente separada (`/planner/`), reutilizando serviços |

## 4. Dependências e pré-requisitos

1. Aprovação desta integração.
2. Decisão sobre o GitHub Pages (doc. D) **antes** de qualquer merge no `main`.
3. Atualizar os scripts de publicação, que hoje só aceitam `servidor/` na branch `feat/convites-envio-backend` — passar a apontar para a linha integrada quando for aprovada.
4. Saber exatamente que versão do `index.js` está em produção (o `recuperado-producao/` é de 30/10; houve publicações depois?) — ver doc. B, pendentes.

## 5. Riscos

- Mexer em regras partilhadas pode afetar a Weddy Couples: qualquer alteração de regras deve correr as suites `rules-*` e `hard-auth-matrix`.
- O limite de 900 KB do estado já está perto do limite em casamentos grandes (o importador verifica o tamanho); a Planning não deve acrescentar dados ao mesmo campo.
- Crescimento do `app/index.html` (risco de conflitos em merges futuros, como os 36 blocos desta integração).
