# Inventário de dados pessoais — Weddy (Fase J)

Estado: **verificado no código local** (index.js, firestore.rules, storage.rules, app/index.html, rsvp.html). Nada foi verificado em produção (consola Firebase/Stripe/Google). Bases legais = **proposta técnica, a validar por jurista**. Retenção atual = o que o código faz hoje; "proposta" em MATRIZ-SUBPROCESSADORES-RETENCAO.md.

Legenda de titulares: **N** noivos/utilizadores · **C** convidados · **T** terceiros (fornecedores, contactos).

| # | Dado / categoria | Titular | Origem | Finalidade | Base legal (proposta) | Onde fica | Quem acede | Prestador | Eliminação | Risco |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Email, nome, uid (conta) | N | Registo (email/Google/Apple) | Autenticação, serviço | Execução de contrato (6.º/1/b) | Firebase Auth | Titular; servidor | Google/Firebase | `deleteWeddingAccount` → `auth.deleteUser` | Baixo |
| 2 | Estado do casamento (JSON: datas, orçamento, tarefas, fornecedores, notas) | N, T | Introdução pelo casal | Prestar o serviço | Contrato | `weddings/{id}.json` | Donos; servidor | Firebase | Cascata (recursiveDelete) | Médio (volume) |
| 3 | Lista de convidados (nome, categoria, mesa, notas, telefone/email se inseridos) | C | Casal | Gerir casamento | Interesse legítimo do casal/contrato com o casal; Weddy = subcontratante (a validar) | `weddings/{id}.json` | Donos | Firebase | Cascata | Médio |
| 4 | RSVP (nome, resposta, acompanhantes, restrições, mensagem) | C | Convidado via link | Confirmar presença | Interesse legítimo do casal (6.º/1/f) + art. 9 se saúde (ver §Logística) | `guests/{token}` | Donos; titular com o token | Firebase | `deleteAllByWeddingId('guests')` | Médio |
| 5 | **Logística: alergias, intolerâncias, dietas, acessibilidade** | C | RSVP / casal | Catering, acessos | Art. 9/2/a consentimento explícito **ou** a avaliar caso a caso (ver §Logística) | `guests` + JSON | Donos | Firebase | Cascata | **Alto** |
| 6 | Telefone de convidado + índice | C | Casal / convidado | Lembretes RSVP/WhatsApp | Consentimento (WhatsApp) | `guestPhoneIndex`, `whatsappConsents`, JSON | Servidor; donos | Firebase (+Meta se API) | Cascata (J-confirmado) | Médio |
| 7 | Consentimentos WhatsApp (data, texto, versão, STOP) | C | Link do convidado | Prova de consentimento | Obrigação de demonstrar (art. 7/1) | `whatsappConsents`, `whatsappInbox`, `whatsappMessageStatus` | Servidor | Firebase/Meta | Cascata | Médio |
| 8 | Memórias (fotos, textos de convidados) | C, N, menores possíveis | Upload | Álbum | Consentimento do casal; convidados: a validar | Storage `memories/` + `memories` | Donos | Firebase | Cascata + Storage | **Alto** (imagens/menores) |
| 9 | Documentos/contratos de fornecedores | N, T | Upload | Organização | Contrato | Storage `documents/` | Donos | Firebase | Cascata + Storage | Médio |
| 10 | Votos, discursos, textos pessoais | N | Introdução | Funcionalidade | Contrato | JSON | Donos | Firebase | Cascata | Médio |
| 11 | Site público (nomes, datas, local, fotos, programa) | N | Casal ao publicar | Publicar site | Consentimento/ação do casal | `publicWeddingSites`, Storage | **Público** | Firebase/GitHub Pages | `deleteWeddingSiteData` | Médio (público por vontade) |
| 12 | Texto livre ao Copilot/Concierge/AI Seating/Compare | N (+ nomes de C possíveis) | Utilizador | Interpretar pedido | Contrato + aviso/autorização na app | Pedido HTTPS à OpenAI (`store:false`) | OpenAI | OpenAI (EUA) | Não guardado por nós | **Alto** (transferência) |
| 13 | Tokens Google Calendar (cifrados) | N | OAuth | Sincronizar eventos | Consentimento | `privateIntegrations` (AES-GCM) | Servidor | Google | Revogação + cascata | Médio |
| 14 | Eventos de calendário (título/local) | N | App | Sincronizar | Consentimento | Google Calendar do utilizador | Utilizador | Google | Desligar/apagar | Baixo |
| 15 | Subscrição/pagamento (ids Stripe/RevenueCat, estado) | N | Checkout | Cobrança | Contrato; obrigação legal (faturas) | `weddings.subscription`; Stripe | Servidor | Stripe, Apple, RevenueCat | Não apagados na Stripe (retenção fiscal) | Médio |
| 16 | Emails de resumo/alertas (preferências, `emailOff`) | N | Definições | Notificações | Contrato/consentimento | `notifState`, JSON | Servidor | SMTP (a confirmar) | Cascata (J-2) | Baixo |
| 17 | Contacto/suporte (nome, email, mensagem) | N, outros | Formulário | Responder | Interesse legítimo/contrato | Email SMTP; dedupe com TTL | Admin | SMTP | Manual | Baixo |
| 18 | "Reporta um problema" (texto + captura de ecrã) | N | Formulário | Suporte | Interesse legítimo | EmailJS; Storage `feedback/` | Admin | **EmailJS** | `feedback/` apagado em cascata; EmailJS não | Médio |
| 19 | Snapshots/cópias do estado | N, C | Automático | Recuperação | Interesse legítimo (integridade) | `weddings/{id}/snapshots` | Servidor | Firebase | Cascata | Médio |
| 20 | **Quarentena de estado** | N, C | Validador | Diagnóstico/recuperação | Interesse legítimo | `weddingStateQuarantine` (30 d `expireAt`) | Servidor | Firebase | **Passou a ser apagada em cascata (J-2)**; TTL a configurar | Médio |
| 21 | `_incident_log` (cliente cria; cópias de estado) | N, C | App | Rede de segurança | Interesse legítimo | Firestore | Servidor | Firebase | Cascata; sem retenção temporal (gap) | Médio |
| 22 | Atividade (`activity`) | N | Automático | Histórico | Contrato | subcoleção | Donos | Firebase | Cascata; limpeza `cleanupActivityLog` | Baixo |
| 23 | Rate limits / dedupe (`siteRateLimits`, `whatsappReminder*`, `aiUsage`, `seatingRuns`) | N, visitantes (hash/ids) | Automático | Anti-abuso | Interesse legítimo (segurança) | Firestore | Servidor | Firebase | TTL/limpeza; por casamento apagados | Baixo |
| 24 | IP de visitantes (pedidos HTTP) | N, C, visitantes | Rede | Entrega do site | Interesse legítimo | Logs de GitHub Pages/CDNs/Firebase | Prestadores | GitHub, jsDelivr, cdnjs, Google | Fora do nosso controlo | Médio — **fontes Google eliminadas (J-1)** |
| 25 | localStorage/sessionStorage (idioma, avisos, rascunhos, consentimento local, cópia de segurança de estado corrompido) | N | App | Funcionamento | Isento (estritamente necessário, Lei 41/2004 art. 5.º/3 — a validar) | Dispositivo | Titular | — | Utilizador limpa browser | Baixo (nota: `weddy-corrupt-backup-*` guarda cópia local do estado) |

## Logística de convidados (art. 9.º) — avaliação
- Preferências (vegetariano, sem porco) podem revelar convicção religiosa/saúde → **tratar como potencialmente especiais**; alergias/intolerâncias/acessibilidade = dados de saúde (art. 9.º).
- O consentimento do casal **não substitui** a base do convidado. Proposta: aviso no RSVP + campo opcional + finalidade restrita (catering/acessos) + consentimento explícito quando o convidado preenche. **Decisão do produto e validação jurídica pendentes.**
- Verificado: AI Seating não envia alergias/acessibilidade (comentário em index.js ~L1902; testes da Fase D). Concierge/Copilot só usam dados do casamento do próprio utilizador autenticado (isolamento testado nas Fases C–E).

## Factos verificados / hipóteses / pendentes
- Verificado: cascata de eliminação (agora com quarentena, notifState, seatingRuns); sem analítica/cookies próprios; `store:false` em todos os pedidos OpenAI; fontes alojadas.
- Hipótese: localização EU dos dados Firestore/Storage (functions em europe-west1; Firestore/Storage **não verificável no repositório**).
- Pendente (admin): região de Firestore/Storage, TTL de `expireAt`, DPA assinados, backups, identificação legal.
