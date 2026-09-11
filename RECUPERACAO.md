# Plano de recuperação — se uma atualização tiver um bug

Guarda este ficheiro. Não afeta a app, é só para ti.

## Se alguém reportar algo estranho depois de eu publicar uma atualização

**1. Confirma que é mesmo a última versão a causar o problema**
No GitHub, entra no repositório → separador "Commits" → vê a lista de alterações
mais recentes. Cada uma tem uma mensagem e uma data.

**2. Reverter para a versão anterior (2 minutos, sem perder dados)**
No GitHub:
- Abre o commit anterior ao que suspeitas (o que estava a funcionar bem)
- Clica em "Browse repository at this point"
- Vê o `index.html` e o `sw.js` dessa versão
- Copia o conteúdo de cada um
- Cola por cima dos ficheiros atuais no repositório e faz commit

Ou, mais simples: pede-me "volta à versão de antes de X" e eu identifico e
reponho o ficheiro certo.

**3. Sobe o número da versão no sw.js na mesma** (ex: se ias para v20 e o bug
apareceu, ao reverteres sobe para v21 mesmo revertendo o código) — isto é
importante para o sistema de atualização detetar que "há uma versão nova"
(a de recuo) e avisar toda a gente a usar a versão com bug.

## O que NUNCA se perde, mesmo com um bug grave no código

Os dados de cada casal (convidados, orçamento, gastos, mesas) vivem no
Firebase, **completamente à parte** do código da app. Um bug no `index.html`
pode fazer a app comportar-se mal ou mostrar algo errado, mas não apaga nem
estraga o que já está guardado na base de dados. Reverter o código não perde
dados de ninguém.

## Se o problema for mesmo grave (a app deixa de abrir para toda a gente)

1. Reverte já para a última versão conhecida como boa (passo 2 acima)
2. Sobe a versão do `sw.js`
3. Espera 5-10 minutos e testa tu mesma, num telemóvel real, antes de avisar
   mais alguém
