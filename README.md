# Weddy — app de planeamento de casamento (multi-casal)

Fase 1 concluída: qualquer casal pode criar conta, configurar o seu
casamento e convidar o(a) parceiro(a). Cada casal só vê os seus
próprios dados.

## 1. Criar o projeto Firebase (10 min)

1. Vai a https://console.firebase.google.com → **Adicionar projeto**
   → chama-lhe por exemplo `weddy-app`.
2. No menu da esquerda → **Compilação → Authentication** → separador
   **Sign-in method** → ativa **Email/Password**.
3. No menu da esquerda → **Compilação → Firestore Database** → **Criar
   base de dados** → modo produção → escolhe uma região europeia
   (ex: `eur3`).
4. Ainda em Firestore → separador **Regras** → cola o conteúdo do
   ficheiro `firestore.rules` (neste mesmo pacote) → **Publicar**.
5. No menu da esquerda → ⚙️ **Definições do projeto** → em baixo,
   secção "As suas apps" → clica no ícone `</>` (Web) → dá um nome
   → **Registar app**. Vais ver um bloco `firebaseConfig = {...}`.
6. Abre `index.html`, procura por `COLOCA_AQUI` (é perto do início do
   `<script>`) e substitui pelos valores reais que copiaste no passo 5.

## 2. Publicar no GitHub Pages

Mesmo processo que já conheces: sobe todos os ficheiros deste pacote
para um repositório novo (ex: `weddy`), ativa o GitHub Pages
(Settings → Pages → branch `main` → `/root`), e abre o link gerado.

## 3. Testar

- Abre o link → **Criar conta** com o teu email.
- Vais cair automaticamente no assistente de configuração (nomes,
  data, local) — isto só acontece na primeira vez.
- Depois de guardar, entras direto na app, já com os teus dados.
- Em **Definições**, podes convidar o par: ele/ela só precisa de criar
  conta com o email que convidaste, e entra automaticamente no mesmo
  casamento.

## O que falta (próximas fases)

- **Fase 2 — app nativa (Capacitor):** embrulhar este mesmo código
  num projeto Xcode, para correr como app instalada e poder ir a
  TestFlight. Precisa de um Mac com Xcode.
- **Fase 3 — TestFlight:** compilar, assinar com conta de Programador
  Apple, e submeter — feito por ti no Xcode, com o meu apoio passo a
  passo.
- Personalização visual por casal (cor de destaque, foto de capa)
  ainda não está ligada a upload — por agora o herói usa sempre o
  gradiente.
- A tab "Lugares" (mesa 3D) e "Inspiração" continuam iguais à versão
  da Rita & Tiago — são genéricas e já funcionam para qualquer casal.
