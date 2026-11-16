# Documento 5 — Design System da Weddy Planning

Base: `docs/design/DESIGN-SYSTEM.md` (extraído do código real da Couples). A Planning **estende** esse sistema: mantém a paleta e o tom, mas é uma ferramenta de trabalho **desktop-first**, mais densa, com **tipografia sans geométrica minimalista** (revisão de 17/11, a pedido da Rita: as serifas deixam de ser usadas na Planning; a Couples não muda). Protótipo visual estático: `docs/planning/prototipos/index.html` (dados fictícios) e capturas em `docs/planning/prototipos/capturas/`.

Método: auditoria da identidade existente → extensão por padrões (formato "Extend" da skill `design:design-system`) → protótipo → capturas reais a 1440 px e 390 px → revisão visual e correções (3 rondas) → **revisão com as regras das skills Taste minimalist, Impeccable (/audit, /polish) e Vercel Web Interface Guidelines** (2 rondas: tipografia, botões, semântica, alvos de toque, algarismos tabulares).

## 1. Princípios

1. **Editorial, não dashboard.** Hierarquia por tipografia, filetes e espaço — não por caixas. Cartões só quando o conteúdo é de facto um objeto (ex.: anexo, nota da IA).
2. **Cada página com a forma da sua função.** Calendário parece calendário; run sheet parece documento operacional; pipeline parece ferramenta comercial; proposta parece apresentação; conversa parece conversa.
3. **Um acento.** Terracota (`--rust`) para ação e seleção. Estado nunca só por cor (sempre com texto).
4. **Densidade profissional.** Texto base 13.5 px, linhas de 13 px de padding, tabelas reais. O planner vê mais informação por ecrã do que o casal.
5. **Família reconhecível.** Mesma paleta e tom da Couples (creme, terracota); tipografia própria, moderna e sóbria, adequada a uma ferramenta profissional.

## 2. Paleta

Herdada (sem alterações): `--cream #FAF8F5`, `--cream2 #F3EFEA`, `--card #FFFDFC`, `--ink #302C29`, `--ink-soft #8E8780`, `--rust #B96752`, `--rust-dark #9A4F3D`, `--heading #9A4F3D`, `--gold #C9A480`, `--blush #E7C5BB`, `--sage #A8B39C`, `--sage-dark #7C8A6E`, `--line rgba(48,44,41,.09)`.

Extensão Planning (proposta, a aprovar — §3.3 da regra-mãe exige aprovação):

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#FFFEFC` | Superfície de trabalho (painel ativo, conversa) |
| `--rule` | `rgba(48,44,41,.14)` | Filete forte: cabeçalhos de secção e de tabela |
| `--ink-2` | `#5E5751` | Texto secundário com contraste suficiente para informação essencial (o `--ink-soft` fica para legendas) |
| `--mark` | `#F6EDE6` | Realce de linha atual (run sheet), nota da IA |
| `--warn-bg` / `--ok-bg` | `#FBEDEA` / `#E8EEDF` | Etiquetas de estado (já existiam como fundos no código) |

Cores de estado (texto): crítico `#8E3A2F`, atenção `#A97F5B` (`--joint-dark`), ok `--sage-dark`. Sem azuis, roxos ou gradientes.

## 3. Tipografia (revisão minimalista)

Famílias: **Geist** (UI, títulos, números) e **Geist Mono** (horas, datas, contagens, metadados, eyebrows). Ambas no Google Fonts; a usar alojadas em `fonts/` na implementação (RGPD, como a Couples). Evitar Inter, Roboto e Open Sans (regra minimalist). Sem serifas na Planning.

