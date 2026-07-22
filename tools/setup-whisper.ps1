# tools/setup-whisper.ps1 — instala o sidecar de STT (faster-whisper) num venv (Windows).
# Espelha o setup-whisper.sh (que é o usado no VPS). SEM PyTorch nem cmake (CTranslate2).
# O bot AUTO-DETETA tools\whisper-venv\Scripts\python.exe + tools\whisper_sidecar.py — sem
# tocar no .env. OPT-IN: sem este venv o STT fica inerte. Ver docs/SPIKE-STT.md.
$ErrorActionPreference = "Stop"
$venv = Join-Path $PSScriptRoot "whisper-venv"
$py = Join-Path $venv "Scripts\python.exe"

# 1) Python base: preferir 3.12/3.11/3.13 (mesma lógica do setup-kokoro).
$basePy = $null
foreach ($v in @("-3.12", "-3.11", "-3.13")) {
  try { & py $v --version *> $null; if ($LASTEXITCODE -eq 0) { $basePy = @("py", $v); break } } catch {}
}
if (-not $basePy) {
  try {
    foreach ($line in (& py -0p 2>$null)) {
      if ($line -match "3\.(11|12|13)") {
        $p = ($line.Trim() -split "\s+")[-1]
        if ($p -match "python\.exe$" -and (Test-Path $p)) { $basePy = @($p); break }
      }
    }
  } catch {}
}
if (-not $basePy) {
  Write-Host "AVISO: sem Python 3.11-3.13 detetado; a tentar 'python'."
  $basePy = @("python")
}
Write-Host "Python base: $($basePy -join ' ')"

# 2) venv
if (-not (Test-Path $py)) {
  Write-Host "A criar venv em $venv ..."
  $pyArgs = @()
  if ($basePy.Count -gt 1) { $pyArgs = $basePy[1..($basePy.Count - 1)] }
  & $basePy[0] @pyArgs -m venv $venv
}

# 3) deps (faster-whisper traz o CTranslate2; sem PyTorch). sec(031): versões PINADAS
#    em requirements-whisper.txt (antes instalava faster-whisper sem versão nenhuma).
& $py -m pip install --upgrade pip
& $py -m pip install --disable-pip-version-check -r (Join-Path $PSScriptRoot "requirements-whisper.txt")

# 4) verificação (o modelo `base` ~140MB descarrega no 1.º arranque do sidecar)
& $py -c "import faster_whisper, ctranslate2; print(f'faster-whisper {faster_whisper.__version__} | ctranslate2 {ctranslate2.__version__}')"
Write-Host ""
Write-Host "=== SETUP OK ==="
Write-Host "O bot vai auto-detetar: $py tools\whisper_sidecar.py"
Write-Host "(load do modelo `base` ~1-2s; depois ~2s por 13s de fala, RTF ~0.16 em CPU)"
