# Prompt one-shot — DungeonBend Adventure

> Cole este prompt num harness junto com `Rules.md`, `TUNING.md` e `IDEIAS.md`:
> - **`Rules.md`:** as regras de comportamento (leis).
> - **`TUNING.md`:** os valores numéricos.
> - **`IDEIAS.md`:** decisões de implementação atuais, revisáveis, que não são leis.
>
> Este prompt descreve o **conceito** (núcleo, core loop, estados) e o **conteúdo** (assets reaproveitados e o que precisa ser gerado).

---

Crie **DungeonBend Adventure**, um minigame web offline (TypeScript + React + Vite, sem backend; save em `localStorage`) derivado do jogo **DungeonBend**, que reaproveita assets dele. Implemente **todas** as regras de `Rules.md` exatamente como estão escritas, com os valores de `TUNING.md`. Onde as regras não definirem um comportamento, siga `IDEIAS.md`. Interface em português, com termos curtos de estado em inglês ("Survives", "Deficit", "floor", "wave", "damage").

## Conceito

O jogador não controla o combate: ele **planeja**. Num mapa interativo de dungeon, liga ondas de monstros com trilhas, distribui recursos (poções, armas, fogueira) ao longo do caminho e vê, a cada interação, quanto de vida o herói Alberto terá em cada ponto. Quando o plano fecha sem déficit (ou o jogador aceita o risco), ele inicia a run. A run leva **tempo real**, proporcional ao plano, e devolve ouro e cartas colecionáveis. O desafio é equilibrar ambição (mais ondas, andares mais altos, mais ouro) com recursos limitados e o custo de tempo e de morte (hospital).

### Núcleo

- O Alberto começa cada run com a vida cheia, e a vida segue de uma onda para a outra e de um andar para o seguinte.
- Cada onda tira dele a soma da vida dos monstros dela, menos o dano das armas colocadas no trecho anterior.
- Poções curam, e o descanso cura com custo de tempo.
- Se a vida chega a zero ou menos depois de uma onda, ele morre ali.
- O plano mostra onde isso acontece e quanto falta de vida (o déficit), para o jogador redistribuir recursos antes de iniciar a run.

### Core loop

1. **Menu (mundo):** escolher uma dungeon (Caverna, Cripta ou Jardim) ou ir à loja.
2. **Planejar a trilha:**
   - conectar ondas;
   - ver vida, déficit, tempo e ouro mudando ao vivo;
   - encaixar poções, armas e fogueira nos trechos (limitados pela distância);
   - opcionalmente pôr uma escada e continuar num andar mais difícil.
3. **Loja (a qualquer momento):** comprar itens com ouro e montar a mochila (3 poções + 2 armas). O plano fica salvo.
4. **Iniciar run:** a prévia confirma duração, recompensas e consumo. A run roda em tempo real e outras dungeons podem entrar na fila.
5. **Coletar:** ouro (se sobreviveu) e cartas dos monstros derrotados vão para o save. Morrer gera 2h de hospital.
6. Repetir com mais ouro, itens melhores e mapas mais profundos.

### Estados

- **App:** `carregando` → `menu` ↔ `dungeon` ↔ `loja` ↔ `coleção`. A navegação é em pilha: a Coleção aberta pela loja volta para a loja, e a loja aberta pela dungeon volta para a dungeon. O relatório é um modal.
- **Dungeon (por dungeon):** `livre` → `rascunho` (trilha salva) → `na fila` → `em andamento` (trancada) → `pronta` (coletar) → `livre`.
- **Herói:** `livre` · `em run` (aparece na porta da dungeon ativa) · `hospitalizado` (timer de 2h).
- **Plano:** cada andar tem uma lista de passos (onda + itens do trecho até ela), com escada opcional e itens no trecho da escada. A simulação deriva: vida após cada item e onda, morte e déficit, tempo, ouro e cartas.
- **Prévia:** hover numa onda ou arraste de item, escada ou trecho mostra o plano hipotético (ghost) sem salvar nada.

