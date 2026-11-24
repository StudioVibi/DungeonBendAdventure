# DungeonBend Adventure — Rules

Regras de mecânica do jogo como estão implementadas hoje. Valores entre parênteses são as constantes do código (`src/game/data.ts`, `src/game/plan.ts`, `src/game/mapgen.ts`).

## Herói

- O herói é o **Alberto** (adventurer do DungeonBend).
- Vida máxima: **15** (`HERO.maxHp`, igual ao `base_max_hp` do DungeonBend).
- Toda run começa com a vida cheia.
- A vida nunca passa do máximo: curas além de 15 são desperdiçadas.
- A vida passa de um andar para o seguinte sem se recuperar.

## Dungeons

- Existem 3 dungeons. Cada uma define quais monstros aparecem:
  - **Caverna:** Rat, Bat, Spider (Black Widow).
  - **Cripta:** Green Slime.
  - **Jardim:** Angry Plant, Carnivorous Plant.
- Cada dungeon tem até **15 andares** (`MAX_FLOORS`).
- O nível dos monstros é igual ao número do andar: andar 1 = nível 1, andar 2 = nível 2 etc.
- Cada dungeon tem o seu próprio rascunho de trilha salvo, independente das outras.

## Monstros (statlines do DungeonBend)

- HP e ouro por nível, do 1 ao 15, com o `levelCap` de cada monstro já aplicado:

| Monstro | HP por nível | Ouro por nível |
|---|---|---|
| Rat | 2, 6, 10, 14, 18, 23, 27, 27… | 1, 3, 5, 7, 9, 11, 13, 13… |
| Bat | 4, 7, 10, 13, 16, 20, 23, 26, 29, 29… | 1, 2, 4, 5, 7, 9, 10, 12, 13, 13… |
| Black Widow | 6, 10, 14, 18, 22, 26, 26… | 1, 3, 5, 7, 9, 11, 11… |
| Green Slime | 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 31, 34, 36, 39 | 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18 |
| Angry Plant | 12, 15, 19, 23, 27, 31, 31… | 1, 2, 4, 6, 8, 10, 10… |
| Carnivorous Plant | 9, 12, 15, 18, 21, 25, 28, 31, 34, 34… | 4, 5, 7, 8, 10, 12, 13, 15, 16, 16… |

- "…" = repete o último valor até o nível 15.

## Ondas (waves)

- Uma onda é um grupo predefinido de monstros num ponto fixo do mapa do andar.
- Cada andar tem **9 ondas** (`WAVES_PER_FLOOR`), com no máximo **7 monstros** cada (`MAX_MONSTERS`).
- As ondas são determinísticas: a mesma dungeon e o mesmo andar sempre geram as mesmas ondas, a partir de uma seed fixa por dungeon + andar.
- A composição usa os orçamentos de HP de nível 1 `[4, 6, 8, 10, 12, 14, 17, 20, 26]`, embaralhados entre as ondas. Cada onda tem 1 ou 2 tipos de monstro do pool da dungeon.
- **HP total da onda** = soma do HP de cada monstro no nível do andar.
- **Ouro da onda** = soma do ouro de cada monstro no nível do andar.
- Enfrentar uma onda tira do Alberto a vida igual ao HP total dela, menos o dano das armas (ver Armas).

## Trilha (pathing)

- O jogador monta o caminho ligando, em ordem: Alberto → onda → onda → … e, opcionalmente, → escada.
- Cada onda entra no caminho **no máximo 1 vez por andar**.
- Pode-se parar em qualquer ponto. O fim do caminho significa **sair da dungeon**.
- Formas de conectar:
  - clicar numa onda livre;
  - arrastar a partir do Alberto (ou do fim do caminho), passando por várias ondas em sequência.
