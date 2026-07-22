# Plan 007: Pin the voice-clone sidecar's Python dependencies in a requirements file

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fb7f916..HEAD -- tools/setup-clone.ps1 tools/requirements-clone.txt`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (script edit only; existing venvs are untouched)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `fb7f916`, 2026-07-07

## Why this matters

`tools/setup-clone.ps1` installs the voice-clone sidecar (Chatterbox) with **unpinned** `pip install` commands: whatever torch/torchaudio/chatterbox-tts/pillow versions PyPI serves that day. A future torch 2.x release that drops cu124 wheels, or a breaking chatterbox-tts minor, silently turns a working setup script into a broken one — and there is no record anywhere of the versions that are known to work. This plan freezes the versions from the known-good venv on the operator's machine (`tools/clone-venv/`, gitignored, verified working) into a committed `tools/requirements-clone.txt`, and makes the script install from it.

## Current state

- `tools/setup-clone.ps1` — the sidecar installer. The unpinned install lines this plan replaces:

  ```powershell
  # tools/setup-clone.ps1:26-29
  # 3) deps (torch CUDA 12.4 para a RTX 4070 + chatterbox + pillow p/ og-image)
  & $py -m pip install --upgrade pip
  & $py -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
  & $py -m pip install chatterbox-tts pillow
  ```

  `$py` is defined at `tools/setup-clone.ps1:7` as `Join-Path $venv "Scripts\python.exe"` and `$venv` at line 6 as `Join-Path $PSScriptRoot "clone-venv"`. The verification block (lines 31-33) imports torch and chatterbox — keep it untouched.

- `tools/requirements-clone.txt` — does not exist (verified).
- `tools/clone-venv/` — the known-good venv, exists on the planning machine, **gitignored** (`.gitignore` has `tools/clone-venv/`). Two facts verified at planning time (2026-07-07):
  1. `tools\clone-venv\Scripts\python.exe -m pip freeze` FAILS with `No module named pip` (this venv has no pip; `Scripts\pip.exe` doesn't exist either). So the freeze must go through `importlib.metadata` instead — see Step 1.
  2. The `importlib.metadata` query returned these exact versions:
     ```
     torch 2.6.0+cu124
     torchaudio 2.6.0+cu124
     chatterbox-tts 0.1.7
     pillow 12.3.0
     ```
- Repo conventions: script comments are in Portuguese — new comments you add to `setup-clone.ps1` must be in Portuguese.

## Commands you will need

| Purpose                | Command                                                                                                                 | Expected on success                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Venv exists?           | `Test-Path tools\clone-venv\Scripts\python.exe`                                                                         | `True`                                 |
| Read versions          | (see Step 1 one-liner)                                                                                                  | 4 lines `name version`                 |
| List all venv packages | (see Step 1 one-liner)                                                                                                  | package list printed                   |
| Unpinned-install grep  | `git grep -nE "pip install (torch                                                                                       | chatterbox)" -- tools/setup-clone.ps1` | no matches (after Step 3) |
| PS syntax check        | `powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw tools/setup-clone.ps1)) > $null; 'syntax ok'"` | prints `syntax ok`                     |

