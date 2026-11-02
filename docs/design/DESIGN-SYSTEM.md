# Weddy — Design System & Product Standards

**Estado:** referência obrigatória para todo o desenvolvimento futuro. Versão 1.0, 2026-11-01.
**Origem:** extraído diretamente do código real (`app/index.html`, `rsvp.html`, `manifest.json`), não de intenção de design. Onde o código se afasta dos tokens, está registado em §14 (desvios), sem os corrigir: **este documento descreve a identidade, não a altera.**
**Regra-mãe:** não redesenhar, não introduzir novas fontes, não introduzir novas famílias de cor. Qualquer exceção precisa de aprovação da Rita.

---

## 1. Princípios
1. **Calma editorial.** Fundo creme, muito espaço, texto escuro suave, um só acento terracota. Sem cores saturadas, sem gradientes vistosos.
2. **Uma identidade em todas as páginas** (app, RSVP do convidado, site, páginas públicas).
3. **Títulos em serifa (Cormorant Garamond), tudo o resto em Manrope.** Nunca mais de duas famílias.
4. **Linguagem:** PT-PT, tom caloroso e direto, tratamento por "tu", frases curtas. Sem jargão técnico, sem "erro 500". Sempre uma saída ("tenta de novo").
5. **Toque primeiro:** desenhado para telemóvel; o desktop reorganiza (barra lateral), não reinventa.
6. **Acessibilidade como base:** foco visível, `aria-label` em botões só com ícone, alvos ≥ 40 px, sem depender só da cor.

## 2. Tipografia

| Papel | Família | Pesos usados | Onde |
|---|---|---|---|
| Títulos e números de destaque | **Cormorant Garamond** (serifa) | 500, 600, 700 e itálico 500 | Títulos de página, títulos de sheet, nomes dos noivos, valores grandes |
| Tudo o resto | **Manrope** (sans) | 400, 500, 600, 700, 800 | Texto, botões, formulários, navegação |

Carregamento (Google Fonts): `family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700;800`. Fallback: `serif` / `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`. Há cópia local (woff) em `/fonts` com as licenças OFL.

### Hierarquia (valores reais do código)
| Nível | Estilo | Exemplos |
|---|---|---|
| Título de ecrã (`.navbar h1`) | Cormorant 500, **29 px** (24 px em desktop do Comparador), cor `--heading`, `line-height` 1.1 | "Orçamento", "Convidados" |
| Título hero de página (`.orcx-title`) | Cormorant 500, **44 px**, `line-height:1`, `--heading` | Cabeçalho do Orçamento |
| Título de sheet (`.sheet-title`) | Cormorant 600, **20 px**, centrado, `--heading` | "Novo gasto" |
| Subtítulo (`.orcx-sub`) | Manrope 400, **15 px**, `line-height:1.4`, cor suave | Legenda por baixo do título |
| Texto base | Manrope 400/500, **13–14.5 px** | Corpo, campos (14.5 px) |
| Texto secundário | Manrope, **11.5–12.5 px**, `--ink-soft` | Notas, legendas |
| Eyebrow / etiqueta | Manrope 600, 10.5–11.5 px, maiúsculas, espaçamento de letras ~.08em, `--rust` | Datas, secções pequenas |
| Botão | Manrope 600 (500 no botão pill de sheet), 13.5–14.5 px | |

Tamanhos mais usados no código (contagem): 13 px, 12.5 px, 12 px, 14 px, 11.5 px, 13.5 px, 10.5 px, 11 px, 15 px, 14.5 px. Evitar criar tamanhos novos; usar estes.
`letter-spacing` em títulos: `.002em`. Texto longo: `line-height` 1.4–1.55.

## 3. Cor

