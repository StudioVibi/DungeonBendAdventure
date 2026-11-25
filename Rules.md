# DungeonBend Adventure — Rules

Regras de comportamento do jogo. Os valores numéricos ficam em `TUNING.md`. As decisões de implementação ainda não promovidas a regra ficam em `IDEIAS.md`.

## Dungeons e monstros

- A dungeon escolhida define quais monstros aparecem nas ondas: a Caverna tem Rat, Bat e Spider; a Cripta tem Green Slime; o Jardim tem Angry Plant e Carnivorous Plant.
- HP e ouro de cada monstro seguem a statline do DungeonBend para o nível do monstro.
- As ondas de cada andar são predefinidas: o jogador conecta grupos que já existem no mapa.
- Os monstros de um andar novo têm um nível a mais que os do andar anterior.
- No mapa, cada onda aparece como um aglomerado de ícones circulares de borda simples, com o recorte da cabeça de cada monstro.
- Monstros no mapa não são cartas: só viram cartas depois de derrotados.

## Trilha

- As trilhas são desenhadas como linhas tracejadas com estética de estrada.
- O jogador não precisa conectar todas as ondas: parar de conectar significa sair da dungeon.
- Cada conexão, recurso ou descanso adicionado atualiza na hora a vida do Alberto, o déficit, os recursos e o tempo exibidos.
- Clicar na última trilha de um andar apaga essa trilha; as trilhas anteriores não são apagadas por clique.
- Arrastar uma trilha até outra onda troca o destino dela, seja ela a última ou não.
- Ao trocar o destino de uma trilha, a nova onda herda o caminho de saída da onda substituída, e nenhuma trilha fica órfã.

## Distância das trilhas

- Toda trilha pertence a uma de cinco categorias de distância, da D1 à D5.
- As categorias têm faixas de largura fixa: o comprimento de uma trilha pode variar dentro da faixa sem mudar de categoria.
- Só existem cinco distâncias: pontos além da faixa da D5 não podem ser conectados.
- Quanto maior a categoria da trilha, mais tempo ela soma à run.
- A D1 não aceita recurso nem descanso.
- A D2 tem um único encaixe, que aceita um recurso ou um descanso, nunca os dois.
- O encaixe único mostra recurso e fogueira lado a lado; ao ser preenchido, fica só o tipo escolhido.
- Da D3 em diante, recursos e descanso têm encaixes separados, e a capacidade de recursos cresce com a categoria.
- O limite de um descanso por andar vale mesmo quando há encaixes de descanso livres em outras trilhas.

## Mochila, poções e armas

- A mochila tem slots separados para poções e para armas.
- Recursos (poções e armas) são colocados nos encaixes das trilhas.
- Soltar um recurso numa trilha que passa por cima de uma onda só aloca o recurso; não cria trilha.
- Cada slot da mochila pode ser usado uma vez por andar.
- Subir de andar libera de novo todos os slots da mochila.
- Itens consumidos numa run não voltam: o jogador repõe comprando na loja.
- A arma causa dano fixo na onda seguinte ao trecho onde foi colocada.
- O dano de arma pode passar da vida do Alberto, permitindo derrotar ondas com vida total maior que a dele.

## Descanso

- Só pode haver um descanso por andar.
- O descanso só tem uma opção, a fogueira: clicar num encaixe de descanso já coloca a fogueira, se ela ainda for válida.
- O tempo de um descanso depende de quanto o Alberto cura nele.

## Escada

- Colocar a escada cria um novo andar, com novos grupos de monstros.
- Construir a escada não leva o jogador ao próximo andar: ele sobe clicando na escada ou na aba criada.
- A trilha até a escada aceita recursos e descanso, como as outras trilhas.
- Cada andar aparece como uma aba lateral do mapa, como as divisórias de um caderno.
- Só a aba do último andar criado tem o botão ×, e fechar essa aba remove o andar.

## Tempo da run

- A duração da run soma o tempo de cada onda enfrentada, de cada descanso e de cada trilha percorrida.
- O tempo de uma onda é proporcional à vida total da onda.
- Ao terminar de conectar o caminho, o jogador vê quanto tempo vai ficar na dungeon.

## Run em andamento e fila

- O lugar da dungeon no menu mostra o timer da trilha em andamento.
- Uma dungeon com run em andamento não pode ser aberta até a run terminar.
- O jogador pode criar uma fila para que runs de outras dungeons comecem em sequência.
- A fila fica sempre visível, numa barra lateral dedicada do menu.
- Fechada, a barra da fila mostra só o progresso e o ícone de cada run; ela se expande ao clicar.
- Um herói que morre fica hospitalizado por um tempo antes de poder fazer outra run.
- Durante o playtest, existem atalhos para terminar a run em andamento e para dar alta do hospital.

## Tela da dungeon

- O topo da tela é para navegação e ajustes, não para HUD.
- A vida do Alberto aparece num mostrador diegético no canto superior esquerdo do fundo, e o tempo numa ampulheta diegética no canto superior direito.
- Cada trilha construída faz o mostrador de vida sofrer o dano da onda escolhida; recursos de cura nas trilhas fazem ele regenerar.
- A tela da dungeon não mostra o ouro total da conta; o ouro aparece só na etiqueta de cada onda.
- O estado do Alberto (a situação) aparece embaixo dele, só como texto, sem título nem cápsula.
- A etiqueta de cada onda mostra a vida que ela tira e o ouro que ela dá.

## Visual

- Informações pequenas usam a cápsula do DBA: um shape único e detalhado, com a cor mudando conforme a informação. Não existem cápsulas cilíndricas.

## Recompensas e coleção

- O ouro de uma run só é recebido se o Alberto sair vivo.
- Cada monstro eliminado adiciona uma carta daquele monstro à coleção.
- Cartas são só colecionáveis, sem efeito no jogo.
- O nível do monstro não distingue a carta.
- O relatório da run mostra o ouro obtido e os monstros eliminados.

## Loja

- A loja pode ser aberta a qualquer momento, inclusive no meio do planejamento da trilha.
- Ao voltar da loja, o caminho da dungeon continua de onde parou.
- Os preços da loja são próprios deste jogo e não vêm do DungeonBend.

## Trilha salva

- O card da dungeon oferece a opção de descartar a trilha salva.
- A confirmação do descarte acontece dentro do próprio card, sem interromper a música do menu.
