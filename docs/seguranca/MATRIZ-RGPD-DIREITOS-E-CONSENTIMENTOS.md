# Matriz RGPD — direitos, consentimentos e bases legais (Fase J)

Citações de artigos feitas a partir do texto conhecido do RGPD (UE 2016/679), Lei 58/2019 e Lei 41/2004; **não foram reconfirmadas em EUR-Lex/DRE nesta sessão** → "a validar". Classificação: **[L]** obrigação legal · **[G]** orientação CNPD/EDPB · **[B]** boa prática · **[T]** recomendação técnica · **[P]** decisão de produto.

## 1. Direitos dos titulares
| Direito | Art. | Como se exerce hoje | Evidência | Lacuna | Correção |
|---|---|---|---|---|---|
| Informação [L] | 12–14 | privacidade.html + texto in-app + aviso RSVP | ficheiros | Versões divergentes (Meta/EmailJS); sem identificação legal completa; sem info específica a convidados | Rascunhos em RASCUNHOS-LEGAIS-WEDDY.md (não publicados) |
| Acesso/portabilidade [L] | 15, 20 | Botão "Exportar os meus dados" (casamento inteiro) | app L23205 | Só noivos; convidado pede ao casal ou email | Procedimento no rascunho; exportação não expõe terceiros sem necessidade (a rever em K) |
| Retificação [L] | 16 | Editar na app / RSVP | app | Convidado depende do casal | Procedimento |
| Apagamento [L] | 17 | Definições → Eliminar conta | `deleteWeddingAccount` | Quarentena/notifState/seatingRuns não apagados (**corrigido J-2, testado**); backups/Stripe retidos | Documentado |
| Limitação/oposição [L] | 18, 21 | Email | — | Sem processo escrito | Procedimento |
| Retirar consentimento [L] | 7/3 | Link WhatsApp, STOP, desligar Google | testes Fases anteriores | OK | — |
| Prazo 1 mês, verificação de identidade [L] | 12 | Email | — | Sem procedimento interno | Procedimento |
| Reclamação CNPD [L] | 77 | Referido na política | privacidade.html | OK | — |

## 2. Consentimentos e bases (independência)
| Tratamento | Base proposta | Consentimento? | Registo |
|---|---|---|---|
| Conta e serviço | Contrato | Não | `consent` (termos+privacidade, versão 2026-10-02) — é **reconhecimento**, não consentimento RGPD |
| Convidados/RSVP | Interesse legítimo do casal | Não | — |
| Logística (art. 9) | Consentimento explícito do convidado (proposta) | Sim — **a implementar/decidir [P]** | Não existe hoje |
| WhatsApp convidados | Consentimento | Sim | `whatsappConsents` (data, texto, versão) |
| Google Calendar | Consentimento (OAuth) | Sim | Token + scopes |
| OpenAI | Contrato + autorização na app | Autorização in-app (`aiConsentKey` local) | Local no dispositivo (não é prova servidor) — **gap P3** |
| Marketing | — | **Não existe marketing hoje** | — |
| Cookies | Isento (só armazenamento técnico) | Não aplicável | Banner **não necessário** se confirmado |
| Fotos/menores | Consentimento do casal; convidados a decidir | [P] | — |

Distinção mantida: aceitação de termos ≠ reconhecimento da política ≠ consentimento RGPD ≠ consentimento de cookies ≠ marketing.

## 3. Funcionalidades específicas
- **Concierge/Copilot**: só dados do casamento do utilizador; texto livre enviado à OpenAI com `store:false`; não revelam dados de outros casamentos (testes Fases C–E).
- **Website**: snapshot público só com campos públicos; sem lista de convidados/RSVP/orçamento (testes Fase I).
- **Menores/fotos**: armazenar ≠ publicar; sem reconhecimento facial. Política declara serviço para maiores de 18, mas convidados menores podem ser listados → aviso ao casal [P].

## 4. Cookies / armazenamento (art. 5.º/3 Lei 41/2004 — a validar)
Cookies próprios: **0** (`document.cookie` ausente, teste). Analítica/pixéis: **0** (teste). Firebase Auth usa IndexedDB/localStorage (estritamente necessário). Storage local inventariado: idioma, avisos dispensados, rascunhos, consentimentos locais, cópia local de estado corrompido. Embeds/scripts externos: apenas CDNs técnicos (declarados). → Sem banner; **manter teste que falha se surgir analítica**.

## 5. Segurança e incidentes (arts. 32–34)
Regras Firestore/Storage auditadas (AUDITORIA-REGRAS.md; testes de regras). `_incident_log`: só criação pelo cliente, sem leitura; contém cópias de estado (dados pessoais) → apagado em cascata, **sem prazo de retenção (P2)**. Procedimento de incidente (deteção, registo, severidade, notificação à CNPD em 72 h se risco, aos titulares se risco elevado) em RASCUNHOS-LEGAIS-WEDDY.md §Incidentes. Rate limiting existe (contacto, site, WhatsApp, IA).

## 6. DPIA (art. 35)
Fatores: dados art. 9 em escala potencial + dados de menores/convidados (vulneráveis? não) + IA/transferência EUA + cruzamento de dados. **Conclusão preliminar: recomenda-se realizar DPIA** (ou documentar justificação para não a fazer) e consultar DPO/jurista. Esqueleto em RASCUNHOS-LEGAIS-WEDDY.md §DPIA.

## 7. Consumo / Premium (DL 24/2014 — a validar)
Texto de livre resolução existe (14 dias; renúncia por início imediato). Pendente validação jurídica: informação pré-contratual, confirmação expressa antes do pagamento, política de reembolso, faturação, renovação/cancelamento. Não foram alterados preços nem modelo.