## Telas e UX (como devem ficar)

- **Carregamento:**
  - fundo só com a planície, sem estradas;
  - título grande no topo, com entrada em dois tempos: "DungeonBend" cai e quica, depois "Adventure" se assenta, saindo de desfocado e com letras espaçadas;
  - barra e porcentagem embaixo enquanto carrega;
  - quando o carregamento e a animação do título terminam, aparece "Clique ou aperte qualquer botão para começar", pulsando;
  - qualquer clique ou tecla começa e destrava o áudio.
- **Menu diegético:**
  - uma planície ensolarada ligando os quatro lugares com estradas de terra: a caverna à esquerda, o castelo-cripta ao fundo, o jardim à direita e a barraca do mercador na frente;
  - o Alberto parado na encruzilhada, sem marca no chão; os objetos são desenhados por profundidade, então árvores mais à frente cobrem a barraca;
  - hover num lugar acende o desenho só com brilho, sem mover nada (mover causaria loop de hover);
  - o hover abre um **card de pergaminho**: superfície única, baixo contraste e quente, com nome, frase curta, rostos e nomes dos monstros, uma linha de estado (só para run ativa, fila ou pronta) e um botão principal;
  - "descartar trilha" é um link discreto, e a confirmação acontece **dentro do card**, nunca com diálogo do navegador (que interrompe a música);
  - marcadores no mundo: "Trilha salva" (bandeirinha de pergaminho com mapinho), timer com progresso, "na fila", "✓ Coletar" (flutuando) e 🏥 sobre o Alberto;
  - barra superior: logo, Fila (abre uma cascata com coletar, tirar da fila e ⏩), ouro, Coleção e som.
- **Mapa da dungeon:**
  - HUD: voltar, nome, barra de vida, situação, tempo, ouro da run, carteira, Coleção, Loja, som e "Iniciar run" / "Colocar na fila";
  - abas de andar ("Andar N · Nv N · ondas · ♥ final"), com × só no último andar;
  - ondas desenhadas como **aglomerados de ícones circulares de borda simples**, com o recorte da cabeça de cada monstro, a pílula de custo "−N ♥", a ordem no caminho e o coração da vida resultante;
  - trilhas como **estrada tracejada de terra** com seta, marco de distância "D3 30s" e encaixes vazios ("+" para recurso, fogueira para descanso);
  - mochila na barra inferior: 3 slots de poção, 2 de arma, fogueira, escada, desfazer, limpar andar e uma dica curta.
- **Motion de construção:**
  - cada trecho novo (fora de prévia) se desenha da origem ao destino, e o tracejado e a seta aparecem ao chegar;
  - partículas do bioma saem ao longo do traçado: poeira na Caverna, pedrinhas em cinza quente com gravidade na Cripta, grama girando com torrões no Jardim;
  - um anel de impacto marca a chegada;
  - respeita `prefers-reduced-motion`.
- **Loja:**
  - parede de tábuas com luz de lampião e estantes "Poções" e "Armas";
  - itens apoiados na tábua (arte alinhada pela base), com etiqueta de papel pendurada: nome, preço e efeito ("+5 ❤" / "5 damage");
  - barra inferior em 4 setores: **Mochila** (slots) | **Armazém** (baú com itens possuídos; clique leva para a mochila) | **Seu ouro** (setor pequeno) | **Coleção** (leque de cartas de monstro).
- **Relatório (modal):** prévia ("Pronto para a run" / "Essa trilha mata o Alberto") ou resultado ("Saiu vivo!" / "Alberto caiu…"), com tempo, ouro, vida final, cartas e itens consumidos.
- **Coleção:** um card por monstro (bloqueado em silhueta até a primeira carta), contagem total e "Resetar progresso".
- **Dano de arma** aparece só como número (sem ícone ⚔); na etiqueta da loja vem acompanhado de "damage".
- Um ErrorBoundary mostra o erro em vez de tela escura.

