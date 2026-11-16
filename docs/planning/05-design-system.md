# Documento 5 — Design System da Weddy Planning

Base: `docs/design/DESIGN-SYSTEM.md` (extraído do código real da Couples). A Planning **estende** esse sistema: mantém a paleta e o tom, mas é uma ferramenta de trabalho **desktop-first**, mais densa, com **tipografia sans geométrica minimalista** (revisão de 16/11, a pedido da Rita: as serifas deixam de ser usadas na Planning; a Couples não muda). Protótipo visual estático: `docs/planning/prototipos/index.html` (dados fictícios) e capturas em `docs/planning/prototipos/capturas/`.

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

## 4. Layout, navegação e menus (v3)

Resumo operacional em [DESIGN.md](DESIGN.md). Decisões, com a regra da skill que as justifica:

- **Barra lateral recolhível** (240 → 64 px) com ícone + rótulo, grupos Negócio / Casamentos / Estúdio e contadores em mono. Recolhida, mantém o nome acessível (rótulo visualmente escondido) e uma dica ao passar o rato. *Menus/ux-navigation: 12 destinos de uso diário não cabem num menu superior.*
- **Seletor de organização**: dropdown de seleção única com ✓; "Criar organização" separado por divisória. *Menus: escolha exclusiva → single-select.*
- **Paleta de comandos ⌘K** com pesquisa, ações frequentes e casamentos, e fundo escurecido. Atalho mostrado só nos comandos comuns e nunca como único caminho. *Menus: atalhos padrão em ferramentas de produtividade.*
- **Menu ⋮ por linha**, sempre visível (não só no hover), com a ação principal da linha visível fora do menu, 6 itens em 3 grupos e a ação destrutiva no fim, a vermelho, com "…". Itens ≥ 40 px, sem quebra de linha. *Menus: inline/overflow; Hallmark: sem affordances só no hover, sem textos clicáveis em duas linhas.*
- **Conversas não estão no menu** (regra do produto): só o ícone no cabeçalho com contador.
- **Variedade estrutural** (Hallmark): cada ecrã tem a forma da sua função — leitura + coluna (Hoje), **mestre-detalhe (Carteira, novo)**, pipeline em colunas (Pedidos), tabela operacional (Run sheet), três painéis (Conversas).
- **Sem eyebrows por omissão** (Hallmark): os contextos passaram para o subtítulo; sem faixas laterais coloridas no item ativo nem na linha atual (preenchimento + contorno fino em vez disso).
- **Responsivo**: ≥ 1180 px completo; < 1180 px colunas laterais recolhem; < 860 px barra lateral esconde-se, tabelas passam a linhas empilhadas, pipeline com scroll **dentro** do quadro. Verificado a 1440 e 390 px sem scroll horizontal.

## 5. Ícones (v3)

Uma só família desenhada para a Weddy (21 símbolos num sprite): grelha 24, traço 1.5, pontas redondas, sem preenchimento, `currentColor`, 18 px. *Icons8/Hallmark: um só pacote, sem misturar traços; metáfora universal ou nenhum ícone.* A skill da Icons8 exige o MCP da Icons8 e licença (a página bloqueou o acesso automático), por isso não foi usada; o conjunto próprio evita dependências e licenças. Alternativa futura: Lucide (licença ISC) ou Phosphor, se a stack for React.

## 6. Ecrãs do protótipo (v3)

| Ecrã | Capturas | O que demonstra |
|---|---|---|
| Hoje | `hoje-desktop`, `hoje-telemovel`, `hoje-recolhida-desktop` | Números do negócio, radar com estado por ponto + texto, próximos casamentos, agenda, nota da IA com ações; barra lateral recolhida |
| Carteira (novo) | `carteira-menu-desktop`, `carteira-telemovel`, `seletor-organizacao-desktop` | Mestre-detalhe; menu ⋮ aberto; **o que o casal partilha por secção** (Não partilhar / Consultar / Consultar e editar, decidido pelo casal; votos como secção privada, não partilhável); equipa atribuída; seletor de organização aberto |
| Pedidos | `crm-desktop` | Pipeline de 6 fases com filetes, etiquetas e valores |
| Run sheet | `runsheet-desktop`, `runsheet-telemovel` | Tabela por fases, horas em mono, linha atual, estados, vistas Planner/Equipa/Fornecedores |
| Conversas | `conversas-desktop`, `conversas-telemovel` | Três painéis, decisão registada, anexo, leitura individual |
| Paleta de comandos | `paleta-comandos-desktop` | ⌘K com ações e casamentos |

