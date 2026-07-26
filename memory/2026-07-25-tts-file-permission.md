# Debug report — `/tts-file` permission failure

- Symptom: staging replied that it could not create the audio file.
- Root cause: `RUST_TTS_FILE_CACHE_DIR` was unset in the Rust Docker override. The runtime used
  `./audio-cache/rust-file` under `/app`, which is owned by `root` and is not writable by the
  `vozen` user. The normal voice path worked because its cache already pointed to `/data`.
- Evidence: staging logs reported `TTS I/O failed: Permission denied (os error 13)`; an isolated
  container check showed `/app` read-only and `/data` writable for `uid=1000(vozen)`.
- Fix: Docker Rust override now sets `RUST_TTS_FILE_CACHE_DIR=/data/audio-cache/rust-file`;
  `tests/dockerAssets.test.ts` asserts the writable cache contract.
- Verification: targeted Docker test passed (4/4), staging restarted with the new variable,
  health is `healthy`, and the cache directory is writable inside the container.
- Status: DONE pending one fresh Discord `/tts-file` reproduction.
