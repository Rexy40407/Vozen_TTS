export default {
  'error.generic': 'Valami hiba történt. Kérlek, próbáld újra.',
  'error.needManageGuild': 'Ehhez **Szerver kezelése** jogosultság szükséges.',
  'join.needVoiceChannel': 'Előbb csatlakozz egy hangcsatornához, majd futtasd a /join parancsot.',
  'join.missingPerms':
    'A(z) {channel} csatornában **Csatlakozás** és **Beszéd** jogosultságra van szükségem.',
  'join.joined':
    '✅ Bent vagyok itt: {channel}! Következő lépés: írd be, hogy `/tts hello`, és felolvasom hangosan. Szeretnéd, hogy automatikusan felolvassak egy csatornát? Futtasd a /setup parancsot.',
  'join.joinedAutoread':
    '✅ Bent vagyok itt: {channel}! Minden készen áll. Írj az automatikus felolvasás csatornájába, és hangosan felolvasom. → {readChannel}',
  'leave.left': 'Elhagytam a hangcsatornát. Legközelebb találkozunk!',
  'skip.notInVoice':
    'Még nem vagyok hangcsatornában — csatlakozz egyhez, futtasd a /join parancsot, majd próbáld újra.',
  'skip.skipped': 'Kihagyva.',
  'skip.nothing': 'Most éppen semmi sem szól.',
  'tts.notInVoice':
    'Még nem vagyok hangcsatornában — csatlakozz egyhez, futtasd a /join parancsot, majd próbáld újra.',
  'tts.nothingToRead': 'Ott nincs mit felolvasni — küldj valami szöveget, amit kimondhatok.',
  'tts.nothingAfterClean':
    'A tisztázás után nem maradt semmi felolvasnivaló — próbálj meg normál szöveget (betűket vagy szavakat).',
  'tts.tooFast': 'Hoppá, lassíts egy kicsit — próbáld újra egy pillanat múlva.',
  'tts.blocked': 'Ez a szöveg tiltott szót tartalmaz, ezért kihagytam.',
  'tts.queued': 'Rendben — bekerült a sorba.',
  'tts.busy': 'Most éppen elfoglalt vagyok — próbáld újra egy pillanat múlva.',
  'voice.unknownModel': 'Nem ismerem ezt a hangot — nézd meg a /voice list parancsot.',
  'voice.badSpeed':
    'A sebességnek 0.5 és 2.0 között kell lennie (1.0 a normál). Próbáld: `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ A hangod mostantól **{name}** {speed}× sebességgel. Próbáld ki a `/tts hello` paranccsal. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Hangbeállítás** — válaszd ki az alábbi lehetőségeket, majd nyomd meg a **Mentés** gombot. Addig semmi sem változik.',
  'voice.config.summary': 'Jelenlegi választás: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Nyelv…',
  'voice.config.pickVoice': 'Hang…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Sebesség…',
  'voice.config.more': '▼ További nyelvek',
  'voice.config.engDefault': 'Alapértelmezett (helyi)',
  'voice.config.save': 'Mentés',
  'voice.config.cancel': 'Mégse',
  'voice.config.cancelled': 'A beállítás megszakítva — semmi sem változott.',
  'voice.config.expired':
    'A panel lejárt — a folytatáshoz futtasd újra a `/voice config` parancsot.',
  'voice.listHeader': 'Elérhető hangok:',
  'voice.listEmpty': '(nincs telepítve)',
  'voice.reset':
    '✅ A hangod visszaállt az alapértelmezettre. Bármikor választhatsz másikat a `/voice list` és a `/voice set` paranccsal.',
  'voice.optout':
    'Mostantól nem olvaslak fel automatikusan. Futtasd a /voice opt-in parancsot a visszakapcsoláshoz.',
  'voice.optin': 'Mostantól újra automatikusan felolvaslak.',
  'voice.notInVoice': 'Még nem vagyok hangcsatornában — előbb futtasd a /join parancsot.',
  'voice.previewPlaying': 'Mintát játszok le…',
  'preview.sample': 'Szia, Vozen vagyok. írd be, hallgasd meg.',
  'laugh.playing': 'Haha! Lejátszom a te hangodon…',
  'joke.playing': 'Mesélek egy viccet…\n> {joke}',
  'joke.unknownLang': 'Nem ismerem ezt a nyelvet. Válassz egyet a listából.',
  'voice.abbrev.added': 'Rendben — a(z) {term} így lesz felolvasva: {replacement}.',
  'voice.abbrev.removed': 'Eltávolítottam a(z) {term} rövidítésedet.',
  'voice.abbrev.listHeader': 'A személyes rövidítéseid ({count}/{cap} használva):',
  'voice.abbrev.listEmpty': '(még egy sincs — adj hozzá egyet a /voice abbrev add paranccsal)',
  'voice.abbrev.capReached':
    'Elérted a(z) {cap} személyes rövidítés korlátját. Távolíts el egyet, mielőtt újabbat adnál hozzá.',
  'voice.abbrev.invalidTerm':
    'A kifejezésnek egyetlen szónak kell lennie (csak betűk és számjegyek), legfeljebb 50 karakter.',
  'voice.abbrev.emptyReplacement': 'A felolvasás nem lehet üres.',
  'voice.abbrev.tooLong': 'A felolvasás túl hosszú (legfeljebb 200 karakter).',
  'config.wordEmpty': 'A szó nem lehet üres.',
  'config.blocked': 'Letiltva: {word}.',
  'config.unblocked': 'Feloldva: {word}.',
  'config.pronListHeader': 'Kiejtési szótár:',
  'config.pronEmptyValue': '(üres)',
  'config.listEmpty': '(nincs)',
  'config.termEmpty': 'A kifejezés nem lehet üres.',
  'config.pronEmpty': 'A kiejtés nem lehet üres.',
  'config.pronSet': 'Rendben — a(z) {term} így lesz felolvasva: {replacement}.',
  'config.pronRemoved': 'Eltávolítottam a(z) {term} kiejtését.',
  'config.channelWrongType': 'Válassz egy szöveges csatornát (ne hangcsatornát vagy kategóriát).',
  'config.channelNoAccess':
    'Nem látom a(z) {channel} csatornát — kérlek, ellenőrizd az ottani jogosultságaimat.',
  'config.channelSet':
    'Az automatikus felolvasás csatornája beállítva: {channel}. Következő: kapcsold be az automatikus felolvasást a `/config auto-read active:true` paranccsal.',
  'config.autoreadOn': 'Az automatikus felolvasás mostantól **be** van kapcsolva.',
  'config.autoreadOff': 'Az automatikus felolvasás mostantól **ki** van kapcsolva.',
  'config.maxCharsRange': 'A maximális karakterszám értékének 1 és 2000 között kell lennie.',
  'config.maxCharsSet': 'Üzenetenkénti maximális karakterszám beállítva: {value}.',
  'config.rateLimitRange': 'A sebességkorlát értékének 1 és 120 között kell lennie.',
  'config.rateLimitSet': 'Sebességkorlát beállítva: {value} üzenet percenként.',
  'config.roleSet':
    'Az automatikus felolvasás mostantól a(z) {role} szereppel rendelkező tagokra korlátozódik.',
  'config.roleCleared': 'A szerepkorlátozás eltávolítva — mostantól mindenkit fel lehet olvasni.',
  'config.enabledOn': 'A TTS mostantól **be** van kapcsolva ezen a szerveren.',
  'config.enabledOff': 'A TTS mostantól **ki** van kapcsolva ezen a szerveren.',
  'config.defaultVoiceSet':
    '✅ A szerver alapértelmezett hangja beállítva: **{name}**. A saját hang nélküli tagok ezt fogják hallani. (id: `{model}`)',
  'config.reset':
    'A beállítások visszaálltak az alapértelmezettre. A tiltólistád és a kiejtéseid megmaradtak.',
  'config.showTitle': '**Szerver beállításai**',
  'config.showChannel': 'TTS-csatorna: {value}',
  'config.showAutoread': 'Automatikus felolvasás: {value}',
  'config.showRole': 'Szerep: {value}',
  'config.showEnabled': 'Engedélyezve: {value}',
  'config.showVoice': 'Alapértelmezett hang: {value}',
  'config.showMaxChars': 'Maximális karakterszám: {value}',
  'config.showRateLimit': 'Sebességkorlát: {value}/perc',
  'config.showBlocklist': 'Tiltólista: {count} szó',
  'config.showPronunciation': 'Kiejtések: {count} bejegyzés',
  'config.valueNone': '(nincs)',
  'config.valueAny': 'bárki',
  'config.valueAutoDetect': '(automatikus felismerés)',
  'config.on': 'be',
  'config.off': 'ki',
  'config.language.set': 'A felület nyelve beállítva: {language}.',
  'config.language.unsupported': 'Ez a nyelv még nem támogatott.',
  'setup.noChannel':
    'Nem tudtam megállapítani, melyik csatornát használjam. Adj meg egy szöveges csatornát a "channel" opcióban.',
  'setup.channelWrongType':
    'Az automatikus felolvasás csatornájának szöveges csatornának kell lennie (nem hangcsatornának vagy kategóriának). Adj meg egyet a "channel" opcióban.',
  'setup.done': '**Minden kész — a Vozen indulásra kész.**',
  'setup.channelLine': 'Automatikus felolvasás csatornája: {channel}',
  'setup.autoreadOn': 'Automatikus felolvasás: be',
  'setup.permsHeader': '**Jogosultságok:**',
  'setup.permView': 'ViewChannel (a szöveges csatorna látása)',
  'setup.permSend': 'SendMessages (üzenet küldése a szöveges csatornába)',
  'setup.permConnect': 'Connect (csatlakozás a hangcsatornához)',
  'setup.permSpeak': 'Speak (beszéd a hangcsatornában)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — hiányzik',
  'setup.permUnchecked': '⏳ {label} — még nincs ellenőrizve (a /join futtatásakor ellenőrzöm)',
  'setup.fixHint':
    'A hiányzók javításához: a szerverbeállításokban nyisd meg a Vozen szerepét (vagy a csatorna jogosultságait), és engedélyezd a ❌ jellel jelölt elemeket.',
  'setup.voiceUncheckedNote':
    'Nem vagy hangcsatornában, ezért a Connect/Speak jogosultságokat még nem tudtam ellenőrizni — a /join futtatásakor ellenőrzöm őket.',
  'setup.allGood':
    'Minden készen áll. Csatlakozz egy hangcsatornához, és futtasd a /join parancsot.',
  'setup.joinedVoice': 'Csatlakoztam ide is: {channel} — nem kell futtatnod a /join parancsot.',
  'setup.readyTalk':
    'Minden készen áll. Írj az automatikus felolvasás csatornájába, és hangosan felolvasom.',
  'setup.membersHeader': '**Mondd el a tagjaidnak (a 3 lépéses folyamat):**',
  'setup.membersBody':
    '1) Csatlakozz egy hangcsatornához\n2) Futtasd a /join parancsot, hogy veled együtt belépjek\n3) Írj ebbe a csatornába (vagy használd a /tts parancsot), és hangosan felolvasom\nTeljes parancslista: /help',
  'stats.title': '**Vozen statisztikák**',
  'stats.messagesSpoken': 'Felolvasott üzenetek: {value}',
  'stats.cacheHits': 'Gyorsítótár-találatok: {value}',
  'stats.cacheMisses': 'Gyorsítótár-tévesztések: {value}',
  'stats.synthErrors': 'Szintézishibák: {value}',
  'stats.voiceDrops': 'Hangkiesések: {value}',
  'stats.voiceReconnects': 'Újracsatlakozások: {value}',
  'stats.votes': 'top.gg szavazatok: {value}',
  'stats.activePlayers': 'Aktív lejátszók: {value}',
  'stats.servers': 'Szerverek: {value}',
  'stats.uptime': 'Üzemidő: {value}mp',
  'invite.noClientId':
    'A Vozen meghívólinkje még nincs beállítva (hiányzik a CLIENT_ID). Szólj a bot adminjának.',
  'invite.link': 'Add hozzá a Vozent a szerveredhez:\n{url}',
  'vote.noClientId':
    'A Vozen szavazólinkje még nincs beállítva (hiányzik a CLIENT_ID). Szólj a bot adminjának.',
  'vote.link':
    'Szavazz a Vozenra (ingyenes, 12 óránként), és segíts, hogy többen megtalálják:\n{url}\nHa ez a fiók még soha nem igényelte a jutalmat, **48 óra Vozen Plust** kap, fiókonként csak egyszer.',
  'help.title': 'Vozen — írd be, hallgasd meg.',
  'help.embedTitle': 'Vozen — Parancsok',
  'help.intro':
    'A Vozen hangosan felolvassa a szövegedet a hangcsatornákban — ingyenes neurális hangok, több tucat nyelven.',
  'help.quickStartTitle': 'Gyors kezdés (3 lépés)',
  'help.quickStartBody':
    '1) Csatlakozz egy hangcsatornához, majd futtasd a /join parancsot\n2) Írj a szöveges csatornába (vagy használd: /tts Sziasztok!)\n3) (opcionális) Válassz hangot a /voice set paranccsal',
  'help.groupStarted': 'Első lépések',
  'help.groupStartedBody':
    '• /join — belépek a hangcsatornádba\n• /leave — elhagyom a hangcsatornát\n• /tts <szöveg> — hangosan felolvasom a szöveget · pl. /tts Sziasztok!\n• /skip — kihagyja, amit éppen olvasok',
  'help.groupVoice': 'A hangod',
  'help.groupVoiceBody':
    '• /voice set <model> — válaszd ki a hangod · pl. /voice set en_US-amy-medium\n• /voice list — az elérhető hangok megtekintése\n• /voice preview — minta meghallgatása a hangodból\n• /voice reset — vissza az alapértelmezett hanghoz\n• /voice opt-out · /voice opt-in — az automatikus felolvasás ki- / bekapcsolása neked\n• /voice abbrev add|remove|list — személyes szleng, a te módodon felolvasva (legfeljebb 10)',
  'help.groupFun': 'Szórakozás',
  'help.groupFunBody':
    '• /joke — mesélek egy rövid viccet (válassz nyelvet + opcionális nevetést) · pl. /joke English\n• /laugh — hangosan nevetek a jelenlegi hangodon',
  'help.groupAdmin': 'Szerveradmin (Szerver kezelése jogosultság kell)',
  'help.groupAdminBody':
    '• /setup — vezetett, egylépéses beállítás · ezt futtasd először\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · pl. /config tts-channel #general\n• /stats — botstatisztikák',
  'help.groupMore': 'Továbbiak',
  'help.groupMoreBody':
    '• /invite — a Vozen hozzáadása egy másik szerverhez\n• /vote — szavazz a Vozenra a top.gg oldalon\n• /help — ennek a súgónak a megjelenítése',
  'help.footer': 'Új vagy itt? Futtasd a(z) {command} parancsot a kezdéshez.',
  'welcome.title': 'Köszönjük, hogy hozzáadtad a Vozent! 👋',
  'welcome.description':
    'A Vozen hangosan felolvassa a csevegésedet a hangcsatornákban — írd be, hallgasd meg.\n\n**Kezdj el egyetlen lépésben:** futtasd a(z) {setup} parancsot, és beállítom az automatikus felolvasást, majd csatlakozom a hangcsatornádhoz.\n\nSzükséged van a teljes parancslistára? Futtasd a(z) {help} parancsot.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Hogyan használják a tagok (3 lépés)',
  'welcome.stepsBody':
    '1) Csatlakozz egy hangcsatornához\n2) Futtasd a /join parancsot, hogy csatlakozzak hozzád\n3) Írj a szöveges csatornába (vagy használd a /tts parancsot), és hangosan felolvasom\nTeljes parancslista: /help',
  'welcome.footer': 'Vozen — írd be, hallgasd meg.',
  'welcome.tagline': 'Természetes neurális hang — örökre ingyenes, fizetős fal nélkül.',
  'stt.guildOnly': 'Az átírás csak szerveren belül működik.',
  'stt.noManage':
    'Az átírás elindításához vagy leállításához **Szerver kezelése** jogosultság szükséges.',
  'stt.notPremium':
    '🎙️ Az élő átírás **Premium** funkció. Nézd meg a `/premium info` parancsot, hogy feloldd ezen a szerveren.',
  'stt.unavailable':
    'Az átírás nem érhető el ezen a példányon (a beszéd-szöveg motor nincs telepítve).',
  'stt.notInVoice':
    'Nem vagyok hangcsatornában — csatlakozz egyhez, futtasd előbb a `/join` parancsot, majd indítsd el az átírást.',
  'stt.alreadyRunning':
    'Az átírás már fut ezen a szerveren. Előbb használd a `/transcribe stop` parancsot.',
  'stt.atCapacity':
    'Jelenleg túl sok átírás fut az összes szerveren. Kérlek, próbáld újra hamarosan.',
  'stt.noChannel':
    'Nem tudok átiratokat közzétenni ebben a csatornában. Próbáld meg egy normál szöveges csatornából futtatni a parancsot.',
  'stt.started':
    '✅ Az átírás elindult. Bárkit, aki a hirdetményben a **Hozzájárulok** gombra kattint, átírok ebbe a csatornába.',
  'stt.startFailed':
    'Nem sikerült elindítani az átírást (a hirdetmény közzététele meghiúsult). Mindent visszavontam — semmi sem kerül rögzítésre. Kérlek, próbáld újra.',
  'stt.announceStart':
    '🎙️ **Az élő átírás BE van kapcsolva ebben a csatornában.** Csak azokat írom át, akik hozzájárulnak — kattints az alábbi gombra, hogy engedélyezd a beszéded ide írását. Bármikor visszavonhatod a `/transcribe revoke` paranccsal.',
  'stt.consentBtn': 'Hozzájárulok az átíráshoz',
  'stt.consentThanks':
    '✅ Köszönjük — a beszéded mostantól átírásra kerül ezen a szerveren. Bármikor visszavonhatod a `/transcribe revoke` paranccsal.',
  'stt.stopped': '🛑 Az átírás leállt.',
  'stt.notRunning': 'Az átírás nem fut ezen a szerveren.',
  'stt.announceStop':
    '🛑 **Az élő átírás mostantól KI van kapcsolva.** Abbahagytam a hallgatózást.',
  'stt.revoked':
    '✅ Hozzájárulás visszavonva — mostantól nem írlak át ezen a szerveren. (A már közzétett üzenetek megmaradnak; töröld őket a Discordban, ha szeretnéd.)',
  'stt.revokeNone':
    'Nem járultál hozzá az átíráshoz ezen a szerveren, így nem volt mit visszavonni.',
  'privacy.eraseConfirm':
    '⚠️ Ez véglegesen törli **az összes** Vozen-adatodat minden szerveren: hangbeállítások, kimondott becenév, személyes rövidítések és kiejtések, mentett születésnap, játékpontszámok, beszédstatisztikák, és kilépés (opt-out). **Ez nem vonható vissza.** Biztos vagy benne?',
  'privacy.erasePremiumNote':
    '_Megjegyzés: a fizetett Premium/Plus és annak vásárlási előzményei megmaradnak — hozzád tartoznak és a törvényileg előírt pénzügyi nyilvántartáshoz. A Premium leállításához hagyd lejárni, vagy fordulj az ügyfélszolgálathoz._',
  'privacy.eraseYes': 'Minden törlése',
  'privacy.eraseNo': 'Mégse',
  'privacy.eraseCancelled': 'Megszakítva — semmi sem lett törölve.',
  'privacy.eraseDone': '✅ Kész. Az összes személyes adatod véglegesen törölve lett.',
  'shutup.notInVoice':
    'Még nem vagyok hangcsatornában — csatlakozz egyhez, és előbb futtasd a /join parancsot.',
  'shutup.nothing': 'Most éppen semmi sem szól.',
  'shutup.done': '🤐 Rendben, abbahagyom — kiürítettem a sort.',
  'voice.detection.on':
    '✅ Az automatikus nyelvfelismerés BE van kapcsolva: minden üzenet a felismert nyelvéhez tartozó hangon szólal meg (a beszélő változhat). Kikapcsolás: `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Az automatikus nyelvfelismerés KI van kapcsolva: az egy rögzített hangod olvas fel mindent, így mindig ugyanúgy hangzol.',
  'voice.nickname.set': '✅ A Vozen mostantól **{name}** néven szólít hangosan.',
  'voice.nickname.cleared':
    '✅ Kimondott becenév törölve — a Vozen a szerveren használt nevedet fogja használni.',
  'voice.nickname.invalid':
    'Ebben a névben nincs semmi felolvasható. Próbálj betűket vagy számokat.',
  'voice.effect.set':
    '✅ Hangeffekt beállítva: **{effect}** — az üzeneteid mostantól ezzel az effekttel szólalnak meg. Kikapcsolás: `/voice effect none`.',
  'voice.effect.cleared': '✅ Hangeffekt eltávolítva — újra tiszta hang.',
  'voice.effect.locked':
    '🔒 A(z) **{effect}** Premium effekt. Ingyenes effektek: 🤖 Robot és 🔊 Echo. Oldd fel az összeset a Vozen Premiummal — nézd meg a `/premium` parancsot.',
  'voice.engine.gcloudLocked':
    '🔒 A **💎 Google HD** egy Premium hangmotor. Oldd fel a Vozen Plusszal (személyes) vagy a Vozen Premiummal (szerver) — nézd meg a `/premium` parancsot. Addig a hangod az ingyenes helyi motoron marad.',
  'voice.engine.kokoroLocked':
    '🔒 A **💎 Kokoro** egy Premium hangmotor. Oldd fel a Vozen Plusszal (személyes) vagy a Vozen Premiummal (szerver) — nézd meg a `/premium` parancsot. Addig a hangod az ingyenes helyi motoron marad.',
  'rizz.playing': '😏 Jön egy kis rizz…\n> {line}',
  'rizz.unknownLang': 'Nem ismerem ezt a nyelvet. Válassz egyet a listából.',
  'rizz.locked':
    '🔒 A **/rizz** Premium extra. Oldd fel a Vozen Plusszal (neked) vagy a Premiummal (ezen a szerveren). Nézd meg a `/premium` parancsot.',
  'sound.playing': '🔊 Lejátszom: **{name}**…',
  'sound.unknown': 'Nincs ilyen hangom. Futtasd a `/sound` parancsot a lista megtekintéséhez.',
  'sound.list':
    '🔊 **Hangok:** {sounds}\nJátssz le egyet a `/sound name:<hang>` paranccsal (a hangcsatornádban kell lennem).',
  'sound.disabled':
    '🔇 A hangtábla **ki** van kapcsolva ezen a szerveren. Egy admin bekapcsolhatja a `/config soundboard` paranccsal.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Születésnap mentve: **{day}/{month}**. Boldog születésnapot kívánok, amikor azon a napon csatlakozol egy hangcsatornához!',
  'birthday.invalid': 'Ez nem valós dátum. Ellenőrizd a napot és a hónapot.',
  'birthday.cleared': '🎂 Születésnap eltávolítva.',
  'birthday.show': '🎂 A születésnapod a következőre van állítva: **{day}/{month}**.',
  'birthday.none': 'Még nem állítottál be születésnapot. Használd a `/birthday set` parancsot.',
  'topspeakers.title': '🗣️ **Legaktívabb beszélők** — akiket a legtöbbet olvasok ezen a szerveren:',
  'topspeakers.empty':
    'Még senkinek az üzenetét sem olvastam fel. Állíts be egy felolvasó csatornát a `/setup` paranccsal!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** üzenet · 🔥 {streak} napos sorozat',
  'serverstats.title': '📊 **Szerverstatisztikák**',
  'serverstats.empty':
    'Még nincsenek statisztikák — nem olvastam fel üzeneteket és nem futtattam játékokat itt. Állítsd be a `/setup` paranccsal!',
  'serverstats.messages': '🗣️ **{total}** felolvasott üzenet · **{speakers}** ember',
  'serverstats.topTalkers': '**Legtöbbet beszélők:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} üzenet · 🔥 {streak} nap',
  'serverstats.streak': '🔥 Leghosszabb aktív sorozat: **{days}** nap',
  'serverstats.games': '🎮 **{points}** játékpont · **{wins}** győzelem · **{players}** játékos',
  'serverstats.topPlayers': '**Legjobb játékosok:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pont · {wins} győzelem',
  'serverstats.upsell':
    '🔒 Ez az ingyenes előnézet. A **Premium** feloldja a sorozatokat, a játékstatisztikákat és a teljes top 5-öt — nézd meg a `/premium` parancsot.',
  'streak.day': '🔥 <@{user}> **{n} napos** sorozatban van! Beszélj tovább, hogy életben tartsd.',
  'leaderboard.autoTitle': '🏆 A szerver legtöbbet beszélő tagjai',
  'premium.title': '💎 **Vozen Premium állapot**',
  'premium.lineServerActive': '🖥️ **Szerver:** Premium eddig: {date}',
  'premium.lineServerFree': '🖥️ **Szerver:** Ingyenes csomag',
  'premium.lineUserActive': '👤 **Te (Plus):** aktív eddig: {date}',
  'premium.lineUserFree': '👤 **Te (Plus):** nem aktív',
  'premium.getHint':
    'Minden, amit ma használsz, ingyenes marad. A Premium hozzáadja mind a 8 hangeffektet, a 24/7 hívásban maradást, az 50 személyes kiejtést, a /rizz parancsot és a prémium játékokat. Támogatás: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **A Premium bérleted:** {used}/{total} licenc használatban · lejár: {date}',
  'premium.passServers': '↳ Használatban itt: {servers}',
  'premium.pitch':
    'Még nincs Premiumod. A **Vozen Premium** (3,99 €/hó 3 szerverre, vagy 7,99 €/hó 8-ra) az egész szerverre feloldja: mind a 8 hangeffektet, a 24/7 hívásban maradást, az 50 személyes kiejtést (3 helyett), a /rizz parancsot és a prémium játékokat (Szólánc, Wordle, Sakk). A **Vozen Plus** (1,99 €/hó) ezeket az extrákat személyesen adja meg neked, bármelyik szerveren.',
  'premium.buyHint':
    '▶ **Premium beszerzése:** {link}\nVásárlás után futtasd a `/premium activate` parancsot a kívánt szerveren.',
  'premium.confirmActivate':
    'Felhasználsz **1-et a {total} Premium licencedből** **ezen a szerveren**? Jelenleg **{used}** van használatban. Később felszabadíthatod a `/premium deactivate` paranccsal — a bérlet ideje mindenképp fut tovább.',
  'premium.confirmYes': '💎 Licenc felhasználása',
  'premium.confirmNo': 'Mégse',
  'premium.activateOk':
    '✅ A Premium mostantól aktív **ezen a szerveren** eddig: {date}. Licencek: **{used}/{total}** használatban.',
  'premium.activateCancelled': 'Megszakítva — nem lett licenc felhasználva.',
  'premium.activateTimeout': 'Időtúllépés — nem lett licenc felhasználva.',
  'premium.noPass':
    'Nincs aktív Premium bérleted. Szerezz be egyet, és a fiókodra kerül — utána futtasd itt a `/premium activate` parancsot.\n▶ {link}',
  'premium.alreadyActive':
    'Ezen a szerveren már használatban van az egyik Premium licenced. Nincs teendő.',
  'premium.noSeats':
    'Mind a(z) **{total}** Premium licenced használatban van ({servers}). Szabadíts fel egyet ott a `/premium deactivate` paranccsal, majd próbáld újra itt.',
  'premium.needManageGuild':
    'A Premium aktiválása az egész szervert érinti — csak a **Szerver kezelése** jogosultsággal rendelkező tagok tehetik meg. Kérj meg egy admint.',
  'premium.deactivateOk':
    '✅ Felszabadítottam ennek a szervernek a Premium licencét. Használd egy másik szerveren a `/premium activate` paranccsal.',
  'premium.deactivateNone': 'Ezen a szerveren nincs felszabadítható Premium licenced.',
  'premium.thisServer': 'ez a szerver',
  'grant.denied': '⛔ Ez a parancs csak a bot tulajdonosának való.',
  'grant.okPremium':
    '✅ <@{user}> kapott egy **Premium bérletet** ({seats} licenc) **{days}** napra — lejár: {date}. A `/premium activate` paranccsal aktiválhatja.',
  'grant.okPlus': '✅ <@{user}> kapott **Vozen Plust** **{days}** napra — lejár: {date}.',
  'gencode.done':
    '✅ Létrehozva **{count}** darab {plan} kód, egyenként **{days}** napra. Oszd meg őket privátban:\n{list}',
  'redeem.okPlus': '🎁 Beváltva! Kaptál **Vozen Plust** **{days}** napra — lejár: {date}.',
  'redeem.okPremium':
    '🎁 Beváltva! Kaptál egy **Premium bérletet** ({seats} licenc) **{days}** napra — lejár: {date}. Aktiváld a szervereden a `/premium activate` paranccsal.',
  'redeem.notFound': '❌ Ez a kód nem létezik. Ellenőrizd, és próbáld újra.',
  'redeem.used': '❌ Ezt a kódot már beváltották.',
  'redeem.expired': '❌ Ez a kód lejárt.',
  'config.blockLimit':
    'Ezen a szerveren már megvan a maximális {max} tiltott szó. Távolíts el egyet, mielőtt újat adnál hozzá.',
  'config.xsaidOn':
    'A Vozen mostantól minden üzenet előtt bejelenti, **ki beszélt** (pl. "Alex azt mondta: szia"). Kikapcsolás: `/config x-said active:false`.',
  'config.xsaidOff': 'A Vozen **többé nem** jelenti be, ki beszélt — csak az üzenetet olvassa fel.',
  'config.autojoinOn':
    '✅ Automatikus csatlakozás **be** — a Vozen csatlakozik a hangcsatornádhoz, amikor a TTS-csatornába írsz.',
  'config.autojoinOff':
    'Automatikus csatlakozás **ki** — használd a `/join` parancsot, hogy a Vozent behozd a hangcsatornába.',
  'config.stayOn':
    '✅ 24/7 hívásban **be** — a Vozen a hangcsatornában marad akkor is, ha kiürül, és újraindítás után visszatér. 💎 Az érvényesüléshez Premium szükséges (vásárolj, vagy válts be egy kódot a `/redeem` paranccsal, majd `/premium activate`).',
  'config.stayOff':
    '24/7 hívásban **ki** — a Vozen kilép, amikor a hangcsatorna kiürül (alapértelmezett).',
  'config.readBotsOn': '✅ A Vozen mostantól **más botok és webhookok** üzeneteit is felolvassa.',
  'config.readBotsOff':
    'A Vozen **figyelmen kívül hagyja** a többi botot és webhookot (csak valódi embereket olvas fel).',
  'config.textInVoiceOn':
    '✅ A Vozen felolvassa a **hangcsatornáján belüli szöveges csevegést** is.',
  'config.textInVoiceOff':
    'A Vozen **nem** olvassa fel a hangcsatorna szöveges csevegését (csak a TTS-csatornát).',
  'config.antispamOn':
    '✅ Spamszűrő **be** — a Vozen nem olvassa fel a spamüzeneteket (tömeges szóismétlés vagy ugyanaz a hosszú üzenet újra és újra elküldve).',
  'config.antispamOff': 'Spamszűrő **ki** — a Vozen a szokásos módon minden üzenetet felolvas.',
  'config.streaksOn':
    '✅ Sorozatértesítők **be** — a Vozen megjelenít egy 🔥 napi sorozat üzenetet, amikor egy-egy személy először szólal meg az adott napon.',
  'config.streaksOff':
    'Sorozatértesítők **ki** — a Vozen továbbra is követi a sorozatokat (lásd `/top-speakers`), de nem jelzi őket.',
  'config.soundboardOn': 'Hangtábla **be** — bárki lejátszhat klipeket a `/sound` paranccsal.',
  'config.soundboardOff': 'Hangtábla **ki** — a `/sound` le van tiltva ezen a szerveren.',
  'config.votePromosLabel': 'top.gg-jutalomértesítések + Vozen Support',
  'config.greetOn': '✅ Néven köszöntöm az embereket, amikor csatlakoznak a hangcsatornához.',
  'config.greetOff': '🔇 **Nem** köszöntöm az embereket, amikor csatlakoznak a hangcsatornához.',
  'config.greetLangSet': '✅ A csatlakozási köszöntés nyelve beállítva: **{language}**.',
  'config.showXsaid': 'Beszélő bejelentése (xsaid): {value}',
  'config.showAutojoin': 'Automatikus csatlakozás: {value}',
  'config.showReadBots': 'Botok/webhookok felolvasása: {value}',
  'config.showTextInVoice': 'Szöveg a hangcsatornában: {value}',
  'config.showAntispam': 'Spamszűrő: {value}',
  'config.showSoundboard': 'Hangtábla (/sound): {value}',
  'config.showGreet': 'Köszöntés csatlakozáskor: {value} ({language})',
  'stats.synthLatency': 'Szintéziskésleltetés: p50 {p50} ms / p95 {p95} ms ({count} minta)',
  'speak.emptyMessage': 'Ennek az üzenetnek nincs felolvasható szövege.',
  'uptime.text': '🟢 A Vozen **{uptime}** ideje van online.',
  'botstats.title': '📊 **Vozen — statisztikák**',
  'botstats.servers': 'Szerverek: **{value}**',
  'botstats.voiceSessions': 'Hangmenetek most: **{value}**',
  'botstats.messagesSpoken': 'Felolvasott üzenetek: **{value}**',
  'botstats.uptime': 'Üzemidő: **{value}**',
  'invite.button': 'Vozen hozzáadása',
  'vote.button': 'Szavazás a top.gg-n',
  'vote.upsell':
    '🗳️ Ha ez a fiók még soha nem igényelte a jutalmat, **48 óra Vozen Plust** kap, fiókonként csak egyszer. {url}',
  'vote.cooldownStatus':
    '🗳️ Ez a fiók már felhasználta az egyszeri szavazási jutalmát. Továbbra is szavazhatsz a Vozen támogatására, de több Plust nem kapsz.',
  'help.support': '🛟 Segítségre van szükséged, vagy problémát jelentenél? {url}',
  'help.source':
    '📄 Nyílt forráskód (AGPL-3.0) — szerezd meg az itt futó pontos forráskódot: {url}',
  'game.start.needVoice':
    'Ez egy **hangjáték** — csatlakozz egy hangcsatornához, futtasd előbb a /join parancsot, majd indítsd el.',
  'game.start.alreadyActive':
    'Már fut egy játék itt: <#{channel}>. Fejezd be (vagy használd a `/game stop` parancsot), mielőtt újat kezdenél.',
  'game.start.premiumLocked':
    '🔒 A(z) **{game}** Premium játék (valódi számítási kapacitást igényel). Nézd meg a `/premium` parancsot.',
  'game.start.started': '🎮 Indul a(z) **{game}**! Figyeld a csatornát — sok sikert!',
  'game.start.startedThread':
    '🎮 A(z) **{game}** elindult itt: <#{channel}> — csatlakozz ott! A szál magától törlődik, amikor a játék véget ér.',
  'game.thread.winner': '🏆 {winner} megnyerte a játékot!',
  'game.thread.ended': '🎮 A játék véget ért.',
  'game.unknownGame': 'Nem ismerem ezt a játékot. Válassz egyet a listából.',
  'game.stop.ok': '🛑 Leállítottam az aktuális játékot.',
  'game.stop.none': 'Most nincs futó játék.',
  'game.list.title': '🎮 **Játékok** — indíts el egyet a `/game play` paranccsal:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Ranglista** — a szerver legjobb játékosai:',
  'game.leaderboard.empty':
    'Még nem játszottak egyetlen játékot sem. Legyél te az első — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pont ({wins} győzelem)',
  'game.finish.title': '🏁 **Vége a játéknak!** Végeredmény:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Vége a játéknak — most senki sem szerzett pontot. Majd legközelebb!',
  'game.finish.winnerVoice': '{user} nyert!',
  'game.guessLanguage.name': 'Találd ki a nyelvet',
  'game.guessLanguage.desc':
    'Felolvasok egy mondatot egy véletlenszerű nyelven — aki először megnevezi, megkapja a pontot.',
  'game.guessLanguage.intro':
    '🗣️ **Találd ki a nyelvet** — {rounds} mondatot fogok felolvasni. Írd be, melyik nyelvet hallod. A leggyorsabb helyes válasz nyeri az egyes köröket!',
  'game.guessLanguage.round': '🎧 {n}/{total}. kör — figyelj…',
  'game.guessLanguage.correct': '✅ **{user}** eltalálta — ez **{language}** volt!',
  'game.guessLanguage.timeout': '⏱️ Lejárt az idő! Ez **{language}** volt.',
  'game.guessLanguage.noLanguages':
    'Nincs elég telepített hangom ehhez a játékhoz. Kérd meg egy admint, hogy adjon hozzá több hangot.',
  'game.math.name': 'Fejszámolás',
  'game.math.desc': 'Hangosan kimondok egy műveletet — aki először beírja a választ, nyer.',
  'game.math.intro':
    '🔢 **Fejszámolás** — {rounds} művelet. Figyelj, és írd be a választ, amilyen gyorsan csak tudod!',
  'game.math.round': '🧮 {n}/{total}. kör — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** eltalálta — a válasz **{answer}** volt!',
  'game.math.timeout': '⏱️ Lejárt az idő! A válasz **{answer}** volt.',
  'game.math.plus': 'plusz',
  'game.math.minus': 'mínusz',
  'game.math.times': 'szor',
  'game.skipCount.name': 'Hiányzó szám',
  'game.skipCount.desc': 'Hangosan számolok, de kihagyok egy számot — aki először elkapja, nyer.',
  'game.skipCount.intro':
    '🔢 **Hiányzó szám** — számolok, de egyet kihagyok. Írd be a hiányzó számot! ({rounds} kör)',
  'game.skipCount.round': '👂 {n}/{total}. kör — melyik számot hagytam ki?',
  'game.skipCount.correct': '✅ **{user}** elkapta — kihagytam a **{answer}** számot!',
  'game.skipCount.timeout': '⏱️ Lejárt az idő! Kihagytam a **{answer}** számot.',
  'game.spelling.name': 'Betűzőverseny',
  'game.spelling.desc': 'Kimondok egy szót — aki először helyesen leírja, nyer.',
  'game.spelling.intro':
    '✍️ **Betűzőverseny** — {rounds} szót fogok mondani. Írd le mindegyiket helyesen!',
  'game.spelling.round': '🗣️ {n}/{total}. kör — írd le a szót, amit mondok…',
  'game.spelling.correct': '✅ **{user}** helyesen leírta: **{word}**!',
  'game.spelling.timeout': '⏱️ Lejárt az idő! A szó **{word}** volt.',
  'game.spelling.empty': 'Még nincs szólistám ennek a szervernek a hangnyelvéhez.',
  'game.spellOut.name': 'Betűkből a szó',
  'game.spellOut.desc': 'Betűzök egy szót betűnként — aki először leírja az egész szót, nyer.',
  'game.spellOut.intro':
    '🔡 **Betűkből a szó** — {rounds} szót betűzök le betűnként. Írd be a teljes szót!',
  'game.spellOut.round': '🔤 {n}/{total}. kör — figyeld a betűket…',
  'game.spellOut.correct': '✅ **{user}** eltalálta — **{word}**!',
  'game.spellOut.timeout': '⏱️ Lejárt az idő! A szó **{word}** volt.',
  'game.fastSpeech.name': 'Hadaró',
  'game.fastSpeech.desc':
    'Nagyon gyorsan felolvasok egy mondatot — aki először leírja, amit mondtam, nyer.',
  'game.fastSpeech.intro':
    '💨 **Hadaró** — {rounds} mondat őrült sebességgel. Írd le, amit hallasz!',
  'game.fastSpeech.round': '⚡ {n}/{total}. kör — jön is, gyorsan!',
  'game.fastSpeech.correct': '✅ **{user}** megfejtette: „{phrase}"',
  'game.fastSpeech.timeout': '⏱️ Lejárt az idő! Ez volt: „{phrase}"',
  'game.fastSpeech.empty': 'Még nincsenek mondataim ennek a szervernek a hangnyelvéhez.',
  'game.accentSwap.name': 'Vicces akcentus',
  'game.accentSwap.desc': 'Kimondok egy szót idegen akcentussal — aki először leírja, nyer.',
  'game.accentSwap.intro':
    '🎭 **Vicces akcentus** — {rounds} szó rossz akcentussal kimondva. Írd be a szót!',
  'game.accentSwap.round': '🌍 {n}/{total}. kör — melyik szót próbálom kimondani?',
  'game.accentSwap.correct': '✅ **{user}** eltalálta — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Lejárt az idő! A szó **{word}** volt.',
  'game.reflexes.name': 'Reflexek',
  'game.reflexes.desc':
    'Visszaszámolok, majd elkiáltom, hogy RAJT — aki utána először ír, nyer. Ne indulj el korán!',
  'game.reflexes.intro':
    '⚡ **Reflexek** — {rounds} kör. Amikor azt kiáltom, hogy **RAJT**, írj bármit, amilyen gyorsan csak tudsz. Ha a RAJT előtt írsz, az kiugrás!',
  'game.reflexes.ready': '🚦 {n}/{total}. kör — készülj…',
  'game.reflexes.countdown': 'három… kettő… egy…',
  'game.reflexes.go': '🟢 **RAJT!!!**',
  'game.reflexes.goVoice': 'Rajt!',
  'game.reflexes.tooSoon': '🔴 **{user}** elhamarkodta — túl korán!',
  'game.reflexes.win': '⚡ **{user}** a leggyorsabb! Pont!',
  'game.reflexes.tooSlow': '😴 Senki sem reagált időben. Következő!',
  'game.headsOrTails.name': 'Fej vagy írás',
  'game.headsOrTails.desc':
    'Tippelj a feldobásra — írd be, hogy fej vagy írás, mielőtt feldobom. Aki a legtöbbet eltalálja, nyer!',
  'game.headsOrTails.intro':
    '🪙 **Fej vagy írás** — {rounds} kör. Minden körben írd be, hogy `fej` vagy `írás`, mielőtt feldobom az érmét. Helyes tippenként 1 pont!',
  'game.headsOrTails.introVoice': 'Játsszunk fej vagy írást!',
  'game.headsOrTails.round': '🪙 {n}/{total}. kör — fej vagy írás? Írd be a tipped!',
  'game.headsOrTails.roundVoice': 'Fej… vagy írás?',
  'game.headsOrTails.heads': 'fej',
  'game.headsOrTails.tails': 'írás',
  'game.headsOrTails.resultVoice': '{side} lett!',
  'game.headsOrTails.winners': '**{side}** lett! Pont ennek: {users}',
  'game.headsOrTails.noWinners': '**{side}** lett! Senki sem találta el — nincs pont.',
  'game.vozenSays.name': 'Vozen mondja',
  'game.vozenSays.desc':
    "Csak akkor engedelmeskedj, ha a parancs azzal kezdődik: 'Vozen mondja'. Ha csapdába esel, elkaptalak!",
  'game.vozenSays.intro':
    "🫡 **Vozen mondja** — {rounds} parancs. CSAK akkor csináld, ha azzal kezdem: **'Vozen mondja'**. Egyébként ne mozdulj!",
  'game.vozenSays.prefix': 'Vozen mondja',
  'game.vozenSays.verb': 'írjátok be',
  'game.vozenSays.real': '🗣️ {n}/{total}. kör — „{command}"',
  'game.vozenSays.trap': '🗣️ {n}/{total}. kör — „{command}"',
  'game.vozenSays.obeyed': '✅ **{user}** engedelmeskedett először — pont!',
  'game.vozenSays.caught': '🔴 **{user}** — nem mondtam, hogy Vozen mondja! Elkaptalak!',
  'game.vozenSays.nobody':
    '😴 Senki sem engedelmeskedett időben a **{word}** parancsnak. Következő!',
  'game.vozenSays.trapCleared':
    '😌 Csapda volt — jól kiszúrtátok, senki sem dőlt be a **{word}** parancsnak.',
  'game.roulette.name': 'Felelsz vagy mersz rulett',
  'game.roulette.desc':
    'Megpörgetem és hangosan felolvasok egy felelsz-vagy-mersz feladatot. Futtasd újra egy másikért.',
  'game.roulette.header': '🎯 **A kerék azt mondja…**',
  'game.hangman.name': 'Akasztófa',
  'game.hangman.desc': 'Találd ki a szót betűnként — 6 hiba és vége.',
  'game.hangman.intro':
    '🪢 **Akasztófa** — írj be egy betűt egyszerre a szó kitalálásához. Az egész szót is beírhatod!',
  'game.hangman.hit': '🟢 **{user}** megtalálta: **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — nincs **{letter}**.',
  'game.hangman.wrongLetters': 'Hibás: {letters}',
  'game.hangman.win': '🎉 **{user}** megfejtette — **{word}**!',
  'game.hangman.lose': '💀 Elfogytak a próbálkozások! A szó **{word}** volt.',
  'game.hangman.idle': '🕹️ A játék szünetel (senki sem játszik). A szó **{word}** volt.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Találd ki az 5 betűs szót. 🟩 jó helyen, 🟨 rossz helyen, ⬛ nincs a szóban. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — írj be egy 5 betűs szót. {max} próbálkozáson osztoztok. 🟩 jó helyen · 🟨 rossz helyen · ⬛ nincs a szóban.',
  'game.wordle.guess': '🔤 **{user}** tippelt — **{left}** próbálkozás maradt',
  'game.wordle.inWord': '🟢 a szóban: {letters}',
  'game.wordle.out': '🚫 kizárva: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** {n} próbálkozásból eltalálta — **{word}**!',
  'game.wordle.lose': '💀 Elfogytak a próbálkozások! A szó **{word}** volt.',
  'game.wordle.idle': '🕹️ A játék szünetel (senki sem játszik). A szó **{word}** volt.',
  'game.tictactoe.name': 'Amőba',
  'game.tictactoe.desc':
    'Két játékos — írj be egy számot 1-9 között a jeled elhelyezéséhez. Három egy sorban nyer.',
  'game.tictactoe.intro':
    '⭕ **Amőba** — az első két lépő játékos ❌ és ⭕ (❌ kezd). Írj be egy számot 1-9 között a meződ megjátszásához.',
  'game.tictactoe.turn': 'Soron: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, most **{mark}** van soron.',
  'game.tictactoe.taken': '🚫 A(z) {cell} mező foglalt — válassz másikat.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) nyert!',
  'game.tictactoe.draw': '🤝 Döntetlen!',
  'game.tictactoe.idle': '🕹️ A játék véget ért (senki sem játszik).',
  'game.chess.name': 'Sakk',
  'game.chess.desc':
    'Két játékos — valódi sakkszabályok (sakk, sáncolás, gyalogváltozás…). Írj be egy lépést, például "e4" vagy "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Sakk** — az első két lépő játékos a világos és a sötét (a világos kezd). Írj be egy lépést algebrai jelöléssel ("e4", "Nf3", "O-O") vagy koordinátákkal ("e2e4"). Írd be, hogy "feladom" a feladáshoz.',
  'game.chess.white': 'világos',
  'game.chess.black': 'sötét',
  'game.chess.seats': '⚪ Világos: **{white}** · ⚫ Sötét: **{black}**',
  'game.chess.turn': '{move} — soron: **{color}**',
  'game.chess.check': '♟️ Sakk!',
  'game.chess.notYourTurn': '⏳ **{user}**, most a(z) **{color}** van soron.',
  'game.chess.illegalMove': '🚫 A(z) "{move}" nem szabályos lépés — próbáld újra.',
  'game.chess.checkmate': '🏆 Sakk-matt ({move})! **{user}** nyert!',
  'game.chess.draw': '🤝 Döntetlen ({move})!',
  'game.chess.resigned': '🏳️ **{user}** feladta — **{winner}** nyert!',
  'game.chess.idle': '🕹️ A játék véget ért (senki sem játszik).',
  'game.wordChain.name': 'Szólánc',
  'game.wordChain.descr':
    'Körökre osztott szólánc egy nyelven: mondj egy szót, amely az előző utolsó betűjével kezdődik. 2 élet, ismétlés nélkül, és az idő egyre gyorsul. Válaszd ki a nyelvet a `language` opcióval. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ A Szólánc jelenleg nem érhető el ezen a nyelven: **{lang}** (hiányzó szólista).',
  'game.wordChain.lobby':
    '🔗 **Szólánc** ezen a nyelven: **{lang}**! Írj bármit ebbe a csatornába **{seconds} mp**-en belül a csatlakozáshoz.',
  'game.wordChain.notEnough':
    '😴 Nem csatlakozott elég játékos (legalább 2 kell). A játék megszakítva.',
  'game.wordChain.begin':
    '🚀 Indulás! Játékosok: {players}. Minden szónak az előző utolsó betűjével kell kezdődnie.',
  'game.wordChain.turn':
    '**{name}**, te jössz! Egy **{lang}** szó, amely **{letter}** betűvel kezdődik — {hearts} · ⏱️ {seconds} mp',
  'game.wordChain.accepted': '✅ **{word}** — következő betű: **{letter}**',
  'game.wordChain.bad.letter': '↪️ **{letter}** betűvel kell kezdődnie.',
  'game.wordChain.bad.short': '📏 Túl rövid — legalább **{min}** betű.',
  'game.wordChain.bad.repeated': '🔁 Ezt a szót már használták.',
  'game.wordChain.bad.word': '📖 Ez nincs a szótárban.',
  'game.wordChain.bad.latin': '🔤 Csak az A–Z betűk számítanak.',
  'game.wordChain.timeout': '⏰ **{name}** kifutott az időből! {hearts} maradt.',
  'game.wordChain.eliminated': '💀 **{name}** kiesett!',
  'game.wordChain.winner': '🏆 **{name}** megnyerte a láncot! ({chain} szó)',
  'game.stats.none':
    'Még nem játszottál egyetlen játékot sem. Próbáld ki a `/game play` parancsot!',
  'game.stats.body': '🎮 **A statisztikáid** — **{points}** pont · **{wins}** győzelem · {rank}',
  'game.stats.rank': '**#{rank}**. helyezés {total} közül',
  'game.stats.unranked': 'még nincs helyezés',
  'game.pickPrompt': '🎮 Melyik játékot szeretnéd játszani? Válassz egyet:',
  'game.pickPlaceholder': 'Válassz egy játékot…',
  'game.pickTimeout':
    '⏰ Nem választottál játékot — futtasd újra a `/game play` parancsot, amikor készen állsz.',
  'pron.listHeader': '🗣️ **A kiejtéseid** ({count}/{limit}):',
  'pron.listEmpty': 'Még egy sincs — adj hozzá egyet a `/pronunciation add` paranccsal.',
  'pron.set':
    '✅ Mentve! Amikor **te** azt írod, hogy „{term}", azt fogom mondani: „{replacement}".',
  'pron.removed': '🗑️ „{term}" eltávolítva.',
  'pron.notFound':
    'Nincs kiejtésed a(z) „{term}" szóhoz. Nézd meg a sajátjaidat a `/pronunciation list` paranccsal.',
  'pron.empty': 'A szó és a kiejtés nem lehet üres.',
  'pron.limitHit':
    '🔒 Elérted a(z) **{limit}** kiejtésből álló korlátodat. Távolíts el egyet a `/pronunciation remove` paranccsal.',
  'pron.limitUpsell': '💎 A Vozen Plus vagy Premium **50**-re emeli → {url}',
  'pron.modalTitle': 'Taníts a Vozennek egy kiejtést',
  'pron.modalTerm': 'A szó (ahogy leírják)',
  'pron.modalSay': 'Hogyan mondja ki a Vozen',
  'spron.listHeader': '🗣️ **Szerverkiejtések** ({count}/{limit}) — mindenkire vonatkoznak:',
  'spron.listEmpty': 'Még egy sincs — adj hozzá egyet a `/server-pronunciation add` paranccsal.',
  'spron.set': '✅ Mentve az egész szerverre! „{term}" → „{replacement}".',
  'spron.removed': '🗑️ „{term}" eltávolítva a szerverről.',
  'spron.notFound': 'A szervernek nincs kiejtése a(z) „{term}" szóhoz.',
  'spron.limitHit':
    '🔒 A szerver elérte a(z) **{limit}** kiejtésből álló korlátját. Távolíts el egyet a `/server-pronunciation remove` paranccsal.',
  'spron.modalTitle': 'Szerverkiejtés',
  'spron.modalSay': 'Hogyan mondja ki a Vozen mindenkinek',
  'rand.selectPrompt': '🎲 **Sorsoló** — hány lehetőség közül válasszak?',
  'rand.selectPlaceholder': 'Lehetőségek száma…',
  'rand.selectOption': '{n} lehetőség',
  'rand.filling': '📝 Töltsd ki az imént megnyílt űrlapot!',
  'rand.modalTitle': 'Sorsoló — {amount} lehetőség',
  'rand.modalOption': '{n}. lehetőség',
  'rand.needTwo': 'Adj meg legalább 2 lehetőséget vesszővel elválasztva (pl. "pizza, sushi").',
  'rand.result': '{count} lehetőség közül a választásom… **{winner}**!',
  'rand.speak': 'Az én választásom… {winner}!',
  'rand.notInVoice':
    '_(csatlakozz velem egy hangcsatornához, és legközelebb hangosan is kimondom)_',
  'rand.timeout':
    '⏰ Semmi sem lett kiválasztva — futtasd újra a `/randomizer` parancsot, amikor készen állsz.',
};
