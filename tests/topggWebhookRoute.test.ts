import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type Database from 'better-sqlite3';
import { initDb } from '../src/store/db';
import { isUserPremium } from '../src/store/premium';
import { startKofiWebhook } from '../src/premium/kofiWebhook';
import { claimVoteReward } from '../src/store/voteReward';

// The vote reward now travels on the SAME HTTP server as Ko-fi/the panel (which is already
// public via Caddy at api.vozen.org), on the POST /webhook/topgg route — to avoid requiring
// a dedicated port + a new Caddy route. These tests exercise that route end-to-end.
const SECRET = 'topgg-s3cr3t';
const REDEMPTION_SECRET = 'vote-redemption-test-secret-32-chars-minimum';
const BOT_ID = '123456789012345678';
const USER_ID = '987654321098765432';
const UPVOTE = JSON.stringify({ bot: BOT_ID, user: USER_ID, type: 'upvote' });
const V1_UPVOTE = JSON.stringify({
  type: 'vote.create',
  data: {
    id: 'vote-1',
    project: { platform_id: BOT_ID },
    user: { platform_id: USER_ID },
  },
});

function urlOf(s: Server, path: string): string {
  const addr = s.address();
  if (!addr || typeof addr === 'string') throw new Error('porta efémera indisponível');
  return `http://127.0.0.1:${addr.port}${path}`;
}

describe('top.gg webhook on the public API (POST /webhook/topgg route)', () => {
  let db: Database.Database;
  let server: Server | null = null;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    db.close();
  });

  async function start(opts: {
    secret?: string;
    onUpvote?: (id: string) => void;
  }): Promise<Server> {
    server = startKofiWebhook({
      db,
      token: 'tok', // Ko-fi wired in parallel — the top.gg route must not be swallowed by it
      clientId: BOT_ID,
      port: 0,
      now: () => 1_000_000,
      logInfo: () => {},
      logError: () => {},
      topggWebhookSecret: opts.secret,
      onUpvote: opts.onUpvote,
    });
    if (!server) throw new Error('servidor não arrancou');
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    return server;
  }

  async function post(s: Server, body: string, auth?: string, signature?: string): Promise<number> {
    const res = await fetch(urlOf(s, '/webhook/topgg'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { Authorization: auth } : {}),
        ...(signature ? { 'x-topgg-signature': signature } : {}),
      },
      body,
    });
    return res.status;
  }

  it('upvote with the right secret -> 200 and calls onUpvote with the voter id', async () => {
    const rewarded: string[] = [];
    const s = await start({ secret: SECRET, onUpvote: (id) => rewarded.push(id) });
    expect(await post(s, UPVOTE, SECRET)).toBe(200);
    expect(rewarded).toEqual([USER_ID]);
  });

  it('v1 signed vote.create -> 200 and calls onUpvote with the Discord platform id', async () => {
    const rewarded: string[] = [];
    const s = await start({ secret: SECRET, onUpvote: (id) => rewarded.push(id) });
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', SECRET).update(`${timestamp}.${V1_UPVOTE}`).digest('hex');
    expect(await post(s, V1_UPVOTE, undefined, `t=${timestamp},v1=${digest}`)).toBe(200);
    expect(rewarded).toEqual([USER_ID]);
  });

  it('wrong secret -> 401 and does NOT call onUpvote', async () => {
    const rewarded: string[] = [];
    const s = await start({ secret: SECRET, onUpvote: (id) => rewarded.push(id) });
    expect(await post(s, UPVOTE, 'errado')).toBe(401);
    expect(rewarded).toEqual([]);
  });

  it('real wiring: claimVoteReward grants the one-time 48h Plus reward', async () => {
    const s = await start({
      secret: SECRET,
      onUpvote: (id) => {
        claimVoteReward(db, id, 1_000_000, REDEMPTION_SECRET);
      },
    });
    expect(await post(s, UPVOTE, SECRET)).toBe(200);
    expect(isUserPremium(db, USER_ID, 1_000_000 + 1000)).toBe(true);
  });

  it('without topggWebhookSecret configured -> the route is NOT a vote endpoint (no reward)', async () => {
    const rewarded: string[] = [];
    const s = await start({ onUpvote: (id) => rewarded.push(id) }); // no secret
    await post(s, UPVOTE, SECRET); // status is irrelevant; what matters is not rewarding
    expect(rewarded).toEqual([]);
  });
});
