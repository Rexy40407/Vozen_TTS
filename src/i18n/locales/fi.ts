export default {
  'error.generic': 'Jokin meni pieleen. Yritä uudelleen.',
  'stt.guildOnly': 'Transkriptio toimii vain palvelimen sisällä.',
  'stt.noManage':
    'Tarvitset **Hallitse palvelinta** -oikeuden käynnistääksesi tai pysäyttääksesi transkription.',
  'stt.notPremium':
    '🎙️ Live-transkriptio on **Premium**-ominaisuus. Katso `/premium info` avataksesi sen tälle palvelimelle.',
  'stt.unavailable':
    'Transkriptio ei ole käytettävissä tässä instanssissa (puheentunnistusmoottoria ei ole asennettu).',
  'stt.notInVoice':
    'En ole puhekanavalla — liity kanavalle ja suorita `/join` ensin, käynnistä sitten transkriptio.',
  'stt.alreadyRunning':
    'Transkriptio on jo käynnissä tällä palvelimella. Käytä ensin `/transcribe stop`.',
  'stt.atCapacity':
    'Liian monta transkriptiota on käynnissä juuri nyt kaikilla palvelimilla. Yritä hetken kuluttua uudelleen.',
  'stt.noChannel':
    'En voi julkaista transkriptioita tällä kanavalla. Kokeile suorittaa komento tavallisella tekstikanavalla.',
  'stt.started':
    '✅ Transkriptio käynnistetty. Jokainen, joka painaa **Suostun** ilmoituksessa, transkriboidaan tälle kanavalle.',
  'stt.startFailed':
    'Transkription käynnistys ei onnistunut (ilmoituksen julkaisu epäonnistui). Peruin kaiken — mitään ei tallenneta. Yritä uudelleen.',
  'stt.announceStart':
    '🎙️ **Live-transkriptio on PÄÄLLÄ tällä kanavalla.** Vain suostumuksen antaneet transkriboidaan — paina alla olevaa painiketta salliaksesi puheesi kirjoittamisen tänne. Voit peruuttaa milloin tahansa komennolla `/transcribe revoke`.',
  'stt.consentBtn': 'Suostun transkriboitavaksi',
  'stt.consentThanks':
    '✅ Kiitos — puheesi transkriboidaan nyt tällä palvelimella. Peruuta milloin tahansa komennolla `/transcribe revoke`.',
  'stt.stopped': '🛑 Transkriptio pysäytetty.',
  'stt.notRunning': 'Transkriptio ei ole käynnissä tällä palvelimella.',
  'stt.announceStop': '🛑 **Live-transkriptio on nyt POIS PÄÄLTÄ.** Lopetin kuuntelemisen.',
  'stt.revoked':
    '✅ Suostumus peruutettu — sinua ei enää transkriboida tällä palvelimella. (Jo julkaistut viestit jäävät; poista ne Discordissa halutessasi.)',
  'stt.revokeNone':
    'Et ollut antanut suostumusta transkriptioon tällä palvelimella, joten ei ollut mitään peruutettavaa.',
  'privacy.eraseConfirm':
    '⚠️ Tämä poistaa pysyvästi **kaikki** Vozen-tietosi kaikilta palvelimilta: ääniasetukset, puhutun lempinimen, henkilökohtaiset lyhenteet ja ääntämykset, tallennetun syntymäpäivän, pelipisteet, puhetilastot ja opt-outin. **Tätä ei voi peruuttaa.** Oletko varma?',
  'privacy.erasePremiumNote':
    '_Huom: maksettu Premium/Plus ja sen ostohistoria säilytetään — ne kuuluvat sinulle ja lain vaatimaan kirjanpitoon. Pysäyttääksesi Premiumin anna sen vanhentua tai ota yhteyttä tukeen._',
  'privacy.eraseYes': 'Poista kaikki',
  'privacy.eraseNo': 'Peruuta',
  'privacy.eraseCancelled': 'Peruutettu — mitään ei poistettu.',
  'privacy.eraseDone': '✅ Valmis. Kaikki henkilökohtaiset tietosi on poistettu pysyvästi.',
  'error.needManageGuild': 'Tarvitset **Hallitse palvelinta** -oikeuden tehdäksesi tämän.',
  'join.needVoiceChannel': 'Liity ensin puhekanavalle ja suorita sitten /join.',
  'join.missingPerms': 'Tarvitsen **Yhdistä**- ja **Puhu**-oikeudet kanavalla {channel}.',
  'join.joined':
    '✅ Olen kanavalla {channel}! Seuraavaksi: sano `/tts hei` niin luen sen ääneen. Haluatko että luen kanavan automaattisesti? Suorita /setup.',
  'join.joinedAutoread':
    '✅ Olen kanavalla {channel}! Kaikki on valmista. Kirjoita automaattisen lukemisen kanavalle niin luen sen ääneen. → {readChannel}',
  'leave.left': 'Poistuin puhekanavalta. Nähdään ensi kerralla!',
  'skip.notInVoice':
    'En ole vielä puhekanavalla — liity kanavalle ja suorita /join ensin, yritä sitten uudelleen.',
  'skip.skipped': 'Ohitettu.',
  'skip.nothing': 'Mitään ei toisteta juuri nyt.',
  'shutup.notInVoice': 'En ole vielä puhekanavalla — liity kanavalle ja suorita /join ensin.',
  'shutup.nothing': 'Mitään ei toisteta juuri nyt.',
  'shutup.done': '🤐 Selvä, lopetan — tyhjensin koko jonon.',
  'tts.notInVoice':
    'En ole vielä puhekanavalla — liity kanavalle ja suorita /join, yritä sitten uudelleen.',
  'tts.nothingToRead': 'Siellä ei ole mitään luettavaa — lähetä minulle jotain tekstiä.',
  'tts.nothingAfterClean':
    'Siistimisen jälkeen ei jäänyt mitään luettavaa — kokeile tavallista tekstiä (kirjaimia tai sanoja).',
  'tts.tooFast': 'Hei, hidasta hieman — yritä hetken kuluttua uudelleen.',
  'tts.blocked': 'Teksti sisältää estetyn sanan, joten ohitin sen.',
  'tts.queued': 'Selvä — se on jonossa.',
  'tts.busy': 'Olen kiireinen juuri nyt — yritä hetken kuluttua uudelleen.',
  'voice.unknownModel': 'En tunne tuota ääntä — katso /voice list.',
  'voice.badSpeed':
    'Nopeuden on oltava välillä 0.5 ja 2.0 (1.0 on normaali). Kokeile `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Äänesi on nyt **{name}** nopeudella {speed}×. Kokeile `/tts hei` kuullaksesi sen. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Ääniasetukset** — valitse vaihtoehdot alta ja paina sitten **Tallenna**. Mikään ei muutu ennen sitä.',
  'voice.config.summary': 'Nykyinen valinta: **{voice}** · moottori **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Kieli…',
  'voice.config.pickVoice': 'Ääni…',
  'voice.config.pickEngine': 'Moottori…',
  'voice.config.pickSpeed': 'Nopeus…',
  'voice.config.more': '▼ Lisää kieliä',
  'voice.config.engDefault': 'Oletus (paikallinen)',
  'voice.config.save': 'Tallenna',
  'voice.config.cancel': 'Peruuta',
  'voice.config.cancelled': 'Asetus peruutettu — mitään ei muutettu.',
  'voice.config.expired': 'Paneeli vanheni — jatka suorittamalla `/voice config` uudelleen.',
  'voice.listHeader': 'Saatavilla olevat äänet:',
  'voice.listEmpty': '(ei asennettuja)',
  'voice.reset':
    '✅ Äänesi on palautettu oletukseksi. Valitse toinen milloin tahansa komennoilla `/voice list` ja `/voice set`.',
  'voice.detection.on':
    '✅ Automaattinen kielentunnistus on PÄÄLLÄ: jokainen viesti luetaan tunnistetun kielen äänellä (puhuja voi vaihtua). Poista se käytöstä komennolla `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automaattinen kielentunnistus on POIS PÄÄLTÄ: yksi kiinteä äänesi lukee kaiken, joten kuulostat aina samalta.',
  'voice.optout':
    'Sinua ei enää lueta automaattisesti. Suorita /voice opt-in ottaaksesi sen taas käyttöön.',
  'voice.optin': 'Sinut luetaan taas automaattisesti.',
  'voice.nickname.set': '✅ Vozen kutsuu sinua nyt ääneen nimellä **{name}**.',
  'voice.nickname.cleared': '✅ Puhuttu lempinimi poistettu — Vozen käyttää palvelinnimeäsi.',
  'voice.nickname.invalid':
    'Tuossa nimessä ei ole mitään ääneen luettavaa. Kokeile kirjaimia tai numeroita.',
  'voice.effect.set':
    '✅ Ääniefektiksi asetettu **{effect}** — viestisi toistetaan nyt tällä efektillä. Käytä `/voice effect none` poistaaksesi sen käytöstä.',
  'voice.effect.cleared': '✅ Ääniefekti poistettu — taas puhdas ääni.',
  'voice.effect.locked':
    '🔒 **{effect}** on Premium-efekti. Ilmaiset efektit: 🤖 Robot ja 🔊 Echo. Avaa kaikki Vozen Premiumilla — katso `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** on Premium-äänimoottori. Avaa se Vozen Plusilla (henkilökohtainen) tai Vozen Premiumilla (palvelin) — katso `/premium`. Sillä välin äänesi pysyy ilmaisessa paikallisessa moottorissa.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** on Premium-äänimoottori. Avaa se Vozen Plusilla (henkilökohtainen) tai Vozen Premiumilla (palvelin) — katso `/premium`. Sillä välin äänesi pysyy ilmaisessa paikallisessa moottorissa.',
  'voice.notInVoice': 'En ole vielä puhekanavalla — suorita /join ensin.',
  'voice.previewPlaying': 'Toistetaan näytettä…',
  'preview.sample': 'Hei, olen Vozen. kirjoita se, kuule se.',
  'laugh.playing': 'Haha! Toistetaan tämä sinun äänelläsi…',
  'joke.playing': 'Kerrotaan vitsi…\n> {joke}',
  'joke.unknownLang': 'En tunne tuota kieltä. Valitse jokin listasta.',
  'rizz.playing': '😏 Heitetään vähän rizziä…\n> {line}',
  'rizz.unknownLang': 'En tunne tuota kieltä. Valitse jokin listasta.',
  'rizz.locked':
    '🔒 **/rizz** on Premium-etu. Avaa se Vozen Plusilla (sinä) tai Premiumilla (tämä palvelin). Katso `/premium`.',
  'sound.playing': '🔊 Toistetaan **{name}**…',
  'sound.unknown': 'Minulla ei ole tuota ääntä. Suorita `/sound` nähdäksesi listan.',
  'sound.list':
    '🔊 **Äänet:** {sounds}\nToista jokin komennolla `/sound name:<ääni>` (minun täytyy olla puhekanavallasi).',
  'sound.disabled':
    '🔇 Soundboard on **pois päältä** tällä palvelimella. Ylläpitäjä voi ottaa sen käyttöön komennolla `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Syntymäpäivä tallennettu: **{day}/{month}**. Toivotan sinulle hyvää syntymäpäivää, kun liityt puhekanavalle sinä päivänä!',
  'birthday.invalid': 'Tuo ei ole oikea päivämäärä. Tarkista päivä ja kuukausi.',
  'birthday.cleared': '🎂 Syntymäpäivä poistettu.',
  'birthday.show': '🎂 Syntymäpäiväsi on asetettu: **{day}/{month}**.',
  'birthday.none': 'Et ole vielä asettanut syntymäpäivää. Käytä `/birthday set`.',
  'topspeakers.title': '🗣️ **Puheliaimmat** — keitä luen eniten tällä palvelimella:',
  'topspeakers.empty':
    'En ole vielä lukenut kenenkään viestejä. Määritä lukukanava komennolla `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** viestiä · 🔥 {streak} päivän putki',
  'serverstats.title': '📊 **Palvelimen tilastot**',
  'serverstats.empty':
    'Ei vielä tilastoja — en ole lukenut viestejä enkä pelannut pelejä täällä. Määritä komennolla `/setup`!',
  'serverstats.messages': '🗣️ **{total}** luettua viestiä · **{speakers}** henkilöä',
  'serverstats.topTalkers': '**Puheliaimmat:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} viestiä · 🔥 {streak}d',
  'serverstats.streak': '🔥 Pisin aktiivinen putki: **{days}** päivää',
  'serverstats.games': '🎮 **{points}** pelipistettä · **{wins}** voittoa · **{players}** pelaajaa',
  'serverstats.topPlayers': '**Parhaat pelaajat:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pistettä · {wins} voittoa',
  'serverstats.upsell':
    '🔒 Tämä on ilmainen esikatselu. **Premium** avaa putket, pelitilastot ja koko top 5 -listan — katso `/premium`.',
  'streak.day': '🔥 <@{user}> on **{n} päivän** putkessa! Jatka puhumista pitääksesi sen elossa.',
  'leaderboard.autoTitle': '🏆 Palvelimen puheliaimmat',
  'premium.title': '💎 **Vozen Premium -tila**',
  'premium.lineServerActive': '🖥️ **Palvelin:** Premium {date} asti',
  'premium.lineServerFree': '🖥️ **Palvelin:** Ilmainen paketti',
  'premium.lineUserActive': '👤 **Sinä (Plus):** aktiivinen {date} asti',
  'premium.lineUserFree': '👤 **Sinä (Plus):** ei aktiivinen',
  'premium.getHint':
    'Kaikki mitä käytät tänään pysyy ilmaisena. Premium lisää kaikki 8 ääniefektiä, 24/7 puhelussa, 50 henkilökohtaista ääntämystä, /rizzin ja premium-pelit. Tuki: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Premium-passisi:** {used}/{total} lisenssiä käytössä · vanhenee {date}',
  'premium.passServers': '↳ Käytössä palvelimilla: {servers}',
  'premium.pitch':
    'Sinulla ei ole vielä Premiumia. **Vozen Premium** (3,99 €/kk 3 palvelimelle tai 7,99 €/kk 8:lle) avaa koko palvelimelle: kaikki 8 ääniefektiä, 24/7 puhelussa, 50 henkilökohtaista ääntämystä (vs 3), /rizz-komennon ja premium-pelit (Word Chain, Wordle, Chess). **Vozen Plus** (1,99 €/kk) antaa nämä edut henkilökohtaisesti sinulle, millä tahansa palvelimella.',
  'premium.buyHint':
    '▶ **Hanki Premium:** {link}\nOston jälkeen suorita `/premium activate` haluamallasi palvelimella.',
  'premium.confirmActivate':
    'Käytetäänkö **1 sinun {total} Premium-lisenssistäsi** **tällä palvelimella**? Sinulla on **{used}** käytössä juuri nyt. Voit vapauttaa sen myöhemmin komennolla `/premium deactivate` — passin kello käy joka tapauksessa.',
  'premium.confirmYes': '💎 Käytä lisenssi',
  'premium.confirmNo': 'Peruuta',
  'premium.activateOk':
    '✅ Premium on nyt aktiivinen **tällä palvelimella** {date} asti. Lisenssit: **{used}/{total}** käytössä.',
  'premium.activateCancelled': 'Peruutettu — lisenssiä ei käytetty.',
  'premium.activateTimeout': 'Aikakatkaisu — lisenssiä ei käytetty.',
  'premium.noPass':
    'Sinulla ei ole aktiivista Premium-passia. Hanki sellainen niin se päätyy tilillesi — suorita sitten `/premium activate` täällä.\n▶ {link}',
  'premium.alreadyActive': 'Tällä palvelimella on jo yksi Premium-lisensseistäsi. Ei tehtävää.',
  'premium.noSeats':
    'Kaikki **{total}** Premium-lisenssiäsi ovat käytössä ({servers}). Vapauta yksi komennolla `/premium deactivate` siellä, yritä sitten täällä uudelleen.',
  'premium.needManageGuild':
    'Premiumin aktivointi vaikuttaa koko palvelimeen — vain jäsenet, joilla on **Hallitse palvelinta**, voivat tehdä sen. Pyydä ylläpitäjää.',
  'premium.deactivateOk':
    '✅ Vapautin tämän palvelimen Premium-lisenssin. Käytä sitä toisella palvelimella komennolla `/premium activate`.',
  'premium.deactivateNone': 'Tällä palvelimella ei ole sinulta Premium-lisenssiä vapautettavaksi.',
  'premium.thisServer': 'tämä palvelin',
  'grant.denied': '⛔ Tämä komento on vain botin omistajalle.',
  'grant.okPremium':
    '✅ Myönnetty <@{user}> **Premium-passi** ({seats} lisenssiä) **{days}** päiväksi — vanhenee {date}. Hän aktivoi sen komennolla `/premium activate`.',
  'grant.okPlus': '✅ Myönnetty <@{user}> **Vozen Plus** **{days}** päiväksi — vanhenee {date}.',
  'gencode.done':
    '✅ Luotu **{count}** {plan}-koodi(a), **{days}** päivää kukin. Jaa ne yksityisesti:\n{list}',
  'redeem.okPlus': '🎁 Lunastettu! Sait **Vozen Plusin** **{days}** päiväksi — vanhenee {date}.',
  'redeem.okPremium':
    '🎁 Lunastettu! Sait **Premium-passin** ({seats} lisenssiä) **{days}** päiväksi — vanhenee {date}. Aktivoi se palvelimellasi komennolla `/premium activate`.',
  'redeem.notFound': '❌ Tuota koodia ei ole olemassa. Tarkista se ja yritä uudelleen.',
  'redeem.used': '❌ Tuo koodi on jo lunastettu.',
  'redeem.expired': '❌ Tuo koodi on vanhentunut.',
  'voice.abbrev.added': 'Selvä — {term} luetaan muodossa {replacement}.',
  'voice.abbrev.removed': 'Poistin lyhenteesi termille {term}.',
  'voice.abbrev.listHeader': 'Omat lyhenteesi ({count}/{cap} käytössä):',
  'voice.abbrev.listEmpty': '(ei vielä yhtään — lisää yksi komennolla /voice abbrev add)',
  'voice.abbrev.capReached':
    'Olet saavuttanut {cap} henkilökohtaisen lyhenteen rajan. Poista yksi ennen kuin lisäät uuden.',
  'voice.abbrev.invalidTerm':
    'Termin on oltava yksi sana (vain kirjaimia ja numeroita), enintään 50 merkkiä.',
  'voice.abbrev.emptyReplacement': 'Luettava teksti ei voi olla tyhjä.',
  'voice.abbrev.tooLong': 'Luettava teksti on liian pitkä (enintään 200 merkkiä).',
  'config.wordEmpty': 'Sana ei voi olla tyhjä.',
  'config.blocked': 'Estetty: {word}.',
  'config.blockLimit':
    'Tällä palvelimella on jo enimmäismäärä {max} estettyä sanaa. Poista yksi ennen kuin lisäät uuden.',
  'config.unblocked': 'Esto poistettu: {word}.',
  'config.pronListHeader': 'Ääntämissanakirja:',
  'config.pronEmptyValue': '(tyhjä)',
  'config.listEmpty': '(ei yhtään)',
  'config.termEmpty': 'Termi ei voi olla tyhjä.',
  'config.pronEmpty': 'Ääntämys ei voi olla tyhjä.',
  'config.pronSet': 'Selvä — {term} luetaan muodossa {replacement}.',
  'config.pronRemoved': 'Poistin ääntämyksen termille {term}.',
  'config.channelWrongType': 'Valitse tekstikanava (ei puhekanava tai kategoria).',
  'config.channelNoAccess': 'En näe kanavaa {channel} — tarkista oikeuteni siellä.',
  'config.channelSet':
    'Automaattisen lukemisen kanavaksi asetettu {channel}. Seuraavaksi: varmista että automaattinen lukeminen on päällä komennolla `/config auto-read active:true`.',
  'config.autoreadOn': 'Automaattinen lukeminen on nyt **päällä**.',
  'config.autoreadOff': 'Automaattinen lukeminen on nyt **pois päältä**.',
  'config.maxCharsRange': 'Merkkien enimmäismäärän on oltava välillä 1 ja 2000.',
  'config.maxCharsSet': 'Merkkien enimmäismääräksi viestiä kohden asetettu {value}.',
  'config.rateLimitRange': 'Nopeusrajan arvon on oltava välillä 1 ja 120.',
  'config.rateLimitSet': 'Nopeusrajaksi asetettu {value} viestiä minuutissa.',
  'config.roleSet': 'Automaattinen lukeminen on nyt rajattu jäseniin, joilla on rooli {role}.',
  'config.roleCleared': 'Roolirajoitus poistettu — kaikki voidaan nyt lukea.',
  'config.enabledOn': 'TTS on nyt **päällä** tällä palvelimella.',
  'config.enabledOff': 'TTS on nyt **pois päältä** tällä palvelimella.',
  'config.xsaidOn':
    'Vozen ilmoittaa nyt **kuka puhui** ennen jokaista viestiä (esim. "Alex sanoi hei"). Poista käytöstä komennolla `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **ei enää** ilmoita kuka puhui — se lukee vain viestin.',
  'config.autojoinOn':
    '✅ Automaattinen liittyminen **päällä** — Vozen liittyy puhekanavallesi, kun kirjoitat TTS-kanavalle.',
  'config.autojoinOff':
    'Automaattinen liittyminen **pois päältä** — käytä `/join` tuodaksesi Vozenin puheeseen.',
  'config.stayOn':
    '✅ 24/7 puhelussa **päällä** — Vozen pysyy puhekanavalla vaikka se tyhjenisi, ja palaa uudelleenkäynnistysten jälkeen. 💎 Vaatii Premiumin tullakseen voimaan (osta tai `/redeem` koodi, sitten `/premium activate`).',
  'config.stayOff':
    '24/7 puhelussa **pois päältä** — Vozen poistuu, kun puhekanava tyhjenee (oletus).',
  'config.readBotsOn': '✅ Vozen lukee nyt myös **muiden bottien ja webhookien** viestit.',
  'config.readBotsOff': 'Vozen **ohittaa** muut botit ja webhookit (vain oikeat ihmiset luetaan).',
  'config.textInVoiceOn': '✅ Vozen lukee myös **puhekanavansa sisäisen tekstichatin**.',
  'config.textInVoiceOff': 'Vozen **ei** lue puhekanavan tekstichattiä (vain TTS-kanavan).',
  'config.antispamOn':
    '✅ Roskapostisuoja **päällä** — Vozen ei lue roskapostitettuja viestejä (sanojen massatoistoa tai samaa isoa viestiä yhä uudelleen).',
  'config.antispamOff':
    'Roskapostisuoja **pois päältä** — Vozen lukee jokaisen viestin normaalisti.',
  'config.streaksOn':
    '✅ Putki-ilmoitukset **päällä** — Vozen näyttää 🔥 päiväputkiviestin ensimmäisen kerran, kun kukin henkilö puhuu joka päivä.',
  'config.streaksOff':
    'Putki-ilmoitukset **pois päältä** — Vozen seuraa putkia edelleen (katso `/top-speakers`) mutta pysyy niistä hiljaa.',
  'config.soundboardOn':
    'Soundboard **päällä** — kuka tahansa voi toistaa klippejä komennolla `/sound`.',
  'config.soundboardOff':
    'Soundboard **pois päältä** — `/sound` on poistettu käytöstä tällä palvelimella.',
  'config.votePromosLabel': 'top.gg-palkintoilmoitukset + Vozen Support',
  'config.greetOn': '✅ Tervehdin ihmisiä nimeltä, kun he liittyvät puhekanavalle.',
  'config.greetOff': '🔇 **En** tervehdi ihmisiä, kun he liittyvät puhekanavalle.',
  'config.greetLangSet': '✅ Liittymistervehdyksen kieleksi asetettu **{language}**.',
  'config.defaultVoiceSet':
    '✅ Palvelimen oletusääneksi asetettu **{name}**. Jäsenet, joilla ei ole omaa ääntä, kuulevat tämän. (id: `{model}`)',
  'config.reset': 'Asetukset palautettu oletuksiin. Estolistasi ja ääntämyksesi säilytettiin.',
  'config.showTitle': '**Palvelimen asetukset**',
  'config.showChannel': 'TTS-kanava: {value}',
  'config.showAutoread': 'Automaattinen lukeminen: {value}',
  'config.showRole': 'Rooli: {value}',
  'config.showEnabled': 'Käytössä: {value}',
  'config.showXsaid': 'Ilmoita puhuja (xsaid): {value}',
  'config.showAutojoin': 'Automaattinen liittyminen: {value}',
  'config.showReadBots': 'Lue botit/webhookit: {value}',
  'config.showTextInVoice': 'Teksti-puheessa: {value}',
  'config.showAntispam': 'Roskapostisuoja: {value}',
  'config.showSoundboard': 'Soundboard (/sound): {value}',
  'config.showGreet': 'Tervehdi liittyessä: {value} ({language})',
  'config.showVoice': 'Oletusääni: {value}',
  'config.showMaxChars': 'Merkkien enimmäismäärä: {value}',
  'config.showRateLimit': 'Nopeusraja: {value}/min',
  'config.showBlocklist': 'Estolista: {count} sanaa',
  'config.showPronunciation': 'Ääntämykset: {count} merkintää',
  'config.valueNone': '(ei yhtään)',
  'config.valueAny': 'kuka tahansa',
  'config.valueAutoDetect': '(automaattinen tunnistus)',
  'config.on': 'päällä',
  'config.off': 'pois päältä',
  'config.language.set': 'Käyttöliittymän kieleksi asetettu {language}.',
  'config.language.unsupported': 'Tuota kieltä ei vielä tueta.',
  'setup.noChannel':
    'En saanut selville, mitä kanavaa käyttää. Anna tekstikanava "channel"-valinnassa.',
  'setup.channelWrongType':
    'Automaattisen lukemisen kanavan on oltava tekstikanava (ei puhekanava tai kategoria). Anna sellainen "channel"-valinnassa.',
  'setup.done': '**Kaikki valmista — Vozen on käyttövalmis.**',
  'setup.channelLine': 'Automaattisen lukemisen kanava: {channel}',
  'setup.autoreadOn': 'Automaattinen lukeminen: päällä',
  'setup.permsHeader': '**Oikeudet:**',
  'setup.permView': 'ViewChannel (näe tekstikanava)',
  'setup.permSend': 'SendMessages (kirjoita tekstikanavalle)',
  'setup.permConnect': 'Connect (liity puhekanavalle)',
  'setup.permSpeak': 'Speak (puhu puhekanavalla)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — puuttuu',
  'setup.permUnchecked': '⏳ {label} — ei vielä tarkistettu (tarkistan sen komennolla /join)',
  'setup.fixHint':
    'Korjataksesi puuttuvat: avaa palvelinasetuksissasi Vozenn rooli (tai kanavan oikeudet) ja ota käyttöön kohdat, jotka on merkitty ❌.',
  'setup.voiceUncheckedNote':
    'Et ole puhekanavalla, joten en voinut vielä tarkistaa Connect/Speak-oikeuksia — tarkistan ne kun suoritat /join.',
  'setup.allGood': 'Kaikki on valmista. Liity puhekanavalle ja suorita /join.',
  'setup.joinedVoice': 'Liityin myös kanavalle {channel} — ei tarvetta suorittaa /join.',
  'setup.readyTalk':
    'Kaikki on valmista. Kirjoita automaattisen lukemisen kanavalle niin luen sen ääneen.',
  'setup.membersHeader': '**Kerro jäsenillesi (3 vaiheen kulku):**',
  'setup.membersBody':
    '1) Liity puhekanavalle\n2) Suorita /join niin hyppään mukaan kanssasi\n3) Kirjoita tälle kanavalle (tai käytä /tts) niin luen sen ääneen\nTäysi komentolista: /help',
  'stats.title': '**Vozenn tilastot**',
  'stats.messagesSpoken': 'Puhuttuja viestejä: {value}',
  'stats.cacheHits': 'Välimuistiosumat: {value}',
  'stats.cacheMisses': 'Välimuistihuutit: {value}',
  'stats.synthErrors': 'Syntetisointivirheet: {value}',
  'stats.synthLatency': 'Syntetisoinnin viive: p50 {p50}ms / p95 {p95}ms ({count} näytettä)',
  'stats.voiceDrops': 'Ääniyhteyden katkokset: {value}',
  'stats.voiceReconnects': 'Uudelleenyhdistykset: {value}',
  'stats.votes': 'top.gg-äänet: {value}',
  'stats.activePlayers': 'Aktiiviset soittimet: {value}',
  'stats.servers': 'Palvelimet: {value}',
  'stats.uptime': 'Käyntiaika: {value}s',
  'speak.emptyMessage': 'Tuossa viestissä ei ole ääneen luettavaa tekstiä.',
  'uptime.text': '🟢 Vozen on ollut online-tilassa **{uptime}**.',
  'botstats.title': '📊 **Vozen — tilastot**',
  'botstats.servers': 'Palvelimet: **{value}**',
  'botstats.voiceSessions': 'Ääni-istuntoja nyt: **{value}**',
  'botstats.messagesSpoken': 'Puhuttuja viestejä: **{value}**',
  'botstats.uptime': 'Käyntiaika: **{value}**',
  'invite.noClientId':
    'Vozenn kutsulinkkiä ei ole vielä määritetty (CLIENT_ID puuttuu). Kerro botin ylläpitäjälle.',
  'invite.link': 'Lisää Vozen palvelimellesi:\n{url}',
  'vote.noClientId':
    'Vozenn äänestyslinkkiä ei ole vielä määritetty (CLIENT_ID puuttuu). Kerro botin ylläpitäjälle.',
  'vote.link':
    'Äänestä Vozena (ilmaista, 12 tunnin välein) ja auta useampia löytämään se:\n{url}\nJos tämä tili ei ole koskaan lunastanut palkintoa, se saa **48 tuntia Vozen Plusia**, vain kerran tiliä kohti.',
  'invite.button': 'Lisää Vozen',
  'vote.button': 'Äänestä top.gg:ssä',
  'vote.upsell':
    '🗳️ Jos tämä tili ei ole koskaan lunastanut palkintoa, se saa **48 tuntia Vozen Plusia**, vain kerran tiliä kohti. {url}',
  'vote.cooldownStatus':
    '🗳️ Tämä tili on jo käyttänyt kertaluonteisen äänestyspalkintonsa. Voit yhä äänestää tukeaksesi Vozenia, mutta et saa lisää Plusia.',
  'help.title': 'Vozen — kirjoita se, kuule se.',
  'help.embedTitle': 'Vozen — Komennot',
  'help.intro': 'Vozen lukee tekstisi ääneen puhekanavilla — ilmaisia neuroääniä, kymmeniä kieliä.',
  'help.quickStartTitle': 'Pika-aloitus (3 vaihetta)',
  'help.quickStartBody':
    '1) Liity puhekanavalle ja suorita sitten /join\n2) Kirjoita tekstikanavalle (tai käytä /tts Hei kaikki!)\n3) (valinnainen) Valitse ääni komennolla /voice set',
  'help.groupStarted': 'Näin pääset alkuun',
  'help.groupStartedBody':
    '• /join — liityn puhekanavallesi\n• /leave — poistun puhekanavalta\n• /tts <teksti> — luen tekstin ääneen · esim. /tts Hei kaikki!\n• /skip — ohita se, mitä luen juuri nyt',
  'help.groupVoice': 'Oma äänesi',
  'help.groupVoiceBody':
    '• /voice set <model> — valitse äänesi · esim. /voice set en_US-amy-medium\n• /voice list — katso saatavilla olevat äänet\n• /voice preview — kuule näyte äänestäsi\n• /voice reset — palaa oletusääneen\n• /voice opt-out · /voice opt-in — poista/ota automaattinen lukeminen käyttöön itsellesi\n• /voice abbrev add|remove|list — henkilökohtainen slangi, luettuna sinun tyylilläsi (enintään 10)',
  'help.groupFun': 'Hauskaa',
  'help.groupFunBody':
    '• /joke — kerron lyhyen vitsin (valitse kieli + valinnainen nauru) · esim. /joke English\n• /laugh — nauran ääneen nykyisellä äänelläsi',
  'help.groupAdmin': 'Palvelimen ylläpito (vaatii Hallitse palvelinta)',
  'help.groupAdminBody':
    '• /setup — ohjattu yhden vaiheen määritys · suorita tämä ensin\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · esim. /config tts-channel #general\n• /stats — botin tilastot',
  'help.groupMore': 'Lisää',
  'help.groupMoreBody':
    '• /invite — lisää Vozen toiselle palvelimelle\n• /vote — äänestä Vozena top.gg-sivustolla\n• /help — näytä tämä ohje',
  'help.footer': 'Uusi täällä? Suorita {command} päästäksesi alkuun.',
  'help.support': '🛟 Tarvitsetko apua tai haluatko ilmoittaa ongelmasta? {url}',
  'help.source':
    '📄 Avoin lähdekoodi (AGPL-3.0) — hae täällä pyörivä täsmällinen lähdekoodi: {url}',
  'welcome.title': 'Kiitos että lisäsit Vozenn! 👋',
  'welcome.description':
    'Vozen lukee chattisi ääneen puhekanavilla — kirjoita se, kuule se.\n\n**Pääset alkuun yhdessä vaiheessa:** suorita {setup} niin määritän automaattisen lukemisen ja liityn puhekanavallesi.\n\nTarvitsetko täyden komentolistan? Suorita {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Näin jäsenet käyttävät sitä (3 vaihetta)',
  'welcome.stepsBody':
    '1) Liity puhekanavalle\n2) Suorita /join niin liityn seuraasi\n3) Kirjoita tekstikanavalle (tai käytä /tts) niin luen sen ääneen\nTäysi komentolista: /help',
  'welcome.footer': 'Vozen — kirjoita se, kuule se.',
  'welcome.tagline': 'Luonnollinen neuroääni — ilmainen ikuisesti, ei maksumuuria.',
  'game.start.needVoice':
    'Tämä on **äänipeli** — hyppää puhekanavalle ja suorita /join ensin, käynnistä se sitten.',
  'game.start.alreadyActive':
    'Peli on jo käynnissä kanavalla <#{channel}>. Lopeta se (tai käytä `/game stop`) ennen kuin aloitat uuden.',
  'game.start.premiumLocked':
    '🔒 **{game}** on Premium-peli (se maksaa oikeaa laskentatehoa). Katso `/premium`.',
  'game.start.started': '🎮 Aloitetaan **{game}**! Seuraa kanavaa — onnea matkaan!',
  'game.start.startedThread':
    '🎮 **{game}** alkoi kanavalla <#{channel}> — liity sinne! Ketju poistuu itsestään, kun peli päättyy.',
  'game.thread.winner': '🏆 {winner} voitti pelin!',
  'game.thread.ended': '🎮 Peli päättyi.',
  'game.unknownGame': 'En tunne tuota peliä. Valitse jokin listasta.',
  'game.stop.ok': '🛑 Pysäytin nykyisen pelin.',
  'game.stop.none': 'Mikään peli ei ole käynnissä juuri nyt.',
  'game.list.title': '🎮 **Pelit** — aloita jokin komennolla `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Tulostaulu** — tämän palvelimen parhaat pelaajat:',
  'game.leaderboard.empty': 'Yhtään peliä ei ole vielä pelattu. Ole ensimmäinen — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pistettä ({wins} voittoa)',
  'game.finish.title': '🏁 **Peli päättyi!** Loppupisteet:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Peli päättyi — kukaan ei pistänyt tällä kertaa. Ensi kerralla!',
  'game.finish.winnerVoice': '{user} voittaa!',
  'game.guessLanguage.name': 'Arvaa kieli',
  'game.guessLanguage.desc':
    'Luen lauseen satunnaisella kielellä — ensimmäinen, joka nimeää sen, voittaa pisteen.',
  'game.guessLanguage.intro':
    '🗣️ **Arvaa kieli** — luen {rounds} lausetta. Kirjoita, minkä kielen kuulet. Nopein oikea vastaus voittaa joka kierroksen!',
  'game.guessLanguage.round': '🎧 Kierros {n}/{total} — kuuntele…',
  'game.guessLanguage.correct': '✅ **{user}** arvasi — se oli **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Aika loppui! Se oli **{language}**.',
  'game.guessLanguage.noLanguages':
    'Minulla ei ole tarpeeksi ääniä asennettuna tämän pelaamiseen. Pyydä ylläpitäjää lisäämään ääniä.',
  'game.math.name': 'Päässälasku',
  'game.math.desc': 'Sanon laskun ääneen — ensimmäinen, joka kirjoittaa vastauksen, voittaa.',
  'game.math.intro':
    '🔢 **Päässälasku** — {rounds} laskua. Kuuntele ja kirjoita vastaus niin nopeasti kuin voit!',
  'game.math.round': '🧮 Kierros {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** osui oikeaan — vastaus oli **{answer}**!',
  'game.math.timeout': '⏱️ Aika loppui! Vastaus oli **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'miinus',
  'game.math.times': 'kertaa',
  'game.skipCount.name': 'Puuttuva numero',
  'game.skipCount.desc':
    'Lasken ääneen mutta hyppään yhden numeron yli — ensimmäinen, joka huomaa sen, voittaa.',
  'game.skipCount.intro':
    '🔢 **Puuttuva numero** — lasken, mutta hyppään yhden yli. Kirjoita puuttuva numero! ({rounds} kierrosta)',
  'game.skipCount.round': '👂 Kierros {n}/{total} — minkä numeron hyppäsin yli?',
  'game.skipCount.correct': '✅ **{user}** huomasi sen — hyppäsin numeron **{answer}** yli!',
  'game.skipCount.timeout': '⏱️ Aika loppui! Hyppäsin numeron **{answer}** yli.',
  'game.spelling.name': 'Tavauskisa',
  'game.spelling.desc': 'Sanon sanan — ensimmäinen, joka tavaa sen oikein, voittaa.',
  'game.spelling.intro':
    '✍️ **Tavauskisa** — sanon {rounds} sanaa. Kirjoita jokainen oikein tavattuna!',
  'game.spelling.round': '🗣️ Kierros {n}/{total} — kirjoita sana, jonka sanon…',
  'game.spelling.correct': '✅ **{user}** tavasi sanan **{word}** oikein!',
  'game.spelling.timeout': '⏱️ Aika loppui! Sana oli **{word}**.',
  'game.spelling.empty': 'Minulla ei ole vielä sanalistaa tämän palvelimen äänen kielelle.',
  'game.spellOut.name': 'Selvitä tavaus',
  'game.spellOut.desc':
    'Tavaan sanan kirjain kirjaimelta — ensimmäinen, joka kirjoittaa koko sanan, voittaa.',
  'game.spellOut.intro':
    '🔡 **Selvitä tavaus** — tavaan {rounds} sanaa kirjain kirjaimelta. Kirjoita koko sana!',
  'game.spellOut.round': '🔤 Kierros {n}/{total} — kuuntele kirjaimia…',
  'game.spellOut.correct': '✅ **{user}** arvasi — **{word}**!',
  'game.spellOut.timeout': '⏱️ Aika loppui! Se tavasi **{word}**.',
  'game.fastSpeech.name': 'Nopea puhe',
  'game.fastSpeech.desc':
    'Luen lauseen supernopeasti — ensimmäinen, joka kirjoittaa mitä sanoin, voittaa.',
  'game.fastSpeech.intro':
    '💨 **Nopea puhe** — {rounds} lausetta järjettömällä nopeudella. Kirjoita mitä kuulet!',
  'game.fastSpeech.round': '⚡ Kierros {n}/{total} — täältä pesee, nopeasti!',
  'game.fastSpeech.correct': '✅ **{user}** tulkitsi sen: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Aika loppui! Se oli: “{phrase}”',
  'game.fastSpeech.empty': 'Minulla ei ole vielä lauseita tämän palvelimen äänen kielelle.',
  'game.accentSwap.name': 'Hassu aksentti',
  'game.accentSwap.desc':
    'Sanon sanan vieraalla aksentilla — ensimmäinen, joka kirjoittaa sen, voittaa.',
  'game.accentSwap.intro':
    '🎭 **Hassu aksentti** — {rounds} sanaa sanottuna väärällä aksentilla. Kirjoita sana!',
  'game.accentSwap.round': '🌍 Kierros {n}/{total} — mitä sanaa yritän sanoa?',
  'game.accentSwap.correct': '✅ **{user}** arvasi — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Aika loppui! Sana oli **{word}**.',
  'game.reflexes.name': 'Refleksit',
  'game.reflexes.desc':
    'Lasken alaspäin ja huudan sitten NYT — ensimmäinen, joka kirjoittaa sen jälkeen, voittaa. Älä hätäile liian aikaisin!',
  'game.reflexes.intro':
    '⚡ **Refleksit** — {rounds} kierrosta. Kun huudan **NYT**, kirjoita mitä tahansa niin nopeasti kuin voit. Kirjoita ennen NYT-huutoa ja se on varaslähtö!',
  'game.reflexes.ready': '🚦 Kierros {n}/{total} — valmiina…',
  'game.reflexes.countdown': 'kolme… kaksi… yksi…',
  'game.reflexes.go': '🟢 **NYT!!!**',
  'game.reflexes.goVoice': 'Nyt!',
  'game.reflexes.tooSoon': '🔴 **{user}** hätäili — liian aikaisin!',
  'game.reflexes.win': '⚡ **{user}** on nopein! Piste!',
  'game.reflexes.tooSlow': '😴 Kukaan ei reagoinut ajoissa. Seuraava!',
  'game.headsOrTails.name': 'Kruuna vai klaava',
  'game.headsOrTails.desc':
    'Arvaa kolikonheitto — kirjoita `heads` tai `tails` ennen kuin heitän. Paras arvaaja voittaa!',
  'game.headsOrTails.intro':
    '🪙 **Kruuna vai klaava** — {rounds} kierrosta. Joka kierros kirjoita `heads` tai `tails` ennen kuin heitän kolikon. 1 piste per oikea arvaus!',
  'game.headsOrTails.introVoice': 'Pelataan kruunaa vai klaavaa!',
  'game.headsOrTails.round': '🪙 Kierros {n}/{total} — heads vai tails? Kirjoita arvauksesi!',
  'game.headsOrTails.roundVoice': 'Heads… vai tails?',
  'game.headsOrTails.heads': 'heads',
  'game.headsOrTails.tails': 'tails',
  'game.headsOrTails.resultVoice': 'Tuli {side}!',
  'game.headsOrTails.winners': 'Tuli **{side}**! Piste: {users}',
  'game.headsOrTails.noWinners': 'Tuli **{side}**! Kukaan ei arvannut — ei pisteitä.',
  'game.vozenSays.name': 'Vozen sanoo',
  'game.vozenSays.desc':
    "Tottele vain, kun käsky alkaa sanoilla 'Vozen sanoo'. Lankea ansaan ja jäät kiinni!",
  'game.vozenSays.intro':
    "🫡 **Vozen sanoo** — {rounds} käskyä. Tee se VAIN, jos aloitan sanoilla **'Vozen sanoo'**. Muuten älä liiku!",
  'game.vozenSays.prefix': 'Vozen sanoo',
  'game.vozenSays.verb': 'kirjoittakaa',
  'game.vozenSays.real': '🗣️ Kierros {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Kierros {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** totteli ensimmäisenä — piste!',
  'game.vozenSays.caught': '🔴 **{user}** — en sanonut Vozen sanoo! Kiinni jäit!',
  'game.vozenSays.nobody': '😴 Kukaan ei totellut käskyä **{word}** ajoissa. Seuraava!',
  'game.vozenSays.trapCleared':
    '😌 Se oli ansa — hyvin huomattu, kukaan ei langennut sanaan **{word}**.',
  'game.roulette.name': 'Totuus vai tehtävä -ruletti',
  'game.roulette.desc':
    'Pyöritän ja luen yhden totuus vai tehtävä -kehotteen ääneen. Suorita uudelleen saadaksesi toisen.',
  'game.roulette.header': '🎯 **Ruletti sanoo…**',
  'game.hangman.name': 'Hirsipuu',
  'game.hangman.desc': 'Arvaa sana kirjain kerrallaan — 6 virhettä ja peli on ohi.',
  'game.hangman.intro':
    '🪢 **Hirsipuu** — kirjoita yksi kirjain kerrallaan arvataksesi sanan. Voit myös kirjoittaa koko sanan!',
  'game.hangman.hit': '🟢 **{user}** löysi kirjaimen **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — ei kirjainta **{letter}**.',
  'game.hangman.wrongLetters': 'Väärin: {letters}',
  'game.hangman.win': '🎉 **{user}** ratkaisi sen — **{word}**!',
  'game.hangman.lose': '💀 Yritykset loppuivat! Sana oli **{word}**.',
  'game.hangman.idle': '🕹️ Peli keskeytetty (kukaan ei pelaa). Sana oli **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Arvaa 5-kirjaiminen sana. 🟩 oikea paikka, 🟨 väärä paikka, ⬛ ei sanassa. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — kirjoita 5-kirjaiminen sana. Jaatte {max} arvausta. 🟩 oikea paikka · 🟨 väärä paikka · ⬛ ei sanassa.',
  'game.wordle.guess': '🔤 **{user}** arvasi — **{left}** arvausta jäljellä',
  'game.wordle.inWord': '🟢 sanassa: {letters}',
  'game.wordle.out': '🚫 pois: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** arvasi {n} yrityksellä — **{word}**!',
  'game.wordle.lose': '💀 Arvaukset loppuivat! Sana oli **{word}**.',
  'game.wordle.idle': '🕹️ Peli keskeytetty (kukaan ei pelaa). Sana oli **{word}**.',
  'game.tictactoe.name': 'Ristinolla',
  'game.tictactoe.desc':
    'Kaksi pelaajaa — kirjoita numero 1-9 asettaaksesi merkkisi. Kolme rivissä voittaa.',
  'game.tictactoe.intro':
    '⭕ **Ristinolla** — kaksi ensimmäistä siirtoa tekevää ovat ❌ ja ⭕ (❌ aloittaa). Kirjoita numero 1-9 pelataksesi ruutuusi.',
  'game.tictactoe.turn': 'Vuoro: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, nyt on **{mark}**:n vuoro.',
  'game.tictactoe.taken': '🚫 Ruutu {cell} on varattu — valitse toinen.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) voittaa!',
  'game.tictactoe.draw': '🤝 Tasapeli!',
  'game.tictactoe.idle': '🕹️ Peli päättyi (kukaan ei pelaa).',
  'game.chess.name': 'Šakki',
  'game.chess.desc':
    'Kaksi pelaajaa — oikeat šakin säännöt (šakki, linnoitus, korotus…). Kirjoita siirto kuten "e4" tai "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Šakki** — kaksi ensimmäistä siirtoa tekevää ovat valkoinen ja musta (valkoinen aloittaa). Kirjoita siirto algebrallisessa notaatiossa ("e4", "Nf3", "O-O") tai koordinaateilla ("e2e4"). Kirjoita "resign" luovuttaaksesi.',
  'game.chess.white': 'valkoinen',
  'game.chess.black': 'musta',
  'game.chess.seats': '⚪ Valkoinen: **{white}** · ⚫ Musta: **{black}**',
  'game.chess.turn': '{move} — vuoro: **{color}**',
  'game.chess.check': '♟️ Šakki!',
  'game.chess.notYourTurn': '⏳ **{user}**, nyt on **{color}**:n vuoro.',
  'game.chess.illegalMove': '🚫 "{move}" ei ole sallittu siirto — yritä uudelleen.',
  'game.chess.checkmate': '🏆 Šakkimatti ({move})! **{user}** voittaa!',
  'game.chess.draw': '🤝 Tasapeli ({move})!',
  'game.chess.resigned': '🏳️ **{user}** luovutti — **{winner}** voittaa!',
  'game.chess.idle': '🕹️ Peli päättyi (kukaan ei pelaa).',
  'game.wordChain.name': 'Sanaketju',
  'game.wordChain.descr':
    'Vuoropohjainen sanaketju yhdellä kielellä: sano sana, joka alkaa edellisen viimeisellä kirjaimella. 2 elämää, ei toistoja, kello kiihtyy. Valitse kieli `language`-valinnalla. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Sanaketju ei ole saatavilla kielellä **{lang}** juuri nyt (sanalista puuttuu).',
  'game.wordChain.lobby':
    '🔗 **Sanaketju** kielellä **{lang}**! Kirjoita jotain tälle kanavalle **{seconds}s** kuluessa liittyäksesi.',
  'game.wordChain.notEnough':
    '😴 Ei tarpeeksi pelaajia liittyi (vähintään 2 tarvitaan). Peli peruutettu.',
  'game.wordChain.begin':
    '🚀 Aloitetaan! Pelaajat: {players}. Jokaisen sanan on alettava edellisen viimeisellä kirjaimella.',
  'game.wordChain.turn':
    '**{name}**, sinun vuorosi! **{lang}**-sana, joka alkaa kirjaimella **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — seuraava kirjain: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Sen on alettava kirjaimella **{letter}**.',
  'game.wordChain.bad.short': '📏 Liian lyhyt — vähintään **{min}** kirjainta.',
  'game.wordChain.bad.repeated': '🔁 Tuota sanaa on jo käytetty.',
  'game.wordChain.bad.word': '📖 Tuota ei ole sanakirjassa.',
  'game.wordChain.bad.latin': '🔤 Vain kirjaimet A–Z lasketaan.',
  'game.wordChain.timeout': '⏰ **{name}**:lta loppui aika! {hearts} jäljellä.',
  'game.wordChain.eliminated': '💀 **{name}** on ulkona!',
  'game.wordChain.winner': '🏆 **{name}** voittaa ketjun! ({chain} sanaa)',
  'game.stats.none': 'Et ole vielä pelannut yhtään peliä. Kokeile `/game play`!',
  'game.stats.body': '🎮 **Tilastosi** — **{points}** pistettä · **{wins}** voittoa · {rank}',
  'game.stats.rank': 'sija **#{rank}** / {total}',
  'game.stats.unranked': 'ei vielä sijoitusta',
  'game.pickPrompt': '🎮 Mitä peliä haluat pelata? Valitse yksi:',
  'game.pickPlaceholder': 'Valitse peli…',
  'game.pickTimeout': '⏰ Peliä ei valittu — suorita `/game play` uudelleen kun olet valmis.',
  'pron.listHeader': '🗣️ **Ääntämyksesi** ({count}/{limit}):',
  'pron.listEmpty': 'Sinulla ei ole vielä yhtään — lisää yksi komennolla `/pronunciation add`.',
  'pron.set': '✅ Tallennettu! Kun **sinä** kirjoitat “{term}”, sanon “{replacement}”.',
  'pron.removed': '🗑️ Poistettu “{term}”.',
  'pron.notFound':
    'Sinulla ei ole ääntämystä termille “{term}”. Katso omasi komennolla `/pronunciation list`.',
  'pron.empty': 'Sana ja sen sanomistapa eivät voi olla tyhjiä.',
  'pron.limitHit':
    '🔒 Saavutit rajasi **{limit}** ääntämystä. Poista yksi komennolla `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus tai Premium nostaa sen **50**:een → {url}',
  'pron.modalTitle': 'Opeta Vozenille ääntämys',
  'pron.modalTerm': 'Sana (kuten ihmiset kirjoittavat sen)',
  'pron.modalSay': 'Miten Vozenin tulisi sanoa se',
  'spron.listHeader': '🗣️ **Palvelimen ääntämykset** ({count}/{limit}) — koskevat kaikkia:',
  'spron.listEmpty': 'Ei vielä yhtään — lisää yksi komennolla `/server-pronunciation add`.',
  'spron.set': '✅ Tallennettu koko palvelimelle! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ Poistettu “{term}” palvelimelta.',
  'spron.notFound': 'Palvelimella ei ole ääntämystä termille “{term}”.',
  'spron.limitHit':
    '🔒 Palvelin saavutti rajansa **{limit}** ääntämystä. Poista yksi komennolla `/server-pronunciation remove`.',
  'spron.modalTitle': 'Palvelimen ääntämys',
  'spron.modalSay': 'Miten Vozen sanoo sen kaikille',
  'rand.selectPrompt': '🎲 **Randomizer** — kuinka monesta vaihtoehdosta haluat minun valitsevan?',
  'rand.selectPlaceholder': 'Vaihtoehtojen määrä…',
  'rand.selectOption': '{n} vaihtoehtoa',
  'rand.filling': '📝 Täytä juuri avautunut lomake!',
  'rand.modalTitle': 'Randomizer — {amount} vaihtoehtoa',
  'rand.modalOption': 'Vaihtoehto {n}',
  'rand.needTwo':
    'Anna minulle vähintään 2 vaihtoehtoa pilkuilla eroteltuna (esim. "pizza, sushi").',
  'rand.result': 'Kaikista {count} vaihtoehdosta valitsen… **{winner}**!',
  'rand.speak': 'Valitsen… {winner}!',
  'rand.notInVoice': '_(liity puhekanavalle kanssani niin sanon sen ääneen ensi kerralla)_',
  'rand.timeout': '⏰ Mitään ei valittu — suorita `/randomizer` uudelleen kun olet valmis.',
};
