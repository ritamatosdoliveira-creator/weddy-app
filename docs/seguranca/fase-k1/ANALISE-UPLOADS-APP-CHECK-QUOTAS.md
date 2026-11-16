# Análise: uploads públicos de fotografias (K-4) — K.1-B

**Estado:** análise e recomendação. **Nada implementado** (instrução: apresentar primeiro solução e consequências).

## 1. Fluxo atual (verificado em `rsvp.html`, `memorias.html`, `storage.rules`, `firestore.rules`)
| Aspeto | Facto |
|---|---|
| Origem | Convidados via `rsvp.html` (pasta `memories/{casamento}/{tokenConvite}/`) e visitantes via `memorias.html` / QR (pasta `…/publico/`) |
| Autenticação | **Nenhuma** (SDK web anónimo, sem login) |
| Condições nas regras | Casamento com Premium ativo e válido; tokenConvite tem de ser um `guests/{token}` real **deste** casamento, ou `publico`; criar apenas (sem substituir); ≤ 8 MB; JPEG/PNG/WebP/HEIC/GIF |
| Registo Firestore | `memories/{id}` com `weddingId, token, guestName(≤120), storagePath, createdAt`; `storagePath` tem de estar na pasta do casamento; mesmas condições de Premium/token |
| Limite de **número** | **Nenhum** (nem por token, nem por casamento, nem por IP) |
| Quem lê | Só os donos do casamento (autenticados, email verificado) |
| Cloud Functions | Nenhuma no upload (direto para Storage) |
| Custo potencial | Armazenamento (8 MB × N) + escritas Firestore + egress quando o casal vê. Para abusar é preciso o `weddingId` (visível no QR/URL público) e o casamento ter Premium. Ordem de grandeza: 10 000 ficheiros × 8 MB = 80 GB ≈ dezenas de €/mês em armazenamento (preço a confirmar na fatura Google; **estimativa**, não medida) |
| Mecanismos de abuso | Scripts a enviar milhares de ficheiros; enchimento da galeria do casal (spam/conteúdo impróprio); custo para a Weddy; conteúdo ilegal alojado |
| Mitigações já existentes | tipo/tamanho; apenas criação; Premium obrigatório; leitura só do casal; SVG/HTML recusados |

## 2. Alternativas
| | A. App Check | B. Quota por casamento/token | C. Limite por utilizador/IP | D. Upload via função autenticada |
|---|---|---|---|---|
| Segurança | Reduz abuso automatizado (atesta que o pedido vem da app/site legítimos); não limita utilizadores legítimos maliciosos | Limita danos máximos por casamento/convite | IP atrás de NAT/4G partilhado → falsos positivos; só dá para fazer em função | Controlo total (validar tipo por conteúdo, contar, antivírus opcional) |
| Complexidade | Média: registar reCAPTCHA v3/Enterprise nos sites, ativar *enforcement* gradual no Storage/Firestore; iOS wrapper (App Attest/DeviceCheck) | Média: contador; não é possível só com regras (regras não contam ficheiros) → precisa de função/trigger | Média-alta | Alta: reescreve o fluxo de upload (sem acesso direto ao Storage; limites de 32 MB/pedido nas Functions; URLs assinados) |
| Custo | reCAPTCHA v3 gratuito até volume alto; Enterprise pago acima de quota; sem custo de infraestrutura nova → **possível custo, a confirmar** | Pequeno (leituras/escritas do contador) | Pequeno | Execuções de função + egress |
| Impacto nos convidados | Praticamente invisível (v3) | Invisível até ao limite; depois mensagem clara | Possível bloqueio indevido | Pode ser mais lento; mais pontos de falha |
| Compat. RSVP sem conta | Sim (App Check não exige login) | Sim | Sim | Sim (token de convite como credencial) |

## 3. Recomendação (em camadas, por ordem)
1. **Imediato, sem alterar o fluxo (B-lite):** *alertas de orçamento e de utilização* no Google Cloud (Storage e Firestore) e relatório mensal. Custo zero; deteta abuso. [Administração]
2. **Curto prazo (antes de Beta aberta):** **Quota por casamento com contador no servidor** — função `onObjectFinalized` (Storage) que conta ficheiros por `memories/{casamento}/` e, acima de um limite aprovado (valor a definir pela Rita; sugestão técnica para discussão: poucas centenas por casamento e por `token`), apaga o excedente e marca o casamento; a UI do casal mostra "limite atingido". Não afeta a experiência normal; o abuso fica limitado a *N* × 8 MB por casamento. Requer deploy de uma função nova (aprovação).
3. **Médio prazo:** **App Check (reCAPTCHA v3) em modo *monitor*** primeiro (sem bloquear), e só depois *enforcement* no Storage. Em iOS (wrapper) exige App Attest. Risco: bloquear convidados com browsers/extensões restritivas — por isso monitorizar antes.
4. **Não recomendado agora:** D (reescrita do upload) — complexidade e risco para o fluxo sem conta desproporcionados; C isolado — falsos positivos.

## 4. Consequências a aprovar
- Limite por casamento: o que acontece à *N+1*-ésima foto (rejeitar na UI? apagar no servidor?) e que valor de *N*.
- App Check: aceitar dependência de reCAPTCHA (Google) → novo subprocessador/cookie? (reCAPTCHA define cookies/envia IP à Google) → **impacto RGPD/cookies**, a validar juridicamente antes de ativar.
- Custo de função de contagem: desprezível.

## 5. Plano de testes (para quando houver aprovação)
Emulador: quota por casamento (N, N+1, concorrência de 20 uploads), isolamento entre casamentos, token inválido, `publico`, Premium expirado, reposição após o casal apagar fotos. Ambiente de teste real: App Check em modo monitor com convidados simulados (iOS Safari, Android Chrome, desktop, extensões de privacidade). Produção: apenas observação de métricas.
