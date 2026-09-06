# Dependency audit — 2026-09-06

## Applied

Updated `stable-vec` 0.4.2 → 0.4.3 in Cargo.lock to fix
RUSTSEC-2026-0267 (panic-safety double-free/use-after-free). It is included by
Songbird → stream_lib → hls_m3u8 in the Linux voice-driver feature tree.
No public commands, voice settings or crypto algorithms were changed.

## Remaining upstream findings (not suppressed)

`cargo audit` against RustSec revision
`5a0ebedfe8bdd2e295b171f4162f8c977bcad9a5` still reports six advisories:

| Package | Advisories | Linux voice-driver dependency tree |
| --- | --- | --- |
| libcrux-aesgcm 0.0.7 | RUSTSEC-2026-0209, RUSTSEC-2026-0211 | Not selected; optional lockfile dependency |
| libcrux-chacha20poly1305 0.0.7 | RUSTSEC-2026-0124 | Not selected; optional lockfile dependency |
| libcrux-secrets 0.0.5 | RUSTSEC-2026-0212 | Selected through libcrux-sha3; advisory concerns Aarch64, production is x86_64 |
| libcrux-sha3 0.0.8 | RUSTSEC-2026-0207, RUSTSEC-2026-0208 | Selected through hpke-rs 0.6.1 |

The selected chain is Songbird 0.6.0 → davey 0.1.4 → openmls_rust_crypto
0.5.1 → hpke-rs 0.6.1. All are the newest compatible versions resolved at
audit time. hpke-rs 0.7.0 and openmls_rust_crypto 0.6.0 are outside their
parents' dependency constraints; replacing cryptographic dependencies with
an unreviewed fork is not part of this patch.

Source inspection: davey 0.1.4 accepts DAVE protocol 1 using
MLS_128_DHKEMP256_AES128GCM_SHA256_P256 only. hpke-rs 0.6.1 uses libcrux SHAKE
in its XWing/ML-KEM derivation paths, while DHKEM P256 follows `dh_kem`.
This limits the apparent reachability of the SHA3 findings in the current
voice flow, but is not proof that the dependency is free of vulnerabilities.

Informational unsoundness/unmaintained warnings also remain for `failure`
0.1.8 and build-time `rand` 0.7.3, both brought in by `chess` 3.2.0.

## Follow-up

Re-audit when the DAVE/OpenMLS chain or chess dependency gains compatible
releases. Test the Linux voice-driver build and real Discord playback before
deploying a cryptographic dependency migration. Do not silence the advisories
or represent the current full lockfile audit as passing.

Commands used:

```sh
cargo audit --json
cargo tree --features vozen-runtime/voice-driver --target x86_64-unknown-linux-gnu
cargo update -p hpke-rs --dry-run
cargo update -p openmls_rust_crypto --dry-run
cargo update -p davey --dry-run
```