### 3.1 Tokens (`:root`, fonte de verdade)
| Token | HEX | Uso |
|---|---|---|
| `--cream` | `#FAF8F5` | Fundo da app, `theme-color` e `background_color` do manifest |
| `--cream2` | `#F3EFEA` | Fundo da barra lateral / superfícies secundárias |
| `--card` | `#FFFDFC` | Cartões, botões redondos |
| `--ink` | `#302C29` | Texto principal |
| `--ink-soft` | `#8E8780` | Texto secundário, ícones inativos |
| `--rust` | `#B96752` | **Acento principal** (botões, links, selecionado) |
| `--rust-dark` | `#9A4F3D` | Acento escuro (hover/erro), textos de destaque |
| `--heading` | `#9A4F3D` | **Títulos e números grandes** |
| `--gold` / `--joint` | `#C9A480` | Lado "Conjunto" nos convidados |
| `--joint-dark` | `#A97F5B` | Idem, escuro |
| `--gold-soft` / `--blush` | `#E7C5BB` | Rosa suave (noiva, fundos suaves) |
| `--blush-dark` | `#CB9A8C` | Rosa médio |
| `--dusty` | `#B8ADA3` | Taupe (noivo) |
| `--dusty-dark` | `#96897D` | Taupe escuro |
| `--sage` | `#A8B39C` | Verde sálvia, estado "ligado" |
| `--sage-dark` | `#7C8A6E` | Sálvia escuro, sucesso |
| `--line` | `rgba(48,44,41,.09)` | Contornos e divisórias |
| `--shadow` | `0 2px 12px rgba(48,44,41,.055), 0 1px 2px rgba(48,44,41,.04)` | Cartões |

### 3.2 Cores semânticas e de apoio (existem no código)
- **Erro / atenção:** `--rust-dark` com anel `rgba(193,88,62,.13)`; texto de erro `#8E3A2F`.
- **Sucesso:** `--sage-dark` (`#7C8A6E`/`#5F7355`), verde de confirmação `#1a7d3a` (envio concluído).
- **Fundos de aviso suave:** `#FBEDEA` (rosa), `#E8EEDF` (verde), `#FCEBD9` (pêssego).
- **Cores de dados/categorias:** `#5F8F93` (azul-petróleo), `#A95A67`, `#C98E80`, `#4F6342`; ver `CMP_DOTS` no Comparador.
- **Backdrop de sheets:** `rgba(20,18,14,.42)`; diálogos de confirmação `rgba(30,26,23,.55)`.

### 3.3 Regras de uso
- Acento = **um** (terracota). Nunca introduzir azul/roxo/verde vivos como cor de marca.
- Títulos sempre `--heading`; texto `--ink`; secundário `--ink-soft`.
- Sem modo escuro: **não existe** (`prefers-color-scheme` não é usado). A app é sempre clara.
- Contraste: `--ink-soft` sobre creme é adequado só para texto secundário ≥ 12 px; nunca para informação essencial pequena.

## 4. Ícones
- Estilo **linha** (outline), `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.4"` (1.6–1.8 em botões pequenos/FAB), `stroke-linecap="round"`, `stroke-linejoin="round"`.
- Definidos em `const ICONS` (JS) e inline; **herdam a cor** (`currentColor`): inativos `--ink-soft`/`#ABA7A0`, ativos `--rust`.
- Tamanhos: 24 px na barra de navegação; 15–20 px dentro de botões e linhas; 34 px em botões redondos (`.home-icon-btn`).
- Ornamento botânico (`botanical`, viewBox 64×90, traço 1.1) só em ecrãs de entrada/vazios. Faísca `sparkle` identifica a **Weddy AI**.
- Nunca usar emojis como ícones de interface (só no texto do convidado, ex.: 🎉 no RSVP). Nunca misturar ícones preenchidos.

## 5. Botões

| Tipo | Classe | Especificação real |
|---|---|---|
| Primário (formulários e sheets) | `.btn-save` | Altura **46 px**, pill (`border-radius:99px`), fundo terracota (`--rust`; nos sheets `#9E5B4B`), texto branco, 14 px / peso 500, `letter-spacing:.04em`, largura 100 % |
| Cancelar / terciário | `.btn-cancel` | Altura 40 px, sem fundo, texto `#8B7D74` 13.5 px, **sublinhado**, 100 % |
| Login/ação larga | `.login-btn` | Altura 46 px, raio 24 px, peso 600, 14.5 px, sombra suave `0 8px 20px rgba(139,82,55,.2)` |
| Secundário "contorno" | `.cmp-ai-secondary` (Comparador), `.wa-save` (RSVP) | Contorno 1–1.6 px (`--blush-dark` no Comparador, terracota no RSVP), texto terracota, fundo transparente, raio 12 px, 14 px / peso 600 |
| Link de texto | `.cb-link` | 13 px, terracota, sublinhado de 1 px |
| Ícone redondo | `.home-icon-btn` | 34×34, círculo, fundo `--card`, contorno `--line`, ícone terracota |
| Segmentado | `.segmented`, `.cb-tab` | Fundo `rgba(20,20,20,.08)`, raio 9 px (tabs: pill 999 px, ativo `#AD624F` com texto branco, altura mínima 38 px) |
| Alternar (toggle) | `.mini-toggle` | 42×25, raio 13 px; ligado `--sage`; cursor `pointer`; sempre com rótulo |
| FAB do assistente | `.chat-fab` | Redondo, canto inferior direito (24 px + safe-area) |