| Papel | Estilo |
|---|---|
| Título de página | Geist 600, **38 px**, `letter-spacing:-.035em`, line-height 1.08, `--heading` (#2F2B28, off-black, nunca #000) |
| Título de secção | Geist 600, 18 px, `-.02em` |
| Nomes / subtítulos de bloco | Geist 600, 14–15 px, `-.01em` |
| Números-chave | Geist 600, 28 px, `-.03em`, `tabular-nums` |
| Horas (run sheet), datas, contagens | Geist Mono 500, 12–15 px, `tabular-nums` |
| Eyebrow / metadados | Geist Mono 400, 11.5 px, `--ink-soft`, sem maiúsculas forçadas |
| Texto base | Geist 400/500, 13.5 px, line-height 1.5 |
| Lede | Geist 400, 15 px, `--ink-2` |

## 4. Layout e navegação

- **Shell**: barra lateral 232 px (`--cream2`, como a Couples em desktop) + área de trabalho com cabeçalho fixo (pesquisa global, **Conversas** com contador, notificações, avatar). Largura de conteúdo máx. 1280 px, margens 40 px.
- **Barra lateral tipográfica**: grupos (Negócio, Casamentos, Estúdio) com rótulos pequenos; itens só texto + contador; item ativo com filete terracota à esquerda. Sem ícones decorativos.
- **Conversas não estão no menu** (regra do produto): só o ícone no cabeçalho com contador global.
- **Organização ativa** sempre visível no topo da barra lateral (multi-organização).
- **Responsivo**: ≥ 1100 px completo; 820–1100 px colunas laterais recolhem; < 820 px barra lateral esconde-se (menu), tabelas passam a linhas empilhadas, pipeline com scroll horizontal **dentro** do quadro (nunca da página). Verificado a 390 px sem scroll horizontal.

## 5. Componentes e padrões (extensão)

| Componente | Problema | Proposta | Estados |
|---|---|---|---|
| **Cabeçalho de página** | Títulos sem contexto | Eyebrow (contexto/data) + título Cormorant 44 + lede + ações à direita; filete `--rule` por baixo | — |
| **Faixa de números** | Cartões KPI genéricos | Números em Cormorant entre filetes, separados por linhas verticais finas; legenda pequena; variação em sálvia | carregar, vazio ("—") |
| **Lista de risco** | Alertas em caixas coloridas | Grelha `nível · descrição · ação`; nível em versaletes coloridos + texto; ação em link | aberto, reconhecido, resolvido |
| **Linha de casamento** | Cartão por casamento | Data em Cormorant (dia) + mês em versaletes; nomes em serifa; meta numa linha; barra de progresso fina 4 px com % | — |
| **Pipeline** | Kanban de cartões pesados | Colunas separadas por filetes verticais, cabeçalho em versaletes + contagem em serifa, leads como linhas com etiqueta e valor | arrastar (teclado: mover com menu), vazio |
| **Tabela operacional** | — | Hora em Cormorant 21 px; fases como faixas `--cream2` em versaletes; linha atual com `--mark` + filete terracota; estado em texto colorido | por confirmar, confirmado, em curso, concluído, problema |
| **Seletor de vista** | Abas genéricas | Pill segmentado com ativo escuro (`--ink`) para vistas do mesmo documento | — |
| **Conversa** | — | 3 colunas (lista · conversa · decisões/anexos); balões `--cream2` (outros) e `#F1E3DC` (eu); **decisão** como faixa sálvia sob a mensagem; anexo como ficha com tipo e tamanho; recibo de leitura por pessoa ("Lida por Marta · Por ler por Duarte") | enviada, lida por, editada (com revisão), importante |
| **Nota da IA** | Chatbot flutuante | Bloco `--mark` com rótulo "✦ Weddy Intelligence", pergunta em serifa, explicação e "nada é enviado sem confirmares" | sugestão, a preparar, pronto, recusado |
| **Etiqueta** | — | Pill 10.5 px; neutra `--cream2`, alerta `--warn-bg`, ok `--ok-bg` | — |
| **Botões** | Pills genéricos (padrão "IA") | Primário escuro `--btn #2F2B28`, texto branco, **36 px, raio 6 px**, sem sombra, hover `#4A4440`, `:active scale(.98)`; secundário contorno `--rule` em `--paper`; link terracota com sublinhado no hover. Pills só para etiquetas | normal, hover, foco 2 px, ativo, desativado .5 |

Acessibilidade: foco visível 2 px `--rust`; botões só com ícone com `aria-label` (ex.: "Conversas, 3 por ler"); alvos ≥ 36 px em desktop e ≥ 44 px em toque; estado sempre com texto; contraste do texto essencial com `--ink`/`--ink-2`; `prefers-reduced-motion` respeitado em todas as transições (a Couples só o tem no Comparador).

## 6. Primeiras propostas de interface (protótipo)

| Ecrã | Captura | O que demonstra |
|---|---|---|
| Hoje | `capturas/hoje-desktop.png`, `hoje-telemovel.png` | Saudação editorial, faixa de números, radar "Precisa de atenção", próximos casamentos, agenda em linha temporal, nota da IA |
| Contactos e pedidos | `capturas/crm-desktop.png` | Pipeline de 6 fases com filetes, etiquetas de origem/alerta e valores |
| Run sheet | `capturas/runsheet-desktop.png`, `runsheet-telemovel.png` | Documento operacional por fases, linha atual, estados em texto, vistas Planner/Equipa/Fornecedores, contactos do dia |
| Conversas | `capturas/conversas-desktop.png` | Lista por casamento com não lidas, decisão registada, anexo, leitura individual, exportar PDF |

Ainda por desenhar (Fase 2+): proposta pública (apresentação premium), calendário (mês/semana com casamentos, reuniões e prazos), ficha do casamento, financeiro, portal do fornecedor, ecrã de aceitação do convite (`/aceitar/`), ícone e conversa na Couples (com o design system da Couples, não este).

## 7. Referências

Design system da Couples (`docs/design/DESIGN-SYSTEM.md`); padrões de mercado observados no Doc. 2 (radar de riscos e partilha por ferramenta no Journey 2 Yes; run sheets por vista no Planning Pod/Aisle Planner); tipografia editorial de publicações de casamento (serifa de alto contraste nos títulos, sans geométrica no corpo).

## 8. Skills de design utilizadas

**Pedidas pela Rita a 17/11 e aplicadas** (regras lidas nos repositórios oficiais e aplicadas manualmente; nada instalado):
- **Taste — minimalist-skill** ([Leonxlnx/taste-skill-classics](https://github.com/Leonxlnx/taste-skill-classics)): sans geométrica, tracking negativo nos títulos, off-black, cor escassa, botões 4–6 px, sombras quase invisíveis, sem emojis.
- **Impeccable** ([pbakaus/impeccable](https://github.com/pbakaus/impeccable)): `/audit` (acessibilidade, theming, responsivo, integridade) e `/polish` (alinhamento, estados, consistência tipográfica, alvos de toque).
- **Web Interface Guidelines** ([vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)): botões reais em vez de `<a>` sem destino, `aria-hidden` nos ícones decorativos, link para saltar ao conteúdo, `tabular-nums`, `touch-action: manipulation`, `theme-color`, sem `transition: all`, campo de pesquisa com rótulo.

Resultado verificado: fontes carregadas, 0 erros, 0 botões sem nome acessível, sem scroll horizontal a 390 px, alvos ≥ 28 px nas ligações de texto.

Instalação: as três podem ser instaladas como skills (`npx skills add …`), mas são código de terceiros; recomendo rever o conteúdo antes e instalar só com a tua autorização expressa.


- **Instaladas e usadas** (origem Anthropic, já ativas no ambiente): `design:design-system` (método de auditoria/extensão aplicado neste documento); `design:accessibility-review` e `design:design-critique` (para rever cada ecrã implementado na Fase 2); `design:ux-copy` (textos PT-PT).
- **Pesquisa no catálogo da organização** (frontend design, UI/UX, dashboards SaaS, design systems, tipografia, responsivo, acessibilidade, qualidade visual): **sem resultados**.
- **Não instaladas**: skills/pacotes de terceiros da internet. Não é possível validar a origem e o código, e o pedido proíbe skills duvidosas. Se quiseres uma skill específica (por exemplo uma de "frontend design" de origem conhecida), indica-a e eu reviro-a antes de a instalar.
