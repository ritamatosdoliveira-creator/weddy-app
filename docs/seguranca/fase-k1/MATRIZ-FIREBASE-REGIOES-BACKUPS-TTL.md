# Matriz Firebase: regiões, backups e TTL (K.1-F)

**Nada foi alterado** (sem TTL, sem mudança de região, sem criar/eliminar backups). "Estado atual" = o que o **repositório** prova; o que só a consola mostra está marcado **[X] por confirmar**.

| Elemento | Estado atual | Risco | Decisão necessária |
|---|---|---|---|
| Projetos | Produção `weddy-app-bd12f`; teste `weddy-premium-teste` (`.firebaserc`) | Confundir ambientes ao publicar | Confirmar sempre `firebase use` antes de publicar |
| Região Cloud Functions | **europe-west1 (Bélgica)** — todas as funções e todos os clientes (`WEDDY_FUNCTIONS_REGION`) | — (UE) | Nenhuma |
| Região Firestore | **[X] não consta no repositório** (`firebase.json` só tem regras). `README.md` cita `eur3` apenas como exemplo | Se for `nam5`/EUA, dados de casais na EUA; a região **não pode ser alterada** depois de criada | Rita confirma na consola (Firestore → Dados → localização) e regista |
| Região Storage | **[X]** bucket `weddy-app-bd12f.firebasestorage.app` (nome do formato novo; região só na consola) | Idem | Confirmar localização do bucket |
| Compatibilidade entre regiões | Functions (europe-west1) e dados podem estar em regiões diferentes (funciona; latência extra e dados fora da UE se for o caso) | Latência/transferência; narrativa de privacidade | Documentar a realidade na política |
| Backups / recuperação | **Point-in-Time Recovery do Firestore foi usado com sucesso** num incidente anterior (comentário em `firestore.rules` junto de SNAPSHOTS) → PITR esteve ativo; **[X] estado atual e retenção (até 7 dias) por confirmar**. Backups agendados/exports: **[X] desconhecido**. Storage: **[X]** versionamento/soft-delete por confirmar | Sem backup válido, perda irreversível; com backup, os dados "eliminados" persistem até expirar (RGPD: não prometer eliminação imediata) | Confirmar PITR e agendamentos; definir retenção; informar no texto de privacidade |
| Cópias da app | `weddings/{id}/snapshots` (backup diário/manual criado pela app; apagado com o casamento) | Cópias contêm dados pessoais | Definir nº/idade máximos |
| Quarentena de estado | `weddingStateQuarantine`: cópia do JSON rejeitado pelo validador (o validador está em `STATE_VALIDATE_MODE=off` **por defeito no código** → só escreve se estiver em `report`/`enforce`; valor em produção **[X] por confirmar**; ativar fica proibido nesta fase). Cada documento tem `expireAt = +30 dias`. Apagada em cascata na eliminação do casamento (Fase J, testado) | Dados pessoais retidos 30 dias previstos, **sem TTL configurada** → hoje nunca expiram | Aprovar política (prazo) antes de ativar TTL |
| TTL (Firestore) | **[X] provavelmente nenhuma ativa** (nada no repositório as cria) | Campos `expireAt` sem efeito: lixo acumulado | Ver abaixo |
| Coleções com `expireAt` | `weddingStateQuarantine` (+30 d); dedupe/limites do contacto em `siteRateLimits` (`expireAt` por entrada, + 1 dia) | — | Ver abaixo |
| Limpeza por código | `cleanupActivityLog` (diário 04:00 Lisboa): apaga `activity` > 30 dias e `oauthStates` > 24 h | — | Já em produção como código; não depende de TTL |
| `_incident_log` | Sem `expireAt` nem limpeza | Crescimento ilimitado | Ver `POLITICA-PROPOSTA-INCIDENT-LOG.md` |

## Consequências de ativar TTL (explicação)
- A TTL do Firestore apaga **automaticamente e sem recuperação** os documentos cujo campo de data (`expireAt`) já passou, normalmente até 24–72 h depois (não é imediata e **não é transacional**). Não há "lixo reciclável": só o PITR (se ativo, janela curta) permitiria recuperar.
- Em `weddingStateQuarantine`: apagaria as cópias rejeitadas após 30 dias — **perde-se a única cópia da versão rejeitada** (a app já tem a versão anterior válida; mas se a versão rejeitada continha dados que o casal queria, ficam irrecuperáveis). Por isso a quarentena e os backups **ficam preservados** até existir política aprovada.
- Em `siteRateLimits`: seguro do ponto de vista de dados (são contadores), mas muda comportamento anti-spam se mal configurado.
- Ativar TTL é configuração **por coleção na consola/CLI** (`gcloud firestore fields ttls update expireAt --collection-group=weddingStateQuarantine`), não é código: **não será feito sem aprovação expressa**.

## Consequências de eliminar a quarentena
Remove dados pessoais retidos (positivo para RGPD/minimização) mas elimina a rede de segurança de "nada se perde" prometida no desenho do validador; **não eliminar** antes de a administração aprovar prazo e de o validador ter sido avaliado (está desligado).

## Perguntas para a Rita
1. Região do Firestore? 2. Região do bucket? 3. PITR ativo (retenção)? Há exports agendados? 4. Storage tem versionamento/soft delete? 5. Aprovas 30 dias para a quarentena (ou outro valor)? 6. Aprovas TTL só para `siteRateLimits` já, e para a quarentena só após decidir 5?
