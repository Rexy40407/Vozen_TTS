export default {
  'error.generic': 'Ceva n-a mers bine. Te rog încearcă din nou.',
  'stt.guildOnly': 'Transcrierea funcționează doar în interiorul unui server.',
  'stt.noManage':
    'Ai nevoie de permisiunea **Gestionare server** pentru a porni sau opri transcrierea.',
  'stt.notPremium':
    '🎙️ Transcrierea în timp real este o funcție **Premium**. Vezi `/premium info` ca s-o deblochezi pentru acest server.',
  'stt.unavailable':
    'Transcrierea nu este disponibilă pe această instanță (motorul voce-în-text nu este instalat).',
  'stt.notInVoice':
    'Nu sunt într-un canal de voce — intră într-unul și rulează mai întâi `/join`, apoi pornește transcrierea.',
  'stt.alreadyRunning':
    'Transcrierea rulează deja pe acest server. Folosește mai întâi `/transcribe stop`.',
  'stt.atCapacity':
    'Rulează prea multe transcrieri în acest moment pe toate serverele. Te rog încearcă din nou peste puțin timp.',
  'stt.noChannel':
    'Nu pot posta transcrieri în acest canal. Încearcă să rulezi comanda dintr-un canal text normal.',
  'stt.started':
    '✅ Transcrierea a pornit. Oricine apasă **Consimt** în anunț va fi transcris în acest canal.',
  'stt.startFailed':
    'N-am putut porni transcrierea (n-am reușit să postez anunțul). Am anulat totul — nu se înregistrează nimic. Te rog încearcă din nou.',
  'stt.announceStart':
    '🎙️ **Transcrierea în timp real este PORNITĂ în acest canal.** Sunt transcriși doar cei care consimt — apasă butonul de mai jos ca să permiți ca vorbirea ta să fie scrisă aici. Poți retrage consimțământul oricând cu `/transcribe revoke`.',
  'stt.consentBtn': 'Consimt să fiu transcris',
  'stt.consentThanks':
    '✅ Mulțumim — vorbirea ta va fi de acum transcrisă pe acest server. Retrage consimțământul oricând cu `/transcribe revoke`.',
  'stt.stopped': '🛑 Transcrierea s-a oprit.',
  'stt.notRunning': 'Transcrierea nu rulează pe acest server.',
  'stt.announceStop': '🛑 **Transcrierea în timp real este acum OPRITĂ.** Am încetat să ascult.',
  'stt.revoked':
    '✅ Consimțământ retras — nu vei mai fi transcris pe acest server. (Mesajele deja postate rămân; șterge-le din Discord dacă vrei.)',
  'stt.revokeNone':
    'Nu consimțiseși la transcriere pe acest server, așa că nu era nimic de retras.',
  'privacy.eraseConfirm':
    '⚠️ Aceasta șterge definitiv **toate** datele tale Vozen de pe fiecare server: setările de voce, porecla rostită, abrevierile și pronunțiile personale, ziua de naștere salvată, scorurile din jocuri, statisticile de vorbire și dezactivarea. **Aceasta nu poate fi anulată.** Ești sigur?',
  'privacy.erasePremiumNote':
    '_Notă: Premium/Plus-ul tău plătit și istoricul achiziției se păstrează — îți aparțin ție și evidențelor financiare cerute de lege. Ca să oprești Premium, lasă-l să expire sau contactează suportul._',
  'privacy.eraseYes': 'Șterge tot',
  'privacy.eraseNo': 'Anulează',
  'privacy.eraseCancelled': 'Anulat — nu a fost șters nimic.',
  'privacy.eraseDone': '✅ Gata. Toate datele tale personale au fost șterse definitiv.',
  'error.needManageGuild': 'Ai nevoie de permisiunea **Gestionare server** pentru asta.',
  'join.needVoiceChannel': 'Intră mai întâi într-un canal de voce, apoi rulează /join.',
  'join.missingPerms': 'Am nevoie de permisiunile **Conectare** și **Vorbire** în {channel}.',
  'join.joined':
    '✅ Sunt în {channel}! Pasul următor: scrie `/tts salut` și îl citesc cu voce tare. Vrei să citesc automat un canal? Rulează /setup.',
  'join.joinedAutoread':
    '✅ Sunt în {channel}! Totul e pregătit. Scrie în canalul de citire automată și îl citesc cu voce tare. → {readChannel}',
  'leave.left': 'Am ieșit din canalul de voce. Pe data viitoare!',
  'skip.notInVoice':
    'Încă nu sunt într-un canal de voce — intră într-unul și rulează /join mai întâi, apoi încearcă din nou.',
  'skip.skipped': 'Sărit.',
  'skip.nothing': 'Nu se redă nimic în acest moment.',
  'shutup.notInVoice':
    'Încă nu sunt într-un canal de voce — intră într-unul și rulează mai întâi /join.',
  'shutup.nothing': 'Nu se redă nimic în acest moment.',
  'shutup.done': '🤐 Bine, mă opresc — am golit tot din coadă.',
  'tts.notInVoice':
    'Încă nu sunt într-un canal de voce — intră într-unul și rulează /join, apoi încearcă din nou.',
  'tts.nothingToRead': 'Nu e nimic de citit acolo — trimite-mi ceva text de rostit.',
  'tts.nothingAfterClean':
    'După ce am curățat textul n-a mai rămas nimic de citit — încearcă un text normal (litere sau cuvinte).',
  'tts.tooFast': 'Ho, mai încet puțin — încearcă din nou peste o clipă.',
  'tts.blocked': 'Textul conține un cuvânt blocat, așa că l-am ignorat.',
  'tts.queued': 'Am notat — e în coadă.',
  'tts.busy': 'Sunt ocupat acum — încearcă din nou peste o clipă.',
  'voice.unknownModel': 'Nu cunosc vocea aceea — verifică /voice list.',
  'voice.badSpeed':
    'Viteza trebuie să fie între 0.5 și 2.0 (1.0 e normală). Încearcă `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Vocea ta este acum **{name}** la {speed}×. Încearcă `/tts salut` ca s-o auzi. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Configurarea vocii** — alege opțiunile de mai jos, apoi apasă **Salvează**. Nimic nu se schimbă până atunci.',
  'voice.config.summary': 'Selecția curentă: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Limbă…',
  'voice.config.pickVoice': 'Voce…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Viteză…',
  'voice.config.more': '▼ Mai multe limbi',
  'voice.config.engDefault': 'Implicit (local)',
  'voice.config.save': 'Salvează',
  'voice.config.cancel': 'Anulează',
  'voice.config.cancelled': 'Configurare anulată — nu s-a schimbat nimic.',
  'voice.config.expired': 'Panoul a expirat — rulează din nou `/voice config` pentru a continua.',
  'voice.listHeader': 'Voci disponibile:',
  'voice.listEmpty': '(niciuna instalată)',
  'voice.reset':
    '✅ Vocea ta a revenit la cea implicită. Alege alta oricând cu `/voice list` și `/voice set`.',
  'voice.detection.on':
    '✅ Detectarea automată a limbii este PORNITĂ: fiecare mesaj este citit într-o voce pentru limba detectată (vorbitorul se poate schimba). Oprește-o cu `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Detectarea automată a limbii este OPRITĂ: unica ta voce fixă citește tot, așa că suni mereu la fel.',
  'voice.optout': 'Nu vei mai fi citit automat. Rulează /voice opt-in ca să reactivezi.',
  'voice.optin': 'Vei fi din nou citit automat.',
  'voice.nickname.set': '✅ Vozen te va striga de acum **{name}** cu voce tare.',
  'voice.nickname.cleared':
    '✅ Porecla rostită a fost eliminată — Vozen va folosi numele tău de pe server.',
  'voice.nickname.invalid':
    'Numele acela nu are nimic ce poate fi citit cu voce tare. Încearcă litere sau cifre.',
  'voice.effect.set':
    '✅ Efect de voce setat la **{effect}** — mesajele tale se redau acum cu acel efect. Folosește `/voice effect none` ca să-l oprești.',
  'voice.effect.cleared': '✅ Efect de voce eliminat — voce curată din nou.',
  'voice.effect.locked':
    '🔒 **{effect}** este un efect Premium. Efecte gratuite: 🤖 Robot și 🔊 Echo. Deblochează-le pe toate cu Vozen Premium — vezi `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** este un motor de voce Premium. Deblochează-l cu Vozen Plus (personal) sau Vozen Premium (server) — vezi `/premium`. Între timp, vocea ta rămâne pe motorul local gratuit.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** este un motor de voce Premium. Deblochează-l cu Vozen Plus (personal) sau Vozen Premium (server) — vezi `/premium`. Între timp, vocea ta rămâne pe motorul local gratuit.',
  'voice.notInVoice': 'Încă nu sunt într-un canal de voce — rulează /join mai întâi.',
  'voice.previewPlaying': 'Redau o mostră…',
  'preview.sample': 'Bună, sunt Vozen. scrie-l, ascultă-l.',
  'laugh.playing': 'Haha! Redau asta în vocea ta…',
  'joke.playing': 'Spun o glumă…\n> {joke}',
  'joke.unknownLang': 'Nu cunosc limba aceea. Alege una din listă.',
  'rizz.playing': '😏 Arunc niște vorbe de agățat…\n> {line}',
  'rizz.unknownLang': 'Nu cunosc limba aceea. Alege una din listă.',
  'rizz.locked':
    '🔒 **/rizz** este un beneficiu Premium. Deblochează-l cu Vozen Plus (tu) sau Premium (acest server). Vezi `/premium`.',
  'sound.playing': '🔊 Redau **{name}**…',
  'sound.unknown': 'Nu am sunetul acela. Rulează `/sound` ca să vezi lista.',
  'sound.list':
    '🔊 **Sunete:** {sounds}\nRedă unul cu `/sound name:<sunet>` (trebuie să fiu în canalul tău de voce).',
  'sound.disabled':
    '🔇 Soundboard-ul este **oprit** pe acest server. Un administrator îl poate activa cu `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Zi de naștere salvată: **{day}/{month}**. Îți voi ura la mulți ani când intri într-un canal de voce în acea zi!',
  'birthday.invalid': 'Aceea nu e o dată reală. Verifică ziua și luna.',
  'birthday.cleared': '🎂 Zi de naștere eliminată.',
  'birthday.show': '🎂 Ziua ta de naștere este setată la **{day}/{month}**.',
  'birthday.none': 'Încă nu ți-ai setat ziua de naștere. Folosește `/birthday set`.',
  'topspeakers.title': '🗣️ **Cei mai vorbăreți** — pe cine citesc cel mai mult pe acest server:',
  'topspeakers.empty':
    'Încă n-am citit mesajele nimănui. Configurează un canal de citire cu `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** mesaje · 🔥 serie de {streak} zile',
  'serverstats.title': '📊 **Statistici server**',
  'serverstats.empty':
    'Încă fără statistici — n-am citit niciun mesaj și n-am rulat niciun joc aici. Configurează cu `/setup`!',
  'serverstats.messages': '🗣️ **{total}** mesaje citite · **{speakers}** persoane',
  'serverstats.topTalkers': '**Cei mai vorbăreți:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} msj · 🔥 {streak}z',
  'serverstats.streak': '🔥 Cea mai lungă serie activă: **{days}** zile',
  'serverstats.games':
    '🎮 **{points}** puncte din jocuri · **{wins}** victorii · **{players}** jucători',
  'serverstats.topPlayers': '**Cei mai buni jucători:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pct · {wins} victorii',
  'serverstats.upsell':
    '🔒 Aceasta e previzualizarea gratuită. **Premium** deblochează seriile, statisticile jocurilor și top 5 complet — vezi `/premium`.',
  'streak.day':
    '🔥 <@{user}> este într-o serie de **{n} zile**! Continuă să vorbești ca s-o menții.',
  'leaderboard.autoTitle': '🏆 Cei mai vorbăreți de pe acest server',
  'premium.title': '💎 **Stare Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Server:** Premium până la {date}',
  'premium.lineServerFree': '🖥️ **Server:** plan gratuit',
  'premium.lineUserActive': '👤 **Tu (Plus):** activ până la {date}',
  'premium.lineUserFree': '👤 **Tu (Plus):** inactiv',
  'premium.getHint':
    'Tot ce folosești astăzi rămâne gratuit. Premium adaugă toate cele 8 efecte de voce, prezența 24/7 în apel, 50 de pronunții personale, /rizz și jocurile premium. Suport: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Abonamentul tău Premium:** {used}/{total} licențe în uz · expiră {date}',
  'premium.passServers': '↳ În uz pe: {servers}',
  'premium.pitch':
    'Încă nu ai Premium. **Vozen Premium** (€3.99/lună pentru 3 servere sau €7.99/lună pentru 8) deblochează pentru tot serverul: toate cele 8 efecte de voce, prezența 24/7 în apel, 50 de pronunții personale (față de 3), comanda /rizz și jocurile premium (Lanț de Cuvinte, Wordle, Șah). **Vozen Plus** (€1.99/lună) îți oferă aceste beneficii personal, pe orice server.',
  'premium.buyHint':
    '▶ **Obține Premium:** {link}\nDupă cumpărare, rulează `/premium activate` pe serverul dorit.',
  'premium.confirmActivate':
    'Folosești **1 din cele {total} licențe Premium** pe **acest server**? Ai **{used}** în uz chiar acum. O poți elibera mai târziu cu `/premium deactivate` — oricum, timpul abonamentului continuă să curgă.',
  'premium.confirmYes': '💎 Folosește o licență',
  'premium.confirmNo': 'Anulează',
  'premium.activateOk':
    '✅ Premium este acum activ pe **acest server** până la {date}. Licențe: **{used}/{total}** în uz.',
  'premium.activateCancelled': 'Anulat — nu s-a folosit nicio licență.',
  'premium.activateTimeout': 'Timp expirat — nu s-a folosit nicio licență.',
  'premium.noPass':
    'Nu ai un abonament Premium activ. Ia unul și îți ajunge în cont — apoi rulează `/premium activate` aici.\n▶ {link}',
  'premium.alreadyActive':
    'Acest server are deja una dintre licențele tale Premium. Nimic de făcut.',
  'premium.noSeats':
    'Toate cele **{total}** licențe Premium ale tale sunt în uz ({servers}). Eliberează una cu `/premium deactivate` acolo, apoi încearcă din nou aici.',
  'premium.needManageGuild':
    'Activarea Premium afectează tot serverul — doar membrii cu **Gestionare server** o pot face. Cere-i unui administrator.',
  'premium.deactivateOk':
    '✅ Am eliberat licența Premium a acestui server. Folosește-o pe alt server cu `/premium activate`.',
  'premium.deactivateNone':
    'Acest server nu are nicio licență Premium de la tine pe care s-o eliberez.',
  'premium.thisServer': 'acest server',
  'grant.denied': '⛔ Această comandă este doar pentru proprietarul botului.',
  'grant.okPremium':
    '✅ I-am acordat lui <@{user}> un **abonament Premium** ({seats} licențe) pentru **{days}** zile — expiră {date}. Îl activează cu `/premium activate`.',
  'grant.okPlus':
    '✅ I-am acordat lui <@{user}> **Vozen Plus** pentru **{days}** zile — expiră {date}.',
  'gencode.done':
    '✅ Am generat **{count}** cod(uri) {plan}, câte **{days}** zile fiecare. Distribuie-le în privat:\n{list}',
  'redeem.okPlus':
    '🎁 Revendicat! Ai primit **Vozen Plus** pentru **{days}** zile — expiră {date}.',
  'redeem.okPremium':
    '🎁 Revendicat! Ai primit un **abonament Premium** ({seats} licențe) pentru **{days}** zile — expiră {date}. Activează-l în serverul tău cu `/premium activate`.',
  'redeem.notFound': '❌ Codul acela nu există. Verifică-l din nou și încearcă iar.',
  'redeem.used': '❌ Codul acela a fost deja revendicat.',
  'redeem.expired': '❌ Codul acela a expirat.',
  'voice.abbrev.added': 'Am notat — {term} va fi citit ca {replacement}.',
  'voice.abbrev.removed': 'Am eliminat abrevierea ta pentru {term}.',
  'voice.abbrev.listHeader': 'Abrevierile tale personale ({count}/{cap} folosite):',
  'voice.abbrev.listEmpty': '(niciuna încă — adaugă una cu /voice abbrev add)',
  'voice.abbrev.capReached':
    'Ai atins limita de {cap} abrevieri personale. Elimină una înainte de a adăuga alta.',
  'voice.abbrev.invalidTerm':
    'Termenul trebuie să fie un singur cuvânt (doar litere și cifre), până la 50 de caractere.',
  'voice.abbrev.emptyReplacement': 'Textul de citit nu poate fi gol.',
  'voice.abbrev.tooLong': 'Textul de citit este prea lung (maximum 200 de caractere).',
  'config.wordEmpty': 'Cuvântul nu poate fi gol.',
  'config.blocked': 'Blocat: {word}.',
  'config.blockLimit':
    'Acest server are deja maximul de {max} cuvinte blocate. Elimină unul înainte de a adăuga altul.',
  'config.unblocked': 'Deblocat: {word}.',
  'config.pronListHeader': 'Dicționar de pronunție:',
  'config.pronEmptyValue': '(gol)',
  'config.listEmpty': '(niciunul)',
  'config.termEmpty': 'Termenul nu poate fi gol.',
  'config.pronEmpty': 'Pronunția nu poate fi goală.',
  'config.pronSet': 'Am notat — {term} va fi citit ca {replacement}.',
  'config.pronRemoved': 'Am eliminat pronunția pentru {term}.',
  'config.channelWrongType': 'Alege un canal text (nu un canal de voce sau o categorie).',
  'config.channelNoAccess': 'Nu pot vedea {channel} — te rog verifică permisiunile mele acolo.',
  'config.channelSet':
    'Canalul de citire automată setat la {channel}. Mai departe: asigură-te că citirea automată e activă cu `/config auto-read active:true`.',
  'config.autoreadOn': 'Citirea automată este acum **activă**.',
  'config.autoreadOff': 'Citirea automată este acum **oprită**.',
  'config.maxCharsRange':
    'Valoarea pentru numărul maxim de caractere trebuie să fie între 1 și 2000.',
  'config.maxCharsSet': 'Numărul maxim de caractere per mesaj setat la {value}.',
  'config.rateLimitRange': 'Valoarea limitei de rată trebuie să fie între 1 și 120.',
  'config.rateLimitSet': 'Limita de rată setată la {value} mesaje pe minut.',
  'config.roleSet': 'Citirea automată este acum limitată la membrii cu {role}.',
  'config.roleCleared': 'Restricția de rol a fost eliminată — acum oricine poate fi citit.',
  'config.enabledOn': 'TTS este acum **activ** pentru acest server.',
  'config.enabledOff': 'TTS este acum **oprit** pentru acest server.',
  'config.xsaidOn':
    'Vozen va anunța de acum **cine a vorbit** înainte de fiecare mesaj (ex.: „Alex a spus salut”). Oprește cu `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **nu va mai** anunța cine a vorbit — citește doar mesajul.',
  'config.autojoinOn':
    '✅ Auto-intrare **activă** — Vozen intră în canalul tău de voce când scrii în canalul TTS.',
  'config.autojoinOff': 'Auto-intrare **oprită** — folosește `/join` ca să aduci Vozen în voce.',
  'config.stayOn':
    '✅ 24/7 în apel **activ** — Vozen rămâne în canalul de voce chiar și când se golește și revine după reporniri. 💎 Necesită Premium ca să aibă efect (cumpără sau folosește `/redeem` pentru un cod, apoi `/premium activate`).',
  'config.stayOff':
    '24/7 în apel **oprit** — Vozen pleacă atunci când canalul de voce se golește (implicit).',
  'config.readBotsOn': '✅ Vozen va citi de acum și mesajele de la **alți boți și webhook-uri**.',
  'config.readBotsOff':
    'Vozen va **ignora** alți boți și webhook-uri (sunt citiți doar oameni reali).',
  'config.textInVoiceOn': '✅ Vozen va citi și **chatul text din canalul său de voce**.',
  'config.textInVoiceOff':
    'Vozen **nu** va citi chatul text al canalului de voce (doar canalul TTS).',
  'config.antispamOn':
    '✅ Anti-spam **activ** — Vozen nu citește mesajele spam (repetarea în masă a unui cuvânt sau același mesaj mare postat iar și iar).',
  'config.antispamOff': 'Anti-spam **oprit** — Vozen citește fiecare mesaj ca de obicei.',
  'config.streaksOn':
    '✅ Anunțuri de serie **active** — Vozen afișează un mesaj de serie 🔥 prima dată când fiecare persoană vorbește în fiecare zi.',
  'config.streaksOff':
    'Anunțuri de serie **oprite** — Vozen tot urmărește seriile (vezi `/top-speakers`), dar nu le anunță.',
  'config.soundboardOn': 'Soundboard **activ** — oricine poate reda clipuri cu `/sound`.',
  'config.soundboardOff': 'Soundboard **oprit** — `/sound` este dezactivat pe acest server.',
  'config.votePromosLabel': 'Notificări despre recompensa top.gg + Vozen Support',
  'config.greetOn': '✅ Voi saluta oamenii pe nume când intră în canalul de voce.',
  'config.greetOff': '🔇 **Nu** voi saluta oamenii când intră în canalul de voce.',
  'config.greetLangSet': '✅ Limba salutului de intrare setată la **{language}**.',
  'config.defaultVoiceSet':
    '✅ Vocea implicită a serverului setată la **{name}**. Membrii fără voce proprie o vor auzi pe aceasta. (id: `{model}`)',
  'config.reset':
    'Configurația a fost readusă la valorile implicite. Lista ta de blocare și pronunțiile au fost păstrate.',
  'config.showTitle': '**Configurația serverului**',
  'config.showChannel': 'Canal TTS: {value}',
  'config.showAutoread': 'Citire automată: {value}',
  'config.showRole': 'Rol: {value}',
  'config.showEnabled': 'Activat: {value}',
  'config.showXsaid': 'Anunță vorbitorul (xsaid): {value}',
  'config.showAutojoin': 'Auto-intrare: {value}',
  'config.showReadBots': 'Citește boți/webhook-uri: {value}',
  'config.showTextInVoice': 'Text-în-voce: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': 'Salut la intrare: {value} ({language})',
  'config.showVoice': 'Voce implicită: {value}',
  'config.showMaxChars': 'Caractere maxime: {value}',
  'config.showRateLimit': 'Limită de rată: {value}/min',
  'config.showBlocklist': 'Listă de blocare: {count} cuvinte',
  'config.showPronunciation': 'Pronunții: {count} intrări',
  'config.valueNone': '(niciunul)',
  'config.valueAny': 'oricine',
  'config.valueAutoDetect': '(detectare automată)',
  'config.on': 'activ',
  'config.off': 'oprit',
  'config.language.set': 'Limba interfeței setată la {language}.',
  'config.language.unsupported': 'Limba aceea nu este încă acceptată.',
  'setup.noChannel':
    'N-am putut determina ce canal să folosesc. Indică un canal text în opțiunea "channel".',
  'setup.channelWrongType':
    'Canalul de citire automată trebuie să fie un canal text (nu un canal de voce sau o categorie). Indică unul în opțiunea "channel".',
  'setup.done': '**Totul e gata — Vozen e pregătit.**',
  'setup.channelLine': 'Canal de citire automată: {channel}',
  'setup.autoreadOn': 'Citire automată: activă',
  'setup.permsHeader': '**Permisiuni:**',
  'setup.permView': 'ViewChannel (vede canalul text)',
  'setup.permSend': 'SendMessages (postează în canalul text)',
  'setup.permConnect': 'Connect (intră în canalul de voce)',
  'setup.permSpeak': 'Speak (vorbește în canalul de voce)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — lipsește',
  'setup.permUnchecked': '⏳ {label} — încă neverificat (îl verific la /join)',
  'setup.fixHint':
    'Ca să repari ce lipsește: în setările serverului deschide rolul lui Vozen (sau permisiunile canalului) și activează elementele marcate cu ❌.',
  'setup.voiceUncheckedNote':
    'Nu ești într-un canal de voce, așa că n-am putut verifica încă Connect/Speak — le verific când rulezi /join.',
  'setup.allGood': 'Totul e pregătit. Intră într-un canal de voce și rulează /join.',
  'setup.joinedVoice': 'Am intrat și eu în {channel} — nu trebuie să rulezi /join.',
  'setup.readyTalk':
    'Totul e pregătit. Scrie în canalul de citire automată și îl citesc cu voce tare.',
  'setup.membersHeader': '**Spune-le membrilor tăi (fluxul în 3 pași):**',
  'setup.membersBody':
    '1) Intră într-un canal de voce\n2) Rulează /join ca să intru cu tine\n3) Scrie în acest canal (sau folosește /tts) și citesc cu voce tare\nLista completă de comenzi: /help',
  'stats.title': '**Statistici Vozen**',
  'stats.messagesSpoken': 'Mesaje rostite: {value}',
  'stats.cacheHits': 'Accesări din cache: {value}',
  'stats.cacheMisses': 'Rateuri de cache: {value}',
  'stats.synthErrors': 'Erori de sinteză: {value}',
  'stats.synthLatency': 'Latență de sinteză: p50 {p50}ms / p95 {p95}ms ({count} mostre)',
  'stats.voiceDrops': 'Deconectări de voce: {value}',
  'stats.voiceReconnects': 'Reconectări: {value}',
  'stats.votes': 'Voturi top.gg: {value}',
  'stats.activePlayers': 'Playere active: {value}',
  'stats.servers': 'Servere: {value}',
  'stats.uptime': 'Timp de funcționare: {value}s',
  'speak.emptyMessage': 'Acel mesaj nu are text de citit cu voce tare.',
  'uptime.text': '🟢 Vozen este online de **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistici**',
  'botstats.servers': 'Servere: **{value}**',
  'botstats.voiceSessions': 'Sesiuni de voce acum: **{value}**',
  'botstats.messagesSpoken': 'Mesaje rostite: **{value}**',
  'botstats.uptime': 'Timp de funcționare: **{value}**',
  'invite.noClientId':
    'Linkul de invitație al lui Vozen nu este încă configurat (CLIENT_ID lipsește). Anunță administratorul botului.',
  'invite.link': 'Adaugă Vozen pe serverul tău:\n{url}',
  'vote.noClientId':
    'Linkul de vot al lui Vozen nu este încă configurat (CLIENT_ID lipsește). Anunță administratorul botului.',
  'vote.link':
    'Votează Vozen (gratuit, la fiecare 12h) și ajută mai mulți oameni să-l descopere:\n{url}\nDacă acest cont nu a revendicat niciodată recompensa, primește **48 de ore de Vozen Plus**, o singură dată per cont.',
  'invite.button': 'Adaugă Vozen',
  'vote.button': 'Votează pe top.gg',
  'vote.upsell':
    '🗳️ Dacă acest cont nu a revendicat niciodată recompensa, primește **48 de ore de Vozen Plus**, o singură dată per cont. {url}',
  'vote.cooldownStatus':
    '🗳️ Acest cont a folosit deja recompensa unică pentru vot. Poți vota în continuare pentru a susține Vozen, dar nu vei primi mai mult Plus.',
  'help.title': 'Vozen — scrie-l, ascultă-l.',
  'help.embedTitle': 'Vozen — Comenzi',
  'help.intro':
    'Vozen îți citește textul cu voce tare în canalele de voce — voci neurale gratuite, zeci de limbi.',
  'help.quickStartTitle': 'Start rapid (3 pași)',
  'help.quickStartBody':
    '1) Intră într-un canal de voce, apoi rulează /join\n2) Scrie în canalul text (sau folosește /tts Salut tuturor!)\n3) (opțional) Alege o voce cu /voice set',
  'help.groupStarted': 'Primii pași',
  'help.groupStartedBody':
    '• /join — intru în canalul tău de voce\n• /leave — ies din canalul de voce\n• /tts <text> — citesc textul cu voce tare · ex. /tts Salut tuturor!\n• /skip — sar peste ce citesc acum',
  'help.groupVoice': 'Vocea ta',
  'help.groupVoiceBody':
    '• /voice set <model> — alege-ți vocea · ex. /voice set en_US-amy-medium\n• /voice list — vezi vocile disponibile\n• /voice preview — ascultă o mostră a vocii tale\n• /voice reset — revino la vocea implicită\n• /voice opt-out · /voice opt-in — dezactivează / activează citirea automată pentru tine\n• /voice abbrev add|remove|list — argou personal, citit cum vrei tu (până la 10)',
  'help.groupFun': 'Distracție',
  'help.groupFunBody':
    '• /joke — spun o glumă scurtă (alege o limbă + râs opțional) · ex. /joke English\n• /laugh — râd cu voce tare în vocea ta curentă',
  'help.groupAdmin': 'Administrare server (necesită Gestionare server)',
  'help.groupAdminBody':
    '• /setup — configurare ghidată într-un singur pas · rulează asta prima dată\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · ex. /config tts-channel #general\n• /stats — statisticile botului',
  'help.groupMore': 'Mai multe',
  'help.groupMoreBody':
    '• /invite — adaugă Vozen pe un alt server\n• /vote — votează Vozen pe top.gg\n• /help — arată acest ajutor',
  'help.footer': 'Nou pe aici? Rulează {command} ca să începi.',
  'help.support': '🛟 Ai nevoie de ajutor sau vrei să raportezi o problemă? {url}',
  'help.source': '📄 Sursă deschisă (AGPL-3.0) — obține exact codul sursă care rulează aici: {url}',
  'welcome.title': 'Mulțumim că ai adăugat Vozen! 👋',
  'welcome.description':
    'Vozen îți citește conversația cu voce tare în canalele de voce — scrie-l, ascultă-l.\n\n**Începe într-un singur pas:** rulează {setup} și configurez citirea automată și intru în canalul tău de voce.\n\nAi nevoie de lista completă de comenzi? Rulează {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Cum o folosesc membrii (3 pași)',
  'welcome.stepsBody':
    '1) Intră într-un canal de voce\n2) Rulează /join ca să intru cu tine\n3) Scrie în canalul text (sau folosește /tts) și citesc cu voce tare\nLista completă de comenzi: /help',
  'welcome.footer': 'Vozen — scrie-l, ascultă-l.',
  'welcome.tagline': 'Voce neurală naturală — gratuit pentru totdeauna, fără plată.',
  'game.start.needVoice':
    'Acesta este un **joc vocal** — intră într-un canal de voce și rulează mai întâi /join, apoi pornește-l.',
  'game.start.alreadyActive':
    'Un joc rulează deja în <#{channel}>. Termină-l (sau folosește `/game stop`) înainte de a începe altul.',
  'game.start.premiumLocked':
    '🔒 **{game}** este un joc Premium (costă putere de calcul reală). Vezi `/premium`.',
  'game.start.started': '🎮 Începe **{game}**! Fii atent la canal — mult noroc!',
  'game.start.startedThread':
    '🎮 **{game}** a început în <#{channel}> — intrați acolo! Firul se șterge singur când jocul se termină.',
  'game.thread.winner': '🏆 {winner} a câștigat jocul!',
  'game.thread.ended': '🎮 Jocul s-a terminat.',
  'game.unknownGame': 'Nu cunosc jocul acela. Alege unul din listă.',
  'game.stop.ok': '🛑 Am oprit jocul curent.',
  'game.stop.none': 'Nu rulează niciun joc în acest moment.',
  'game.list.title': '🎮 **Jocuri** — pornește unul cu `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Clasament** — cei mai buni jucători de pe acest server:',
  'game.leaderboard.empty': 'Încă nu s-a jucat niciun joc. Fii primul — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pct ({wins} victorii)',
  'game.finish.title': '🏁 **Joc terminat!** Scoruri finale:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Joc terminat — nimeni n-a punctat de data asta. Data viitoare!',
  'game.finish.winnerVoice': '{user} câștigă!',
  'game.guessLanguage.name': 'Ghicește Limba',
  'game.guessLanguage.desc':
    'Citesc o propoziție într-o limbă aleatorie — primul care o numește câștigă punctul.',
  'game.guessLanguage.intro':
    '🗣️ **Ghicește Limba** — voi citi {rounds} propoziții. Scrie ce limbă auzi. Cel mai rapid răspuns corect câștigă fiecare rundă!',
  'game.guessLanguage.round': '🎧 Runda {n}/{total} — ascultă…',
  'game.guessLanguage.correct': '✅ **{user}** a ghicit — era **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Timp! Era **{language}**.',
  'game.guessLanguage.noLanguages':
    'Nu am suficiente voci instalate ca să joc asta. Cere-i unui administrator să adauge mai multe voci.',
  'game.math.name': 'Calcul Mintal',
  'game.math.desc': 'Spun un calcul cu voce tare — primul care scrie răspunsul câștigă.',
  'game.math.intro':
    '🔢 **Calcul Mintal** — {rounds} calcule. Ascultă și scrie răspunsul cât de repede poți!',
  'game.math.round': '🧮 Runda {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** a nimerit-o — răspunsul era **{answer}**!',
  'game.math.timeout': '⏱️ Timp! Răspunsul era **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'ori',
  'game.skipCount.name': 'Numărul Lipsă',
  'game.skipCount.desc':
    'Număr cu voce tare, dar sar peste un număr — primul care îl prinde câștigă.',
  'game.skipCount.intro':
    '🔢 **Numărul Lipsă** — număr, dar sar peste unul. Scrie numărul lipsă! ({rounds} runde)',
  'game.skipCount.round': '👂 Runda {n}/{total} — peste ce număr am sărit?',
  'game.skipCount.correct': '✅ **{user}** l-a prins — am sărit peste **{answer}**!',
  'game.skipCount.timeout': '⏱️ Timp! Am sărit peste **{answer}**.',
  'game.spelling.name': 'Concurs de Ortografie',
  'game.spelling.desc': 'Spun un cuvânt — primul care îl scrie corect câștigă.',
  'game.spelling.intro':
    '✍️ **Concurs de Ortografie** — voi spune {rounds} cuvinte. Scrie fiecare corect!',
  'game.spelling.round': '🗣️ Runda {n}/{total} — scrie cuvântul pe care îl spun…',
  'game.spelling.correct': '✅ **{user}** a scris corect **{word}**!',
  'game.spelling.timeout': '⏱️ Timp! Cuvântul era **{word}**.',
  'game.spelling.empty': 'Încă nu am o listă de cuvinte pentru limba vocii acestui server.',
  'game.spellOut.name': 'Cuvântul pe Litere',
  'game.spellOut.desc':
    'Silabisesc un cuvânt literă cu literă — primul care scrie cuvântul întreg câștigă.',
  'game.spellOut.intro':
    '🔡 **Cuvântul pe Litere** — silabisesc {rounds} cuvinte literă cu literă. Scrie cuvântul întreg!',
  'game.spellOut.round': '🔤 Runda {n}/{total} — ascultă literele…',
  'game.spellOut.correct': '✅ **{user}** a ghicit — **{word}**!',
  'game.spellOut.timeout': '⏱️ Timp! Se silabisea **{word}**.',
  'game.fastSpeech.name': 'Vorbire Rapidă',
  'game.fastSpeech.desc': 'Citesc o propoziție super repede — primul care scrie ce am zis câștigă.',
  'game.fastSpeech.intro':
    '💨 **Vorbire Rapidă** — {rounds} propoziții la o viteză ridicolă. Scrie ce auzi!',
  'game.fastSpeech.round': '⚡ Runda {n}/{total} — vine, repede!',
  'game.fastSpeech.correct': '✅ **{user}** a descifrat: „{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Timp! Era: „{phrase}”',
  'game.fastSpeech.empty': 'Încă nu am fraze pentru limba vocii acestui server.',
  'game.accentSwap.name': 'Accent Caraghios',
  'game.accentSwap.desc': 'Spun un cuvânt cu accent străin — primul care îl scrie câștigă.',
  'game.accentSwap.intro':
    '🎭 **Accent Caraghios** — {rounds} cuvinte spuse cu accentul greșit. Scrie cuvântul!',
  'game.accentSwap.round': '🌍 Runda {n}/{total} — ce cuvânt încerc să spun?',
  'game.accentSwap.correct': '✅ **{user}** a ghicit — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Timp! Cuvântul era **{word}**.',
  'game.reflexes.name': 'Reflexe',
  'game.reflexes.desc':
    'Fac numărătoarea inversă, apoi strig START — primul care scrie după aceea câștigă. Nu te grăbi!',
  'game.reflexes.intro':
    '⚡ **Reflexe** — {rounds} runde. Când strig **START**, scrie orice cât de repede poți. Scrii înainte de START și e start greșit!',
  'game.reflexes.ready': '🚦 Runda {n}/{total} — pregătește-te…',
  'game.reflexes.countdown': 'trei… doi… unu…',
  'game.reflexes.go': '🟢 **START!!!**',
  'game.reflexes.goVoice': 'Start!',
  'game.reflexes.tooSoon': '🔴 **{user}** s-a pripit — prea devreme!',
  'game.reflexes.win': '⚡ **{user}** este cel mai rapid! Punct!',
  'game.reflexes.tooSlow': '😴 Nimeni n-a reacționat la timp. Următoarea!',
  'game.headsOrTails.name': 'Cap sau Pajură',
  'game.headsOrTails.desc':
    'Ghicește moneda — scrie heads sau tails înainte s-o arunc. Cel care ghicește cel mai mult câștigă!',
  'game.headsOrTails.intro':
    '🪙 **Cap sau Pajură** — {rounds} runde. În fiecare rundă, scrie `heads` sau `tails` înainte să arunc moneda. 1 punct pentru fiecare ghicire corectă!',
  'game.headsOrTails.introVoice': 'Hai să jucăm cap sau pajură!',
  'game.headsOrTails.round': '🪙 Runda {n}/{total} — `heads` sau `tails`? Scrie-ți alegerea!',
  'game.headsOrTails.roundVoice': 'Cap… sau pajură?',
  'game.headsOrTails.heads': 'cap',
  'game.headsOrTails.tails': 'pajură',
  'game.headsOrTails.resultVoice': 'Este {side}!',
  'game.headsOrTails.winners': 'Este **{side}**! Punct pentru: {users}',
  'game.headsOrTails.noWinners': 'Este **{side}**! Nimeni n-a ghicit — fără puncte.',
  'game.vozenSays.name': 'Vozen Zice',
  'game.vozenSays.desc':
    'Ascultă doar când ordinul începe cu „Vozen zice”. Cazi în capcană și ești prins!',
  'game.vozenSays.intro':
    '🫡 **Vozen Zice** — {rounds} ordine. Fă-o DOAR dacă încep cu **„Vozen zice”**. Altfel, nu mișca!',
  'game.vozenSays.prefix': 'Vozen zice',
  'game.vozenSays.verb': 'scrieți',
  'game.vozenSays.real': '🗣️ Runda {n}/{total} — „{command}”',
  'game.vozenSays.trap': '🗣️ Runda {n}/{total} — „{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** a ascultat primul — punct!',
  'game.vozenSays.caught': '🔴 **{user}** — n-am zis Vozen zice! Prins!',
  'game.vozenSays.nobody': '😴 Nimeni n-a ascultat **{word}** la timp. Următoarea!',
  'game.vozenSays.trapCleared': '😌 Era o capcană — bine reperat, nimeni n-a căzut în **{word}**.',
  'game.roulette.name': 'Ruleta Adevăr sau Provocare',
  'game.roulette.desc':
    'Învârt și citesc cu voce tare o provocare de tip adevăr sau provocare. Rulează din nou pentru alta.',
  'game.roulette.header': '🎯 **Roata zice…**',
  'game.hangman.name': 'Spânzurătoarea',
  'game.hangman.desc': 'Ghicește cuvântul literă cu literă — 6 greșeli și s-a terminat.',
  'game.hangman.intro':
    '🪢 **Spânzurătoarea** — scrie câte o literă ca să ghicești cuvântul. Poți încerca și cuvântul întreg!',
  'game.hangman.hit': '🟢 **{user}** a găsit **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — niciun **{letter}**.',
  'game.hangman.wrongLetters': 'Greșite: {letters}',
  'game.hangman.win': '🎉 **{user}** a rezolvat — **{word}**!',
  'game.hangman.lose': '💀 Fără încercări! Cuvântul era **{word}**.',
  'game.hangman.idle': '🕹️ Joc întrerupt (nu joacă nimeni). Cuvântul era **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Ghicește cuvântul de 5 litere. 🟩 loc corect, 🟨 loc greșit, ⬛ nu e în cuvânt. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — scrie un cuvânt de 5 litere. Împărțiți {max} încercări. 🟩 loc corect · 🟨 loc greșit · ⬛ nu e în cuvânt.',
  'game.wordle.guess': '🔤 **{user}** a încercat — **{left}** încercări rămase',
  'game.wordle.inWord': '🟢 în cuvânt: {letters}',
  'game.wordle.out': '🚫 în afară: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** a ghicit din {n} — **{word}**!',
  'game.wordle.lose': '💀 Fără încercări! Cuvântul era **{word}**.',
  'game.wordle.idle': '🕹️ Joc întrerupt (nu joacă nimeni). Cuvântul era **{word}**.',
  'game.tictactoe.name': 'X și 0',
  'game.tictactoe.desc':
    'Doi jucători — scrie un număr de la 1 la 9 ca să-ți pui semnul. Trei în linie câștigă.',
  'game.tictactoe.intro':
    '⭕ **X și 0** — primii doi jucători care mută sunt ❌ și ⭕ (❌ începe). Scrie un număr de la 1 la 9 ca să joci în căsuță.',
  'game.tictactoe.turn': 'Rândul: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, este rândul lui **{mark}**.',
  'game.tictactoe.taken': '🚫 Căsuța {cell} este ocupată — alege alta.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) câștigă!',
  'game.tictactoe.draw': '🤝 Egalitate!',
  'game.tictactoe.idle': '🕹️ Joc terminat (nu joacă nimeni).',
  'game.chess.name': 'Șah',
  'game.chess.desc':
    'Doi jucători — reguli reale de șah (șah, rocadă, promovare…). Scrie o mutare de tipul „e4” sau „Nf3”. 💎 Premium.',
  'game.chess.intro':
    '♟️ **Șah** — primii doi jucători care mută sunt Alb și Negru (Alb începe). Scrie o mutare în notație algebrică („e4”, „Nf3”, „O-O”) sau prin coordonate („e2e4”). Scrie „resign” ca să te predai.',
  'game.chess.white': 'Alb',
  'game.chess.black': 'Negru',
  'game.chess.seats': '⚪ Alb: **{white}** · ⚫ Negru: **{black}**',
  'game.chess.turn': '{move} — rândul: **{color}**',
  'game.chess.check': '♟️ Șah!',
  'game.chess.notYourTurn': '⏳ **{user}**, este rândul lui **{color}**.',
  'game.chess.illegalMove': '🚫 „{move}” nu e o mutare validă — încearcă din nou.',
  'game.chess.checkmate': '🏆 Șah-mat ({move})! **{user}** câștigă!',
  'game.chess.draw': '🤝 Egalitate ({move})!',
  'game.chess.resigned': '🏳️ **{user}** s-a predat — **{winner}** câștigă!',
  'game.chess.idle': '🕹️ Joc terminat (nu joacă nimeni).',
  'game.wordChain.name': 'Lanț de Cuvinte',
  'game.wordChain.descr':
    'Lanț de cuvinte pe rânduri într-o singură limbă: spune un cuvânt care începe cu ultima literă a celui anterior. 2 vieți, fără repetări, iar ceasul accelerează. Alege limba cu opțiunea `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Lanț de Cuvinte nu este disponibil în **{lang}** în acest moment (lipsește lista de cuvinte).',
  'game.wordChain.lobby':
    '🔗 **Lanț de Cuvinte** în **{lang}**! Scrie orice în acest canal în **{seconds}s** ca să te alături.',
  'game.wordChain.notEnough': '😴 Nu s-au alăturat destui jucători (minimum 2). Joc anulat.',
  'game.wordChain.begin':
    '🚀 Începe! Jucători: {players}. Fiecare cuvânt trebuie să înceapă cu ultima literă a celui de dinainte.',
  'game.wordChain.turn':
    '**{name}**, e rândul tău! Un cuvânt în **{lang}** care începe cu **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — următoarea literă: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Trebuie să înceapă cu **{letter}**.',
  'game.wordChain.bad.short': '📏 Prea scurt — cel puțin **{min}** litere.',
  'game.wordChain.bad.repeated': '🔁 Cuvântul acela a fost deja folosit.',
  'game.wordChain.bad.word': '📖 Nu se află în dicționar.',
  'game.wordChain.bad.latin': '🔤 Contează doar literele de la A la Z.',
  'game.wordChain.timeout': '⏰ **{name}** a rămas fără timp! Au mai rămas {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** este eliminat!',
  'game.wordChain.winner': '🏆 **{name}** câștigă lanțul! ({chain} cuvinte)',
  'game.stats.none': 'Încă n-ai jucat niciun joc. Încearcă `/game play`!',
  'game.stats.body':
    '🎮 **Statisticile tale** — **{points}** puncte · **{wins}** victorii · {rank}',
  'game.stats.rank': 'locul **#{rank}** din {total}',
  'game.stats.unranked': 'încă neclasat',
  'game.pickPrompt': '🎮 Ce joc vrei să joci? Alege unul:',
  'game.pickPlaceholder': 'Alege un joc…',
  'game.pickTimeout': '⏰ Niciun joc ales — rulează `/game play` din nou când ești gata.',
  'pron.listHeader': '🗣️ **Pronunțiile tale** ({count}/{limit}):',
  'pron.listEmpty': 'Încă nu ai niciuna — adaugă una cu `/pronunciation add`.',
  'pron.set': '✅ Salvat! Când **tu** scrii „{term}”, voi spune „{replacement}”.',
  'pron.removed': '🗑️ Am eliminat „{term}”.',
  'pron.notFound':
    'Nu ai nicio pronunție pentru „{term}”. Vezi-le pe ale tale cu `/pronunciation list`.',
  'pron.empty': 'Cuvântul și modul de a-l spune nu pot fi goale.',
  'pron.limitHit':
    '🔒 Ai atins limita de **{limit}** pronunții. Elimină una cu `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus sau Premium o crește la **50** → {url}',
  'pron.modalTitle': 'Învață Vozen o pronunție',
  'pron.modalTerm': 'Cuvântul (așa cum îl scriu oamenii)',
  'pron.modalSay': 'Cum ar trebui să-l spună Vozen',
  'spron.listHeader': '🗣️ **Pronunții server** ({count}/{limit}) — se aplică tuturor:',
  'spron.listEmpty': 'Încă niciuna — adaugă una cu `/server-pronunciation add`.',
  'spron.set': '✅ Salvat pentru tot serverul! „{term}” → „{replacement}”.',
  'spron.removed': '🗑️ Am eliminat „{term}” din server.',
  'spron.notFound': 'Serverul nu are nicio pronunție pentru „{term}”.',
  'spron.limitHit':
    '🔒 Serverul a atins limita de **{limit}** pronunții. Elimină una cu `/server-pronunciation remove`.',
  'spron.modalTitle': 'Pronunție de server',
  'spron.modalSay': 'Cum o spune Vozen pentru toți',
  'rand.selectPrompt': '🎲 **Randomizer** — dintre câte opțiuni vrei să aleg?',
  'rand.selectPlaceholder': 'Numărul de opțiuni…',
  'rand.selectOption': '{n} opțiuni',
  'rand.filling': '📝 Completează formularul care tocmai s-a deschis!',
  'rand.modalTitle': 'Randomizer — {amount} opțiuni',
  'rand.modalOption': 'Opțiunea {n}',
  'rand.needTwo': 'Dă-mi cel puțin 2 opțiuni separate prin virgule (ex.: „pizza, sushi”).',
  'rand.result': 'Dintre {count} opțiuni, aleg… **{winner}**!',
  'rand.speak': 'Aleg… {winner}!',
  'rand.notInVoice': '_(intră într-un canal de voce cu mine și data viitoare o spun cu voce tare)_',
  'rand.timeout': '⏰ Nimic ales — rulează `/randomizer` din nou când ești gata.',
};
