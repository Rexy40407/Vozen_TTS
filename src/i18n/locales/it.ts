export default {
  'error.generic': 'Qualcosa è andato storto. Riprova.',
  'stt.guildOnly': 'La trascrizione funziona solo dentro un server.',
  'stt.noManage': 'Ti serve il permesso **Gestisci server** per avviare o fermare la trascrizione.',
  'stt.notPremium':
    '🎙️ La trascrizione dal vivo è una funzione **Premium**. Vedi `/premium info` per sbloccarla su questo server.',
  'stt.unavailable':
    'La trascrizione non è disponibile su questa istanza (il motore di riconoscimento vocale non è installato).',
  'stt.notInVoice':
    'Non sono in un canale vocale — entrane in uno ed esegui prima `/join`, poi avvia la trascrizione.',
  'stt.alreadyRunning':
    'La trascrizione è già attiva su questo server. Usa prima `/transcribe stop`.',
  'stt.atCapacity':
    'Ci sono troppe trascrizioni attive in questo momento su tutti i server. Riprova tra poco.',
  'stt.noChannel':
    'Non posso pubblicare le trascrizioni in questo canale. Prova a eseguire il comando da un normale canale testuale.',
  'stt.started':
    "✅ Trascrizione avviata. Chiunque prema **Acconsento** nell'annuncio verrà trascritto in questo canale.",
  'stt.startFailed':
    "Non sono riuscito ad avviare la trascrizione (pubblicazione dell'annuncio fallita). Ho annullato tutto — non si sta registrando niente. Riprova.",
  'stt.announceStart':
    '🎙️ **La trascrizione dal vivo è ATTIVA in questo canale.** Vengono trascritte solo le persone che acconsentono — premi il pulsante qui sotto per permettere che il tuo parlato venga scritto qui. Puoi ritirare il consenso quando vuoi con `/transcribe revoke`.',
  'stt.consentBtn': 'Acconsento a essere trascritto',
  'stt.consentThanks':
    "✅ Grazie — d'ora in poi il tuo parlato verrà trascritto su questo server. Ritira il consenso quando vuoi con `/transcribe revoke`.",
  'stt.stopped': '🛑 Trascrizione fermata.',
  'stt.notRunning': 'La trascrizione non è attiva su questo server.',
  'stt.announceStop': '🛑 **La trascrizione dal vivo è ora DISATTIVA.** Ho smesso di ascoltare.',
  'stt.revoked':
    '✅ Consenso ritirato — non verrai più trascritto su questo server. (I messaggi già pubblicati restano; cancellali su Discord se vuoi.)',
  'stt.revokeNone':
    "Non avevi acconsentito alla trascrizione su questo server, quindi non c'era niente da ritirare.",
  'privacy.eraseConfirm':
    '⚠️ Questo elimina in modo permanente **tutti** i tuoi dati Vozen su ogni server: impostazioni della voce, soprannome pronunciato, abbreviazioni e pronunce personali, compleanno salvato, punteggi dei giochi, statistiche di conversazione e opt-out. **Questa azione non può essere annullata.** Sei sicuro?',
  'privacy.erasePremiumNote':
    "_Nota: il tuo Premium/Plus a pagamento e la relativa cronologia degli acquisti vengono conservati — appartengono a te e ai registri finanziari richiesti per legge. Per interrompere il Premium, lascialo scadere o contatta l'assistenza._",
  'privacy.eraseYes': 'Elimina tutto',
  'privacy.eraseNo': 'Annulla',
  'privacy.eraseCancelled': 'Annullato — non è stato eliminato niente.',
  'privacy.eraseDone':
    '✅ Fatto. Tutti i tuoi dati personali sono stati eliminati in modo permanente.',
  'error.needManageGuild': 'Ti serve il permesso **Gestisci server** per farlo.',
  'join.needVoiceChannel': 'Entra prima in un canale vocale, poi esegui /join.',
  'join.missingPerms': 'Mi servono i permessi **Connetti** e **Parla** in {channel}.',
  'join.joined':
    '✅ Sono in {channel}! Prossimo passo: scrivi `/tts ciao` e lo leggerò ad alta voce. Vuoi che legga automaticamente un canale? Esegui /setup.',
  'join.joinedAutoread':
    '✅ Sono in {channel}! È tutto pronto. Scrivi nel canale di lettura automatica e lo leggerò ad alta voce. → {readChannel}',
  'leave.left': 'Ho lasciato il canale vocale. Alla prossima!',
  'skip.notInVoice':
    'Non sono ancora in un canale vocale — entrane in uno ed esegui prima /join, poi riprova.',
  'skip.skipped': 'Saltato.',
  'skip.nothing': 'Non sto leggendo niente al momento.',
  'shutup.notInVoice':
    'Non sono ancora in un canale vocale — entrane in uno ed esegui prima /join.',
  'shutup.nothing': 'Non sto riproducendo niente al momento.',
  'shutup.done': '🤐 Va bene, mi fermo — ho svuotato tutta la coda.',
  'tts.notInVoice':
    'Non sono ancora in un canale vocale — entrane in uno ed esegui /join, poi riprova.',
  'tts.nothingToRead': "Lì non c'è niente da leggere — inviami del testo da pronunciare.",
  'tts.nothingAfterClean':
    'Dopo aver ripulito quel testo non è rimasto niente da leggere — prova con del testo normale (lettere o parole).',
  'tts.tooFast': 'Ehi, rallenta un attimo — riprova tra poco.',
  'tts.blocked': "Quel testo contiene una parola bloccata, quindi l'ho saltato.",
  'tts.queued': 'Ricevuto — è in coda.',
  'tts.busy': 'Sono occupato in questo momento — riprova tra poco.',
  'voice.unknownModel': 'Non conosco quella voce — controlla /voice list.',
  'voice.badSpeed':
    'La velocità deve essere tra 0.5 e 2.0 (1.0 è normale). Prova `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ La tua voce è ora **{name}** a {speed}×. Prova `/tts ciao` per ascoltarla. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Configurazione della voce** — scegli le opzioni qui sotto, poi premi **Salva**. Nulla cambierà fino ad allora.',
  'voice.config.summary': 'Selezione attuale: **{voice}** · motore **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Lingua…',
  'voice.config.pickVoice': 'Voce…',
  'voice.config.pickEngine': 'Motore…',
  'voice.config.pickSpeed': 'Velocità…',
  'voice.config.more': '▼ Altre lingue',
  'voice.config.engDefault': 'Predefinito (locale)',
  'voice.config.save': 'Salva',
  'voice.config.cancel': 'Annulla',
  'voice.config.cancelled': 'Configurazione annullata — non è cambiato nulla.',
  'voice.config.expired': 'Il pannello è scaduto — esegui di nuovo `/voice config` per continuare.',
  'voice.listHeader': 'Voci disponibili:',
  'voice.listEmpty': '(nessuna installata)',
  'voice.reset':
    "✅ La tua voce è tornata a quella predefinita. Scegline un'altra quando vuoi con `/voice list` e `/voice set`.",
  'voice.detection.on':
    '✅ Rilevamento automatico della lingua ATTIVO: ogni messaggio viene letto con una voce della lingua rilevata (chi parla può cambiare). Disattivalo con `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Rilevamento automatico della lingua DISATTIVO: la tua unica voce fissa legge tutto, così suoni sempre uguale.',
  'voice.optout': 'Non verrai più letto automaticamente. Esegui /voice opt-in per riattivarlo.',
  'voice.optin': 'Verrai di nuovo letto automaticamente.',
  'voice.nickname.set': '✅ Vozen ora ti chiamerà **{name}** ad alta voce.',
  'voice.nickname.cleared':
    '✅ Soprannome pronunciato rimosso — Vozen userà il tuo nome del server.',
  'voice.nickname.invalid':
    'Quel nome non ha niente di leggibile da pronunciare ad alta voce. Prova con lettere o numeri.',
  'voice.effect.set':
    "✅ Effetto voce impostato su **{effect}** — i tuoi messaggi ora vengono riprodotti con quell'effetto. Usa `/voice effect none` per disattivarlo.",
  'voice.effect.cleared': '✅ Effetto voce rimosso — di nuovo voce pulita.',
  'voice.effect.locked':
    '🔒 **{effect}** è un effetto Premium. Effetti gratuiti: 🤖 Robot ed 🔊 Echo. Sbloccali tutti con Vozen Premium — vedi `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** è un motore vocale Premium. Sbloccalo con Vozen Plus (personale) o Vozen Premium (server) — vedi `/premium`. Nel frattempo la tua voce resta sul motore locale gratuito.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** è un motore vocale Premium. Sbloccalo con Vozen Plus (personale) o Vozen Premium (server) — vedi `/premium`. Nel frattempo la tua voce resta sul motore locale gratuito.',
  'voice.notInVoice': 'Non sono ancora in un canale vocale — esegui prima /join.',
  'voice.previewPlaying': 'Riproduco un campione…',
  'preview.sample': 'Ciao, sono Vozen. Scrivilo, ascoltalo.',
  'laugh.playing': 'Ahah! Lo riproduco nella tua voce…',
  'joke.playing': 'Racconto una barzelletta…\n> {joke}',
  'joke.unknownLang': 'Non conosco quella lingua. Scegline una dalla lista.',
  'rizz.playing': "😏 Lancio un po' di rizz…\n> {line}",
  'rizz.unknownLang': 'Non conosco quella lingua. Scegline una dalla lista.',
  'rizz.locked':
    '🔒 **/rizz** è un extra Premium. Sbloccalo con Vozen Plus (tu) o Premium (questo server). Vedi `/premium`.',
  'sound.playing': '🔊 Riproduco **{name}**…',
  'sound.unknown': 'Non ho quel suono. Esegui `/sound` per vedere la lista.',
  'sound.list':
    '🔊 **Suoni:** {sounds}\nRiproducine uno con `/sound name:<sound>` (devo essere nel tuo canale vocale).',
  'sound.disabled':
    '🔇 La soundboard è **disattivata** su questo server. Un amministratore può attivarla con `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Compleanno salvato: **{day}/{month}**. Ti farò gli auguri quando entrerai in un canale vocale quel giorno!',
  'birthday.invalid': 'Quella non è una data valida. Controlla il giorno e il mese.',
  'birthday.cleared': '🎂 Compleanno rimosso.',
  'birthday.show': '🎂 Il tuo compleanno è impostato al **{day}/{month}**.',
  'birthday.none': 'Non hai ancora impostato un compleanno. Usa `/birthday set`.',
  'topspeakers.title': '🗣️ **Chiacchieroni** — chi leggo di più su questo server:',
  'topspeakers.empty':
    'Non ho ancora letto i messaggi di nessuno. Configura un canale di lettura con `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** messaggi · 🔥 serie di {streak} giorni',
  'serverstats.title': '📊 **Statistiche del server**',
  'serverstats.empty':
    'Ancora nessuna statistica — non ho letto messaggi né avviato giochi qui. Configura con `/setup`!',
  'serverstats.messages': '🗣️ **{total}** messaggi letti · **{speakers}** persone',
  'serverstats.topTalkers': '**Più chiacchieroni:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} msg · 🔥 {streak}g',
  'serverstats.streak': '🔥 Serie attiva più lunga: **{days}** giorni',
  'serverstats.games':
    '🎮 **{points}** punti di gioco · **{wins}** vittorie · **{players}** giocatori',
  'serverstats.topPlayers': '**Migliori giocatori:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pt · {wins} vittorie',
  'serverstats.upsell':
    "🔒 Questa è l'anteprima gratuita. Il **Premium** sblocca le serie, le statistiche di gioco e la top 5 completa — vedi `/premium`.",
  'streak.day':
    '🔥 <@{user}> ha una serie di **{n} giorni**! Continua a parlare per non interromperla.',
  'leaderboard.autoTitle': '🏆 I più chiacchieroni di questo server',
  'premium.title': '💎 **Stato di Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Server:** Premium fino al {date}',
  'premium.lineServerFree': '🖥️ **Server:** piano Free',
  'premium.lineUserActive': '👤 **Tu (Plus):** attivo fino al {date}',
  'premium.lineUserFree': '👤 **Tu (Plus):** non attivo',
  'premium.getHint':
    'Tutto ciò che usi oggi resta gratis. Il Premium aggiunge tutti gli 8 effetti voce, il 24/7 in chiamata, 50 pronunce personali, /rizz e i giochi premium. Supporto: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Il tuo pass Premium:** {used}/{total} licenze in uso · scade il {date}',
  'premium.passServers': '↳ In uso su: {servers}',
  'premium.pitch':
    "Non hai ancora il Premium. **Vozen Premium** (€3.99/mese per 3 server, o €7.99/mese per 8) sblocca per l'intero server: tutti gli 8 effetti voce, il 24/7 in chiamata, 50 pronunce personali (invece di 3), il comando /rizz e i giochi premium (Catena di Parole, Wordle, Scacchi). **Vozen Plus** (€1.99/mese) ti dà quegli extra a livello personale, su qualsiasi server.",
  'premium.buyHint':
    "▶ **Ottieni Premium:** {link}\nDopo l'acquisto, esegui `/premium activate` sul server che vuoi.",
  'premium.confirmActivate':
    'Usare **1 delle tue {total} licenze Premium** su **questo server**? Ne hai **{used}** in uso adesso. Puoi liberarla più tardi con `/premium deactivate` — in ogni caso il conto alla rovescia del pass continua.',
  'premium.confirmYes': '💎 Usa una licenza',
  'premium.confirmNo': 'Annulla',
  'premium.activateOk':
    '✅ Il Premium è ora attivo su **questo server** fino al {date}. Licenze: **{used}/{total}** in uso.',
  'premium.activateCancelled': 'Annullato — non è stata usata alcuna licenza.',
  'premium.activateTimeout': 'Tempo scaduto — non è stata usata alcuna licenza.',
  'premium.noPass':
    'Non hai un pass Premium attivo. Acquistane uno e arriverà sul tuo account — poi esegui `/premium activate` qui.\n▶ {link}',
  'premium.alreadyActive': 'Questo server ha già una delle tue licenze Premium. Niente da fare.',
  'premium.noSeats':
    'Tutte le tue **{total}** licenze Premium sono in uso ({servers}). Liberane una con `/premium deactivate` lì, poi riprova qui.',
  'premium.needManageGuild':
    "Attivare il Premium riguarda l'intero server — solo i membri con **Gestisci server** possono farlo. Chiedi a un amministratore.",
  'premium.deactivateOk':
    '✅ Licenza Premium di questo server liberata. Usala su un altro server con `/premium activate`.',
  'premium.deactivateNone': 'Questo server non ha nessuna tua licenza Premium da liberare.',
  'premium.thisServer': 'questo server',
  'grant.denied': '⛔ Questo comando è solo per il proprietario del bot.',
  'grant.okPremium':
    '✅ Concesso a <@{user}> un **pass Premium** ({seats} licenze) per **{days}** giorni — scade il {date}. Lo attiva con `/premium activate`.',
  'grant.okPlus': '✅ Concesso a <@{user}> **Vozen Plus** per **{days}** giorni — scade il {date}.',
  'gencode.done':
    '✅ Generati **{count}** codici {plan}, **{days}** giorni ciascuno. Condividili in privato:\n{list}',
  'redeem.okPlus':
    '🎁 Riscattato! Hai ottenuto **Vozen Plus** per **{days}** giorni — scade il {date}.',
  'redeem.okPremium':
    '🎁 Riscattato! Hai ottenuto un **pass Premium** ({seats} licenze) per **{days}** giorni — scade il {date}. Attivalo nel tuo server con `/premium activate`.',
  'redeem.notFound': '❌ Quel codice non esiste. Ricontrollalo e riprova.',
  'redeem.used': '❌ Quel codice è già stato riscattato.',
  'redeem.expired': '❌ Quel codice è scaduto.',
  'voice.abbrev.added': 'Ricevuto — {term} verrà letto come {replacement}.',
  'voice.abbrev.removed': 'Ho rimosso la tua abbreviazione per {term}.',
  'voice.abbrev.listHeader': 'Le tue abbreviazioni personali ({count}/{cap} usate):',
  'voice.abbrev.listEmpty': '(nessuna ancora — aggiungine una con /voice abbrev add)',
  'voice.abbrev.capReached':
    "Hai raggiunto il limite di {cap} abbreviazioni personali. Rimuovine una prima di aggiungerne un'altra.",
  'voice.abbrev.invalidTerm':
    'Il termine deve essere una sola parola (solo lettere e cifre), fino a 50 caratteri.',
  'voice.abbrev.emptyReplacement': 'La lettura non può essere vuota.',
  'voice.abbrev.tooLong': 'La lettura è troppo lunga (massimo 200 caratteri).',
  'config.wordEmpty': 'La parola non può essere vuota.',
  'config.blocked': 'Bloccata: {word}.',
  'config.blockLimit':
    "Questo server ha già il massimo di {max} parole bloccate. Rimuovine una prima di aggiungerne un'altra.",
  'config.unblocked': 'Sbloccata: {word}.',
  'config.pronListHeader': 'Dizionario di pronuncia:',
  'config.pronEmptyValue': '(vuoto)',
  'config.listEmpty': '(nessuno)',
  'config.termEmpty': 'Il termine non può essere vuoto.',
  'config.pronEmpty': 'La pronuncia non può essere vuota.',
  'config.pronSet': 'Ricevuto — {term} verrà letto come {replacement}.',
  'config.pronRemoved': 'Ho rimosso la pronuncia per {term}.',
  'config.channelWrongType': 'Scegli un canale testuale (non un canale vocale né una categoria).',
  'config.channelNoAccess': 'Non riesco a vedere {channel} — controlla i miei permessi lì.',
  'config.channelSet':
    'Canale di lettura automatica impostato su {channel}. Ora: assicurati che la lettura automatica sia attiva con `/config auto-read active:true`.',
  'config.autoreadOn': 'La lettura automatica è ora **attiva**.',
  'config.autoreadOff': 'La lettura automatica è ora **disattivata**.',
  'config.maxCharsRange': 'Il valore di caratteri massimi deve essere tra 1 e 2000.',
  'config.maxCharsSet': 'Caratteri massimi per messaggio impostati su {value}.',
  'config.rateLimitRange': 'Il valore del limite di frequenza deve essere tra 1 e 120.',
  'config.rateLimitSet': 'Limite di frequenza impostato su {value} messaggi al minuto.',
  'config.roleSet': 'La lettura automatica è ora limitata ai membri con {role}.',
  'config.roleCleared': 'Restrizione di ruolo rimossa — ora tutti possono essere letti.',
  'config.enabledOn': 'Il TTS è ora **attivo** per questo server.',
  'config.enabledOff': 'Il TTS è ora **disattivato** per questo server.',
  'config.xsaidOn':
    'Vozen ora annuncerà **chi ha parlato** prima di ogni messaggio (es. "Alex ha detto ciao"). Disattivalo con `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **non** annuncerà più chi ha parlato — legge solo il messaggio.',
  'config.autojoinOn':
    '✅ Auto-ingresso **attivo** — Vozen entrerà nel tuo canale vocale quando scrivi nel canale TTS.',
  'config.autojoinOff': 'Auto-ingresso **disattivato** — usa `/join` per portare Vozen in vocale.',
  'config.stayOn':
    '✅ 24/7 in chiamata **attivo** — Vozen resterà nel canale vocale anche quando si svuota, e tornerà dopo i riavvii. 💎 Serve il Premium perché abbia effetto (acquista o `/redeem` un codice, poi `/premium activate`).',
  'config.stayOff':
    '24/7 in chiamata **disattivato** — Vozen esce quando il canale vocale si svuota (predefinito).',
  'config.readBotsOn': '✅ Vozen ora leggerà anche i messaggi di **altri bot e webhook**.',
  'config.readBotsOff':
    'Vozen **ignorerà** gli altri bot e webhook (vengono lette solo le persone reali).',
  'config.textInVoiceOn':
    '✅ Vozen leggerà anche la **chat testuale dentro il suo canale vocale**.',
  'config.textInVoiceOff':
    'Vozen **non** leggerà la chat testuale del canale vocale (solo il canale TTS).',
  'config.antispamOn':
    '✅ Anti-spam **attivo** — Vozen non leggerà i messaggi spam (ripetizione di massa di parole o lo stesso messaggio lungo pubblicato più volte).',
  'config.antispamOff': 'Anti-spam **disattivato** — Vozen legge ogni messaggio come al solito.',
  'config.streaksOn':
    '✅ Avvisi delle serie **attivi** — Vozen mostra un messaggio serie 🔥 la prima volta che ogni persona parla ogni giorno.',
  'config.streaksOff':
    'Avvisi delle serie **disattivati** — Vozen continua a contare le serie (vedi `/top-speakers`) ma non le annuncia.',
  'config.soundboardOn': 'Soundboard **attiva** — chiunque può riprodurre clip con `/sound`.',
  'config.soundboardOff': 'Soundboard **disattivata** — `/sound` è disabilitato su questo server.',
  'config.votePromosLabel': 'Avvisi premio top.gg + Vozen Support',
  'config.greetOn': '✅ Saluterò le persone per nome quando entrano nel canale vocale.',
  'config.greetOff': '🔇 **Non** saluterò le persone quando entrano nel canale vocale.',
  'config.greetLangSet': "✅ Lingua del saluto d'ingresso impostata su **{language}**.",
  'config.defaultVoiceSet':
    '✅ Voce predefinita del server impostata su **{name}**. I membri senza una voce propria sentiranno questa. (id: `{model}`)',
  'config.reset':
    'Configurazione ripristinata ai valori predefiniti. La tua lista di blocco e le pronunce sono state mantenute.',
  'config.showTitle': '**Configurazione del server**',
  'config.showChannel': 'Canale TTS: {value}',
  'config.showAutoread': 'Lettura automatica: {value}',
  'config.showRole': 'Ruolo: {value}',
  'config.showEnabled': 'Attivo: {value}',
  'config.showXsaid': 'Annuncia chi parla (xsaid): {value}',
  'config.showAutojoin': 'Auto-ingresso: {value}',
  'config.showReadBots': 'Leggi bot/webhook: {value}',
  'config.showTextInVoice': 'Testo-in-vocale: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': "Saluto all'ingresso: {value} ({language})",
  'config.showVoice': 'Voce predefinita: {value}',
  'config.showMaxChars': 'Caratteri massimi: {value}',
  'config.showRateLimit': 'Limite di frequenza: {value}/min',
  'config.showBlocklist': 'Lista di blocco: {count} parole',
  'config.showPronunciation': 'Pronunce: {count} voci',
  'config.valueNone': '(nessuno)',
  'config.valueAny': 'chiunque',
  'config.valueAutoDetect': '(rilevamento automatico)',
  'config.on': 'attivo',
  'config.off': 'disattivato',
  'config.language.set': "Lingua dell'interfaccia impostata su {language}.",
  'config.language.unsupported': 'Quella lingua non è ancora supportata.',
  'setup.noChannel':
    'Non sono riuscito a capire quale canale usare. Indica un canale testuale nell\'opzione "channel".',
  'setup.channelWrongType':
    'Il canale di lettura automatica deve essere un canale testuale (non un canale vocale né una categoria). Indicane uno nell\'opzione "channel".',
  'setup.done': '**Tutto pronto — Vozen è operativo.**',
  'setup.channelLine': 'Canale di lettura automatica: {channel}',
  'setup.autoreadOn': 'Lettura automatica: attiva',
  'setup.permsHeader': '**Permessi:**',
  'setup.permView': 'ViewChannel (vedere il canale testuale)',
  'setup.permSend': 'SendMessages (scrivere nel canale testuale)',
  'setup.permConnect': 'Connect (entrare nel canale vocale)',
  'setup.permSpeak': 'Speak (parlare nel canale vocale)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — mancante',
  'setup.permUnchecked': '⏳ {label} — non ancora verificato (lo controllerò con /join)',
  'setup.fixHint':
    'Per sistemare ciò che manca: nelle impostazioni del server apri il ruolo di Vozen (o i permessi del canale) e attiva le voci contrassegnate con ❌.',
  'setup.voiceUncheckedNote':
    'Non sei in un canale vocale, quindi non ho ancora potuto verificare Connect/Speak — li controllerò quando esegui /join.',
  'setup.allGood': 'È tutto pronto. Entra in un canale vocale ed esegui /join.',
  'setup.joinedVoice': 'Sono entrato anche in {channel} — non serve eseguire /join.',
  'setup.readyTalk':
    'È tutto pronto. Scrivi nel canale di lettura automatica e lo leggerò ad alta voce.',
  'setup.membersHeader': '**Spiega ai tuoi membri (i 3 passaggi):**',
  'setup.membersBody':
    '1) Entra in un canale vocale\n2) Esegui /join così entro con te\n3) Scrivi in questo canale (o usa /tts) e lo leggo ad alta voce\nLista completa dei comandi: /help',
  'stats.title': '**Statistiche di Vozen**',
  'stats.messagesSpoken': 'Messaggi pronunciati: {value}',
  'stats.cacheHits': 'Hit della cache: {value}',
  'stats.cacheMisses': 'Miss della cache: {value}',
  'stats.synthErrors': 'Errori di sintesi: {value}',
  'stats.synthLatency': 'Latenza di sintesi: p50 {p50}ms / p95 {p95}ms ({count} campioni)',
  'stats.voiceDrops': 'Cadute vocali: {value}',
  'stats.voiceReconnects': 'Riconnessioni: {value}',
  'stats.votes': 'Voti su top.gg: {value}',
  'stats.activePlayers': 'Player attivi: {value}',
  'stats.servers': 'Server: {value}',
  'stats.uptime': 'Tempo di attività: {value}s',
  'speak.emptyMessage': 'Quel messaggio non ha testo da leggere ad alta voce.',
  'uptime.text': '🟢 Vozen è online da **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistiche**',
  'botstats.servers': 'Server: **{value}**',
  'botstats.voiceSessions': 'Sessioni vocali ora: **{value}**',
  'botstats.messagesSpoken': 'Messaggi pronunciati: **{value}**',
  'botstats.uptime': 'Online da: **{value}**',
  'invite.noClientId':
    "Il link di invito di Vozen non è ancora configurato (manca CLIENT_ID). Avvisa l'amministratore del bot.",
  'invite.link': 'Aggiungi Vozen al tuo server:\n{url}',
  'vote.noClientId':
    "Il link di voto di Vozen non è ancora configurato (manca CLIENT_ID). Avvisa l'amministratore del bot.",
  'vote.link':
    'Vota Vozen (gratis, ogni 12h) e aiuta più persone a scoprirlo:\n{url}\nSe questo account non ha mai riscattato la ricompensa, riceve **48 ore di Vozen Plus**, una sola volta per account.',
  'invite.button': 'Aggiungi Vozen',
  'vote.button': 'Vota su top.gg',
  'vote.upsell':
    '🗳️ Se questo account non ha mai riscattato la ricompensa, riceve **48 ore di Vozen Plus**, una sola volta per account. {url}',
  'vote.cooldownStatus':
    '🗳️ Questo account ha già utilizzato la ricompensa di voto una tantum. Puoi continuare a votare per sostenere Vozen, ma non riceverai altro Plus.',
  'help.title': 'Vozen — scrivilo, ascoltalo.',
  'help.embedTitle': 'Vozen — Comandi',
  'help.intro':
    'Vozen legge il tuo testo ad alta voce nei canali vocali — voci neurali gratuite, decine di lingue.',
  'help.quickStartTitle': 'Avvio rapido (3 passaggi)',
  'help.quickStartBody':
    '1) Entra in un canale vocale, poi esegui /join\n2) Scrivi nel canale testuale (o usa /tts Ciao a tutti!)\n3) (facoltativo) Scegli una voce con /voice set',
  'help.groupStarted': 'Per iniziare',
  'help.groupStartedBody':
    '• /join — entro nel tuo canale vocale\n• /leave — lascio il canale vocale\n• /tts <testo> — leggo il testo ad alta voce · es. /tts Ciao a tutti!\n• /skip — salta ciò che sto leggendo in questo momento',
  'help.groupVoice': 'La tua voce',
  'help.groupVoiceBody':
    '• /voice set <model> — scegli la tua voce · es. /voice set en_US-amy-medium\n• /voice list — vedi le voci disponibili\n• /voice preview — ascolta un campione della tua voce\n• /voice reset — torna alla voce predefinita\n• /voice opt-out · /voice opt-in — disattiva / attiva la lettura automatica per te\n• /voice abbrev add|remove|list — slang personale, letto a modo tuo (fino a 10)',
  'help.groupFun': 'Divertimento',
  'help.groupFunBody':
    '• /joke — racconto una barzelletta breve (scegli una lingua + risata facoltativa) · es. /joke English\n• /laugh — rido ad alta voce nella tua voce attuale',
  'help.groupAdmin': 'Amministrazione server (serve Gestisci server)',
  'help.groupAdminBody':
    '• /setup — configurazione guidata in un passaggio · esegui prima questo\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · es. /config tts-channel #generale\n• /stats — statistiche del bot',
  'help.groupMore': 'Altro',
  'help.groupMoreBody':
    '• /invite — aggiungi Vozen a un altro server\n• /vote — vota Vozen su top.gg\n• /help — mostra questo aiuto',
  'help.footer': 'Sei nuovo qui? Esegui {command} per iniziare.',
  'help.support': '🛟 Ti serve aiuto o vuoi segnalare un problema? {url}',
  'help.source': '📄 Open source (AGPL-3.0) — ottieni il codice esatto in esecuzione qui: {url}',
  'welcome.title': 'Grazie per aver aggiunto Vozen! 👋',
  'welcome.description':
    'Vozen legge la tua chat ad alta voce nei canali vocali — scrivilo, ascoltalo.\n\n**Inizia in un solo passaggio:** esegui {setup} e configurerò la lettura automatica ed entrerò nel tuo canale vocale.\n\nTi serve la lista completa dei comandi? Esegui {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Come lo usano i membri (3 passaggi)',
  'welcome.stepsBody':
    '1) Entra in un canale vocale\n2) Esegui /join così entro con te\n3) Scrivi nel canale testuale (o usa /tts) e lo leggo ad alta voce\nLista completa dei comandi: /help',
  'welcome.footer': 'Vozen — scrivilo, ascoltalo.',
  'welcome.tagline': 'Voce neurale naturale — gratis per sempre, nessun paywall.',
  'game.start.needVoice':
    'Questo è un **gioco vocale** — entra in un canale vocale ed esegui prima /join, poi avvialo.',
  'game.start.alreadyActive':
    "C'è già un gioco in corso in <#{channel}>. Finiscilo (o usa `/game stop`) prima di iniziarne un altro.",
  'game.start.premiumLocked':
    '🔒 **{game}** è un gioco Premium (costa potenza di calcolo vera). Vedi `/premium`.',
  'game.start.started': '🎮 Avvio **{game}**! Occhio al canale — buona fortuna!',
  'game.start.startedThread':
    '🎮 **{game}** è iniziato in <#{channel}> — unitevi lì! Il thread si autoelimina quando il gioco finisce.',
  'game.thread.winner': '🏆 {winner} ha vinto la partita!',
  'game.thread.ended': '🎮 La partita è finita.',
  'game.unknownGame': 'Non conosco quel gioco. Scegline uno dalla lista.',
  'game.stop.ok': '🛑 Gioco attuale interrotto.',
  'game.stop.none': "Non c'è nessun gioco in corso al momento.",
  'game.list.title': '🎮 **Giochi** — avviane uno con `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Classifica** — i migliori giocatori di questo server:',
  'game.leaderboard.empty': 'Non è ancora stato giocato niente. Sii il primo — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pt ({wins} vittorie)',
  'game.finish.title': '🏁 **Fine del gioco!** Punteggi finali:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Fine del gioco — nessuno ha segnato stavolta. Alla prossima!',
  'game.finish.winnerVoice': '{user} vince!',
  'game.guessLanguage.name': 'Indovina la Lingua',
  'game.guessLanguage.desc':
    'Leggo una frase in una lingua a caso — il primo a indovinarla si prende il punto.',
  'game.guessLanguage.intro':
    '🗣️ **Indovina la Lingua** — leggerò {rounds} frasi. Scrivi che lingua senti. La risposta corretta più veloce vince ogni round!',
  'game.guessLanguage.round': '🎧 Round {n}/{total} — ascolta…',
  'game.guessLanguage.correct': '✅ **{user}** ha indovinato — era **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Tempo scaduto! Era **{language}**.',
  'game.guessLanguage.noLanguages':
    'Non ho abbastanza voci installate per giocarci. Chiedi a un amministratore di aggiungerne altre.',
  'game.math.name': 'Calcolo Mentale',
  'game.math.desc': "Dico un'operazione ad alta voce — il primo a scrivere il risultato vince.",
  'game.math.intro':
    '🔢 **Calcolo Mentale** — {rounds} operazioni. Ascolta e scrivi il risultato il più in fretta possibile!',
  'game.math.round': '🧮 Round {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** ci ha preso — il risultato era **{answer}**!',
  'game.math.timeout': '⏱️ Tempo scaduto! Il risultato era **{answer}**.',
  'game.math.plus': 'più',
  'game.math.minus': 'meno',
  'game.math.times': 'per',
  'game.skipCount.name': 'Numero Mancante',
  'game.skipCount.desc': 'Conto ad alta voce ma salto un numero — il primo a beccarlo vince.',
  'game.skipCount.intro':
    '🔢 **Numero Mancante** — conto, ma ne salto uno. Scrivi il numero che manca! ({rounds} round)',
  'game.skipCount.round': '👂 Round {n}/{total} — quale numero ho saltato?',
  'game.skipCount.correct': "✅ **{user}** l'ha beccato — ho saltato **{answer}**!",
  'game.skipCount.timeout': '⏱️ Tempo scaduto! Ho saltato **{answer}**.',
  'game.spelling.name': 'Dettato',
  'game.spelling.desc': 'Dico una parola — il primo a scriverla correttamente vince.',
  'game.spelling.intro': '✍️ **Dettato** — dirò {rounds} parole. Scrivi ciascuna in modo corretto!',
  'game.spelling.round': '🗣️ Round {n}/{total} — scrivi la parola che dico…',
  'game.spelling.correct': '✅ **{user}** ha scritto **{word}** correttamente!',
  'game.spelling.timeout': '⏱️ Tempo scaduto! La parola era **{word}**.',
  'game.spelling.empty':
    'Non ho ancora una lista di parole per la lingua della voce di questo server.',
  'game.spellOut.name': 'Ricomponi la Parola',
  'game.spellOut.desc':
    'Compito una parola lettera per lettera — il primo a scrivere la parola intera vince.',
  'game.spellOut.intro':
    '🔡 **Ricomponi la Parola** — compito {rounds} parole lettera per lettera. Scrivi la parola completa!',
  'game.spellOut.round': '🔤 Round {n}/{total} — ascolta le lettere…',
  'game.spellOut.correct': '✅ **{user}** ha indovinato — **{word}**!',
  'game.spellOut.timeout': '⏱️ Tempo scaduto! Era **{word}**.',
  'game.fastSpeech.name': 'Parlata Veloce',
  'game.fastSpeech.desc':
    'Leggo una frase super veloce — il primo a scrivere quello che ho detto vince.',
  'game.fastSpeech.intro':
    '💨 **Parlata Veloce** — {rounds} frasi a velocità assurda. Scrivi quello che senti!',
  'game.fastSpeech.round': '⚡ Round {n}/{total} — arriva, veloce!',
  'game.fastSpeech.correct': "✅ **{user}** l'ha decifrata: “{phrase}”",
  'game.fastSpeech.timeout': '⏱️ Tempo scaduto! Era: “{phrase}”',
  'game.fastSpeech.empty': 'Non ho ancora frasi per la lingua della voce di questo server.',
  'game.accentSwap.name': 'Accento Buffo',
  'game.accentSwap.desc': 'Dico una parola con un accento straniero — il primo a scriverla vince.',
  'game.accentSwap.intro':
    "🎭 **Accento Buffo** — {rounds} parole dette con l'accento sbagliato. Scrivi la parola!",
  'game.accentSwap.round': '🌍 Round {n}/{total} — che parola sto cercando di dire?',
  'game.accentSwap.correct': '✅ **{user}** ha indovinato — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Tempo scaduto! La parola era **{word}**.',
  'game.reflexes.name': 'Riflessi',
  'game.reflexes.desc':
    'Faccio il conto alla rovescia, poi grido VIA — il primo a scrivere dopo vince. Non partire in anticipo!',
  'game.reflexes.intro':
    '⚡ **Riflessi** — {rounds} round. Quando grido **VIA**, scrivi qualsiasi cosa il più in fretta possibile. Se scrivi prima del VIA è falsa partenza!',
  'game.reflexes.ready': '🚦 Round {n}/{total} — preparati…',
  'game.reflexes.countdown': 'tre… due… uno…',
  'game.reflexes.go': '🟢 **VIA!!!**',
  'game.reflexes.goVoice': 'Via!',
  'game.reflexes.tooSoon': '🔴 **{user}** è partito in anticipo — troppo presto!',
  'game.reflexes.win': '⚡ **{user}** è il più veloce! Punto!',
  'game.reflexes.tooSlow': '😴 Nessuno ha reagito in tempo. Avanti!',
  'game.headsOrTails.name': 'Testa o Croce',
  'game.headsOrTails.desc':
    'Indovina il lancio della moneta — scrivi testa o croce prima che la lanci. Chi indovina di più vince!',
  'game.headsOrTails.intro':
    '🪙 **Testa o Croce** — {rounds} round. In ogni round, scrivi `testa` o `croce` prima che lanci la moneta. 1 punto per ogni indovinata!',
  'game.headsOrTails.introVoice': 'Giochiamo a testa o croce!',
  'game.headsOrTails.round': '🪙 Round {n}/{total} — testa o croce? Scrivi il tuo pronostico!',
  'game.headsOrTails.roundVoice': 'Testa… o croce?',
  'game.headsOrTails.heads': 'testa',
  'game.headsOrTails.tails': 'croce',
  'game.headsOrTails.resultVoice': 'È {side}!',
  'game.headsOrTails.winners': 'È **{side}**! Punto per: {users}',
  'game.headsOrTails.noWinners': "È **{side}**! Nessuno l'ha indovinato — niente punti.",
  'game.vozenSays.name': 'Vozen Dice',
  'game.vozenSays.desc':
    "Obbedisci solo quando l'ordine inizia con 'Vozen dice'. Cadi in una trappola e sei fregato!",
  'game.vozenSays.intro':
    "🫡 **Vozen Dice** — {rounds} ordini. Eseguili SOLO se inizio con **'Vozen dice'**. Altrimenti, non ti muovere!",
  'game.vozenSays.prefix': 'Vozen dice',
  'game.vozenSays.verb': 'scrivete',
  'game.vozenSays.real': '🗣️ Round {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Round {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** ha obbedito per primo — punto!',
  'game.vozenSays.caught': '🔴 **{user}** — non ho detto Vozen dice! Fregato!',
  'game.vozenSays.nobody': '😴 Nessuno ha obbedito a **{word}** in tempo. Avanti!',
  'game.vozenSays.trapCleared':
    "😌 Era una trappola — ben visto, nessuno c'è cascato con **{word}**.",
  'game.roulette.name': 'Roulette Obbligo o Verità',
  'game.roulette.desc':
    'Giro la roulette e leggo ad alta voce un obbligo o una verità. Rilancia per un altro.',
  'game.roulette.header': '🎯 **La roulette dice…**',
  'game.hangman.name': 'Impiccato',
  'game.hangman.desc': 'Indovina la parola una lettera alla volta — 6 errori e finisce.',
  'game.hangman.intro':
    '🪢 **Impiccato** — scrivi una lettera alla volta per indovinare la parola. Puoi anche provare la parola intera!',
  'game.hangman.hit': '🟢 **{user}** ha trovato la **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — niente **{letter}**.',
  'game.hangman.wrongLetters': 'Sbagliate: {letters}',
  'game.hangman.win': "🎉 **{user}** l'ha risolta — **{word}**!",
  'game.hangman.lose': '💀 Tentativi finiti! La parola era **{word}**.',
  'game.hangman.idle': '🕹️ Gioco in pausa (nessuno gioca). La parola era **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    "Indovina la parola di 5 lettere. 🟩 posto giusto, 🟨 posto sbagliato, ⬛ non c'è. 💎 Premium.",
  'game.wordle.intro':
    "🟩 **Wordle** — scrivi una parola di 5 lettere. Condividete {max} tentativi. 🟩 posto giusto · 🟨 posto sbagliato · ⬛ non c'è.",
  'game.wordle.guess': '🔤 **{user}** ha tentato — restano **{left}** tentativi',
  'game.wordle.inWord': '🟢 nella parola: {letters}',
  'game.wordle.out': '🚫 fuori: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** ha indovinato in {n} — **{word}**!',
  'game.wordle.lose': '💀 Tentativi finiti! La parola era **{word}**.',
  'game.wordle.idle': '🕹️ Gioco in pausa (nessuno gioca). La parola era **{word}**.',
  'game.tictactoe.name': 'Tris',
  'game.tictactoe.desc':
    'Due giocatori — scrivi un numero 1-9 per piazzare il tuo segno. Tre in fila vince.',
  'game.tictactoe.intro':
    '⭕ **Tris** — i primi due giocatori a muovere sono ❌ e ⭕ (inizia ❌). Scrivi un numero 1-9 per giocare la tua casella.',
  'game.tictactoe.turn': 'Turno: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, è il turno di **{mark}**.',
  'game.tictactoe.taken': "🚫 La casella {cell} è occupata — scegline un'altra.",
  'game.tictactoe.win': '🎉 **{user}** ({mark}) vince!',
  'game.tictactoe.draw': '🤝 È pareggio!',
  'game.tictactoe.idle': '🕹️ Gioco terminato (nessuno gioca).',
  'game.chess.name': 'Scacchi',
  'game.chess.desc':
    'Due giocatori — regole vere degli scacchi (scacco, arrocco, promozione…). Scrivi una mossa tipo "e4" o "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Scacchi** — i primi due giocatori a muovere sono il Bianco e il Nero (inizia il Bianco). Scrivi una mossa in notazione algebrica ("e4", "Nf3", "O-O") o in coordinate ("e2e4"). Scrivi "abbandono" per arrenderti.',
  'game.chess.white': 'Bianco',
  'game.chess.black': 'Nero',
  'game.chess.seats': '⚪ Bianco: **{white}** · ⚫ Nero: **{black}**',
  'game.chess.turn': '{move} — turno: **{color}**',
  'game.chess.check': '♟️ Scacco!',
  'game.chess.notYourTurn': '⏳ **{user}**, è il turno del **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" non è una mossa valida — riprova.',
  'game.chess.checkmate': '🏆 Scacco matto ({move})! **{user}** vince!',
  'game.chess.draw': '🤝 È pareggio ({move})!',
  'game.chess.resigned': '🏳️ **{user}** ha abbandonato — **{winner}** vince!',
  'game.chess.idle': '🕹️ Gioco terminato (nessuno gioca).',
  'game.wordChain.name': 'Catena di Parole',
  'game.wordChain.descr':
    "Catena di parole a turni in una lingua: di' una parola che inizia con l'ultima lettera della precedente. 2 vite, senza ripetere, e il tempo accelera. Scegli la lingua con l'opzione `language`. 💎 Premium.",
  'game.wordChain.unavailable':
    '⚠️ Catena di Parole non è disponibile in **{lang}** al momento (manca la lista di parole).',
  'game.wordChain.lobby':
    '🔗 **Catena di Parole** in **{lang}**! Scrivi qualcosa in questo canale entro **{seconds}s** per entrare.',
  'game.wordChain.notEnough':
    '😴 Non si sono uniti abbastanza giocatori (ne servono almeno 2). Gioco annullato.',
  'game.wordChain.begin':
    "🚀 Si parte! Giocatori: {players}. Ogni parola deve iniziare con l'ultima lettera della precedente.",
  'game.wordChain.turn':
    '**{name}**, tocca a te! Una parola in **{lang}** che inizia con **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — prossima lettera: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Deve iniziare con **{letter}**.',
  'game.wordChain.bad.short': '📏 Troppo corta — almeno **{min}** lettere.',
  'game.wordChain.bad.repeated': '🔁 Quella parola è già stata usata.',
  'game.wordChain.bad.word': '📖 Non è nel dizionario.',
  'game.wordChain.bad.latin': '🔤 Contano solo le lettere A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** ha finito il tempo! {hearts} rimaste.',
  'game.wordChain.eliminated': '💀 **{name}** è fuori!',
  'game.wordChain.winner': '🏆 **{name}** vince la catena! ({chain} parole)',
  'game.stats.none': 'Non hai ancora giocato a nessun gioco. Prova `/game play`!',
  'game.stats.body':
    '🎮 **Le tue statistiche** — **{points}** punti · **{wins}** vittorie · {rank}',
  'game.stats.rank': 'posizione **#{rank}** su {total}',
  'game.stats.unranked': 'ancora senza posizione',
  'game.pickPrompt': '🎮 A che gioco vuoi giocare? Scegline uno:',
  'game.pickPlaceholder': 'Scegli un gioco…',
  'game.pickTimeout': '⏰ Nessun gioco scelto — esegui di nuovo `/game play` quando sei pronto.',
  'pron.listHeader': '🗣️ **Le tue pronunce** ({count}/{limit}):',
  'pron.listEmpty': 'Non ne hai ancora — aggiungine una con `/pronunciation add`.',
  'pron.set': '✅ Salvato! Quando **tu** scrivi “{term}”, io dico “{replacement}”.',
  'pron.removed': '🗑️ “{term}” rimosso.',
  'pron.notFound': 'Non hai nessuna pronuncia per “{term}”. Vedi le tue con `/pronunciation list`.',
  'pron.empty': 'La parola e come dirla non possono essere vuote.',
  'pron.limitHit':
    '🔒 Hai raggiunto il tuo limite di **{limit}** pronunce. Rimuovine una con `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus o Premium lo alza a **50** → {url}',
  'pron.modalTitle': 'Insegna una pronuncia a Vozen',
  'pron.modalTerm': 'La parola (come la si scrive)',
  'pron.modalSay': 'Come Vozen dovrebbe dirla',
  'spron.listHeader': '🗣️ **Pronunce del server** ({count}/{limit}) — valgono per tutti:',
  'spron.listEmpty': 'Ancora nessuna — aggiungine una con `/server-pronunciation add`.',
  'spron.set': "✅ Salvato per l'intero server! “{term}” → “{replacement}”.",
  'spron.removed': '🗑️ “{term}” rimosso dal server.',
  'spron.notFound': 'Il server non ha nessuna pronuncia per “{term}”.',
  'spron.limitHit':
    '🔒 Il server ha raggiunto il limite di **{limit}** pronunce. Rimuovine una con `/server-pronunciation remove`.',
  'spron.modalTitle': 'Pronuncia del server',
  'spron.modalSay': 'Come Vozen la dice per tutti',
  'rand.selectPrompt': '🎲 **Randomizer** — tra quante opzioni vuoi che scelga?',
  'rand.selectPlaceholder': 'Numero di opzioni…',
  'rand.selectOption': '{n} opzioni',
  'rand.filling': '📝 Compila il modulo che si è appena aperto!',
  'rand.modalTitle': 'Randomizer — {amount} opzioni',
  'rand.modalOption': 'Opzione {n}',
  'rand.needTwo': 'Dammi almeno 2 opzioni separate da virgole (es. "pizza, sushi").',
  'rand.result': 'Tra {count} opzioni, scelgo… **{winner}**!',
  'rand.speak': 'Scelgo… {winner}!',
  'rand.notInVoice':
    '_(entra in un canale vocale con me e la prossima volta lo dirò ad alta voce)_',
  'rand.timeout': '⏰ Niente scelto — esegui di nuovo `/randomizer` quando sei pronto.',
};