- Clicar numa onda que já está no caminho **corta o caminho** logo depois dela.
- Clicar num trecho: se for o **último trecho do andar**, ele é apagado. Nos outros trechos aparece uma dica e nada muda.
- Arrastar um trecho e soltar numa onda livre troca a onda de destino. A onda antiga sai, e a nova se liga à mesma onda anterior e à mesma saída, **sem deixar trilhas órfãs**.
- Arrastar o trecho da escada move a escada.
- Backspace/Delete remove a última onda do andar. Ctrl/Cmd+Z desfaz.

## Distância das trilhas

- A distância de um trecho é medida em linha reta, de centro a centro dos pontos que ele liga, em unidades do mapa (cena de 1600×900).
- As distâncias se dividem em **5 categorias**, em faixas de largura fixa: **170** (`TRAIL_BAND`) a partir de **200** (`TRAIL_MIN`). Variações dentro da faixa não mudam a categoria.

| Distância | Faixa | Tempo somado | Encaixes |
|---|---|---|---|
| D1 | até 370 | +10s | nenhum recurso, nenhum descanso |
| D2 | 370–540 | +20s | 1 encaixe: 1 recurso **ou** 1 descanso |
| D3 | 540–710 | +30s | 1 recurso **e/ou** 1 descanso |
| D4 | 710–880 | +40s | até 2 recursos e 1 descanso |
| D5 | 880–1050 | +50s | até 3 recursos e 1 descanso |

- Acima de 1050 (`TRAIL_MAX`), o ponto é **longe demais** e não pode ser conectado. Isso vale para conectar ondas, trocar onda e colocar ou mover a escada.
- **Recurso** = poção ou arma. **Descanso** = fogueira.
- Se uma edição muda a distância de um trecho (trocar onda, mover escada, cortar o caminho), os itens que não cabem mais são removidos automaticamente.

## Mochila e itens

- A mochila tem **3 slots de poção** e **2 slots de arma** (`POTION_SLOTS`, `WEAPON_SLOTS`).
- Um item só pode ser posto num slot se houver estoque: o número de slots com o mesmo item ≤ quantidade possuída.
- **A mochila renova a cada andar:** em cada andar, cada slot pode ser usado **1 vez**.
- Os itens são colocados arrastando da mochila para um encaixe de um trecho. Clicar num item da trilha remove o item.
- **Poções** curam antes da onda seguinte, limitadas à vida máxima:

| Poção | Cura | Preço |
|---|---|---|
| Poção pequena | +5 | 10g |
| Poção média | +12 | 30g |
| Poção grande | +20 | 60g |

- **Armas** causam dano fixo à **próxima onda**, que é subtraído do HP total dela. O dano pode passar da vida do Alberto, permitindo derrotar ondas com mais HP total que ele. Várias armas no mesmo trecho somam.

| Arma | Dano | Preço |
|---|---|---|
| Cleaver | 5 | 25g |
| Machete | 7 | 50g |
| Big Machete | 12 | 120g |
| Giant Cleaver | 16 | 200g |

- **Consumo das poções:** ao iniciar a run, cada slot de poção usado em pelo menos um andar consome **1 unidade** do estoque, independentemente de quantos andares o usaram. Quando o Alberto morre, só contam os usos até a morte.
- **Armas nunca são consumidas.**
- Ao (re)abrir uma dungeon, os itens do rascunho que a mochila ou o estoque não comportam mais são removidos (com aviso).

## Descanso (fogueira)

- Limite de **1 fogueira por andar** (`CAMPFIRES_PER_FLOOR`), além do limite de encaixes de cada trecho.
- A fogueira cura até a vida cheia.
- Custa **2s por ponto de vida curado** (`SECONDS_PER_REST_HP`).

## Escada (subir de andar)

- A escada é arrastada para o mapa e fica ligada ao fim do caminho do andar, dentro do alcance (até D5).
- Colocar a escada cria a aba do próximo andar (nível +1), mas **não troca de andar sozinho**. O jogador sobe clicando na escada ou na aba.
- O trecho até a escada também tem distância, tempo e encaixes:
  - poção e fogueira nele agem antes de subir;
  - **arma nele vale para a 1ª onda do andar seguinte**;
  - os itens dele contam no limite do andar onde a escada está.
