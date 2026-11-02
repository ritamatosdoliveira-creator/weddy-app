# Rascunhos legais Weddy (Fase J) — NÃO PUBLICAR sem validação jurídica

Placeholders obrigatórios: **[IDENTIFICAÇÃO LEGAL DA ENTIDADE]**, **[NIF]**, **[MORADA]**, **[EMAIL LEGAL]**, **[DPO / PONTO DE CONTACTO]**, **[REPRESENTANTE LEGAL]**, **[CONTRATOS/DPA CONFIRMADOS]**. A administração deve fornecer: entidade legal e NIF, morada, email de privacidade, prazos de retenção aprovados, região Firestore/Storage, DPAs assinados, política de reembolso, decisão sobre consentimento de convidados (art. 9) e sobre DPO.

## 1. Política de Privacidade — alterações propostas à versão atual
1. Identificar o responsável com **[IDENTIFICAÇÃO LEGAL]**, NIF, morada, contacto de privacidade.
2. Adicionar EmailJS ("Reporta um problema"), SMTP, jsDelivr/cdnjs; remover referência à Meta/WhatsApp Business API **ou** corrigir o texto in-app (hoje divergem — decisão de produto: o servidor tem `sendWhatsappRsvpReminder`/`whatsappWebhook`).
3. Bases legais por finalidade; destinatários; transferências para os EUA (OpenAI, Stripe, EmailJS, Meta) com mecanismo **[DPF/SCC a confirmar]**.
4. Retenção por categoria (ver MATRIZ-SUBPROCESSADORES-RETENCAO.md); aviso de que cópias de segurança e registos de faturação podem persistir.
5. Direitos (arts. 15–22), prazo de 1 mês, como exercer, reclamação à CNPD.
6. Menores: serviço para maiores de 18; o casal é responsável por dados de convidados menores.
7. Remover "cada um com o seu próprio compromisso" se DPAs não estiverem confirmados.
(EN: espelhar em `privacy*` do app, que já tem versão EN.)

## 2. Informação para convidados (RSVP / Website / Logística) — PT
> **Como usamos os teus dados.** O/a **[Nome do casal]** usa a Weddy para organizar o casamento. Ao responderes, os teus dados (nome, resposta, número de acompanhantes e, se quiseres, restrições alimentares ou necessidades de acessibilidade) são tratados para organizar o evento. A Weddy trata-os em nome do casal. Informação sobre saúde (ex.: alergias) é opcional e só será usada para o catering/acessos, com o teu consentimento explícito: ☐ Aceito. Podes retirar o consentimento ou pedir acesso/correção/eliminação ao casal ou a **[EMAIL LEGAL]**. Podes queixar-te à CNPD (www.cnpd.pt). Mais informação: Política de Privacidade.

## 3. Informação sobre funcionalidades de IA
"Quando usas o Assistente, o texto que escreves é enviado à OpenAI (EUA) apenas para interpretar o pedido; não é guardado por nós para treino nem pela OpenAI na plataforma (`store:false`; a OpenAI pode reter registos de segurança — **[confirmar termos]**). Evita escrever dados sensíveis de terceiros."

## 4. Política de cookies
Não existem cookies de analítica/publicidade. A app usa armazenamento local do dispositivo estritamente necessário (sessão, idioma, avisos). **Banner não necessário** nesta configuração; reavaliar se for adicionada analítica ou embeds (teste automático impede regressões).

## 5. Termos — pontos a validar
Identificação do prestador; descrição do serviço Premium; preço e IVA; renovação e cancelamento; livre resolução/renúncia (texto existente, DL 24/2014); reembolsos **[POLÍTICA]**; limitação de responsabilidade; lei aplicável/foro; contacto de reclamações (Livro de Reclamações eletrónico, a validar).

## 6. Procedimento de exercício de direitos
Receção em **[EMAIL LEGAL]** → registo (data, titular, pedido) → verificação de identidade (email da conta / token de convite) → localizar (conta, casamento, `guests`, Storage) → executar (exportação; eliminação via `deleteWeddingAccount` ou pedido manual por convidado) → responder em ≤1 mês (prorrogável 2 meses com justificação) → arquivar. Exceções: dados de terceiros; faturação (retenção legal); backups (rotação).

## 7. Procedimento de incidentes (arts. 33–34)
Detetar (alertas, logs, `_incident_log`, reporte) → conter → registar (data, âmbito, categorias, nº titulares) → avaliar risco/severidade → se risco: notificar CNPD **sem demora e, se possível, em 72 h** → se risco elevado: informar titulares → notificar responsáveis (casais) se Weddy for subcontratante → evidências e lições. Responsável: **[DPO / PONTO DE CONTACTO]**.

## 8. Política de retenção e eliminação
Ver matriz de retenção; aprovar prazos antes de automatizar eliminações (nenhuma é automática hoje).

## 9. Esqueleto de DPIA (art. 35)
1) Descrição sistemática do tratamento · 2) Necessidade e proporcionalidade · 3) Riscos (acesso indevido a dados de saúde de convidados; exposição pública por erro no Website; transferência EUA via IA; retenção excessiva em cópias/logs; imagens de menores) com probabilidade/impacto · 4) Medidas (regras por dono, `store:false`, minimização, aviso+consentimento no RSVP, eliminação em cascata, TTL) · 5) Parecer DPO/jurista · 6) Decisão e revisão periódica. **Preenchimento e aprovação: administração + jurista.**
