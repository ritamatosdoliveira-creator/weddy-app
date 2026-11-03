# App Check em modo monitor (K.3-C)

**Estado:** **preparado, NÃO validado** — requer o projeto de teste (registo reCAPTCHA, consola Firebase). Neste ambiente não há credenciais nem CLI. Nenhum serviço externo foi tocado. Sem enforcement; nada em produção.

## O que fazer (Rita, no projeto `weddy-premium-teste`)
1. Confirmar projeto de teste (usar `scripts/guard-projeto-teste.sh weddy-premium-teste`).
2. Consola Firebase → App Check → registar as apps web (app, `rsvp.html`, `memorias.html`) com **reCAPTCHA v3** (chave de site criada no painel reCAPTCHA; é pública, mas **só do projeto de teste**).
3. Em App Check → APIs: **Firestore, Cloud Storage, Cloud Functions** deixar em **"Não impor" (monitor)**. Nunca clicar "Impor".
4. Cliente: acrescentar `firebase-app-check-compat.js` (mesma versão do SDK atual) e `firebase.appCheck().activate('<chave-de-teste>', true)` **apenas** nas páginas de teste (build de teste; **não** neste branch por defeito). [X] É uma dependência/serviço novo (Google reCAPTCHA) ⇒ impacto RGPD/cookies a validar antes de qualquer produção (já assinalado na K.1).
5. Functions: `enforceAppCheck` NÃO ativar; opcionalmente registar `request.app` (presente/ausente) em log para medir.

## Serviços e chamadas
Protegíveis: Firestore (criação de `memories`, `guests` RSVP), Storage (upload de fotos), callables. Públicas sem conta (RSVP, Memories, QR): são as que mais sofreriam com enforcement.

## Métricas a recolher (consola → App Check → Métricas, 7–14 dias)
Pedidos verificados vs. não verificados por serviço; % de convidados sem token (extensões de privacidade, iOS Safari ITP, browsers antigos, in-app browsers de WhatsApp/Instagram).

## Critérios para eventual ativação futura
≥ 99 % dos pedidos legítimos verificados durante 2 semanas; RSVP e upload testados em iOS/Android/in-app browsers; plano de reversão (voltar a "Não impor" é imediato); decisão jurídica sobre reCAPTCHA; começar por Storage, nunca por RSVP. **Não há resultados de métricas porque não foi executado.**
