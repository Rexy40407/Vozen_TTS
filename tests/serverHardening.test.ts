import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { hardenServerTimeouts, SERVER_TIMEOUTS } from '../src/http/serverHardening';

describe('hardenServerTimeouts — defensive timeouts on the internal HTTP servers', () => {
  let server: Server | undefined;
  afterEach(() => {
    server?.close();
    server = undefined;
  });

  it('applies short keepAliveTimeout / headersTimeout / requestTimeout (anti-slowloris)', () => {
    server = createServer();
    hardenServerTimeouts(server);
    expect(server.keepAliveTimeout).toBe(SERVER_TIMEOUTS.keepAlive);
    expect(server.headersTimeout).toBe(SERVER_TIMEOUTS.headers);
    expect(server.requestTimeout).toBe(SERVER_TIMEOUTS.request);
  });

  it('the values are short compared to Node defaults (real mitigation)', () => {
    // Node defaults: requestTimeout 300000, headersTimeout 60000. Ours are smaller.
    expect(SERVER_TIMEOUTS.request).toBeLessThan(300000);
    expect(SERVER_TIMEOUTS.headers).toBeLessThan(60000);
    // headersTimeout <= requestTimeout (otherwise the request never reaches the headers limit).
    expect(SERVER_TIMEOUTS.headers).toBeLessThanOrEqual(SERVER_TIMEOUTS.request);
  });
});