Estados: `:active` baixa a opacidade (~.85); `disabled` ~.5; foco visível com contorno 2 px `--rust` (offset 2). Um só primário por ecrã.

## 6. Formulários
- Campo (`.sheet-field input, select, textarea`): largura 100 %, contorno **1 px `--line`**, fundo `#fff`, raio **9 px**, padding **9 × 10**, texto **14.5 px** em `--ink`, `font-family:inherit`, sem outline nativo.
- RSVP (páginas públicas): contorno 1.6 px, raio 12 px, padding 11 × 12.
- Rótulo acima do campo, 12 px, peso 600, `--ink-soft`.
- Erro: `.field-error` → contorno `--rust-dark` + anel `0 0 0 3px rgba(193,88,62,.13)` e mensagem (`.login-msg.error`) em texto, nunca só cor.
- Valores monetários e datas formatados em PT (`1 234,56 €`, `1 de julho de 2027`).
- Checkbox: `accent-color: var(--rust)`, 18 px (consentimento WhatsApp). Consentimentos **nunca** pré-marcados.

## 7. Modais, sheets e diálogos
- **Sheet** (`.sheet`): sobe do fundo, `border-radius:24px 24px 0 0`, fundo `--cream`, padding `10px 18px 28px`, `transition: transform .28s cubic-bezier(.32,.72,0,1)`, com pega (`.sheet-handle`, `rgba(43,37,34,.2)`) e backdrop `rgba(20,18,14,.42)` (fade .2 s). Título Cormorant 20 px centrado. Botões no fundo: primário e a seguir "cancelar".
- **Diálogos** (`weddyConfirm`, `weddyAlert`): substituem `confirm()/alert()` nativos (que alguns webviews suprimem). Folha ancorada em baixo, raio `20px 20px 0 0`, largura máx. 420 px, texto 15 px centrado, fundo `rgba(30,26,23,.55)`; confirmar = `.login-btn` primário, cancelar = botão neutro `rgba(60,51,43,.08)`. **Nunca usar `alert()`/`confirm()` nativos.**
- **Ecrãs sobrepostos** (importação `.gimp`, notificações `.nt-*`): `position:fixed; inset:0`, fundo `#FAF8F5`, padding com `env(safe-area-inset-*)`, botão "Fechar" em texto no canto; o botão Voltar do sistema fecha primeiro o sobreposto (`weddyBackStep`).
- Fechar: toque no backdrop, "cancelar", Esc e Voltar.

## 8. Navegação
- **Telemóvel:** barra inferior (`#tabbar`) com 6 separadores: Início, Orçamento, Convidados, Gastos, Mesas, Lugares (`TABS`). Ícone 24 px + etiqueta pequena; inativo `#ABA7A0`, ativo terracota.
- **Desktop (≥ 1024 px):** a mesma navegação passa a **barra lateral** à esquerda, 232 px (204 px em ecrãs mais estreitos), fundo `--cream2`, borda direita `--line`, itens em linha (ícone + texto, gap 12, padding 12×14, raio 12).
- **Cabeçalho de página** (`.navbar`): sticky, título Cormorant, seta de voltar; Início usa `.home-header-v2` com ícones redondos `.home-icon-btn` (notificações A.2, inspiração/coração, definições).
- Páginas secundárias (Definições, Comparador, etc.) usam o mesmo cabeçalho e o botão Voltar.
- Nomes de páginas **não se mudam** sem pedido expresso.

## 9. Espaçamento, raios e sombras
- **Gutter de página:** 18 px (telemóvel); conteúdo desktop centrado, máx. ~1280 px com 28 px de margem (Comparador).
- Escala em uso: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28 px. Espaço entre blocos 14–20 px; dentro de cartões 12–16 px.
- **Raios:** 8, 10, 12, 14 (mais usado), 16, 18, 20, **24 (sheets)**, pill 99/999. Cartões 14–20 px.
- **Sombra:** só `--shadow` (muito suave); o botão login tem a sombra própria acima. Sem sombras duras.
- **Linhas:** `1px solid var(--line)` entre linhas de lista.
- **Animação:** 0.15–0.28 s, curvas suaves; só o Comparador tem `prefers-reduced-motion` (ver §14).