## Conteúdo

### Assets reaproveitados do DungeonBend

Origem: o repositório `DungeonBend` (pasta irmã). As imagens são convertidas para WebP (`cwebp -q 85`, reduzidas a 50%) e o áudio é copiado sem alteração.

| Uso no jogo | Origem no DungeonBend | Destino |
|---|---|---|
| Alberto (idle, 6 frames) | `assets/characters/hero-idle/char-adventurer-0000…0005.png` | `public/assets/hero/alberto-0…5.webp` |
| Rat | `assets/monsters/enemies/enemy-rat-0000.png` | `public/assets/monsters/rat.webp` |
| Bat | `assets/monsters/enemies/enemy-bat-0000.png` | `public/assets/monsters/bat.webp` |
| Black Widow | `assets/monsters/enemies/enemy-spider-0000.png` | `public/assets/monsters/spider.webp` |
| Green Slime | `assets/monsters/enemies/enemy-slime-green-0000.png` | `public/assets/monsters/slime-green.webp` |
| Angry Plant | `assets/monsters/enemies/enemy-plant-0000.png` | `public/assets/monsters/plant.webp` |
| Carnivorous Plant | `assets/monsters/enemies/enemy-plant-carnivore-0000.png` | `public/assets/monsters/plant-carnivore.webp` |
| Poções pequena/média/grande | `assets/items/Consumables/health-potion-1/2/3.png` | `public/assets/items/potion-1/2/3.webp` |
| Cleaver / Machete / Big Machete / Giant Cleaver | `assets/items/Weapons/small-cleaver.png`, `machete.png`, `big-machete.png`, `big-cleaver.png` | `public/assets/items/*.webp` |
| Ícone de ouro | `assets/items/gold.png` | `public/assets/items/gold.webp` |
| Fonte de títulos (Jaro) | `assets/fonts/jaro.woff2` | `public/assets/jaro.woff2` |
| Música da dungeon (`trilha2`) | `assets/audio/music/dungeon_background_music.mp3` | `public/assets/audio/music/trilha2.mp3` |
| Botão confirm | `assets/audio/sfx/ui_click_1.mp3` | `public/assets/audio/sfx/confirm.mp3` |
| Botão back | `assets/audio/sfx/deck_card_remove.mp3` | `public/assets/audio/sfx/back.mp3` |
| Botão buy | `assets/audio/sfx/upgrade_button.mp3` | `public/assets/audio/sfx/buy.mp3` |

**Dados portados** (as tabelas estão em `TUNING.md`):
- HP e ouro dos monstros: `data/game/monsters.json` + `data/game/statlines.json`, assados por `scripts/dungeon-data.ts`.
- Vida do Alberto: `data/game/heroes.json`.
- Cura das poções: `data/game/potions.json`.
- Dano das armas: `data/game/weapons.json`.
- Ganho dos sons: catálogo `SOUNDS` em `assets/runtime/audio-bridge.js` e a régua de `assets/audio/MIXAGEM.md`.

**Notas de uso dos assets:**
- **Arte dos itens:** o canvas é 500×600, e a arte fica encostada no fundo, com o centro visual ~22% abaixo do centro do canvas. Para centralizar num ícone, suba 22% da altura. Numa estante, alinhe pela base.
- **Recorte da cabeça dos monstros** para os ícones circulares (`cx`, `cy` em fração do sprite 520×600; `r` em fração da largura):

  | Monstro | cx | cy | r |
  |---|---|---|---|
  | rat | .23 | .72 | .17 |
  | bat | .40 | .59 | .20 |
  | spider | .32 | .655 | .18 |
  | slime | .52 | .69 | .23 |
  | angry plant | .42 | .55 | .27 |
  | carnivore | .48 | .62 | .22 |

### Assets que precisaram ser gerados (originais, por código)

Todos ficam em `public/assets/generated/` e `public/assets/audio/`, gerados por scripts versionados no repositório.

