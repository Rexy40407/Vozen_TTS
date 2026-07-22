export default {
  'error.generic': 'Nekaj je šlo narobe. Poskusi znova.',
  'stt.guildOnly': 'Prepisovanje deluje samo znotraj strežnika.',
  'stt.noManage':
    'Za zagon ali ustavitev prepisovanja potrebuješ dovoljenje **Upravljanje strežnika**.',
  'stt.notPremium':
    '🎙️ Prepisovanje v živo je funkcija **Premium**. Poglej `/premium info`, da jo odkleneš za ta strežnik.',
  'stt.unavailable':
    'Prepisovanje na tej instanci ni na voljo (pogon za pretvorbo govora v besedilo ni nameščen).',
  'stt.notInVoice':
    'Nisem v glasovnem kanalu — pridruži se enemu in najprej zaženi `/join`, nato zaženi prepisovanje.',
  'stt.alreadyRunning':
    'Prepisovanje na tem strežniku že teče. Najprej uporabi `/transcribe stop`.',
  'stt.atCapacity':
    'Trenutno na vseh strežnikih teče preveč prepisovanj. Poskusi znova čez kratek čas.',
  'stt.noChannel':
    'V ta kanal ne morem objavljati prepisov. Poskusi ukaz zagnati iz običajnega besedilnega kanala.',
  'stt.started':
    '✅ Prepisovanje se je začelo. Vsak, ki v obvestilu pritisne **Privoli**, bo prepisan v ta kanal.',
  'stt.startFailed':
    'Prepisovanja ni bilo mogoče zagnati (objava obvestila ni uspela). Vse sem razveljavil — nič se ne snema. Poskusi znova.',
  'stt.announceStart':
    '🎙️ **Prepisovanje v živo je v tem kanalu VKLOPLJENO.** Prepisani so samo tisti, ki privolijo — pritisni spodnji gumb, da dovoliš zapisovanje svojega govora tukaj. Privolitev lahko kadar koli prekličeš z `/transcribe revoke`.',
  'stt.consentBtn': 'Privoli v prepisovanje',
  'stt.consentThanks':
    '✅ Hvala — tvoj govor bo odslej prepisan na tem strežniku. Prekliči kadar koli z `/transcribe revoke`.',
  'stt.stopped': '🛑 Prepisovanje ustavljeno.',
  'stt.notRunning': 'Prepisovanje na tem strežniku ne teče.',
  'stt.announceStop': '🛑 **Prepisovanje v živo je zdaj IZKLOPLJENO.** Nehal sem poslušati.',
  'stt.revoked':
    '✅ Privolitev preklicana — na tem strežniku ne boš več prepisan. (Že objavljena sporočila ostanejo; če želiš, jih izbriši v Discordu.)',
  'stt.revokeNone': 'Na tem strežniku nisi privolil v prepisovanje, zato ni bilo česa preklicati.',
  'privacy.eraseConfirm':
    '⚠️ To trajno izbriše **vse** tvoje podatke Vozen na vseh strežnikih: nastavitve glasu, izgovorjeni vzdevek, osebne okrajšave in izgovorjave, shranjeni rojstni dan, rezultate iger, statistiko govora in izključitev. **Tega ni mogoče razveljaviti.** Si prepričan?',
  'privacy.erasePremiumNote':
    '_Opomba: tvoj plačani Premium/Plus in zgodovina nakupa se ohranita — pripadata tebi in zakonsko obveznim finančnim evidencam. Za prekinitev Premiuma pusti, da poteče, ali se obrni na podporo._',
  'privacy.eraseYes': 'Izbriši vse',
  'privacy.eraseNo': 'Prekliči',
  'privacy.eraseCancelled': 'Preklicano — nič ni bilo izbrisano.',
  'privacy.eraseDone': '✅ Opravljeno. Vsi tvoji osebni podatki so bili trajno izbrisani.',
  'error.needManageGuild': 'Za to potrebuješ dovoljenje **Upravljanje strežnika**.',
  'join.needVoiceChannel': 'Najprej se pridruži glasovnemu kanalu, nato zaženi /join.',
  'join.missingPerms': 'V {channel} potrebujem dovoljenji **Poveži se** in **Govori**.',
  'join.joined':
    '✅ Zdaj sem v {channel}! Naslednji korak: napiši `/tts hello` in prebral bom na glas. Želiš, da samodejno berem kanal? Zaženi /setup.',
  'join.joinedAutoread':
    '✅ Zdaj sem v {channel}! Vse je pripravljeno. Piši v kanalu za samodejno branje in prebral bom na glas. → {readChannel}',
  'leave.left': 'Zapustil sem glasovni kanal. Se vidimo naslednjič!',
  'skip.notInVoice':
    'Še nisem v glasovnem kanalu — pridruži se enemu in najprej zaženi /join, nato poskusi znova.',
  'skip.skipped': 'Preskočeno.',
  'skip.nothing': 'Trenutno se nič ne predvaja.',
  'shutup.notInVoice': 'Še nisem v glasovnem kanalu — pridruži se enemu in najprej zaženi /join.',
  'shutup.nothing': 'Trenutno se nič ne predvaja.',
  'shutup.done': '🤐 V redu, utihnil bom — počistil sem vse v čakalni vrsti.',
  'tts.notInVoice':
    'Še nisem v glasovnem kanalu — pridruži se enemu in zaženi /join, nato poskusi znova.',
  'tts.nothingToRead': 'Tam ni ničesar za branje — pošlji mi besedilo, ki naj ga izgovorim.',
  'tts.nothingAfterClean':
    'Po čiščenju ni ostalo nič za branje — poskusi z običajnim besedilom (črke ali besede).',
  'tts.tooFast': 'Počasi, ne tako hitro — poskusi znova čez trenutek.',
  'tts.blocked': 'To besedilo vsebuje blokirano besedo, zato sem ga preskočil.',
  'tts.queued': 'Sprejeto — je v čakalni vrsti.',
  'tts.busy': 'Trenutno sem zaseden — poskusi znova čez trenutek.',
  'voice.unknownModel': 'Tega glasu ne poznam — preveri /voice list.',
  'voice.badSpeed':
    'Hitrost mora biti med 0.5 in 2.0 (1.0 je običajna). Poskusi `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Tvoj glas je zdaj **{name}** pri {speed}×. Napiši `/tts hello`, da ga slišiš. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Nastavitev glasu** — izberi spodnje možnosti in nato pritisni **Shrani**. Do takrat se nič ne spremeni.',
  'voice.config.summary': 'Trenutna izbira: **{voice}** · mehanizem **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Jezik…',
  'voice.config.pickVoice': 'Glas…',
  'voice.config.pickEngine': 'Mehanizem…',
  'voice.config.pickSpeed': 'Hitrost…',
  'voice.config.more': '▼ Več jezikov',
  'voice.config.engDefault': 'Privzeto (lokalno)',
  'voice.config.save': 'Shrani',
  'voice.config.cancel': 'Prekliči',
  'voice.config.cancelled': 'Nastavitev preklicana — nič se ni spremenilo.',
  'voice.config.expired': 'Plošča je potekla — za nadaljevanje znova zaženi `/voice config`.',
  'voice.listHeader': 'Razpoložljivi glasovi:',
  'voice.listEmpty': '(noben ni nameščen)',
  'voice.reset':
    '✅ Tvoj glas je nastavljen nazaj na privzetega. Kadar koli izberi drugega z `/voice list` in `/voice set`.',
  'voice.detection.on':
    '✅ Samodejno zaznavanje jezika je VKLOPLJENO: vsako sporočilo je prebrano z glasom za zaznani jezik (govorec se lahko spremeni). Izklopi z `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Samodejno zaznavanje jezika je IZKLOPLJENO: tvoj en sam fiksni glas bere vse, tako da vedno zveniš enako.',
  'voice.optout': 'Ne bom te več samodejno bral. Zaženi /voice opt-in, da to znova vklopiš.',
  'voice.optin': 'Znova te bom samodejno bral.',
  'voice.nickname.set': '✅ Vozen te bo odslej na glas klical **{name}**.',
  'voice.nickname.cleared':
    '✅ Izgovorjeni vzdevek odstranjen — Vozen bo uporabil tvoje ime na strežniku.',
  'voice.nickname.invalid':
    'To ime nima ničesar berljivega za izgovorjavo na glas. Poskusi s črkami ali številkami.',
  'voice.effect.set':
    '✅ Glasovni učinek nastavljen na **{effect}** — tvoja sporočila se odslej predvajajo s tem učinkom. Uporabi `/voice effect none`, da ga izklopiš.',
  'voice.effect.cleared': '✅ Glasovni učinek odstranjen — spet čist glas.',
  'voice.effect.locked':
    '🔒 **{effect}** je učinek Premium. Brezplačna učinka: 🤖 Robot in 🔊 Echo. Odkleni vse z Vozen Premium — poglej `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** je glasovni pogon Premium. Odkleni ga z Vozen Plus (osebno) ali Vozen Premium (strežnik) — poglej `/premium`. Medtem tvoj glas ostane na brezplačnem lokalnem pogonu.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** je glasovni pogon Premium. Odkleni ga z Vozen Plus (osebno) ali Vozen Premium (strežnik) — poglej `/premium`. Medtem tvoj glas ostane na brezplačnem lokalnem pogonu.',
  'voice.notInVoice': 'Še nisem v glasovnem kanalu — najprej zaženi /join.',
  'voice.previewPlaying': 'Predvajam vzorec…',
  'preview.sample': 'Živjo, jaz sem Vozen. napiši, poslušaj.',
  'laugh.playing': 'Haha! Predvajam to v tvojem glasu…',
  'joke.playing': 'Povem šalo…\n> {joke}',
  'joke.unknownLang': 'Tega jezika ne poznam. Izberi enega s seznama.',
  'rizz.playing': '😏 Malo šarma …\n> {line}',
  'rizz.unknownLang': 'Tega jezika ne poznam. Izberi enega s seznama.',
  'rizz.locked':
    '🔒 **/rizz** je ugodnost Premium. Odkleni jo z Vozen Plus (ti) ali Premium (ta strežnik). Poglej `/premium`.',
  'sound.playing': '🔊 Predvajam **{name}** …',
  'sound.unknown': 'Tega zvoka nimam. Zaženi `/sound`, da vidiš seznam.',
  'sound.list':
    '🔊 **Zvoki:** {sounds}\nPredvajaj enega z `/sound name:<sound>` (biti moram v tvojem glasovnem kanalu).',
  'sound.disabled':
    '🔇 Zvočna plošča je na tem strežniku **izklopljena**. Skrbnik jo lahko omogoči z `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Rojstni dan shranjen: **{day}/{month}**. Ob tvojem prihodu v glasovni kanal tega dne ti bom zaželel vse najboljše!',
  'birthday.invalid': 'To ni veljaven datum. Preveri dan in mesec.',
  'birthday.cleared': '🎂 Rojstni dan odstranjen.',
  'birthday.show': '🎂 Tvoj rojstni dan je nastavljen na **{day}/{month}**.',
  'birthday.none': 'Rojstnega dne še nisi nastavil. Uporabi `/birthday set`.',
  'topspeakers.title': '🗣️ **Najbolj govoreči** — koga na tem strežniku največ berem:',
  'topspeakers.empty': 'Še nikomur nisem prebral sporočil. Nastavi kanal za branje z `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** sporočil · 🔥 niz {streak} dni',
  'serverstats.title': '📊 **Statistika strežnika**',
  'serverstats.empty':
    'Še ni statistike — tu nisem prebral nobenega sporočila niti izvedel nobene igre. Nastavi z `/setup`!',
  'serverstats.messages': '🗣️ prebranih **{total}** sporočil · **{speakers}** oseb',
  'serverstats.topTalkers': '**Največji klepetavci:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} sporočil · 🔥 {streak}d',
  'serverstats.streak': '🔥 Najdaljši aktivni niz: **{days}** dni',
  'serverstats.games': '🎮 **{points}** točk iger · **{wins}** zmag · **{players}** igralcev',
  'serverstats.topPlayers': '**Najboljši igralci:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} točk · {wins} zmag',
  'serverstats.upsell':
    '🔒 To je brezplačni predogled. **Premium** odklene nize, statistiko iger in celotno lestvico prvih 5 — poglej `/premium`.',
  'streak.day': '🔥 <@{user}> ima niz **{n} dni**! Govori naprej, da ga ohraniš.',
  'leaderboard.autoTitle': '🏆 Največji klepetavci na tem strežniku',
  'premium.title': '💎 **Stanje Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Strežnik:** Premium do {date}',
  'premium.lineServerFree': '🖥️ **Strežnik:** brezplačni paket',
  'premium.lineUserActive': '👤 **Ti (Plus):** aktivno do {date}',
  'premium.lineUserFree': '👤 **Ti (Plus):** ni aktivno',
  'premium.getHint':
    'Vse, kar uporabljaš danes, ostane brezplačno. Premium doda vseh 8 glasovnih učinkov, 24/7 v klicu, 50 osebnih izgovorjav, /rizz in premium igre. Podpora: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Tvoja prepustnica Premium:** {used}/{total} licenc v uporabi · poteče {date}',
  'premium.passServers': '↳ V uporabi na: {servers}',
  'premium.pitch':
    'Premiuma še nimaš. **Vozen Premium** (€3,99/mes za 3 strežnike ali €7,99/mes za 8) odklene za celoten strežnik: vseh 8 glasovnih učinkov, 24/7 v klicu, 50 osebnih izgovorjav (namesto 3), ukaz /rizz in premium igre (Besedna veriga, Wordle, Šah). **Vozen Plus** (€1,99/mes) ti te ugodnosti da osebno, na katerem koli strežniku.',
  'premium.buyHint':
    '▶ **Pridobi Premium:** {link}\nPo nakupu zaženi `/premium activate` na strežniku, ki ga želiš.',
  'premium.confirmActivate':
    'Uporabiš **1 od svojih {total} licenc Premium** na **tem strežniku**? Trenutno jih imaš v uporabi **{used}**. Pozneje jo lahko sprostiš z `/premium deactivate` — ura na prepustnici teče tako ali tako.',
  'premium.confirmYes': '💎 Uporabi licenco',
  'premium.confirmNo': 'Prekliči',
  'premium.activateOk':
    '✅ Premium je zdaj aktiven na **tem strežniku** do {date}. Licence: v uporabi **{used}/{total}**.',
  'premium.activateCancelled': 'Preklicano — nobena licenca ni bila porabljena.',
  'premium.activateTimeout': 'Čas je potekel — nobena licenca ni bila porabljena.',
  'premium.noPass':
    'Nimaš aktivne prepustnice Premium. Pridobi jo in pristala bo na tvojem računu — nato tukaj zaženi `/premium activate`.\n▶ {link}',
  'premium.alreadyActive': 'Ta strežnik že ima eno tvojih licenc Premium. Ni kaj storiti.',
  'premium.noSeats':
    'Vse tvoje **{total}** licence Premium so v uporabi ({servers}). Sprosti eno tam z `/premium deactivate`, nato poskusi znova tukaj.',
  'premium.needManageGuild':
    'Aktivacija Premiuma vpliva na celoten strežnik — to lahko storijo samo člani z **Upravljanje strežnika**. Vprašaj skrbnika.',
  'premium.deactivateOk':
    '✅ Sprostil sem licenco Premium tega strežnika. Uporabi jo na drugem strežniku z `/premium activate`.',
  'premium.deactivateNone':
    'Ta strežnik nima tvoje licence Premium, ki bi jo bilo mogoče sprostiti.',
  'premium.thisServer': 'ta strežnik',
  'grant.denied': '⛔ Ta ukaz je samo za lastnika bota.',
  'grant.okPremium':
    '✅ Uporabniku <@{user}> sem dodelil **prepustnico Premium** ({seats} licenc) za **{days}** dni — poteče {date}. Aktivira jo z `/premium activate`.',
  'grant.okPlus':
    '✅ Uporabniku <@{user}> sem dodelil **Vozen Plus** za **{days}** dni — poteče {date}.',
  'gencode.done':
    '✅ Ustvaril sem **{count}** kod {plan}, vsaka za **{days}** dni. Deli jih zasebno:\n{list}',
  'redeem.okPlus': '🎁 Unovčeno! Dobil si **Vozen Plus** za **{days}** dni — poteče {date}.',
  'redeem.okPremium':
    '🎁 Unovčeno! Dobil si **prepustnico Premium** ({seats} licenc) za **{days}** dni — poteče {date}. Aktiviraj jo na svojem strežniku z `/premium activate`.',
  'redeem.notFound': '❌ Ta koda ne obstaja. Preveri jo in poskusi znova.',
  'redeem.used': '❌ Ta koda je že bila unovčena.',
  'redeem.expired': '❌ Ta koda je potekla.',
  'voice.abbrev.added': 'Sprejeto — {term} bo prebran kot {replacement}.',
  'voice.abbrev.removed': 'Odstranil sem tvojo okrajšavo za {term}.',
  'voice.abbrev.listHeader': 'Tvoje osebne okrajšave (uporabljenih {count}/{cap}):',
  'voice.abbrev.listEmpty': '(še nobene — dodaj eno z /voice abbrev add)',
  'voice.abbrev.capReached':
    'Dosegel si omejitev {cap} osebnih okrajšav. Preden dodaš novo, eno odstrani.',
  'voice.abbrev.invalidTerm':
    'Izraz mora biti ena sama beseda (samo črke in števke), dolga do 50 znakov.',
  'voice.abbrev.emptyReplacement': 'Branje ne sme biti prazno.',
  'voice.abbrev.tooLong': 'Branje je predolgo (največ 200 znakov).',
  'config.wordEmpty': 'Beseda ne sme biti prazna.',
  'config.blocked': 'Blokirano: {word}.',
  'config.blockLimit':
    'Ta strežnik že ima največ {max} blokiranih besed. Preden dodaš novo, eno odstrani.',
  'config.unblocked': 'Deblokirano: {word}.',
  'config.pronListHeader': 'Slovar izgovorjave:',
  'config.pronEmptyValue': '(prazno)',
  'config.listEmpty': '(nobena)',
  'config.termEmpty': 'Izraz ne sme biti prazen.',
  'config.pronEmpty': 'Izgovorjava ne sme biti prazna.',
  'config.pronSet': 'Sprejeto — {term} bo prebran kot {replacement}.',
  'config.pronRemoved': 'Odstranil sem izgovorjavo za {term}.',
  'config.channelWrongType': 'Izberi besedilni kanal (ne glasovnega kanala ali kategorije).',
  'config.channelNoAccess': 'Ne vidim {channel} — preveri moja dovoljenja tam.',
  'config.channelSet':
    'Kanal za samodejno branje je nastavljen na {channel}. Naprej: poskrbi, da je samodejno branje vklopljeno z `/config auto-read active:true`.',
  'config.autoreadOn': 'Samodejno branje je zdaj **vklopljeno**.',
  'config.autoreadOff': 'Samodejno branje je zdaj **izklopljeno**.',
  'config.maxCharsRange': 'Vrednost največjega števila znakov mora biti med 1 in 2000.',
  'config.maxCharsSet': 'Največje število znakov na sporočilo je nastavljeno na {value}.',
  'config.rateLimitRange': 'Vrednost omejitve hitrosti mora biti med 1 in 120.',
  'config.rateLimitSet': 'Omejitev hitrosti je nastavljena na {value} sporočil na minuto.',
  'config.roleSet': 'Samodejno branje je zdaj omejeno na člane z {role}.',
  'config.roleCleared': 'Omejitev vloge je odstranjena — zdaj se lahko bere vsakogar.',
  'config.enabledOn': 'TTS je zdaj **vklopljen** za ta strežnik.',
  'config.enabledOff': 'TTS je zdaj **izklopljen** za ta strežnik.',
  'config.xsaidOn':
    'Vozen bo odslej pred vsakim sporočilom naznanil **kdo je govoril** (npr. "Alex je rekel živjo"). Izklopi z `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **ne bo več** naznanjal, kdo je govoril — prebere samo sporočilo.',
  'config.autojoinOn':
    '✅ Samodejno pridruževanje **vklopljeno** — Vozen se pridruži tvojemu glasovnemu kanalu, ko pišeš v kanal TTS.',
  'config.autojoinOff':
    'Samodejno pridruževanje **izklopljeno** — uporabi `/join`, da Vozenja pripelješ v glas.',
  'config.stayOn':
    '✅ 24/7 v klicu **vklopljeno** — Vozen ostane v glasovnem kanalu, tudi ko se izprazni, in se vrne po ponovnem zagonu. 💎 Za učinek potrebuje Premium (kupi ali `/redeem` kodo, nato `/premium activate`).',
  'config.stayOff':
    '24/7 v klicu **izklopljeno** — Vozen odide, ko se glasovni kanal izprazni (privzeto).',
  'config.readBotsOn': '✅ Vozen bo odslej bral tudi sporočila **drugih botov in spletnih kljuk**.',
  'config.readBotsOff': 'Vozen bo **prezrl** druge bote in spletne kljuke (bere samo prave ljudi).',
  'config.textInVoiceOn':
    '✅ Vozen bo bral tudi **besedilni klepet znotraj svojega glasovnega kanala**.',
  'config.textInVoiceOff':
    'Vozen **ne bo** bral besedilnega klepeta glasovnega kanala (samo kanal TTS).',
  'config.antispamOn':
    '✅ Anti-spam **vklopljen** — Vozen ne bo bral neželenih sporočil (množično ponavljanje besed ali isto veliko sporočilo, objavljeno vedno znova).',
  'config.antispamOff': 'Anti-spam **izklopljen** — Vozen bere vsako sporočilo kot običajno.',
  'config.streaksOn':
    '✅ Obvestila o nizu **vklopljena** — Vozen prikaže sporočilo o dnevnem nizu 🔥 ob prvem govoru vsake osebe vsak dan.',
  'config.streaksOff':
    'Obvestila o nizu **izklopljena** — Vozen še vedno beleži nize (glej `/top-speakers`), a o njih molči.',
  'config.soundboardOn':
    'Zvočna plošča **vklopljena** — vsakdo lahko predvaja posnetke z `/sound`.',
  'config.soundboardOff':
    'Zvočna plošča **izklopljena** — `/sound` je na tem strežniku onemogočen.',
  'config.votePromosLabel': 'Obvestila o nagradi top.gg + Vozen Support',
  'config.greetOn': '✅ Ob prihodu v glasovni kanal bom ljudi pozdravil po imenu.',
  'config.greetOff': '🔇 Ljudi ob prihodu v glasovni kanal **ne bom** pozdravljal.',
  'config.greetLangSet': '✅ Jezik pozdrava ob prihodu nastavljen na **{language}**.',
  'config.defaultVoiceSet':
    '✅ Privzeti glas strežnika je nastavljen na **{name}**. Člani brez lastnega glasu bodo slišali tega. (id: `{model}`)',
  'config.reset':
    'Nastavitve so ponastavljene na privzete. Tvoj seznam blokad in izgovorjave so ohranjeni.',
  'config.showTitle': '**Nastavitve strežnika**',
  'config.showChannel': 'Kanal TTS: {value}',
  'config.showAutoread': 'Samodejno branje: {value}',
  'config.showRole': 'Vloga: {value}',
  'config.showEnabled': 'Omogočeno: {value}',
  'config.showXsaid': 'Naznani govorca (xsaid): {value}',
  'config.showAutojoin': 'Samodejno pridruževanje: {value}',
  'config.showReadBots': 'Beri bote/spletne kljuke: {value}',
  'config.showTextInVoice': 'Besedilo v glasu: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Zvočna plošča (/sound): {value}',
  'config.showGreet': 'Pozdrav ob prihodu: {value} ({language})',
  'config.showVoice': 'Privzeti glas: {value}',
  'config.showMaxChars': 'Največ znakov: {value}',
  'config.showRateLimit': 'Omejitev hitrosti: {value}/min',
  'config.showBlocklist': 'Seznam blokad: {count} besed',
  'config.showPronunciation': 'Izgovorjave: {count} vnosov',
  'config.valueNone': '(nobena)',
  'config.valueAny': 'kdor koli',
  'config.valueAutoDetect': '(samodejno zaznavanje)',
  'config.on': 'vklopljeno',
  'config.off': 'izklopljeno',
  'config.language.set': 'Jezik vmesnika je nastavljen na {language}.',
  'config.language.unsupported': 'Ta jezik še ni podprt.',
  'setup.noChannel':
    'Nisem mogel ugotoviti, kateri kanal naj uporabim. Podaj besedilni kanal v možnosti "channel".',
  'setup.channelWrongType':
    'Kanal za samodejno branje mora biti besedilni kanal (ne glasovni kanal ali kategorija). Podaj enega v možnosti "channel".',
  'setup.done': '**Vse pripravljeno — Vozen je pripravljen.**',
  'setup.channelLine': 'Kanal za samodejno branje: {channel}',
  'setup.autoreadOn': 'Samodejno branje: vklopljeno',
  'setup.permsHeader': '**Dovoljenja:**',
  'setup.permView': 'ViewChannel (videti besedilni kanal)',
  'setup.permSend': 'SendMessages (objavljati v besedilnem kanalu)',
  'setup.permConnect': 'Connect (pridružiti se glasovnemu kanalu)',
  'setup.permSpeak': 'Speak (govoriti v glasovnem kanalu)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — manjka',
  'setup.permUnchecked': '⏳ {label} — še ni preverjeno (preveril bom ob /join)',
  'setup.fixHint':
    'Za popravek manjkajočega: v nastavitvah strežnika odpri Vozenjevo vlogo (ali dovoljenja kanala) in omogoči elemente, označene z ❌.',
  'setup.voiceUncheckedNote':
    'Nisi v glasovnem kanalu, zato še nisem mogel preveriti Connect/Speak — preveril ju bom, ko zaženeš /join.',
  'setup.allGood': 'Vse je pripravljeno. Pridruži se glasovnemu kanalu in zaženi /join.',
  'setup.joinedVoice': 'Pridružil sem se tudi {channel} — ni ti treba zagnati /join.',
  'setup.readyTalk':
    'Vse je pripravljeno. Piši v kanalu za samodejno branje in prebral bom na glas.',
  'setup.membersHeader': '**Povej svojim članom (postopek v 3 korakih):**',
  'setup.membersBody':
    '1) Pridruži se glasovnemu kanalu\n2) Zaženi /join, da se ti pridružim\n3) Piši v ta kanal (ali uporabi /tts) in prebral bom na glas\nCeloten seznam ukazov: /help',
  'stats.title': '**Vozen statistika**',
  'stats.messagesSpoken': 'Izgovorjenih sporočil: {value}',
  'stats.cacheHits': 'Zadetki predpomnilnika: {value}',
  'stats.cacheMisses': 'Zgrešitve predpomnilnika: {value}',
  'stats.synthErrors': 'Napake sinteze: {value}',
  'stats.synthLatency': 'Zakasnitev sinteze: p50 {p50}ms / p95 {p95}ms ({count} vzorcev)',
  'stats.voiceDrops': 'Prekinitve glasu: {value}',
  'stats.voiceReconnects': 'Ponovne povezave: {value}',
  'stats.votes': 'Glasovi top.gg: {value}',
  'stats.activePlayers': 'Aktivni predvajalniki: {value}',
  'stats.servers': 'Strežniki: {value}',
  'stats.uptime': 'Čas delovanja: {value}s',
  'speak.emptyMessage': 'To sporočilo nima besedila za branje na glas.',
  'uptime.text': '🟢 Vozen je na spletu že **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistika**',
  'botstats.servers': 'Strežniki: **{value}**',
  'botstats.voiceSessions': 'Glasovne seje zdaj: **{value}**',
  'botstats.messagesSpoken': 'Izgovorjenih sporočil: **{value}**',
  'botstats.uptime': 'Čas delovanja: **{value}**',
  'invite.noClientId':
    'Vozenjeva povabilna povezava še ni nastavljena (manjka CLIENT_ID). Obvesti skrbnika bota.',
  'invite.link': 'Dodaj Vozenja na svoj strežnik:\n{url}',
  'vote.noClientId':
    'Vozenjeva povezava za glasovanje še ni nastavljena (manjka CLIENT_ID). Obvesti skrbnika bota.',
  'vote.link':
    'Glasuj za Vozenja (brezplačno, vsakih 12 h) in pomagaj več ljudem, da ga najdejo:\n{url}\nČe ta račun še nikoli ni prevzel nagrade, prejme **48 ur Vozen Plus**, samo enkrat na račun.',
  'invite.button': 'Dodaj Vozenja',
  'vote.button': 'Glasuj na top.gg',
  'vote.upsell':
    '🗳️ Če ta račun še nikoli ni prevzel nagrade, prejme **48 ur Vozen Plus**, samo enkrat na račun. {url}',
  'vote.cooldownStatus':
    '🗳️ Ta račun je enkratno nagrado za glas že uporabil. Še vedno lahko glasuješ in podpreš Vozen, vendar ne boš prejel dodatnega Plusa.',
  'help.title': 'Vozen — napiši, poslušaj.',
  'help.embedTitle': 'Vozen — Ukazi',
  'help.intro':
    'Vozen bere tvoje besedilo na glas v glasovnih kanalih — brezplačni nevronski glasovi, na desetine jezikov.',
  'help.quickStartTitle': 'Hitri začetek (3 koraki)',
  'help.quickStartBody':
    '1) Pridruži se glasovnemu kanalu, nato zaženi /join\n2) Piši v besedilnem kanalu (ali uporabi /tts Hello everyone!)\n3) (izbirno) Izberi glas z /voice set',
  'help.groupStarted': 'Prvi koraki',
  'help.groupStartedBody':
    '• /join — pridružim se tvojemu glasovnemu kanalu\n• /leave — zapustim glasovni kanal\n• /tts <text> — preberem besedilo na glas · npr. /tts Hello everyone!\n• /skip — preskočim to, kar trenutno berem',
  'help.groupVoice': 'Tvoj glas',
  'help.groupVoiceBody':
    '• /voice set <model> — izberi svoj glas · npr. /voice set en_US-amy-medium\n• /voice list — poglej razpoložljive glasove\n• /voice preview — poslušaj vzorec svojega glasu\n• /voice reset — vrni se na privzeti glas\n• /voice opt-out · /voice opt-in — izklopi / vklopi samodejno branje zase\n• /voice abbrev add|remove|list — osebni sleng, brano po tvoje (do 10)',
  'help.groupFun': 'Zabava',
  'help.groupFunBody':
    '• /joke — povem kratko šalo (izberi jezik + izbirni smeh) · npr. /joke English\n• /laugh — glasno se smejem v tvojem trenutnem glasu',
  'help.groupAdmin': 'Skrbnik strežnika (potrebuje Upravljanje strežnika)',
  'help.groupAdminBody':
    '• /setup — vodena nastavitev v enem koraku · to zaženi najprej\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · npr. /config tts-channel #general\n• /stats — statistika bota',
  'help.groupMore': 'Več',
  'help.groupMoreBody':
    '• /invite — dodaj Vozenja na drug strežnik\n• /vote — glasuj za Vozenja na top.gg\n• /help — pokaži to pomoč',
  'help.footer': 'Nov tukaj? Zaženi {command} za začetek.',
  'help.support': '🛟 Potrebuješ pomoč ali želiš prijaviti težavo? {url}',
  'help.source': '📄 Odprta koda (AGPL-3.0) — pridobi točno kodo, ki teče tukaj: {url}',
  'welcome.title': 'Hvala, ker si dodal Vozenja! 👋',
  'welcome.description':
    'Vozen bere tvoj klepet na glas v glasovnih kanalih — napiši, poslušaj.\n\n**Začni v enem koraku:** zaženi {setup} in nastavil bom samodejno branje ter se pridružil tvojemu glasovnemu kanalu.\n\nPotrebuješ celoten seznam ukazov? Zaženi {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Kako ga člani uporabljajo (3 koraki)',
  'welcome.stepsBody':
    '1) Pridruži se glasovnemu kanalu\n2) Zaženi /join, da se ti pridružim\n3) Piši v besedilnem kanalu (ali uporabi /tts) in prebral bom na glas\nCeloten seznam ukazov: /help',
  'welcome.footer': 'Vozen — napiši, poslušaj.',
  'welcome.tagline': 'Naraven nevronski glas — brezplačno za vedno, brez plačilnega zidu.',
  'game.start.needVoice':
    'To je **glasovna igra** — najprej skoči v glasovni kanal in zaženi /join, nato jo začni.',
  'game.start.alreadyActive':
    'V <#{channel}> že teče igra. Dokončaj jo (ali uporabi `/game stop`), preden začneš novo.',
  'game.start.premiumLocked':
    '🔒 **{game}** je igra Premium (stane pravo računsko moč). Poglej `/premium`.',
  'game.start.started': '🎮 Začenjam **{game}**! Spremljaj kanal — srečno!',
  'game.start.startedThread':
    '🎮 **{game}** se je začela v <#{channel}> — pridruži se tam! Nit se sama izbriše, ko se igra konča.',
  'game.thread.winner': '🏆 {winner} je zmagal v igri!',
  'game.thread.ended': '🎮 Igra se je končala.',
  'game.unknownGame': 'Te igre ne poznam. Izberi eno s seznama.',
  'game.stop.ok': '🛑 Ustavil sem trenutno igro.',
  'game.stop.none': 'Trenutno ne teče nobena igra.',
  'game.list.title': '🎮 **Igre** — začni eno z `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Lestvica** — najboljši igralci na tem strežniku:',
  'game.leaderboard.empty': 'Nobena igra še ni bila odigrana. Bodi prvi — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** točk ({wins} zmag)',
  'game.finish.title': '🏁 **Konec igre!** Končni rezultati:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Konec igre — tokrat ni nihče dosegel točk. Naslednjič!',
  'game.finish.winnerVoice': '{user} zmaga!',
  'game.guessLanguage.name': 'Ugani jezik',
  'game.guessLanguage.desc':
    'Preberem stavek v naključnem jeziku — prvi, ki ga poimenuje, dobi točko.',
  'game.guessLanguage.intro':
    '🗣️ **Ugani jezik** — prebral bom {rounds} stavkov. Napiši, kateri jezik slišiš. Najhitrejši pravilni odgovor zmaga v vsakem krogu!',
  'game.guessLanguage.round': '🎧 Krog {n}/{total} — poslušaj …',
  'game.guessLanguage.correct': '✅ **{user}** je uganil — bil je **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Čas! To je bil **{language}**.',
  'game.guessLanguage.noLanguages':
    'Za to igro nimam nameščenih dovolj glasov. Prosi skrbnika, naj doda več glasov.',
  'game.math.name': 'Računanje na pamet',
  'game.math.desc': 'Na glas povem račun — prvi, ki napiše odgovor, zmaga.',
  'game.math.intro':
    '🔢 **Računanje na pamet** — {rounds} računov. Poslušaj in napiši odgovor čim hitreje!',
  'game.math.round': '🧮 Krog {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** je zadel — odgovor je bil **{answer}**!',
  'game.math.timeout': '⏱️ Čas! Odgovor je bil **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'krat',
  'game.skipCount.name': 'Manjkajoča številka',
  'game.skipCount.desc': 'Štejem na glas, a preskočim eno številko — prvi, ki jo ujame, zmaga.',
  'game.skipCount.intro':
    '🔢 **Manjkajoča številka** — štejem, a eno preskočim. Napiši manjkajočo številko! ({rounds} krogov)',
  'game.skipCount.round': '👂 Krog {n}/{total} — katero številko sem preskočil?',
  'game.skipCount.correct': '✅ **{user}** je ujel — preskočil sem **{answer}**!',
  'game.skipCount.timeout': '⏱️ Čas! Preskočil sem **{answer}**.',
  'game.spelling.name': 'Črkovanje',
  'game.spelling.desc': 'Povem besedo — prvi, ki jo pravilno črkuje, zmaga.',
  'game.spelling.intro':
    '✍️ **Črkovanje** — povedal bom {rounds} besed. Vsako napiši pravilno črkovano!',
  'game.spelling.round': '🗣️ Krog {n}/{total} — napiši besedo, ki jo povem …',
  'game.spelling.correct': '✅ **{user}** je pravilno črkoval **{word}**!',
  'game.spelling.timeout': '⏱️ Čas! Beseda je bila **{word}**.',
  'game.spelling.empty': 'Za jezik glasu tega strežnika še nimam seznama besed.',
  'game.spellOut.name': 'Razvozlaj črkovanje',
  'game.spellOut.desc': 'Besedo črkujem črko za črko — prvi, ki napiše celo besedo, zmaga.',
  'game.spellOut.intro':
    '🔡 **Razvozlaj črkovanje** — {rounds} besed črkujem črko za črko. Napiši celo besedo!',
  'game.spellOut.round': '🔤 Krog {n}/{total} — poslušaj črke …',
  'game.spellOut.correct': '✅ **{user}** je uganil — **{word}**!',
  'game.spellOut.timeout': '⏱️ Čas! Črkovalo je **{word}**.',
  'game.fastSpeech.name': 'Hitro govorjenje',
  'game.fastSpeech.desc': 'Stavek preberem super hitro — prvi, ki napiše, kar sem rekel, zmaga.',
  'game.fastSpeech.intro':
    '💨 **Hitro govorjenje** — {rounds} stavkov pri noreni hitrosti. Napiši, kar slišiš!',
  'game.fastSpeech.round': '⚡ Krog {n}/{total} — pa gremo, hitro!',
  'game.fastSpeech.correct': '✅ **{user}** je razvozlal: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Čas! Bilo je: “{phrase}”',
  'game.fastSpeech.empty': 'Za jezik glasu tega strežnika še nimam fraz.',
  'game.accentSwap.name': 'Smešni naglas',
  'game.accentSwap.desc': 'Besedo povem s tujim naglasom — prvi, ki jo napiše, zmaga.',
  'game.accentSwap.intro':
    '🎭 **Smešni naglas** — {rounds} besed, izgovorjenih z napačnim naglasom. Napiši besedo!',
  'game.accentSwap.round': '🌍 Krog {n}/{total} — katero besedo poskušam izgovoriti?',
  'game.accentSwap.correct': '✅ **{user}** je uganil — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Čas! Beseda je bila **{word}**.',
  'game.reflexes.name': 'Refleksi',
  'game.reflexes.desc': 'Odštevam, nato zavpijem ZDAJ — prvi, ki napiše po tem, zmaga. Ne prehiti!',
  'game.reflexes.intro':
    '⚡ **Refleksi** — {rounds} krogov. Ko zavpijem **ZDAJ**, napiši karkoli čim hitreje. Če napišeš pred ZDAJ, je napačen štart!',
  'game.reflexes.ready': '🚦 Krog {n}/{total} — pripravi se …',
  'game.reflexes.countdown': 'tri … dve … ena …',
  'game.reflexes.go': '🟢 **ZDAJ!!!**',
  'game.reflexes.goVoice': 'Zdaj!',
  'game.reflexes.tooSoon': '🔴 **{user}** je prehitel — prezgodaj!',
  'game.reflexes.win': '⚡ **{user}** je najhitrejši! Točka!',
  'game.reflexes.tooSlow': '😴 Nihče se ni odzval pravočasno. Naprej!',
  'game.headsOrTails.name': 'Grb ali cifra',
  'game.headsOrTails.desc':
    'Napovej met kovanca — napiši grb ali cifra, preden vržem. Zmaga najboljši ugibalec!',
  'game.headsOrTails.intro':
    '🪙 **Grb ali cifra** — {rounds} krogov. V vsakem krogu napiši `heads` (grb) ali `tails` (cifra), preden vržem kovanec. 1 točka za vsako pravilno napoved!',
  'game.headsOrTails.introVoice': 'Igrajmo grb ali cifra!',
  'game.headsOrTails.round': '🪙 Krog {n}/{total} — grb ali cifra? Napiši `heads` ali `tails`!',
  'game.headsOrTails.roundVoice': 'Grb … ali cifra?',
  'game.headsOrTails.heads': 'grb',
  'game.headsOrTails.tails': 'cifra',
  'game.headsOrTails.resultVoice': 'Je {side}!',
  'game.headsOrTails.winners': 'Je **{side}**! Točka za: {users}',
  'game.headsOrTails.noWinners': 'Je **{side}**! Nihče ni napovedal — brez točk.',
  'game.vozenSays.name': 'Vozen pravi',
  'game.vozenSays.desc': "Ubogaj samo, ko se ukaz začne z 'Vozen pravi'. Nasedeš pasti in si ujet!",
  'game.vozenSays.intro':
    "🫡 **Vozen pravi** — {rounds} ukazov. Naredi ga SAMO, če začnem z **'Vozen pravi'**. Sicer se ne premakni!",
  'game.vozenSays.prefix': 'Vozen pravi',
  'game.vozenSays.verb': 'napiši',
  'game.vozenSays.real': '🗣️ Krog {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Krog {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** je prvi ubogal — točka!',
  'game.vozenSays.caught': '🔴 **{user}** — nisem rekel Vozen pravi! Ujet!',
  'game.vozenSays.nobody': '😴 Nihče ni pravočasno ubogal **{word}**. Naprej!',
  'game.vozenSays.trapCleared': '😌 Bila je past — dobro opaženo, nihče ni nasedel **{word}**.',
  'game.roulette.name': 'Ruleta resnica ali izziv',
  'game.roulette.desc':
    'Zavrtim in na glas preberem en izziv (resnica ali izziv). Za novega zaženi znova.',
  'game.roulette.header': '🎯 **Kolo pravi …**',
  'game.hangman.name': 'Vislice',
  'game.hangman.desc': 'Ugani besedo črko za črko — 6 zgrešenih in konec je.',
  'game.hangman.intro':
    '🪢 **Vislice** — napiši eno črko naenkrat, da uganeš besedo. Napišeš lahko tudi celo besedo!',
  'game.hangman.hit': '🟢 **{user}** je našel **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — ni **{letter}**.',
  'game.hangman.wrongLetters': 'Napačne: {letters}',
  'game.hangman.win': '🎉 **{user}** je rešil — **{word}**!',
  'game.hangman.lose': '💀 Zmanjkalo je poskusov! Beseda je bila **{word}**.',
  'game.hangman.idle': '🕹️ Igra ustavljena (nihče ne igra). Beseda je bila **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Ugani 5-črkovno besedo. 🟩 pravo mesto, 🟨 napačno mesto, ⬛ ni v besedi. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — napiši 5-črkovno besedo. Skupaj imate {max} poskusov. 🟩 pravo mesto · 🟨 napačno mesto · ⬛ ni v besedi.',
  'game.wordle.guess': '🔤 **{user}** je poskusil — ostalo je **{left}** poskusov',
  'game.wordle.inWord': '🟢 v besedi: {letters}',
  'game.wordle.out': '🚫 izločeno: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** je uganil v {n} — **{word}**!',
  'game.wordle.lose': '💀 Zmanjkalo je poskusov! Beseda je bila **{word}**.',
  'game.wordle.idle': '🕹️ Igra ustavljena (nihče ne igra). Beseda je bila **{word}**.',
  'game.tictactoe.name': 'Križci in krožci',
  'game.tictactoe.desc':
    'Dva igralca — napiši številko 1-9, da postaviš svoj znak. Tri v vrsti zmaga.',
  'game.tictactoe.intro':
    '⭕ **Križci in krožci** — prva dva igralca, ki potegneta, sta ❌ in ⭕ (❌ začne). Napiši številko 1-9, da odigraš svoje polje.',
  'game.tictactoe.turn': 'Na potezi: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, na potezi je **{mark}**.',
  'game.tictactoe.taken': '🚫 Polje {cell} je zasedeno — izberi drugo.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) zmaga!',
  'game.tictactoe.draw': '🤝 Neodločeno!',
  'game.tictactoe.idle': '🕹️ Igra se je končala (nihče ne igra).',
  'game.chess.name': 'Šah',
  'game.chess.desc':
    'Dva igralca — prava šahovska pravila (šah, rošada, promocija …). Napiši potezo, npr. "e4" ali "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Šah** — prva dva igralca, ki potegneta, igrata z belimi in črnimi (bele začnejo). Napiši potezo v algebrski notaciji ("e4", "Nf3", "O-O") ali s koordinatami ("e2e4"). Napiši "resign", da se predaš.',
  'game.chess.white': 'bele',
  'game.chess.black': 'črne',
  'game.chess.seats': '⚪ Bele: **{white}** · ⚫ Črne: **{black}**',
  'game.chess.turn': '{move} — na potezi: **{color}**',
  'game.chess.check': '♟️ Šah!',
  'game.chess.notYourTurn': '⏳ **{user}**, na potezi so **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" ni veljavna poteza — poskusi znova.',
  'game.chess.checkmate': '🏆 Mat ({move})! **{user}** zmaga!',
  'game.chess.draw': '🤝 Neodločeno ({move})!',
  'game.chess.resigned': '🏳️ **{user}** se je predal — **{winner}** zmaga!',
  'game.chess.idle': '🕹️ Igra se je končala (nihče ne igra).',
  'game.wordChain.name': 'Besedna veriga',
  'game.wordChain.descr':
    'Besedna veriga po potezah v enem jeziku: povej besedo, ki se začne z zadnjo črko prejšnje. 2 življenji, brez ponavljanja, ura se pospešuje. Jezik izberi z možnostjo `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Besedna veriga trenutno ni na voljo v **{lang}** (manjka seznam besed).',
  'game.wordChain.lobby':
    '🔗 **Besedna veriga** v **{lang}**! V naslednjih **{seconds}s** napiši karkoli v ta kanal, da se pridružiš.',
  'game.wordChain.notEnough':
    '😴 Pridružilo se je premalo igralcev (potrebna sta vsaj 2). Igra preklicana.',
  'game.wordChain.begin':
    '🚀 Začenjam! Igralci: {players}. Vsaka beseda se mora začeti z zadnjo črko prejšnje.',
  'game.wordChain.turn':
    '**{name}**, tvoja poteza! Beseda v **{lang}**, ki se začne z **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — naslednja črka: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Začeti se mora z **{letter}**.',
  'game.wordChain.bad.short': '📏 Prekratka — vsaj **{min}** črk.',
  'game.wordChain.bad.repeated': '🔁 Ta beseda je bila že uporabljena.',
  'game.wordChain.bad.word': '📖 Tega ni v slovarju.',
  'game.wordChain.bad.latin': '🔤 Štejejo samo črke A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** je zmanjkalo časa! Ostane {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** je izpadel!',
  'game.wordChain.winner': '🏆 **{name}** zmaga v verigi! ({chain} besed)',
  'game.stats.none': 'Še nisi igral nobene igre. Poskusi `/game play`!',
  'game.stats.body': '🎮 **Tvoja statistika** — **{points}** točk · **{wins}** zmag · {rank}',
  'game.stats.rank': 'uvrstitev **#{rank}** od {total}',
  'game.stats.unranked': 'še ni uvrščen',
  'game.pickPrompt': '🎮 Katero igro želiš igrati? Izberi eno:',
  'game.pickPlaceholder': 'Izberi igro …',
  'game.pickTimeout':
    '⏰ Nobena igra ni bila izbrana — ko boš pripravljen, znova zaženi `/game play`.',
  'pron.listHeader': '🗣️ **Tvoje izgovorjave** ({count}/{limit}):',
  'pron.listEmpty': 'Še nimaš nobene — dodaj eno z `/pronunciation add`.',
  'pron.set': '✅ Shranjeno! Ko **ti** napišeš “{term}”, bom rekel “{replacement}”.',
  'pron.removed': '🗑️ Odstranjeno “{term}”.',
  'pron.notFound': 'Za “{term}” nimaš izgovorjave. Svoje si oglej z `/pronunciation list`.',
  'pron.empty': 'Beseda in način izgovorjave ne smeta biti prazna.',
  'pron.limitHit':
    '🔒 Dosegel si svojo omejitev **{limit}** izgovorjav. Eno odstrani z `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus ali Premium jo dvigne na **50** → {url}',
  'pron.modalTitle': 'Nauči Vozenja izgovorjave',
  'pron.modalTerm': 'Beseda (kot jo ljudje napišejo)',
  'pron.modalSay': 'Kako naj jo Vozen izgovori',
  'spron.listHeader': '🗣️ **Izgovorjave strežnika** ({count}/{limit}) — veljajo za vse:',
  'spron.listEmpty': 'Še nobene — dodaj eno z `/server-pronunciation add`.',
  'spron.set': '✅ Shranjeno za celoten strežnik! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ “{term}” odstranjeno s strežnika.',
  'spron.notFound': 'Strežnik nima izgovorjave za “{term}”.',
  'spron.limitHit':
    '🔒 Strežnik je dosegel omejitev **{limit}** izgovorjav. Eno odstrani z `/server-pronunciation remove`.',
  'spron.modalTitle': 'Izgovorjava strežnika',
  'spron.modalSay': 'Kako jo Vozen izgovori za vse',
  'rand.selectPrompt': '🎲 **Naključni izbirnik** — izmed koliko možnosti naj izberem?',
  'rand.selectPlaceholder': 'Število možnosti …',
  'rand.selectOption': '{n} možnosti',
  'rand.filling': '📝 Izpolni obrazec, ki se je pravkar odprl!',
  'rand.modalTitle': 'Naključni izbirnik — {amount} možnosti',
  'rand.modalOption': 'Možnost {n}',
  'rand.needTwo': 'Daj mi vsaj 2 možnosti, ločeni z vejicami (npr. "pica, suši").',
  'rand.result': 'Izmed {count} možnosti izberem … **{winner}**!',
  'rand.speak': 'Izberem … {winner}!',
  'rand.notInVoice':
    '_(pridruži se glasovnemu kanalu z mano in naslednjič bom to povedal na glas)_',
  'rand.timeout': '⏰ Nič ni bilo izbrano — ko boš pripravljen, znova zaženi `/randomizer`.',
};
