import { describe, it, expect, vi, afterEach } from 'vitest';
import { AloneWatcher, ALONE_LEAVE_MS } from '../src/voice/aloneWatcher';

const G = 'guild-1';
const MS = 1000;

// Helper: watcher with a MUTABLE human count and a spied `leave`. Uses the global
// timers (faked via vi.useFakeTimers), as in production.
function makeWatcher() {
  const leave = vi.fn();
  const state = { humans: 0 as number | null };
  const watcher = new AloneWatcher({
    leaveMs: MS,
    humansInBotChannel: () => state.humans,
    leave,
  });
  return { watcher, leave, state };
}

describe('AloneWatcher — leaves only when alone for leaveMs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('default is 0 (IMMEDIATE leave when it becomes alone)', () => {
    expect(ALONE_LEAVE_MS).toBe(0);
  });

  it('leaveMs<=0 (default) -> leaves NOW, synchronously, without arming a timer', () => {
    const leave = vi.fn();
    const state = { humans: 0 as number | null };
    // Without leaveMs -> uses the default (ALONE_LEAVE_MS = 0 = immediate).
    const watcher = new AloneWatcher({ humansInBotChannel: () => state.humans, leave });
    watcher.evaluate(G);
    // Left immediately (no pending timer and leave was already called).
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(G);
    expect(watcher.pendingCount()).toBe(0);
  });

  it('with humans present it NEVER leaves (stays forever, no inactivity)', () => {
    const leave = vi.fn();
    const state = { humans: 3 as number | null };
    const watcher = new AloneWatcher({ humansInBotChannel: () => state.humans, leave });
    // Several re-evaluations (mutes/deafens/etc.) with people in the call -> never leaves.
    watcher.evaluate(G);
    watcher.evaluate(G);
    watcher.evaluate(G);
    expect(leave).not.toHaveBeenCalled();
    expect(watcher.pendingCount()).toBe(0);
  });

  it('alone (0 humans) -> after leaveMs it leaves (leave 1x)', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G);
    expect(watcher.pendingCount()).toBe(1);
    expect(leave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MS * 2);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(G);
    expect(watcher.pendingCount()).toBe(0);
  });

  it('someone joins BEFORE the timer -> evaluate cancels, does not leave', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G); // arms
    state.humans = 1;
    watcher.evaluate(G); // someone joins -> cancels
    expect(watcher.pendingCount()).toBe(0);
    vi.advanceTimersByTime(MS * 3);
    expect(leave).not.toHaveBeenCalled();
  });

  it('RE-CHECKS on fire: if someone joined at the last instant, does NOT leave', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G); // arms with 0
    // Someone joins but the VoiceStateUpdate has not run yet (evaluate not called).
    state.humans = 1;
    vi.advanceTimersByTime(MS * 2); // fires -> re-check sees 1 -> does not leave
    expect(leave).not.toHaveBeenCalled();
  });

  it('bot is no longer in voice (null) -> cancels the timer', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G);
    state.humans = null;
    watcher.evaluate(G);
    expect(watcher.pendingCount()).toBe(0);
    vi.advanceTimersByTime(MS * 2);
    expect(leave).not.toHaveBeenCalled();
  });

  it('re-evaluating while already counting does NOT extend the window (no re-arm)', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G); // arms at t=0
    vi.advanceTimersByTime(MS * 0.6);
    watcher.evaluate(G); // still alone -> does NOT re-arm
    expect(watcher.pendingCount()).toBe(1);
    vi.advanceTimersByTime(MS * 0.5); // total 1.1*MS -> past the original MS
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('clear() cancels — the removePlayer funnel ensures the timer does not survive', () => {
    vi.useFakeTimers();
    const { watcher, leave, state } = makeWatcher();
    state.humans = 0;
    watcher.evaluate(G);
    watcher.clear(G); // as removePlayer does
    expect(watcher.pendingCount()).toBe(0);
    vi.advanceTimersByTime(MS * 2);
    expect(leave).not.toHaveBeenCalled();
  });
});

describe('AloneWatcher — 24/7 in-call (Premium stays in the call even when alone)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Premium + alone (immediate leave) -> does NOT leave, no timer', () => {
    const leave = vi.fn();
    const state = { humans: 0 as number | null };
    // Without leaveMs -> immediate default; but stayInCall=true blocks the leave.
    const watcher = new AloneWatcher({
      humansInBotChannel: () => state.humans,
      leave,
      stayInCall: () => true,
    });
    watcher.evaluate(G);
    expect(leave).not.toHaveBeenCalled();
    expect(watcher.pendingCount()).toBe(0);
  });

  it('Premium + alone (with a leaveMs window) -> never arms a timer nor leaves', () => {
    vi.useFakeTimers();
    const leave = vi.fn();
    const state = { humans: 0 as number | null };
    const watcher = new AloneWatcher({
      leaveMs: MS,
      humansInBotChannel: () => state.humans,
      leave,
      stayInCall: () => true,
    });
    watcher.evaluate(G);
    expect(watcher.pendingCount()).toBe(0);
    vi.advanceTimersByTime(MS * 5);
    expect(leave).not.toHaveBeenCalled();
  });

  it('losing Premium with a pending timer -> the next Premium re-evaluation cancels it', () => {
    vi.useFakeTimers();
    const leave = vi.fn();
    const state = { humans: 0 as number | null, premium: false };
    const watcher = new AloneWatcher({
      leaveMs: MS,
      humansInBotChannel: () => state.humans,
      leave,
      stayInCall: () => state.premium,
    });
    watcher.evaluate(G); // Free + alone -> arms timer
    expect(watcher.pendingCount()).toBe(1);
    state.premium = true; // bought Premium in the meantime
    watcher.evaluate(G); // Premium -> cancels the pending timer
    expect(watcher.pendingCount()).toBe(0);
    vi.advanceTimersByTime(MS * 5);
    expect(leave).not.toHaveBeenCalled();
  });

  it('without stayInCall (default) -> Free behavior unchanged (leaves now)', () => {
    const leave = vi.fn();
    const state = { humans: 0 as number | null };
    const watcher = new AloneWatcher({ humansInBotChannel: () => state.humans, leave });
    watcher.evaluate(G);
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
