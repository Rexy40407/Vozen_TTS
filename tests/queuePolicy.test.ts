import { describe, expect, it } from 'vitest';
import { resolveQueueLane } from '../src/voice/queuePolicy';

describe('queue role policy', () => {
  it('uses the accessibility lane only for the configured role', () => {
    expect(
      resolveQueueLane({ priorityRoleId: 'priority', blockedRoleId: null }, ['priority']),
    ).toEqual({
      allowed: true,
      lane: 'accessibility',
    });
  });

  it('blocked always wins even if the member also has the priority role', () => {
    expect(
      resolveQueueLane({ priorityRoleId: 'priority', blockedRoleId: 'blocked' }, [
        'priority',
        'blocked',
      ]),
    ).toEqual({ allowed: false, lane: 'standard' });
  });
});