- **Fundos das dungeons** (`scripts/gen-backgrounds.mjs` → `bg-caverna.svg`, `bg-cripta.svg`, `bg-jardim.svg`, 1600×900, vistos de cima):
  - **Caverna:** chão de terra marrom com ruído, poças, pedrinhas e rochas nas bordas.
  - **Cripta:** **chão de castelo simples** visto de cima: lajes quadradas em grade alinhada (não tijolos desencontrados, que parecem parede), algumas divididas, com desgaste, rachaduras, poucas velas e ossos. **Sem** tapete, mosaico, pilares ou sarcófagos, para não parecer sala de chefe.
  - **Jardim:** grama com ruído, tufos, flores, manchas de terra e arbustos nas bordas.
- **Ícones:** `campfire.svg` (toras cruzadas, chamas e pedras), `stairs.svg` (degraus de pedra com arco de luz e seta para cima) e `chest.svg` (baú de madeira com ferragens douradas, para o Armazém).
- **Mundo do menu** (`scripts/gen-overworld.mjs` → `overworld/*.svg` + `src/game/overworld-layout.json`), no estilo do DungeonBend (contorno escuro grosso, cores chapadas com uma sombra e uma luz):
  - `plain.svg`: céu, nuvens, montanhas, linha de árvores, planície e estradas até as portas;
  - `plain-empty.svg`: a mesma planície sem estradas, para o carregamento;
  - `caverna.svg`: rocha com musgo, boca escura com dentes de pedra, escoras de mina, tocha e trilho;
  - `cripta.svg`: castelo com torres, estandartes roxos, porta gótica com grade e brilho verde dos slimes, e túmulos;
  - `jardim.svg`: cerca viva, arco de pedra com trepadeira, portão de ferro aberto, Angry Plant e Carnivorous Plant espiando;
  - `shop.svg`: barraca com toldo listrado, balcão com poções e espada, placa de moeda, caixote e saco;
  - `tree.svg`: árvore, desenhada por profundidade na cena.
- **Trilha da estrada:** desenhada em SVG, sem asset: leito de terra largo, borda e tracejado claro animado ("marcha").
- **Partículas de construção:** geradas em runtime (`src/game/fx.ts`): poeira, pedrinhas poligonais e lâminas de grama.
- **Áudio original** (`scripts/gen-audio.mjs`, síntese + ffmpeg):
  - `music/trilha.mp3`: tema do menu em ré menor, 84 BPM, ~46s, em loop sem emenda. Tem cordas dedilhadas (Karplus-Strong), baixo, pad e, na segunda volta, melodia de flauta, com reverb.
  - `sfx/construction-<bioma>.mp3`: arrasto enquanto a trilha se desenha. Caverna: terra grave granulada. Cripta: pedrinhas batendo sobre um raspado. Jardim: farfalhar de grama com torrões.
  - `sfx/impact-<bioma>.mp3`: a batida de chegada da trilha.
  - Ganhos calibrados em LUFS na mesma régua do DungeonBend: a música do menu no nível da música da dungeon, a construção 2 dB acima do clique.
- **Mapeamento de áudio:**
  - `trilha` toca fora da dungeon e `trilha2` dentro, com crossfade de 1,2s;
  - `confirm` em botões comuns, `back` em voltar, fechar e descartar, `buy` ao comprar;
  - construção + impacto em cada trecho novo;
  - botão de mudo salvo; ajuste ao vivo via `window.__sfx`.

## Critérios de pronto

- Todas as regras de `Rules.md` se comportam exatamente como descritas, com os valores de `TUNING.md`. Valide no exemplo de referência: 4 Bat + 3 Rat no nível 1 = 22 de dano e matam o Alberto (15 de vida).
- Nenhum feedback de hover pode alterar o layout. Deltas e prévias flutuam sobre o conteúdo; mudar o tamanho de algo sob o mouse cria loop de hover e faz a tela tremer.
- Nenhum erro de áudio pode derrubar o jogo.
- `npm run build` passa sem erros de tipo.