## 10. Responsividade
- Pontos de quebra no código: **1024** (desktop: barra lateral, layouts em colunas), **768/767**, **700**, **900**, **420**, **359** (ecrãs muito pequenos).
- Mobile first. Nada de scroll horizontal. A app ocupa o ecrã (`position:fixed`, sem JS a medir altura); respeitar `env(safe-area-inset-*)` (topo e fundo).
- Páginas públicas (RSVP): cartão central máx. **420 px**, raio 26, padding 36×26, centrado.
- Testar sempre a 390×844 (telemóvel) e 1360×900 (desktop).

## 11. Componentes e padrões
| Componente | Padrão |
|---|---|
| Cartão | Fundo `--card`, raio 14–20, `--shadow` ou contorno `--line` |
| Lista | Linhas com divisória `--line`, ícone redondo à esquerda, título 14 px / peso 600, secundário 12 px suave |
| Chips / etiquetas | Pill, texto 11–12 px, fundo rosa/sálvia suave; "Nova"/"Importante" nas notificações |
| Estado vazio | Mensagem curta e calorosa + ação; ornamento botânico opcional |
| Progresso | Barras finas arredondadas (`.orcx-bar`), anel com % (`sdRing`) |
| Aviso inline | `.login-msg` 12.5 px; erro a terracota, sucesso a sálvia |
| Bloqueio Premium | Página `viewDefPremiumLocked` (explica e convida), nunca um beco sem saída |
| Weddy AI | Ícone faísca + rótulo "Weddy AI"; sempre com revisão humana antes de aplicar |
| Notificações | Sino no cabeçalho do Início, ponto terracota, centro em ecrã inteiro (A.2) |

## 12. Voz e conteúdo
- PT-PT (nunca PT-BR): "ecrã", "telemóvel", "toca", "guardar". Tratamento por **tu**.
- Títulos curtos (1–3 palavras), subtítulo de uma frase. Verbos no imperativo gentil ("Revê e confirma").
- Mensagens de erro: o que aconteceu + o que fazer; nunca culpar a pessoa.
- Datas e moeda em formato português; EN completo como alternativa (`ta()` com `APP_I18N.pt/en`).
- Premium: explicar o valor, nunca pressionar; preço e condições não se alteram em copy.

## 13. Padrões de produto (checklist obrigatória para qualquer nova funcionalidade)
1. Usa só os tokens de §3 (`var(--…)`); não codifiques HEX novos.
2. Fontes: títulos Cormorant, resto Manrope. Sem fontes novas.
3. Botões, campos, sheets e diálogos como em §5–§7; sem `alert()/confirm()`.
4. Textos em PT-PT **e** EN (`APP_I18N`), sem texto fixo no HTML.
5. Foco visível, `aria-label` em botões de ícone, alvos ≥ 40 px, estado não só por cor.
6. Testar 390 px e 1360 px, sem overflow horizontal, com safe-area.
7. Estados: carregar, vazio, erro, sem ligação, Premium bloqueado.
8. Consentimentos desmarcados por defeito; nunca assumir consentimento.
9. Nada de dados fabricados; nada sem teste (normal e extremo).
10. Não alterar nomes de páginas nem a identidade sem autorização.

## 14. Desvios encontrados (para uma fase de limpeza futura, não corrigidos aqui)
Medições sobre o CSS atual (340 KB):
- Muitos HEX **hardcoded** que não são tokens e estão próximos deles: `#AD624F` (62 usos, ≈ `--rust` `#B96752`), `#2B2522` (51, ≈ `--ink`), `#8B7D74` (35), `#E6DCD4` (31, divisórias), `#9E5B4B` (botões de sheet), `#FFFDFB`. Recomendação: introduzir tokens para estes (`--rust-ui`, `--line-strong`…) **sem** alterar a aparência, e só então migrar.
- `.login-btn` está definido duas vezes com valores diferentes (raio 24 px vs 11 px).
- Sem modo escuro e sem `prefers-reduced-motion` global (só no Comparador).
- `rsvp.html` e as páginas públicas repetem os tokens em vez de partilhar um ficheiro (risco de deriva).
- Alvos de toque < 40 px em alguns botões pequenos (ex.: 34 px nos botões redondos; aceitável só com área de toque ampliada).
- Parte do inglês ainda mostra textos em PT.

## 15. Fontes de verdade
`app/index.html` (`:root`, `.sheet`, `.btn-*`, `ICONS`, `TABS`, `weddyConfirm/weddyAlert`), `rsvp.html` (`:root`, `.card`), `manifest.json` (`theme_color`). Este documento deve ser atualizado **no mesmo pedido** que alterar qualquer token ou componente.
