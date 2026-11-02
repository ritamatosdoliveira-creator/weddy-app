# Matriz — Google Calendar e Wedding Website (Fase I)

Legenda: **M** mock (Google/Storage simulados), **E** emulador Firebase, **R** regras reais no emulador, **U** UI Playwright, **C** código revisto, **—** não validado (exige externo).

## Google Calendar
| Requisito | Estado | Teste |
|---|---|---|
| OAuth state aleatório, uso único, TTL 10 min | ✔ | gcal (M+E) |
| Callback inválido / cancelado / sem refresh_token / Google recusa | ✔ | gcal |
| Login-CSRF: finalização exige mesmo uid + segredo; replay, segredo errado, pending expirado, malformado | ✔ | gcal |
| Scopes mínimos (sem e-mail/contactos/Drive/calendar total) | ✔ | gcal |
| Tokens cifrados; ausentes de URL, docs públicos e logs | ✔ | gcal |
| Conta ligada identificada sem scope extra | ✔ | gcal, ui-gcal-lapsed |
| Listar só calendários com escrita; recusar só-leitura/alheio | ✔ | gcal |
| Criar / atualizar / remover / recriar (404) / 409→PUT | ✔ | gcal |
| Sem duplicados em syncs repetidas; lock concorrente; intervalo mínimo | ✔ | gcal |
| Falhas parciais, rede em baixo, 503, token revogado (REAUTH) | ✔ | gcal |
| Desligar: revoga, apaga credenciais/mapeamentos, não apaga eventos Google nem dados; idempotente; revogação falha na rede | ✔ | gcal |
| Premium: sem/expirado/inativo bloqueia tudo exceto desligar; dados preservados | ✔ | gcal, ui-gcal-lapsed |
| Isolamento A vs B (weddingId forjado) | ✔ | gcal |
| Sincronização bidirecional | n/a — não existe (decisão documentada) | — |
| Troca de code/tokens/eventos com Google REAL | — | exige credenciais |
| Regresso do browser ao `?googleCalendar=pending` e finalização no cliente | C | não executado e2e |

## Wedding Website
| Requisito | Estado | Teste |
|---|---|---|
| Rascunho: lista branca, tamanho, foto externa/alheia recusadas | ✔ | site (E+M) |
| Slug: formato, reservados, unicidade, sem revelar dono, sugestões | ✔ | site |
| Publicação: URL, versão, bloqueio do endereço, validação de campos | ✔ | site |
| Privacidade do snapshot (convidados, contactos, orçamento, privados) | ✔ | site |
| noindex por omissão; opt-in explícito | ✔ | site |
| Despublicar (sem Premium; não apaga) | ✔ | site |
| Premium expirado: suspende sem apagar, rotaciona tokens, bloqueia edição/publicação; reativa ao renovar | ✔ | site, ui-site |
| Fotos públicas sem token; só de `sites/{próprio}` | ✔ | site |
| Regras: leitura pública só publicado+válido; rascunho/slug privados; Storage | ✔ | rules-site |
| Renderizador: escape HTML, URLs perigosas, sem script | ✔ | ui-site |
| Mobile/tablet/desktop; PT/EN; sem scroll horizontal | ✔ | ui-site, ui-gcal-lapsed |
| Editor completo (abas, preview) 390/768/1360 | parcial — estado expirado e renderizador testados; editor ativo coberto só por revisão | — |
| Publicação/leitura em produção; domínio próprio | — | não executado / sem suporte |

## RSVP
| Requisito | Estado | Teste |
|---|---|---|
| Link individual válido → `rsvp.html?g=` (domínio fixo) | ✔ | ui-site |
| Token malformado/`../` não vira ligação | ✔ | ui-site |
| Sem token: campo para colar o convite; sem pesquisa de convidados; sem conta | ✔ | ui-site |
| Individual/familiar, duplicados, tokens, isolamento (fluxo RSVP existente) | ✔ preservado | suites B.1/B.2/C |
