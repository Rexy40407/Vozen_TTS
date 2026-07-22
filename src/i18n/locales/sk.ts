export default {
  'error.generic': 'Niečo sa pokazilo. Skús to prosím znova.',
  'error.needManageGuild': 'Na to potrebuješ oprávnenie **Spravovať server**.',
  'join.needVoiceChannel': 'Najprv sa pripoj do hlasového kanála a potom spusti /join.',
  'join.missingPerms': 'V kanáli {channel} potrebujem oprávnenia **Pripojiť sa** a **Hovoriť**.',
  'join.joined':
    '✅ Som v kanáli {channel}! Ďalší krok: napíš `/tts hello` a prečítam to nahlas. Chceš, aby som automaticky čítal kanál? Spusti /setup.',
  'join.joinedAutoread':
    '✅ Som v kanáli {channel}! Všetko je pripravené. Píš do kanála na automatické čítanie a prečítam to nahlas. → {readChannel}',
  'leave.left': 'Odišiel som z hlasového kanála. Dovidenia nabudúce!',
  'skip.notInVoice':
    'Ešte nie som v hlasovom kanáli — pripoj sa do jedného a najprv spusti /join, potom skús znova.',
  'skip.skipped': 'Preskočené.',
  'skip.nothing': 'Práve sa nič neprehráva.',
  'tts.notInVoice':
    'Ešte nie som v hlasovom kanáli — pripoj sa do jedného a spusti /join, potom skús znova.',
  'tts.nothingToRead': 'Nie je tam čo čítať — pošli mi nejaký text na prečítanie.',
  'tts.nothingAfterClean':
    'Po úprave už neostalo nič na prečítanie — skús nejaký normálny text (písmená alebo slová).',
  'tts.tooFast': 'Hej, spomaľ trochu — skús to o chvíľu znova.',
  'tts.blocked': 'Ten text obsahuje zablokované slovo, takže som ho preskočil.',
  'tts.queued': 'Rozumiem — je to v poradí.',
  'tts.busy': 'Práve mám plné ruky práce — skús to o chvíľu znova.',
  'voice.unknownModel': 'Tento hlas nepoznám — pozri /voice list.',
  'voice.badSpeed':
    'Rýchlosť musí byť medzi 0.5 a 2.0 (1.0 je normálna). Skús `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Tvoj hlas je teraz **{name}** pri {speed}×. Skús `/tts hello`, aby si ho počul. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Nastavenie hlasu** — vyber možnosti nižšie a stlač **Uložiť**. Dovtedy sa nič nezmení.',
  'voice.config.summary': 'Aktuálny výber: **{voice}** · modul **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Jazyk…',
  'voice.config.pickVoice': 'Hlas…',
  'voice.config.pickEngine': 'Modul…',
  'voice.config.pickSpeed': 'Rýchlosť…',
  'voice.config.more': '▼ Ďalšie jazyky',
  'voice.config.engDefault': 'Predvolené (miestne)',
  'voice.config.save': 'Uložiť',
  'voice.config.cancel': 'Zrušiť',
  'voice.config.cancelled': 'Nastavenie zrušené — nič sa nezmenilo.',
  'voice.config.expired':
    'Platnosť panela vypršala — pre pokračovanie znova spusti `/voice config`.',
  'voice.listHeader': 'Dostupné hlasy:',
  'voice.listEmpty': '(žiadne nainštalované)',
  'voice.reset':
    '✅ Tvoj hlas je späť na predvolený. Iný si môžeš kedykoľvek vybrať cez `/voice list` a `/voice set`.',
  'voice.optout': 'Už ťa nebudem čítať automaticky. Spusti /voice opt-in, aby si to znova zapol.',
  'voice.optin': 'Znova ťa budem čítať automaticky.',
  'voice.notInVoice': 'Ešte nie som v hlasovom kanáli — najprv spusti /join.',
  'voice.previewPlaying': 'Prehrávam ukážku…',
  'preview.sample': 'Ahoj, som Vozen. Napíš to, počuj to.',
  'laugh.playing': 'Haha! Prehrávam to tvojím hlasom…',
  'joke.playing': 'Rozprávam vtip…\n> {joke}',
  'joke.unknownLang': 'Tento jazyk nepoznám. Vyber si jeden zo zoznamu.',
  'voice.abbrev.added': 'Rozumiem — {term} sa bude čítať ako {replacement}.',
  'voice.abbrev.removed': 'Odstránil som tvoju skratku pre {term}.',
  'voice.abbrev.listHeader': 'Tvoje osobné skratky (použité {count}/{cap}):',
  'voice.abbrev.listEmpty': '(zatiaľ žiadne — pridaj jednu cez /voice abbrev add)',
  'voice.abbrev.capReached':
    'Dosiahol si limit {cap} osobných skratiek. Pred pridaním ďalšej jednu odstráň.',
  'voice.abbrev.invalidTerm':
    'Výraz musí byť jedno slovo (iba písmená a číslice), najviac 50 znakov.',
  'voice.abbrev.emptyReplacement': 'Čítanie nemôže byť prázdne.',
  'voice.abbrev.tooLong': 'Čítanie je príliš dlhé (najviac 200 znakov).',
  'config.wordEmpty': 'Slovo nemôže byť prázdne.',
  'config.blocked': 'Zablokované: {word}.',
  'config.unblocked': 'Odblokované: {word}.',
  'config.pronListHeader': 'Slovník výslovnosti:',
  'config.pronEmptyValue': '(prázdne)',
  'config.listEmpty': '(žiadne)',
  'config.termEmpty': 'Výraz nemôže byť prázdny.',
  'config.pronEmpty': 'Výslovnosť nemôže byť prázdna.',
  'config.pronSet': 'Rozumiem — {term} sa bude čítať ako {replacement}.',
  'config.pronRemoved': 'Odstránil som výslovnosť pre {term}.',
  'config.channelWrongType': 'Vyber textový kanál (nie hlasový kanál ani kategóriu).',
  'config.channelNoAccess': 'Nevidím {channel} — skontroluj prosím moje oprávnenia tam.',
  'config.channelSet':
    'Kanál na automatické čítanie nastavený na {channel}. Ďalej: uisti sa, že automatické čítanie je zapnuté cez `/config auto-read active:true`.',
  'config.autoreadOn': 'Automatické čítanie je teraz **zapnuté**.',
  'config.autoreadOff': 'Automatické čítanie je teraz **vypnuté**.',
  'config.maxCharsRange': 'Hodnota max-znakov musí byť medzi 1 a 2000.',
  'config.maxCharsSet': 'Maximálny počet znakov na správu nastavený na {value}.',
  'config.rateLimitRange': 'Hodnota limitu rýchlosti musí byť medzi 1 a 120.',
  'config.rateLimitSet': 'Limit rýchlosti nastavený na {value} správ za minútu.',
  'config.roleSet': 'Automatické čítanie je teraz obmedzené na členov s rolou {role}.',
  'config.roleCleared': 'Obmedzenie roly odstránené — teraz môže byť čítaný každý.',
  'config.enabledOn': 'TTS je teraz **zapnuté** pre tento server.',
  'config.enabledOff': 'TTS je teraz **vypnuté** pre tento server.',
  'config.defaultVoiceSet':
    '✅ Predvolený hlas servera nastavený na **{name}**. Členovia bez vlastného hlasu budú počuť tento. (id: `{model}`)',
  'config.reset':
    'Konfigurácia obnovená na predvolené hodnoty. Tvoj zoznam zablokovaných slov a výslovnosti boli zachované.',
  'config.showTitle': '**Konfigurácia servera**',
  'config.showChannel': 'TTS kanál: {value}',
  'config.showAutoread': 'Automatické čítanie: {value}',
  'config.showRole': 'Rola: {value}',
  'config.showEnabled': 'Zapnuté: {value}',
  'config.showVoice': 'Predvolený hlas: {value}',
  'config.showMaxChars': 'Maximálny počet znakov: {value}',
  'config.showRateLimit': 'Limit rýchlosti: {value}/min',
  'config.showBlocklist': 'Zoznam zablokovaných: {count} slov',
  'config.showPronunciation': 'Výslovnosti: {count} záznamov',
  'config.valueNone': '(žiadne)',
  'config.valueAny': 'ktokoľvek',
  'config.valueAutoDetect': '(automatická detekcia)',
  'config.on': 'zapnuté',
  'config.off': 'vypnuté',
  'config.language.set': 'Jazyk rozhrania nastavený na {language}.',
  'config.language.unsupported': 'Tento jazyk zatiaľ nie je podporovaný.',
  'setup.noChannel':
    'Nedokázal som určiť, ktorý kanál použiť. Zadaj textový kanál v možnosti "channel".',
  'setup.channelWrongType':
    'Kanál na automatické čítanie musí byť textový kanál (nie hlasový kanál ani kategória). Zadaj jeden v možnosti "channel".',
  'setup.done': '**Všetko nastavené — Vozen je pripravený.**',
  'setup.channelLine': 'Kanál na automatické čítanie: {channel}',
  'setup.autoreadOn': 'Automatické čítanie: zapnuté',
  'setup.permsHeader': '**Oprávnenia:**',
  'setup.permView': 'ViewChannel (vidieť textový kanál)',
  'setup.permSend': 'SendMessages (písať do textového kanála)',
  'setup.permConnect': 'Connect (pripojiť sa do hlasového kanála)',
  'setup.permSpeak': 'Speak (hovoriť v hlasovom kanáli)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — chýba',
  'setup.permUnchecked': '⏳ {label} — zatiaľ neskontrolované (overím to pri /join)',
  'setup.fixHint':
    'Ako opraviť to, čo chýba: v nastaveniach servera otvor rolu Vozen (alebo oprávnenia kanála) a zapni položky označené ❌.',
  'setup.voiceUncheckedNote':
    'Nie si v hlasovom kanáli, takže som zatiaľ nemohol skontrolovať Connect/Speak — overím ich, keď spustíš /join.',
  'setup.allGood': 'Všetko je pripravené. Pripoj sa do hlasového kanála a spusti /join.',
  'setup.joinedVoice': 'Pripojil som sa aj do {channel} — nemusíš spúšťať /join.',
  'setup.readyTalk':
    'Všetko je pripravené. Píš do kanála na automatické čítanie a prečítam to nahlas.',
  'setup.membersHeader': '**Povedz svojim členom (3-krokový postup):**',
  'setup.membersBody':
    '1) Pripoj sa do hlasového kanála\n2) Spusti /join, aby som sa pripojil s tebou\n3) Píš do tohto kanála (alebo použi /tts) a prečítam to nahlas\nÚplný zoznam príkazov: /help',
  'stats.title': '**Štatistiky Vozen**',
  'stats.messagesSpoken': 'Prečítané správy: {value}',
  'stats.cacheHits': 'Zásahy do vyrovnávacej pamäte: {value}',
  'stats.cacheMisses': 'Minutia vyrovnávacej pamäte: {value}',
  'stats.synthErrors': 'Chyby syntézy: {value}',
  'stats.voiceDrops': 'Výpadky hlasu: {value}',
  'stats.voiceReconnects': 'Opätovné pripojenia: {value}',
  'stats.votes': 'Hlasy na top.gg: {value}',
  'stats.activePlayers': 'Aktívne prehrávače: {value}',
  'stats.servers': 'Servery: {value}',
  'stats.uptime': 'Čas prevádzky: {value}s',
  'invite.noClientId':
    'Pozývací odkaz Vozen ešte nie je nastavený (chýba CLIENT_ID). Daj vedieť správcovi bota.',
  'invite.link': 'Pridaj Vozen na svoj server:\n{url}',
  'vote.noClientId':
    'Hlasovací odkaz Vozen ešte nie je nastavený (chýba CLIENT_ID). Daj vedieť správcovi bota.',
  'vote.link':
    'Zahlasuj za Vozen (zadarmo, každých 12h) a pomôž viacerým ľuďom ho objaviť:\n{url}\nAk tento účet odmenu ešte nikdy nevyužil, získa **48 hodín Vozen Plus**, iba raz na účet.',
  'help.title': 'Vozen — napíš to, počuj to.',
  'help.embedTitle': 'Vozen — Príkazy',
  'help.intro':
    'Vozen číta tvoj text nahlas v hlasových kanáloch — bezplatné neurónové hlasy, desiatky jazykov.',
  'help.quickStartTitle': 'Rýchly štart (3 kroky)',
  'help.quickStartBody':
    '1) Pripoj sa do hlasového kanála a spusti /join\n2) Píš do textového kanála (alebo použi /tts Ahojte všetci!)\n3) (voliteľné) Vyber si hlas cez /voice set',
  'help.groupStarted': 'Začíname',
  'help.groupStartedBody':
    '• /join — pripojím sa do tvojho hlasového kanála\n• /leave — odídem z hlasového kanála\n• /tts <text> — prečítam text nahlas · napr. /tts Ahojte všetci!\n• /skip — preskočím to, čo práve čítam',
  'help.groupVoice': 'Tvoj hlas',
  'help.groupVoiceBody':
    '• /voice set <model> — vyber si svoj hlas · napr. /voice set en_US-amy-medium\n• /voice list — pozri dostupné hlasy\n• /voice preview — vypočuj si ukážku svojho hlasu\n• /voice reset — vráť sa na predvolený hlas\n• /voice opt-out · /voice opt-in — vypni / zapni automatické čítanie pre teba\n• /voice abbrev add|remove|list — osobný slang, čítaný po tvojom (až 10)',
  'help.groupFun': 'Zábava',
  'help.groupFunBody':
    '• /joke — poviem krátky vtip (vyber jazyk + voliteľne smiech) · napr. /joke English\n• /laugh — zasmejem sa nahlas tvojím aktuálnym hlasom',
  'help.groupAdmin': 'Správa servera (potrebuje Spravovať server)',
  'help.groupAdminBody':
    '• /setup — sprievodca nastavením v jednom kroku · spusti toto ako prvé\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · napr. /config tts-channel #general\n• /stats — štatistiky bota',
  'help.groupMore': 'Viac',
  'help.groupMoreBody':
    '• /invite — pridaj Vozen na iný server\n• /vote — zahlasuj za Vozen na top.gg\n• /help — zobraz tohto pomocníka',
  'help.footer': 'Prvýkrát tu? Spusti {command} a začni.',
  'welcome.title': 'Ďakujeme, že si pridal Vozen! 👋',
  'welcome.description':
    'Vozen číta tvoj chat nahlas v hlasových kanáloch — napíš to, počuj to.\n\n**Začni v jednom kroku:** spusti {setup} a nastavím automatické čítanie a pripojím sa do tvojho hlasového kanála.\n\nPotrebuješ úplný zoznam príkazov? Spusti {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Ako to členovia používajú (3 kroky)',
  'welcome.stepsBody':
    '1) Pripoj sa do hlasového kanála\n2) Spusti /join, aby som sa pripojil k tebe\n3) Píš do textového kanála (alebo použi /tts) a prečítam to nahlas\nÚplný zoznam príkazov: /help',
  'welcome.footer': 'Vozen — napíš to, počuj to.',
  'welcome.tagline': 'Prirodzený neurónový hlas — zadarmo navždy, žiadny paywall.',
  'stt.guildOnly': 'Prepis funguje len vnútri servera.',
  'stt.noManage':
    'Na spustenie alebo zastavenie prepisu potrebuješ oprávnenie **Spravovať server**.',
  'stt.notPremium':
    '🎙️ Živý prepis je **Premium** funkcia. Odomkni ju pre tento server cez `/premium info`.',
  'stt.unavailable':
    'Prepis nie je na tejto inštancii dostupný (nie je nainštalovaný prevod reči na text).',
  'stt.notInVoice':
    'Nie som v hlasovom kanáli — najprv sa do jedného pripoj a spusti `/join`, potom spusti prepis.',
  'stt.alreadyRunning': 'Prepis na tomto serveri už beží. Najprv použi `/transcribe stop`.',
  'stt.atCapacity':
    'Práve teraz beží naprieč všetkými servermi príliš veľa prepisov. Skús to prosím o chvíľu.',
  'stt.noChannel':
    'V tomto kanáli nemôžem uverejňovať prepisy. Skús príkaz spustiť z bežného textového kanála.',
  'stt.started':
    '✅ Prepis spustený. Každý, kto v oznámení stlačí **Súhlasím**, bude prepisovaný do tohto kanála.',
  'stt.startFailed':
    'Prepis sa nepodarilo spustiť (nepodarilo sa uverejniť oznámenie). Všetko som vrátil späť — nič sa nenahráva. Skús to prosím znova.',
  'stt.announceStart':
    '🎙️ **Živý prepis je v tomto kanáli ZAPNUTÝ.** Prepisujú sa len ľudia, ktorí súhlasia — stlač tlačidlo nižšie a povoľ, aby sa tvoja reč sem zapisovala. Súhlas môžeš kedykoľvek odvolať cez `/transcribe revoke`.',
  'stt.consentBtn': 'Súhlasím s prepisom',
  'stt.consentThanks':
    '✅ Vďaka — tvoja reč sa teraz na tomto serveri bude prepisovať. Súhlas kedykoľvek odvoláš cez `/transcribe revoke`.',
  'stt.stopped': '🛑 Prepis zastavený.',
  'stt.notRunning': 'Prepis na tomto serveri nebeží.',
  'stt.announceStop': '🛑 **Živý prepis je teraz VYPNUTÝ.** Prestal som počúvať.',
  'stt.revoked':
    '✅ Súhlas odvolaný — na tomto serveri už nebudeš prepisovaný. (Už uverejnené správy zostávajú; ak chceš, zmaž ich v Discorde.)',
  'stt.revokeNone': 'S prepisom na tomto serveri si nesúhlasil, takže nebolo čo odvolať.',
  'privacy.eraseConfirm':
    '⚠️ Toto natrvalo zmaže **všetky** tvoje dáta Vozenu na všetkých serveroch: nastavenia hlasu, vyslovovanú prezývku, osobné skratky a výslovnosti, uložené narodeniny, skóre v hrách, štatistiky rozprávania a opt-out. **Toto sa nedá vrátiť späť.** Si si istý?',
  'privacy.erasePremiumNote':
    '_Poznámka: tvoj zaplatený Premium/Plus a história jeho nákupu zostávajú — patria tebe a zákonom vyžadovaným finančným záznamom. Ak chceš Premium ukončiť, nechaj ho vypršať alebo kontaktuj podporu._',
  'privacy.eraseYes': 'Zmazať všetko',
  'privacy.eraseNo': 'Zrušiť',
  'privacy.eraseCancelled': 'Zrušené — nič nebolo zmazané.',
  'privacy.eraseDone': '✅ Hotovo. Všetky tvoje osobné dáta boli natrvalo zmazané.',
  'shutup.notInVoice':
    'Ešte nie som v hlasovom kanáli — najprv sa do jedného pripoj a spusti /join.',
  'shutup.nothing': 'Práve sa nič neprehráva.',
  'shutup.done': '🤐 Dobre, prestanem — vyprázdnil som celé poradie.',
  'voice.detection.on':
    '✅ Automatická detekcia jazyka je ZAPNUTÁ: každá správa sa číta hlasom podľa rozpoznaného jazyka (hovoriaci sa môže meniť). Vypni ju cez `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automatická detekcia jazyka je VYPNUTÁ: všetko číta tvoj jeden pevný hlas, takže znieš stále rovnako.',
  'voice.nickname.set': '✅ Vozen ťa teraz nahlas bude volať **{name}**.',
  'voice.nickname.cleared':
    '✅ Vyslovovaná prezývka odstránená — Vozen použije tvoje meno na serveri.',
  'voice.nickname.invalid':
    'To meno nemá nič čitateľné, čo by sa dalo povedať nahlas. Skús písmená alebo čísla.',
  'voice.effect.set':
    '✅ Hlasový efekt nastavený na **{effect}** — tvoje správy sa teraz prehrávajú s týmto efektom. Vypni ho cez `/voice effect none`.',
  'voice.effect.cleared': '✅ Hlasový efekt odstránený — zase čistý hlas.',
  'voice.effect.locked':
    '🔒 **{effect}** je Premium efekt. Efekty zadarmo: 🤖 Robot a 🔊 Echo. Odomkni všetky s Vozen Premium — pozri `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** je Premium hlasový engine. Odomkni ho s Vozen Plus (osobný) alebo Vozen Premium (server) — pozri `/premium`. Dovtedy tvoj hlas zostáva na bezplatnom lokálnom engine.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** je Premium hlasový engine. Odomkni ho s Vozen Plus (osobný) alebo Vozen Premium (server) — pozri `/premium`. Dovtedy tvoj hlas zostáva na bezplatnom lokálnom engine.',
  'rizz.playing': '😏 Rozdávam zbaľovacie hlášky…\n> {line}',
  'rizz.unknownLang': 'Ten jazyk nepoznám. Vyber si jeden zo zoznamu.',
  'rizz.locked':
    '🔒 **/rizz** je Premium výhoda. Odomkni ju s Vozen Plus (ty) alebo Premium (tento server). Pozri `/premium`.',
  'sound.playing': '🔊 Prehrávam **{name}**…',
  'sound.unknown': 'Ten zvuk nemám. Zoznam zobrazíš cez `/sound`.',
  'sound.list':
    '🔊 **Zvuky:** {sounds}\nNejaký prehráš cez `/sound name:<sound>` (musím byť v tvojom hlasovom kanáli).',
  'sound.disabled':
    '🔇 Soundboard je na tomto serveri **vypnutý**. Admin ho môže zapnúť cez `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Narodeniny uložené: **{day}/{month}**. V ten deň ti zaželám všetko najlepšie, keď sa pripojíš do hlasového kanála!',
  'birthday.invalid': 'To nie je platný dátum. Skontroluj deň a mesiac.',
  'birthday.cleared': '🎂 Narodeniny odstránené.',
  'birthday.show': '🎂 Tvoje narodeniny sú nastavené na **{day}/{month}**.',
  'birthday.none': 'Zatiaľ si si nenastavil narodeniny. Použi `/birthday set`.',
  'topspeakers.title': '🗣️ **Najaktívnejší hovoriaci** — koho na tomto serveri najviac čítam:',
  'topspeakers.empty': 'Zatiaľ som nikomu nečítal správy. Nastav si kanál na čítanie cez `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** správ · 🔥 séria {streak} dní',
  'serverstats.title': '📊 **Štatistiky servera**',
  'serverstats.empty':
    'Zatiaľ žiadne štatistiky — nečítal som tu žiadne správy ani nespustil žiadne hry. Nastav to cez `/setup`!',
  'serverstats.messages': '🗣️ **{total}** prečítaných správ · **{speakers}** ľudí',
  'serverstats.topTalkers': '**Najzhovorčivejší:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} správ · 🔥 {streak}d',
  'serverstats.streak': '🔥 Najdlhšia aktívna séria: **{days}** dní',
  'serverstats.games': '🎮 **{points}** herných bodov · **{wins}** výhier · **{players}** hráčov',
  'serverstats.topPlayers': '**Najlepší hráči:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} b. · {wins} výhier',
  'serverstats.upsell':
    '🔒 To je bezplatná ukážka. **Premium** odomkne série, herné štatistiky a kompletný top 5 — pozri `/premium`.',
  'streak.day': '🔥 <@{user}> má **{n}-dňovú** sériu! Rozprávaj ďalej, aby si ju udržal.',
  'leaderboard.autoTitle': '🏆 Najzhovorčivejší na tomto serveri',
  'premium.title': '💎 **Stav Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Server:** Premium do {date}',
  'premium.lineServerFree': '🖥️ **Server:** plán Free',
  'premium.lineUserActive': '👤 **Ty (Plus):** aktívny do {date}',
  'premium.lineUserFree': '👤 **Ty (Plus):** neaktívny',
  'premium.getHint':
    'Všetko, čo používaš dnes, zostáva zadarmo. Premium pridáva všetkých 8 hlasových efektov, 24/7 v hovore, 50 osobných výslovností, /rizz a prémiové hry. Podpora: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Tvoj Premium pass:** {used}/{total} licencií v používaní · vyprší {date}',
  'premium.passServers': '↳ Používa sa na: {servers}',
  'premium.pitch':
    'Zatiaľ nemáš Premium. **Vozen Premium** (€3.99/mes za 3 servery alebo €7.99/mes za 8) odomyká pre celý server: všetkých 8 hlasových efektov, 24/7 v hovore, 50 osobných výslovností (oproti 3), príkaz /rizz a prémiové hry (Reťaz slov, Wordle, Šach). **Vozen Plus** (€1.99/mes) ti tieto výhody dá osobne, na akomkoľvek serveri.',
  'premium.buyHint':
    '▶ **Získaj Premium:** {link}\nPo kúpe spusti `/premium activate` na serveri, ktorý chceš.',
  'premium.confirmActivate':
    'Použiť **1 z tvojich {total} Premium licencií** na **tomto serveri**? Práve teraz máš **{used}** v používaní. Neskôr ju môžeš uvoľniť cez `/premium deactivate` — čas passu tak či tak beží ďalej.',
  'premium.confirmYes': '💎 Použiť licenciu',
  'premium.confirmNo': 'Zrušiť',
  'premium.activateOk':
    '✅ Premium je teraz aktívny na **tomto serveri** do {date}. Licencie: **{used}/{total}** v používaní.',
  'premium.activateCancelled': 'Zrušené — žiadna licencia nebola použitá.',
  'premium.activateTimeout': 'Čas vypršal — žiadna licencia nebola použitá.',
  'premium.noPass':
    'Nemáš aktívny Premium pass. Zaobstaraj si ho a pristane na tvojom účte — potom tu spusti `/premium activate`.\n▶ {link}',
  'premium.alreadyActive': 'Tento server už jednu z tvojich Premium licencií má. Nie je čo robiť.',
  'premium.noSeats':
    'Všetkých tvojich **{total}** Premium licencií sa používa ({servers}). Uvoľni tam jednu cez `/premium deactivate` a potom to skús znova tu.',
  'premium.needManageGuild':
    'Aktivácia Premium ovplyvní celý server — môžu to urobiť len členovia s oprávnením **Spravovať server**. Požiadaj admina.',
  'premium.deactivateOk':
    '✅ Uvoľnil som Premium licenciu tohto servera. Použi ju na inom serveri cez `/premium activate`.',
  'premium.deactivateNone':
    'Tento server nemá žiadnu tvoju Premium licenciu, ktorú by bolo možné uvoľniť.',
  'premium.thisServer': 'tento server',
  'grant.denied': '⛔ Tento príkaz je len pre vlastníka bota.',
  'grant.okPremium':
    '✅ Pridelil som <@{user}> **Premium pass** ({seats} licencií) na **{days}** dní — vyprší {date}. Aktivuje ho cez `/premium activate`.',
  'grant.okPlus': '✅ Pridelil som <@{user}> **Vozen Plus** na **{days}** dní — vyprší {date}.',
  'gencode.done':
    '✅ Vygenerovaných **{count}** kódov {plan}, každý na **{days}** dní. Zdieľaj ich súkromne:\n{list}',
  'redeem.okPlus': '🎁 Uplatnené! Získal si **Vozen Plus** na **{days}** dní — vyprší {date}.',
  'redeem.okPremium':
    '🎁 Uplatnené! Získal si **Premium pass** ({seats} licencií) na **{days}** dní — vyprší {date}. Aktivuj ho na svojom serveri cez `/premium activate`.',
  'redeem.notFound': '❌ Taký kód neexistuje. Skontroluj ho a skús to znova.',
  'redeem.used': '❌ Tento kód už bol uplatnený.',
  'redeem.expired': '❌ Platnosť tohto kódu vypršala.',
  'config.blockLimit':
    'Tento server už má maximum {max} zablokovaných slov. Pred pridaním ďalšieho jedno odstráň.',
  'config.xsaidOn':
    'Vozen teraz pred každou správou oznámi, **kto hovoril** (napr. "Alex povedal ahoj"). Vypni cez `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **už nebude** oznamovať, kto hovoril — číta len správu.',
  'config.autojoinOn':
    '✅ Automatické pripojenie **zapnuté** — Vozen sa pripojí do tvojho hlasového kanála, keď napíšeš do TTS kanála.',
  'config.autojoinOff':
    'Automatické pripojenie **vypnuté** — použi `/join`, aby si priviedol Vozen do hlasu.',
  'config.stayOn':
    '✅ 24/7 v hovore **zapnuté** — Vozen zostane v hlasovom kanáli, aj keď sa vyprázdni, a vráti sa po reštarte. 💎 Aby to fungovalo, je potrebný Premium (kúp si ho alebo uplatni kód cez `/redeem`, potom `/premium activate`).',
  'config.stayOff':
    '24/7 v hovore **vypnuté** — Vozen odíde, keď sa hlasový kanál vyprázdni (predvolené).',
  'config.readBotsOn': '✅ Vozen teraz bude čítať aj správy od **iných botov a webhookov**.',
  'config.readBotsOff':
    'Vozen bude **ignorovať** iné boty a webhooky (čítajú sa len skutoční ľudia).',
  'config.textInVoiceOn': '✅ Vozen bude čítať aj **textový chat vnútri svojho hlasového kanála**.',
  'config.textInVoiceOff': 'Vozen **nebude** čítať textový chat hlasového kanála (len TTS kanál).',
  'config.antispamOn':
    '✅ Anti-spam **zapnutý** — Vozen nebude čítať spamované správy (hromadné opakovanie slov alebo tú istú veľkú správu posielanú stále dokola).',
  'config.antispamOff': 'Anti-spam **vypnutý** — Vozen číta každú správu ako obvykle.',
  'config.streaksOn':
    '✅ Oznámenia sérií **zapnuté** — Vozen ukáže správu so sériou 🔥 pri prvom prehovorení každej osoby v daný deň.',
  'config.streaksOff':
    'Oznámenia sérií **vypnuté** — Vozen série stále počíta (pozri `/top-speakers`), ale mlčí o nich.',
  'config.soundboardOn': 'Soundboard **zapnutý** — ktokoľvek môže prehrávať klipy cez `/sound`.',
  'config.soundboardOff': 'Soundboard **vypnutý** — `/sound` je na tomto serveri zakázaný.',
  'config.votePromosLabel': 'Upozornenia na odmenu top.gg + Vozen Support',
  'config.greetOn': '✅ Budem ľudí zdraviť menom, keď sa pripoja do hlasového kanála.',
  'config.greetOff': '🔇 **Nebudem** ľudí zdraviť, keď sa pripoja do hlasového kanála.',
  'config.greetLangSet': '✅ Jazyk pozdravu pri pripojení nastavený na **{language}**.',
  'config.showXsaid': 'Oznamovať hovoriaceho (xsaid): {value}',
  'config.showAutojoin': 'Automatické pripojenie: {value}',
  'config.showReadBots': 'Čítať boty/webhooky: {value}',
  'config.showTextInVoice': 'Text v hlase: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': 'Zdraviť pri pripojení: {value} ({language})',
  'stats.synthLatency': 'Latencia syntézy: p50 {p50}ms / p95 {p95}ms ({count} vzoriek)',
  'speak.emptyMessage': 'Táto správa nemá žiadny text na čítanie nahlas.',
  'uptime.text': '🟢 Vozen je online už **{uptime}**.',
  'botstats.title': '📊 **Vozen — štatistiky**',
  'botstats.servers': 'Servery: **{value}**',
  'botstats.voiceSessions': 'Hlasové relácie teraz: **{value}**',
  'botstats.messagesSpoken': 'Prečítané správy: **{value}**',
  'botstats.uptime': 'Čas prevádzky: **{value}**',
  'invite.button': 'Pridať Vozen',
  'vote.button': 'Hlasovať na top.gg',
  'vote.upsell':
    '🗳️ Ak tento účet odmenu ešte nikdy nevyužil, získa **48 hodín Vozen Plus**, iba raz na účet. {url}',
  'vote.cooldownStatus':
    '🗳️ Tento účet už jednorazovú odmenu za hlas využil. Stále môžeš hlasovať na podporu Vozenu, ale ďalší Plus nezískaš.',
  'help.support': '🛟 Potrebuješ pomoc alebo chceš nahlásiť problém? {url}',
  'help.source': '📄 Otvorený zdroj (AGPL-3.0) — získaj presný zdrojový kód, ktorý tu beží: {url}',
  'game.start.needVoice':
    'Toto je **hlasová hra** — najprv sa pripoj do hlasového kanála a spusti /join, potom ju začni.',
  'game.start.alreadyActive':
    'V <#{channel}> už beží hra. Dokonči ju (alebo použi `/game stop`), než začneš ďalšiu.',
  'game.start.premiumLocked':
    '🔒 **{game}** je Premium hra (stojí to skutočný výpočtový výkon). Pozri `/premium`.',
  'game.start.started': '🎮 Spúšťam **{game}**! Sleduj kanál — veľa šťastia!',
  'game.start.startedThread':
    '🎮 **{game}** začala v <#{channel}> — pridaj sa tam! Vlákno sa samo zmaže, keď hra skončí.',
  'game.thread.winner': '🏆 {winner} vyhral hru!',
  'game.thread.ended': '🎮 Hra skončila.',
  'game.unknownGame': 'Túto hru nepoznám. Vyber si jednu zo zoznamu.',
  'game.stop.ok': '🛑 Zastavil som aktuálnu hru.',
  'game.stop.none': 'Práve teraz nebeží žiadna hra.',
  'game.list.title': '🎮 **Hry** — nejakú spusti cez `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Rebríček** — najlepší hráči na tomto serveri:',
  'game.leaderboard.empty': 'Zatiaľ sa nehralo. Buď prvý — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** b. ({wins} výhier)',
  'game.finish.title': '🏁 **Koniec hry!** Konečné skóre:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Koniec hry — tentokrát nikto neskóroval. Nabudúce!',
  'game.finish.winnerVoice': '{user} vyhráva!',
  'game.guessLanguage.name': 'Uhádni jazyk',
  'game.guessLanguage.desc': 'Prečítam vetu v náhodnom jazyku — kto ho prvý pomenuje, získava bod.',
  'game.guessLanguage.intro':
    '🗣️ **Uhádni jazyk** — prečítam {rounds} viet. Napíš, ktorý jazyk počuješ. Každé kolo vyhrá najrýchlejšia správna odpoveď!',
  'game.guessLanguage.round': '🎧 Kolo {n}/{total} — počúvaj…',
  'game.guessLanguage.correct': '✅ **{user}** to má — bol to **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Čas vypršal! Bol to **{language}**.',
  'game.guessLanguage.noLanguages':
    'Nemám nainštalovaných dosť hlasov, aby som toto mohol hrať. Požiadaj admina, nech pridá viac hlasov.',
  'game.math.name': 'Počítanie z hlavy',
  'game.math.desc': 'Poviem príklad nahlas — kto prvý napíše výsledok, vyhráva.',
  'game.math.intro':
    '🔢 **Počítanie z hlavy** — {rounds} príkladov. Počúvaj a napíš výsledok čo najrýchlejšie!',
  'game.math.round': '🧮 Kolo {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** to trafil — výsledok bol **{answer}**!',
  'game.math.timeout': '⏱️ Čas vypršal! Výsledok bol **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'mínus',
  'game.math.times': 'krát',
  'game.skipCount.name': 'Chýbajúce číslo',
  'game.skipCount.desc': 'Počítam nahlas, ale jedno číslo vynechám — kto ho prvý chytí, vyhráva.',
  'game.skipCount.intro':
    '🔢 **Chýbajúce číslo** — počítam, ale jedno vynechám. Napíš chýbajúce číslo! ({rounds} kôl)',
  'game.skipCount.round': '👂 Kolo {n}/{total} — ktoré číslo som vynechal?',
  'game.skipCount.correct': '✅ **{user}** to chytil — vynechal som **{answer}**!',
  'game.skipCount.timeout': '⏱️ Čas vypršal! Vynechal som **{answer}**.',
  'game.spelling.name': 'Hláskovanie',
  'game.spelling.desc': 'Poviem slovo — kto ho prvý správne napíše, vyhráva.',
  'game.spelling.intro': '✍️ **Hláskovanie** — poviem {rounds} slov. Napíš každé z nich správne!',
  'game.spelling.round': '🗣️ Kolo {n}/{total} — napíš slovo, ktoré poviem…',
  'game.spelling.correct': '✅ **{user}** napísal **{word}** správne!',
  'game.spelling.timeout': '⏱️ Čas vypršal! Slovo bolo **{word}**.',
  'game.spelling.empty': 'Zatiaľ nemám zoznam slov pre jazyk hlasu tohto servera.',
  'game.spellOut.name': 'Zlož slovo z písmen',
  'game.spellOut.desc': 'Hláskujem slovo písmeno po písmene — kto prvý napíše celé slovo, vyhráva.',
  'game.spellOut.intro':
    '🔡 **Zlož slovo z písmen** — hláskujem {rounds} slov písmeno po písmene. Napíš celé slovo!',
  'game.spellOut.round': '🔤 Kolo {n}/{total} — počúvaj písmená…',
  'game.spellOut.correct': '✅ **{user}** to má — **{word}**!',
  'game.spellOut.timeout': '⏱️ Čas vypršal! Hláskovalo sa **{word}**.',
  'game.fastSpeech.name': 'Rýchla reč',
  'game.fastSpeech.desc': 'Prečítam vetu super rýchlo — kto prvý napíše, čo som povedal, vyhráva.',
  'game.fastSpeech.intro':
    '💨 **Rýchla reč** — {rounds} viet neuveriteľnou rýchlosťou. Napíš, čo počuješ!',
  'game.fastSpeech.round': '⚡ Kolo {n}/{total} — už to ide, rýchlo!',
  'game.fastSpeech.correct': '✅ **{user}** to rozlúštil: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Čas vypršal! Bolo to: “{phrase}”',
  'game.fastSpeech.empty': 'Zatiaľ nemám frázy pre jazyk hlasu tohto servera.',
  'game.accentSwap.name': 'Smiešny prízvuk',
  'game.accentSwap.desc': 'Poviem slovo s cudzím prízvukom — kto ho prvý napíše, vyhráva.',
  'game.accentSwap.intro':
    '🎭 **Smiešny prízvuk** — {rounds} slov povedaných so zlým prízvukom. Napíš to slovo!',
  'game.accentSwap.round': '🌍 Kolo {n}/{total} — aké slovo sa snažím povedať?',
  'game.accentSwap.correct': '✅ **{user}** to má — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Čas vypršal! Slovo bolo **{word}**.',
  'game.reflexes.name': 'Reflexy',
  'game.reflexes.desc':
    'Odpočítavam a potom zakričím TERAZ — kto potom prvý napíše, vyhráva. Nepredbiehaj!',
  'game.reflexes.intro':
    '⚡ **Reflexy** — {rounds} kôl. Keď zakričím **TERAZ**, napíš čokoľvek čo najrýchlejšie. Ak napíšeš pred TERAZ, je to falošný štart!',
  'game.reflexes.ready': '🚦 Kolo {n}/{total} — priprav sa…',
  'game.reflexes.countdown': 'tri… dva… jeden…',
  'game.reflexes.go': '🟢 **TERAZ!!!**',
  'game.reflexes.goVoice': 'Teraz!',
  'game.reflexes.tooSoon': '🔴 **{user}** to uponáhľal — príliš skoro!',
  'game.reflexes.win': '⚡ **{user}** je najrýchlejší! Bod!',
  'game.reflexes.tooSlow': '😴 Nikto nezareagoval načas. Ďalej!',
  'game.headsOrTails.name': 'Panna alebo orol',
  'game.headsOrTails.desc':
    'Tipni si hod mincou — napíš panna alebo orol, kým hodím. Vyhráva ten, kto háda najlepšie!',
  'game.headsOrTails.intro':
    '🪙 **Panna alebo orol** — {rounds} kôl. V každom kole napíš `panna` alebo `orol`, kým hodím mincou. 1 bod za každý správny tip!',
  'game.headsOrTails.introVoice': 'Poďme hrať pannu alebo orla!',
  'game.headsOrTails.round': '🪙 Kolo {n}/{total} — panna alebo orol? Napíš svoj tip!',
  'game.headsOrTails.roundVoice': 'Panna… alebo orol?',
  'game.headsOrTails.heads': 'panna',
  'game.headsOrTails.tails': 'orol',
  'game.headsOrTails.resultVoice': 'Je to {side}!',
  'game.headsOrTails.winners': 'Je to **{side}**! Bod pre: {users}',
  'game.headsOrTails.noWinners': 'Je to **{side}**! Nikto netipoval správne — žiadne body.',
  'game.vozenSays.name': 'Vozen hovorí',
  'game.vozenSays.desc':
    'Poslúchni len vtedy, keď rozkaz začína na „Vozen hovorí“. Naletíš na pascu a si lapený!',
  'game.vozenSays.intro':
    '🫡 **Vozen hovorí** — {rounds} rozkazov. Splň to LEN vtedy, keď začnem na **„Vozen hovorí“**. Inak sa ani nepohni!',
  'game.vozenSays.prefix': 'Vozen hovorí',
  'game.vozenSays.verb': 'napíšte',
  'game.vozenSays.real': '🗣️ Kolo {n}/{total} — „{command}“',
  'game.vozenSays.trap': '🗣️ Kolo {n}/{total} — „{command}“',
  'game.vozenSays.obeyed': '✅ **{user}** poslúchol prvý — bod!',
  'game.vozenSays.caught': '🔴 **{user}** — nepovedal som Vozen hovorí! Lapený!',
  'game.vozenSays.nobody': '😴 Nikto nesplnil **{word}** načas. Ďalej!',
  'game.vozenSays.trapCleared': '😌 Bola to pasca — dobrý postreh, nikto na **{word}** nenaletel.',
  'game.roulette.name': 'Ruleta pravda alebo úloha',
  'game.roulette.desc':
    'Roztočím ruletu a nahlas prečítam jednu výzvu (pravda alebo úloha). Spusti to znova pre ďalšiu.',
  'game.roulette.header': '🎯 **Ruleta hovorí…**',
  'game.hangman.name': 'Obesenec',
  'game.hangman.desc': 'Hádaj slovo písmeno po písmene — 6 chýb a je koniec.',
  'game.hangman.intro':
    '🪢 **Obesenec** — hádaj slovo tak, že píšeš jedno písmeno po druhom. Môžeš skúsiť aj celé slovo!',
  'game.hangman.hit': '🟢 **{user}** našiel **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — žiadne **{letter}**.',
  'game.hangman.wrongLetters': 'Zle: {letters}',
  'game.hangman.win': '🎉 **{user}** to vyriešil — **{word}**!',
  'game.hangman.lose': '💀 Bez pokusov! Slovo bolo **{word}**.',
  'game.hangman.idle': '🕹️ Hra pozastavená (nikto nehrá). Slovo bolo **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Uhádni päťpísmenové slovo. 🟩 správne miesto, 🟨 zlé miesto, ⬛ nie je v slove. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — napíš päťpísmenové slovo. Zdieľate {max} pokusov. 🟩 správne miesto · 🟨 zlé miesto · ⬛ nie je v slove.',
  'game.wordle.guess': '🔤 **{user}** tipol — zostáva **{left}** pokusov',
  'game.wordle.inWord': '🟢 v slove: {letters}',
  'game.wordle.out': '🚫 mimo: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** to uhádol na {n} — **{word}**!',
  'game.wordle.lose': '💀 Bez pokusov! Slovo bolo **{word}**.',
  'game.wordle.idle': '🕹️ Hra pozastavená (nikto nehrá). Slovo bolo **{word}**.',
  'game.tictactoe.name': 'Piškvorky',
  'game.tictactoe.desc':
    'Dvaja hráči — napíš číslo 1-9 a umiestni svoju značku. Tri v rade vyhrávajú.',
  'game.tictactoe.intro':
    '⭕ **Piškvorky** — prví dvaja hráči, ktorí ťahajú, sú ❌ a ⭕ (❌ začína). Napíš číslo 1-9 a zahraj svoje políčko.',
  'game.tictactoe.turn': 'Na ťahu: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, na ťahu je **{mark}**.',
  'game.tictactoe.taken': '🚫 Políčko {cell} je obsadené — vyber iné.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) vyhráva!',
  'game.tictactoe.draw': '🤝 Remíza!',
  'game.tictactoe.idle': '🕹️ Hra skončila (nikto nehrá).',
  'game.chess.name': 'Šach',
  'game.chess.desc':
    'Dvaja hráči — skutočné šachové pravidlá (šach, rošáda, premena…). Napíš ťah ako "e4" alebo "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Šach** — prví dvaja hráči, ktorí ťahajú, hrajú za biele a čierne (biele začínajú). Napíš ťah v algebraickej notácii ("e4", "Nf3", "O-O") alebo súradnicami ("e2e4"). Napíš "resign" na vzdanie sa.',
  'game.chess.white': 'biele',
  'game.chess.black': 'čierne',
  'game.chess.seats': '⚪ Biele: **{white}** · ⚫ Čierne: **{black}**',
  'game.chess.turn': '{move} — na ťahu: **{color}**',
  'game.chess.check': '♟️ Šach!',
  'game.chess.notYourTurn': '⏳ **{user}**, na ťahu sú **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" nie je platný ťah — skús to znova.',
  'game.chess.checkmate': '🏆 Šach-mat ({move})! **{user}** vyhráva!',
  'game.chess.draw': '🤝 Remíza ({move})!',
  'game.chess.resigned': '🏳️ **{user}** sa vzdal — **{winner}** vyhráva!',
  'game.chess.idle': '🕹️ Hra skončila (nikto nehrá).',
  'game.wordChain.name': 'Reťaz slov',
  'game.wordChain.descr':
    'Reťaz slov na ťahy v jednom jazyku: povedz slovo, ktoré začína na poslednú literu toho predchádzajúceho. 2 životy, bez opakovania, čas sa zrýchľuje. Jazyk vyber cez voľbu `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Reťaz slov momentálne nie je dostupná v **{lang}** (chýba zoznam slov).',
  'game.wordChain.lobby':
    '🔗 **Reťaz slov** v **{lang}**! Napíš čokoľvek do tohto kanála do **{seconds}s**, aby si sa pridal.',
  'game.wordChain.notEnough': '😴 Nepridalo sa dosť hráčov (treba aspoň 2). Hra zrušená.',
  'game.wordChain.begin':
    '🚀 Začíname! Hráči: {players}. Každé slovo musí začínať na poslednú literu toho predchádzajúceho.',
  'game.wordChain.turn':
    '**{name}**, si na ťahu! **{lang}** slovo začínajúce na **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — ďalšia litera: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Musí začínať na **{letter}**.',
  'game.wordChain.bad.short': '📏 Príliš krátke — aspoň **{min}** písmen.',
  'game.wordChain.bad.repeated': '🔁 Toto slovo už bolo použité.',
  'game.wordChain.bad.word': '📖 To nie je v slovníku.',
  'game.wordChain.bad.latin': '🔤 Rátajú sa len písmená A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** vypršal čas! Zostáva {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** je vonku!',
  'game.wordChain.winner': '🏆 **{name}** vyhráva reťaz! ({chain} slov)',
  'game.stats.none': 'Zatiaľ si nehral žiadne hry. Skús `/game play`!',
  'game.stats.body': '🎮 **Tvoje štatistiky** — **{points}** bodov · **{wins}** výhier · {rank}',
  'game.stats.rank': 'pozícia **#{rank}** z {total}',
  'game.stats.unranked': 'zatiaľ bez pozície',
  'game.pickPrompt': '🎮 Ktorú hru chceš hrať? Vyber si:',
  'game.pickPlaceholder': 'Vyber hru…',
  'game.pickTimeout': '⏰ Žiadna hra nevybraná — spusti `/game play` znova, keď budeš chcieť.',
  'pron.listHeader': '🗣️ **Tvoje výslovnosti** ({count}/{limit}):',
  'pron.listEmpty': 'Zatiaľ žiadne nemáš — pridaj jednu cez `/pronunciation add`.',
  'pron.set': '✅ Uložené! Keď **ty** napíšeš „{term}“, poviem „{replacement}“.',
  'pron.removed': '🗑️ „{term}“ odstránené.',
  'pron.notFound':
    'Nemáš žiadnu výslovnosť pre „{term}“. Svoje zobrazíš cez `/pronunciation list`.',
  'pron.empty': 'Slovo ani spôsob, ako ho povedať, nemôžu byť prázdne.',
  'pron.limitHit':
    '🔒 Dosiahol si svoj limit **{limit}** výslovností. Odstráň jednu cez `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus alebo Premium ho zvýši na **50** → {url}',
  'pron.modalTitle': 'Nauč Vozen výslovnosť',
  'pron.modalTerm': 'Slovo (ako ho ľudia píšu)',
  'pron.modalSay': 'Ako to má Vozen povedať',
  'spron.listHeader': '🗣️ **Výslovnosti servera** ({count}/{limit}) — platia pre všetkých:',
  'spron.listEmpty': 'Zatiaľ žiadne — pridaj jednu cez `/server-pronunciation add`.',
  'spron.set': '✅ Uložené pre celý server! „{term}“ → „{replacement}“.',
  'spron.removed': '🗑️ „{term}“ odstránené zo servera.',
  'spron.notFound': 'Server nemá žiadnu výslovnosť pre „{term}“.',
  'spron.limitHit':
    '🔒 Server dosiahol svoj limit **{limit}** výslovností. Odstráň jednu cez `/server-pronunciation remove`.',
  'spron.modalTitle': 'Výslovnosť servera',
  'spron.modalSay': 'Ako to Vozen hovorí pre všetkých',
  'rand.selectPrompt': '🎲 **Randomizer** — z koľkých možností mám vyberať?',
  'rand.selectPlaceholder': 'Počet možností…',
  'rand.selectOption': '{n} možností',
  'rand.filling': '📝 Vyplň formulár, ktorý sa práve otvoril!',
  'rand.modalTitle': 'Randomizer — {amount} možností',
  'rand.modalOption': 'Možnosť {n}',
  'rand.needTwo': 'Daj mi aspoň 2 možnosti oddelené čiarkami (napr. "pizza, sushi").',
  'rand.result': 'Z {count} možností vyberám… **{winner}**!',
  'rand.speak': 'Vyberám… {winner}!',
  'rand.notInVoice': '_(pripoj sa ku mne do hlasového kanála a nabudúce to poviem nahlas)_',
  'rand.timeout': '⏰ Nič nevybrané — spusti `/randomizer` znova, keď budeš chcieť.',
};
