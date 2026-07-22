export default {
  'error.generic': 'Coś poszło nie tak. Spróbuj ponownie.',
  'stt.guildOnly': 'Transkrypcja działa tylko na serwerze.',
  'stt.noManage':
    'Potrzebujesz uprawnienia **Zarządzanie serwerem**, aby uruchomić lub zatrzymać transkrypcję.',
  'stt.notPremium':
    '🎙️ Transkrypcja na żywo to funkcja **Premium**. Zobacz `/premium info`, aby odblokować ją dla tego serwera.',
  'stt.unavailable':
    'Transkrypcja jest niedostępna na tej instancji (silnik mowy-na-tekst nie jest zainstalowany).',
  'stt.notInVoice':
    'Nie jestem na kanale głosowym — dołącz do jakiegoś i najpierw uruchom `/join`, a potem rozpocznij transkrypcję.',
  'stt.alreadyRunning':
    'Transkrypcja już działa na tym serwerze. Najpierw użyj `/transcribe stop`.',
  'stt.atCapacity':
    'Zbyt wiele transkrypcji działa teraz na wszystkich serwerach. Spróbuj ponownie za chwilę.',
  'stt.noChannel':
    'Nie mogę publikować transkrypcji na tym kanale. Spróbuj uruchomić polecenie ze zwykłego kanału tekstowego.',
  'stt.started':
    '✅ Transkrypcja rozpoczęta. Każdy, kto naciśnie **Zgoda** w ogłoszeniu, będzie transkrybowany na ten kanał.',
  'stt.startFailed':
    'Nie udało się rozpocząć transkrypcji (nie udało się opublikować ogłoszenia). Cofnąłem wszystko — nic nie jest nagrywane. Spróbuj ponownie.',
  'stt.announceStart':
    '🎙️ **Transkrypcja na żywo jest WŁĄCZONA na tym kanale.** Transkrybowane są tylko osoby, które wyrażą zgodę — naciśnij przycisk poniżej, aby pozwolić na zapisywanie tutaj twojej wypowiedzi. W każdej chwili możesz ją wycofać poleceniem `/transcribe revoke`.',
  'stt.consentBtn': 'Zgoda na transkrypcję',
  'stt.consentThanks':
    '✅ Dzięki — twoja wypowiedź będzie teraz transkrybowana na tym serwerze. Wycofaj zgodę w każdej chwili poleceniem `/transcribe revoke`.',
  'stt.stopped': '🛑 Transkrypcja zatrzymana.',
  'stt.notRunning': 'Transkrypcja nie działa na tym serwerze.',
  'stt.announceStop': '🛑 **Transkrypcja na żywo jest teraz WYŁĄCZONA.** Przestałem słuchać.',
  'stt.revoked':
    '✅ Zgoda wycofana — nie będziesz już transkrybowany na tym serwerze. (Już opublikowane wiadomości pozostają; usuń je na Discordzie, jeśli chcesz.)',
  'stt.revokeNone':
    'Nie wyraziłeś zgody na transkrypcję na tym serwerze, więc nie było czego wycofywać.',
  'privacy.eraseConfirm':
    '⚠️ To trwale usuwa **wszystkie** twoje dane Vozen na każdym serwerze: ustawienia głosu, wymawiany pseudonim, osobiste skróty i wymowy, zapisane urodziny, wyniki gier, statystyki mówienia oraz rezygnację. **Tego nie można cofnąć.** Na pewno?',
  'privacy.erasePremiumNote':
    '_Uwaga: twój opłacony Premium/Plus i jego historia zakupu są zachowywane — należą do ciebie i do wymaganej prawem dokumentacji finansowej. Aby zakończyć Premium, pozwól mu wygasnąć lub skontaktuj się z pomocą._',
  'privacy.eraseYes': 'Usuń wszystko',
  'privacy.eraseNo': 'Anuluj',
  'privacy.eraseCancelled': 'Anulowano — nic nie zostało usunięte.',
  'privacy.eraseDone': '✅ Gotowe. Wszystkie twoje dane osobowe zostały trwale usunięte.',
  'error.needManageGuild': 'Potrzebujesz uprawnienia **Zarządzanie serwerem**, aby to zrobić.',
  'join.needVoiceChannel': 'Najpierw dołącz do kanału głosowego, a potem użyj /join.',
  'join.missingPerms': 'Potrzebuję uprawnień **Połącz** i **Mów** na kanale {channel}.',
  'join.joined':
    '✅ Jestem na kanale {channel}! Następny krok: napisz `/tts cześć`, a przeczytam to na głos. Chcesz, żebym automatycznie czytał kanał? Uruchom /setup.',
  'join.joinedAutoread':
    '✅ Jestem na kanale {channel}! Wszystko gotowe. Pisz na kanale automatycznego czytania, a przeczytam to na głos. → {readChannel}',
  'leave.left': 'Opuściłem kanał głosowy. Do zobaczenia następnym razem!',
  'skip.notInVoice':
    'Nie jestem jeszcze na kanale głosowym — dołącz do jakiegoś i najpierw użyj /join, potem spróbuj ponownie.',
  'skip.skipped': 'Pominięto.',
  'skip.nothing': 'Nic teraz nie jest odtwarzane.',
  'shutup.notInVoice':
    'Nie jestem jeszcze na kanale głosowym — dołącz do jakiegoś i najpierw uruchom /join.',
  'shutup.nothing': 'Nic teraz nie jest odtwarzane.',
  'shutup.done': '🤐 Dobra, milknę — wyczyściłem całą kolejkę.',
  'tts.notInVoice':
    'Nie jestem jeszcze na kanale głosowym — dołącz do jakiegoś i użyj /join, potem spróbuj ponownie.',
  'tts.nothingToRead': 'Nie ma tam nic do przeczytania — wyślij mi jakiś tekst.',
  'tts.nothingAfterClean':
    'Po uporządkowaniu nie zostało nic do przeczytania — spróbuj zwykłego tekstu (litery lub słowa).',
  'tts.tooFast': 'Hej, zwolnij trochę — spróbuj ponownie za chwilę.',
  'tts.blocked': 'Ten tekst zawiera zablokowane słowo, więc go pominąłem.',
  'tts.queued': 'Jasne — jest w kolejce.',
  'tts.busy': 'Jestem teraz zajęty — spróbuj ponownie za chwilę.',
  'voice.unknownModel': 'Nie znam tego głosu — sprawdź /voice list.',
  'voice.badSpeed':
    'Prędkość musi mieścić się w przedziale od 0.5 do 2.0 (1.0 to normalna). Spróbuj `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Twój głos to teraz **{name}** przy {speed}×. Napisz `/tts cześć`, aby go usłyszeć. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Konfiguracja głosu** — wybierz opcje poniżej, a następnie naciśnij **Zapisz**. Do tego czasu nic się nie zmieni.',
  'voice.config.summary': 'Bieżący wybór: **{voice}** · silnik **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Język…',
  'voice.config.pickVoice': 'Głos…',
  'voice.config.pickEngine': 'Silnik…',
  'voice.config.pickSpeed': 'Prędkość…',
  'voice.config.more': '▼ Więcej języków',
  'voice.config.engDefault': 'Domyślny (lokalny)',
  'voice.config.save': 'Zapisz',
  'voice.config.cancel': 'Anuluj',
  'voice.config.cancelled': 'Konfiguracja anulowana — nic się nie zmieniło.',
  'voice.config.expired': 'Panel wygasł — uruchom ponownie `/voice config`, aby kontynuować.',
  'voice.listHeader': 'Dostępne głosy:',
  'voice.listEmpty': '(brak zainstalowanych)',
  'voice.reset':
    '✅ Twój głos wrócił do domyślnego. W każdej chwili wybierz inny za pomocą `/voice list` i `/voice set`.',
  'voice.detection.on':
    '✅ Automatyczne wykrywanie języka WŁĄCZONE: każda wiadomość jest czytana głosem dla wykrytego języka (mówca może się zmieniać). Wyłącz poleceniem `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automatyczne wykrywanie języka WYŁĄCZONE: twój jeden stały głos czyta wszystko, więc zawsze brzmisz tak samo.',
  'voice.optout':
    'Nie będziesz już automatycznie czytany. Uruchom /voice opt-in, aby włączyć to z powrotem.',
  'voice.optin': 'Znowu będziesz czytany automatycznie.',
  'voice.nickname.set': '✅ Vozen będzie teraz nazywał cię **{name}** na głos.',
  'voice.nickname.cleared':
    '✅ Wymawiany pseudonim wyczyszczony — Vozen użyje twojej nazwy na serwerze.',
  'voice.nickname.invalid':
    'Ta nazwa nie ma nic czytelnego do wypowiedzenia na głos. Użyj liter lub cyfr.',
  'voice.effect.set':
    '✅ Efekt głosu ustawiony na **{effect}** — twoje wiadomości grają teraz z tym efektem. Użyj `/voice effect none`, aby go wyłączyć.',
  'voice.effect.cleared': '✅ Efekt głosu usunięty — znowu czysty głos.',
  'voice.effect.locked':
    '🔒 **{effect}** to efekt Premium. Darmowe efekty: 🤖 Robot i 🔊 Echo. Odblokuj wszystkie z Vozen Premium — zobacz `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** to głosowy silnik Premium. Odblokuj go z Vozen Plus (osobiste) lub Vozen Premium (serwer) — zobacz `/premium`. W międzyczasie twój głos pozostaje na darmowym lokalnym silniku.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** to głosowy silnik Premium. Odblokuj go z Vozen Plus (osobiste) lub Vozen Premium (serwer) — zobacz `/premium`. W międzyczasie twój głos pozostaje na darmowym lokalnym silniku.',
  'voice.notInVoice': 'Nie jestem jeszcze na kanale głosowym — najpierw użyj /join.',
  'voice.previewPlaying': 'Odtwarzam próbkę…',
  'preview.sample': 'Cześć, jestem Vozen. napisz to, usłysz to.',
  'laugh.playing': 'Haha! Odtwarzam to twoim głosem…',
  'joke.playing': 'Opowiadam żart…\n> {joke}',
  'joke.unknownLang': 'Nie znam tego języka. Wybierz jeden z listy.',
  'rizz.playing': '😏 Rzucam trochę tekstów na podryw…\n> {line}',
  'rizz.unknownLang': 'Nie znam tego języka. Wybierz jeden z listy.',
  'rizz.locked':
    '🔒 **/rizz** to dodatek Premium. Odblokuj go z Vozen Plus (ty) lub Premium (ten serwer). Zobacz `/premium`.',
  'sound.playing': '🔊 Odtwarzam **{name}**…',
  'sound.unknown': 'Nie mam takiego dźwięku. Uruchom `/sound`, aby zobaczyć listę.',
  'sound.list':
    '🔊 **Dźwięki:** {sounds}\nOdtwórz jeden poleceniem `/sound name:<dźwięk>` (muszę być na twoim kanale głosowym).',
  'sound.disabled':
    '🔇 Tablica dźwięków jest **wyłączona** na tym serwerze. Administrator może ją włączyć poleceniem `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Urodziny zapisane: **{day}/{month}**. Złożę ci życzenia, gdy tego dnia dołączysz do kanału głosowego!',
  'birthday.invalid': 'To nie jest prawdziwa data. Sprawdź dzień i miesiąc.',
  'birthday.cleared': '🎂 Urodziny usunięte.',
  'birthday.show': '🎂 Twoje urodziny są ustawione na **{day}/{month}**.',
  'birthday.none': 'Nie ustawiłeś jeszcze urodzin. Użyj `/birthday set`.',
  'topspeakers.title': '🗣️ **Najlepsi mówcy** — kogo najczęściej czytam na tym serwerze:',
  'topspeakers.empty':
    'Nie przeczytałem jeszcze niczyich wiadomości. Skonfiguruj kanał czytania poleceniem `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** wiadomości · 🔥 seria {streak} dni',
  'serverstats.title': '📊 **Statystyki serwera**',
  'serverstats.empty':
    'Jeszcze brak statystyk — nie przeczytałem żadnych wiadomości ani nie prowadziłem tu gier. Skonfiguruj poleceniem `/setup`!',
  'serverstats.messages': '🗣️ **{total}** przeczytanych wiadomości · **{speakers}** osób',
  'serverstats.topTalkers': '**Najwięksi gaduły:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} wiad. · 🔥 {streak}d',
  'serverstats.streak': '🔥 Najdłuższa aktywna seria: **{days}** dni',
  'serverstats.games':
    '🎮 **{points}** punktów w grach · **{wins}** zwycięstw · **{players}** graczy',
  'serverstats.topPlayers': '**Najlepsi gracze:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pkt · {wins} zwycięstw',
  'serverstats.upsell':
    '🔒 To darmowy podgląd. **Premium** odblokowuje serie, statystyki gier i pełną piątkę najlepszych — zobacz `/premium`.',
  'streak.day': '🔥 <@{user}> ma serię **{n} dni**! Rozmawiaj dalej, by ją utrzymać.',
  'leaderboard.autoTitle': '🏆 Najwięksi gaduły na tym serwerze',
  'premium.title': '💎 **Status Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Serwer:** Premium do {date}',
  'premium.lineServerFree': '🖥️ **Serwer:** plan darmowy',
  'premium.lineUserActive': '👤 **Ty (Plus):** aktywne do {date}',
  'premium.lineUserFree': '👤 **Ty (Plus):** nieaktywne',
  'premium.getHint':
    'Wszystko, czego używasz dzisiaj, pozostaje darmowe. Premium dodaje wszystkie 8 efektów głosu, obecność 24/7 na kanale, 50 osobistych wymów, /rizz oraz gry premium. Wsparcie: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Twój pass Premium:** {used}/{total} licencji w użyciu · wygasa {date}',
  'premium.passServers': '↳ W użyciu na: {servers}',
  'premium.pitch':
    'Nie masz jeszcze Premium. **Vozen Premium** (€3.99/mies. za 3 serwery lub €7.99/mies. za 8) odblokowuje dla całego serwera: wszystkie 8 efektów głosu, obecność 24/7 na kanale, 50 osobistych wymów (zamiast 3), polecenie /rizz oraz gry premium (Łańcuch Słów, Wordle, Szachy). **Vozen Plus** (€1.99/mies.) daje ci te dodatki osobiście, na dowolnym serwerze.',
  'premium.buyHint':
    '▶ **Zdobądź Premium:** {link}\nPo zakupie uruchom `/premium activate` na wybranym serwerze.',
  'premium.confirmActivate':
    'Użyć **1 z twoich {total} licencji Premium** na **tym serwerze**? Masz teraz **{used}** w użyciu. Możesz ją później zwolnić poleceniem `/premium deactivate` — zegar passa i tak biegnie.',
  'premium.confirmYes': '💎 Użyj licencji',
  'premium.confirmNo': 'Anuluj',
  'premium.activateOk':
    '✅ Premium jest teraz aktywne na **tym serwerze** do {date}. Licencje: **{used}/{total}** w użyciu.',
  'premium.activateCancelled': 'Anulowano — nie użyto żadnej licencji.',
  'premium.activateTimeout': 'Czas minął — nie użyto żadnej licencji.',
  'premium.noPass':
    'Nie masz aktywnego passa Premium. Zdobądź go, a trafi na twoje konto — potem uruchom tutaj `/premium activate`.\n▶ {link}',
  'premium.alreadyActive': 'Ten serwer ma już jedną z twoich licencji Premium. Nic do zrobienia.',
  'premium.noSeats':
    'Wszystkie twoje **{total}** licencje Premium są w użyciu ({servers}). Zwolnij jedną poleceniem `/premium deactivate` tam, a potem spróbuj ponownie tutaj.',
  'premium.needManageGuild':
    'Aktywacja Premium dotyczy całego serwera — tylko członkowie z uprawnieniem **Zarządzanie serwerem** mogą to zrobić. Poproś administratora.',
  'premium.deactivateOk':
    '✅ Zwolniłem licencję Premium tego serwera. Użyj jej na innym serwerze poleceniem `/premium activate`.',
  'premium.deactivateNone': 'Ten serwer nie ma żadnej twojej licencji Premium do zwolnienia.',
  'premium.thisServer': 'ten serwer',
  'grant.denied': '⛔ To polecenie jest tylko dla właściciela bota.',
  'grant.okPremium':
    '✅ Przyznano <@{user}> **pass Premium** ({seats} licencji) na **{days}** dni — wygasa {date}. Aktywuje go poleceniem `/premium activate`.',
  'grant.okPlus': '✅ Przyznano <@{user}> **Vozen Plus** na **{days}** dni — wygasa {date}.',
  'gencode.done':
    '✅ Wygenerowano **{count}** kod(ów) {plan}, po **{days}** dni każdy. Udostępniaj je prywatnie:\n{list}',
  'redeem.okPlus': '🎁 Zrealizowano! Otrzymałeś **Vozen Plus** na **{days}** dni — wygasa {date}.',
  'redeem.okPremium':
    '🎁 Zrealizowano! Otrzymałeś **pass Premium** ({seats} licencji) na **{days}** dni — wygasa {date}. Aktywuj go na swoim serwerze poleceniem `/premium activate`.',
  'redeem.notFound': '❌ Ten kod nie istnieje. Sprawdź go dokładnie i spróbuj ponownie.',
  'redeem.used': '❌ Ten kod został już zrealizowany.',
  'redeem.expired': '❌ Ten kod wygasł.',
  'voice.abbrev.added': 'Jasne — {term} będzie czytane jako {replacement}.',
  'voice.abbrev.removed': 'Usunięto twój skrót dla {term}.',
  'voice.abbrev.listHeader': 'Twoje osobiste skróty (użyto {count}/{cap}):',
  'voice.abbrev.listEmpty': '(jeszcze żadnych — dodaj jeden za pomocą /voice abbrev add)',
  'voice.abbrev.capReached':
    'Osiągnąłeś limit {cap} osobistych skrótów. Usuń jeden, zanim dodasz kolejny.',
  'voice.abbrev.invalidTerm':
    'Termin musi być pojedynczym słowem (tylko litery i cyfry), do 50 znaków.',
  'voice.abbrev.emptyReplacement': 'Odczyt nie może być pusty.',
  'voice.abbrev.tooLong': 'Odczyt jest za długi (maksymalnie 200 znaków).',
  'config.wordEmpty': 'Słowo nie może być puste.',
  'config.blocked': 'Zablokowano: {word}.',
  'config.blockLimit':
    'Ten serwer ma już maksymalną liczbę {max} zablokowanych słów. Usuń jedno, zanim dodasz kolejne.',
  'config.unblocked': 'Odblokowano: {word}.',
  'config.pronListHeader': 'Słownik wymowy:',
  'config.pronEmptyValue': '(puste)',
  'config.listEmpty': '(brak)',
  'config.termEmpty': 'Termin nie może być pusty.',
  'config.pronEmpty': 'Wymowa nie może być pusta.',
  'config.pronSet': 'Jasne — {term} będzie czytane jako {replacement}.',
  'config.pronRemoved': 'Usunięto wymowę dla {term}.',
  'config.channelWrongType': 'Wybierz kanał tekstowy (nie kanał głosowy ani kategorię).',
  'config.channelNoAccess': 'Nie widzę kanału {channel} — sprawdź moje uprawnienia tam.',
  'config.channelSet':
    'Kanał automatycznego czytania ustawiony na {channel}. Następnie: upewnij się, że automatyczne czytanie jest włączone za pomocą `/config auto-read active:true`.',
  'config.autoreadOn': 'Automatyczne czytanie jest teraz **włączone**.',
  'config.autoreadOff': 'Automatyczne czytanie jest teraz **wyłączone**.',
  'config.maxCharsRange': 'Wartość maks. znaków musi mieścić się w przedziale od 1 do 2000.',
  'config.maxCharsSet': 'Maksymalna liczba znaków na wiadomość ustawiona na {value}.',
  'config.rateLimitRange': 'Wartość limitu tempa musi mieścić się w przedziale od 1 do 120.',
  'config.rateLimitSet': 'Limit tempa ustawiony na {value} wiadomości na minutę.',
  'config.roleSet': 'Automatyczne czytanie jest teraz ograniczone do członków z rolą {role}.',
  'config.roleCleared': 'Ograniczenie roli usunięte — teraz każdy może być czytany.',
  'config.enabledOn': 'TTS jest teraz **włączone** na tym serwerze.',
  'config.enabledOff': 'TTS jest teraz **wyłączone** na tym serwerze.',
  'config.xsaidOn':
    'Vozen będzie teraz ogłaszał, **kto mówił** przed każdą wiadomością (np. „Alex powiedział cześć”). Wyłącz poleceniem `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **już nie** będzie ogłaszał, kto mówił — czyta tylko wiadomość.',
  'config.autojoinOn':
    '✅ Auto-dołączanie **włączone** — Vozen dołączy do twojego kanału głosowego, gdy napiszesz na kanale TTS.',
  'config.autojoinOff':
    'Auto-dołączanie **wyłączone** — użyj `/join`, aby przywołać Vozen na kanał głosowy.',
  'config.stayOn':
    '✅ Obecność 24/7 na kanale **włączona** — Vozen zostanie na kanale głosowym, nawet gdy się opróżni, i wróci po restartach. 💎 Wymaga Premium, aby zadziałać (kup lub `/redeem` kod, potem `/premium activate`).',
  'config.stayOff':
    'Obecność 24/7 na kanale **wyłączona** — Vozen wychodzi, gdy kanał głosowy się opróżnia (domyślnie).',
  'config.readBotsOn':
    '✅ Vozen będzie teraz czytał także wiadomości od **innych botów i webhooków**.',
  'config.readBotsOff':
    'Vozen będzie **ignorował** inne boty i webhooki (czytani są tylko prawdziwi ludzie).',
  'config.textInVoiceOn':
    '✅ Vozen będzie też czytał **czat tekstowy wewnątrz swojego kanału głosowego**.',
  'config.textInVoiceOff':
    'Vozen **nie** będzie czytał czatu tekstowego kanału głosowego (tylko kanał TTS).',
  'config.antispamOn':
    '✅ Anty-spam **włączony** — Vozen nie będzie czytał spamowanych wiadomości (masowe powtarzanie słowa lub ta sama duża wiadomość publikowana w kółko).',
  'config.antispamOff': 'Anty-spam **wyłączony** — Vozen czyta każdą wiadomość jak zwykle.',
  'config.streaksOn':
    '✅ Powiadomienia o seriach **włączone** — Vozen pokazuje wiadomość o serii 🔥 przy pierwszej wypowiedzi każdej osoby każdego dnia.',
  'config.streaksOff':
    'Powiadomienia o seriach **wyłączone** — Vozen nadal śledzi serie (zobacz `/top-speakers`), ale o nich milczy.',
  'config.soundboardOn':
    'Tablica dźwięków **włączona** — każdy może odtwarzać klipy poleceniem `/sound`.',
  'config.soundboardOff':
    'Tablica dźwięków **wyłączona** — `/sound` jest wyłączone na tym serwerze.',
  'config.votePromosLabel': 'Powiadomienia o nagrodzie top.gg + Vozen Support',
  'config.greetOn': '✅ Będę witał ludzi po imieniu, gdy dołączą do kanału głosowego.',
  'config.greetOff': '🔇 **Nie** będę witał ludzi, gdy dołączą do kanału głosowego.',
  'config.greetLangSet': '✅ Język powitania przy wejściu ustawiony na **{language}**.',
  'config.defaultVoiceSet':
    '✅ Domyślny głos serwera ustawiony na **{name}**. Członkowie bez własnego głosu usłyszą ten. (id: `{model}`)',
  'config.reset':
    'Konfiguracja przywrócona do domyślnej. Twoja lista blokad i wymowy zostały zachowane.',
  'config.showTitle': '**Konfiguracja serwera**',
  'config.showChannel': 'Kanał TTS: {value}',
  'config.showAutoread': 'Automatyczne czytanie: {value}',
  'config.showRole': 'Rola: {value}',
  'config.showEnabled': 'Włączone: {value}',
  'config.showXsaid': 'Ogłaszaj mówcę (xsaid): {value}',
  'config.showAutojoin': 'Auto-dołączanie: {value}',
  'config.showReadBots': 'Czytaj boty/webhooki: {value}',
  'config.showTextInVoice': 'Tekst-w-głosie: {value}',
  'config.showAntispam': 'Anty-spam: {value}',
  'config.showSoundboard': 'Tablica dźwięków (/sound): {value}',
  'config.showGreet': 'Powitanie przy wejściu: {value} ({language})',
  'config.showVoice': 'Domyślny głos: {value}',
  'config.showMaxChars': 'Maksymalna liczba znaków: {value}',
  'config.showRateLimit': 'Limit tempa: {value}/min',
  'config.showBlocklist': 'Lista blokad: {count} słów',
  'config.showPronunciation': 'Wymowy: {count} wpisów',
  'config.valueNone': '(brak)',
  'config.valueAny': 'każdy',
  'config.valueAutoDetect': '(automatyczne wykrywanie)',
  'config.on': 'włączone',
  'config.off': 'wyłączone',
  'config.language.set': 'Język interfejsu ustawiony na {language}.',
  'config.language.unsupported': 'Ten język nie jest jeszcze obsługiwany.',
  'setup.noChannel':
    'Nie mogłem ustalić, którego kanału użyć. Podaj kanał tekstowy w opcji „channel”.',
  'setup.channelWrongType':
    'Kanał automatycznego czytania musi być kanałem tekstowym (nie kanałem głosowym ani kategorią). Podaj taki w opcji „channel”.',
  'setup.done': '**Wszystko gotowe — Vozen jest gotowy.**',
  'setup.channelLine': 'Kanał automatycznego czytania: {channel}',
  'setup.autoreadOn': 'Automatyczne czytanie: włączone',
  'setup.permsHeader': '**Uprawnienia:**',
  'setup.permView': 'ViewChannel (widzenie kanału tekstowego)',
  'setup.permSend': 'SendMessages (pisanie na kanale tekstowym)',
  'setup.permConnect': 'Connect (dołączanie do kanału głosowego)',
  'setup.permSpeak': 'Speak (mówienie na kanale głosowym)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — brak',
  'setup.permUnchecked': '⏳ {label} — jeszcze niesprawdzone (zweryfikuję to przy /join)',
  'setup.fixHint':
    'Aby naprawić brakujące elementy: w ustawieniach serwera otwórz rolę Vozen (lub uprawnienia kanału) i włącz pozycje oznaczone ❌.',
  'setup.voiceUncheckedNote':
    'Nie jesteś na kanale głosowym, więc nie mogłem jeszcze sprawdzić Connect/Speak — zweryfikuję je, gdy uruchomisz /join.',
  'setup.allGood': 'Wszystko gotowe. Dołącz do kanału głosowego i uruchom /join.',
  'setup.joinedVoice': 'Dołączyłem też do {channel} — nie musisz uruchamiać /join.',
  'setup.readyTalk':
    'Wszystko gotowe. Pisz na kanale automatycznego czytania, a przeczytam to na głos.',
  'setup.membersHeader': '**Powiedz swoim członkom (3-krokowy proces):**',
  'setup.membersBody':
    '1) Dołącz do kanału głosowego\n2) Uruchom /join, żebym dołączył z tobą\n3) Pisz na tym kanale (lub użyj /tts), a przeczytam to na głos\nPełna lista poleceń: /help',
  'stats.title': '**Statystyki Vozen**',
  'stats.messagesSpoken': 'Wypowiedziane wiadomości: {value}',
  'stats.cacheHits': 'Trafienia w pamięci podręcznej: {value}',
  'stats.cacheMisses': 'Chybienia pamięci podręcznej: {value}',
  'stats.synthErrors': 'Błędy syntezy: {value}',
  'stats.synthLatency': 'Opóźnienie syntezy: p50 {p50}ms / p95 {p95}ms ({count} próbek)',
  'stats.voiceDrops': 'Utraty połączenia głosowego: {value}',
  'stats.voiceReconnects': 'Ponowne połączenia: {value}',
  'stats.votes': 'Głosy na top.gg: {value}',
  'stats.activePlayers': 'Aktywni odtwarzacze: {value}',
  'stats.servers': 'Serwery: {value}',
  'stats.uptime': 'Czas działania: {value}s',
  'speak.emptyMessage': 'Ta wiadomość nie ma tekstu do przeczytania na głos.',
  'uptime.text': '🟢 Vozen jest online od **{uptime}**.',
  'botstats.title': '📊 **Vozen — statystyki**',
  'botstats.servers': 'Serwery: **{value}**',
  'botstats.voiceSessions': 'Sesje głosowe teraz: **{value}**',
  'botstats.messagesSpoken': 'Wypowiedziane wiadomości: **{value}**',
  'botstats.uptime': 'Czas działania: **{value}**',
  'invite.noClientId':
    'Link zaproszenia Vozen nie jest jeszcze skonfigurowany (brakuje CLIENT_ID). Daj znać administratorowi bota.',
  'invite.link': 'Dodaj Vozen do swojego serwera:\n{url}',
  'vote.noClientId':
    'Link do głosowania na Vozen nie jest jeszcze skonfigurowany (brakuje CLIENT_ID). Daj znać administratorowi bota.',
  'vote.link':
    'Zagłosuj na Vozen (za darmo, co 12 h) i pomóż większej liczbie osób go znaleźć:\n{url}\nJeśli to konto nigdy nie odebrało nagrody, otrzyma **48 godzin Vozen Plus**, tylko raz na konto.',
  'invite.button': 'Dodaj Vozen',
  'vote.button': 'Zagłosuj na top.gg',
  'vote.upsell':
    '🗳️ Jeśli to konto nigdy nie odebrało nagrody, otrzyma **48 godzin Vozen Plus**, tylko raz na konto. {url}',
  'vote.cooldownStatus':
    '🗳️ To konto wykorzystało już jednorazową nagrodę za głos. Nadal możesz głosować, aby wspierać Vozen, ale nie otrzymasz więcej Plus.',
  'help.title': 'Vozen — napisz to, usłysz to.',
  'help.embedTitle': 'Vozen — Polecenia',
  'help.intro':
    'Vozen czyta twój tekst na głos na kanałach głosowych — darmowe głosy neuronowe, dziesiątki języków.',
  'help.quickStartTitle': 'Szybki start (3 kroki)',
  'help.quickStartBody':
    '1) Dołącz do kanału głosowego, a potem uruchom /join\n2) Pisz na kanale tekstowym (lub użyj /tts Cześć wszystkim!)\n3) (opcjonalnie) Wybierz głos za pomocą /voice set',
  'help.groupStarted': 'Pierwsze kroki',
  'help.groupStartedBody':
    '• /join — dołączam do twojego kanału głosowego\n• /leave — opuszczam kanał głosowy\n• /tts <tekst> — czytam tekst na głos · np. /tts Cześć wszystkim!\n• /skip — pomiń to, co teraz czytam',
  'help.groupVoice': 'Twój głos',
  'help.groupVoiceBody':
    '• /voice set <model> — wybierz swój głos · np. /voice set en_US-amy-medium\n• /voice list — zobacz dostępne głosy\n• /voice preview — usłysz próbkę swojego głosu\n• /voice reset — wróć do domyślnego głosu\n• /voice opt-out · /voice opt-in — wyłącz / włącz automatyczne czytanie dla siebie\n• /voice abbrev add|remove|list — osobisty slang, czytany po twojemu (do 10)',
  'help.groupFun': 'Rozrywka',
  'help.groupFunBody':
    '• /joke — opowiadam krótki żart (wybierz język + opcjonalny śmiech) · np. /joke English\n• /laugh — śmieję się na głos twoim aktualnym głosem',
  'help.groupAdmin': 'Administracja serwera (wymaga Zarządzania serwerem)',
  'help.groupAdminBody':
    '• /setup — prowadzona konfiguracja w jednym kroku · uruchom to najpierw\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · np. /config tts-channel #general\n• /stats — statystyki bota',
  'help.groupMore': 'Więcej',
  'help.groupMoreBody':
    '• /invite — dodaj Vozen do innego serwera\n• /vote — zagłosuj na Vozen na top.gg\n• /help — pokaż tę pomoc',
  'help.footer': 'Nowy tutaj? Uruchom {command}, aby zacząć.',
  'help.support': '🛟 Potrzebujesz pomocy lub chcesz zgłosić problem? {url}',
  'help.source': '📄 Otwarte źródło (AGPL-3.0) — pobierz dokładny kod, który tu działa: {url}',
  'welcome.title': 'Dzięki za dodanie Vozen! 👋',
  'welcome.description':
    'Vozen czyta twój czat na głos na kanałach głosowych — napisz to, usłysz to.\n\n**Zacznij w jednym kroku:** uruchom {setup}, a skonfiguruję automatyczne czytanie i dołączę do twojego kanału głosowego.\n\nPotrzebujesz pełnej listy poleceń? Uruchom {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Jak członkowie tego używają (3 kroki)',
  'welcome.stepsBody':
    '1) Dołącz do kanału głosowego\n2) Uruchom /join, żebym do ciebie dołączył\n3) Pisz na kanale tekstowym (lub użyj /tts), a przeczytam to na głos\nPełna lista poleceń: /help',
  'welcome.footer': 'Vozen — napisz to, usłysz to.',
  'welcome.tagline': 'Naturalny głos neuronowy — darmowy na zawsze, bez opłat.',
  'game.start.needVoice':
    'To jest **gra głosowa** — wskocz na kanał głosowy i najpierw uruchom /join, potem ją zacznij.',
  'game.start.alreadyActive':
    'Gra już trwa na <#{channel}>. Zakończ ją (lub użyj `/game stop`), zanim zaczniesz kolejną.',
  'game.start.premiumLocked':
    '🔒 **{game}** to gra Premium (kosztuje realną moc obliczeniową). Zobacz `/premium`.',
  'game.start.started': '🎮 Zaczynam **{game}**! Obserwuj kanał — powodzenia!',
  'game.start.startedThread':
    '🎮 **{game}** rozpoczęta na <#{channel}> — dołączcie tam! Wątek usunie się sam, gdy gra się skończy.',
  'game.thread.winner': '🏆 {winner} wygrał grę!',
  'game.thread.ended': '🎮 Gra się zakończyła.',
  'game.unknownGame': 'Nie znam tej gry. Wybierz jedną z listy.',
  'game.stop.ok': '🛑 Zatrzymałem bieżącą grę.',
  'game.stop.none': 'Żadna gra teraz nie trwa.',
  'game.list.title': '🎮 **Gry** — zacznij jedną poleceniem `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Ranking** — najlepsi gracze na tym serwerze:',
  'game.leaderboard.empty': 'Jeszcze nie zagrano żadnej gry. Bądź pierwszy — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pkt ({wins} zwycięstw)',
  'game.finish.title': '🏁 **Koniec gry!** Końcowe wyniki:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Koniec gry — nikt tym razem nie zdobył punktów. Następnym razem!',
  'game.finish.winnerVoice': '{user} wygrywa!',
  'game.guessLanguage.name': 'Zgadnij Język',
  'game.guessLanguage.desc':
    'Czytam zdanie w losowym języku — pierwszy, kto go nazwie, zdobywa punkt.',
  'game.guessLanguage.intro':
    '🗣️ **Zgadnij Język** — przeczytam {rounds} zdań. Wpisz, jaki język słyszysz. Najszybsza poprawna odpowiedź wygrywa każdą rundę!',
  'game.guessLanguage.round': '🎧 Runda {n}/{total} — słuchaj…',
  'game.guessLanguage.correct': '✅ **{user}** zgadł — to był **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Czas! To był **{language}**.',
  'game.guessLanguage.noLanguages':
    'Nie mam zainstalowanych wystarczająco głosów, aby w to zagrać. Poproś administratora o dodanie większej liczby głosów.',
  'game.math.name': 'Liczenie w Pamięci',
  'game.math.desc': 'Mówię działanie na głos — pierwszy, kto wpisze wynik, wygrywa.',
  'game.math.intro':
    '🔢 **Liczenie w Pamięci** — {rounds} działań. Słuchaj i wpisz wynik tak szybko, jak potrafisz!',
  'game.math.round': '🧮 Runda {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** trafił — wynik to **{answer}**!',
  'game.math.timeout': '⏱️ Czas! Wynik to **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'razy',
  'game.skipCount.name': 'Brakująca Liczba',
  'game.skipCount.desc':
    'Liczę na głos, ale pomijam jedną liczbę — pierwszy, kto ją złapie, wygrywa.',
  'game.skipCount.intro':
    '🔢 **Brakująca Liczba** — liczę, ale jedną pomijam. Wpisz brakującą liczbę! ({rounds} rund)',
  'game.skipCount.round': '👂 Runda {n}/{total} — którą liczbę pominąłem?',
  'game.skipCount.correct': '✅ **{user}** złapał — pominąłem **{answer}**!',
  'game.skipCount.timeout': '⏱️ Czas! Pominąłem **{answer}**.',
  'game.spelling.name': 'Dyktando',
  'game.spelling.desc': 'Mówię słowo — pierwszy, kto poprawnie je zapisze, wygrywa.',
  'game.spelling.intro': '✍️ **Dyktando** — powiem {rounds} słów. Wpisz każde poprawnie zapisane!',
  'game.spelling.round': '🗣️ Runda {n}/{total} — zapisz słowo, które powiem…',
  'game.spelling.correct': '✅ **{user}** poprawnie zapisał **{word}**!',
  'game.spelling.timeout': '⏱️ Czas! Słowo to **{word}**.',
  'game.spelling.empty': 'Nie mam jeszcze listy słów dla języka głosu tego serwera.',
  'game.spellOut.name': 'Literowanie',
  'game.spellOut.desc':
    'Literuję słowo litera po literze — pierwszy, kto napisze całe słowo, wygrywa.',
  'game.spellOut.intro':
    '🔡 **Literowanie** — literuję {rounds} słów litera po literze. Wpisz całe słowo!',
  'game.spellOut.round': '🔤 Runda {n}/{total} — słuchaj liter…',
  'game.spellOut.correct': '✅ **{user}** zgadł — **{word}**!',
  'game.spellOut.timeout': '⏱️ Czas! To było **{word}**.',
  'game.fastSpeech.name': 'Szybka Gadka',
  'game.fastSpeech.desc':
    'Czytam zdanie bardzo szybko — pierwszy, kto wpisze, co powiedziałem, wygrywa.',
  'game.fastSpeech.intro':
    '💨 **Szybka Gadka** — {rounds} zdań w zawrotnym tempie. Wpisz, co słyszysz!',
  'game.fastSpeech.round': '⚡ Runda {n}/{total} — już leci, szybko!',
  'game.fastSpeech.correct': '✅ **{user}** rozszyfrował: „{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Czas! To było: „{phrase}”',
  'game.fastSpeech.empty': 'Nie mam jeszcze zdań dla języka głosu tego serwera.',
  'game.accentSwap.name': 'Śmieszny Akcent',
  'game.accentSwap.desc': 'Mówię słowo z obcym akcentem — pierwszy, kto je napisze, wygrywa.',
  'game.accentSwap.intro':
    '🎭 **Śmieszny Akcent** — {rounds} słów wypowiedzianych ze złym akcentem. Wpisz słowo!',
  'game.accentSwap.round': '🌍 Runda {n}/{total} — jakie słowo próbuję powiedzieć?',
  'game.accentSwap.correct': '✅ **{user}** zgadł — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Czas! Słowo to **{word}**.',
  'game.reflexes.name': 'Refleks',
  'game.reflexes.desc':
    'Odliczam, potem krzyczę START — pierwszy, kto wtedy napisze, wygrywa. Nie startuj za wcześnie!',
  'game.reflexes.intro':
    '⚡ **Refleks** — {rounds} rund. Gdy krzyknę **START**, wpisz cokolwiek tak szybko, jak potrafisz. Napiszesz przed START i to falstart!',
  'game.reflexes.ready': '🚦 Runda {n}/{total} — przygotuj się…',
  'game.reflexes.countdown': 'trzy… dwa… jeden…',
  'game.reflexes.go': '🟢 **START!!!**',
  'game.reflexes.goVoice': 'Start!',
  'game.reflexes.tooSoon': '🔴 **{user}** wystartował za wcześnie — za szybko!',
  'game.reflexes.win': '⚡ **{user}** jest najszybszy! Punkt!',
  'game.reflexes.tooSlow': '😴 Nikt nie zareagował na czas. Dalej!',
  'game.headsOrTails.name': 'Orzeł czy Reszka',
  'game.headsOrTails.desc': 'Obstaw rzut monetą — typuj, zanim rzucę. Wygrywa najlepszy typer!',
  'game.headsOrTails.intro':
    '🪙 **Orzeł czy Reszka** — {rounds} rund. W każdej rundzie wpisz `heads` (orzeł) lub `tails` (reszka), zanim rzucę monetą. 1 punkt za każdy trafny typ!',
  'game.headsOrTails.introVoice': 'Zagrajmy w orła i reszkę!',
  'game.headsOrTails.round': '🪙 Runda {n}/{total} — orzeł czy reszka? Wpisz swój typ!',
  'game.headsOrTails.roundVoice': 'Orzeł… czy reszka?',
  'game.headsOrTails.heads': 'orzeł',
  'game.headsOrTails.tails': 'reszka',
  'game.headsOrTails.resultVoice': 'To {side}!',
  'game.headsOrTails.winners': 'To **{side}**! Punkt dla: {users}',
  'game.headsOrTails.noWinners': 'To **{side}**! Nikt nie trafił — bez punktów.',
  'game.vozenSays.name': 'Vozen Mówi',
  'game.vozenSays.desc':
    'Wykonuj polecenie tylko wtedy, gdy zaczyna się od „Vozen mówi”. Dasz się nabrać i wpadłeś!',
  'game.vozenSays.intro':
    '🫡 **Vozen Mówi** — {rounds} poleceń. Wykonaj je TYLKO, jeśli zacznę od **„Vozen mówi”**. W przeciwnym razie nie ruszaj się!',
  'game.vozenSays.prefix': 'Vozen mówi',
  'game.vozenSays.verb': 'wpiszcie',
  'game.vozenSays.real': '🗣️ Runda {n}/{total} — „{command}”',
  'game.vozenSays.trap': '🗣️ Runda {n}/{total} — „{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** posłuchał pierwszy — punkt!',
  'game.vozenSays.caught': '🔴 **{user}** — nie powiedziałem Vozen mówi! Wpadłeś!',
  'game.vozenSays.nobody': '😴 Nikt nie wykonał **{word}** na czas. Dalej!',
  'game.vozenSays.trapCleared':
    '😌 To była pułapka — dobrze wypatrzone, nikt nie nabrał się na **{word}**.',
  'game.roulette.name': 'Ruletka Prawda czy Wyzwanie',
  'game.roulette.desc':
    'Kręcę i czytam na głos jedno wyzwanie (prawda czy wyzwanie). Uruchom ponownie, by dostać kolejne.',
  'game.roulette.header': '🎯 **Koło mówi…**',
  'game.hangman.name': 'Wisielec',
  'game.hangman.desc': 'Zgadnij słowo litera po literze — 6 pomyłek i koniec.',
  'game.hangman.intro':
    '🪢 **Wisielec** — wpisuj po jednej literze, aby zgadnąć słowo. Możesz też wpisać całe słowo!',
  'game.hangman.hit': '🟢 **{user}** znalazł **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — nie ma **{letter}**.',
  'game.hangman.wrongLetters': 'Błędne: {letters}',
  'game.hangman.win': '🎉 **{user}** rozwiązał — **{word}**!',
  'game.hangman.lose': '💀 Koniec prób! Słowo to **{word}**.',
  'game.hangman.idle': '🕹️ Gra wstrzymana (nikt nie gra). Słowo to **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Zgadnij 5-literowe słowo. 🟩 dobre miejsce, 🟨 złe miejsce, ⬛ brak w słowie. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — wpisz 5-literowe słowo. Dzielicie {max} prób. 🟩 dobre miejsce · 🟨 złe miejsce · ⬛ brak w słowie.',
  'game.wordle.guess': '🔤 **{user}** spróbował — zostało **{left}** prób',
  'game.wordle.inWord': '🟢 w słowie: {letters}',
  'game.wordle.out': '🚫 poza: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** zgadł w {n} — **{word}**!',
  'game.wordle.lose': '💀 Koniec prób! Słowo to **{word}**.',
  'game.wordle.idle': '🕹️ Gra wstrzymana (nikt nie gra). Słowo to **{word}**.',
  'game.tictactoe.name': 'Kółko i Krzyżyk',
  'game.tictactoe.desc':
    'Dwóch graczy — wpisz liczbę 1-9, aby postawić swój znak. Trzy w rzędzie wygrywają.',
  'game.tictactoe.intro':
    '⭕ **Kółko i Krzyżyk** — pierwsi dwaj gracze to ❌ i ⭕ (❌ zaczyna). Wpisz liczbę 1-9, aby zagrać w danym polu.',
  'game.tictactoe.turn': 'Tura: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, teraz kolej **{mark}**.',
  'game.tictactoe.taken': '🚫 Pole {cell} jest zajęte — wybierz inne.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) wygrywa!',
  'game.tictactoe.draw': '🤝 Remis!',
  'game.tictactoe.idle': '🕹️ Gra zakończona (nikt nie gra).',
  'game.chess.name': 'Szachy',
  'game.chess.desc':
    'Dwóch graczy — prawdziwe zasady szachów (szach, roszada, promocja…). Wpisz ruch typu "e4" lub "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Szachy** — pierwsi dwaj gracze dostają białe i czarne (białe zaczynają). Wpisz ruch w notacji algebraicznej ("e4", "Nf3", "O-O") lub jako współrzędne ("e2e4"). Wpisz "resign", aby się poddać.',
  'game.chess.white': 'białe',
  'game.chess.black': 'czarne',
  'game.chess.seats': '⚪ Białe: **{white}** · ⚫ Czarne: **{black}**',
  'game.chess.turn': '{move} — kolej: **{color}**',
  'game.chess.check': '♟️ Szach!',
  'game.chess.notYourTurn': '⏳ **{user}**, teraz kolej **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" to nieprawidłowy ruch — spróbuj ponownie.',
  'game.chess.checkmate': '🏆 Szach-mat ({move})! **{user}** wygrywa!',
  'game.chess.draw': '🤝 Remis ({move})!',
  'game.chess.resigned': '🏳️ **{user}** poddał się — **{winner}** wygrywa!',
  'game.chess.idle': '🕹️ Gra zakończona (nikt nie gra).',
  'game.wordChain.name': 'Łańcuch Słów',
  'game.wordChain.descr':
    'Łańcuch słów na tury w jednym języku: powiedz słowo zaczynające się na ostatnią literę poprzedniego. 2 życia, bez powtórzeń, zegar przyspiesza. Wybierz język opcją `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Łańcuch Słów jest teraz niedostępny w języku **{lang}** (brak listy słów).',
  'game.wordChain.lobby':
    '🔗 **Łańcuch Słów** w języku **{lang}**! Wpisz cokolwiek na tym kanale w ciągu **{seconds}s**, aby dołączyć.',
  'game.wordChain.notEnough':
    '😴 Dołączyło za mało graczy (potrzeba co najmniej 2). Gra anulowana.',
  'game.wordChain.begin':
    '🚀 Zaczynamy! Gracze: {players}. Każde słowo musi zaczynać się na ostatnią literę poprzedniego.',
  'game.wordChain.turn':
    '**{name}**, twoja kolej! Słowo w języku **{lang}** zaczynające się na **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — następna litera: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Musi zaczynać się na **{letter}**.',
  'game.wordChain.bad.short': '📏 Za krótkie — co najmniej **{min}** liter.',
  'game.wordChain.bad.repeated': '🔁 To słowo było już użyte.',
  'game.wordChain.bad.word': '📖 Tego nie ma w słowniku.',
  'game.wordChain.bad.latin': '🔤 Liczą się tylko litery A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** przekroczył czas! Zostało {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** odpada!',
  'game.wordChain.winner': '🏆 **{name}** wygrywa łańcuch! ({chain} słów)',
  'game.stats.none': 'Nie zagrałeś jeszcze w żadną grę. Spróbuj `/game play`!',
  'game.stats.body':
    '🎮 **Twoje statystyki** — **{points}** punktów · **{wins}** zwycięstw · {rank}',
  'game.stats.rank': 'pozycja **#{rank}** z {total}',
  'game.stats.unranked': 'jeszcze bez pozycji',
  'game.pickPrompt': '🎮 W którą grę chcesz zagrać? Wybierz jedną:',
  'game.pickPlaceholder': 'Wybierz grę…',
  'game.pickTimeout': '⏰ Nie wybrano gry — uruchom `/game play` ponownie, gdy będziesz gotowy.',
  'pron.listHeader': '🗣️ **Twoje wymowy** ({count}/{limit}):',
  'pron.listEmpty': 'Nie masz jeszcze żadnych — dodaj poleceniem `/pronunciation add`.',
  'pron.set': '✅ Zapisano! Gdy **ty** napiszesz „{term}”, powiem „{replacement}”.',
  'pron.removed': '🗑️ Usunięto „{term}”.',
  'pron.notFound': 'Nie masz wymowy dla „{term}”. Zobacz swoje poleceniem `/pronunciation list`.',
  'pron.empty': 'Słowo i sposób jego wymowy nie mogą być puste.',
  'pron.limitHit':
    '🔒 Osiągnąłeś limit **{limit}** wymów. Usuń jedną poleceniem `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus lub Premium podnosi go do **50** → {url}',
  'pron.modalTitle': 'Naucz Vozen wymowy',
  'pron.modalTerm': 'Słowo (tak jak się je pisze)',
  'pron.modalSay': 'Jak Vozen ma je wymawiać',
  'spron.listHeader': '🗣️ **Wymowy serwera** ({count}/{limit}) — obowiązują wszystkich:',
  'spron.listEmpty': 'Jeszcze żadnych — dodaj poleceniem `/server-pronunciation add`.',
  'spron.set': '✅ Zapisano dla całego serwera! „{term}” → „{replacement}”.',
  'spron.removed': '🗑️ Usunięto „{term}” z serwera.',
  'spron.notFound': 'Serwer nie ma wymowy dla „{term}”.',
  'spron.limitHit':
    '🔒 Serwer osiągnął limit **{limit}** wymów. Usuń jedną poleceniem `/server-pronunciation remove`.',
  'spron.modalTitle': 'Wymowa serwera',
  'spron.modalSay': 'Jak Vozen wymawia to dla wszystkich',
  'rand.selectPrompt': '🎲 **Randomizer** — spośród ilu opcji mam wybierać?',
  'rand.selectPlaceholder': 'Liczba opcji…',
  'rand.selectOption': '{n} opcji',
  'rand.filling': '📝 Wypełnij formularz, który się właśnie otworzył!',
  'rand.modalTitle': 'Randomizer — {amount} opcji',
  'rand.modalOption': 'Opcja {n}',
  'rand.needTwo': 'Podaj mi co najmniej 2 opcje oddzielone przecinkami (np. "pizza, sushi").',
  'rand.result': 'Spośród {count} opcji wybieram… **{winner}**!',
  'rand.speak': 'Wybieram… {winner}!',
  'rand.notInVoice': '_(dołącz do kanału głosowego ze mną, a następnym razem powiem to na głos)_',
  'rand.timeout': '⏰ Nic nie wybrano — uruchom `/randomizer` ponownie, gdy będziesz gotowy.',
};
