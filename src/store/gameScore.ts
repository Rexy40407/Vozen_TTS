import type Database from 'better-sqlite3';

/** Uma linha do leaderboard: quem, quantos pontos, quantas partidas venceu. */
export interface ScoreRow {
  userId: string;
  points: number;
  wins: number;
}

interface GameScoreRow {
  user_id: string;
  points: number;
  wins: number;
}

/**
 * Soma `points` ao total de `userId` nesta guild (UPSERT: cria a linha a 0 se ainda
 * nao existir e incrementa). Os pontos sao SEMPRE somados; `wins` so sobe via
 * addWin (fim de partida). Idempotente por chamada — cada chamada acumula.
 */
export function addPoints(
  db: Database.Database,
  guildId: string,
  userId: string,
  points: number,
): void {
  if (points === 0) return;
  db.prepare(
    `INSERT INTO game_score (guild_id, user_id, points, wins)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(guild_id, user_id)
     DO UPDATE SET points = points + excluded.points`,
  ).run(guildId, userId, points);
}

/**
 * Incrementa em 1 o contador de PARTIDAS vencidas de `userId` (a pessoa que mais
 * pontuou numa partida). UPSERT: cria a linha (points 0, wins 1) se nao existir.
 */
export function addWin(db: Database.Database, guildId: string, userId: string): void {
  db.prepare(
    `INSERT INTO game_score (guild_id, user_id, points, wins)
     VALUES (?, ?, 0, 1)
     ON CONFLICT(guild_id, user_id)
     DO UPDATE SET wins = wins + 1`,
  ).run(guildId, userId);
}

/**
 * Persiste os pontos acumulados de UMA partida de uma so vez (uma transacao): soma
 * os pontos de cada jogador e marca +1 vitoria ao que MAIS pontuou nessa partida
 * (desempate: o primeiro na ordem de insercao do Map, i.e. quem chegou primeiro a
 * esse total). Sem pontos -> no-op. Envolvido numa transacao para nao deixar o
 * leaderboard a meio se algo falhar a meio da escrita.
 */
export function persistGameScores(
  db: Database.Database,
  guildId: string,
  points: Map<string, number>,
): void {
  if (points.size === 0) return;
  let topUser: string | null = null;
  let topPoints = 0;
  for (const [userId, p] of points) {
    if (p > topPoints) {
      topPoints = p;
      topUser = userId;
    }
  }
  const tx = db.transaction(() => {
    for (const [userId, p] of points) addPoints(db, guildId, userId, p);
    // So conta como "vitoria" se alguem efetivamente pontuou (topPoints > 0).
    if (topUser && topPoints > 0) addWin(db, guildId, topUser);
  });
  tx();
}

/**
 * Top `limit` jogadores desta guild, ordenados por pontos (desc) e depois por
 * vitorias (desc). Devolve [] se ninguem jogou ainda.
 */
export function getLeaderboard(db: Database.Database, guildId: string, limit = 10): ScoreRow[] {
  const rows = db
    .prepare(
      `SELECT user_id, points, wins FROM game_score
       WHERE guild_id = ?
       ORDER BY points DESC, wins DESC
       LIMIT ?`,
    )
    .all(guildId, limit) as GameScoreRow[];
  return rows.map((r) => ({ userId: r.user_id, points: r.points, wins: r.wins }));
}

/** Pontuacao de um utilizador (0/0 se nunca jogou). */
export function getUserScore(db: Database.Database, guildId: string, userId: string): ScoreRow {
  const row = db
    .prepare('SELECT user_id, points, wins FROM game_score WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId) as GameScoreRow | undefined;
  if (!row) return { userId, points: 0, wins: 0 };
  return { userId: row.user_id, points: row.points, wins: row.wins };
}

/**
 * Posicao de `userId` no ranking da guild (1 = topo) e o total de jogadores. `rank`
 * e null se a pessoa ainda nao pontuou (nao esta no ranking). O rank e o nº de
 * jogadores com MAIS pontos + 1 (empates partilham a mesma posicao base).
 */
export function getUserRank(
  db: Database.Database,
  guildId: string,
  userId: string,
): { rank: number | null; total: number } {
  const total = (
    db.prepare('SELECT COUNT(*) AS n FROM game_score WHERE guild_id = ?').get(guildId) as {
      n: number;
    }
  ).n;
  const me = db
    .prepare('SELECT points FROM game_score WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId) as { points: number } | undefined;
  if (!me) return { rank: null, total };
  const ahead = (
    db
      .prepare('SELECT COUNT(*) AS n FROM game_score WHERE guild_id = ? AND points > ?')
      .get(guildId, me.points) as { n: number }
  ).n;
  return { rank: ahead + 1, total };
}
