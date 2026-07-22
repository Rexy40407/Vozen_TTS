# Qualidade de voz por língua — diagnóstico e plano

> Contexto: relato "em algumas línguas parece que ele não sabe falar bem".
> Este documento **diagnostica as causas reais** dessa perceção e separa o que é
> corrigível já (com evidência) do que **exige o ouvido do operador** (áudio real).
> Para a arquitetura geral ver `ARCHITECTURE.md`; para a calibração no código ver
> `src/tts/calibration.ts`.

## 0. O ponto de partida (o que o Voxi é, e o que NÃO é)

O motor é o **Piper** (`src/tts/piper.ts`): sintetiza a partir de **modelos neurais
`.onnx` pré-treinados** descarregados de https://huggingface.co/rhasspy/piper-voices.

**Consequência crítica para esta tarefa:** *não existe* pipeline de treino neste
repositório — não há dataset, não há passo de treino, não há GPU, e o runtime só
consome os `.onnx` prontos. Por isso **"fine-tuning do modelo por língua" (re-treinar
os pesos da rede) é inviável dentro do Voxi**. A qualidade por língua NÃO se muda
re-treinando aqui; muda-se por **quatro alavancas que existem mesmo no código**:

1. **Que modelo** é escolhido para cada língua (`language/voiceMap.ts` → `pickVoiceForLang`).
2. **Qual o tier de qualidade** do `.onnx` instalado (`x_low` < `low` < `medium` < `high`).
3. **`length_scale` (ritmo)** por modelo — `VOICE_CALIBRATION` em `calibration.ts`.
4. **`noise_scale` / `noise_w` / `sentence_silence` (timbre, variação, pausa)** — os
   `VOICE_PARAM_OVERRIDES` em `calibration.ts` (hoje **vazios de propósito**).

Tudo o que "ajusta prosódia e entoação por língua" vive nas alavancas 3 e 4.

## 1. As 5 causas de "não fala bem" (por ordem de impacto)

Cada causa está ligada a evidência **no próprio repositório** — não a suposição.

### C1 — Língua sem modelo → cai na voz inglesa (garble) — **causa nº 1**
Evidência: `voiceMap.ts::pickVoiceForLang` — se não houver modelo com o prefixo da
língua detetada, devolve a **voz preferida** (por defeito `en_US-amy-medium`). Uma voz
**inglesa a ler texto turco/polaco/russo** produz fonemas errados: soa exatamente a
"não sabe falar". O README lista ~30 prefixos mapeados, mas o operador só instala os
`.onnx` que quer — as línguas sem `.onnx` correspondente caem todas na voz inglesa.
**É de longe o motivo mais provável do relato.**

### C2 — Modelo de tier baixo (`x_low` / `low`) — robótico/abafado
Evidência: o próprio README dá como exemplos `it_IT-riccardo-x_low` (Italiano) e
`en_GB-alan-low` (Inglês UK). Os tiers `x_low`/`low` do Piper têm menos parâmetros →
voz metálica e pouco natural. Não é bug: é o modelo escolhido. **Independentemente da
prosódia, um `x_low` soa mal.**

### C3 — Ritmo não calibrado (modelo treinado rápido/lento demais)
Evidência: `VOICE_CALIBRATION` só tem **uma** entrada — `pt_PT-tugao-medium: 1.5` — e o
comentário documenta *porquê*: o tugão fala ~30% depressa demais (medido ~53 ms/fonema
vs ~75 ms nas vozes de referência). **Qualquer outro modelo da comunidade treinado com
ritmo anormal continua sem correção** → sai apressado ("a comer as palavras") ou
arrastado. Vozes candidatas típicas: as de línguas menos servidas (europeu de leste,
nórdicas), onde há uma única voz da comunidade sem curadoria de ritmo.

> **Armadilha de correspondência de chave (diacrítico).** `VOICE_CALIBRATION[model]` é
> uma procura por string **exata**. A chave no código é `pt_PT-tugao-medium` (sem til),
> mas o README escreve `pt_PT-tugão-medium` (com til). Se o ficheiro `.onnx` real levasse
> o til, a **única calibração existente não bateria** e o PT sairia 30% depressa demais —
> tornando o Português numa das línguas "que não falam bem". Evidência de que está OK hoje:
> o `BENCHMARKS.md` gerado mostra `pt_PT-tugao-medium` (sem til) a resolver, logo o ficheiro
> instalado é sem til e a chave bate. **Regra ao adicionar entradas a `VOICE_CALIBRATION`:
> a chave tem de ser byte-a-byte o nome do ficheiro `.onnx` (diacríticos incluídos).**

