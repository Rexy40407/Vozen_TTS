export default {
  'error.generic': 'Alguna cosa ha anat malament. Torna-ho a provar.',
  'stt.guildOnly': "La transcripció només funciona dins d'un servidor.",
  'stt.noManage':
    'Necessites el permís de **Gestionar el servidor** per iniciar o aturar la transcripció.',
  'stt.notPremium':
    '🎙️ La transcripció en directe és una funció **Premium**. Consulta `/premium info` per desbloquejar-la en aquest servidor.',
  'stt.unavailable':
    'La transcripció no està disponible en aquesta instància (el motor de veu a text no està instal·lat).',
  'stt.notInVoice':
    'No soc en cap canal de veu. Entra en un i executa `/join` primer, i després inicia la transcripció.',
  'stt.alreadyRunning':
    "La transcripció ja s'està executant en aquest servidor. Fes servir `/transcribe stop` primer.",
  'stt.atCapacity':
    "Ara mateix s'estan executant massa transcripcions a tots els servidors. Torna-ho a provar d'aquí a una estona.",
  'stt.noChannel':
    "No puc publicar transcripcions en aquest canal. Prova d'executar l'ordre des d'un canal de text normal.",
  'stt.started':
    "✅ Transcripció iniciada. Qualsevol persona que premi **Consentir** a l'anunci es transcriurà en aquest canal.",
  'stt.startFailed':
    "No he pogut iniciar la transcripció (no s'ha pogut publicar l'anunci). Ho he desfet tot: no s'està enregistrant res. Torna-ho a provar.",
  'stt.announceStart':
    "🎙️ **La transcripció en directe està ACTIVADA en aquest canal.** Només es transcriu qui hi consent: prem el botó de sota per permetre que la teva parla s'escrigui aquí. Pots retirar el consentiment quan vulguis amb `/transcribe revoke`.",
  'stt.consentBtn': 'Consentir la transcripció',
  'stt.consentThanks':
    '✅ Gràcies: la teva parla ara es transcriurà en aquest servidor. Retira el consentiment quan vulguis amb `/transcribe revoke`.',
  'stt.stopped': '🛑 Transcripció aturada.',
  'stt.notRunning': "La transcripció no s'està executant en aquest servidor.",
  'stt.announceStop':
    "🛑 **La transcripció en directe ara està DESACTIVADA.** He deixat d'escoltar.",
  'stt.revoked':
    "✅ Consentiment retirat: ja no se't transcriurà en aquest servidor. (Els missatges ja publicats es queden; esborra'ls al Discord si vols.)",
  'stt.revokeNone':
    'No havies consentit la transcripció en aquest servidor, així que no hi havia res per retirar.',
  'privacy.eraseConfirm':
    "⚠️ Això esborra permanentment **totes** les teves dades de Vozen a tots els servidors: configuració de veu, sobrenom parlat, abreviatures i pronunciacions personals, aniversari desat, puntuacions de jocs, estadístiques de parla i exclusió. **Això no es pot desfer.** N'estàs segur?",
  'privacy.erasePremiumNote':
    "_Nota: el teu Premium/Plus de pagament i el seu historial de compra es conserven: et pertanyen a tu i als registres financers exigits per llei. Per aturar el Premium, deixa'l caducar o contacta amb el suport._",
  'privacy.eraseYes': 'Esborra-ho tot',
  'privacy.eraseNo': 'Cancel·la',
  'privacy.eraseCancelled': "Cancel·lat: no s'ha esborrat res.",
  'privacy.eraseDone': "✅ Fet. Totes les teves dades personals s'han esborrat permanentment.",
  'error.needManageGuild': 'Necessites el permís de **Gestionar el servidor** per fer això.',
  'join.needVoiceChannel': 'Entra primer en un canal de veu i després executa /join.',
  'join.missingPerms': 'Necessito els permisos de **Connectar** i **Parlar** a {channel}.',
  'join.joined':
    '✅ Ja soc a {channel}! Pas següent: digues `/tts hola` i ho llegiré en veu alta. Vols que llegeixi un canal automàticament? Executa /setup.',
  'join.joinedAutoread':
    '✅ Ja soc a {channel}! Tot a punt. Escriu al canal de lectura automàtica i ho llegiré en veu alta. → {readChannel}',
  'leave.left': 'He sortit del canal de veu. Fins la propera!',
  'skip.notInVoice':
    'Encara no soc en cap canal de veu. Entra en un i executa /join primer, i torna-ho a provar.',
  'skip.skipped': 'Omès.',
  'skip.nothing': "Ara mateix no s'està reproduint res.",
  'shutup.notInVoice': 'Encara no soc en cap canal de veu. Entra en un i executa /join primer.',
  'shutup.nothing': "Ara mateix no s'està reproduint res.",
  'shutup.done': "🤐 D'acord, callo: he buidat tot el que hi havia a la cua.",
  'tts.notInVoice':
    'Encara no soc en cap canal de veu. Entra en un i executa /join, i torna-ho a provar.',
  'tts.nothingToRead': "No hi ha res per llegir. Envia'm algun text per dir.",
  'tts.nothingAfterClean':
    'Després de netejar-ho no quedava res per llegir. Prova amb text normal (lletres o paraules).',
  'tts.tooFast': "Ei, ves més a poc a poc. Torna-ho a provar d'aquí a un moment.",
  'tts.blocked': "Aquest text conté una paraula bloquejada, així que l'he omès.",
  'tts.queued': 'Fet, ja és a la cua.',
  'tts.busy': "Ara mateix estic ocupat. Torna-ho a provar d'aquí a un moment.",
  'voice.unknownModel': 'No conec aquesta veu. Consulta /voice list.',
  'voice.badSpeed':
    "La velocitat ha d'estar entre 0.5 i 2.0 (1.0 és la normal). Prova `/voice set model:… speed:1.0`.",
  'voice.set':
    '✅ La teva veu ara és **{name}** a {speed}×. Prova `/tts hola` per escoltar-la. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Configuració de veu** — tria les opcions de sota i prem **Desa**. No canviarà res fins que ho facis.',
  'voice.config.summary': 'Selecció actual: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Idioma…',
  'voice.config.pickVoice': 'Veu…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Velocitat…',
  'voice.config.more': '▼ Més idiomes',
  'voice.config.engDefault': 'Predeterminat (local)',
  'voice.config.save': 'Desa',
  'voice.config.cancel': 'Cancel·la',
  'voice.config.cancelled': 'Configuració cancel·lada — no ha canviat res.',
  'voice.config.expired': 'El tauler ha caducat — torna a executar `/voice config` per continuar.',
  'voice.listHeader': 'Veus disponibles:',
  'voice.listEmpty': '(cap instal·lada)',
  'voice.reset':
    "✅ La teva veu torna a ser la predeterminada. Tria'n una altra quan vulguis amb `/voice list` i `/voice set`.",
  'voice.detection.on':
    '✅ La detecció automàtica de llengua està ACTIVADA: cada missatge es llegeix amb una veu de la llengua detectada (el locutor pot canviar). Desactiva-la amb `/voice detection active:false`.',
  'voice.detection.off':
    '✅ La detecció automàtica de llengua està DESACTIVADA: la teva única veu fixa ho llegeix tot, així sones sempre igual.',
  'voice.optout':
    "Ja no se't llegirà automàticament. Executa /voice opt-in per tornar-ho a activar.",
  'voice.optin': "Se't tornarà a llegir automàticament.",
  'voice.nickname.set': '✅ En Vozen ara et dirà **{name}** en veu alta.',
  'voice.nickname.cleared':
    '✅ Sobrenom parlat eliminat: en Vozen farà servir el teu nom del servidor.',
  'voice.nickname.invalid':
    'Aquest nom no té res llegible per dir en veu alta. Prova amb lletres o números.',
  'voice.effect.set':
    '✅ Efecte de veu establert a **{effect}**: els teus missatges ara es reprodueixen amb aquest efecte. Fes servir `/voice effect none` per desactivar-lo.',
  'voice.effect.cleared': '✅ Efecte de veu eliminat: veu neta de nou.',
  'voice.effect.locked':
    "🔒 **{effect}** és un efecte Premium. Efectes gratuïts: 🤖 Robot i 🔊 Echo. Desbloqueja'ls tots amb Vozen Premium: consulta `/premium`.",
  'voice.engine.gcloudLocked':
    "🔒 **💎 Google HD** és un motor de veu Premium. Desbloqueja'l amb Vozen Plus (personal) o Vozen Premium (servidor): consulta `/premium`. Mentrestant, la teva veu es queda al motor local gratuït.",
  'voice.engine.kokoroLocked':
    "🔒 **💎 Kokoro** és un motor de veu Premium. Desbloqueja'l amb Vozen Plus (personal) o Vozen Premium (servidor): consulta `/premium`. Mentrestant, la teva veu es queda al motor local gratuït.",
  'voice.notInVoice': 'Encara no soc en cap canal de veu. Executa /join primer.',
  'voice.previewPlaying': 'Reproduint una mostra…',
  'preview.sample': "Hola, soc en Vozen. Escriu-ho i escolta'l.",
  'laugh.playing': 'Ha, ha! Reproduint-ho amb la teva veu…',
  'joke.playing': 'Explicant un acudit…\n> {joke}',
  'joke.unknownLang': "No conec aquesta llengua. Tria'n una de la llista.",
  'rizz.playing': '😏 Deixant anar una lligada…\n> {line}',
  'rizz.unknownLang': "No conec aquesta llengua. Tria'n una de la llista.",
  'rizz.locked':
    "🔒 **/rizz** és un extra Premium. Desbloqueja'l amb Vozen Plus (tu) o Premium (aquest servidor). Consulta `/premium`.",
  'sound.playing': '🔊 Reproduint **{name}**…',
  'sound.unknown': 'No tinc aquest so. Executa `/sound` per veure la llista.',
  'sound.list':
    "🔊 **Sons:** {sounds}\nReprodueix-ne un amb `/sound name:<sound>` (he d'estar al teu canal de veu).",
  'sound.disabled':
    '🔇 La taula de sons està **desactivada** en aquest servidor. Un administrador la pot activar amb `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    "🎂 Aniversari desat: **{day}/{month}**. Et felicitaré l'aniversari quan entris en un canal de veu aquell dia!",
  'birthday.invalid': 'Aquesta data no existeix. Comprova el dia i el mes.',
  'birthday.cleared': '🎂 Aniversari eliminat.',
  'birthday.show': '🎂 El teu aniversari està establert al **{day}/{month}**.',
  'birthday.none': 'Encara no has establert cap aniversari. Fes servir `/birthday set`.',
  'topspeakers.title': '🗣️ **Els que més parlen** — a qui he llegit més en aquest servidor:',
  'topspeakers.empty':
    'Encara no he llegit els missatges de ningú. Configura un canal de lectura amb `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** missatges · 🔥 ratxa de {streak} dies',
  'serverstats.title': '📊 **Estadístiques del servidor**',
  'serverstats.empty':
    'Encara no hi ha estadístiques: no he llegit cap missatge ni he fet cap joc aquí. Configura-ho amb `/setup`!',
  'serverstats.messages': '🗣️ **{total}** missatges llegits · **{speakers}** persones',
  'serverstats.topTalkers': '**Els que més parlen:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} msg · 🔥 {streak}d',
  'serverstats.streak': '🔥 Ratxa activa més llarga: **{days}** dies',
  'serverstats.games':
    '🎮 **{points}** punts de jocs · **{wins}** victòries · **{players}** jugadors',
  'serverstats.topPlayers': '**Millors jugadors:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pts · {wins} victòries',
  'serverstats.upsell':
    '🔒 Això és la vista prèvia gratuïta. El **Premium** desbloqueja ratxes, estadístiques de jocs i el top 5 complet: consulta `/premium`.',
  'streak.day': '🔥 <@{user}> porta una ratxa de **{n} dies**! Continua parlant per mantenir-la.',
  'leaderboard.autoTitle': '🏆 Els que més parlen en aquest servidor',
  'premium.title': '💎 **Estat del Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Servidor:** Premium fins al {date}',
  'premium.lineServerFree': '🖥️ **Servidor:** pla gratuït',
  'premium.lineUserActive': '👤 **Tu (Plus):** actiu fins al {date}',
  'premium.lineUserFree': '👤 **Tu (Plus):** inactiu',
  'premium.getHint':
    'Tot el que fas servir avui continua sent gratuït. El Premium afegeix els 8 efectes de veu, 24/7 a la trucada, 50 pronunciacions personals, /rizz i els jocs premium. Suport: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **El teu passi Premium:** {used}/{total} llicències en ús · caduca el {date}',
  'premium.passServers': '↳ En ús a: {servers}',
  'premium.pitch':
    "Encara no tens Premium. El **Vozen Premium** (€3.99/mes per a 3 servidors, o €7.99/mes per a 8) desbloqueja per a tot el servidor: els 8 efectes de veu, 24/7 a la trucada, 50 pronunciacions personals (en lloc de 3), l'ordre /rizz i els jocs premium (Cadena de Paraules, Wordle, Escacs). El **Vozen Plus** (€1.99/mes) et dóna aquests avantatges personalment, a qualsevol servidor.",
  'premium.buyHint':
    '▶ **Obtén Premium:** {link}\nDesprés de comprar, executa `/premium activate` al servidor que vulguis.',
  'premium.confirmActivate':
    'Vols fer servir **1 de les teves {total} llicències Premium** en **aquest servidor**? Ara mateix en tens **{used}** en ús. La pots alliberar més tard amb `/premium deactivate`: el rellotge del passi continua corrent igualment.',
  'premium.confirmYes': '💎 Fer servir una llicència',
  'premium.confirmNo': 'Cancel·la',
  'premium.activateOk':
    '✅ El Premium ara està actiu en **aquest servidor** fins al {date}. Llicències: **{used}/{total}** en ús.',
  'premium.activateCancelled': "Cancel·lat: no s'ha fet servir cap llicència.",
  'premium.activateTimeout': "S'ha esgotat el temps: no s'ha fet servir cap llicència.",
  'premium.noPass':
    'No tens cap passi Premium actiu. Aconsegueix-ne un i anirà al teu compte, i després executa `/premium activate` aquí.\n▶ {link}',
  'premium.alreadyActive':
    'Aquest servidor ja té una de les teves llicències Premium. No cal fer res.',
  'premium.noSeats':
    "Totes les teves **{total}** llicències Premium estan en ús ({servers}). Allibera'n una amb `/premium deactivate` allà i torna-ho a provar aquí.",
  'premium.needManageGuild':
    'Activar el Premium afecta tot el servidor: només els membres amb **Gestionar el servidor** ho poden fer. Demana-ho a un administrador.',
  'premium.deactivateOk':
    "✅ Has alliberat la llicència Premium d'aquest servidor. Fes-la servir en un altre servidor amb `/premium activate`.",
  'premium.deactivateNone': 'Aquest servidor no té cap llicència teva per alliberar.',
  'premium.thisServer': 'aquest servidor',
  'grant.denied': '⛔ Aquesta ordre és només per al propietari del bot.',
  'grant.okPremium':
    "✅ Has concedit a <@{user}> un **passi Premium** ({seats} llicències) durant **{days}** dies: caduca el {date}. L'activa amb `/premium activate`.",
  'grant.okPlus':
    '✅ Has concedit a <@{user}> **Vozen Plus** durant **{days}** dies: caduca el {date}.',
  'gencode.done':
    '✅ Generats **{count}** codi(s) {plan}, **{days}** dies cadascun. Comparteix-los en privat:\n{list}',
  'redeem.okPlus':
    '🎁 Bescanviat! Has obtingut **Vozen Plus** durant **{days}** dies: caduca el {date}.',
  'redeem.okPremium':
    "🎁 Bescanviat! Has obtingut un **passi Premium** ({seats} llicències) durant **{days}** dies: caduca el {date}. Activa'l al teu servidor amb `/premium activate`.",
  'redeem.notFound': '❌ Aquest codi no existeix. Torna a comprovar-lo i prova-ho de nou.',
  'redeem.used': "❌ Aquest codi ja s'ha bescanviat.",
  'redeem.expired': '❌ Aquest codi ha caducat.',
  'voice.abbrev.added': 'Fet, {term} es llegirà com a {replacement}.',
  'voice.abbrev.removed': 'He eliminat la teva abreviatura per a {term}.',
  'voice.abbrev.listHeader': 'Les teves abreviatures personals ({count}/{cap} usades):',
  'voice.abbrev.listEmpty': '(cap encara: afegeix-ne una amb /voice abbrev add)',
  'voice.abbrev.capReached':
    "Has arribat al límit de {cap} abreviatures personals. Elimina'n una abans d'afegir-ne una altra.",
  'voice.abbrev.invalidTerm':
    'El terme ha de ser una sola paraula (només lletres i xifres), de fins a 50 caràcters.',
  'voice.abbrev.emptyReplacement': 'La lectura no pot estar buida.',
  'voice.abbrev.tooLong': 'La lectura és massa llarga (màxim 200 caràcters).',
  'config.wordEmpty': 'La paraula no pot estar buida.',
  'config.blocked': 'Bloquejada: {word}.',
  'config.blockLimit':
    "Aquest servidor ja té el màxim de {max} paraules bloquejades. Elimina'n una abans d'afegir-ne una altra.",
  'config.unblocked': 'Desbloquejada: {word}.',
  'config.pronListHeader': 'Diccionari de pronunciació:',
  'config.pronEmptyValue': '(buit)',
  'config.listEmpty': '(cap)',
  'config.termEmpty': 'El terme no pot estar buit.',
  'config.pronEmpty': 'La pronunciació no pot estar buida.',
  'config.pronSet': 'Fet, {term} es llegirà com a {replacement}.',
  'config.pronRemoved': 'He eliminat la pronunciació per a {term}.',
  'config.channelWrongType': 'Tria un canal de text (no un canal de veu ni una categoria).',
  'config.channelNoAccess': 'No puc veure {channel}. Comprova els meus permisos allà.',
  'config.channelSet':
    "Canal de lectura automàtica establert a {channel}. Ara: assegura't que la lectura automàtica estigui activada amb `/config auto-read active:true`.",
  'config.autoreadOn': 'La lectura automàtica ara està **activada**.',
  'config.autoreadOff': 'La lectura automàtica ara està **desactivada**.',
  'config.maxCharsRange': "El valor de màxim de caràcters ha d'estar entre 1 i 2000.",
  'config.maxCharsSet': 'Màxim de caràcters per missatge establert a {value}.',
  'config.rateLimitRange': "El valor del límit de freqüència ha d'estar entre 1 i 120.",
  'config.rateLimitSet': 'Límit de freqüència establert a {value} missatges per minut.',
  'config.roleSet': 'La lectura automàtica ara està limitada als membres amb {role}.',
  'config.roleCleared': 'Restricció de rol eliminada. Ara es pot llegir tothom.',
  'config.enabledOn': 'El TTS ara està **activat** per a aquest servidor.',
  'config.enabledOff': 'El TTS ara està **desactivat** per a aquest servidor.',
  'config.xsaidOn':
    'En Vozen ara anunciarà **qui ha parlat** abans de cada missatge (p. ex. "L\'Alex ha dit hola"). Desactiva-ho amb `/config x-said active:false`.',
  'config.xsaidOff': 'En Vozen **ja no** anunciarà qui ha parlat: només llegeix el missatge.',
  'config.autojoinOn':
    '✅ Entrada automàtica **activada**: en Vozen entrarà al teu canal de veu quan escriguis al canal de TTS.',
  'config.autojoinOff':
    'Entrada automàtica **desactivada**: fes servir `/join` per portar en Vozen a la veu.',
  'config.stayOn':
    '✅ 24/7 a la trucada **activat**: en Vozen es quedarà al canal de veu fins i tot quan es buidi, i tornarà després de reinicis. 💎 Cal Premium perquè tingui efecte (compra o `/redeem` un codi, i després `/premium activate`).',
  'config.stayOff':
    '24/7 a la trucada **desactivat**: en Vozen surt quan el canal de veu es buida (predeterminat).',
  'config.readBotsOn': "✅ En Vozen ara també llegirà els missatges d'**altres bots i webhooks**.",
  'config.readBotsOff':
    'En Vozen **ignorarà** els altres bots i webhooks (només es llegeixen les persones reals).',
  'config.textInVoiceOn': '✅ En Vozen també llegirà el **xat de text del seu canal de veu**.',
  'config.textInVoiceOff':
    'En Vozen **no** llegirà el xat de text del canal de veu (només el canal de TTS).',
  'config.antispamOn':
    '✅ Antispam **activat**: en Vozen no llegirà els missatges amb spam (repetició massiva de paraules o el mateix missatge llarg publicat una vegada i una altra).',
  'config.antispamOff': 'Antispam **desactivat**: en Vozen llegeix tots els missatges com sempre.',
  'config.streaksOn':
    '✅ Avisos de ratxa **activats**: en Vozen mostra un missatge de ratxa de dies 🔥 la primera vegada que cada persona parla cada dia.',
  'config.streaksOff':
    'Avisos de ratxa **desactivats**: en Vozen continua comptant les ratxes (mira `/top-speakers`) però no en diu res.',
  'config.soundboardOn':
    'Taula de sons **activada**: qualsevol persona pot reproduir clips amb `/sound`.',
  'config.soundboardOff':
    'Taula de sons **desactivada**: `/sound` està desactivat en aquest servidor.',
  'config.votePromosLabel': 'Avisos de recompensa de top.gg + Vozen Support',
  'config.greetOn': '✅ Saludaré la gent pel seu nom quan entrin al canal de veu.',
  'config.greetOff': '🔇 **No** saludaré la gent quan entrin al canal de veu.',
  'config.greetLangSet': "✅ Llengua de la salutació d'entrada establerta a **{language}**.",
  'config.defaultVoiceSet':
    '✅ Veu predeterminada del servidor establerta a **{name}**. Els membres sense veu pròpia sentiran aquesta. (id: `{model}`)',
  'config.reset':
    "Configuració restablerta als valors predeterminats. S'han conservat la llista de bloqueig i les pronunciacions.",
  'config.showTitle': '**Configuració del servidor**',
  'config.showChannel': 'Canal de TTS: {value}',
  'config.showAutoread': 'Lectura automàtica: {value}',
  'config.showRole': 'Rol: {value}',
  'config.showEnabled': 'Activat: {value}',
  'config.showXsaid': 'Anunciar qui parla (xsaid): {value}',
  'config.showAutojoin': 'Entrada automàtica: {value}',
  'config.showReadBots': 'Llegir bots/webhooks: {value}',
  'config.showTextInVoice': 'Text a la veu: {value}',
  'config.showAntispam': 'Antispam: {value}',
  'config.showSoundboard': 'Taula de sons (/sound): {value}',
  'config.showGreet': "Saludar a l'entrada: {value} ({language})",
  'config.showVoice': 'Veu predeterminada: {value}',
  'config.showMaxChars': 'Màxim de caràcters: {value}',
  'config.showRateLimit': 'Límit de freqüència: {value}/min',
  'config.showBlocklist': 'Llista de bloqueig: {count} paraules',
  'config.showPronunciation': 'Pronunciacions: {count} entrades',
  'config.valueNone': '(cap)',
  'config.valueAny': 'qualsevol',
  'config.valueAutoDetect': '(detecció automàtica)',
  'config.on': 'activat',
  'config.off': 'desactivat',
  'config.language.set': 'Llengua de la interfície establerta a {language}.',
  'config.language.unsupported': 'Aquesta llengua encara no és compatible.',
  'setup.noChannel':
    'No he pogut saber quin canal fer servir. Indica un canal de text a l\'opció "channel".',
  'setup.channelWrongType':
    'El canal de lectura automàtica ha de ser un canal de text (no un canal de veu ni una categoria). Indica\'n un a l\'opció "channel".',
  'setup.done': '**Tot a punt: en Vozen està preparat.**',
  'setup.channelLine': 'Canal de lectura automàtica: {channel}',
  'setup.autoreadOn': 'Lectura automàtica: activada',
  'setup.permsHeader': '**Permisos:**',
  'setup.permView': 'ViewChannel (veure el canal de text)',
  'setup.permSend': 'SendMessages (publicar al canal de text)',
  'setup.permConnect': 'Connect (entrar al canal de veu)',
  'setup.permSpeak': 'Speak (parlar al canal de veu)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — falta',
  'setup.permUnchecked': '⏳ {label} — encara no comprovat (ho verificaré en fer /join)',
  'setup.fixHint':
    "Per arreglar el que falta: a la configuració del servidor, obre el rol d'en Vozen (o els permisos del canal) i activa els elements marcats amb ❌.",
  'setup.voiceUncheckedNote':
    'No ets en cap canal de veu, així que encara no he pogut comprovar Connect/Speak. Els verificaré quan executis /join.',
  'setup.allGood': 'Tot a punt. Entra en un canal de veu i executa /join.',
  'setup.joinedVoice': 'També he entrat a {channel}, no cal que executis /join.',
  'setup.readyTalk': 'Tot a punt. Escriu al canal de lectura automàtica i ho llegiré en veu alta.',
  'setup.membersHeader': '**Explica-ho als teus membres (el procés de 3 passos):**',
  'setup.membersBody':
    "1) Entra en un canal de veu\n2) Executa /join perquè hi entri amb tu\n3) Escriu en aquest canal (o fes servir /tts) i ho llegiré en veu alta\nLlista completa d'ordres: /help",
  'stats.title': "**Estadístiques d'en Vozen**",
  'stats.messagesSpoken': 'Missatges llegits: {value}',
  'stats.cacheHits': 'Encerts de memòria cau: {value}',
  'stats.cacheMisses': 'Errades de memòria cau: {value}',
  'stats.synthErrors': 'Errors de síntesi: {value}',
  'stats.synthLatency': 'Latència de síntesi: p50 {p50}ms / p95 {p95}ms ({count} mostres)',
  'stats.voiceDrops': 'Talls de veu: {value}',
  'stats.voiceReconnects': 'Reconnexions: {value}',
  'stats.votes': 'Vots a top.gg: {value}',
  'stats.activePlayers': 'Reproductors actius: {value}',
  'stats.servers': 'Servidors: {value}',
  'stats.uptime': 'Temps en funcionament: {value}s',
  'speak.emptyMessage': 'Aquest missatge no té text per llegir en veu alta.',
  'uptime.text': '🟢 En Vozen fa **{uptime}** que està en línia.',
  'botstats.title': '📊 **Vozen — estadístiques**',
  'botstats.servers': 'Servidors: **{value}**',
  'botstats.voiceSessions': 'Sessions de veu ara: **{value}**',
  'botstats.messagesSpoken': 'Missatges llegits: **{value}**',
  'botstats.uptime': 'En línia des de fa: **{value}**',
  'invite.noClientId':
    "L'enllaç d'invitació d'en Vozen encara no està configurat (falta CLIENT_ID). Avisa l'administrador del bot.",
  'invite.link': 'Afegeix en Vozen al teu servidor:\n{url}',
  'vote.noClientId':
    "L'enllaç de vot d'en Vozen encara no està configurat (falta CLIENT_ID). Avisa l'administrador del bot.",
  'vote.link':
    'Vota en Vozen (gratis, cada 12 h) i ajuda que més gent el descobreixi:\n{url}\nSi aquest compte mai no ha reclamat la recompensa, obté **48 h de Vozen Plus**, una única vegada per compte.',
  'invite.button': 'Afegeix en Vozen',
  'vote.button': 'Vota a top.gg',
  'vote.upsell':
    '🗳️ Si aquest compte mai no ha reclamat la recompensa, obté **48 h de Vozen Plus**, una única vegada per compte. {url}',
  'vote.cooldownStatus':
    '🗳️ Aquest compte ja ha utilitzat la seva recompensa de vot única. Encara pots votar per donar suport a Vozen, però no rebràs més Plus.',
  'help.title': "Vozen — escriu-ho i escolta'l.",
  'help.embedTitle': 'Vozen — Ordres',
  'help.intro':
    'En Vozen llegeix el teu text en veu alta als canals de veu: veus neuronals gratuïtes i desenes de llengües.',
  'help.quickStartTitle': 'Inici ràpid (3 passos)',
  'help.quickStartBody':
    '1) Entra en un canal de veu i després executa /join\n2) Escriu al canal de text (o fes servir /tts Hola a tothom!)\n3) (opcional) Tria una veu amb /voice set',
  'help.groupStarted': 'Primers passos',
  'help.groupStartedBody':
    '• /join — entro al teu canal de veu\n• /leave — surto del canal de veu\n• /tts <text> — llegeixo el text en veu alta · p. ex. /tts Hola a tothom!\n• /skip — omet el que estigui llegint ara mateix',
  'help.groupVoice': 'La teva veu',
  'help.groupVoiceBody':
    '• /voice set <model> — tria la teva veu · p. ex. /voice set en_US-amy-medium\n• /voice list — mira les veus disponibles\n• /voice preview — escolta una mostra de la teva veu\n• /voice reset — torna a la veu predeterminada\n• /voice opt-out · /voice opt-in — activa/desactiva la lectura automàtica per a tu\n• /voice abbrev add|remove|list — argot personal, llegit a la teva manera (fins a 10)',
  'help.groupFun': 'Diversió',
  'help.groupFunBody':
    '• /joke — explico un acudit curt (tria una llengua + rialla opcional) · p. ex. /joke English\n• /laugh — ric en veu alta amb la teva veu actual',
  'help.groupAdmin': 'Administració del servidor (cal Gestionar el servidor)',
  'help.groupAdminBody':
    '• /setup — configuració guiada en un pas · executa-ho primer\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · p. ex. /config tts-channel #general\n• /stats — estadístiques del bot',
  'help.groupMore': 'Més',
  'help.groupMoreBody':
    '• /invite — afegeix en Vozen a un altre servidor\n• /vote — vota en Vozen a top.gg\n• /help — mostra aquesta ajuda',
  'help.footer': 'Ets nou aquí? Executa {command} per començar.',
  'help.support': "🛟 Necessites ajuda o vols informar d'un problema? {url}",
  'help.source': "📄 Codi obert (AGPL-3.0): obtén el codi exacte que s'executa aquí: {url}",
  'welcome.title': 'Gràcies per afegir en Vozen! 👋',
  'welcome.description':
    "En Vozen llegeix el teu xat en veu alta als canals de veu: escriu-ho i escolta'l.\n\n**Comença en un sol pas:** executa {setup} i configuraré la lectura automàtica i entraré al teu canal de veu.\n\nNecessites la llista completa d'ordres? Executa {help}.",
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Com el fan servir els membres (3 passos)',
  'welcome.stepsBody':
    "1) Entra en un canal de veu\n2) Executa /join perquè hi entri amb tu\n3) Escriu al canal de text (o fes servir /tts) i ho llegiré en veu alta\nLlista completa d'ordres: /help",
  'welcome.footer': "Vozen — escriu-ho i escolta'l.",
  'welcome.tagline': 'Veu neuronal natural: gratis per sempre, sense mur de pagament.',
  'game.start.needVoice':
    "Això és un **joc de veu**: entra en un canal de veu i executa /join primer, i després comença'l.",
  'game.start.alreadyActive':
    "Ja hi ha un joc en marxa a <#{channel}>. Acaba'l (o fes servir `/game stop`) abans de començar-ne un altre.",
  'game.start.premiumLocked':
    '🔒 **{game}** és un joc Premium (consumeix còmput real). Consulta `/premium`.',
  'game.start.started': '🎮 Començant **{game}**! Atenció al canal: bona sort!',
  'game.start.startedThread':
    "🎮 **{game}** ha començat a <#{channel}> — uniu-vos-hi! El fil s'esborra tot sol quan acaba el joc.",
  'game.thread.winner': '🏆 {winner} ha guanyat el joc!',
  'game.thread.ended': '🎮 El joc ha acabat.',
  'game.unknownGame': "No conec aquest joc. Tria'n un de la llista.",
  'game.stop.ok': '🛑 He aturat el joc actual.',
  'game.stop.none': 'Ara mateix no hi ha cap joc en marxa.',
  'game.list.title': "🎮 **Jocs** — comença'n un amb `/game play`:",
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': "🏆 **Classificació** — els millors jugadors d'aquest servidor:",
  'game.leaderboard.empty': "Encara no s'ha jugat cap partida. Sigues el primer: `/game play`!",
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pts ({wins} victòries)',
  'game.finish.title': '🏁 **Fi del joc!** Puntuacions finals:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Fi del joc: ningú no ha puntuat aquesta vegada. La propera!',
  'game.finish.winnerVoice': '{user} guanya!',
  'game.guessLanguage.name': 'Endevina la Llengua',
  'game.guessLanguage.desc':
    "Llegeixo una frase en una llengua a l'atzar: el primer a encertar-la guanya el punt.",
  'game.guessLanguage.intro':
    '🗣️ **Endevina la Llengua** — llegiré {rounds} frases. Escriu quina llengua sents. La resposta correcta més ràpida guanya cada ronda!',
  'game.guessLanguage.round': '🎧 Ronda {n}/{total} — escolta…',
  'game.guessLanguage.correct': '✅ **{user}** ho ha encertat: era **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Temps! Això era **{language}**.',
  'game.guessLanguage.noLanguages':
    "No tinc prou veus instal·lades per jugar a això. Demana a un administrador que n'afegeixi més.",
  'game.math.name': 'Càlcul Mental',
  'game.math.desc': 'Dic una operació en veu alta: el primer a escriure el resultat guanya.',
  'game.math.intro':
    '🔢 **Càlcul Mental** — {rounds} operacions. Escolta i escriu el resultat tan de pressa com puguis!',
  'game.math.round': '🧮 Ronda {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** ho ha clavat: el resultat era **{answer}**!',
  'game.math.timeout': '⏱️ Temps! El resultat era **{answer}**.',
  'game.math.plus': 'més',
  'game.math.minus': 'menys',
  'game.math.times': 'per',
  'game.skipCount.name': 'El Número que Falta',
  'game.skipCount.desc':
    'Compto en veu alta però em salto un número: el primer a atrapar-lo guanya.',
  'game.skipCount.intro':
    '🔢 **El Número que Falta** — compto, però em salto un número. Escriu el número que falta! ({rounds} rondes)',
  'game.skipCount.round': "👂 Ronda {n}/{total} — quin número m'he saltat?",
  'game.skipCount.correct': "✅ **{user}** l'ha atrapat: m'he saltat el **{answer}**!",
  'game.skipCount.timeout': "⏱️ Temps! M'he saltat el **{answer}**.",
  'game.spelling.name': "Concurs d'Ortografia",
  'game.spelling.desc': 'Dic una paraula: el primer a escriure-la correctament guanya.',
  'game.spelling.intro':
    "✍️ **Concurs d'Ortografia** — diré {rounds} paraules. Escriu cadascuna correctament!",
  'game.spelling.round': '🗣️ Ronda {n}/{total} — escriu la paraula que digui…',
  'game.spelling.correct': '✅ **{user}** ha escrit **{word}** correctament!',
  'game.spelling.timeout': '⏱️ Temps! La paraula era **{word}**.',
  'game.spelling.empty':
    "Encara no tinc cap llista de paraules per a la llengua de la veu d'aquest servidor.",
  'game.spellOut.name': 'Lletra a Lletra',
  'game.spellOut.desc':
    'Lletrejo una paraula lletra per lletra: el primer a escriure la paraula sencera guanya.',
  'game.spellOut.intro':
    '🔡 **Lletra a Lletra** — lletrejo {rounds} paraules lletra per lletra. Escriu la paraula sencera!',
  'game.spellOut.round': '🔤 Ronda {n}/{total} — escolta les lletres…',
  'game.spellOut.correct': '✅ **{user}** ho ha encertat — **{word}**!',
  'game.spellOut.timeout': '⏱️ Temps! Lletrejava **{word}**.',
  'game.fastSpeech.name': 'Parla Ràpida',
  'game.fastSpeech.desc':
    'Llegeixo una frase súper de pressa: el primer a escriure el que he dit guanya.',
  'game.fastSpeech.intro':
    '💨 **Parla Ràpida** — {rounds} frases a una velocitat ridícula. Escriu el que sentis!',
  'game.fastSpeech.round': '⚡ Ronda {n}/{total} — allà va, de pressa!',
  'game.fastSpeech.correct': '✅ **{user}** ho ha desxifrat: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Temps! Era: “{phrase}”',
  'game.fastSpeech.empty': "Encara no tinc frases per a la llengua de la veu d'aquest servidor.",
  'game.accentSwap.name': 'Accent Divertit',
  'game.accentSwap.desc':
    'Dic una paraula amb un accent estranger: el primer a escriure-la guanya.',
  'game.accentSwap.intro':
    "🎭 **Accent Divertit** — {rounds} paraules dites amb l'accent equivocat. Escriu la paraula!",
  'game.accentSwap.round': '🌍 Ronda {n}/{total} — quina paraula intento dir?',
  'game.accentSwap.correct': '✅ **{user}** ho ha encertat — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Temps! La paraula era **{word}**.',
  'game.reflexes.name': 'Reflexos',
  'game.reflexes.desc':
    "Faig el compte enrere i crido JA: el primer a escriure després guanya. No t'avancis!",
  'game.reflexes.intro':
    '⚡ **Reflexos** — {rounds} rondes. Quan cridi **JA**, escriu el que sigui tan de pressa com puguis. Escriure abans del JA és una sortida falsa!',
  'game.reflexes.ready': "🚦 Ronda {n}/{total} — prepara't…",
  'game.reflexes.countdown': 'tres… dos… un…',
  'game.reflexes.go': '🟢 **JA!!!**',
  'game.reflexes.goVoice': 'Ja!',
  'game.reflexes.tooSoon': "🔴 **{user}** s'ha avançat: massa aviat!",
  'game.reflexes.win': '⚡ **{user}** és el més ràpid! Punt!',
  'game.reflexes.tooSlow': '😴 Ningú no ha reaccionat a temps. La propera!',
  'game.headsOrTails.name': 'Cara o Creu',
  'game.headsOrTails.desc':
    'Endevina la moneda: escriu cara o creu abans que la llenci. Qui encerti més guanya!',
  'game.headsOrTails.intro':
    '🪙 **Cara o Creu** — {rounds} rondes. A cada ronda, escriu `cara` o `creu` abans que llenci la moneda. 1 punt per encert!',
  'game.headsOrTails.introVoice': 'Juguem a cara o creu!',
  'game.headsOrTails.round': '🪙 Ronda {n}/{total} — cara o creu? Escriu el teu pronòstic!',
  'game.headsOrTails.roundVoice': 'Cara… o creu?',
  'game.headsOrTails.heads': 'cara',
  'game.headsOrTails.tails': 'creu',
  'game.headsOrTails.resultVoice': 'Ha sortit {side}!',
  'game.headsOrTails.winners': 'Ha sortit **{side}**! Punt per a: {users}',
  'game.headsOrTails.noWinners': 'Ha sortit **{side}**! Ningú no ho ha encertat: sense punts.',
  'game.vozenSays.name': 'En Vozen Diu',
  'game.vozenSays.desc':
    "Només obeeixes quan l'ordre comença per 'En Vozen diu'. Cau en un parany i t'atrapo!",
  'game.vozenSays.intro':
    "🫡 **En Vozen Diu** — {rounds} ordres. Fes-ho NOMÉS si començo per **'En Vozen diu'**. Si no, no et moguis!",
  'game.vozenSays.prefix': 'En Vozen diu',
  'game.vozenSays.verb': 'escriviu',
  'game.vozenSays.real': '🗣️ Ronda {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Ronda {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** ha obeït primer: punt!',
  'game.vozenSays.caught': '🔴 **{user}** — no he dit En Vozen diu! Atrapat!',
  'game.vozenSays.nobody': '😴 Ningú no ha obeït **{word}** a temps. La propera!',
  'game.vozenSays.trapCleared': '😌 Era un parany: ben vist, ningú no ha caigut en **{word}**.',
  'game.roulette.name': 'Ruleta de Veritat o Atreviment',
  'game.roulette.desc':
    'Faig girar la ruleta i llegeixo un repte de veritat o atreviment en veu alta. Torna-la a executar per obtenir-ne un altre.',
  'game.roulette.header': '🎯 **La ruleta diu…**',
  'game.hangman.name': 'El Penjat',
  'game.hangman.desc': "Endevina la paraula lletra a lletra: 6 errors i s'ha acabat.",
  'game.hangman.intro':
    '🪢 **El Penjat** — escriu una lletra cada vegada per endevinar la paraula. També pots escriure la paraula sencera!',
  'game.hangman.hit': '🟢 **{user}** ha trobat la **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — no hi ha cap **{letter}**.',
  'game.hangman.wrongLetters': 'Errades: {letters}',
  'game.hangman.win': '🎉 **{user}** ho ha resolt — **{word}**!',
  'game.hangman.lose': '💀 Sense intents! La paraula era **{word}**.',
  'game.hangman.idle': '🕹️ Joc en pausa (ningú no juga). La paraula era **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Endevina la paraula de 5 lletres. 🟩 lloc correcte, 🟨 lloc equivocat, ⬛ no hi és. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — escriu una paraula de 5 lletres. Compartiu {max} intents. 🟩 lloc correcte · 🟨 lloc equivocat · ⬛ no hi és.',
  'game.wordle.guess': '🔤 **{user}** ha provat — queden **{left}** intents',
  'game.wordle.inWord': '🟢 a la paraula: {letters}',
  'game.wordle.out': '🚫 fora: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** ho ha encertat en {n} — **{word}**!',
  'game.wordle.lose': '💀 Sense intents! La paraula era **{word}**.',
  'game.wordle.idle': '🕹️ Joc en pausa (ningú no juga). La paraula era **{word}**.',
  'game.tictactoe.name': 'Tres en Ratlla',
  'game.tictactoe.desc':
    "Dos jugadors: escriu un número de l'1 al 9 per posar la teva marca. Tres en ratlla guanya.",
  'game.tictactoe.intro':
    "⭕ **Tres en Ratlla** — els dos primers jugadors a jugar són ❌ i ⭕ (❌ comença). Escriu un número de l'1 al 9 per jugar la teva casella.",
  'game.tictactoe.turn': 'Torn: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, és el torn de **{mark}**.',
  'game.tictactoe.taken': "🚫 La casella {cell} està ocupada: tria'n una altra.",
  'game.tictactoe.win': '🎉 **{user}** ({mark}) guanya!',
  'game.tictactoe.draw': '🤝 Empat!',
  'game.tictactoe.idle': '🕹️ El joc ha acabat (ningú no juga).',
  'game.chess.name': 'Escacs',
  'game.chess.desc':
    'Dos jugadors: regles reals d\'escacs (escac, enroc, promoció…). Escriu una jugada com "e4" o "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Escacs** — els dos primers jugadors a jugar són les Blanques i les Negres (les Blanques comencen). Escriu una jugada en notació algebraica ("e4", "Nf3", "O-O") o per coordenades ("e2e4"). Escriu "desistir" per rendir-te.',
  'game.chess.white': 'Blanques',
  'game.chess.black': 'Negres',
  'game.chess.seats': '⚪ Blanques: **{white}** · ⚫ Negres: **{black}**',
  'game.chess.turn': '{move} — torn: **{color}**',
  'game.chess.check': '♟️ Escac!',
  'game.chess.notYourTurn': '⏳ **{user}**, és el torn de les **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" no és una jugada legal: torna-ho a provar.',
  'game.chess.checkmate': '🏆 Escac i mat ({move})! **{user}** guanya!',
  'game.chess.draw': '🤝 Empat ({move})!',
  'game.chess.resigned': "🏳️ **{user}** s'ha rendit — **{winner}** guanya!",
  'game.chess.idle': '🕹️ El joc ha acabat (ningú no juga).',
  'game.wordChain.name': 'Cadena de Paraules',
  'game.wordChain.descr':
    "Cadena de paraules per torns en una llengua: digues una paraula que comenci per l'última lletra de l'anterior. 2 vides, sense repetir, i el rellotge accelera. Tria la llengua amb l'opció `language`. 💎 Premium.",
  'game.wordChain.unavailable':
    '⚠️ La Cadena de Paraules no està disponible en **{lang}** ara mateix (falta la llista de paraules).',
  'game.wordChain.lobby':
    "🔗 **Cadena de Paraules** en **{lang}**! Escriu qualsevol cosa en aquest canal en **{seconds}s** per unir-t'hi.",
  'game.wordChain.notEnough':
    "😴 No s'hi han unit prou jugadors (calen com a mínim 2). Joc cancel·lat.",
  'game.wordChain.begin':
    "🚀 Comencem! Jugadors: {players}. Cada paraula ha de començar per l'última lletra de l'anterior.",
  'game.wordChain.turn':
    '**{name}**, et toca! Una paraula en **{lang}** que comenci per **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — lletra següent: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Ha de començar per **{letter}**.',
  'game.wordChain.bad.short': '📏 Massa curta: com a mínim **{min}** lletres.',
  'game.wordChain.bad.repeated': "🔁 Aquesta paraula ja s'ha fet servir.",
  'game.wordChain.bad.word': '📖 No és al diccionari.',
  'game.wordChain.bad.latin': '🔤 Només compten les lletres de la A a la Z.',
  'game.wordChain.timeout': "⏰ **{name}** s'ha quedat sense temps! Queden {hearts}.",
  'game.wordChain.eliminated': '💀 **{name}** està fora!',
  'game.wordChain.winner': '🏆 **{name}** guanya la cadena! ({chain} paraules)',
  'game.stats.none': 'Encara no has jugat cap partida. Prova `/game play`!',
  'game.stats.body':
    '🎮 **Les teves estadístiques** — **{points}** punts · **{wins}** victòries · {rank}',
  'game.stats.rank': 'posició **#{rank}** de {total}',
  'game.stats.unranked': 'encara sense posició',
  'game.pickPrompt': "🎮 A quin joc vols jugar? Tria'n un:",
  'game.pickPlaceholder': 'Tria un joc…',
  'game.pickTimeout': '⏰ No has triat cap joc: torna a executar `/game play` quan vulguis.',
  'pron.listHeader': '🗣️ **Les teves pronunciacions** ({count}/{limit}):',
  'pron.listEmpty': 'Encara no en tens cap: afegeix-ne una amb `/pronunciation add`.',
  'pron.set': '✅ Desada! Quan **tu** escriguis “{term}”, jo diré “{replacement}”.',
  'pron.removed': '🗑️ “{term}” eliminada.',
  'pron.notFound':
    'No tens cap pronunciació per a “{term}”. Mira les teves amb `/pronunciation list`.',
  'pron.empty': 'La paraula i com dir-la no poden estar buides.',
  'pron.limitHit':
    "🔒 Has arribat al teu límit de **{limit}** pronunciacions. Elimina'n una amb `/pronunciation remove`.",
  'pron.limitUpsell': '💎 El Vozen Plus o Premium el puja fins a **50** → {url}',
  'pron.modalTitle': 'Ensenya una pronunciació a en Vozen',
  'pron.modalTerm': "La paraula (tal com s'escriu)",
  'pron.modalSay': 'Com ho hauria de dir en Vozen',
  'spron.listHeader': "🗣️ **Pronunciacions del servidor** ({count}/{limit}) — s'apliquen a tothom:",
  'spron.listEmpty': 'Encara cap: afegeix-ne una amb `/server-pronunciation add`.',
  'spron.set': '✅ Desada per a tot el servidor! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ “{term}” eliminada del servidor.',
  'spron.notFound': 'El servidor no té cap pronunciació per a “{term}”.',
  'spron.limitHit':
    "🔒 El servidor ha arribat al seu límit de **{limit}** pronunciacions. Elimina'n una amb `/server-pronunciation remove`.",
  'spron.modalTitle': 'Pronunciació del servidor',
  'spron.modalSay': 'Com ho diu en Vozen per a tothom',
  'rand.selectPrompt': '🎲 **Randomizer** — entre quantes opcions vols que triï?',
  'rand.selectPlaceholder': "Nombre d'opcions…",
  'rand.selectOption': '{n} opcions',
  'rand.filling': "📝 Omple el formulari que acaba d'obrir-se!",
  'rand.modalTitle': 'Randomizer — {amount} opcions',
  'rand.modalOption': 'Opció {n}',
  'rand.needTwo': 'Dóna\'m com a mínim 2 opcions separades per comes (p. ex. "pizza, sushi").',
  'rand.result': 'Entre {count} opcions, trio… **{winner}**!',
  'rand.speak': 'Trio… {winner}!',
  'rand.notInVoice': '_(entra en un canal de veu amb mi i la propera vegada ho diré en veu alta)_',
  'rand.timeout': "⏰ No s'ha triat res: torna a executar `/randomizer` quan vulguis.",
};
