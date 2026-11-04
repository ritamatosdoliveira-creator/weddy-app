# Matriz de testes K.3

Níveis: **U** unitário (código real em vm) · **E** emulador Firebase (Firestore/Rules) · **M** mock (Storage/SDK Stripe simulados) · **R-teste** serviço real de teste (Firebase test project, Stripe test, OpenAI test, Storage real). **Nenhum teste de nível R-teste foi executado nesta fase.**

| Suite | Nível | Casos | Cobre | Resultado |
|---|---|---|---|---|
| `k3-whatsapp-ui` | E + U | 18 | flag ausente/false/true; sem sessão, email não verificado, sem casamento; função indisponível, sem permissões, sem ligação → botão oculto; cliente não se auto-ativa; wa.me preservado | 18/18 |
| `k3-quota` | E + M | 32 | normal, limite por convite/QR/casamento/bytes, concorrência (40→10), repetição, tipo/tamanho inválido, casamento diferente, falha parcial do Storage, libertação, token nunca gravado | 32/32 |
| `k3-quota-defaults` | E | 10 | valores efetivos 20/500/2.000/5 GB e fronteiras (convite, QR em rajadas simultâneas, casamento, bytes); 8 MB por foto = regras | 10/10 |
| `k3-quota-rules` | E | 12 | álbum cheio recusa; contador só-servidor; leitura só dos donos; isolamento | 12/12 |
| `k3-stripe-refunds` | E + M | 24 | payment_intent persistido, total/parcial, duplicados, simultâneos, fora de ordem, sem registo, metadados incoerentes, disputa, falha→500, política off/on | 24/24 |
| `hard-auth-matrix` (existente) | E | — | apanhou e levou à correção de `getWhatsappApiStatus` (agora exige email verificado e casamento) | passa |
| **Regressão completa** | todas | 61 suites | 56 da K.2 intactas + 5 novas (K.3); nenhuma suite removida ou enfraquecida | **61/61** |

**Resultados reais de falhas encontradas pelos testes:** (5) com `defineInt` não resolvido a quota teria recusado tudo (corrigido com valores de recurso); (1) `getWhatsappApiStatus` aberto a emails não verificados/sem casamento (corrigido); (2) contador de quota com `NaN` quando o documento nascia de uma recusa (corrigido); (3) `ABORTED` por contenção no contador (repetição + `retry`); (4) colisão de ids entre suites no emulador partilhado (ids únicos).

**Viewports/idiomas/dispositivos:** a K.3 não alterou o desenho visual (nenhum botão novo; um helper de lógica). As suites UI existentes (PT/EN; ui-sweep 390/768/1360 px; RSVP sem conta) passam. **iOS/Android reais: não testados** (só Chromium emulado).