### C4 — Timbre/entoação globais, não afinados por voz
Evidência: `VOICE_PARAM_OVERRIDES = {}` (vazio) e o comentário no ficheiro: é "a
SUPERFÍCIE de afinação para futura calibração de ouvido", deixada vazia **de propósito**
porque escolher os valores é "decisão de ouvido do operador". Hoje TODAS as vozes usam o
mesmo preset orgânico global (`noise_scale 0.75 / noise_w 0.95 / sentence_silence 0.4`).
Vozes que precisavam de mais/menos variação ou pausa ficam sub-ótimas — mas **corrigir
isto às cegas pioraria** (ver §3).

### C5 — Deteção de língua errada em texto curto/ambíguo → voz de outra língua
Evidência: `language/detect.ts` usa `franc` com `CONFIDENT_MARGIN = 0.10`; o léxico de
saudações (`greetings.ts`) e a memória de língua (`langMemory.ts`) já mitigam o curto.
`ARCHITECTURE.md` regista que duas línguas do **mesmo script** na mesma frase (EN+FR) não
são separadas de forma fiável. Uma deteção errada faz a frase sair na voz errada — soa a
"não sabe falar" mesmo com um bom modelo.

## 2. O que é CORRIGÍVEL JÁ (evidência, sem precisar de áudio)

### A1 — Garantir um modelo `medium`+ por cada língua servida (resolve C1)
Ação do operador, não de código: para cada língua que a comunidade fala no servidor,
descarregar de piper-voices um `.onnx` **de tier `medium` (ou `high`)** e pô-lo em
`MODELS_DIR`. Sem isto, a língua cai na voz inglesa (garble). Alternativa parcial: pôr um
`DEFAULT_VOICE` regional (ex. `es_ES-davefx-medium`) para servidores maioritariamente
dessa língua — melhor do que cair no inglês.

### A2 — Substituir os tiers `x_low`/`low` por `medium` (resolve C2)
Onde existir um `medium`/`high` para a **mesma** língua, preferir sempre esse ao
`x_low`/`low`. Processo (não posso confirmar nomes de modelos com ferramentas de ficheiro
— **verificar em piper-voices antes de trocar, não assumir que existe**):
1. Abrir https://huggingface.co/rhasspy/piper-voices na pasta da língua (ex. `it/it_IT/`,
   `en/en_GB/`).
2. Procurar uma voz de tier `medium` (ou `high`) para essa língua; confirmar que os 2
   ficheiros (`.onnx` + `.onnx.json`) existem.
3. Só então descarregar e substituir o `x_low`/`low` em `MODELS_DIR`.

Casos conhecidos a rever (dos exemplos do README): Italiano `it_IT-riccardo-x_low` e
Inglês UK `en_GB-alan-low` — procurar um `medium` da mesma língua para cada. É a melhoria
de maior rácio esforço/efeito depois da A1.

### A3 — Calibrar o ritmo por medição (resolve C3) — **metodologia entregável**
A entrada do tugão mostra o método exato, replicável **sem ouvido**, só com medição:
1. Sintetizar uma frase de referência com o modelo suspeito e com uma voz-âncora boa
   (ex. `en_US-amy-medium` ou `pt_PT-cadu` se disponível).
2. Medir **ms por fonema** (duração do WAV ÷ nº de fonemas). O Piper reporta os fonemas
   com `--debug`; o WAV é 22050 Hz mono 16-bit (ver `wavConcat.ts`), logo
   `duração = bytes_de_dados / (22050·2)` segundos.
3. Comparar com a âncora (~75 ms/fonema é natural nas vozes de referência).
4. `calibração = ms_do_modelo_normal / ms_medido`. Rápido demais → >1 (abranda); lento
   → <1. Adicionar a `VOICE_CALIBRATION` em `calibration.ts` (compõe-se com o utilizador
   e com o preset orgânico automaticamente). **A chave = nome exato do `.onnx`** (ver a
   armadilha do diacrítico em C3).

