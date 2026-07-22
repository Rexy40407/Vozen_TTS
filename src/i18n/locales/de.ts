export default {
  'error.generic': 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  'error.needManageGuild': 'Du brauchst die Berechtigung **Server verwalten**, um das zu tun.',
  'join.needVoiceChannel': 'Tritt zuerst einem Sprachkanal bei und führe dann /join aus.',
  'join.missingPerms':
    'Ich brauche die Berechtigungen **Verbinden** und **Sprechen** in {channel}.',
  'join.joined':
    '✅ Ich bin in {channel}! Nächster Schritt: sag `/tts hallo` und ich lese es laut vor. Soll ich einen Kanal automatisch vorlesen? Führe /setup aus.',
  'join.joinedAutoread':
    '✅ Ich bin in {channel}! Alles bereit. Schreib im Kanal für automatisches Vorlesen und ich lese es laut vor. → {readChannel}',
  'leave.left': 'Sprachkanal verlassen. Bis zum nächsten Mal!',
  'skip.notInVoice':
    'Ich bin noch in keinem Sprachkanal — tritt einem bei und führe zuerst /join aus, dann versuche es erneut.',
  'skip.skipped': 'Übersprungen.',
  'skip.nothing': 'Gerade wird nichts abgespielt.',
  'tts.notInVoice':
    'Ich bin noch in keinem Sprachkanal — tritt einem bei und führe /join aus, dann versuche es erneut.',
  'tts.nothingToRead': 'Da gibt es nichts vorzulesen — schick mir einen Text, den ich sagen soll.',
  'tts.nothingAfterClean':
    'Nach dem Aufräumen blieb nichts zum Vorlesen übrig — probier es mit normalem Text (Buchstaben oder Wörter).',
  'tts.tooFast': 'Hoppla, mach mal etwas langsamer — versuch es gleich noch mal.',
  'tts.blocked': 'Dieser Text enthält ein blockiertes Wort, deshalb habe ich ihn übersprungen.',
  'tts.queued': 'Alles klar — es ist in der Warteschlange.',
  'tts.busy': 'Ich bin gerade beschäftigt — versuch es gleich noch mal.',
  'voice.unknownModel': 'Diese Stimme kenne ich nicht — schau in /voice list nach.',
  'voice.badSpeed':
    'Die Geschwindigkeit muss zwischen 0.5 und 2.0 liegen (1.0 ist normal). Probier `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Deine Stimme ist jetzt **{name}** mit {speed}×. Probier `/tts hallo`, um sie zu hören. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Stimme einrichten** — wähle unten deine Optionen und drücke dann **Speichern**. Bis dahin ändert sich nichts.',
  'voice.config.summary': 'Aktuelle Auswahl: **{voice}** · Engine **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Sprache…',
  'voice.config.pickVoice': 'Stimme…',
  'voice.config.pickEngine': 'Engine…',
  'voice.config.pickSpeed': 'Geschwindigkeit…',
  'voice.config.more': '▼ Weitere Sprachen',
  'voice.config.engDefault': 'Standard (lokal)',
  'voice.config.save': 'Speichern',
  'voice.config.cancel': 'Abbrechen',
  'voice.config.cancelled': 'Einrichtung abgebrochen — nichts wurde geändert.',
  'voice.config.expired': 'Das Bedienfeld ist abgelaufen — führe `/voice config` erneut aus.',
  'voice.listHeader': 'Verfügbare Stimmen:',
  'voice.listEmpty': '(keine installiert)',
  'voice.reset':
    '✅ Deine Stimme ist wieder auf den Standard zurückgesetzt. Wähle jederzeit eine andere mit `/voice list` und `/voice set`.',
  'voice.optout':
    'Du wirst nicht mehr automatisch vorgelesen. Führe /voice opt-in aus, um es wieder zu aktivieren.',
  'voice.optin': 'Du wirst wieder automatisch vorgelesen.',
  'voice.notInVoice': 'Ich bin noch in keinem Sprachkanal — führe zuerst /join aus.',
  'voice.previewPlaying': 'Spiele eine Hörprobe ab…',
  'preview.sample': 'Hi, ich bin Vozen. Tippen, hören.',
  'laugh.playing': 'Haha! Spiele das in deiner Stimme ab…',
  'joke.playing': 'Erzähle einen Witz…\n> {joke}',
  'joke.unknownLang': 'Diese Sprache kenne ich nicht. Wähle eine aus der Liste.',
  'voice.abbrev.added': 'Alles klar — {term} wird als {replacement} vorgelesen.',
  'voice.abbrev.removed': 'Deine Abkürzung für {term} wurde entfernt.',
  'voice.abbrev.listHeader': 'Deine persönlichen Abkürzungen ({count}/{cap} genutzt):',
  'voice.abbrev.listEmpty': '(noch keine — füge eine mit /voice abbrev add hinzu)',
  'voice.abbrev.capReached':
    'Du hast das Limit von {cap} persönlichen Abkürzungen erreicht. Entferne eine, bevor du eine neue hinzufügst.',
  'voice.abbrev.invalidTerm':
    'Der Begriff muss ein einzelnes Wort sein (nur Buchstaben und Ziffern), bis zu 50 Zeichen.',
  'voice.abbrev.emptyReplacement': 'Die Aussprache darf nicht leer sein.',
  'voice.abbrev.tooLong': 'Die Aussprache ist zu lang (max. 200 Zeichen).',
  'config.wordEmpty': 'Das Wort darf nicht leer sein.',
  'config.blocked': 'Blockiert: {word}.',
  'config.unblocked': 'Freigegeben: {word}.',
  'config.pronListHeader': 'Aussprachewörterbuch:',
  'config.pronEmptyValue': '(leer)',
  'config.listEmpty': '(keine)',
  'config.termEmpty': 'Der Begriff darf nicht leer sein.',
  'config.pronEmpty': 'Die Aussprache darf nicht leer sein.',
  'config.pronSet': 'Alles klar — {term} wird als {replacement} vorgelesen.',
  'config.pronRemoved': 'Die Aussprache für {term} wurde entfernt.',
  'config.channelWrongType': 'Wähle einen Textkanal (keinen Sprachkanal und keine Kategorie).',
  'config.channelNoAccess':
    'Ich kann {channel} nicht sehen — bitte überprüfe dort meine Berechtigungen.',
  'config.channelSet':
    'Kanal für automatisches Vorlesen auf {channel} gesetzt. Als Nächstes: stelle sicher, dass das automatische Vorlesen mit `/config auto-read active:true` aktiviert ist.',
  'config.autoreadOn': 'Automatisches Vorlesen ist jetzt **an**.',
  'config.autoreadOff': 'Automatisches Vorlesen ist jetzt **aus**.',
  'config.maxCharsRange': 'Der Wert für Max-Zeichen muss zwischen 1 und 2000 liegen.',
  'config.maxCharsSet': 'Maximale Zeichen pro Nachricht auf {value} gesetzt.',
  'config.rateLimitRange': 'Der Wert für das Ratenlimit muss zwischen 1 und 120 liegen.',
  'config.rateLimitSet': 'Ratenlimit auf {value} Nachrichten pro Minute gesetzt.',
  'config.roleSet': 'Automatisches Vorlesen ist jetzt auf Mitglieder mit {role} beschränkt.',
  'config.roleCleared': 'Rollenbeschränkung entfernt — jetzt kann jeder vorgelesen werden.',
  'config.enabledOn': 'TTS ist jetzt **an** für diesen Server.',
  'config.enabledOff': 'TTS ist jetzt **aus** für diesen Server.',
  'config.defaultVoiceSet':
    '✅ Standardstimme des Servers auf **{name}** gesetzt. Mitglieder ohne eigene Stimme hören diese. (id: `{model}`)',
  'config.reset':
    'Konfiguration auf Standardwerte zurückgesetzt. Deine Blockliste und Aussprachen wurden beibehalten.',
  'config.showTitle': '**Serverkonfiguration**',
  'config.showChannel': 'TTS-Kanal: {value}',
  'config.showAutoread': 'Automatisches Vorlesen: {value}',
  'config.showRole': 'Rolle: {value}',
  'config.showEnabled': 'Aktiviert: {value}',
  'config.showVoice': 'Standardstimme: {value}',
  'config.showMaxChars': 'Maximale Zeichen: {value}',
  'config.showRateLimit': 'Ratenlimit: {value}/Min.',
  'config.showBlocklist': 'Blockliste: {count} Wörter',
  'config.showPronunciation': 'Aussprachen: {count} Einträge',
  'config.valueNone': '(keine)',
  'config.valueAny': 'jeder',
  'config.valueAutoDetect': '(automatisch erkennen)',
  'config.on': 'an',
  'config.off': 'aus',
  'config.language.set': 'Oberflächensprache auf {language} gesetzt.',
  'config.language.unsupported': 'Diese Sprache wird noch nicht unterstützt.',
  'setup.noChannel':
    'Ich konnte nicht erkennen, welcher Kanal verwendet werden soll. Gib einen Textkanal in der Option "channel" an.',
  'setup.channelWrongType':
    'Der Kanal für automatisches Vorlesen muss ein Textkanal sein (kein Sprachkanal und keine Kategorie). Gib einen in der Option "channel" an.',
  'setup.done': '**Alles bereit — Vozen ist startklar.**',
  'setup.channelLine': 'Kanal für automatisches Vorlesen: {channel}',
  'setup.autoreadOn': 'Automatisches Vorlesen: an',
  'setup.permsHeader': '**Berechtigungen:**',
  'setup.permView': 'ViewChannel (den Textkanal sehen)',
  'setup.permSend': 'SendMessages (im Textkanal posten)',
  'setup.permConnect': 'Connect (dem Sprachkanal beitreten)',
  'setup.permSpeak': 'Speak (im Sprachkanal sprechen)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — fehlt',
  'setup.permUnchecked': '⏳ {label} — noch nicht geprüft (ich prüfe es bei /join)',
  'setup.fixHint':
    'Um Fehlendes zu beheben: öffne in deinen Servereinstellungen die Rolle von Vozen (oder die Kanalberechtigungen) und aktiviere die mit ❌ markierten Punkte.',
  'setup.voiceUncheckedNote':
    'Du bist in keinem Sprachkanal, deshalb konnte ich Connect/Speak noch nicht prüfen — ich prüfe sie, wenn du /join ausführst.',
  'setup.allGood': 'Alles bereit. Tritt einem Sprachkanal bei und führe /join aus.',
  'setup.joinedVoice': 'Ich bin auch {channel} beigetreten — /join ist nicht nötig.',
  'setup.readyTalk':
    'Alles bereit. Schreib im Kanal für automatisches Vorlesen und ich lese es laut vor.',
  'setup.membersHeader': '**Sag es deinen Mitgliedern (der 3-Schritte-Ablauf):**',
  'setup.membersBody':
    '1) Tritt einem Sprachkanal bei\n2) Führe /join aus, damit ich zu dir komme\n3) Schreib in diesem Kanal (oder nutze /tts) und ich lese es laut vor\nVollständige Befehlsliste: /help',
  'stats.title': '**Vozen-Statistiken**',
  'stats.messagesSpoken': 'Gesprochene Nachrichten: {value}',
  'stats.cacheHits': 'Cache-Treffer: {value}',
  'stats.cacheMisses': 'Cache-Fehlversuche: {value}',
  'stats.synthErrors': 'Synthesefehler: {value}',
  'stats.voiceDrops': 'Verbindungsabbrüche: {value}',
  'stats.voiceReconnects': 'Wiederverbindungen: {value}',
  'stats.votes': 'top.gg-Stimmen: {value}',
  'stats.activePlayers': 'Aktive Player: {value}',
  'stats.servers': 'Server: {value}',
  'stats.uptime': 'Betriebszeit: {value}s',
  'invite.noClientId':
    'Der Einladungslink von Vozen ist noch nicht eingerichtet (CLIENT_ID fehlt). Sag dem Bot-Admin Bescheid.',
  'invite.link': 'Füge Vozen zu deinem Server hinzu:\n{url}',
  'vote.noClientId':
    'Der Abstimmungslink von Vozen ist noch nicht eingerichtet (CLIENT_ID fehlt). Sag dem Bot-Admin Bescheid.',
  'vote.link':
    'Stimme für Vozen ab (kostenlos, alle 12 Std.) und hilf, dass mehr Leute es finden:\n{url}\nFalls dieses Konto die Belohnung noch nie eingelöst hat, erhält es **48 Stunden Vozen Plus**, einmalig pro Konto.',
  'help.title': 'Vozen — tippen, hören.',
  'help.embedTitle': 'Vozen — Befehle',
  'help.intro':
    'Vozen liest deinen Text in Sprachkanälen laut vor — kostenlose neuronale Stimmen, Dutzende Sprachen.',
  'help.quickStartTitle': 'Schnellstart (3 Schritte)',
  'help.quickStartBody':
    '1) Tritt einem Sprachkanal bei und führe dann /join aus\n2) Schreib im Textkanal (oder nutze /tts Hallo zusammen!)\n3) (optional) Wähle eine Stimme mit /voice set',
  'help.groupStarted': 'Erste Schritte',
  'help.groupStartedBody':
    '• /join — ich trete deinem Sprachkanal bei\n• /leave — ich verlasse den Sprachkanal\n• /tts <text> — ich lese Text laut vor · z. B. /tts Hallo zusammen!\n• /skip — überspringe, was ich gerade vorlese',
  'help.groupVoice': 'Deine Stimme',
  'help.groupVoiceBody':
    '• /voice set <model> — wähle deine Stimme · z. B. /voice set en_US-amy-medium\n• /voice list — verfügbare Stimmen ansehen\n• /voice preview — eine Hörprobe deiner Stimme anhören\n• /voice reset — zur Standardstimme zurückkehren\n• /voice opt-out · /voice opt-in — automatisches Vorlesen für dich aus- / einschalten\n• /voice abbrev add|remove|list — persönlicher Slang, so vorgelesen wie du willst (bis zu 10)',
  'help.groupFun': 'Spaß',
  'help.groupFunBody':
    '• /joke — ich erzähle einen kurzen Witz (wähle eine Sprache + optional Gelächter) · z. B. /joke English\n• /laugh — ich lache laut in deiner aktuellen Stimme',
  'help.groupAdmin': 'Server-Admin (braucht Server verwalten)',
  'help.groupAdminBody':
    '• /setup — geführte Einrichtung in einem Schritt · führe dies zuerst aus\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · z. B. /config tts-channel #general\n• /stats — Bot-Statistiken',
  'help.groupMore': 'Mehr',
  'help.groupMoreBody':
    '• /invite — füge Vozen zu einem anderen Server hinzu\n• /vote — stimme für Vozen auf top.gg ab\n• /help — diese Hilfe anzeigen',
  'help.footer': 'Neu hier? Führe {command} aus, um loszulegen.',
  'welcome.title': 'Danke, dass du Vozen hinzugefügt hast! 👋',
  'welcome.description':
    'Vozen liest deinen Chat in Sprachkanälen laut vor — tippen, hören.\n\n**In einem Schritt loslegen:** führe {setup} aus und ich richte das automatische Vorlesen ein und trete deinem Sprachkanal bei.\n\nBrauchst du die vollständige Befehlsliste? Führe {help} aus.',
  'welcome.enginePlans':
    'Die neuronalen Piper-Stimmen bleiben kostenlos. 💎 Kokoro und Google HD gibt es mit Vozen Plus oder Server-Premium.',
  'welcome.stepsTitle': 'So nutzen es Mitglieder (3 Schritte)',
  'welcome.stepsBody':
    '1) Tritt einem Sprachkanal bei\n2) Führe /join aus, damit ich zu dir komme\n3) Schreib im Textkanal (oder nutze /tts) und ich lese es laut vor\nVollständige Befehlsliste: /help',
  'welcome.footer': 'Vozen — tippen, hören.',
  'welcome.tagline': 'Natürliche neuronale Stimme — für immer kostenlos, keine Bezahlschranke.',
  'stt.guildOnly': 'Die Transkription funktioniert nur innerhalb eines Servers.',
  'stt.noManage':
    'Du brauchst die Berechtigung **Server verwalten**, um die Transkription zu starten oder zu stoppen.',
  'stt.notPremium':
    '🎙️ Live-Transkription ist eine **Premium**-Funktion. Sieh dir `/premium info` an, um sie für diesen Server freizuschalten.',
  'stt.unavailable':
    'Die Transkription ist auf dieser Instanz nicht verfügbar (die Speech-to-Text-Engine ist nicht installiert).',
  'stt.notInVoice':
    'Ich bin in keinem Sprachkanal — tritt einem bei und führe zuerst `/join` aus, dann starte die Transkription.',
  'stt.alreadyRunning':
    'Die Transkription läuft auf diesem Server bereits. Nutze zuerst `/transcribe stop`.',
  'stt.atCapacity':
    'Gerade laufen zu viele Transkriptionen über alle Server hinweg. Bitte versuche es in Kürze erneut.',
  'stt.noChannel':
    'Ich kann in diesem Kanal keine Transkripte posten. Versuche den Befehl in einem normalen Textkanal auszuführen.',
  'stt.started':
    '✅ Transkription gestartet. Jeder, der in der Ankündigung auf **Zustimmen** drückt, wird in diesen Kanal transkribiert.',
  'stt.startFailed':
    'Die Transkription konnte nicht gestartet werden (das Posten der Ankündigung ist fehlgeschlagen). Ich habe alles rückgängig gemacht — es wird nichts aufgezeichnet. Bitte versuche es erneut.',
  'stt.announceStart':
    '🎙️ **Live-Transkription ist in diesem Kanal AN.** Nur wer zustimmt, wird transkribiert — drücke den Button unten, um zu erlauben, dass deine Sprache hier mitgeschrieben wird. Du kannst deine Zustimmung jederzeit mit `/transcribe revoke` zurückziehen.',
  'stt.consentBtn': 'Der Transkription zustimmen',
  'stt.consentThanks':
    '✅ Danke — deine Sprache wird auf diesem Server jetzt transkribiert. Zieh die Zustimmung jederzeit mit `/transcribe revoke` zurück.',
  'stt.stopped': '🛑 Transkription gestoppt.',
  'stt.notRunning': 'Die Transkription läuft auf diesem Server nicht.',
  'stt.announceStop': '🛑 **Live-Transkription ist jetzt AUS.** Ich höre nicht mehr zu.',
  'stt.revoked':
    '✅ Zustimmung zurückgezogen — du wirst auf diesem Server nicht mehr transkribiert. (Bereits gepostete Nachrichten bleiben; lösche sie in Discord, wenn du möchtest.)',
  'stt.revokeNone':
    'Du hattest der Transkription auf diesem Server nicht zugestimmt, daher gab es nichts zurückzuziehen.',
  'privacy.eraseConfirm':
    '⚠️ Dies löscht dauerhaft **alle** deine Vozen-Daten auf allen Servern: Stimmeinstellungen, gesprochener Spitzname, persönliche Abkürzungen und Aussprachen, gespeicherter Geburtstag, Spielpunkte, Sprechstatistiken und Opt-out. **Das kann nicht rückgängig gemacht werden.** Bist du sicher?',
  'privacy.erasePremiumNote':
    '_Hinweis: Dein bezahltes Premium/Plus und dessen Kaufhistorie bleiben erhalten — sie gehören dir und den gesetzlich vorgeschriebenen Finanzunterlagen. Um Premium zu beenden, lass es auslaufen oder kontaktiere den Support._',
  'privacy.eraseYes': 'Alles löschen',
  'privacy.eraseNo': 'Abbrechen',
  'privacy.eraseCancelled': 'Abgebrochen — es wurde nichts gelöscht.',
  'privacy.eraseDone': '✅ Fertig. Alle deine persönlichen Daten wurden dauerhaft gelöscht.',
  'shutup.notInVoice':
    'Ich bin noch in keinem Sprachkanal — tritt einem bei und führe zuerst /join aus.',
  'shutup.nothing': 'Gerade wird nichts abgespielt.',
  'shutup.done': '🤐 Okay, ich höre auf — habe alles in der Warteschlange geleert.',
  'voice.detection.on':
    '✅ Automatische Spracherkennung ist AN: Jede Nachricht wird in einer Stimme für ihre erkannte Sprache vorgelesen (der Sprecher kann wechseln). Schalte sie mit `/voice detection active:false` aus.',
  'voice.detection.off':
    '✅ Automatische Spracherkennung ist AUS: Deine eine feste Stimme liest alles vor, sodass du immer gleich klingst.',
  'voice.nickname.set': '✅ Vozen nennt dich jetzt laut **{name}**.',
  'voice.nickname.cleared':
    '✅ Gesprochener Spitzname gelöscht — Vozen verwendet deinen Servernamen.',
  'voice.nickname.invalid':
    'Dieser Name hat nichts Lesbares, um es laut auszusprechen. Versuche es mit Buchstaben oder Zahlen.',
  'voice.effect.set':
    '✅ Stimmeffekt auf **{effect}** gesetzt — deine Nachrichten werden jetzt mit diesem Effekt abgespielt. Nutze `/voice effect none`, um ihn auszuschalten.',
  'voice.effect.cleared': '✅ Stimmeffekt entfernt — wieder klare Stimme.',
  'voice.effect.locked':
    '🔒 **{effect}** ist ein Premium-Effekt. Kostenlose Effekte: 🤖 Robot und 🔊 Echo. Schalte alle mit Vozen Premium frei — siehe `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** ist eine Premium-Stimm-Engine. Schalte sie mit Vozen Plus (persönlich) oder Vozen Premium (Server) frei — siehe `/premium`. In der Zwischenzeit bleibt deine Stimme auf der kostenlosen lokalen Engine.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** ist eine Premium-Stimm-Engine. Schalte sie mit Vozen Plus (persönlich) oder Vozen Premium (Server) frei — siehe `/premium`. In der Zwischenzeit bleibt deine Stimme auf der kostenlosen lokalen Engine.',
  'rizz.playing': '😏 Lass ein bisschen Rizz raus…\n> {line}',
  'rizz.unknownLang': 'Diese Sprache kenne ich nicht. Wähle eine aus der Liste.',
  'rizz.locked':
    '🔒 **/rizz** ist ein Premium-Extra. Schalte es mit Vozen Plus (du) oder Premium (dieser Server) frei. Siehe `/premium`.',
  'sound.playing': '🔊 Spiele **{name}**…',
  'sound.unknown': 'Diesen Sound habe ich nicht. Führe `/sound` aus, um die Liste zu sehen.',
  'sound.list':
    '🔊 **Sounds:** {sounds}\nSpiele einen mit `/sound name:<sound>` ab (ich muss in deinem Sprachkanal sein).',
  'sound.disabled':
    '🔇 Das Soundboard ist auf diesem Server **aus**. Ein Admin kann es mit `/config soundboard` aktivieren.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Geburtstag gespeichert: **{day}/{month}**. Ich wünsche dir alles Gute zum Geburtstag, wenn du an dem Tag einem Sprachkanal beitrittst!',
  'birthday.invalid': 'Das ist kein echtes Datum. Überprüfe Tag und Monat.',
  'birthday.cleared': '🎂 Geburtstag entfernt.',
  'birthday.show': '🎂 Dein Geburtstag ist auf **{day}/{month}** gesetzt.',
  'birthday.none': 'Du hast noch keinen Geburtstag festgelegt. Nutze `/birthday set`.',
  'topspeakers.title':
    '🗣️ **Top-Sprecher** — wen ich auf diesem Server am meisten vorgelesen habe:',
  'topspeakers.empty':
    'Ich habe noch niemandes Nachrichten vorgelesen. Richte einen Vorlese-Kanal mit `/setup` ein!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** Nachrichten · 🔥 {streak}-Tage-Streak',
  'serverstats.title': '📊 **Serverstatistiken**',
  'serverstats.empty':
    'Noch keine Statistiken — ich habe hier keine Nachrichten vorgelesen und keine Spiele durchgeführt. Richte es mit `/setup` ein!',
  'serverstats.messages': '🗣️ **{total}** Nachrichten vorgelesen · **{speakers}** Personen',
  'serverstats.topTalkers': '**Top-Plaudertaschen:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} Nachr. · 🔥 {streak}T',
  'serverstats.streak': '🔥 Längster aktiver Streak: **{days}** Tage',
  'serverstats.games': '🎮 **{points}** Spielpunkte · **{wins}** Siege · **{players}** Spieler',
  'serverstats.topPlayers': '**Top-Spieler:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} Pkt · {wins} Siege',
  'serverstats.upsell':
    '🔒 Das ist die kostenlose Vorschau. **Premium** schaltet Streaks, Spielstatistiken und die vollständige Top 5 frei — siehe `/premium`.',
  'streak.day':
    '🔥 <@{user}> hat einen **{n}-Tage**-Streak! Sprich weiter, um ihn am Leben zu halten.',
  'leaderboard.autoTitle': '🏆 Top-Plaudertaschen auf diesem Server',
  'premium.title': '💎 **Vozen-Premium-Status**',
  'premium.lineServerActive': '🖥️ **Server:** Premium bis {date}',
  'premium.lineServerFree': '🖥️ **Server:** Kostenloser Plan',
  'premium.lineUserActive': '👤 **Du (Plus):** aktiv bis {date}',
  'premium.lineUserFree': '👤 **Du (Plus):** nicht aktiv',
  'premium.getHint':
    'Alles, was du heute nutzt, bleibt kostenlos. Premium fügt alle 8 Stimmeffekte, 24/7 in der Call, 50 persönliche Aussprachen, /rizz und die Premium-Spiele hinzu. Support: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium-Stimmen-Engines:** Kokoro und Google HD — persönlich mit Plus oder für alle mit Server-Premium freigeschaltet.',
  'premium.linePass':
    '🎟️ **Dein Premium-Pass:** {used}/{total} Lizenzen in Verwendung · läuft ab {date}',
  'premium.passServers': '↳ In Verwendung auf: {servers}',
  'premium.pitch':
    'Du hast noch kein Premium. **Vozen Premium** (€3,99/Monat für 3 Server oder €7,99/Monat für 8) schaltet für den ganzen Server frei: alle 8 Stimmeffekte, 24/7 in der Call, 50 persönliche Aussprachen (statt 3), den Befehl /rizz und die Premium-Spiele (Wortkette, Wordle, Schach). **Vozen Plus** (€1,99/Monat) gibt dir diese Vorteile persönlich, auf jedem Server.',
  'premium.buyHint':
    '▶ **Premium holen:** {link}\nNach dem Kauf führe `/premium activate` auf dem gewünschten Server aus.',
  'premium.confirmActivate':
    '**1 deiner {total} Premium-Lizenzen** auf **diesem Server** verwenden? Du hast gerade **{used}** in Verwendung. Du kannst sie später mit `/premium deactivate` freigeben — die Uhr des Passes läuft so oder so weiter.',
  'premium.confirmYes': '💎 Lizenz verwenden',
  'premium.confirmNo': 'Abbrechen',
  'premium.activateOk':
    '✅ Premium ist jetzt auf **diesem Server** aktiv bis {date}. Lizenzen: **{used}/{total}** in Verwendung.',
  'premium.activateCancelled': 'Abgebrochen — es wurde keine Lizenz verwendet.',
  'premium.activateTimeout': 'Zeitüberschreitung — es wurde keine Lizenz verwendet.',
  'premium.noPass':
    'Du hast keinen aktiven Premium-Pass. Hol dir einen und er landet auf deinem Konto — führe dann hier `/premium activate` aus.\n▶ {link}',
  'premium.alreadyActive': 'Dieser Server hat bereits eine deiner Premium-Lizenzen. Nichts zu tun.',
  'premium.noSeats':
    'Alle deine **{total}** Premium-Lizenzen sind in Verwendung ({servers}). Gib dort eine mit `/premium deactivate` frei und versuche es dann hier erneut.',
  'premium.needManageGuild':
    'Premium zu aktivieren betrifft den ganzen Server — nur Mitglieder mit **Server verwalten** können das. Frag einen Admin.',
  'premium.deactivateOk':
    '✅ Die Premium-Lizenz dieses Servers freigegeben. Verwende sie mit `/premium activate` auf einem anderen Server.',
  'premium.deactivateNone': 'Dieser Server hat keine Premium-Lizenz von dir zum Freigeben.',
  'premium.thisServer': 'dieser Server',
  'grant.denied': '⛔ Dieser Befehl ist nur für den Bot-Besitzer.',
  'grant.okPremium':
    '✅ <@{user}> einen **Premium-Pass** ({seats} Lizenzen) für **{days}** Tage gewährt — läuft ab {date}. Aktivierung mit `/premium activate`.',
  'grant.okPlus': '✅ <@{user}> **Vozen Plus** für **{days}** Tage gewährt — läuft ab {date}.',
  'gencode.done':
    '✅ **{count}** {plan}-Code(s) generiert, je **{days}** Tage. Teile sie privat:\n{list}',
  'redeem.okPlus':
    '🎁 Eingelöst! Du hast **Vozen Plus** für **{days}** Tage erhalten — läuft ab {date}.',
  'redeem.okPremium':
    '🎁 Eingelöst! Du hast einen **Premium-Pass** ({seats} Lizenzen) für **{days}** Tage erhalten — läuft ab {date}. Aktiviere ihn auf deinem Server mit `/premium activate`.',
  'redeem.notFound': '❌ Diesen Code gibt es nicht. Überprüfe ihn und versuche es erneut.',
  'redeem.used': '❌ Dieser Code wurde bereits eingelöst.',
  'redeem.expired': '❌ Dieser Code ist abgelaufen.',
  'config.blockLimit':
    'Dieser Server hat bereits die maximale Anzahl von {max} blockierten Wörtern. Entferne eines, bevor du ein weiteres hinzufügst.',
  'config.xsaidOn':
    'Vozen kündigt jetzt vor jeder Nachricht an, **wer gesprochen hat** (z. B. „Alex sagte hallo“). Schalte es mit `/config x-said active:false` aus.',
  'config.xsaidOff':
    'Vozen kündigt **nicht mehr** an, wer gesprochen hat — es liest nur die Nachricht.',
  'config.autojoinOn':
    '✅ Auto-Beitritt **an** — Vozen tritt deinem Sprachkanal bei, wenn du im TTS-Kanal schreibst.',
  'config.autojoinOff': 'Auto-Beitritt **aus** — nutze `/join`, um Vozen in die Sprache zu holen.',
  'config.stayOn':
    '✅ 24/7 in der Call **an** — Vozen bleibt im Sprachkanal, auch wenn er sich leert, und kommt nach Neustarts zurück. 💎 Braucht Premium, um wirksam zu werden (kaufe oder `/redeem` einen Code, dann `/premium activate`).',
  'config.stayOff':
    '24/7 in der Call **aus** — Vozen verlässt den Sprachkanal, wenn er sich leert (Standard).',
  'config.readBotsOn': '✅ Vozen liest jetzt auch Nachrichten von **anderen Bots und Webhooks**.',
  'config.readBotsOff':
    'Vozen **ignoriert** andere Bots und Webhooks (nur echte Personen werden vorgelesen).',
  'config.textInVoiceOn': '✅ Vozen liest auch den **Textchat innerhalb seines Sprachkanals** vor.',
  'config.textInVoiceOff':
    'Vozen liest den Textchat des Sprachkanals **nicht** vor (nur den TTS-Kanal).',
  'config.antispamOn':
    '✅ Anti-Spam **an** — Vozen liest gespammte Nachrichten nicht vor (massenhafte Wortwiederholung oder dieselbe große Nachricht immer wieder gepostet).',
  'config.antispamOff': 'Anti-Spam **aus** — Vozen liest jede Nachricht wie gewohnt vor.',
  'config.streaksOn':
    '✅ Streak-Hinweise **an** — Vozen zeigt eine 🔥 Tages-Streak-Nachricht, wenn jede Person zum ersten Mal am Tag spricht.',
  'config.streaksOff':
    'Streak-Hinweise **aus** — Vozen zählt Streaks weiterhin (siehe `/top-speakers`), bleibt aber still darüber.',
  'config.soundboardOn': 'Soundboard **an** — jeder kann mit `/sound` Clips abspielen.',
  'config.soundboardOff': 'Soundboard **aus** — `/sound` ist auf diesem Server deaktiviert.',
  'config.votePromosLabel': 'Hinweise zur top.gg-Belohnung + Vozen Support',
  'config.greetOn': '✅ Ich begrüße Leute mit Namen, wenn sie dem Sprachkanal beitreten.',
  'config.greetOff': '🔇 Ich begrüße Leute **nicht**, wenn sie dem Sprachkanal beitreten.',
  'config.greetLangSet': '✅ Sprache der Beitrittsbegrüßung auf **{language}** gesetzt.',
  'config.showXsaid': 'Sprecher ankündigen (xsaid): {value}',
  'config.showAutojoin': 'Auto-Beitritt: {value}',
  'config.showReadBots': 'Bots/Webhooks vorlesen: {value}',
  'config.showTextInVoice': 'Text-in-Sprache: {value}',
  'config.showAntispam': 'Anti-Spam: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': 'Bei Beitritt begrüßen: {value} ({language})',
  'stats.synthLatency': 'Synthese-Latenz: p50 {p50}ms / p95 {p95}ms ({count} Messwerte)',
  'speak.emptyMessage': 'Diese Nachricht hat keinen Text zum Vorlesen.',
  'uptime.text': '🟢 Vozen ist seit **{uptime}** online.',
  'botstats.title': '📊 **Vozen — Statistiken**',
  'botstats.servers': 'Server: **{value}**',
  'botstats.voiceSessions': 'Sprachsitzungen jetzt: **{value}**',
  'botstats.messagesSpoken': 'Gesprochene Nachrichten: **{value}**',
  'botstats.uptime': 'Betriebszeit: **{value}**',
  'invite.button': 'Vozen hinzufügen',
  'vote.button': 'Auf top.gg abstimmen',
  'vote.upsell':
    '🗳️ Falls dieses Konto die Belohnung noch nie eingelöst hat, erhält es **48 Stunden Vozen Plus**, einmalig pro Konto. {url}',
  'vote.cooldownStatus':
    '🗳️ Dieses Konto hat die einmalige Abstimmungsbelohnung bereits genutzt. Du kannst Vozen weiterhin mit deiner Stimme unterstützen, erhältst aber kein weiteres Plus.',
  'help.support': '🛟 Brauchst du Hilfe oder willst ein Problem melden? {url}',
  'help.source': '📄 Open Source (AGPL-3.0) — hol dir den exakten Quellcode, der hier läuft: {url}',
  'game.start.needVoice':
    'Das ist ein **Sprachspiel** — spring in einen Sprachkanal und führe zuerst /join aus, dann starte es.',
  'game.start.alreadyActive':
    'In <#{channel}> läuft bereits ein Spiel. Beende es (oder nutze `/game stop`), bevor du ein weiteres startest.',
  'game.start.premiumLocked':
    '🔒 **{game}** ist ein Premium-Spiel (es kostet echte Rechenleistung). Siehe `/premium`.',
  'game.start.started': '🎮 Starte **{game}**! Achte auf den Kanal — viel Glück!',
  'game.start.startedThread':
    '🎮 **{game}** wurde in <#{channel}> gestartet — mach dort mit! Der Thread löscht sich selbst, wenn das Spiel endet.',
  'game.thread.winner': '🏆 {winner} hat das Spiel gewonnen!',
  'game.thread.ended': '🎮 Das Spiel ist beendet.',
  'game.unknownGame': 'Dieses Spiel kenne ich nicht. Wähle eines aus der Liste.',
  'game.stop.ok': '🛑 Das aktuelle Spiel gestoppt.',
  'game.stop.none': 'Gerade läuft kein Spiel.',
  'game.list.title': '🎮 **Spiele** — starte eines mit `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Bestenliste** — die besten Spieler auf diesem Server:',
  'game.leaderboard.empty': 'Es wurde noch nichts gespielt. Sei der Erste — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** Pkt ({wins} Siege)',
  'game.finish.title': '🏁 **Spiel vorbei!** Endstände:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Spiel vorbei — diesmal hat niemand gepunktet. Beim nächsten Mal!',
  'game.finish.winnerVoice': '{user} gewinnt!',
  'game.guessLanguage.name': 'Errate die Sprache',
  'game.guessLanguage.desc':
    'Ich lese einen Satz in einer zufälligen Sprache — wer sie zuerst nennt, gewinnt den Punkt.',
  'game.guessLanguage.intro':
    '🗣️ **Errate die Sprache** — ich lese {rounds} Sätze. Schreib, welche Sprache du hörst. Die schnellste richtige Antwort gewinnt jede Runde!',
  'game.guessLanguage.round': '🎧 Runde {n}/{total} — hör zu…',
  'game.guessLanguage.correct': '✅ **{user}** hat es — es war **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Zeit! Das war **{language}**.',
  'game.guessLanguage.noLanguages':
    'Ich habe nicht genug Stimmen installiert, um das zu spielen. Bitte einen Admin, mehr Stimmen hinzuzufügen.',
  'game.math.name': 'Kopfrechnen',
  'game.math.desc': 'Ich sage eine Rechnung laut — wer die Antwort zuerst tippt, gewinnt.',
  'game.math.intro':
    '🔢 **Kopfrechnen** — {rounds} Rechnungen. Hör zu und tippe die Antwort so schnell du kannst!',
  'game.math.round': '🧮 Runde {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** hat es getroffen — die Antwort war **{answer}**!',
  'game.math.timeout': '⏱️ Zeit! Die Antwort war **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'mal',
  'game.skipCount.name': 'Fehlende Zahl',
  'game.skipCount.desc':
    'Ich zähle laut, überspringe aber eine Zahl — wer sie zuerst erwischt, gewinnt.',
  'game.skipCount.intro':
    '🔢 **Fehlende Zahl** — ich zähle, aber ich überspringe eine. Tippe die fehlende Zahl! ({rounds} Runden)',
  'game.skipCount.round': '👂 Runde {n}/{total} — welche Zahl habe ich übersprungen?',
  'game.skipCount.correct': '✅ **{user}** hat es erwischt — ich habe **{answer}** übersprungen!',
  'game.skipCount.timeout': '⏱️ Zeit! Ich habe **{answer}** übersprungen.',
  'game.spelling.name': 'Buchstabierwettbewerb',
  'game.spelling.desc': 'Ich sage ein Wort — wer es zuerst richtig buchstabiert, gewinnt.',
  'game.spelling.intro':
    '✍️ **Buchstabierwettbewerb** — ich sage {rounds} Wörter. Tippe jedes richtig geschrieben!',
  'game.spelling.round': '🗣️ Runde {n}/{total} — schreib das Wort, das ich sage…',
  'game.spelling.correct': '✅ **{user}** hat **{word}** richtig geschrieben!',
  'game.spelling.timeout': '⏱️ Zeit! Das Wort war **{word}**.',
  'game.spelling.empty': 'Ich habe noch keine Wortliste für die Stimmsprache dieses Servers.',
  'game.spellOut.name': 'Buchstaben-Rätsel',
  'game.spellOut.desc':
    'Ich buchstabiere ein Wort Buchstabe für Buchstabe — wer das ganze Wort zuerst schreibt, gewinnt.',
  'game.spellOut.intro':
    '🔡 **Buchstaben-Rätsel** — ich buchstabiere {rounds} Wörter Buchstabe für Buchstabe. Tippe das vollständige Wort!',
  'game.spellOut.round': '🔤 Runde {n}/{total} — hör auf die Buchstaben…',
  'game.spellOut.correct': '✅ **{user}** hat es — **{word}**!',
  'game.spellOut.timeout': '⏱️ Zeit! Es buchstabierte **{word}**.',
  'game.fastSpeech.name': 'Schnellsprech',
  'game.fastSpeech.desc':
    'Ich lese einen Satz superschnell — wer zuerst tippt, was ich gesagt habe, gewinnt.',
  'game.fastSpeech.intro':
    '💨 **Schnellsprech** — {rounds} Sätze in irrsinnigem Tempo. Tippe, was du hörst!',
  'game.fastSpeech.round': '⚡ Runde {n}/{total} — jetzt kommt es, schnell!',
  'game.fastSpeech.correct': '✅ **{user}** hat es entschlüsselt: „{phrase}“',
  'game.fastSpeech.timeout': '⏱️ Zeit! Es war: „{phrase}“',
  'game.fastSpeech.empty': 'Ich habe noch keine Sätze für die Stimmsprache dieses Servers.',
  'game.accentSwap.name': 'Komischer Akzent',
  'game.accentSwap.desc':
    'Ich sage ein Wort mit einem fremden Akzent — wer es zuerst schreibt, gewinnt.',
  'game.accentSwap.intro':
    '🎭 **Komischer Akzent** — {rounds} Wörter mit dem falschen Akzent gesprochen. Tippe das Wort!',
  'game.accentSwap.round': '🌍 Runde {n}/{total} — welches Wort versuche ich zu sagen?',
  'game.accentSwap.correct': '✅ **{user}** hat es — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Zeit! Das Wort war **{word}**.',
  'game.reflexes.name': 'Reflexe',
  'game.reflexes.desc':
    'Ich zähle runter und rufe dann LOS — wer danach zuerst tippt, gewinnt. Nicht zu früh losspringen!',
  'game.reflexes.intro':
    '⚡ **Reflexe** — {rounds} Runden. Wenn ich **LOS** rufe, tippe irgendetwas so schnell du kannst. Tippst du vor LOS, ist es ein Fehlstart!',
  'game.reflexes.ready': '🚦 Runde {n}/{total} — macht euch bereit…',
  'game.reflexes.countdown': 'drei… zwei… eins…',
  'game.reflexes.go': '🟢 **LOS!!!**',
  'game.reflexes.goVoice': 'Los!',
  'game.reflexes.tooSoon': '🔴 **{user}** war zu voreilig — zu früh!',
  'game.reflexes.win': '⚡ **{user}** ist am schnellsten! Punkt!',
  'game.reflexes.tooSlow': '😴 Niemand hat rechtzeitig reagiert. Weiter!',
  'game.headsOrTails.name': 'Kopf oder Zahl',
  'game.headsOrTails.desc':
    'Sag die Münze voraus — tippe Kopf oder Zahl, bevor ich werfe. Wer am besten rät, gewinnt!',
  'game.headsOrTails.intro':
    '🪙 **Kopf oder Zahl** — {rounds} Runden. Tippe in jeder Runde `heads` (Kopf) oder `tails` (Zahl), bevor ich die Münze werfe. 1 Punkt pro richtigem Tipp!',
  'game.headsOrTails.introVoice': 'Spielen wir Kopf oder Zahl!',
  'game.headsOrTails.round': '🪙 Runde {n}/{total} — Kopf oder Zahl? Tippe `heads` oder `tails`!',
  'game.headsOrTails.roundVoice': 'Kopf… oder Zahl?',
  'game.headsOrTails.heads': 'Kopf',
  'game.headsOrTails.tails': 'Zahl',
  'game.headsOrTails.resultVoice': 'Es ist {side}!',
  'game.headsOrTails.winners': 'Es ist **{side}**! Punkt für: {users}',
  'game.headsOrTails.noWinners': 'Es ist **{side}**! Niemand hat es getippt — keine Punkte.',
  'game.vozenSays.name': 'Vozen sagt',
  'game.vozenSays.desc':
    'Gehorche nur, wenn der Befehl mit „Vozen sagt“ beginnt. Fällst du auf eine Falle rein, bist du raus!',
  'game.vozenSays.intro':
    '🫡 **Vozen sagt** — {rounds} Befehle. Tu es NUR, wenn ich mit **„Vozen sagt“** beginne. Sonst rühr dich nicht!',
  'game.vozenSays.prefix': 'Vozen sagt',
  'game.vozenSays.verb': 'tippt',
  'game.vozenSays.real': '🗣️ Runde {n}/{total} — „{command}“',
  'game.vozenSays.trap': '🗣️ Runde {n}/{total} — „{command}“',
  'game.vozenSays.obeyed': '✅ **{user}** hat zuerst gehorcht — Punkt!',
  'game.vozenSays.caught': '🔴 **{user}** — ich habe nicht „Vozen sagt“ gesagt! Erwischt!',
  'game.vozenSays.nobody': '😴 Niemand hat **{word}** rechtzeitig befolgt. Weiter!',
  'game.vozenSays.trapCleared':
    '😌 Es war eine Falle — gut erkannt, niemand ist auf **{word}** reingefallen.',
  'game.roulette.name': 'Wahrheit oder Pflicht Roulette',
  'game.roulette.desc':
    'Ich drehe und lese eine Wahrheit-oder-Pflicht-Aufgabe laut vor. Führe es erneut aus für eine weitere.',
  'game.roulette.header': '🎯 **Das Rad sagt…**',
  'game.hangman.name': 'Galgenmännchen',
  'game.hangman.desc': 'Errate das Wort Buchstabe für Buchstabe — 6 Fehler und es ist vorbei.',
  'game.hangman.intro':
    '🪢 **Galgenmännchen** — tippe einen Buchstaben nach dem anderen, um das Wort zu erraten. Du kannst auch das ganze Wort tippen!',
  'game.hangman.hit': '🟢 **{user}** hat **{letter}** gefunden!',
  'game.hangman.miss': '🔴 **{user}** — kein **{letter}**.',
  'game.hangman.wrongLetters': 'Falsch: {letters}',
  'game.hangman.win': '🎉 **{user}** hat es gelöst — **{word}**!',
  'game.hangman.lose': '💀 Keine Versuche mehr! Das Wort war **{word}**.',
  'game.hangman.idle': '🕹️ Spiel pausiert (niemand spielt). Das Wort war **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Errate das 5-Buchstaben-Wort. 🟩 richtige Stelle, 🟨 falsche Stelle, ⬛ nicht im Wort. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — tippe ein 5-Buchstaben-Wort. Ihr teilt euch {max} Versuche. 🟩 richtige Stelle · 🟨 falsche Stelle · ⬛ nicht im Wort.',
  'game.wordle.guess': '🔤 **{user}** hat geraten — **{left}** Versuche übrig',
  'game.wordle.inWord': '🟢 im Wort: {letters}',
  'game.wordle.out': '🚫 raus: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** hat es in {n} geschafft — **{word}**!',
  'game.wordle.lose': '💀 Keine Versuche mehr! Das Wort war **{word}**.',
  'game.wordle.idle': '🕹️ Spiel pausiert (niemand spielt). Das Wort war **{word}**.',
  'game.tictactoe.name': 'Tic-Tac-Toe',
  'game.tictactoe.desc':
    'Zwei Spieler — tippe eine Zahl von 1-9, um deine Markierung zu setzen. Drei in einer Reihe gewinnt.',
  'game.tictactoe.intro':
    '⭕ **Tic-Tac-Toe** — die ersten zwei Spieler, die ziehen, sind ❌ und ⭕ (❌ beginnt). Tippe eine Zahl von 1-9, um dein Feld zu spielen.',
  'game.tictactoe.turn': 'Am Zug: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, **{mark}** ist am Zug.',
  'game.tictactoe.taken': '🚫 Feld {cell} ist belegt — wähle ein anderes.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) gewinnt!',
  'game.tictactoe.draw': '🤝 Unentschieden!',
  'game.tictactoe.idle': '🕹️ Spiel beendet (niemand spielt).',
  'game.chess.name': 'Schach',
  'game.chess.desc':
    'Zwei Spieler — echte Schachregeln (Schach, Rochade, Umwandlung…). Tippe einen Zug wie „e4“ oder „Nf3“. 💎 Premium.',
  'game.chess.intro':
    '♟️ **Schach** — die ersten zwei Spieler, die ziehen, bekommen Weiß und Schwarz (Weiß beginnt). Tippe einen Zug in algebraischer Notation („e4“, „Nf3“, „O-O“) oder als Koordinaten („e2e4“). Tippe „resign“, um aufzugeben.',
  'game.chess.white': 'Weiß',
  'game.chess.black': 'Schwarz',
  'game.chess.seats': '⚪ Weiß: **{white}** · ⚫ Schwarz: **{black}**',
  'game.chess.turn': '{move} — am Zug: **{color}**',
  'game.chess.check': '♟️ Schach!',
  'game.chess.notYourTurn': '⏳ **{user}**, **{color}** ist am Zug.',
  'game.chess.illegalMove': '🚫 „{move}“ ist kein gültiger Zug — versuche es erneut.',
  'game.chess.checkmate': '🏆 Schachmatt ({move})! **{user}** gewinnt!',
  'game.chess.draw': '🤝 Unentschieden ({move})!',
  'game.chess.resigned': '🏳️ **{user}** hat aufgegeben — **{winner}** gewinnt!',
  'game.chess.idle': '🕹️ Spiel beendet (niemand spielt).',
  'game.wordChain.name': 'Wortkette',
  'game.wordChain.descr':
    'Rundenbasierte Wortkette in einer Sprache: Sag ein Wort, das mit dem letzten Buchstaben des vorherigen beginnt. 2 Leben, keine Wiederholungen, die Uhr wird schneller. Wähle die Sprache mit der Option `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Wortkette ist gerade nicht in **{lang}** verfügbar (Wortliste fehlt).',
  'game.wordChain.lobby':
    '🔗 **Wortkette** in **{lang}**! Schreib innerhalb von **{seconds}s** irgendetwas in diesen Kanal, um mitzumachen.',
  'game.wordChain.notEnough':
    '😴 Nicht genug Spieler sind beigetreten (mindestens 2 nötig). Spiel abgebrochen.',
  'game.wordChain.begin':
    "🚀 Los geht's! Spieler: {players}. Jedes Wort muss mit dem letzten Buchstaben des vorherigen beginnen.",
  'game.wordChain.turn':
    '**{name}**, du bist dran! Ein **{lang}**-Wort, das mit **{letter}** beginnt — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — nächster Buchstabe: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Es muss mit **{letter}** beginnen.',
  'game.wordChain.bad.short': '📏 Zu kurz — mindestens **{min}** Buchstaben.',
  'game.wordChain.bad.repeated': '🔁 Dieses Wort wurde bereits verwendet.',
  'game.wordChain.bad.word': '📖 Das steht nicht im Wörterbuch.',
  'game.wordChain.bad.latin': '🔤 Nur Buchstaben von A–Z zählen.',
  'game.wordChain.timeout': '⏰ **{name}** ist die Zeit ausgegangen! {hearts} übrig.',
  'game.wordChain.eliminated': '💀 **{name}** ist raus!',
  'game.wordChain.winner': '🏆 **{name}** gewinnt die Kette! ({chain} Wörter)',
  'game.stats.none': 'Du hast noch keine Spiele gespielt. Probier `/game play`!',
  'game.stats.body': '🎮 **Deine Statistiken** — **{points}** Punkte · **{wins}** Siege · {rank}',
  'game.stats.rank': 'Platz **#{rank}** von {total}',
  'game.stats.unranked': 'noch nicht platziert',
  'game.pickPrompt': '🎮 Welches Spiel möchtest du spielen? Wähle eines:',
  'game.pickPlaceholder': 'Wähle ein Spiel…',
  'game.pickTimeout': '⏰ Kein Spiel gewählt — führe `/game play` erneut aus, wenn du bereit bist.',
  'pron.listHeader': '🗣️ **Deine Aussprachen** ({count}/{limit}):',
  'pron.listEmpty': 'Du hast noch keine — füge eine mit `/pronunciation add` hinzu.',
  'pron.set': '✅ Gespeichert! Wenn **du** „{term}“ tippst, sage ich „{replacement}“.',
  'pron.removed': '🗑️ „{term}“ entfernt.',
  'pron.notFound':
    'Du hast keine Aussprache für „{term}“. Sieh dir deine mit `/pronunciation list` an.',
  'pron.empty': 'Das Wort und wie man es sagt dürfen nicht leer sein.',
  'pron.limitHit':
    '🔒 Du hast dein Limit von **{limit}** Aussprachen erreicht. Entferne eine mit `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus oder Premium erhöht es auf **50** → {url}',
  'pron.modalTitle': 'Vozen eine Aussprache beibringen',
  'pron.modalTerm': 'Das Wort (wie man es tippt)',
  'pron.modalSay': 'Wie Vozen es sagen soll',
  'spron.listHeader': '🗣️ **Server-Aussprachen** ({count}/{limit}) — gelten für alle:',
  'spron.listEmpty': 'Noch keine — füge eine mit `/server-pronunciation add` hinzu.',
  'spron.set': '✅ Für den ganzen Server gespeichert! „{term}“ → „{replacement}“.',
  'spron.removed': '🗑️ „{term}“ vom Server entfernt.',
  'spron.notFound': 'Der Server hat keine Aussprache für „{term}“.',
  'spron.limitHit':
    '🔒 Der Server hat sein Limit von **{limit}** Aussprachen erreicht. Entferne eine mit `/server-pronunciation remove`.',
  'spron.modalTitle': 'Server-Aussprache',
  'spron.modalSay': 'Wie Vozen es für alle sagt',
  'rand.selectPrompt': '🎲 **Randomizer** — aus wie vielen Optionen soll ich wählen?',
  'rand.selectPlaceholder': 'Anzahl der Optionen…',
  'rand.selectOption': '{n} Optionen',
  'rand.filling': '📝 Fülle das Formular aus, das gerade geöffnet wurde!',
  'rand.modalTitle': 'Randomizer — {amount} Optionen',
  'rand.modalOption': 'Option {n}',
  'rand.needTwo': 'Gib mir mindestens 2 Optionen, durch Kommas getrennt (z. B. „Pizza, Sushi“).',
  'rand.result': 'Aus {count} Optionen wähle ich… **{winner}**!',
  'rand.speak': 'Ich wähle… {winner}!',
  'rand.notInVoice':
    '_(tritt mit mir einem Sprachkanal bei und ich sage es beim nächsten Mal laut)_',
  'rand.timeout': '⏰ Nichts gewählt — führe `/randomizer` erneut aus, wenn du bereit bist.',
};
