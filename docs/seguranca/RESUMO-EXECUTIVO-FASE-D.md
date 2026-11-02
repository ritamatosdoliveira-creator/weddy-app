# Resumo executivo — Fase D (AI Seating)

**Estado: concluída localmente. Nada publicado, enviado (push), integrado (merge) nem alterado em produção.**

- Auditoria: o AI Seating existia (motor determinístico, Premium no servidor) mas **sem testes**, a aceitação **apagava o trabalho manual**, enviava **nomes à OpenAI** e ignorava famílias/lugares ocupados.
- Implementado: modo "melhorar a distribuição atual" (alterações aprovadas uma a uma), famílias juntas, lugares de não elegíveis preservados, relatório por mesa e pontos a rever (acessibilidade e catering sinalizados, sem promessas), validação integral no servidor e no cliente, proposta desatualizada se RSVP/logística/mesas/lugares mudarem, confirmação ao mudar lugares já definidos, limites e limitador no servidor.
- Privacidade e custos: a IA só vê texto livre com nomes anónimos (P1, P2); a explicação deixou de usar IA.
- Testes: seating-engine 97, ui-seating-ai 80, regras 31; suite completa __SUITE__.
- Pendente: publicar funções → site (checklist); validação em produção; rotação da chave OpenAI (risco conhecido, intocado).
- Seguinte no roadmap: Weddy Copilot — consolidação.
