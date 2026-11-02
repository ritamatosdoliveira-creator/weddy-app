# Relatório Fase J — RGPD, Proteção de Dados e Conformidade Legal

Branch `v325-import-guests` · base `ff33b59` · tudo **local**. Conclusão técnica ≠ certificação legal: nada aqui declara conformidade plena; exige validação por jurista/DPO.

## 1. Estado
Implementado ✔ · testado (automático, emulador/mocks) ✔ · commit local ✔ · **não** enviado/publicado. Validações externas (Firebase consola, DPAs, TTL, regiões, Stripe real) **pendentes**.

## 2. Achados e correções
| ID | Sev. | Achado | Ação | Estado |
|---|---|---|---|---|
| J-1 | P2 | Google Fonts em 5 páginas (app, rsvp, memorias, demo-app, promo-video) enviava o IP de visitantes/convidados à Google | Fontes WOFF alojadas em `/fonts` + `@font-face` | Corrigido, testado (estático) |
| J-2 | P1 | `deleteWeddingAccount` não apagava `weddingStateQuarantine` (cópias do JSON com nomes/contactos), `notifState`, `seatingRuns` | Apagados em cascata | Corrigido, testado (emulador) |
| J-3 | P2 | 2 dos 5 pedidos à OpenAI sem `store:false` (classificação de intenção; interpretação/explicação AI Seating) | `store:false` | Corrigido, testado (estático) |
| J-4 | P2 | privacidade.html omite EmailJS e diz que a API Meta é usada; texto in-app diz o contrário | Documentado; rascunho de correção | **Pendente (decisão/jurista)** |
| J-5 | P2 | Sem retenção para `_incident_log`; TTL de `expireAt` não verificada | Documentado | Pendente (admin/K) |
| J-6 | P2 | Dados art. 9 (alergias) sem base/consentimento explícito do convidado no RSVP | Proposta no rascunho | Pendente [P] |
| J-7 | P3 | Consentimento IA só local (`aiConsentKey`); CDNs (jsDelivr/cdnjs) expõem IP | Documentado | Pendente (K) |
| J-8 | P3 | Sem procedimentos escritos (direitos, incidentes, DPIA) | Rascunhos | Preparados, por validar |

Sem P0 técnico aberto. P1 (J-2) fechado.

## 3. Verificado vs. hipótese
- **Verificado**: sem analítica/cookies próprios; sem scripts de origem não declarada; Website público só com campos públicos (Fase I); tokens Google cifrados; isolamento entre casamentos; cascata de eliminação (testada); `store:false` em todos os pedidos OpenAI; regras do `_incident_log` e coleções servidor-only.
- **Hipótese**: região UE de Firestore/Storage; DPAs aceites; OpenAI sem treino; papéis responsável/subcontratante.
- **Pendente**: ver CHECKLIST-RGPD-LEGAL-PUBLICACAO.md.

## 4. Quadro legal
RGPD (UE) 2016/679, Lei 58/2019, Lei 41/2004 (art. 5.º cookies), DL 24/2014 (contratos à distância), orientação CNPD/EDPB. Citações **não reconfirmadas nas fontes oficiais nesta sessão (EUR-Lex, DRE, CNPD)** — a validar. Detalhe por obrigação em MATRIZ-RGPD-DIREITOS-E-CONSENTIMENTOS.md.

## 5. Testes
Novos: `privacy-static` (74 verificações) e `privacy-deletion` (cascata, falha de Storage, isolamento, co-dono, idempotência). Resultado da suite completa: ver RESUMO-EXECUTIVO-FASE-J.md. Testes B.1–I preservados.

## 6. Higiene
Sem `__pycache__` versionado, sem segredos novos, dados de teste fictícios, sem dependências novas.

## 7. Não feito / fora de âmbito
Sem push/merge/deploy/publicação; sem alterações de produção/regras publicadas; sem rotação da chave OpenAI (pendente conhecido); texto de privacidade público **não alterado**.
