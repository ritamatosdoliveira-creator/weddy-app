# Relatório B.2 — Gestão integrada da logística dos convidados

Branch `v325-import-guests`. **Tudo local**: sem deploy, push, merge nem alteração de dados de produção; sem segredos, sem migrações, `STATE_VALIDATE_MODE` desligado, regras Firestore/Storage **não publicadas**, sem serviços externos nem custos.

## 1. Auditoria da arquitetura existente (resumo; detalhe em `B2-LOGISTICA-ARQUITETURA.md`)
- Cada convite é `guests/{token}`: individual (campos no topo) ou família (`responses.{rsvpMemberId}`). O casal lê tudo por `memberRSVPResponse(item)`.
- Já existiam: `transporte` e `alojamento` (booleanos), `meal`, `dietary` (texto livre), `children[]` (nome/idade/vem).
- Concierge do convidado: regras por palavras-chave; lê só o documento do próprio convidado e o que o casal publicou (`guestTransportInfo`, `guestAccommodationInfo`…). Só o texto da pergunta pode ir ao classificador de IA.
- Mesas: `state.seating.assignments` → `guestId`. Wedding Health: lista de verificações; notificações: no máximo 2 avisos de saúde, 1 por 4 semanas (amarelos).
- Duplicados evitados: "precisa de transporte/alojamento" continua a ser o interruptor antigo (fonte única); o texto `dietary` mantém-se como nota livre.

## 2. Modelo de dados
Um único objeto opcional `logistics` dentro da resposta de cada pessoa (topo no individual; `responses.{id}` na família):
```
logistics: { v:1,
  transport:{ from≤120, people 1–20, pref 'ida'|'volta'|'ida-volta', notes≤200 },
  lodging:  { nights 1–30, arrive/depart 'AAAA-MM-DD', people 1–20, notes≤200 },
  food:     { allergies[≤10×≤60], intolerances[≤10×≤60], diets[≤8 códigos], pref≤200 },
  access:   { mobility, assistance, other≤200 } }
```
- **Reutilizados**: `transporte`, `alojamento`, `dietary`, `children`. **Novos**: `logistics`; `children[i].highchair/kidsMeal` (só com idade ≤4 / ≤12).
- **Alergias separadas** de intolerâncias, dietas e preferências.
- Acompanhamento **privado do casal** na entrada do convidado: `entry.logi = { transport|lodging|needs: 'done', group≤40 }` (ausente = por organizar). Nunca vai para o documento do convidado.
- Vazio = ausente. Quem recusa ou não preenche não grava nada; dados antigos funcionam sem migração.

## 3. Alterações no RSVP (`rsvp.html`)
- Perguntas **condicionais**: detalhes de transporte só com "Preciso de transporte"; de alojamento só com "Preciso de alojamento"; alimentação e acessibilidade são secções opcionais recolhidas ("Só se for o teu caso").
- Individual e família, **necessidades diferentes por membro**; nada obrigatório (exceto a regra antiga de refeição); validação de datas (chegada ≤ saída).
- Crianças: cadeira de bebé (≤4 anos) e menu infantil (≤12) só aparecem quando a idade o justifica.
- Etiqueta "Restrições alimentares ou alergias" passou a "Outras notas sobre alimentação"; nota de privacidade no formulário; texto "Como tratamos os teus dados" atualizado (acessibilidade, crianças, sem treino de modelos).
- Recusar/apagar resposta (formulário ou Concierge) apaga também `logistics`; reenviar sem preencher não cria nem apaga nada.
- PT/EN completos; 390 px e 1360 px sem overflow.

## 4. Gestão de convidados (casal)
Novo ecrã **Logística** no hub do RSVP (Definições › RSVP), no estilo editorial da Weddy (linhas com número grande em Cormorant Garamond, sem cartões quadrados nem dashboard):
- Resumo por necessidade (transporte, alojamento, alimentação com alergias destacadas, necessidades especiais, crianças, famílias/grupos), cada linha é um filtro; filtro "Por organizar".
- Detalhe por convidado (só confirmados); alergias e acessibilidade em destaque; nota antiga `dietary` identificada.
- Famílias e grupos a organizar em conjunto (famílias com crianças/transporte/alojamento e grupos de transporte definidos pelo casal).
- "Organizado / por organizar" por necessidade e campo "grupo de transporte" — guardados só na entrada privada do casal.