- Só a aba do último andar criado tem **×**, que remove esse andar e a escada do anterior.
- Remover a escada (clicando no trecho dela, que é o último do andar) apaga os andares acima.

## Simulação, vida e déficit

- A ordem em cada trecho é: itens do trecho (na ordem colocada) → onda.
- A vida é recalculada a cada interação (conectar, prévia de hover ou arraste, colocar ou remover item) e aparece no mapa: um coração após cada item e após cada onda.
- O Alberto morre quando a vida fica **≤ 0** depois de uma onda.
- A simulação continua depois da morte, com a vida negativa, para mostrar o **déficit**:
  - déficit = `1 − menor vida registrada`;
  - a onda onde ele morre é marcada "morre aqui";
  - as ondas seguintes ficam acinzentadas.
- O HUD mostra a vida final, a situação ("Survives" ou "Deficit N (floor F, wave W)"), o tempo na dungeon e o ouro da run, com a mudança prevista durante as prévias.

## Tempo da run

- Cada onda custa **2s por ponto de HP total da onda** (`SECONDS_PER_WAVE_HP`), sem desconto pelo dano de armas.
- Cada fogueira custa 2s por ponto curado.
- Cada trecho custa o tempo da sua distância (10/20/30/40/50s), inclusive o trecho da escada.
- O **tempo da run** é a soma até a saída ou até a morte. Se o Alberto morre, o tempo para na onda fatal.

## Run em tempo real e fila

- "Iniciar run" mostra uma prévia (duração, ouro, cartas e itens consumidos) e, ao confirmar, a run passa a rodar em **tempo real**.
- As poções saem do estoque **no início** da run, para que runs na fila não usem a mesma poção.
- O rascunho dessa dungeon vira a run e deixa de ser rascunho.
- Enquanto a run de uma dungeon não termina, essa dungeon fica **trancada**.
- As runs formam uma **fila**: uma de cada vez, e a próxima começa quando o Alberto fica livre.
- Uma run na fila que ainda não começou pode ser retirada. As poções voltam ao estoque, a trilha volta a ser rascunho e os horários da fila são recalculados.
- Quando a run termina, ela fica "pronta" até ser **coletada**.
- Playtest: há um atalho "terminar agora" para a run em andamento.

## Morte e hospital

- Se a run termina com o Alberto morto, ele fica **2h hospitalizado** (`HOSPITAL_MS`), contadas a partir do fim da run.
- A próxima run da fila só começa depois da alta.
- Durante o hospital, ainda dá para montar trilhas e enfileirar runs.
- Playtest: há um atalho "dar alta agora".

## Recompensas e coleção

- **Ouro:** soma do ouro das ondas derrotadas, recebido **só se o Alberto sair vivo**. Morrendo, todo o ouro da run é perdido.
- **Cartas:** cada monstro derrotado vira **1 carta** daquele monstro.
  - As cartas valem mesmo se o Alberto morrer, mas só para os monstros derrotados antes da onda fatal.
  - As cartas são só colecionáveis.
  - A carta é **por monstro, sem distinção de nível**.
- Ouro e cartas entram no save ao **coletar** a run terminada.
- Os monstros no mapa não são cartas: eles viram cartas depois de derrotados.

## Loja

- A loja está acessível a todo momento: pelo menu (barraca) e pela dungeon. A trilha em montagem fica salva.
- Comprar custa o preço em ouro e soma +1 ao estoque. Se houver slot livre, o item já entra na mochila.
- Pela loja dá para pôr itens do Armazém na mochila e tirar itens dos slots.

## Save

- O save é local (`localStorage`) e guarda: ouro, estoque, mochila, cartas, rascunhos por dungeon, runs/fila e hospital.
- Início do jogo:
  - **60 de ouro**;
  - 2 poções pequenas, 1 poção média e 1 Cleaver;
  - mochila com poção pequena, poção pequena, poção média e Cleaver.
- Há um botão "Resetar progresso" na Coleção.
