# DungeonBend Adventure — Ideias para lapidar

Decisões de implementação que **não vieram dos pedidos**: foram tomadas para o protótipo funcionar. Estão no código hoje, mas **não são regras**. Cada uma pode virar regra no `Rules.md`, mudar ou sair.

## Simulação

- O dano das armas não reduz o tempo da onda: o tempo usa a vida total da onda.
- O descanso (fogueira) cura até a vida cheia.
- Curas não passam da vida máxima.
- A simulação continua depois da morte, com vida negativa, para mostrar o déficit acumulado. O déficit é calculado como `1 − menor vida`.
- Ondas depois da morte aparecem acinzentadas e não contam para tempo, ouro nem cartas.

## Consumo e estoque

- Ao fim da run, cada slot de poção usado consome uma unidade do estoque, não importa em quantos andares o slot foi usado.
- As poções saem do estoque quando a run **começa**, para que duas runs na fila não usem a mesma poção.
- Tirar uma run da fila antes de ela começar devolve as poções, e a trilha volta a ser rascunho.
- Só dá para pôr um item num slot da mochila se houver estoque para isso. Uma compra já coloca o item na mochila quando há slot livre.
- Ao reabrir uma dungeon, os itens do rascunho que a mochila ou o estoque não comportam mais são removidos (com aviso).

## Morte e hospital

- Quando o Alberto morre, os monstros derrotados antes da onda fatal ainda viram cartas.
- O hospital conta a partir do fim da run em que ele morreu.
- A fila espera a alta para começar a próxima run.
- Durante o hospital, o jogador ainda pode planejar trilhas e enfileirar runs.

## Trilha e edição

- Cada onda entra no caminho no máximo uma vez por andar.
- Clicar numa onda já conectada corta o caminho logo depois dela.
- A distância de uma trilha é medida em linha reta, de centro a centro dos pontos que ela liga.
- Quando uma edição muda a distância de uma trilha, os itens que não cabem mais nos encaixes são removidos.
- Remover a escada apaga os andares acima dela.
- Arrastar a trilha da escada move a escada.

## Escada

- Uma arma colocada na trilha da escada vale para a primeira onda do andar seguinte.
- Os itens da trilha da escada contam no limite do andar onde a escada está.

## Prévia

- O hover numa onda, ou o arraste de item, escada ou trilha, mostra o plano hipotético (ghost) sem salvar.

## Interface

- Os cantos superiores do mapa não recebem ondas, para não cobrir os mostradores de vida e tempo.
- Um rascunho salvo com uma onda fora de alcance (por mudança no mapa) é cortado nessa onda.
- A ampulheta enche numa curva que nunca completa, porque o tempo da run não tem teto.
- O motion do mostrador de vida vem da diferença da vida final confirmada: desfazer uma trilha também mostra regeneração.
- Aberta, a fila cobre o mundo em vez de empurrá-lo, para a cena não mudar de escala.
- "Concluir run" fica no rodapé, ao lado de Desfazer e Limpar andar.
- A cápsula tem tons fixos por tipo: vida, cura, ouro, tempo, distância, arma, em andamento, pronta, na fila, hospital, neutro, pergaminho e perigo.
- Itens colocados enquanto uma trilha ainda está sendo construída só aparecem nos mostradores quando a construção termina.
