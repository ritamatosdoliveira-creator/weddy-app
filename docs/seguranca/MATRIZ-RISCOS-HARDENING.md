# Matriz de riscos — Hardening (Fase K)

Gravidade: C crítica · A alta · M média · B baixa. Prob./Impacto: B/M/A. "Evidência": T = teste automático (simulado/emulador), C = leitura de código, X = por verificar fora do repositório.

| ID | Problema | Grav. | Prob. | Impacto | Evidência | Correção / mitigação | Estado | Decisão |
|---|---|---|---|---|---|---|---|---|
| K-1 | `createSubscriptionCheckout` aceitava qualquer `returnUrl` https (redirecionamento aberto após pagamento) | M | B | M | C+T (`hard-payments`) | Allowlist de hosts (weddy.pt, www.weddy.pt, host de teste), sem credenciais/porta, ≤500 chars | **Corrigido** | — |
| K-2 | Email do utilizador em log `info` ao remover co-dono | B | M | B | C | Passa a registar uid | **Corrigido** | — |
| K-3 | Cópias do estado em quarentena/auxiliares não apagadas (Fase J) | A | — | A | T (`privacy-deletion`) | Fechado em J | Corrigido (J) | — |
| K-4 | Upload público sem login em `memories/{casamento}/publico/` (fotos de convidados): sem limite de nº de ficheiros (só 8 MB cada, Premium ativo) → custo/abuso de Storage | M | B | M | C+T (`hard-rules`) | Não corrigível só com regras. Recomendado: App Check ou função de upload com quota; alertas de orçamento Google Cloud | **Aberto (P2)** | Admin: ativar App Check/alertas |
| K-5 | URLs de download com token (Storage) ignoram as regras: após remover um co-dono ou expirar Premium, URLs já partilhadas continuam válidas (o rascunho do site já roda tokens, Fase I) | M | B | M | C | Documentado; rodar tokens ao remover co-dono é melhoria futura | **Aberto (P2)** | Produto |
| K-6 | `contentType` é declarado pelo cliente; as regras não verificam magic bytes | B | B | B | C+T | Tipos permitidos restritos (sem SVG/HTML); ficheiros servidos fora da origem da app | Aceite (P3) | — |
| K-7 | `_incident_log`: qualquer utilizador verificado cria documentos (≤12 campos, valores sem limite de tamanho) → abuso de armazenamento; sem retenção | M | B | B | C+T | Limitar tamanho exige função/App Check; retenção depende de política (Fase J) | **Aberto (P2)** | Admin |
| K-8 | Fusão de edições simultâneas é por secção: na mesma secção (ex.: lista de convidados) vence a alteração local (last-write-wins) | M | M | M | T (`hard-scale`) | Intencional e documentado; transação evita perder secções diferentes | Aceite (P2) | Produto |
| K-9 | Stripe: reembolsos/disputas (`charge.refunded`) não revogam Premium automaticamente | M | B | M | C | Por desenho (revisão manual); documentar procedimento | **Aberto (P2)** | Admin |
| K-10 | `googleCalendar*` sem limitação própria (dependem das quotas da Google) | B | B | B | C | Monitorizar quotas | Aceite (P3) | — |
| K-11 | `checkWeddingSiteSlug` permite verificar existência de slugs (enumeração) | B | M | B | C (rate limit presente) | Limitado por `siteRateLimits`; slugs são públicos ao publicar | Aceite (P3) | — |
| K-12 | Consentimento de IA guardado só localmente (`aiConsentKey`) | B | M | B | C | Fase J (J-7) | Aberto (P3) | Jurídico |
| K-13 | Região Firestore/Storage, TTL de `expireAt`, backups/PITR, DPAs: não verificáveis no repositório | M | — | M | X | Ver PENDENCIAS-ADMINISTRATIVAS-LEGAIS.md | **Aberto (externo)** | Administração |
| K-14 | Chave OpenAI exposta anteriormente (pendência conhecida) | A | — | A | X | Não rodada nesta fase por instrução | **Aberto (externo)** | Administração |
| K-15 | CDNs de terceiros (jsDelivr/cdnjs) sem SRI/self-host | B | B | M | C | Self-host ou SRI em fase futura | Aceite (P3) | Produto |

Sem vulnerabilidades críticas nem falhas de integridade abertas no repositório. K-13/K-14 são pendências externas.
