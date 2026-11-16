# DESIGN.md — Weddy Planning

Fonte de verdade visual para quem implementa a Weddy Planning (pessoas e agentes). Detalhe e justificação: [05-design-system.md](05-design-system.md). Protótipo de referência: [prototipos/index.html](prototipos/index.html). A Weddy Couples **não** segue este ficheiro (usa `docs/design/DESIGN-SYSTEM.md`).

## Direção
Ferramenta profissional, minimalista e calma. Paleta Weddy (creme, terracota como único acento), tipografia sans geométrica, hierarquia por peso, tamanho e filetes. Cor escassa. Sem gradientes, sem emojis, sem cartões em grelha por omissão.

## Tokens
```css
--cream:#FAF8F5;  --cream2:#F3EFEA; --paper:#FFFEFC;          /* fundos: página, barra lateral, superfície de trabalho */
--ink:#2F2B28;    --ink-2:#5E5751;  --ink-soft:#8E8780;       /* texto: principal, secundário, legendas */
--rust:#B96752;   --rust-dark:#9A4F3D;                         /* acento: seleção, ligações, contadores */
--crit:#8E3A2F;   --mid:#946B47;    --sage-dark:#5F7355;       /* estado: crítico, atenção, ok (sempre com texto) */
--line:rgba(48,44,41,.08); --rule:rgba(48,44,41,.14);          /* divisórias */
--mark:#F6EDE6;   --warn-bg:#FBEDEA; --ok-bg:#E8EEDF; --hover:rgba(48,44,41,.045);
--btn:#2F2B28;    --btn-h:#4A4440;
--r-s:6px; --r-m:8px; --r-l:12px;                              /* uma só escala de raios; pill só em etiquetas e chips */
--elev:0 8px 24px rgba(48,44,41,.12), 0 1px 3px rgba(48,44,41,.08);  /* só menus, paleta e diálogos */
```

## Tipografia
Geist (UI, títulos, números) + Geist Mono (horas, datas, contagens, metadados). Alojar em `fonts/` (RGPD). Título de página 30 px/600/-0.035em · secção 16 px/600 · base 13.5 px · legendas 12–12.5 px · números `tabular-nums`. Sem Inter, Roboto, Open Sans, sem serifas, sem maiúsculas forçadas em rótulos.

## Ícones
Uma só família: grelha 24, traço 1.5, pontas redondas, sem preenchimento, `currentColor`, 18 px. Sprite próprio (`<symbol>`). Ícone só quando a metáfora é universal; caso contrário, só texto. Ícones decorativos com `aria-hidden`.

## Navegação e menus
| Situação | Padrão |
|---|---|
| Áreas da aplicação (12 destinos, uso diário) | Barra lateral recolhível (240 → 64 px), grupos Negócio / Casamentos / Estúdio, ícone + rótulo, contadores em mono; recolhida mantém nome acessível e dica |
| Trocar de organização | Dropdown de seleção única no topo da barra lateral, com ✓ e "Criar organização" separado por divisória |
| Pesquisa e ações frequentes | Paleta de comandos ⌘K (pesquisa + ações + casamentos), com fundo escurecido |
| Ações de uma linha (casamento, pedido, fornecedor) | Menu ⋮ sempre visível (nunca só no hover); a ação principal da linha continua visível; 5–9 itens; grupos com divisórias; ação destrutiva no fim, a vermelho, com "…" e confirmação |
| Vistas do mesmo documento | Grupo segmentado (`aria-pressed`) |
| Secções de um registo | Separadores (`role=tab`) com sublinhado escuro |
| Mensagens | Ícone no cabeçalho com contador; **nunca** no menu principal |
Menus: itens ≥ 40 px (48 px em toque), hover e foco visíveis, Esc fecha e devolve o foco, setas navegam, clique fora fecha, atalhos só para comandos comuns e nunca como único acesso, nada em duas linhas.

## Estruturas de página (variar conforme a função)
Hoje = leitura principal + coluna de agenda · Carteira = mestre-detalhe · Pedidos = pipeline em colunas com filetes · Run sheet = tabela operacional por fases · Conversas = três painéis · Proposta = documento de apresentação (a desenhar) · Calendário = grelha de mês/semana (a desenhar).

## Componentes
Botão primário escuro 36 px raio 6, secundário com contorno, ligação terracota sublinhada no hover. Etiquetas pill 20 px. Estado = ponto colorido + texto. Nota da IA = bloco `--mark` com rótulo mono "Weddy Intelligence" e ações explícitas; nada é executado sem confirmação.

## Regras de qualidade (verificar em cada ecrã)
- Sem scroll horizontal a 390 px; testar 1440, 1024, 768 e 390 px.
- Botões reais para ações, `<a>` só para navegação; nada de ações só no hover.
- Foco visível 2 px; link "Saltar para o conteúdo"; nomes acessíveis em botões de ícone.
- `tabular-nums` em números; `…` e aspas tipográficas; datas e moeda com `Intl`.
- Animar só `transform`/`opacity`; sem `transition: all`; respeitar `prefers-reduced-motion`.
- Uma camada de contenção (no máximo duas caixas encaixadas); sem faixas laterais coloridas em cartões.

## Componentes de implementação (decisão pendente)
Se a stack for Vite + React (Doc. 3 §13.2), usar **shadcn/ui** (Radix) para Dialog, Sheet, DropdownMenu, Command (⌘K), Tabs, Calendar e DataTable, tematizado com estes tokens. Se for HTML/ES modules sem build, implementar os mesmos padrões à mão, como no protótipo.
