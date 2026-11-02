# Resumo executivo — Fase E (Weddy Copilot)

**Estado:** implementada, testada e commitada **localmente**. Nada enviado (push), fundido nem publicado.

**O que existia.** Um Copilot só de leitura, em regras locais, com 1 escrita (criar tarefa) sem confirmação, uma verificação de permissões vazia e uma segunda opinião da IA que podia sugerir qualquer ação.

**O que foi feito.**
- Política de permissões real (L1 leitura · L2 escrita simples · L3 escrita sensível com confirmação · L4 recusado) aplicada em código, incluindo Premium e sessão.
- Confirmação ligada à operação concreta: uso único, expira em 5 minutos, revalidada contra os dados atuais, protegida contra duplo clique; se a gravação falhar, o estado volta atrás e o Copilot diz a verdade.
- Escritas novas: concluir, reabrir e apagar tarefas; alterar a data do próximo pagamento a um fornecedor. Ações perigosas (apagar convidados, marcar pago, aplicar mesas, enviar mensagens) são recusadas e encaminhadas para o ecrã certo.
- 10 consultas novas (info do casamento, estado de um convidado, recusas, logística, lugares livres, tarefas em atraso/resumo, contactos, informação em falta, pagamentos em atraso).
- Servidor: a IA só pode sugerir leituras (e criar tarefa, que exige confirmação do texto); falhas da OpenAI deixam de gastar a quota diária de 60.

**Corrigido.** Stub de permissões; IA a poder disparar escritas; escrita sem reversão; quota gasta em falhas; falta de testes do Copilot.

**Testes.** 60 verificações no servidor + 160 na app real (A–S do brief, 390/768/1360 px, PT/EN). Resultado da suite completa: ver relatório, secção 8.

**Riscos que ficam.**
1. A confirmação vive no cliente; a defesa final é a das regras de dono do Firestore (já testadas), não um endpoint próprio.
2. Edição simultânea em dois dispositivos continua "último a gravar ganha" (arquitetura existente).
3. Perguntas que as regras não reconhecem vão à OpenAI como texto (com o consentimento já existente).

**Para publicar (com autorização tua):** função `classifyWeddyIntent` e a app; sem mudanças de regras nem de segredos. Validar primeiro em `weddy-premium-teste`.

**Próxima fase do roadmap:** Weddy Compare — validação final.
