export default {
  'error.generic': 'Er ging iets mis. Probeer het opnieuw.',
  'stt.guildOnly': 'Transcriptie werkt alleen binnen een server.',
  'stt.noManage':
    'Je hebt de **Server beheren**-rechten nodig om transcriptie te starten of te stoppen.',
  'stt.notPremium':
    '🎙️ Live transcriptie is een **Premium**-functie. Bekijk `/premium info` om het voor deze server te ontgrendelen.',
  'stt.unavailable':
    'Transcriptie is niet beschikbaar op deze instantie (de spraak-naar-tekstengine is niet geïnstalleerd).',
  'stt.notInVoice':
    'Ik zit niet in een spraakkanaal — sluit je bij een kanaal aan en gebruik eerst `/join`, en start dan de transcriptie.',
  'stt.alreadyRunning':
    'Er loopt al een transcriptie op deze server. Gebruik eerst `/transcribe stop`.',
  'stt.atCapacity':
    'Er lopen nu te veel transcripties over alle servers heen. Probeer het zo meteen opnieuw.',
  'stt.noChannel':
    'Ik kan hier geen transcripties plaatsen. Probeer het commando vanuit een gewoon tekstkanaal uit te voeren.',
  'stt.started':
    '✅ Transcriptie gestart. Iedereen die op **Toestemmen** in de aankondiging drukt, wordt naar dit kanaal getranscribeerd.',
  'stt.startFailed':
    'Kon de transcriptie niet starten (het plaatsen van de aankondiging is mislukt). Ik heb alles ongedaan gemaakt — er wordt niets opgenomen. Probeer het opnieuw.',
  'stt.announceStart':
    '🎙️ **Live transcriptie staat AAN in dit kanaal.** Alleen wie toestemming geeft, wordt getranscribeerd — druk op de knop hieronder om toe te staan dat je spraak hier wordt uitgeschreven. Je kunt je toestemming altijd intrekken met `/transcribe revoke`.',
  'stt.consentBtn': 'Toestemming geven om getranscribeerd te worden',
  'stt.consentThanks':
    '✅ Bedankt — je spraak wordt nu op deze server getranscribeerd. Trek je toestemming altijd in met `/transcribe revoke`.',
  'stt.stopped': '🛑 Transcriptie gestopt.',
  'stt.notRunning': 'Er loopt geen transcriptie op deze server.',
  'stt.announceStop': '🛑 **Live transcriptie staat nu UIT.** Ik ben gestopt met luisteren.',
  'stt.revoked':
    '✅ Toestemming ingetrokken — je wordt niet langer op deze server getranscribeerd. (Al geplaatste berichten blijven staan; verwijder ze in Discord als je wilt.)',
  'stt.revokeNone':
    'Je had geen toestemming gegeven voor transcriptie op deze server, dus er was niets in te trekken.',
  'privacy.eraseConfirm':
    '⚠️ Dit verwijdert **al** je Vozen-gegevens op elke server permanent: steminstellingen, uitgesproken bijnaam, persoonlijke afkortingen en uitspraken, opgeslagen verjaardag, spelscores, praatstatistieken en opt-out. **Dit kan niet ongedaan worden gemaakt.** Weet je het zeker?',
  'privacy.erasePremiumNote':
    '_Let op: je betaalde Premium/Plus en de bijbehorende aankoopgeschiedenis blijven bewaard — die horen bij jou en bij wettelijk verplichte financiële administratie. Om Premium te stoppen, laat je het verlopen of neem je contact op met support._',
  'privacy.eraseYes': 'Alles verwijderen',
  'privacy.eraseNo': 'Annuleren',
  'privacy.eraseCancelled': 'Geannuleerd — er is niets verwijderd.',
  'privacy.eraseDone': '✅ Klaar. Al je persoonlijke gegevens zijn permanent verwijderd.',
  'error.needManageGuild': 'Je hebt de **Server beheren**-rechten nodig om dat te doen.',
  'join.needVoiceChannel': 'Spring eerst in een spraakkanaal en gebruik dan /join.',
  'join.missingPerms': 'Ik heb de rechten **Verbinden** en **Spreken** nodig in {channel}.',
  'join.joined':
    '✅ Ik zit in {channel}! Volgende stap: zeg `/tts hallo` en ik lees het hardop voor. Wil je dat ik een kanaal automatisch voorlees? Gebruik /setup.',
  'join.joinedAutoread':
    '✅ Ik zit in {channel}! Alles is klaar. Typ in het kanaal voor automatisch voorlezen en ik lees het hardop voor. → {readChannel}',
  'leave.left': 'Het spraakkanaal verlaten. Tot de volgende keer!',
  'skip.notInVoice':
    'Ik zit nog niet in een spraakkanaal — sluit je bij een kanaal aan en gebruik eerst /join, en probeer het dan opnieuw.',
  'skip.skipped': 'Overgeslagen.',
  'skip.nothing': 'Er wordt nu niets afgespeeld.',
  'shutup.notInVoice':
    'Ik zit nog niet in een spraakkanaal — sluit je bij een kanaal aan en gebruik eerst /join.',
  'shutup.nothing': 'Er wordt nu niets afgespeeld.',
  'shutup.done': '🤐 Oké, ik stop — alles in de wachtrij is gewist.',
  'tts.notInVoice':
    'Ik zit nog niet in een spraakkanaal — sluit je bij een kanaal aan en gebruik /join, en probeer het dan opnieuw.',
  'tts.nothingToRead': 'Daar valt niets voor te lezen — stuur me wat tekst om uit te spreken.',
  'tts.nothingAfterClean':
    'Nadat ik dat had opgeschoond, bleef er niets over om voor te lezen — probeer wat normale tekst (letters of woorden).',
  'tts.tooFast': 'Ho, rustig aan — probeer het zo meteen opnieuw.',
  'tts.blocked': 'Die tekst bevat een geblokkeerd woord, dus ik heb het overgeslagen.',
  'tts.queued': 'Begrepen — het staat in de wachtrij.',
  'tts.busy': 'Ik heb het nu druk — probeer het zo meteen opnieuw.',
  'voice.unknownModel': 'Die stem ken ik niet — bekijk /voice list.',
  'voice.badSpeed':
    'De snelheid moet tussen 0.5 en 2.0 liggen (1.0 is normaal). Probeer `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Je stem is nu **{name}** op {speed}×. Probeer `/tts hallo` om het te horen. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Stem instellen** — kies hieronder je opties en druk daarna op **Opslaan**. Tot die tijd verandert er niets.',
  'voice.config.summary': 'Huidige selectie: **{voice}** · engine **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Taal…',
  'voice.config.pickVoice': 'Stem…',
  'voice.config.pickEngine': 'Engine…',
  'voice.config.pickSpeed': 'Snelheid…',
  'voice.config.more': '▼ Meer talen',
  'voice.config.engDefault': 'Standaard (lokaal)',
  'voice.config.save': 'Opslaan',
  'voice.config.cancel': 'Annuleren',
  'voice.config.cancelled': 'Instellen geannuleerd — er is niets gewijzigd.',
  'voice.config.expired':
    'Het paneel is verlopen — voer `/voice config` opnieuw uit om door te gaan.',
  'voice.listHeader': 'Beschikbare stemmen:',
  'voice.listEmpty': '(geen geïnstalleerd)',
  'voice.reset':
    '✅ Je stem staat weer op de standaard. Kies er wanneer je wilt een andere met `/voice list` en `/voice set`.',
  'voice.detection.on':
    '✅ Automatische taaldetectie staat AAN: elk bericht wordt voorgelezen met een stem voor de gedetecteerde taal (de spreker kan wisselen). Zet het uit met `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automatische taaldetectie staat UIT: je ene vaste stem leest alles voor, zodat je altijd hetzelfde klinkt.',
  'voice.optout':
    'Je wordt niet meer automatisch voorgelezen. Gebruik /voice opt-in om het weer aan te zetten.',
  'voice.optin': 'Je wordt weer automatisch voorgelezen.',
  'voice.nickname.set': '✅ Vozen noemt je nu hardop **{name}**.',
  'voice.nickname.cleared': '✅ Uitgesproken bijnaam gewist — Vozen gebruikt je servernaam.',
  'voice.nickname.invalid':
    'Die naam bevat niets voorleesbaars om hardop te zeggen. Probeer letters of cijfers.',
  'voice.effect.set':
    '✅ Stemeffect ingesteld op **{effect}** — je berichten worden nu met dat effect afgespeeld. Gebruik `/voice effect none` om het uit te zetten.',
  'voice.effect.cleared': '✅ Stemeffect verwijderd — weer een schone stem.',
  'voice.effect.locked':
    '🔒 **{effect}** is een Premium-effect. Gratis effecten: 🤖 Robot en 🔊 Echo. Ontgrendel ze allemaal met Vozen Premium — bekijk `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** is een Premium-stemengine. Ontgrendel hem met Vozen Plus (persoonlijk) of Vozen Premium (server) — bekijk `/premium`. Ondertussen blijft je stem op de gratis lokale engine.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** is een Premium-stemengine. Ontgrendel hem met Vozen Plus (persoonlijk) of Vozen Premium (server) — bekijk `/premium`. Ondertussen blijft je stem op de gratis lokale engine.',
  'voice.notInVoice': 'Ik zit nog niet in een spraakkanaal — gebruik eerst /join.',
  'voice.previewPlaying': 'Een voorbeeld afspelen…',
  'preview.sample': 'Hoi, ik ben Vozen. Typ het, hoor het.',
  'laugh.playing': 'Haha! Dat afspelen in jouw stem…',
  'joke.playing': 'Een grap vertellen…\n> {joke}',
  'joke.unknownLang': 'Die taal ken ik niet. Kies er een uit de lijst.',
  'rizz.playing': '😏 Wat rizz eruit gooien…\n> {line}',
  'rizz.unknownLang': 'Die taal ken ik niet. Kies er een uit de lijst.',
  'rizz.locked':
    '🔒 **/rizz** is een Premium-extraatje. Ontgrendel het met Vozen Plus (jij) of Premium (deze server). Bekijk `/premium`.',
  'sound.playing': '🔊 **{name}** afspelen…',
  'sound.unknown': 'Dat geluid heb ik niet. Gebruik `/sound` om de lijst te zien.',
  'sound.list':
    '🔊 **Geluiden:** {sounds}\nSpeel er een af met `/sound name:<sound>` (ik moet in je spraakkanaal zitten).',
  'sound.disabled':
    '🔇 Het soundboard staat **uit** op deze server. Een beheerder kan het inschakelen met `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Verjaardag opgeslagen: **{day}/{month}**. Ik wens je een fijne verjaardag wanneer je op die dag bij een spraakkanaal aansluit!',
  'birthday.invalid': 'Dat is geen echte datum. Controleer de dag en de maand.',
  'birthday.cleared': '🎂 Verjaardag verwijderd.',
  'birthday.show': '🎂 Je verjaardag staat ingesteld op **{day}/{month}**.',
  'birthday.none': 'Je hebt nog geen verjaardag ingesteld. Gebruik `/birthday set`.',
  'topspeakers.title': '🗣️ **Topsprekers** — wie ik het meest voorlees op deze server:',
  'topspeakers.empty':
    'Ik heb nog niemands berichten voorgelezen. Stel een voorleeskanaal in met `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** berichten · 🔥 reeks van {streak} dagen',
  'serverstats.title': '📊 **Serverstatistieken**',
  'serverstats.empty':
    'Nog geen statistieken — ik heb hier geen berichten voorgelezen of spellen gespeeld. Stel in met `/setup`!',
  'serverstats.messages': '🗣️ **{total}** berichten voorgelezen · **{speakers}** mensen',
  'serverstats.topTalkers': '**Toppraters:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} ber. · 🔥 {streak}d',
  'serverstats.streak': '🔥 Langste actieve reeks: **{days}** dagen',
  'serverstats.games':
    '🎮 **{points}** spelpunten · **{wins}** overwinningen · **{players}** spelers',
  'serverstats.topPlayers': '**Topspelers:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} ptn · {wins} overw.',
  'serverstats.upsell':
    '🔒 Dat is het gratis voorproefje. **Premium** ontgrendelt reeksen, spelstatistieken en de volledige top 5 — bekijk `/premium`.',
  'streak.day':
    '🔥 <@{user}> heeft een reeks van **{n} dagen**! Blijf praten om hem in leven te houden.',
  'leaderboard.autoTitle': '🏆 Toppraters op deze server',
  'premium.title': '💎 **Vozen Premium-status**',
  'premium.lineServerActive': '🖥️ **Server:** Premium tot {date}',
  'premium.lineServerFree': '🖥️ **Server:** gratis plan',
  'premium.lineUserActive': '👤 **Jij (Plus):** actief tot {date}',
  'premium.lineUserFree': '👤 **Jij (Plus):** niet actief',
  'premium.getHint':
    'Alles wat je vandaag gebruikt, blijft gratis. Premium voegt alle 8 stemeffecten, 24/7 in de call, 50 persoonlijke uitspraken, /rizz en de premiumspellen toe. Steun: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Je Premium-pas:** {used}/{total} licenties in gebruik · verloopt {date}',
  'premium.passServers': '↳ In gebruik op: {servers}',
  'premium.pitch':
    'Je hebt nog geen Premium. **Vozen Premium** (€3,99/mnd voor 3 servers, of €7,99/mnd voor 8) ontgrendelt voor de hele server: alle 8 stemeffecten, 24/7 in de call, 50 persoonlijke uitspraken (i.p.v. 3), het /rizz-commando en de premiumspellen (Woordketting, Wordle, Schaken). **Vozen Plus** (€1,99/mnd) geeft jou die extraatjes persoonlijk, op elke server.',
  'premium.buyHint':
    '▶ **Premium halen:** {link}\nNa aankoop, gebruik `/premium activate` op de server die je wilt.',
  'premium.confirmActivate':
    '**1 van je {total} Premium-licenties** op **deze server** gebruiken? Je hebt er nu **{used}** in gebruik. Je kunt hem later vrijmaken met `/premium deactivate` — de klok van de pas loopt hoe dan ook door.',
  'premium.confirmYes': '💎 Licentie gebruiken',
  'premium.confirmNo': 'Annuleren',
  'premium.activateOk':
    '✅ Premium is nu actief op **deze server** tot {date}. Licenties: **{used}/{total}** in gebruik.',
  'premium.activateCancelled': 'Geannuleerd — er is geen licentie gebruikt.',
  'premium.activateTimeout': 'Tijd verstreken — er is geen licentie gebruikt.',
  'premium.noPass':
    'Je hebt geen actieve Premium-pas. Koop er een en hij belandt op je account — gebruik daarna `/premium activate` hier.\n▶ {link}',
  'premium.alreadyActive': 'Deze server heeft al een van je Premium-licenties. Niets te doen.',
  'premium.noSeats':
    'Al je **{total}** Premium-licenties zijn in gebruik ({servers}). Maak er daar een vrij met `/premium deactivate` en probeer het hier opnieuw.',
  'premium.needManageGuild':
    'Premium activeren heeft invloed op de hele server — alleen leden met **Server beheren** kunnen dat. Vraag een beheerder.',
  'premium.deactivateOk':
    '✅ De Premium-licentie van deze server vrijgemaakt. Gebruik hem op een andere server met `/premium activate`.',
  'premium.deactivateNone': 'Deze server heeft geen Premium-licentie van jou om vrij te maken.',
  'premium.thisServer': 'deze server',
  'grant.denied': '⛔ Dit commando is alleen voor de eigenaar van de bot.',
  'grant.okPremium':
    '✅ <@{user}> een **Premium-pas** ({seats} licenties) voor **{days}** dagen toegekend — verloopt {date}. Ze activeren hem met `/premium activate`.',
  'grant.okPlus': '✅ <@{user}> **Vozen Plus** voor **{days}** dagen toegekend — verloopt {date}.',
  'gencode.done':
    '✅ **{count}** {plan}-code(s) gegenereerd, elk **{days}** dagen. Deel ze privé:\n{list}',
  'redeem.okPlus':
    '🎁 Ingewisseld! Je kreeg **Vozen Plus** voor **{days}** dagen — verloopt {date}.',
  'redeem.okPremium':
    '🎁 Ingewisseld! Je kreeg een **Premium-pas** ({seats} licenties) voor **{days}** dagen — verloopt {date}. Activeer hem in je server met `/premium activate`.',
  'redeem.notFound': '❌ Die code bestaat niet. Controleer hem goed en probeer het opnieuw.',
  'redeem.used': '❌ Die code is al ingewisseld.',
  'redeem.expired': '❌ Die code is verlopen.',
  'voice.abbrev.added': 'Begrepen — {term} wordt voorgelezen als {replacement}.',
  'voice.abbrev.removed': 'Je afkorting voor {term} is verwijderd.',
  'voice.abbrev.listHeader': 'Je persoonlijke afkortingen ({count}/{cap} gebruikt):',
  'voice.abbrev.listEmpty': '(nog geen — voeg er een toe met /voice abbrev add)',
  'voice.abbrev.capReached':
    'Je hebt de limiet van {cap} persoonlijke afkortingen bereikt. Verwijder er een voordat je een nieuwe toevoegt.',
  'voice.abbrev.invalidTerm':
    'De term moet één woord zijn (alleen letters en cijfers), maximaal 50 tekens.',
  'voice.abbrev.emptyReplacement': 'De uitspraak mag niet leeg zijn.',
  'voice.abbrev.tooLong': 'De uitspraak is te lang (max. 200 tekens).',
  'config.wordEmpty': 'Het woord mag niet leeg zijn.',
  'config.blocked': 'Geblokkeerd: {word}.',
  'config.blockLimit':
    'Deze server heeft al het maximum van {max} geblokkeerde woorden. Verwijder er een voordat je een nieuwe toevoegt.',
  'config.unblocked': 'Gedeblokkeerd: {word}.',
  'config.pronListHeader': 'Uitspraakwoordenboek:',
  'config.pronEmptyValue': '(leeg)',
  'config.listEmpty': '(geen)',
  'config.termEmpty': 'De term mag niet leeg zijn.',
  'config.pronEmpty': 'De uitspraak mag niet leeg zijn.',
  'config.pronSet': 'Begrepen — {term} wordt voorgelezen als {replacement}.',
  'config.pronRemoved': 'De uitspraak voor {term} is verwijderd.',
  'config.channelWrongType': 'Kies een tekstkanaal (geen spraakkanaal of categorie).',
  'config.channelNoAccess': 'Ik kan {channel} niet zien — controleer daar mijn rechten.',
  'config.channelSet':
    'Kanaal voor automatisch voorlezen ingesteld op {channel}. Volgende: zorg dat automatisch voorlezen aanstaat met `/config auto-read active:true`.',
  'config.autoreadOn': 'Automatisch voorlezen staat nu **aan**.',
  'config.autoreadOff': 'Automatisch voorlezen staat nu **uit**.',
  'config.maxCharsRange': 'De waarde voor max. tekens moet tussen 1 en 2000 liggen.',
  'config.maxCharsSet': 'Max. aantal tekens per bericht ingesteld op {value}.',
  'config.rateLimitRange': 'De waarde voor de snelheidslimiet moet tussen 1 en 120 liggen.',
  'config.rateLimitSet': 'Snelheidslimiet ingesteld op {value} berichten per minuut.',
  'config.roleSet': 'Automatisch voorlezen is nu beperkt tot leden met {role}.',
  'config.roleCleared': 'Rolbeperking verwijderd — iedereen kan nu voorgelezen worden.',
  'config.enabledOn': 'TTS staat nu **aan** voor deze server.',
  'config.enabledOff': 'TTS staat nu **uit** voor deze server.',
  'config.xsaidOn':
    'Vozen kondigt nu **wie sprak** aan vóór elk bericht (bijv. "Alex zei hoi"). Zet uit met `/config x-said active:false`.',
  'config.xsaidOff':
    'Vozen kondigt **niet langer** aan wie sprak — het leest alleen het bericht voor.',
  'config.autojoinOn':
    '✅ Automatisch aansluiten **aan** — Vozen sluit zich bij je spraakkanaal aan wanneer je in het TTS-kanaal typt.',
  'config.autojoinOff':
    'Automatisch aansluiten **uit** — gebruik `/join` om Vozen naar de spraak te halen.',
  'config.stayOn':
    '✅ 24/7 in de call **aan** — Vozen blijft in het spraakkanaal, zelfs als het leegloopt, en komt terug na herstarts. 💎 Vereist Premium om effect te hebben (koop of `/redeem` een code, daarna `/premium activate`).',
  'config.stayOff':
    '24/7 in de call **uit** — Vozen vertrekt wanneer het spraakkanaal leegloopt (standaard).',
  'config.readBotsOn': '✅ Vozen leest nu ook berichten van **andere bots en webhooks** voor.',
  'config.readBotsOff':
    'Vozen **negeert** andere bots en webhooks (alleen echte mensen worden voorgelezen).',
  'config.textInVoiceOn': '✅ Vozen leest ook de **tekstchat binnen zijn spraakkanaal** voor.',
  'config.textInVoiceOff':
    'Vozen leest de tekstchat van het spraakkanaal **niet** voor (alleen het TTS-kanaal).',
  'config.antispamOn':
    '✅ Antispam **aan** — Vozen leest gespamde berichten niet voor (massale woordherhaling of hetzelfde grote bericht steeds opnieuw geplaatst).',
  'config.antispamOff': 'Antispam **uit** — Vozen leest elk bericht zoals gebruikelijk voor.',
  'config.streaksOn':
    '✅ Reeksmeldingen **aan** — Vozen toont een 🔥 dagreeks-bericht de eerste keer dat iemand elke dag spreekt.',
  'config.streaksOff':
    'Reeksmeldingen **uit** — Vozen houdt reeksen nog steeds bij (zie `/top-speakers`) maar zegt er niets over.',
  'config.soundboardOn': 'Soundboard **aan** — iedereen kan clips afspelen met `/sound`.',
  'config.soundboardOff': 'Soundboard **uit** — `/sound` is uitgeschakeld op deze server.',
  'config.votePromosLabel': 'Meldingen over top.gg-beloning + Vozen Support',
  'config.greetOn': '✅ Ik begroet mensen bij naam wanneer ze bij het spraakkanaal aansluiten.',
  'config.greetOff': '🔇 Ik begroet mensen **niet** wanneer ze bij het spraakkanaal aansluiten.',
  'config.greetLangSet': '✅ Taal van de begroeting bij binnenkomst ingesteld op **{language}**.',
  'config.defaultVoiceSet':
    '✅ Standaardstem van de server ingesteld op **{name}**. Leden zonder eigen stem horen deze. (id: `{model}`)',
  'config.reset':
    'Configuratie teruggezet naar de standaardwaarden. Je blokkeerlijst en uitspraken zijn bewaard.',
  'config.showTitle': '**Serverconfiguratie**',
  'config.showChannel': 'TTS-kanaal: {value}',
  'config.showAutoread': 'Automatisch voorlezen: {value}',
  'config.showRole': 'Rol: {value}',
  'config.showEnabled': 'Ingeschakeld: {value}',
  'config.showXsaid': 'Spreker aankondigen (xsaid): {value}',
  'config.showAutojoin': 'Automatisch aansluiten: {value}',
  'config.showReadBots': 'Bots/webhooks voorlezen: {value}',
  'config.showTextInVoice': 'Tekst-in-spraak: {value}',
  'config.showAntispam': 'Antispam: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': 'Begroeten bij binnenkomst: {value} ({language})',
  'config.showVoice': 'Standaardstem: {value}',
  'config.showMaxChars': 'Max. tekens: {value}',
  'config.showRateLimit': 'Snelheidslimiet: {value}/min',
  'config.showBlocklist': 'Blokkeerlijst: {count} woorden',
  'config.showPronunciation': 'Uitspraken: {count} vermeldingen',
  'config.valueNone': '(geen)',
  'config.valueAny': 'iedereen',
  'config.valueAutoDetect': '(automatisch detecteren)',
  'config.on': 'aan',
  'config.off': 'uit',
  'config.language.set': 'Interfacetaal ingesteld op {language}.',
  'config.language.unsupported': 'Die taal wordt nog niet ondersteund.',
  'setup.noChannel':
    'Ik kon niet bepalen welk kanaal ik moest gebruiken. Geef een tekstkanaal op in de optie "channel".',
  'setup.channelWrongType':
    'Het kanaal voor automatisch voorlezen moet een tekstkanaal zijn (geen spraakkanaal of categorie). Geef er een op in de optie "channel".',
  'setup.done': '**Alles ingesteld — Vozen is klaar.**',
  'setup.channelLine': 'Kanaal voor automatisch voorlezen: {channel}',
  'setup.autoreadOn': 'Automatisch voorlezen: aan',
  'setup.permsHeader': '**Rechten:**',
  'setup.permView': 'ViewChannel (het tekstkanaal zien)',
  'setup.permSend': 'SendMessages (in het tekstkanaal posten)',
  'setup.permConnect': 'Connect (bij het spraakkanaal aansluiten)',
  'setup.permSpeak': 'Speak (praten in het spraakkanaal)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — ontbreekt',
  'setup.permUnchecked': '⏳ {label} — nog niet gecontroleerd (ik controleer het bij /join)',
  'setup.fixHint':
    'Om te verhelpen wat ontbreekt: open in je serverinstellingen de rol van Vozen (of de rechten van het kanaal) en schakel de items in die met ❌ zijn gemarkeerd.',
  'setup.voiceUncheckedNote':
    'Je zit niet in een spraakkanaal, dus ik kon Connect/Speak nog niet controleren — ik controleer ze wanneer je /join gebruikt.',
  'setup.allGood': 'Alles is klaar. Spring in een spraakkanaal en gebruik /join.',
  'setup.joinedVoice': 'Ik heb me ook bij {channel} aangesloten — /join is niet nodig.',
  'setup.readyTalk':
    'Alles is klaar. Typ in het kanaal voor automatisch voorlezen en ik lees het hardop voor.',
  'setup.membersHeader': '**Vertel het je leden (het stappenplan van 3 stappen):**',
  'setup.membersBody':
    "1) Sluit je aan bij een spraakkanaal\n2) Gebruik /join zodat ik bij je aansluit\n3) Typ in dit kanaal (of gebruik /tts) en ik lees het hardop voor\nVolledige lijst met commando's: /help",
  'stats.title': '**Vozen-statistieken**',
  'stats.messagesSpoken': 'Uitgesproken berichten: {value}',
  'stats.cacheHits': 'Cachetreffers: {value}',
  'stats.cacheMisses': 'Cachemissers: {value}',
  'stats.synthErrors': 'Synthesefouten: {value}',
  'stats.synthLatency': 'Synthesevertraging: p50 {p50}ms / p95 {p95}ms ({count} samples)',
  'stats.voiceDrops': 'Verbroken spraakverbindingen: {value}',
  'stats.voiceReconnects': 'Herverbindingen: {value}',
  'stats.votes': 'top.gg-stemmen: {value}',
  'stats.activePlayers': 'Actieve spelers: {value}',
  'stats.servers': 'Servers: {value}',
  'stats.uptime': 'Uptime: {value}s',
  'speak.emptyMessage': 'Dat bericht heeft geen tekst om hardop voor te lezen.',
  'uptime.text': '🟢 Vozen is al **{uptime}** online.',
  'botstats.title': '📊 **Vozen — statistieken**',
  'botstats.servers': 'Servers: **{value}**',
  'botstats.voiceSessions': 'Spraaksessies nu: **{value}**',
  'botstats.messagesSpoken': 'Uitgesproken berichten: **{value}**',
  'botstats.uptime': 'Uptime: **{value}**',
  'invite.noClientId':
    'De uitnodigingslink van Vozen is nog niet ingesteld (CLIENT_ID ontbreekt). Laat het de botbeheerder weten.',
  'invite.link': 'Voeg Vozen toe aan je server:\n{url}',
  'vote.noClientId':
    'De stemlink van Vozen is nog niet ingesteld (CLIENT_ID ontbreekt). Laat het de botbeheerder weten.',
  'vote.link':
    'Stem op Vozen (gratis, elke 12 uur) en help meer mensen om het te vinden:\n{url}\nAls dit account de beloning nog nooit heeft geclaimd, krijgt het **48 uur Vozen Plus**, slechts één keer per account.',
  'invite.button': 'Vozen toevoegen',
  'vote.button': 'Stem op top.gg',
  'vote.upsell':
    '🗳️ Als dit account de beloning nog nooit heeft geclaimd, krijgt het **48 uur Vozen Plus**, slechts één keer per account. {url}',
  'vote.cooldownStatus':
    '🗳️ Dit account heeft de eenmalige stembeloning al gebruikt. Je kunt nog steeds stemmen om Vozen te steunen, maar krijgt geen extra Plus.',
  'help.title': 'Vozen — typ het, hoor het.',
  'help.embedTitle': "Vozen — Commando's",
  'help.intro':
    'Vozen leest je tekst hardop voor in spraakkanalen — gratis neurale stemmen, tientallen talen.',
  'help.quickStartTitle': 'Snel starten (3 stappen)',
  'help.quickStartBody':
    '1) Sluit je aan bij een spraakkanaal en gebruik dan /join\n2) Typ in het tekstkanaal (of gebruik /tts Hallo allemaal!)\n3) (optioneel) Kies een stem met /voice set',
  'help.groupStarted': 'Aan de slag',
  'help.groupStartedBody':
    '• /join — ik sluit me aan bij je spraakkanaal\n• /leave — ik verlaat het spraakkanaal\n• /tts <tekst> — ik lees tekst hardop voor · bijv. /tts Hallo allemaal!\n• /skip — sla over wat ik nu voorlees',
  'help.groupVoice': 'Jouw stem',
  'help.groupVoiceBody':
    '• /voice set <model> — kies je stem · bijv. /voice set en_US-amy-medium\n• /voice list — bekijk de beschikbare stemmen\n• /voice preview — hoor een voorbeeld van je stem\n• /voice reset — ga terug naar de standaardstem\n• /voice opt-out · /voice opt-in — zet automatisch voorlezen voor jou uit / aan\n• /voice abbrev add|remove|list — persoonlijke slang, op jouw manier voorgelezen (max. 10)',
  'help.groupFun': 'Plezier',
  'help.groupFunBody':
    '• /joke — ik vertel een korte grap (kies een taal + optioneel gelach) · bijv. /joke English\n• /laugh — ik lach hardop in je huidige stem',
  'help.groupAdmin': 'Serverbeheer (vereist Server beheren)',
  'help.groupAdminBody':
    '• /setup — begeleide configuratie in één stap · gebruik dit eerst\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · bijv. /config tts-channel #algemeen\n• /stats — botstatistieken',
  'help.groupMore': 'Meer',
  'help.groupMoreBody':
    '• /invite — voeg Vozen toe aan een andere server\n• /vote — stem op Vozen op top.gg\n• /help — toon deze help',
  'help.footer': 'Nieuw hier? Gebruik {command} om te beginnen.',
  'help.support': '🛟 Hulp nodig of wil je een probleem melden? {url}',
  'help.source': '📄 Open source (AGPL-3.0) — verkrijg de exacte broncode die hier draait: {url}',
  'welcome.title': 'Bedankt voor het toevoegen van Vozen! 👋',
  'welcome.description':
    "Vozen leest je chat hardop voor in spraakkanalen — typ het, hoor het.\n\n**Begin in één stap:** gebruik {setup} en ik stel automatisch voorlezen in en sluit me aan bij je spraakkanaal.\n\nWil je de volledige lijst met commando's? Gebruik {help}.",
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Hoe leden het gebruiken (3 stappen)',
  'welcome.stepsBody':
    "1) Sluit je aan bij een spraakkanaal\n2) Gebruik /join zodat ik me bij je aansluit\n3) Typ in het tekstkanaal (of gebruik /tts) en ik lees het hardop voor\nVolledige lijst met commando's: /help",
  'welcome.footer': 'Vozen — typ het, hoor het.',
  'welcome.tagline': 'Natuurlijke neurale stem — voor altijd gratis, geen betaalmuur.',
  'game.start.needVoice':
    'Dit is een **spraakspel** — spring in een spraakkanaal en gebruik eerst /join, en start het dan.',
  'game.start.alreadyActive':
    'Er loopt al een spel in <#{channel}>. Maak het af (of gebruik `/game stop`) voordat je een nieuwe start.',
  'game.start.premiumLocked':
    '🔒 **{game}** is een Premium-spel (het kost echte rekenkracht). Bekijk `/premium`.',
  'game.start.started': '🎮 **{game}** wordt gestart! Let op het kanaal — succes!',
  'game.start.startedThread':
    '🎮 **{game}** gestart in <#{channel}> — doe daar mee! De thread verwijdert zichzelf wanneer het spel eindigt.',
  'game.thread.winner': '🏆 {winner} heeft het spel gewonnen!',
  'game.thread.ended': '🎮 Het spel is afgelopen.',
  'game.unknownGame': 'Dat spel ken ik niet. Kies er een uit de lijst.',
  'game.stop.ok': '🛑 Het huidige spel gestopt.',
  'game.stop.none': 'Er loopt nu geen spel.',
  'game.list.title': '🎮 **Spellen** — start er een met `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Ranglijst** — topspelers op deze server:',
  'game.leaderboard.empty': 'Er is nog niet gespeeld. Wees de eerste — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** ptn ({wins} overwinningen)',
  'game.finish.title': '🏁 **Spel voorbij!** Eindscores:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Spel voorbij — niemand scoorde deze keer. Volgende keer beter!',
  'game.finish.winnerVoice': '{user} wint!',
  'game.guessLanguage.name': 'Raad de Taal',
  'game.guessLanguage.desc':
    'Ik lees een zin voor in een willekeurige taal — de eerste die hem benoemt, wint het punt.',
  'game.guessLanguage.intro':
    '🗣️ **Raad de Taal** — ik lees {rounds} zinnen voor. Typ welke taal je hoort. Het snelste juiste antwoord wint elke ronde!',
  'game.guessLanguage.round': '🎧 Ronde {n}/{total} — luister…',
  'game.guessLanguage.correct': '✅ **{user}** had het — het was **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Tijd! Dat was **{language}**.',
  'game.guessLanguage.noLanguages':
    'Ik heb niet genoeg stemmen geïnstalleerd om dit te spelen. Vraag een beheerder om meer stemmen toe te voegen.',
  'game.math.name': 'Hoofdrekenen',
  'game.math.desc': 'Ik zeg een som hardop — de eerste die het antwoord typt, wint.',
  'game.math.intro':
    '🔢 **Hoofdrekenen** — {rounds} sommen. Luister en typ het antwoord zo snel als je kunt!',
  'game.math.round': '🧮 Ronde {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** had het precies — het antwoord was **{answer}**!',
  'game.math.timeout': '⏱️ Tijd! Het antwoord was **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'min',
  'game.math.times': 'keer',
  'game.skipCount.name': 'Ontbrekend Getal',
  'game.skipCount.desc': 'Ik tel hardop maar sla één getal over — de eerste die het betrapt, wint.',
  'game.skipCount.intro':
    '🔢 **Ontbrekend Getal** — ik tel, maar ik sla er één over. Typ het ontbrekende getal! ({rounds} rondes)',
  'game.skipCount.round': '👂 Ronde {n}/{total} — welk getal heb ik overgeslagen?',
  'game.skipCount.correct': '✅ **{user}** betrapte het — ik sloeg **{answer}** over!',
  'game.skipCount.timeout': '⏱️ Tijd! Ik sloeg **{answer}** over.',
  'game.spelling.name': 'Spellingwedstrijd',
  'game.spelling.desc': 'Ik zeg een woord — de eerste die het correct spelt, wint.',
  'game.spelling.intro':
    '✍️ **Spellingwedstrijd** — ik zeg {rounds} woorden. Typ ze allemaal correct gespeld!',
  'game.spelling.round': '🗣️ Ronde {n}/{total} — schrijf het woord dat ik zeg…',
  'game.spelling.correct': '✅ **{user}** spelde **{word}** goed!',
  'game.spelling.timeout': '⏱️ Tijd! Het woord was **{word}**.',
  'game.spelling.empty': 'Ik heb nog geen woordenlijst voor de spraaktaal van deze server.',
  'game.spellOut.name': 'Ontcijfer de Spelling',
  'game.spellOut.desc':
    'Ik spel een woord letter voor letter — de eerste die het hele woord schrijft, wint.',
  'game.spellOut.intro':
    '🔡 **Ontcijfer de Spelling** — ik spel {rounds} woorden letter voor letter. Typ het volledige woord!',
  'game.spellOut.round': '🔤 Ronde {n}/{total} — luister naar de letters…',
  'game.spellOut.correct': '✅ **{user}** had het — **{word}**!',
  'game.spellOut.timeout': '⏱️ Tijd! Het spelde **{word}**.',
  'game.fastSpeech.name': 'Snelspraak',
  'game.fastSpeech.desc': 'Ik lees een zin supersnel voor — de eerste die typt wat ik zei, wint.',
  'game.fastSpeech.intro':
    '💨 **Snelspraak** — {rounds} zinnen op belachelijke snelheid. Typ wat je hoort!',
  'game.fastSpeech.round': '⚡ Ronde {n}/{total} — daar komt-ie, snel!',
  'game.fastSpeech.correct': '✅ **{user}** ontcijferde het: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Tijd! Het was: “{phrase}”',
  'game.fastSpeech.empty': 'Ik heb nog geen zinnen voor de spraaktaal van deze server.',
  'game.accentSwap.name': 'Gek Accent',
  'game.accentSwap.desc':
    'Ik zeg een woord met een buitenlands accent — de eerste die het schrijft, wint.',
  'game.accentSwap.intro':
    '🎭 **Gek Accent** — {rounds} woorden gezegd met het verkeerde accent. Typ het woord!',
  'game.accentSwap.round': '🌍 Ronde {n}/{total} — welk woord probeer ik te zeggen?',
  'game.accentSwap.correct': '✅ **{user}** had het — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Tijd! Het woord was **{word}**.',
  'game.reflexes.name': 'Reflexen',
  'game.reflexes.desc':
    'Ik tel af en roep dan NU — de eerste die daarna typt, wint. Niet te vroeg beginnen!',
  'game.reflexes.intro':
    '⚡ **Reflexen** — {rounds} rondes. Wanneer ik **NU** roep, typ dan zo snel mogelijk iets. Typ je vóór NU, dan is het een valse start!',
  'game.reflexes.ready': '🚦 Ronde {n}/{total} — maak je klaar…',
  'game.reflexes.countdown': 'drie… twee… één…',
  'game.reflexes.go': '🟢 **NU!!!**',
  'game.reflexes.goVoice': 'Nu!',
  'game.reflexes.tooSoon': '🔴 **{user}** ging te vroeg — te snel!',
  'game.reflexes.win': '⚡ **{user}** is de snelste! Punt!',
  'game.reflexes.tooSlow': '😴 Niemand reageerde op tijd. Volgende!',
  'game.headsOrTails.name': 'Kop of Munt',
  'game.headsOrTails.desc':
    'Voorspel de muntworp — typ kop of munt voordat ik gooi. Wie het beste voorspelt, wint!',
  'game.headsOrTails.intro':
    '🪙 **Kop of Munt** — {rounds} rondes. Typ elke ronde `heads` (kop) of `tails` (munt) voordat ik de munt gooi. 1 punt per juiste voorspelling!',
  'game.headsOrTails.introVoice': 'Laten we kop of munt spelen!',
  'game.headsOrTails.round': '🪙 Ronde {n}/{total} — kop of munt? Typ `heads` of `tails`!',
  'game.headsOrTails.roundVoice': 'Kop… of munt?',
  'game.headsOrTails.heads': 'kop',
  'game.headsOrTails.tails': 'munt',
  'game.headsOrTails.resultVoice': 'Het is {side}!',
  'game.headsOrTails.winners': 'Het is **{side}**! Punt voor: {users}',
  'game.headsOrTails.noWinners': 'Het is **{side}**! Niemand voorspelde het — geen punten.',
  'game.vozenSays.name': 'Vozen Zegt',
  'game.vozenSays.desc':
    "Gehoorzaam alleen als het bevel begint met 'Vozen zegt'. Trap je in een val, dan ben je erbij!",
  'game.vozenSays.intro':
    "🫡 **Vozen Zegt** — {rounds} bevelen. Doe het ALLEEN als ik begin met **'Vozen zegt'**. Anders: niet bewegen!",
  'game.vozenSays.prefix': 'Vozen zegt',
  'game.vozenSays.verb': 'typ',
  'game.vozenSays.real': '🗣️ Ronde {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Ronde {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** gehoorzaamde als eerste — punt!',
  'game.vozenSays.caught': '🔴 **{user}** — ik zei geen Vozen zegt! Erbij!',
  'game.vozenSays.nobody': '😴 Niemand gehoorzaamde **{word}** op tijd. Volgende!',
  'game.vozenSays.trapCleared': '😌 Het was een val — goed gezien, niemand trapte in **{word}**.',
  'game.roulette.name': 'Waarheid of Durf Roulette',
  'game.roulette.desc':
    'Ik draai en lees één waarheid-of-durf-opdracht hardop voor. Voer het opnieuw uit voor een volgende.',
  'game.roulette.header': '🎯 **Het rad zegt…**',
  'game.hangman.name': 'Galgje',
  'game.hangman.desc': 'Raad het woord letter voor letter — 6 missers en het is voorbij.',
  'game.hangman.intro':
    '🪢 **Galgje** — typ één letter per keer om het woord te raden. Je kunt ook het hele woord typen!',
  'game.hangman.hit': '🟢 **{user}** vond **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — geen **{letter}**.',
  'game.hangman.wrongLetters': 'Fout: {letters}',
  'game.hangman.win': '🎉 **{user}** loste het op — **{word}**!',
  'game.hangman.lose': '💀 Geen pogingen meer! Het woord was **{word}**.',
  'game.hangman.idle': '🕹️ Spel gepauzeerd (niemand speelt). Het woord was **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Raad het woord van 5 letters. 🟩 juiste plek, 🟨 verkeerde plek, ⬛ niet in het woord. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — typ een woord van 5 letters. Jullie delen {max} pogingen. 🟩 juiste plek · 🟨 verkeerde plek · ⬛ niet in het woord.',
  'game.wordle.guess': '🔤 **{user}** deed een gok — nog **{left}** pogingen',
  'game.wordle.inWord': '🟢 in woord: {letters}',
  'game.wordle.out': '🚫 eruit: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** had het in {n} — **{word}**!',
  'game.wordle.lose': '💀 Geen pogingen meer! Het woord was **{word}**.',
  'game.wordle.idle': '🕹️ Spel gepauzeerd (niemand speelt). Het woord was **{word}**.',
  'game.tictactoe.name': 'Boter, Kaas en Eieren',
  'game.tictactoe.desc':
    'Twee spelers — typ een getal 1-9 om je teken te plaatsen. Drie op een rij wint.',
  'game.tictactoe.intro':
    '⭕ **Boter, Kaas en Eieren** — de eerste twee spelers die zetten zijn ❌ en ⭕ (❌ begint). Typ een getal 1-9 om je vakje te spelen.',
  'game.tictactoe.turn': 'Beurt: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, **{mark}** is aan de beurt.',
  'game.tictactoe.taken': '🚫 Vakje {cell} is bezet — kies een ander.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) wint!',
  'game.tictactoe.draw': '🤝 Gelijkspel!',
  'game.tictactoe.idle': '🕹️ Spel beëindigd (niemand speelt).',
  'game.chess.name': 'Schaken',
  'game.chess.desc':
    'Twee spelers — echte schaakregels (schaak, rokeren, promotie…). Typ een zet zoals "e4" of "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Schaken** — de eerste twee spelers die zetten spelen met wit en zwart (wit begint). Typ een zet in algebraïsche notatie ("e4", "Nf3", "O-O") of coördinaten ("e2e4"). Typ "resign" om op te geven.',
  'game.chess.white': 'wit',
  'game.chess.black': 'zwart',
  'game.chess.seats': '⚪ Wit: **{white}** · ⚫ Zwart: **{black}**',
  'game.chess.turn': '{move} — aan zet: **{color}**',
  'game.chess.check': '♟️ Schaak!',
  'game.chess.notYourTurn': '⏳ **{user}**, **{color}** is aan zet.',
  'game.chess.illegalMove': '🚫 "{move}" is geen geldige zet — probeer het opnieuw.',
  'game.chess.checkmate': '🏆 Schaakmat ({move})! **{user}** wint!',
  'game.chess.draw': '🤝 Gelijkspel ({move})!',
  'game.chess.resigned': '🏳️ **{user}** gaf op — **{winner}** wint!',
  'game.chess.idle': '🕹️ Spel beëindigd (niemand speelt).',
  'game.wordChain.name': 'Woordketting',
  'game.wordChain.descr':
    'Woordketting op toerbeurt in één taal: zeg een woord dat begint met de laatste letter van het vorige. 2 levens, geen herhalingen, en de klok versnelt. Kies de taal met de optie `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Woordketting is momenteel niet beschikbaar in **{lang}** (woordenlijst ontbreekt).',
  'game.wordChain.lobby':
    '🔗 **Woordketting** in **{lang}**! Typ binnen **{seconds}s** iets in dit kanaal om mee te doen.',
  'game.wordChain.notEnough':
    '😴 Niet genoeg spelers deden mee (minstens 2 nodig). Spel geannuleerd.',
  'game.wordChain.begin':
    '🚀 We beginnen! Spelers: {players}. Elk woord moet beginnen met de laatste letter van het vorige.',
  'game.wordChain.turn':
    '**{name}**, jij bent! Een **{lang}** woord dat begint met **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — volgende letter: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Het moet beginnen met **{letter}**.',
  'game.wordChain.bad.short': '📏 Te kort — minstens **{min}** letters.',
  'game.wordChain.bad.repeated': '🔁 Dat woord is al gebruikt.',
  'game.wordChain.bad.word': '📖 Dat staat niet in het woordenboek.',
  'game.wordChain.bad.latin': '🔤 Alleen letters A–Z tellen.',
  'game.wordChain.timeout': '⏰ **{name}** had geen tijd meer! {hearts} over.',
  'game.wordChain.eliminated': '💀 **{name}** ligt eruit!',
  'game.wordChain.winner': '🏆 **{name}** wint de ketting! ({chain} woorden)',
  'game.stats.none': 'Je hebt nog geen spellen gespeeld. Probeer `/game play`!',
  'game.stats.body':
    '🎮 **Jouw statistieken** — **{points}** punten · **{wins}** overwinningen · {rank}',
  'game.stats.rank': 'plaats **#{rank}** van {total}',
  'game.stats.unranked': 'nog geen plaats',
  'game.pickPrompt': '🎮 Welk spel wil je spelen? Kies er een:',
  'game.pickPlaceholder': 'Kies een spel…',
  'game.pickTimeout': '⏰ Geen spel gekozen — gebruik `/game play` opnieuw wanneer je klaar bent.',
  'pron.listHeader': '🗣️ **Jouw uitspraken** ({count}/{limit}):',
  'pron.listEmpty': 'Je hebt er nog geen — voeg er een toe met `/pronunciation add`.',
  'pron.set': '✅ Opgeslagen! Wanneer **jij** “{term}” typt, zeg ik “{replacement}”.',
  'pron.removed': '🗑️ “{term}” verwijderd.',
  'pron.notFound':
    'Je hebt geen uitspraak voor “{term}”. Bekijk die van jou met `/pronunciation list`.',
  'pron.empty': 'Het woord en hoe je het zegt mogen niet leeg zijn.',
  'pron.limitHit':
    '🔒 Je hebt je limiet van **{limit}** uitspraken bereikt. Verwijder er een met `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus of Premium verhoogt het naar **50** → {url}',
  'pron.modalTitle': 'Leer Vozen een uitspraak',
  'pron.modalTerm': 'Het woord (zoals mensen het typen)',
  'pron.modalSay': 'Hoe Vozen het moet zeggen',
  'spron.listHeader': '🗣️ **Serveruitspraken** ({count}/{limit}) — gelden voor iedereen:',
  'spron.listEmpty': 'Nog geen — voeg er een toe met `/server-pronunciation add`.',
  'spron.set': '✅ Opgeslagen voor de hele server! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ “{term}” verwijderd van de server.',
  'spron.notFound': 'De server heeft geen uitspraak voor “{term}”.',
  'spron.limitHit':
    '🔒 De server heeft zijn limiet van **{limit}** uitspraken bereikt. Verwijder er een met `/server-pronunciation remove`.',
  'spron.modalTitle': 'Serveruitspraak',
  'spron.modalSay': 'Hoe Vozen het voor iedereen zegt',
  'rand.selectPrompt': '🎲 **Randomizer** — uit hoeveel opties wil je dat ik kies?',
  'rand.selectPlaceholder': 'Aantal opties…',
  'rand.selectOption': '{n} opties',
  'rand.filling': '📝 Vul het formulier in dat zojuist is geopend!',
  'rand.modalTitle': 'Randomizer — {amount} opties',
  'rand.modalOption': 'Optie {n}',
  'rand.needTwo': 'Geef me minstens 2 opties, gescheiden door komma\'s (bijv. "pizza, sushi").',
  'rand.result': 'Uit {count} opties kies ik… **{winner}**!',
  'rand.speak': 'Ik kies… {winner}!',
  'rand.notInVoice':
    '_(sluit je bij een spraakkanaal aan samen met mij en dan zeg ik het de volgende keer hardop)_',
  'rand.timeout': '⏰ Niets gekozen — gebruik `/randomizer` opnieuw wanneer je klaar bent.',
};
