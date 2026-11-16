# Matriz de testes K.2

Tipos: **U** unitário (código real extraído, sem rede) · **E** emulador Firestore/Rules · **M** mock (Storage/fetch simulados) · **R** integração real. **Nenhum teste R foi executado** (sem Meta, OpenAI, Stripe, Storage real).

| Suite | Tipo | Cobre | Resultado |
|---|---|---|---|
| `k2-incident-sanitize` (14) | U | tokens mascarados, sem estado do casamento, limites de tamanho, `expireAt` +90 dias, todas as escritas via `incidentAdd` | 14/14 |
| `k2-whatsapp-tokens` (33) | E+M | flag off por defeito (sem fetch, sem escrita, sem consumo de limites); só `true` liga; código/webhook preservados; revogação: 5 ficheiros rodados, outros casamentos/`public-sites`/`feedback` intactos, 0 apagados, idempotência, falha parcial/total, ledger sem emails | 33/33 |
| `rules-hardening` (97) | E | `_incident_log` esquema fechado: válido OK; campo extra, sem `type`, strings/listas acima do limite, estado completo, `expireAt` inválido → negado | 97/97 |
| `consent`, `stop` | E | lógica de consentimento (flag ligada só no teste) | OK |
| Regressão completa | todas | 56 suites (54 da K.1 + 2 novas) | **56/56** |

Alterações a testes existentes: `consent`/`stop` ligam a flag no próprio teste; `rules-hardening` substitui o caso positivo `{a:1}` por documento válido e acrescenta 8 negativos (reforço, não enfraquecimento).

Lacunas: Storage real; trigger disparado pelo emulador de eventos (testado via `handleOwnerRemoval` direto); regras publicadas vs. clientes antigos; TTL (não ativado).
