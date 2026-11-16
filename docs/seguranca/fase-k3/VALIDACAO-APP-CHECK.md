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

---
## Revisão (consolidação K.3) e checklist de execução — **apenas monitorização**
**Revisão do material existente:** não há script de App Check nem alteração de código no repositório; apenas este documento. A configuração proposta é **exclusivamente monitor**: APIs em "Não impor", nenhum `enforceAppCheck`, nenhum código de ativação neste branch. Nenhum comando Firebase foi executado nesta tarefa. Decisão aprovada: avançar só com monitorização no projeto de teste; **sem enforcement**.

### Checklist (Rita, projeto `weddy-premium-teste`)
| Dia | Ação | Evidência a guardar |
|---|---|---|
| 0 | Confirmar projeto de teste e ausência de dados reais (`scripts/guard-projeto-teste.sh`) | captura do id do projeto |
| 0 | Registar as apps web com reCAPTCHA v3 (chave de teste); Firestore, Storage e Functions em **"Não impor"** | captura da consola mostrando "Não impor" nos 3 serviços |
| 0 | Build de teste com App Check ativo só em modo de recolha (não neste branch) | versão/commit do build de teste |
| 1–14 | Tráfego de teste diário: RSVP sem conta, upload de fotos (QR e convite), app do casal; mistura iOS Safari, Android Chrome, desktop, in-app browsers (WhatsApp/Instagram), extensões de privacidade | registo dos dispositivos/browsers usados |
| 7 e 14 | Exportar métricas App Check por serviço (pedidos verificados / não verificados / sem token) | capturas ou CSV datados |
| 14 | Conclusão: tabela de resultados e decisão | documento de resultados |

### Métricas a recolher
Por serviço (Firestore, Storage, Functions): total de pedidos, % verificados, % sem token, % token inválido; separar fluxo RSVP, upload de convite, upload QR, app do casal; falhas de obtenção de token por browser/dispositivo; qualquer pedido legítimo que **teria** sido rejeitado.

### Critérios de avaliação antes de considerar qualquer passo seguinte
1. ≥ 99 % dos pedidos legítimos de teste com token válido durante 14 dias, em todos os browsers/dispositivos listados.
2. RSVP sem conta e upload em iOS/Android reais sem qualquer falha atribuível ao App Check.
3. Latência/UX sem degradação percetível para convidados.
4. Parecer RGPD favorável sobre reCAPTCHA (cookies/IP enviados à Google) e atualização da Política de Privacidade.
5. Plano de reversão testado (voltar a "Não impor" é imediato).
Mesmo cumpridos, **enforcement em produção exige nova autorização expressa**; começaria por Storage, nunca pelo RSVP.