> **Não preenchi valores de C3 aqui** porque não posso executar o Piper nem ler o WAV
> (só tenho ferramentas de ficheiro). Os números têm de sair da medição acima — inventá-los
> arriscaria uma regressão audível, exatamente o que o comentário do tugão evita.

### A4 — Reduzir a misdeteção (mitiga C5)
- Acrescentar tokens ao léxico curado em `greetings.ts` **à medida que forem reportadas**
  palavras que saem na língua errada (o `BENCHMARKS.md` T3.3 já define isto como "ongoing").
- Requer casos reais reportados (que palavra saiu em que língua) — sem eles, mexer no
  `CONFIDENT_MARGIN` às cegas pode piorar outros pares. Não alterado sem dados.

## 3. O que EXIGE o ouvido do operador (NÃO fiz — de propósito)

**Afinação de `noise_scale` / `noise_w` / `sentence_silence` por voz (C4).** Estes
parâmetros mudam timbre, variação e respiração — o "melhor" é uma escolha **percetual**.
`calibration.ts` deixa `VOICE_PARAM_OVERRIDES` vazio *precisamente* para não regredir sem
essa validação. Como não posso ouvir áudio, **não populei nenhum valor**: fabricá-los
violaria "não inventes" e o aviso explícito do código.

Procedimento recomendado (A/B por ouvido, como o preset orgânico global já foi escolhido):
para a voz X, sintetizar a mesma frase com 2–3 variantes (ex. `noise_w` 0.8 vs 0.95 vs
1.1; `sentence_silence` 0.3 vs 0.5), ouvir, escolher, e só então adicionar a entrada
**parcial** em `VOICE_PARAM_OVERRIDES` (só os campos que muda; o resto herda o global).

## 4. Prioridade recomendada

| # | Ação | Causa | Precisa de áudio? | Onde |
|---|---|---|---|---|
| 1 | Instalar `medium`+ por língua servida | C1 | Não | `MODELS_DIR` (operador) |
| 2 | Trocar `x_low`/`low` → `medium` | C2 | Não | `MODELS_DIR` (operador) |
| 3 | Calibrar `length_scale` por medição | C3 | Não (mede-se) | `VOICE_CALIBRATION` |
| 4 | Léxico de saudações p/ palavras reportadas | C5 | Não (precisa de casos) | `greetings.ts` |
| 5 | Afinar `noise_*`/`silence` por voz | C4 | **Sim (A/B)** | `VOICE_PARAM_OVERRIDES` |

Os itens 1–2 resolvem o grosso do relato "não fala bem" (a maioria dos casos é C1/C2,
não prosódia). O 3 corrige ritmo com um método objetivo. O 5 é o único que precisa mesmo
do ouvido do Diogo.

## 5. Limitações deste trabalho

- **Fine-tuning neural real: fora de alcance do repo** (sem pipeline de treino/dataset/GPU).
  A tarefa pedia "fine-tuning do modelo por língua"; isso re-treinaria pesos, o que o Voxi
  não faz. As alavancas reais são seleção de modelo + tier + prosódia (acima).
- **Sem execução nem áudio.** Só tenho ferramentas de ficheiro: não corri o Piper, não
  medi ms/fonema, não ouvi vozes. Por isso **não** preenchi números em `VOICE_CALIBRATION`
  (C3) nem em `VOICE_PARAM_OVERRIDES` (C4) — entreguei a **metodologia** para os obter, não
  valores inventados.
- **Nomes de modelos não verificáveis aqui.** Sem acesso à web nem à pasta de modelos, não
  confirmo que um `medium` específico exista em piper-voices — por isso A2 pede para
  **verificar antes de trocar** em vez de assumir nomes.
- **A lista de modelos instalados não está no repo.** Os `.onnx` vivem fora
  (`C:\Users\diogo\piper_pkg\...`, 38 modelos por `BENCHMARKS.md`/logs); o `bench.ts`
  descobre-os em runtime. As recomendações de tier baseiam-se nos exemplos do README
  (`it_IT-riccardo-x_low`, `en_GB-alan-low`) — confirmar contra a pasta real antes de trocar.
- **Nenhuma alteração de comportamento foi feita ao código.** Este documento é o
  diagnóstico + plano; as ações de código (entradas de calibração) ficam para quando
  houver medição/áudio, para não introduzir regressão.
