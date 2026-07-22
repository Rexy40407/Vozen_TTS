import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import {
  addPoints,
  addWin,
  persistGameScores,
  getLeaderboard,
  getUserScore,
  getUserRank,
} from '../src/store/gameScore';

const G = 'guild-1';

describe('gameScore store — leaderboard dos minijogos', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('utilizador sem jogos -> 0 pontos / 0 vitorias', () => {
    expect(getUserScore(db, G, 'ninguem')).toEqual({ userId: 'ninguem', points: 0, wins: 0 });
    expect(getLeaderboard(db, G)).toEqual([]);
  });

  it('addPoints acumula; addWin conta vitorias (UPSERT)', () => {
    addPoints(db, G, 'a', 3);
    addPoints(db, G, 'a', 2);
    addWin(db, G, 'a');
    expect(getUserScore(db, G, 'a')).toEqual({ userId: 'a', points: 5, wins: 1 });
  });

  it('addPoints(0) e no-op (nao cria linha)', () => {
    addPoints(db, G, 'z', 0);
    expect(getUserScore(db, G, 'z')).toEqual({ userId: 'z', points: 0, wins: 0 });
  });

  it('persistGameScores soma os pontos da partida e da a vitoria a quem mais pontuou', () => {
    const points = new Map<string, number>([
      ['a', 2],
      ['b', 3],
      ['c', 1],
    ]);
    persistGameScores(db, G, points);
    expect(getUserScore(db, G, 'a')).toEqual({ userId: 'a', points: 2, wins: 0 });
    expect(getUserScore(db, G, 'b')).toEqual({ userId: 'b', points: 3, wins: 1 }); // top -> +1 win
    expect(getUserScore(db, G, 'c')).toEqual({ userId: 'c', points: 1, wins: 0 });
  });

  it('persistGameScores com Map vazio e no-op', () => {
    persistGameScores(db, G, new Map());
    expect(getLeaderboard(db, G)).toEqual([]);
  });

  it('leaderboard ordenado por pontos desc, depois vitorias desc, limitado', () => {
    persistGameScores(db, G, new Map([['a', 5]])); // a: 5pts, 1win
    persistGameScores(db, G, new Map([['b', 10]])); // b: 10pts, 1win
    persistGameScores(db, G, new Map([['c', 5]])); // c: 5pts, 1win
    const top = getLeaderboard(db, G, 2);
    expect(top.length).toBe(2);
    expect(top[0].userId).toBe('b'); // 10 pts
    expect(top[0].points).toBe(10);
    // a e c empatados a 5; a ordem entre eles e estavel por pontos/vitorias iguais.
    expect(top[1].points).toBe(5);
  });

  it('pontuacoes sao por-guild (isolamento)', () => {
    addPoints(db, G, 'a', 4);
    addPoints(db, 'guild-2', 'a', 9);
    expect(getUserScore(db, G, 'a').points).toBe(4);
    expect(getUserScore(db, 'guild-2', 'a').points).toBe(9);
  });

  it('getUserRank: posicao 1=topo, total de jogadores, null se nunca jogou', () => {
    addPoints(db, G, 'a', 10);
    addPoints(db, G, 'b', 5);
    addPoints(db, G, 'c', 5);
    expect(getUserRank(db, G, 'a')).toEqual({ rank: 1, total: 3 });
    // b e c empatados a 5: ambos a seguir ao 'a' (1 jogador a frente -> rank 2).
    expect(getUserRank(db, G, 'b')).toEqual({ rank: 2, total: 3 });
    expect(getUserRank(db, G, 'c')).toEqual({ rank: 2, total: 3 });
    // Quem nunca jogou: rank null, mas o total reflete os que jogaram.
    expect(getUserRank(db, G, 'ninguem')).toEqual({ rank: null, total: 3 });
  });
});
