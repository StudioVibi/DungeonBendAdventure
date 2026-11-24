# DungeonBend Adventure — Tuning

Valores numéricos atuais. Não são regras: podem mudar sem alterar o `Rules.md`. A fonte de verdade é o código (`src/game/data.ts`, `src/game/mapgen.ts`, `src/game/store.ts`).

## Herói

| Valor | Atual | Constante |
|---|---|---|
| Vida máxima do Alberto | 15 (o `base_max_hp` do DungeonBend) | `HERO.maxHp` |

## Monstros: HP e ouro por nível (statlines do DungeonBend)

Do nível 1 ao 15, com `levelCap` aplicado. "…" repete o último valor até o nível 15.

| Monstro | HP | Ouro |
|---|---|---|
| Rat | 2, 6, 10, 14, 18, 23, 27… | 1, 3, 5, 7, 9, 11, 13… |
| Bat | 4, 7, 10, 13, 16, 20, 23, 26, 29… | 1, 2, 4, 5, 7, 9, 10, 12, 13… |
| Black Widow (Spider) | 6, 10, 14, 18, 22, 26… | 1, 3, 5, 7, 9, 11… |
| Green Slime | 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 31, 34, 36, 39 | 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18 |
| Angry Plant | 12, 15, 19, 23, 27, 31… | 1, 2, 4, 6, 8, 10… |
| Carnivorous Plant | 9, 12, 15, 18, 21, 25, 28, 31, 34… | 4, 5, 7, 8, 10, 12, 13, 15, 16… |

## Mapa e ondas

| Valor | Atual | Constante |
|---|---|---|
| Andares por dungeon | 15 | `MAX_FLOORS` |
| Ondas por andar | 9 | `WAVES_PER_FLOOR` |
| Monstros por onda (máx.) | 7 | `MAX_MONSTERS` |
| Orçamentos de HP (nível 1) das ondas | 4, 6, 8, 10, 12, 14, 17, 20, 26 | `BUDGETS` |
| Tipos de monstro por onda | 1 ou 2 | — |

## Distância das trilhas

Distância medida em unidades da cena de 1600×900.

| Categoria | Faixa | Tempo | Recursos | Descanso |
|---|---|---|---|---|
| D1 | até 370 | 10s | 0 | 0 |
| D2 | 370–540 | 20s | 1 encaixe compartilhado (recurso ou descanso) | — |
| D3 | 540–710 | 30s | 1 | 1 |
| D4 | 710–880 | 40s | 2 | 1 |
| D5 | 880–1050 | 50s | 3 | 1 |

- Início da faixa D1: 200 (`TRAIL_MIN`).
- Largura de cada faixa: 170 (`TRAIL_BAND`).
- Máximo conectável: 1050 (`TRAIL_MAX`).

## Tempo

| Valor | Atual | Constante |
|---|---|---|
| Por ponto de vida total da onda | 2s | `SECONDS_PER_WAVE_HP` |
| Por ponto curado no descanso | 2s | `SECONDS_PER_REST_HP` |
| Hospital após morte | 2h | `HOSPITAL_MS` |

## Mochila

| Valor | Atual | Constante |
|---|---|---|
| Slots de poção | 3 | `POTION_SLOTS` |
| Slots de arma | 2 | `WEAPON_SLOTS` |
| Descansos por andar | 1 | `CAMPFIRES_PER_FLOOR` |

## Itens

Os valores de cura e dano vêm do DungeonBend. Os preços são deste jogo.

| Item | Efeito | Preço |
|---|---|---|
| Poção pequena | cura 5 | 10g |
| Poção média | cura 12 | 30g |
| Poção grande | cura 20 | 60g |
| Cleaver | 5 de dano | 25g |
| Machete | 7 de dano | 50g |
| Big Machete | 12 de dano | 120g |
| Giant Cleaver | 16 de dano | 200g |

## Save inicial

- 60 de ouro (`STARTING_GOLD`).
- Estoque: 2 poções pequenas, 1 poção média e 1 Cleaver.
- Mochila: poção pequena, poção pequena, poção média e Cleaver.