## 5. Integrações
- **Mesas**: etiquetas informativas (alergia, dieta, acessibilidade, crianças) no lugar e no seletor de lugar (só categoria, sem detalhe); resumo por mesa; sugestões ("família em mesas diferentes", "acessibilidade/famílias com crianças ainda sem mesa"). **Nunca altera lugares** (testado: distribuição intacta).
- **Concierge**: responde sobre transporte/alojamento só com o que o casal publicou; perguntas sobre outros convidados (alergias, acessibilidade, quem precisa de transporte/alojamento) recebem resposta de privacidade e **não** são enviadas ao serviço de IA.
- **Wedding Health**: nova verificação amarela "N convidados com necessidades de logística por organizar" — só contagem, só a menos de 120 dias do casamento, sem efeito no índice. **Notificações**: aproveita o canal de saúde existente (máx. 2 avisos, 1 por 4 semanas); nenhum canal novo.
- Emails (lembretes, resumo): o servidor não lê `logistics`; verificado por pesquisa no código.

## 6. Privacidade e segurança
- Minimização: tudo opcional, condicional, com limites de tamanho no cliente e nas regras.
- Acesso: só quem tem o link (token impossível de adivinhar) e o casal; o convidado nunca vê dados de outros; o portal público não mostra nada individual.
- Alergias/acessibilidade: nunca em emails, notificações, resumo, Concierge nem IA (a Health usa só contagens).
- Regras (locais, **não publicadas**): `logistics` validado no `update` sem sessão (chaves permitidas, tipos, listas ≤10, textos curtos); `hasOnly` ampliado; o casal mantém controlo total. Nota: o interior de `responses` (família) não é validado em profundidade pelas regras — tal como `meal`/`dietary` já eram; o cliente limita e o casal só lê como texto escapado.
- Eliminação/RGPD: apagar o convidado remove `guests/{token}` (e `logistics`) ou `responses.{id}` do membro e a entrada com `logi`; o convidado pode apagar a própria resposta; `deleteWeddingAccount` já remove convites. Finalidade única (organização do casamento); retenção = vida do casamento/conta.
- Sem novos serviços, integrações ou custos.

## 7. Testes
| Suite | Resultado |
|---|---|
| `rules-logistics` (regras, eliminação) | 23/23 |
| `ui-logistics-rsvp` (individual, família, antigo, EN; 390/1360) | 52/52 |
| `ui-logistics-couple` (resumo, filtros, detalhe, follow-up, grupos, Health, EN; 390/1360) | 43/43 |
| `ui-logistics-tables` (etiquetas, sugestões, distribuição intacta) | 24/24 |
| `ui-logistics-concierge` (privacidade, IA não chamada, recusa limpa) | 20/20 |
| Suite completa | 31/31 suites |

## 8. Suite completa
31/31 suites passaram (todas as existentes + 5 novas de B.2), incluindo i18n PT/EN, regras, B.1 (lembretes, STOP, contacto sob concorrência) e UI a 390/1360 px. O aviso de avaliação em `rules-premium` ("Property subscription is undefined") é uma mensagem de log esperada de um caso negativo; o conjunto passou.

## 9. Limitações / decisões que ficam contigo
- Regras Firestore com `logistics` **não publicadas**: têm de ser publicadas antes de a nova versão do RSVP ser usada em produção (senão o envio com logística é recusado). Ordem sugerida: regras → site.
- O exportar CSV do casal não inclui as colunas de logística (decisão de minimização; pode acrescentar-se se quiseres).
- Estados do acompanhamento: apenas "organizado / por organizar" (sem "não aplicável").