(This plan runs on the operator's Windows machine; the venv only exists there.)

## Scope

**In scope** (the only files you should create/modify):

- `tools/requirements-clone.txt` (create)
- `tools/setup-clone.ps1` (replace the two unpinned install lines)

**Out of scope** (do NOT touch):

- `tools/clone-venv/` — the live venv. Do NOT reinstall, upgrade, or "fix pip" in it; it is the known-good reference and the bot uses it in production on this machine.
- `tools/clone_server.py` — the sidecar server; unrelated.
- `.gitignore` — `tools/clone-venv/` must stay ignored; `requirements-clone.txt` is NOT ignored by any existing pattern (verified), so no change needed.
- Any Node/npm dependency.

## Git workflow

- Branch: `advisor/007-pin-clone-sidecar-deps`
- Commit style: PT one-liner, e.g. `chore(clone): pins das deps Python do sidecar (requirements-clone.txt)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the exact versions from the known-good venv

First confirm the venv exists:

```powershell
Test-Path tools\clone-venv\Scripts\python.exe
```

→ must print `True`. If `False`: STOP (see STOP conditions).

Do NOT use `pip freeze` — this venv has no pip (verified; see "Current state"). Use `importlib.metadata`. Save this as a temp script (heredoc-style) or run inline:

```powershell
& tools\clone-venv\Scripts\python.exe -c "from importlib.metadata import version`nfor p in ('torch','torchaudio','chatterbox-tts','pillow'): print(p, version(p))"
```

Expected output (matches planning time; if versions differ, use what YOUR run prints — the venv is the source of truth):

```
torch 2.6.0+cu124
torchaudio 2.6.0+cu124
chatterbox-tts 0.1.7
pillow 12.3.0
```

Then check for CUDA companion packages (on Windows, torch cu124 wheels bundle the CUDA DLLs, so none are expected — but verify):

```powershell
& tools\clone-venv\Scripts\python.exe -c "from importlib.metadata import distributions`nfor d in distributions(): print(d.metadata['Name'], d.version)" | Select-String -Pattern "nvidia|triton|cuda"
```

Expected: no output. If any `nvidia-*`/`triton` packages appear, add them to the requirements file in Step 2 with their exact versions.

**Verify**: you have 4 (or more, if companions appeared) `name version` pairs written down.

### Step 2: Create `tools/requirements-clone.txt`

Create the file with the pinned versions from Step 1. With the planning-time versions it is exactly:

```
# Deps do sidecar de clone de voz (Chatterbox) — versões CONGELADAS a partir do
# venv conhecido-bom (tools/clone-venv). torch/torchaudio vêm do índice cu124 da
# PyTorch (passado por --index-url no setup-clone.ps1); o resto vem do PyPI
# (--extra-index-url). Atualizar de propósito, nunca por acidente.
torch==2.6.0+cu124
torchaudio==2.6.0+cu124
chatterbox-tts==0.1.7
pillow==12.3.0
```

Notes:

- The `+cu124` local version suffix is required — those wheels only exist on the `https://download.pytorch.org/whl/cu124` index, which the script passes via `--index-url` (Step 3).
- Keep the header comment in Portuguese (repo convention).

**Verify**: `git grep -cE "^[a-z-]+==" -- tools/requirements-clone.txt` → `4` (or 4 + number of companion packages found in Step 1).

### Step 3: Point `setup-clone.ps1` at the requirements file

In `tools/setup-clone.ps1`, replace lines 28-29 exactly:

```powershell
& $py -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
& $py -m pip install chatterbox-tts pillow
```

with:

```powershell
& $py -m pip install -r (Join-Path $PSScriptRoot "requirements-clone.txt") --index-url https://download.pytorch.org/whl/cu124 --extra-index-url https://pypi.org/simple
```

Keep line 27 (`pip install --upgrade pip`) and everything else unchanged. Rationale to preserve in a short Portuguese comment above the new line: torch/torchaudio resolve from the cu124 index, chatterbox-tts/pillow fall through to PyPI via `--extra-index-url`; exact `==` pins keep resolution deterministic. Also update the line-26 comment if you wish, but do not remove it.

**Verify**:

- `git grep -nE "pip install (torch|chatterbox)" -- tools/setup-clone.ps1` → no matches.
- `git grep -n "requirements-clone.txt" -- tools/setup-clone.ps1` → 1 match.
- Syntax check: `powershell -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw tools/setup-clone.ps1)) > $null; 'syntax ok'"` → prints `syntax ok`.

### Step 4: Confirm scope

**Verify**: `git status --short` → only `tools/requirements-clone.txt` (new) and `tools/setup-clone.ps1` (modified).

## Test plan

There is no automated test for a PowerShell installer in this repo. Verification is:

- The greps in Step 3 (no unpinned install of those packages remains; the script references the requirements file).
- The PowerShell syntax check in Step 3.
- Do NOT run the full `setup-clone.ps1` as a test — it would download ~5-7 GB and could disturb the live venv. A real end-to-end run is deliberately deferred to the next time a machine is provisioned (see Maintenance notes).
- `npx vitest run` → all pass (nothing in the Node code changed; this is a no-regression sanity check).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `tools/requirements-clone.txt` exists; every dependency line uses exact `==` pins (`git grep -cE "^[a-z-]+==" -- tools/requirements-clone.txt` ≥ 4)
- [ ] `git grep -n "requirements-clone.txt" -- tools/setup-clone.ps1` → 1 match
- [ ] `git grep -nE "pip install (torch|chatterbox)" -- tools/setup-clone.ps1` → no matches
- [ ] PowerShell syntax check on `tools/setup-clone.ps1` prints `syntax ok`
- [ ] `git status` shows only the two in-scope files changed
- [ ] `npx vitest run` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `Test-Path tools\clone-venv\Scripts\python.exe` is `False` — the known-good venv doesn't exist on this machine, so the versions cannot be read; the pins would be guesses. STOP and ask the operator.
- The `importlib.metadata` query fails for any of the four packages (e.g. `PackageNotFoundError`) — the venv isn't the known-good one described here.
- `tools/setup-clone.ps1` lines 26-29 don't match the excerpt in "Current state" (script drifted since planning).
- You are tempted to run `pip install`, `ensurepip`, or any mutation inside `tools/clone-venv/` — that venv is production state; stop instead.

## Maintenance notes

- The pins record a Windows/CUDA 12.4 (RTX 4070) known-good set. When upgrading torch, update `requirements-clone.txt` deliberately and re-run `setup-clone.ps1` in a FRESH venv before replacing the live one.
- First real validation of the edited script happens on the next machine provisioning — expect `pip install -r` to behave identically to the old two-command form; if the pytorch index ever garbage-collects `2.6.0+cu124` wheels, the script now fails loudly (good) instead of silently installing something newer.
- Transitive dependencies remain unpinned by design (only direct deps are frozen); if stronger reproducibility is ever needed, generate a full freeze from a fresh venv that has pip.
- Reviewer focus: the single new `pip install -r` line — check both index URLs are present and the requirements path uses `$PSScriptRoot`.
