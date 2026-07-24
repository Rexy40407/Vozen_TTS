# Rust migration benchmark protocol

This protocol measures Node and Rust in separate staging runs. It does not claim that Rust is
faster until both runs use the same host, model files, database snapshot and Discord workload.
Never run the two runtimes with the same Discord token at the same time.

## Isolation

- Use the staging application and disposable guild from `RUST-MIGRATION-STAGING.md`.
- Restore two equivalent SQLite copies from the same verified backup; do not benchmark against the
  production database.
- Keep the Piper binary, model directory, environment limits and host resources identical.
- Warm each runtime for five minutes before collecting the measurement window.

## Fixed workload

Run the same sequence for Node and Rust, three times each:

1. Start the process and record time until Discord `READY`.
2. Join a test voice channel and send 100 short TTS messages from two users.
3. Exercise `/tts`, `/skip`, `/queue`, `/voice list`, `/config show` and one promoted game read.
4. Send 20 messages through the configured auto-read channel and one message from outside the
   voice call; confirm the latter is not spoken.
5. Disconnect/reconnect the test voice session once and record reconnect time and queue errors.
6. Stop the process gracefully and record shutdown time and SQLite integrity status.

Do not include network/provider experiments in the comparison. Keep `TTS_ENGINE=piper` and the
same model catalogue so the result measures the runtime rather than a different provider.

## Resource sampling

While each process runs, collect a process-only sample. The sampler does not read command lines or
environment variables, so tokens and provider keys are not written to the report:

```powershell
pwsh -File tools/benchmark-process.ps1 `
  -ProcessId $nodePid `
  -DurationSeconds 600 `
  -OutputPath .staging/node-process.json

pwsh -File tools/benchmark-process.ps1 `
  -ProcessId $rustPid `
  -DurationSeconds 600 `
  -OutputPath .staging/rust-process.json
```

Record Discord-side observations separately: TTS p50/p95 latency, synthesis failures, queue
depth, voice reconnects and gateway errors. Compare the medians of the three runs, not a single
best run. A result is **not measured** when any workload step is skipped or the process restarts.

## Acceptance and rollback

The benchmark is evidence for capacity planning, not permission to deploy. Before cutover, require
the Rust run to preserve the Node behaviour matrix, keep SQLite integrity `ok`, and show no new
critical errors. If latency, memory, queue stability or voice reconnects regress materially, keep
Node authoritative and use the rollback path in `RUST-MIGRATION-STAGING.md`.