Verificação automática em todas as capturas: fontes carregadas, 0 erros de página, 0 botões sem nome acessível, 0 alvos < 24 px, 0 itens de menu em duas linhas, sem scroll horizontal. Problemas encontrados e corrigidos na revisão: menu ⋮ cortado (colisão do nome de classe `.open`), links sem nome com a barra recolhida, item destrutivo em duas linhas.

## 7. Referências

Design system da Couples (`docs/design/DESIGN-SYSTEM.md`); padrões de mercado observados no Doc. 2 (radar de riscos e partilha por ferramenta no Journey 2 Yes; run sheets por vista no Planning Pod/Aisle Planner); regras das skills de design aplicadas (§8): Taste minimalist, Impeccable, Vercel Web Interface Guidelines, Menus (Uxcel), Hallmark.

**Direção anterior rejeitada:** a v1 do protótipo (16/11) usava tipografia editorial com serifa de alto contraste nos títulos (Cormorant Garamond, como a Couples). Foi **rejeitada a 16/11 pela Rita**: a Weddy Planning **não usa serifas**. Mantém-se aqui só como registo; não deve ser usada como referência.

## 8. Skills de design utilizadas

**2.ª ronda (16/11), pedidas pela Rita** — regras lidas nas fontes e aplicadas (nada instalado):
- **Menus (Uxcel Lab)**: tipo de menu pela estrutura da escolha, ordem por uso, 5–9 itens, divisórias, estados, atalhos só padrão → §4.
- **Hallmark** ([nexu-io/open-design](https://github.com/nexu-io/open-design), Apache-2.0): variedade estrutural (mestre-detalhe) e anti-padrões (eyebrow em todas as secções, faixas laterais, hover-only, texto clicável em duas linhas) → §4.
- **Icons8**: princípio de um só pacote coerente aplicado com um conjunto próprio; a skill exige MCP e licença da Icons8 → §5.
- **shadcn/ui**: biblioteca de componentes da stack aprovada (React + Vite); tematizada com os tokens do DESIGN.md → DESIGN.md.
- **Redesign Existing Projects** (agora parte de `design-taste-frontend`, Leonxlnx): preservar marca e conteúdo, uma escala de raios, no máximo duas caixas encaixadas.
- **Design System Generator**: produzido o [DESIGN.md](DESIGN.md) da Planning (tokens, tipografia, ícones, navegação, componentes, regras de qualidade).

**1.ª ronda**:

**Pedidas pela Rita a 16/11 e aplicadas** (regras lidas nos repositórios oficiais e aplicadas manualmente; nada instalado):
- **Taste — minimalist-skill** ([Leonxlnx/taste-skill-classics](https://github.com/Leonxlnx/taste-skill-classics)): sans geométrica, tracking negativo nos títulos, off-black, cor escassa, botões 4–6 px, sombras quase invisíveis, sem emojis.
- **Impeccable** ([pbakaus/impeccable](https://github.com/pbakaus/impeccable)): `/audit` (acessibilidade, theming, responsivo, integridade) e `/polish` (alinhamento, estados, consistência tipográfica, alvos de toque).
- **Web Interface Guidelines** ([vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)): botões reais em vez de `<a>` sem destino, `aria-hidden` nos ícones decorativos, link para saltar ao conteúdo, `tabular-nums`, `touch-action: manipulation`, `theme-color`, sem `transition: all`, campo de pesquisa com rótulo.

Resultado verificado: fontes carregadas, 0 erros, 0 botões sem nome acessível, sem scroll horizontal a 390 px, alvos ≥ 28 px nas ligações de texto.

Instalação: as três podem ser instaladas como skills (`npx skills add …`), mas são código de terceiros; recomendo rever o conteúdo antes e instalar só com a tua autorização expressa.


- **Instaladas e usadas** (origem Anthropic, já ativas no ambiente): `design:design-system` (método de auditoria/extensão aplicado neste documento); `design:accessibility-review` e `design:design-critique` (para rever cada ecrã implementado na Fase 2); `design:ux-copy` (textos PT-PT).
- **Pesquisa no catálogo da organização** (frontend design, UI/UX, dashboards SaaS, design systems, tipografia, responsivo, acessibilidade, qualidade visual): **sem resultados**.
- **Não instaladas**: skills/pacotes de terceiros da internet. Não é possível validar a origem e o código, e o pedido proíbe skills duvidosas. Se quiseres uma skill específica (por exemplo uma de "frontend design" de origem conhecida), indica-a e eu reviro-a antes de a instalar.
