# tools/setup-kokoro.ps1 — instala o sidecar TTS Kokoro (kokoro-onnx, ONNX/CPU) num venv.
# Descarrega ~340MB (modelo + vozes) + as deps ONNX. Idempotente. SEM PyTorch/GPU.
# O bot AUTO-DETETA tools\kokoro-venv\Scripts\python.exe + o modelo — sem tocar no .env.
$ErrorActionPreference = "Stop"
$venv = Join-Path $PSScriptRoot "kokoro-venv"
$py = Join-Path $venv "Scripts\python.exe"
$model = Join-Path $PSScriptRoot "kokoro-v1.0.onnx"
$voices = Join-Path $PSScriptRoot "voices-v1.0.bin"
$rel = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
$modelSha256 = "7D5DF8ECF7D4B1878015A32686053FD0EEBE2BC377234608764CC0EF3636A6C5"
$voicesSha256 = "BCA610B8308E8D99F32E6FE4197E7EC01679264EFED0CAC9140FE9C29F1FBF7D"

function Assert-FileSha256 {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Expected
  )
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actual -ne $Expected) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    throw "SHA-256 mismatch for $Path (download removed). Expected $Expected, got $actual."
  }
}

# 1) Python: o onnxruntime ainda nao tem wheels p/ 3.14 — preferir 3.12/3.11/3.13.
$basePy = $null
# 1a) Tags standard do py launcher (instalacoes normais do python.org).
foreach ($v in @("-3.12", "-3.11", "-3.13")) {
  try { & py $v --version *> $null; if ($LASTEXITCODE -eq 0) { $basePy = @("py", $v); break } } catch {}
}
# 1b) Fallback: procurar um caminho 3.11/3.12/3.13 no `py -0p` (apanha os Python geridos
#     pelo uv/Astral, que tem tags proprias tipo "Astral\CPython3.12.13" e NAO batem em -3.12).
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
  Write-Host "AVISO: sem Python 3.11-3.13 detetado; a tentar 'python' (pode falhar com 3.14)."
  $basePy = @("python")
}
Write-Host "Python base: $($basePy -join ' ')"

# 2) venv
if (-not (Test-Path $py)) {
  Write-Host "A criar venv em $venv ..."
  # $basePy pode ser @("py","-3.12") (2 elems) OU @("C:\...\python.exe") (1 elem, via
  # py -0p). Extrair os args SEM o range invertido `1..0` (que no caso 1-elem passava
  # o exe como argumento de si proprio).
  $pyArgs = @()
  if ($basePy.Count -gt 1) { $pyArgs = $basePy[1..($basePy.Count - 1)] }
  & $basePy[0] @pyArgs -m venv $venv
}

# 3) deps (ONNX Runtime + kokoro-onnx + soundfile; o espeak-ng vem empacotado)
& $py -m pip install --upgrade pip
& $py -m pip install -r (Join-Path $PSScriptRoot "requirements-kokoro.txt")

# 4) modelo + vozes (idempotente — so descarrega se faltar)
if (-not (Test-Path $model)) {
  Write-Host "A descarregar kokoro-v1.0.onnx (~310MB) ..."
  Invoke-WebRequest -Uri "$rel/kokoro-v1.0.onnx" -OutFile $model
}
if (-not (Test-Path $voices)) {
  Write-Host "A descarregar voices-v1.0.bin (~27MB) ..."
  Invoke-WebRequest -Uri "$rel/voices-v1.0.bin" -OutFile $voices
}
Assert-FileSha256 -Path $model -Expected $modelSha256
Assert-FileSha256 -Path $voices -Expected $voicesSha256

# 5) verificacao
& $py -c "import onnxruntime, kokoro_onnx; print('kokoro-onnx OK')"
Write-Host ""
Write-Host "=== SETUP OK ==="
Write-Host "O bot vai auto-detetar: $py tools\kokoro_server.py"
Write-Host "(load do modelo ~1s; depois ~0.3-1s por frase, RTF ~0.25 em CPU)"
