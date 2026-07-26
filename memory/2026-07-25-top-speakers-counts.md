# Top speakers count discrepancy — 2026-07-25

## Observation

The screenshot shows two responses in the same channel: the old `Vozen` TypeScript app and `Vozen Staging` Rust app. Their totals differ.

## Findings

- Rust staging uses its own named Compose project/data volume and therefore has its own `tts.db` state; it does not query the TypeScript process' live database.
- Both implementations count only messages whose speech request was accepted by the playback queue.
- Both intentionally apply the same anti-inflation policy: one countable message per author every 1 second, duplicate suppression, and at most 10 counted messages per author per minute.
- Rust's `MessageVoiceService` applies `CountGate` after queue acceptance, then updates `talk_stats`; the Rust tests cover this ordering and parity.

## Conclusion

The screenshot alone is consistent with two independent counters, not evidence that Rust dropped a specific row. To compare parity, send fresh, distinct messages through one bot with at least one second between them, then run `/top-speakers` on that same bot. Importing or sharing the production/Node database is out of scope for staging and would invalidate the isolation test.

## Status

No code change made; awaiting a controlled same-instance reproduction if counts still disagree.
