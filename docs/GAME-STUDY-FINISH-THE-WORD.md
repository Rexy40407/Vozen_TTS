# Estudo — "Finish The Word!" (Roblox) → candidato a minijogo do Vozen

> **Objetivo:** perceber TODAS as regras e mecânicas do jogo para implementar a *ideia*
> (cadeia de palavras) no Vozen. Não interessa a programação Roblox — só o design.
> Estudo feito a 2026-07-07. Jogo: [Finish The Word! [NEW PETS]](https://www.roblox.com/games/91704854174760/Finish-The-Word)
> do estúdio Table Game X.

## 0. Fontes e grau de confiança

O jogo é recente e **não tem wiki** — os números finos (segundos exatos, lista de pets)
não estão documentados publicamente. Por isso este estudo separa:

- ✅ **CONFIRMADO** — descrição oficial do jogo + artigo de comparação (earnaldo.com).
- 🔶 **INFERIDO** — convenções do género, reconstruídas de dois parentes diretos e bem
  documentados: **Shiritori** (o jogo clássico japonês que isto digitaliza) e
  **Word Bomb** (o gigante dos word games no Roblox, cuja fórmula de timer/vidas
  este jogo claramente segue). Onde é inferido, proponho defaults concretos para o Vozen.

Fontes: [página do jogo](https://www.roblox.com/games/91704854174760/Finish-The-Word) ·
[comparação earnaldo](https://earnaldo.com/blog/guess-my-game-vs-finish-the-word) ·
[Shiritori (Wikipedia)](https://en.wikipedia.org/wiki/Shiritori) ·
[Word Bomb (wiki/guias)](https://roblox.fandom.com/wiki/OMG/Word_Bomb)

---

## 1. Conceito numa frase ✅

**Cadeia de palavras por turnos com relógio:** cada jogador diz uma palavra que começa
na **última letra** da palavra anterior (`Poodle → Elephant → Turtle`); quem falha o
tempo ou as regras é **eliminado**; o último vivo ganha. Quanto mais dura o jogo,
mais difícil fica.

## 2. Regras confirmadas (da descrição oficial) ✅

1. **Encadeamento**: a palavra nova tem de começar na última letra da anterior.
2. **Uma palavra por turno** ("one word at a time").
3. **Proibido repetir palavras** já usadas na partida.
4. **Pressão de tempo**: "think fast or get knocked out" — há um timer por turno;
   falhar = eliminação (knock-out).
5. **Dificuldade progressiva**: "the longer the game goes, the harder it gets".
6. **Pets** dão **habilidades especiais** (power-ups equipáveis).
7. **Vence o último/a mais afiado** ("may the sharpest brain win") — formato battle-royale
   de palavras, não corrida de pontos.
8. É uma **"shared word race"** (artigo earnaldo): todos os jogadores partilham a MESMA
   cadeia, por turnos — não são cadeias paralelas.
9. Recompensas meta: **wins e cosméticos** (earnaldo) — o resultado alimenta um perfil
   persistente, não afeta o gameplay da ronda.

## 3. Loop de jogo detalhado (reconstruído) 🔶

O fluxo standard do género (Word Bomb/shiritori digital), que a descrição encaixa:

```
LOBBY (min. 2 jogadores)
  └─ arranque: ordem de turnos fixa (círculo), palavra-semente dada pelo jogo
RONDA (turno do jogador N)
  ├─ o jogo mostra a letra obrigatória (última da palavra anterior)
  ├─ timer do turno arranca (ver §4)
  ├─ jogador escreve UMA palavra
  │    ├─ válida (dicionário + começa na letra + não repetida + tamanho mínimo)
  │    │    → aceite: a cadeia avança, passa ao próximo jogador vivo
  │    └─ inválida → feedback imediato; PODE tentar outra vez DENTRO do mesmo timer
  │         (convenção Word Bomb: submissões erradas não queimam o turno, só tempo)
  └─ timer esgota sem palavra válida → jogador ELIMINADO (ou perde vida, ver §5)
FIM: resta 1 jogador → vitória, recompensas, nova ronda no lobby
```

Pontos-chave do design que fazem o jogo funcionar:

- **A cadeia é partilhada**: a jogada de cada um cria o problema do seguinte. Isto gera
  a estratégia central do género — **atacar com letras difíceis** (terminar a palavra
  em letra rara para lixar o próximo).
- **Tentativas ilimitadas dentro do timer**: errar não elimina; só o relógio elimina.
  Mantém o ritmo frenético sem frustração de "morri por um typo".
- **Feedback instantâneo** por submissão: válida/já usada/não começa na letra/não existe.

## 4. Dificuldade progressiva ("the harder it gets") 🔶

A descrição confirma que existe; o género implementa com 2-3 alavancas combinadas:

| Alavanca | Como escala | Referência do género |
|---|---|---|
| **Timer por turno** | encurta a cada volta completa (ex.: 15s → 12s → 10s → 8s → 6s, floor 5s) | Word Bomb: "the bomb ticks faster the longer a round goes" |
| **Tamanho mínimo da palavra** | sobe com as rondas (ex.: 3+ letras → 4+ → 5+) | variação clássica do shiritori ("length minimums") |
| **Sem-repetição acumulada** | a lista de palavras proibidas cresce sozinha — dificuldade emergente e grátis | shiritori base |

O efeito combinado: no início qualquer um joga ("gato → orca"); ao fim de 20 palavras
o jogador tem 6 segundos para achar uma palavra de 5+ letras, começada em "R", que
ninguém disse — é aí que o "sharpest brain" ganha.

## 5. Eliminação e vitória 🔶 (formato) / ✅ (existência)

- **Knock-out confirmado** na descrição. O género usa 2 variantes:
  - **Morte súbita**: falhou o timer → fora. (Mais provável no Finish The Word, dado
    o tom "think fast or get knocked out".)
  - **Vidas** (Word Bomb usa 2): falhar tira 1 vida; a 0 estás fora. Mais amigável
    para lobbies grandes.
- **Vitória**: último jogador vivo. Sem sistema de pontos durante a ronda — o
  ranking/meta vive fora (wins acumuladas, leaderboard, cosméticos).
- **Edge**: se TODOS os restantes falharem na mesma volta, o género declara empate ou
  dá a vitória a quem sobreviveu mais voltas.

## 6. Pets / habilidades ✅ (existência) 🔶 (conteúdo)

Confirmado que pets dão "special abilities"; a lista exata não está documentada.
Os power-ups típicos deste género (para inspiração, não é lista oficial):

- **+tempo** no teu turno (o clássico nº 1);
- **skip** — passar o turno uma vez sem morrer;
- **dica** — revela uma palavra possível;
- **escudo** — sobreviver a um falhanço;
- **bomba** — encurtar o timer do adversário seguinte.

Nota de design: no Roblox os pets são a camada de **monetização/retenção** (colecionáveis,
raridades, "NEW PETS" no título = evento de conteúdo). A mecânica de jogo funciona 100%
sem eles.

## 7. Validação de palavras 🔶

O que o jogo TEM de resolver (e como o género o faz):

1. **Dicionário**: palavra tem de existir (Word Bomb usa um dicionário EN fixo).
2. **Classe de palavras**: shiritori clássico só aceita substantivos; os jogos digitais
   ocidentais aceitam qualquer palavra do dicionário (mais simples e menos disputas).
3. **Normalização**: case-insensitive; **acentos** — crítico em PT (ex.: "avó" termina
   em "ó" — conta como "o"? Decisão: normalizar diacríticos, "ó"→"o").
4. **Sem nomes próprios** (convenção do género; evita "Zé → Eva → André" infinito).
5. **Última letra problemática**: em PT quase nenhuma palavra começa por "ç"; se uma
   palavra termina em letra impossível, o jogo deve (a) proibir palavras terminadas
   nessa letra, ou (b) cair na penúltima letra. (No shiritori, terminar em ん = derrota
   imediata — a "letra assassina" é uma REGRA, não um bug. Opção de design interessante.)
6. **Tamanho mínimo**: ≥2-3 letras desde o início (mata "é", "o", "a").

## 8. Meta-jogo e retenção ✅

- **Wins** acumuladas por perfil + **cosméticos/pets** compráveis ou ganhos.
- Sessões curtas (rondas de 2-5 min) — encaixa em "party game" de picar.
- Social loop: o jogo vive de lobbies cheios; a eliminação transforma perdedores
  em espetadores que ficam a ver o final (tensão de bancada).

---

## 9. Tradução para o Vozen (nota rápida — o estudo pedido acaba aqui)

O Vozen tem uma vantagem que o Roblox não tem: **a voz**. A adaptação natural:

- **Turnos no canal de texto** (como a Contagem Sabotada/framework atual): o Vozen
  anuncia EM VOZ ALTA a palavra de cada jogador + a letra seguinte ("Elefante! …T!").
- Timer por turno com contagem falada nos últimos 3s (tensão auditiva).
- Eliminação anunciada com voz + emoji; vencedor anunciado como nos outros 14 jogos.
- Dicionário: PT/EN à escolha no arranque (o Vozen já tem infraestrutura de 35 línguas —
  começar por PT + EN com listas de palavras; validação via dicionário local).
- Encaixa DIRETO no framework existente: `GameDefinition` + lock por-guild + leaderboard
  (`game_score`) + timers injetáveis. Seria o 15º jogo, id `word-chain`/`finish-the-word`.
- Pets → fora do MVP; o equivalente Vozen seriam power-ups Premium (fase 2, se fizer sentido).

**Decisões em aberto para a implementação** (a discutir antes do blueprint):
1. Morte súbita ou 2 vidas?
2. Só substantivos ou qualquer palavra?
3. Acentos: normalizar (recomendado) ou estrito?
4. Timer inicial/floor (proposta: 15s → -1s por volta, floor 6s)?
5. Multiplayer por turnos no texto, ou versão "corrida" (1º a responder ganha o turno)
   como os jogos de voz atuais?

---

## 11. Estado: IMPLEMENTADO ✅ (15.º jogo, id `word-chain`)

Decisões finais tomadas com o Diogo e implementadas:

| Decisão | Escolha |
|---|---|
| Formato | **Por turnos** em ordem fixa (não corrida) |
| Vidas | **2** (falhar o tempo tira 1; a 0 sai) |
| Palavras | **Qualquer** palavra do dicionário |
| Acentos | **Normalizados** (fold de diacríticos → a-z) |
| Línguas | **UMA por partida**, escolhida no `/game play language:…` (motor de voz = Google default) |
| Voz | boas-vindas faladas na língua + **cada palavra aceite lida em voz alta** na voz nativa + letra seguinte |
| Timer | 15s, −0.4s por palavra aceite, piso 6s; mínimo 3→4→5 letras às 8/16 palavras |

Línguas na v1: **PT, EN, ES, FR** (mecânica pronta para as ~24 latinas; o modo
multilíngue-em-união fica como variante futura — ver §10, se existir).

Ficheiros: `src/games/wordchain/core.ts` (motor puro), `dict.ts` (loader),
`src/games/wordChain.ts` (jogo), `assets/wordlists/{lang}.txt` (dados,
`tools/build-wordlists.mjs`), i18n `game.wordChain.*`. Testes: `tests/wordchainCore.test.ts`,
`tests/wordChain.test.ts`.
