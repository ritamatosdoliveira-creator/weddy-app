# Matriz de validação das integrações (K.1-I)

Níveis: **N1** unitário · **N2** integração com mocks · **N3** emulador Firebase · **N4** ambiente de teste real (`weddy-premium-teste`, contas de teste) · **N5** produção.
Legenda: ✔ feito (e onde) · ✘ não feito · — não aplicável. **Nenhum teste simulado é apresentado como real.** Todos os ✔ abaixo são N1–N3; **N4 e N5 não foram executados.**

| Integração | N1 | N2 (mocks) | N3 (emulador) | N4 (teste real) | N5 (produção) |
|---|---|---|---|---|---|
| OpenAI (Copilot, Seating, Compare) | ✔ esquemas/validadores | ✔ `fetch` simulado: respostas inválidas, 429/500, timeout, `store:false` | ✔ quota/Premium no emulador | ✘ | ✘ |
| Google OAuth / Calendar | ✔ cifra/estado | ✔ `fetch` Google simulado: state de uso único, finalização, sync parcial, revogação | ✔ estado em Firestore emulado | ✘ (OAuth real nunca ligado) | ✘ |
| Stripe (checkout/webhooks) | ✔ allowlist | ✔ SDK simulado: assinatura, idempotência, concorrência | ✔ transação Firestore | ✘ (pagamento de teste, reembolso de teste) | ✘ |
| RevenueCat/Apple | ✔ | ✔ webhook simulado | ✔ | ✘ (TestFlight/sandbox) | ✘ |
| EmailJS | — | ✘ (não há teste; chamada só no browser) | — | ✘ | ✘ |
| SMTP (contacto, resumos, lembretes) | ✔ | ✔ `nodemailer` simulado (falha de SMTP, duplicados) | ✔ limites no emulador | ✘ | ✘ |
| Firebase Authentication | — | ✔ sessão simulada | ✘ emulador de Auth não usado | ✘ expiração/revogação/alteração de email/Google login | ✘ |
| Firestore | ✔ validador | — | ✔ regras (7 suites) + funções | ✘ latência/quotas reais | ✘ |
| Storage | — | ✔ Storage simulado nas funções | ✔ regras (tipos, tamanhos, isolamento) | ✘ upload/download reais, tokens de download | ✘ |
| RSVP (individual/família, lembretes) | ✔ | ✔ | ✔ concorrência, idempotência | ✘ convidado real num telemóvel | ✘ |
| Wedding Website | ✔ | ✔ cópia de fotos simulada | ✔ publicar/despublicar/suspender | ✘ domínio/slug reais, GitHub Pages | ✘ |
| WhatsApp (Meta) — **dormente** | ✔ | ✔ webhook assinado, STOP | ✔ | ✘ (e **não deve** passar a N4 sem decisão) | ✘ |
| UI (390/768/1360, PT/EN) | — | — | ✔ Playwright com Firebase simulado | ✘ iOS/Android reais | ✘ |

## Checklist de testes reais (para futura execução em `weddy-premium-teste`; usar apenas contas e cartões de teste)
**Sessão e conta**
- [ ] Login email/palavra-passe, logout, recuperação de palavra-passe
- [ ] Sessão expirada (esperar expiração do token ≥1 h ou forçar) → a app pede nova sessão e não perde alterações pendentes
- [ ] Sessão revogada (revogar tokens na consola) → operações sensíveis recusadas, mensagem clara
- [ ] Alteração de email → reverificação; acesso ao casamento mantém-se coerente (ownerEmails vs ownerUids)
- [ ] Login Google (conta de teste)
- [ ] Utilizador removido durante uma operação (remover co-dono com o outro dispositivo a editar)
**Pagamentos**
- [ ] Stripe modo teste: cartão `4242…` (sucesso), cartão recusado, MB WAY de teste, abandono/expiração
- [ ] Webhook real do Stripe (CLI `stripe listen` ou endpoint de teste) → Premium ativo, repetição não duplica
- [ ] Reembolso de teste total e parcial (após decisão de política) — verificar estado e `stripeEvents`
- [ ] Redirect de retorno: só hosts permitidos
**Ficheiros**
- [ ] Upload/download de documento (PDF), foto de memória (JPEG/HEIC), foto de bolo/papelaria
- [ ] Upload rejeitado: SVG, >8/15 MB, tipo errado, casamento sem Premium
- [ ] URL de download antes/depois de remover co-dono
- [ ] Upload público (QR) e via link de convidado; tentativa de volume (ex.: 200 ficheiros) para validar a quota quando existir
**Integrações**
- [ ] OpenAI com chave nova de teste: Assistente, AI Seating, Compare (sem imprimir chaves)
- [ ] Google OAuth + Calendar de teste: ligar, sincronizar, duplicados, desligar, revogar no painel Google
- [ ] SMTP: contacto, resumo diário, lembrete RSVP (conta de email de teste)
- [ ] EmailJS: "Reporta um problema" (verificar receção e limites no painel)
**Multi-dispositivo e plataformas**
- [ ] Dois dispositivos: edições em secções diferentes (fusão) e na mesma secção (LWW), RSVP simultâneo, família
- [ ] iOS Safari/PWA instalada; iOS wrapper (compra RevenueCat sandbox, se aplicável); Android Chrome/PWA; desktop Chrome/Firefox/Safari
- [ ] Offline/rede instável: gravação pendente, mensagens de erro, sem duplicar
- [ ] Acessibilidade: teclado, leitor de ecrã (VoiceOver/TalkBack), contraste, zoom 200 %, `prefers-reduced-motion`
**Website e RSVP**
- [ ] Publicar/despublicar/suspender por expiração; slug inválido/reservado; enumeração; fotos públicas
- [ ] RSVP por link individual e familiar; link inexistente; consentimento WhatsApp (se mantido)
