export default {
  'error.generic': 'Noget gik galt. Prøv venligst igen.',
  'stt.guildOnly': 'Transskription virker kun inde i en server.',
  'stt.noManage':
    'Du skal have tilladelsen **Administrer server** for at starte eller stoppe transskription.',
  'stt.notPremium':
    '🎙️ Live-transskription er en **Premium**-funktion. Se `/premium info` for at låse den op for denne server.',
  'stt.unavailable':
    'Transskription er ikke tilgængelig på denne instans (tale-til-tekst-motoren er ikke installeret).',
  'stt.notInVoice':
    'Jeg er ikke i en talekanal — gå ind i en og kør `/join` først, og start så transskriptionen.',
  'stt.alreadyRunning':
    'Transskription kører allerede på denne server. Brug `/transcribe stop` først.',
  'stt.atCapacity':
    'Der kører for mange transskriptioner lige nu på tværs af alle servere. Prøv venligst igen om lidt.',
  'stt.noChannel':
    'Jeg kan ikke poste transskriptioner i denne kanal. Prøv at køre kommandoen fra en almindelig tekstkanal.',
  'stt.started':
    '✅ Transskription startet. Alle, der trykker på **Samtykke** i annonceringen, bliver transskriberet til denne kanal.',
  'stt.startFailed':
    'Kunne ikke starte transskription (annonceringen kunne ikke postes). Jeg har fortrudt alt — intet bliver optaget. Prøv venligst igen.',
  'stt.announceStart':
    '🎙️ **Live-transskription er slået TIL i denne kanal.** Kun personer, der samtykker, bliver transskriberet — tryk på knappen nedenfor for at tillade, at din tale skrives her. Du kan trække samtykket tilbage når som helst med `/transcribe revoke`.',
  'stt.consentBtn': 'Samtyk til at blive transskriberet',
  'stt.consentThanks':
    '✅ Tak — din tale bliver nu transskriberet på denne server. Træk samtykket tilbage når som helst med `/transcribe revoke`.',
  'stt.stopped': '🛑 Transskription stoppet.',
  'stt.notRunning': 'Transskription kører ikke på denne server.',
  'stt.announceStop': '🛑 **Live-transskription er nu slået FRA.** Jeg holdt op med at lytte.',
  'stt.revoked':
    '✅ Samtykke trukket tilbage — du bliver ikke længere transskriberet på denne server. (Beskeder, der allerede er postet, bliver stående; slet dem i Discord, hvis du vil.)',
  'stt.revokeNone':
    'Du havde ikke samtykket til transskription på denne server, så der var intet at trække tilbage.',
  'privacy.eraseConfirm':
    '⚠️ Dette sletter permanent **alle** dine Vozen-data på tværs af alle servere: stemmeindstillinger, talt kaldenavn, personlige forkortelser og udtaler, gemt fødselsdag, spilresultater, talestatistik og fravalg. **Dette kan ikke fortrydes.** Er du sikker?',
  'privacy.erasePremiumNote':
    '_Bemærk: dit betalte Premium/Plus og dets købshistorik bevares — de tilhører dig og de lovpligtige regnskabsdata. For at stoppe Premium, lad det udløbe eller kontakt support._',
  'privacy.eraseYes': 'Slet alt',
  'privacy.eraseNo': 'Annuller',
  'privacy.eraseCancelled': 'Annulleret — intet blev slettet.',
  'privacy.eraseDone': '✅ Færdig. Alle dine personlige data er blevet slettet permanent.',
  'error.needManageGuild': 'Du skal have tilladelsen **Administrer server** for at gøre det.',
  'join.needVoiceChannel': 'Hop ind i en talekanal først, og kør så /join.',
  'join.missingPerms': 'Jeg skal bruge tilladelserne **Opret forbindelse** og **Tal** i {channel}.',
  'join.joined':
    '✅ Jeg er inde i {channel}! Næste trin: skriv `/tts hej`, så læser jeg det højt. Vil du have mig til at læse en kanal automatisk? Kør /setup.',
  'join.joinedAutoread':
    '✅ Jeg er inde i {channel}! Alt er klar. Skriv i den automatiske oplæsningskanal, så læser jeg det højt. → {readChannel}',
  'leave.left': 'Forlod talekanalen. Vi ses næste gang!',
  'skip.notInVoice':
    'Jeg er ikke i en talekanal endnu — gå ind i en og kør /join først, og prøv så igen.',
  'skip.skipped': 'Sprunget over.',
  'skip.nothing': 'Der afspilles ikke noget lige nu.',
  'shutup.notInVoice': 'Jeg er ikke i en talekanal endnu — gå ind i en og kør /join først.',
  'shutup.nothing': 'Der afspilles ikke noget lige nu.',
  'shutup.done': '🤐 Okay, jeg stopper — ryddede alt i køen.',
  'tts.notInVoice': 'Jeg er ikke i en talekanal endnu — gå ind i en og kør /join, og prøv så igen.',
  'tts.nothingToRead': 'Der er ikke noget at læse der — send mig noget tekst, jeg kan sige.',
  'tts.nothingAfterClean':
    'Efter at have ryddet op i det var der intet tilbage at læse — prøv med normal tekst (bogstaver eller ord).',
  'tts.tooFast': 'Hov, tag den lige med ro — prøv igen om et øjeblik.',
  'tts.blocked': 'Den tekst indeholder et blokeret ord, så jeg sprang den over.',
  'tts.queued': 'Forstået — det er i køen.',
  'tts.busy': 'Jeg er optaget lige nu — prøv igen om et øjeblik.',
  'voice.unknownModel': 'Jeg kender ikke den stemme — tjek /voice list.',
  'voice.badSpeed':
    'Hastigheden skal være mellem 0.5 og 2.0 (1.0 er normal). Prøv `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Din stemme er nu **{name}** ved {speed}×. Prøv `/tts hej` for at høre den. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Stemmeopsætning** — vælg mulighederne nedenfor, og tryk derefter på **Gem**. Intet ændres, før du gør det.',
  'voice.config.summary': 'Aktuelt valg: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Sprog…',
  'voice.config.pickVoice': 'Stemme…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Hastighed…',
  'voice.config.more': '▼ Flere sprog',
  'voice.config.engDefault': 'Standard (lokal)',
  'voice.config.save': 'Gem',
  'voice.config.cancel': 'Annuller',
  'voice.config.cancelled': 'Opsætningen blev annulleret — intet blev ændret.',
  'voice.config.expired': 'Panelet er udløbet — kør `/voice config` igen for at fortsætte.',
  'voice.listHeader': 'Tilgængelige stemmer:',
  'voice.listEmpty': '(ingen installeret)',
  'voice.reset':
    '✅ Din stemme er tilbage til standarden. Vælg en anden når som helst med `/voice list` og `/voice set`.',
  'voice.detection.on':
    '✅ Automatisk sprogregistrering er slået TIL: hver besked læses med en stemme til dens registrerede sprog (taleren kan skifte). Slå det fra med `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automatisk sprogregistrering er slået FRA: din ene faste stemme læser alt, så du altid lyder ens.',
  'voice.optout':
    'Du bliver ikke længere læst automatisk. Kør /voice opt-in for at slå det til igen.',
  'voice.optin': 'Du bliver læst automatisk igen.',
  'voice.nickname.set': '✅ Vozen vil nu kalde dig **{name}** højt.',
  'voice.nickname.cleared': '✅ Talt kaldenavn ryddet — Vozen bruger dit servernavn.',
  'voice.nickname.invalid': 'Det navn har intet læsbart at sige højt. Prøv bogstaver eller tal.',
  'voice.effect.set':
    '✅ Stemmeeffekt sat til **{effect}** — dine beskeder afspilles nu med den effekt. Brug `/voice effect none` for at slå den fra.',
  'voice.effect.cleared': '✅ Stemmeeffekt fjernet — ren stemme igen.',
  'voice.effect.locked':
    '🔒 **{effect}** er en Premium-effekt. Gratis effekter: 🤖 Robot og 🔊 Echo. Lås alle op med Vozen Premium — se `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** er en Premium-stemmemotor. Lås den op med Vozen Plus (personlig) eller Vozen Premium (server) — se `/premium`. Indtil da bliver din stemme på den gratis lokale motor.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** er en Premium-stemmemotor. Lås den op med Vozen Plus (personlig) eller Vozen Premium (server) — se `/premium`. Indtil da bliver din stemme på den gratis lokale motor.',
  'voice.notInVoice': 'Jeg er ikke i en talekanal endnu — kør /join først.',
  'voice.previewPlaying': 'Afspiller en prøve…',
  'preview.sample': 'Hej, jeg er Vozen. skriv det, hør det.',
  'laugh.playing': 'Haha! Afspiller det i din stemme…',
  'joke.playing': 'Fortæller en vittighed…\n> {joke}',
  'joke.unknownLang': 'Jeg kender ikke det sprog. Vælg et fra listen.',
  'rizz.playing': '😏 Leverer lidt rizz…\n> {line}',
  'rizz.unknownLang': 'Jeg kender ikke det sprog. Vælg et fra listen.',
  'rizz.locked':
    '🔒 **/rizz** er et Premium-gode. Lås det op med Vozen Plus (dig) eller Premium (denne server). Se `/premium`.',
  'sound.playing': '🔊 Afspiller **{name}**…',
  'sound.unknown': 'Jeg har ikke den lyd. Kør `/sound` for at se listen.',
  'sound.list':
    '🔊 **Lyde:** {sounds}\nAfspil en med `/sound name:<lyd>` (jeg skal være i din talekanal).',
  'sound.disabled':
    '🔇 Lydtavlen er **slået fra** på denne server. En admin kan aktivere den med `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Fødselsdag gemt: **{day}/{month}**. Jeg ønsker dig tillykke med fødselsdagen, når du går ind i en talekanal den dag!',
  'birthday.invalid': 'Det er ikke en rigtig dato. Tjek dag og måned.',
  'birthday.cleared': '🎂 Fødselsdag fjernet.',
  'birthday.show': '🎂 Din fødselsdag er sat til **{day}/{month}**.',
  'birthday.none': 'Du har ikke sat en fødselsdag endnu. Brug `/birthday set`.',
  'topspeakers.title': '🗣️ **Top-talere** — dem jeg læser mest på denne server:',
  'topspeakers.empty':
    'Jeg har ikke læst nogens beskeder endnu. Sæt en oplæsningskanal op med `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** beskeder · 🔥 {streak}-dages stime',
  'serverstats.title': '📊 **Serverstatistik**',
  'serverstats.empty':
    'Ingen statistik endnu — jeg har ikke læst nogen beskeder eller kørt spil her. Sæt op med `/setup`!',
  'serverstats.messages': '🗣️ **{total}** beskeder læst · **{speakers}** personer',
  'serverstats.topTalkers': '**Top-talere:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} beskeder · 🔥 {streak}d',
  'serverstats.streak': '🔥 Længste aktive stime: **{days}** dage',
  'serverstats.games': '🎮 **{points}** spilpoint · **{wins}** sejre · **{players}** spillere',
  'serverstats.topPlayers': '**Top-spillere:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} point · {wins} sejre',
  'serverstats.upsell':
    '🔒 Det er den gratis forhåndsvisning. **Premium** låser op for stimer, spilstatistik og hele top 5 — se `/premium`.',
  'streak.day':
    '🔥 <@{user}> er på en **{n}-dages** stime! Fortsæt med at snakke for at holde den i live.',
  'leaderboard.autoTitle': '🏆 Top-talere på denne server',
  'premium.title': '💎 **Vozen Premium-status**',
  'premium.lineServerActive': '🖥️ **Server:** Premium indtil {date}',
  'premium.lineServerFree': '🖥️ **Server:** Gratis plan',
  'premium.lineUserActive': '👤 **Dig (Plus):** aktiv indtil {date}',
  'premium.lineUserFree': '👤 **Dig (Plus):** ikke aktiv',
  'premium.getHint':
    'Alt, hvad du bruger i dag, forbliver gratis. Premium tilføjer alle 8 stemmeeffekter, 24/7 i opkald, 50 personlige udtaler, /rizz og premium-spillene. Support: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Dit Premium-pas:** {used}/{total} licenser i brug · udløber {date}',
  'premium.passServers': '↳ I brug på: {servers}',
  'premium.pitch':
    'Du har ikke Premium endnu. **Vozen Premium** (€3.99/md for 3 servere eller €7.99/md for 8) låser op for hele serveren: alle 8 stemmeeffekter, 24/7 i opkald, 50 personlige udtaler (mod 3), /rizz-kommandoen og premium-spillene (Ordkæde, Wordle, Skak). **Vozen Plus** (€1.99/md) giver dig de goder personligt, på enhver server.',
  'premium.buyHint':
    '▶ **Få Premium:** {link}\nEfter køb, kør `/premium activate` på den server, du vil have.',
  'premium.confirmActivate':
    'Brug **1 af dine {total} Premium-licenser** på **denne server**? Du har **{used}** i brug lige nu. Du kan frigøre den senere med `/premium deactivate` — uret kører videre på passet uanset hvad.',
  'premium.confirmYes': '💎 Brug en licens',
  'premium.confirmNo': 'Annuller',
  'premium.activateOk':
    '✅ Premium er nu aktivt på **denne server** indtil {date}. Licenser: **{used}/{total}** i brug.',
  'premium.activateCancelled': 'Annulleret — ingen licens blev brugt.',
  'premium.activateTimeout': 'Tiden løb ud — ingen licens blev brugt.',
  'premium.noPass':
    'Du har ikke et aktivt Premium-pas. Køb et, og det lander på din konto — kør så `/premium activate` her.\n▶ {link}',
  'premium.alreadyActive': 'Denne server har allerede en af dine Premium-licenser. Intet at gøre.',
  'premium.noSeats':
    'Alle dine **{total}** Premium-licenser er i brug ({servers}). Frigør en med `/premium deactivate` der, og prøv så igen her.',
  'premium.needManageGuild':
    'Aktivering af Premium påvirker hele serveren — kun medlemmer med **Administrer server** kan gøre det. Spørg en admin.',
  'premium.deactivateOk':
    '✅ Frigjorde denne servers Premium-licens. Brug den på en anden server med `/premium activate`.',
  'premium.deactivateNone': 'Denne server har ingen Premium-licens fra dig at frigøre.',
  'premium.thisServer': 'denne server',
  'grant.denied': '⛔ Denne kommando er kun for bot-ejeren.',
  'grant.okPremium':
    '✅ Gav <@{user}> et **Premium-pas** ({seats} licenser) i **{days}** dage — udløber {date}. De aktiverer det med `/premium activate`.',
  'grant.okPlus': '✅ Gav <@{user}> **Vozen Plus** i **{days}** dage — udløber {date}.',
  'gencode.done':
    '✅ Genererede **{count}** {plan}-kode(r), **{days}** dage hver. Del dem privat:\n{list}',
  'redeem.okPlus': '🎁 Indløst! Du fik **Vozen Plus** i **{days}** dage — udløber {date}.',
  'redeem.okPremium':
    '🎁 Indløst! Du fik et **Premium-pas** ({seats} licenser) i **{days}** dage — udløber {date}. Aktivér det på din server med `/premium activate`.',
  'redeem.notFound': '❌ Den kode findes ikke. Tjek den igen, og prøv igen.',
  'redeem.used': '❌ Den kode er allerede blevet indløst.',
  'redeem.expired': '❌ Den kode er udløbet.',
  'voice.abbrev.added': 'Forstået — {term} bliver læst som {replacement}.',
  'voice.abbrev.removed': 'Fjernede din forkortelse for {term}.',
  'voice.abbrev.listHeader': 'Dine personlige forkortelser ({count}/{cap} brugt):',
  'voice.abbrev.listEmpty': '(ingen endnu — tilføj en med /voice abbrev add)',
  'voice.abbrev.capReached':
    'Du har nået grænsen på {cap} personlige forkortelser. Fjern en, før du tilføjer en ny.',
  'voice.abbrev.invalidTerm':
    'Termen skal være et enkelt ord (kun bogstaver og tal), på op til 50 tegn.',
  'voice.abbrev.emptyReplacement': 'Oplæsningen må ikke være tom.',
  'voice.abbrev.tooLong': 'Oplæsningen er for lang (maks. 200 tegn).',
  'config.wordEmpty': 'Ordet må ikke være tomt.',
  'config.blocked': 'Blokeret: {word}.',
  'config.blockLimit':
    'Denne server har allerede det maksimale antal på {max} blokerede ord. Fjern et, før du tilføjer et nyt.',
  'config.unblocked': 'Fjernet blokering: {word}.',
  'config.pronListHeader': 'Udtaleordbog:',
  'config.pronEmptyValue': '(tom)',
  'config.listEmpty': '(ingen)',
  'config.termEmpty': 'Termen må ikke være tom.',
  'config.pronEmpty': 'Udtalen må ikke være tom.',
  'config.pronSet': 'Forstået — {term} bliver læst som {replacement}.',
  'config.pronRemoved': 'Fjernede udtalen for {term}.',
  'config.channelWrongType': 'Vælg en tekstkanal (ikke en talekanal eller en kategori).',
  'config.channelNoAccess': 'Jeg kan ikke se {channel} — tjek venligst mine tilladelser der.',
  'config.channelSet':
    'Automatisk oplæsningskanal sat til {channel}. Næste: sørg for at automatisk oplæsning er slået til med `/config auto-read active:true`.',
  'config.autoreadOn': 'Automatisk oplæsning er nu **slået til**.',
  'config.autoreadOff': 'Automatisk oplæsning er nu **slået fra**.',
  'config.maxCharsRange': 'Værdien for maks. tegn skal være mellem 1 og 2000.',
  'config.maxCharsSet': 'Maks. antal tegn pr. besked sat til {value}.',
  'config.rateLimitRange': 'Værdien for hastighedsgrænse skal være mellem 1 og 120.',
  'config.rateLimitSet': 'Hastighedsgrænse sat til {value} beskeder i minuttet.',
  'config.roleSet': 'Automatisk oplæsning er nu begrænset til medlemmer med {role}.',
  'config.roleCleared': 'Rollebegrænsning fjernet — alle kan nu blive læst.',
  'config.enabledOn': 'TTS er nu **slået til** for denne server.',
  'config.enabledOff': 'TTS er nu **slået fra** for denne server.',
  'config.xsaidOn':
    'Vozen vil nu annoncere **hvem der talte** før hver besked (f.eks. "Alex sagde hej"). Slå fra med `/config x-said active:false`.',
  'config.xsaidOff':
    'Vozen vil **ikke længere** annoncere, hvem der talte — den læser kun beskeden.',
  'config.autojoinOn':
    '✅ Auto-join **til** — Vozen går ind i din talekanal, når du skriver i TTS-kanalen.',
  'config.autojoinOff': 'Auto-join **fra** — brug `/join` for at få Vozen ind i tale.',
  'config.stayOn':
    '✅ 24/7 i opkald **til** — Vozen bliver i talekanalen, selv når den tømmes, og kommer tilbage efter genstart. 💎 Kræver Premium for at træde i kraft (køb eller `/redeem` en kode, og kør så `/premium activate`).',
  'config.stayOff':
    '24/7 i opkald **fra** — Vozen forlader kanalen, når talekanalen tømmes (standard).',
  'config.readBotsOn': '✅ Vozen vil nu også læse beskeder fra **andre bots og webhooks**.',
  'config.readBotsOff':
    'Vozen vil **ignorere** andre bots og webhooks (kun rigtige mennesker læses).',
  'config.textInVoiceOn': '✅ Vozen vil også læse **tekstchatten inde i sin talekanal**.',
  'config.textInVoiceOff': 'Vozen vil **ikke** læse talekanalens tekstchat (kun TTS-kanalen).',
  'config.antispamOn':
    '✅ Anti-spam **til** — Vozen læser ikke spam-beskeder (masse-gentagelse af ord eller den samme store besked postet igen og igen).',
  'config.antispamOff': 'Anti-spam **fra** — Vozen læser alle beskeder som sædvanligt.',
  'config.streaksOn':
    '✅ Stime-beskeder **til** — Vozen viser en 🔥 dagsstime-besked, første gang hver person taler hver dag.',
  'config.streaksOff':
    'Stime-beskeder **fra** — Vozen sporer stadig stimer (se `/top-speakers`), men holder mund om dem.',
  'config.soundboardOn': 'Lydtavle **til** — alle kan afspille klip med `/sound`.',
  'config.soundboardOff': 'Lydtavle **fra** — `/sound` er deaktiveret på denne server.',
  'config.votePromosLabel': 'Notifikationer om top.gg-belønning + Vozen Support',
  'config.greetOn': '✅ Jeg hilser på folk ved navn, når de går ind i talekanalen.',
  'config.greetOff': '🔇 Jeg **hilser ikke** på folk, når de går ind i talekanalen.',
  'config.greetLangSet': '✅ Sprog for velkomsthilsen sat til **{language}**.',
  'config.defaultVoiceSet':
    '✅ Serverens standardstemme sat til **{name}**. Medlemmer uden deres egen stemme hører denne. (id: `{model}`)',
  'config.reset':
    'Konfiguration nulstillet til standard. Din blokeringsliste og udtaler blev bevaret.',
  'config.showTitle': '**Serverkonfiguration**',
  'config.showChannel': 'TTS-kanal: {value}',
  'config.showAutoread': 'Automatisk oplæsning: {value}',
  'config.showRole': 'Rolle: {value}',
  'config.showEnabled': 'Aktiveret: {value}',
  'config.showXsaid': 'Annoncér taler (xsaid): {value}',
  'config.showAutojoin': 'Auto-join: {value}',
  'config.showReadBots': 'Læs bots/webhooks: {value}',
  'config.showTextInVoice': 'Tekst-i-tale: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Lydtavle (/sound): {value}',
  'config.showGreet': 'Hils ved indgang: {value} ({language})',
  'config.showVoice': 'Standardstemme: {value}',
  'config.showMaxChars': 'Maks. tegn: {value}',
  'config.showRateLimit': 'Hastighedsgrænse: {value}/min',
  'config.showBlocklist': 'Blokeringsliste: {count} ord',
  'config.showPronunciation': 'Udtaler: {count} poster',
  'config.valueNone': '(ingen)',
  'config.valueAny': 'alle',
  'config.valueAutoDetect': '(automatisk registrering)',
  'config.on': 'til',
  'config.off': 'fra',
  'config.language.set': 'Grænsefladens sprog sat til {language}.',
  'config.language.unsupported': 'Det sprog understøttes ikke endnu.',
  'setup.noChannel':
    'Jeg kunne ikke afgøre, hvilken kanal jeg skulle bruge. Angiv en tekstkanal i "channel"-indstillingen.',
  'setup.channelWrongType':
    'Kanalen til automatisk oplæsning skal være en tekstkanal (ikke en talekanal eller en kategori). Angiv en i "channel"-indstillingen.',
  'setup.done': '**Alt er klar — Vozen er parat.**',
  'setup.channelLine': 'Automatisk oplæsningskanal: {channel}',
  'setup.autoreadOn': 'Automatisk oplæsning: til',
  'setup.permsHeader': '**Tilladelser:**',
  'setup.permView': 'ViewChannel (se tekstkanalen)',
  'setup.permSend': 'SendMessages (poste i tekstkanalen)',
  'setup.permConnect': 'Connect (gå ind i talekanalen)',
  'setup.permSpeak': 'Speak (tale i talekanalen)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — mangler',
  'setup.permUnchecked': '⏳ {label} — ikke tjekket endnu (jeg verificerer det ved /join)',
  'setup.fixHint':
    'Sådan retter du det, der mangler: åbn Vozens rolle (eller kanalens tilladelser) i dine serverindstillinger og aktivér de punkter, der er markeret med ❌.',
  'setup.voiceUncheckedNote':
    'Du er ikke i en talekanal, så jeg kunne ikke tjekke Connect/Speak endnu — jeg verificerer dem, når du kører /join.',
  'setup.allGood': 'Alt er klar. Hop ind i en talekanal og kør /join.',
  'setup.joinedVoice': 'Jeg er også gået ind i {channel} — du behøver ikke køre /join.',
  'setup.readyTalk': 'Alt er klar. Skriv i den automatiske oplæsningskanal, så læser jeg det højt.',
  'setup.membersHeader': '**Fortæl dine medlemmer (3-trins-forløbet):**',
  'setup.membersBody':
    '1) Gå ind i en talekanal\n2) Kør /join, så jeg hopper ind sammen med dig\n3) Skriv i denne kanal (eller brug /tts), så læser jeg det højt\nFuld kommandoliste: /help',
  'stats.title': '**Vozen-statistik**',
  'stats.messagesSpoken': 'Talte beskeder: {value}',
  'stats.cacheHits': 'Cache-hits: {value}',
  'stats.cacheMisses': 'Cache-misses: {value}',
  'stats.synthErrors': 'Syntesefejl: {value}',
  'stats.synthLatency': 'Synteselatens: p50 {p50}ms / p95 {p95}ms ({count} prøver)',
  'stats.voiceDrops': 'Stemmeafbrydelser: {value}',
  'stats.voiceReconnects': 'Genforbindelser: {value}',
  'stats.votes': 'top.gg-stemmer: {value}',
  'stats.activePlayers': 'Aktive afspillere: {value}',
  'stats.servers': 'Servere: {value}',
  'stats.uptime': 'Oppetid: {value}s',
  'speak.emptyMessage': 'Den besked har ingen tekst at læse højt.',
  'uptime.text': '🟢 Vozen har været online i **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistik**',
  'botstats.servers': 'Servere: **{value}**',
  'botstats.voiceSessions': 'Talesessioner nu: **{value}**',
  'botstats.messagesSpoken': 'Talte beskeder: **{value}**',
  'botstats.uptime': 'Oppetid: **{value}**',
  'invite.noClientId':
    'Vozens invitationslink er ikke sat op endnu (CLIENT_ID mangler). Sig det til bot-administratoren.',
  'invite.link': 'Tilføj Vozen til din server:\n{url}',
  'vote.noClientId':
    'Vozens stemmelink er ikke sat op endnu (CLIENT_ID mangler). Sig det til bot-administratoren.',
  'vote.link':
    'Stem på Vozen (gratis, hver 12. time) og hjælp flere med at finde den:\n{url}\nHvis denne konto aldrig har hentet belønningen, får den **48 timers Vozen Plus**, kun én gang pr. konto.',
  'invite.button': 'Tilføj Vozen',
  'vote.button': 'Stem på top.gg',
  'vote.upsell':
    '🗳️ Hvis denne konto aldrig har hentet belønningen, får den **48 timers Vozen Plus**, kun én gang pr. konto. {url}',
  'vote.cooldownStatus':
    '🗳️ Denne konto har allerede brugt sin engangsbelønning for at stemme. Du kan stadig stemme for at støtte Vozen, men det giver ikke mere Plus.',
  'help.title': 'Vozen — skriv det, hør det.',
  'help.embedTitle': 'Vozen — Kommandoer',
  'help.intro':
    'Vozen læser din tekst højt i talekanaler — gratis neurale stemmer, snesevis af sprog.',
  'help.quickStartTitle': 'Hurtig start (3 trin)',
  'help.quickStartBody':
    '1) Gå ind i en talekanal, og kør så /join\n2) Skriv i tekstkanalen (eller brug /tts Hej allesammen!)\n3) (valgfrit) Vælg en stemme med /voice set',
  'help.groupStarted': 'Kom godt i gang',
  'help.groupStartedBody':
    '• /join — jeg går ind i din talekanal\n• /leave — jeg forlader talekanalen\n• /tts <tekst> — jeg læser tekst højt · f.eks. /tts Hej allesammen!\n• /skip — spring over det, jeg læser lige nu',
  'help.groupVoice': 'Din stemme',
  'help.groupVoiceBody':
    '• /voice set <model> — vælg din stemme · f.eks. /voice set en_US-amy-medium\n• /voice list — se de tilgængelige stemmer\n• /voice preview — hør en prøve af din stemme\n• /voice reset — gå tilbage til standardstemmen\n• /voice opt-out · /voice opt-in — slå automatisk oplæsning fra / til for dig\n• /voice abbrev add|remove|list — personlig slang, læst på din måde (op til 10)',
  'help.groupFun': 'Sjov',
  'help.groupFunBody':
    '• /joke — jeg fortæller en kort vittighed (vælg et sprog + valgfri latter) · f.eks. /joke English\n• /laugh — jeg griner højt i din nuværende stemme',
  'help.groupAdmin': 'Serveradmin (kræver Administrer server)',
  'help.groupAdminBody':
    '• /setup — guidet konfiguration i ét trin · kør denne først\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · f.eks. /config tts-channel #general\n• /stats — bot-statistik',
  'help.groupMore': 'Mere',
  'help.groupMoreBody':
    '• /invite — tilføj Vozen til en anden server\n• /vote — stem på Vozen på top.gg\n• /help — vis denne hjælp',
  'help.footer': 'Ny her? Kør {command} for at komme i gang.',
  'help.support': '🛟 Har du brug for hjælp eller vil rapportere et problem? {url}',
  'help.source': '📄 Open source (AGPL-3.0) — hent den nøjagtige kildekode, der kører her: {url}',
  'welcome.title': 'Tak fordi du tilføjede Vozen! 👋',
  'welcome.description':
    'Vozen læser din chat højt i talekanaler — skriv det, hør det.\n\n**Kom i gang i ét trin:** kør {setup}, så sætter jeg automatisk oplæsning op og går ind i din talekanal.\n\nHar du brug for den fulde kommandoliste? Kør {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Sådan bruger medlemmer det (3 trin)',
  'welcome.stepsBody':
    '1) Gå ind i en talekanal\n2) Kør /join, så jeg går ind sammen med dig\n3) Skriv i tekstkanalen (eller brug /tts), så læser jeg det højt\nFuld kommandoliste: /help',
  'welcome.footer': 'Vozen — skriv det, hør det.',
  'welcome.tagline': 'Naturlig neural stemme — gratis for altid, ingen betalingsmur.',
  'game.start.needVoice':
    'Dette er et **stemmespil** — hop ind i en talekanal og kør /join først, og start det så.',
  'game.start.alreadyActive':
    'Der kører allerede et spil i <#{channel}>. Afslut det (eller brug `/game stop`), før du starter et nyt.',
  'game.start.premiumLocked':
    '🔒 **{game}** er et Premium-spil (det koster reel computerkraft). Se `/premium`.',
  'game.start.started': '🎮 Starter **{game}**! Hold øje med kanalen — held og lykke!',
  'game.start.startedThread':
    '🎮 **{game}** startet i <#{channel}> — deltag der! Tråden sletter sig selv, når spillet slutter.',
  'game.thread.winner': '🏆 {winner} vandt spillet!',
  'game.thread.ended': '🎮 Spillet er slut.',
  'game.unknownGame': 'Jeg kender ikke det spil. Vælg et fra listen.',
  'game.stop.ok': '🛑 Stoppede det aktuelle spil.',
  'game.stop.none': 'Der kører ikke noget spil lige nu.',
  'game.list.title': '🎮 **Spil** — start et med `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Ranglisten** — bedste spillere på denne server:',
  'game.leaderboard.empty': 'Der er ikke spillet nogen spil endnu. Vær den første — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** point ({wins} sejre)',
  'game.finish.title': '🏁 **Spillet er slut!** Slutresultater:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Spillet er slut — ingen scorede denne gang. Næste gang!',
  'game.finish.winnerVoice': '{user} vinder!',
  'game.guessLanguage.name': 'Gæt sproget',
  'game.guessLanguage.desc':
    'Jeg læser en sætning på et tilfældigt sprog — den første, der nævner det, vinder pointet.',
  'game.guessLanguage.intro':
    '🗣️ **Gæt sproget** — jeg læser {rounds} sætninger. Skriv, hvilket sprog du hører. Hurtigste rigtige svar vinder hver runde!',
  'game.guessLanguage.round': '🎧 Runde {n}/{total} — lyt…',
  'game.guessLanguage.correct': '✅ **{user}** gættede det — det var **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Tiden er gået! Det var **{language}**.',
  'game.guessLanguage.noLanguages':
    'Jeg har ikke nok stemmer installeret til at spille dette. Bed en admin om at tilføje flere stemmer.',
  'game.math.name': 'Hovedregning',
  'game.math.desc': 'Jeg siger et regnestykke højt — den første, der skriver svaret, vinder.',
  'game.math.intro':
    '🔢 **Hovedregning** — {rounds} regnestykker. Lyt og skriv svaret så hurtigt du kan!',
  'game.math.round': '🧮 Runde {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** ramte plet — svaret var **{answer}**!',
  'game.math.timeout': '⏱️ Tiden er gået! Svaret var **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'gange',
  'game.skipCount.name': 'Det manglende tal',
  'game.skipCount.desc':
    'Jeg tæller højt, men springer ét tal over — den første, der fanger det, vinder.',
  'game.skipCount.intro':
    '🔢 **Det manglende tal** — jeg tæller, men springer ét over. Skriv det manglende tal! ({rounds} runder)',
  'game.skipCount.round': '👂 Runde {n}/{total} — hvilket tal sprang jeg over?',
  'game.skipCount.correct': '✅ **{user}** fangede det — jeg sprang **{answer}** over!',
  'game.skipCount.timeout': '⏱️ Tiden er gået! Jeg sprang **{answer}** over.',
  'game.spelling.name': 'Stavekonkurrence',
  'game.spelling.desc': 'Jeg siger et ord — den første, der staver det rigtigt, vinder.',
  'game.spelling.intro':
    '✍️ **Stavekonkurrence** — jeg siger {rounds} ord. Skriv hvert enkelt stavet rigtigt!',
  'game.spelling.round': '🗣️ Runde {n}/{total} — skriv det ord, jeg siger…',
  'game.spelling.correct': '✅ **{user}** stavede **{word}** rigtigt!',
  'game.spelling.timeout': '⏱️ Tiden er gået! Ordet var **{word}**.',
  'game.spelling.empty': 'Jeg har ikke en ordliste for denne servers stemmesprog endnu.',
  'game.spellOut.name': 'Bogstav for bogstav',
  'game.spellOut.desc':
    'Jeg staver et ord bogstav for bogstav — den første, der skriver hele ordet, vinder.',
  'game.spellOut.intro':
    '🔡 **Bogstav for bogstav** — jeg staver {rounds} ord bogstav for bogstav. Skriv hele ordet!',
  'game.spellOut.round': '🔤 Runde {n}/{total} — lyt til bogstaverne…',
  'game.spellOut.correct': '✅ **{user}** gættede det — **{word}**!',
  'game.spellOut.timeout': '⏱️ Tiden er gået! Det stavede **{word}**.',
  'game.fastSpeech.name': 'Hurtigsnak',
  'game.fastSpeech.desc':
    'Jeg læser en sætning superhurtigt — den første, der skriver det jeg sagde, vinder.',
  'game.fastSpeech.intro':
    '💨 **Hurtigsnak** — {rounds} sætninger i latterligt tempo. Skriv, hvad du hører!',
  'game.fastSpeech.round': '⚡ Runde {n}/{total} — her kommer den, hurtigt!',
  'game.fastSpeech.correct': '✅ **{user}** afkodede det: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Tiden er gået! Det var: “{phrase}”',
  'game.fastSpeech.empty': 'Jeg har ikke sætninger for denne servers stemmesprog endnu.',
  'game.accentSwap.name': 'Sjov accent',
  'game.accentSwap.desc':
    'Jeg siger et ord med en udenlandsk accent — den første, der skriver det, vinder.',
  'game.accentSwap.intro':
    '🎭 **Sjov accent** — {rounds} ord sagt med den forkerte accent. Skriv ordet!',
  'game.accentSwap.round': '🌍 Runde {n}/{total} — hvilket ord prøver jeg at sige?',
  'game.accentSwap.correct': '✅ **{user}** gættede det — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Tiden er gået! Ordet var **{word}**.',
  'game.reflexes.name': 'Reflekser',
  'game.reflexes.desc':
    'Jeg tæller ned og råber så NU — den første, der skriver derefter, vinder. Spring ikke for tidligt!',
  'game.reflexes.intro':
    '⚡ **Reflekser** — {rounds} runder. Når jeg råber **NU**, så skriv hvad som helst så hurtigt du kan. Skriv før NU, og det er en tyvstart!',
  'game.reflexes.ready': '🚦 Runde {n}/{total} — gør dig klar…',
  'game.reflexes.countdown': 'tre… to… en…',
  'game.reflexes.go': '🟢 **NU!!!**',
  'game.reflexes.goVoice': 'Nu!',
  'game.reflexes.tooSoon': '🔴 **{user}** tyvstartede — for tidligt!',
  'game.reflexes.win': '⚡ **{user}** er den hurtigste! Point!',
  'game.reflexes.tooSlow': '😴 Ingen reagerede i tide. Næste!',
  'game.headsOrTails.name': 'Krone eller plat',
  'game.headsOrTails.desc':
    'Gæt møntkastet — skriv krone eller plat, før jeg kaster. Bedste gætter vinder!',
  'game.headsOrTails.intro':
    '🪙 **Krone eller plat** — {rounds} runder. Hver runde skriver du `krone` eller `plat`, før jeg kaster mønten. 1 point per rigtigt gæt!',
  'game.headsOrTails.introVoice': 'Lad os spille krone eller plat!',
  'game.headsOrTails.round': '🪙 Runde {n}/{total} — krone eller plat? Skriv dit gæt!',
  'game.headsOrTails.roundVoice': 'Krone… eller plat?',
  'game.headsOrTails.heads': 'krone',
  'game.headsOrTails.tails': 'plat',
  'game.headsOrTails.resultVoice': 'Det blev {side}!',
  'game.headsOrTails.winners': 'Det blev **{side}**! Point til: {users}',
  'game.headsOrTails.noWinners': 'Det blev **{side}**! Ingen gættede det — ingen point.',
  'game.vozenSays.name': 'Vozen siger',
  'game.vozenSays.desc':
    "Adlyd kun, når ordren starter med 'Vozen siger'. Falder du i en fælde, er du fanget!",
  'game.vozenSays.intro':
    "🫡 **Vozen siger** — {rounds} ordrer. Gør det KUN, hvis jeg starter med **'Vozen siger'**. Ellers: rør dig ikke!",
  'game.vozenSays.prefix': 'Vozen siger',
  'game.vozenSays.verb': 'skriv',
  'game.vozenSays.real': '🗣️ Runde {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Runde {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** adlød først — point!',
  'game.vozenSays.caught': '🔴 **{user}** — jeg sagde ikke Vozen siger! Fanget!',
  'game.vozenSays.nobody': '😴 Ingen adlød **{word}** i tide. Næste!',
  'game.vozenSays.trapCleared': '😌 Det var en fælde — godt set, ingen faldt for **{word}**.',
  'game.roulette.name': 'Sandhed eller konsekvens-roulette',
  'game.roulette.desc':
    'Jeg drejer og læser én sandhed-eller-konsekvens-opgave højt. Kør igen for en ny.',
  'game.roulette.header': '🎯 **Hjulet siger…**',
  'game.hangman.name': 'Galgeleg',
  'game.hangman.desc': 'Gæt ordet ét bogstav ad gangen — 6 fejl og det er slut.',
  'game.hangman.intro':
    '🪢 **Galgeleg** — skriv ét bogstav ad gangen for at gætte ordet. Du kan også skrive hele ordet!',
  'game.hangman.hit': '🟢 **{user}** fandt **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — intet **{letter}**.',
  'game.hangman.wrongLetters': 'Forkert: {letters}',
  'game.hangman.win': '🎉 **{user}** løste det — **{word}**!',
  'game.hangman.lose': '💀 Ikke flere forsøg! Ordet var **{word}**.',
  'game.hangman.idle': '🕹️ Spil sat på pause (ingen spiller). Ordet var **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Gæt ordet på 5 bogstaver. 🟩 rigtig plads, 🟨 forkert plads, ⬛ ikke i ordet. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — skriv et ord på 5 bogstaver. I deler {max} gæt. 🟩 rigtig plads · 🟨 forkert plads · ⬛ ikke i ordet.',
  'game.wordle.guess': '🔤 **{user}** gættede — **{left}** gæt tilbage',
  'game.wordle.inWord': '🟢 i ordet: {letters}',
  'game.wordle.out': '🚫 ude: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** gættede det på {n} — **{word}**!',
  'game.wordle.lose': '💀 Ikke flere gæt! Ordet var **{word}**.',
  'game.wordle.idle': '🕹️ Spil sat på pause (ingen spiller). Ordet var **{word}**.',
  'game.tictactoe.name': 'Kryds og bolle',
  'game.tictactoe.desc':
    'To spillere — skriv et tal 1-9 for at placere dit mærke. Tre på stribe vinder.',
  'game.tictactoe.intro':
    '⭕ **Kryds og bolle** — de første to spillere, der trækker, er ❌ og ⭕ (❌ starter). Skriv et tal 1-9 for at spille din celle.',
  'game.tictactoe.turn': 'Tur: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, det er **{mark}**s tur.',
  'game.tictactoe.taken': '🚫 Celle {cell} er optaget — vælg en anden.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) vinder!',
  'game.tictactoe.draw': '🤝 Det er uafgjort!',
  'game.tictactoe.idle': '🕹️ Spillet er slut (ingen spiller).',
  'game.chess.name': 'Skak',
  'game.chess.desc':
    'To spillere — rigtige skakregler (skak, rokade, forvandling…). Skriv et træk som "e4" eller "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Skak** — de første to spillere, der trækker, er Hvid og Sort (Hvid starter). Skriv et træk i algebraisk notation ("e4", "Nf3", "O-O") eller koordinater ("e2e4"). Skriv "resign" for at give op.',
  'game.chess.white': 'Hvid',
  'game.chess.black': 'Sort',
  'game.chess.seats': '⚪ Hvid: **{white}** · ⚫ Sort: **{black}**',
  'game.chess.turn': '{move} — tur: **{color}**',
  'game.chess.check': '♟️ Skak!',
  'game.chess.notYourTurn': '⏳ **{user}**, det er **{color}**s tur.',
  'game.chess.illegalMove': '🚫 "{move}" er ikke et lovligt træk — prøv igen.',
  'game.chess.checkmate': '🏆 Skakmat ({move})! **{user}** vinder!',
  'game.chess.draw': '🤝 Det er uafgjort ({move})!',
  'game.chess.resigned': '🏳️ **{user}** gav op — **{winner}** vinder!',
  'game.chess.idle': '🕹️ Spillet er slut (ingen spiller).',
  'game.wordChain.name': 'Ordkæde',
  'game.wordChain.descr':
    'Turbaseret ordkæde på ét sprog: sig et ord, der starter med sidste bogstav i det forrige. 2 liv, ingen gentagelser, og uret speeder op. Vælg sproget med `language`-indstillingen. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Ordkæde er ikke tilgængelig på **{lang}** lige nu (mangler ordliste).',
  'game.wordChain.lobby':
    '🔗 **Ordkæde** på **{lang}**! Skriv hvad som helst i denne kanal inden for **{seconds}s** for at deltage.',
  'game.wordChain.notEnough': '😴 Ikke nok spillere deltog (mindst 2 kræves). Spil annulleret.',
  'game.wordChain.begin':
    '🚀 Starter! Spillere: {players}. Hvert ord skal starte med sidste bogstav i det forrige.',
  'game.wordChain.turn':
    '**{name}**, det er din tur! Et **{lang}**-ord, der starter med **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — næste bogstav: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Det skal starte med **{letter}**.',
  'game.wordChain.bad.short': '📏 For kort — mindst **{min}** bogstaver.',
  'game.wordChain.bad.repeated': '🔁 Det ord er allerede blevet brugt.',
  'game.wordChain.bad.word': '📖 Det står ikke i ordbogen.',
  'game.wordChain.bad.latin': '🔤 Kun bogstaverne A–Z tæller.',
  'game.wordChain.timeout': '⏰ **{name}** løb tør for tid! {hearts} tilbage.',
  'game.wordChain.eliminated': '💀 **{name}** er ude!',
  'game.wordChain.winner': '🏆 **{name}** vinder kæden! ({chain} ord)',
  'game.stats.none': 'Du har ikke spillet nogen spil endnu. Prøv `/game play`!',
  'game.stats.body': '🎮 **Din statistik** — **{points}** point · **{wins}** sejre · {rank}',
  'game.stats.rank': 'plads **#{rank}** af {total}',
  'game.stats.unranked': 'ikke placeret endnu',
  'game.pickPrompt': '🎮 Hvilket spil vil du spille? Vælg et:',
  'game.pickPlaceholder': 'Vælg et spil…',
  'game.pickTimeout': '⏰ Intet spil valgt — kør `/game play` igen, når du er klar.',
  'pron.listHeader': '🗣️ **Dine udtaler** ({count}/{limit}):',
  'pron.listEmpty': 'Du har ingen endnu — tilføj en med `/pronunciation add`.',
  'pron.set': '✅ Gemt! Når **du** skriver “{term}”, siger jeg “{replacement}”.',
  'pron.removed': '🗑️ Fjernede “{term}”.',
  'pron.notFound': 'Du har ingen udtale for “{term}”. Se dine med `/pronunciation list`.',
  'pron.empty': 'Ordet og hvordan det skal siges kan ikke være tomt.',
  'pron.limitHit':
    '🔒 Du har nået din grænse på **{limit}** udtaler. Fjern en med `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus eller Premium hæver den til **50** → {url}',
  'pron.modalTitle': 'Lær Vozen en udtale',
  'pron.modalTerm': 'Ordet (som folk skriver det)',
  'pron.modalSay': 'Hvordan Vozen skal sige det',
  'spron.listHeader': '🗣️ **Serverudtaler** ({count}/{limit}) — gælder for alle:',
  'spron.listEmpty': 'Ingen endnu — tilføj en med `/server-pronunciation add`.',
  'spron.set': '✅ Gemt for hele serveren! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ Fjernede “{term}” fra serveren.',
  'spron.notFound': 'Serveren har ingen udtale for “{term}”.',
  'spron.limitHit':
    '🔒 Serveren har nået sin grænse på **{limit}** udtaler. Fjern en med `/server-pronunciation remove`.',
  'spron.modalTitle': 'Serverudtale',
  'spron.modalSay': 'Hvordan Vozen siger det for alle',
  'rand.selectPrompt': '🎲 **Randomizer** — mellem hvor mange muligheder skal jeg vælge?',
  'rand.selectPlaceholder': 'Antal muligheder…',
  'rand.selectOption': '{n} muligheder',
  'rand.filling': '📝 Udfyld formularen, der lige er åbnet!',
  'rand.modalTitle': 'Randomizer — {amount} muligheder',
  'rand.modalOption': 'Mulighed {n}',
  'rand.needTwo': 'Giv mig mindst 2 muligheder adskilt af kommaer (f.eks. "pizza, sushi").',
  'rand.result': 'Ud af {count} muligheder vælger jeg… **{winner}**!',
  'rand.speak': 'Jeg vælger… {winner}!',
  'rand.notInVoice': '_(gå ind i en talekanal med mig, så siger jeg det højt næste gang)_',
  'rand.timeout': '⏰ Intet valgt — kør `/randomizer` igen, når du er klar.',
};
