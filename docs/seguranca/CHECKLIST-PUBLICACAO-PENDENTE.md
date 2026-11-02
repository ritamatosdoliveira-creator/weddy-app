# Checklist de publicação pendente

Legenda: **[L]** validado localmente · **[P]** precisa de publicação · **[C]** precisa de configuração · **[V]** precisa de validação em produção.

## Regras
- [L][P] `firestore.rules`: `rsvpReminderSends` (B.1), `logistics` validado no `update` (B.2). Publicar **antes** do site.
- Storage rules: sem alterações.

## Funções
- [L][P] `sendRsvpReminders` (modo Autopilot/legado, reservas), STOP no WhatsApp, proteção do formulário de contacto.

## Frontend
- [L][P] `app/index.html`, `rsvp.html` (logística, Concierge, família por membro alterado).

## Segredos
- [C] Nenhum novo. `OPENAI_API_KEY` via `defineSecret` mantido; rotação da chave exposta no pacote de produção fica pendente (decisão da Rita).

## Migrações
- Nenhuma necessária (documentos antigos funcionam). `'done'` antigo continua válido.

## Testes em produção
- [V] RSVP real com logística após publicar regras; lembrete por email num casamento de teste; STOP; Concierge recusa terceiros.

## RGPD / legal
- [V] Rever texto "Como tratamos os teus dados" publicado; finalidade única; apagar convidado/conta remove `logistics`.
- Email de lembrete não usa consentimento WhatsApp (decisão a confirmar).
