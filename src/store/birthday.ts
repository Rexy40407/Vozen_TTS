import type Database from 'better-sqlite3';

// Per-(guild,user) birthday: month + day (NO year — only the day of the year matters). When
// the person JOINS Vozen's call on their birthday, Vozen says "Happy birthday {name}" instead
// of the normal greeting (reuses greetOnJoin — no scheduler). Absent => no birthday wish.

export interface Birthday {
  month: number; // 1-12
  day: number; // 1-31 (validated against the month)
}

/** Maximum days per month (1-based). February = 29 to allow birthdays on 29/02. */
const MAX_DAY = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Is the date (month/day) valid as a birthday? Ignores the year (29/02 is accepted). PURE. */
export function isValidBirthday(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= MAX_DAY[month];
}

/** Is today (month/day of `now`) the birthday `bd`? PURE — `now` injectable for tests. */
export function isBirthdayToday(bd: Birthday, now: Date): boolean {
  return bd.month === now.getMonth() + 1 && bd.day === now.getDate();
}

export function getBirthday(
  db: Database.Database,
  guildId: string,
  userId: string,
): Birthday | null {
  const row = db
    .prepare('SELECT month, day FROM user_birthday WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId) as { month: number; day: number } | undefined;
  if (!row || !isValidBirthday(row.month, row.day)) return null;
  return { month: row.month, day: row.day };
}

export function setBirthday(
  db: Database.Database,
  guildId: string,
  userId: string,
  month: number,
  day: number,
): void {
  db.prepare(
    `INSERT INTO user_birthday (guild_id, user_id, month, day)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET month = excluded.month, day = excluded.day`,
  ).run(guildId, userId, month, day);
}

export function clearBirthday(db: Database.Database, guildId: string, userId: string): void {
  db.prepare('DELETE FROM user_birthday WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}
