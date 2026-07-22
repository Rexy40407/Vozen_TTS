export default {
  'error.generic': 'Något gick fel. Försök igen.',
  'stt.guildOnly': 'Transkribering fungerar bara inne i en server.',
  'stt.noManage':
    'Du behöver behörigheten **Hantera server** för att starta eller stoppa transkribering.',
  'stt.notPremium':
    '🎙️ Livetranskribering är en **Premium**-funktion. Se `/premium info` för att låsa upp den för den här servern.',
  'stt.unavailable':
    'Transkribering är inte tillgänglig på den här instansen (tal-till-text-motorn är inte installerad).',
  'stt.notInVoice':
    'Jag är inte i någon röstkanal — gå med i en och kör `/join` först, starta sedan transkriberingen.',
  'stt.alreadyRunning':
    'Transkribering körs redan på den här servern. Använd `/transcribe stop` först.',
  'stt.atCapacity':
    'För många transkriberingar körs just nu på alla servrar. Försök igen om en liten stund.',
  'stt.noChannel':
    'Jag kan inte posta transkript i den här kanalen. Prova att köra kommandot från en vanlig textkanal.',
  'stt.started':
    '✅ Transkribering startad. Alla som trycker på **Samtyck** i tillkännagivandet transkriberas till den här kanalen.',
  'stt.startFailed':
    'Kunde inte starta transkriberingen (det gick inte att posta tillkännagivandet). Jag har ångrat allt — inget spelas in. Försök igen.',
  'stt.announceStart':
    '🎙️ **Livetranskribering är PÅ i den här kanalen.** Bara de som samtycker transkriberas — tryck på knappen nedan för att tillåta att ditt tal skrivs ner här. Du kan återkalla när som helst med `/transcribe revoke`.',
  'stt.consentBtn': 'Samtyck till transkribering',
  'stt.consentThanks':
    '✅ Tack — ditt tal transkriberas nu på den här servern. Återkalla när som helst med `/transcribe revoke`.',
  'stt.stopped': '🛑 Transkribering stoppad.',
  'stt.notRunning': 'Transkribering körs inte på den här servern.',
  'stt.announceStop': '🛑 **Livetranskribering är nu AV.** Jag slutade lyssna.',
  'stt.revoked':
    '✅ Samtycke återkallat — du transkriberas inte längre på den här servern. (Redan postade meddelanden ligger kvar; radera dem i Discord om du vill.)',
  'stt.revokeNone':
    'Du hade inte samtyckt till transkribering på den här servern, så det fanns inget att återkalla.',
  'privacy.eraseConfirm':
    '⚠️ Detta raderar permanent **alla** dina Vozen-data på varje server: röstinställningar, uppläst smeknamn, personliga förkortningar och uttal, sparad födelsedag, spelpoäng, pratstatistik och opt-out. **Detta kan inte ångras.** Är du säker?',
  'privacy.erasePremiumNote':
    '_Obs: ditt betalda Premium/Plus och dess köphistorik behålls — de tillhör dig och de finansiella uppgifter som krävs enligt lag. För att avsluta Premium, låt det gå ut eller kontakta supporten._',
  'privacy.eraseYes': 'Radera allt',
  'privacy.eraseNo': 'Avbryt',
  'privacy.eraseCancelled': 'Avbrutet — inget raderades.',
  'privacy.eraseDone': '✅ Klart. Alla dina personuppgifter har raderats permanent.',
  'error.needManageGuild': 'Du behöver behörigheten **Hantera server** för att göra det.',
  'join.needVoiceChannel': 'Hoppa in i en röstkanal först och kör sedan /join.',
  'join.missingPerms': 'Jag behöver behörigheterna **Anslut** och **Tala** i {channel}.',
  'join.joined':
    '✅ Jag är i {channel}! Nästa steg: skriv `/tts hej` så läser jag upp det. Vill du att jag ska läsa upp en kanal automatiskt? Kör /setup.',
  'join.joinedAutoread':
    '✅ Jag är i {channel}! Allt är redo. Skriv i kanalen för automatisk uppläsning så läser jag upp det. → {readChannel}',
  'leave.left': 'Lämnade röstkanalen. Vi ses nästa gång!',
  'skip.notInVoice':
    'Jag är inte i någon röstkanal än — gå med i en och kör /join först, försök sedan igen.',
  'skip.skipped': 'Hoppade över.',
  'skip.nothing': 'Inget spelas just nu.',
  'shutup.notInVoice': 'Jag är inte i någon röstkanal än — gå med i en och kör /join först.',
  'shutup.nothing': 'Inget spelas just nu.',
  'shutup.done': '🤐 Okej, jag slutar — rensade allt i kön.',
  'tts.notInVoice':
    'Jag är inte i någon röstkanal än — gå med i en och kör /join, försök sedan igen.',
  'tts.nothingToRead': 'Det finns inget att läsa där — skicka mig text att säga.',
  'tts.nothingAfterClean':
    'Efter att ha rensat upp det fanns inget kvar att läsa — prova med vanlig text (bokstäver eller ord).',
  'tts.tooFast': 'Oj, ta det lite lugnt — försök igen om en stund.',
  'tts.blocked': 'Den texten innehåller ett blockerat ord, så jag hoppade över den.',
  'tts.queued': 'Uppfattat — den ligger i kön.',
  'tts.busy': 'Jag är upptagen just nu — försök igen om en stund.',
  'voice.unknownModel': 'Jag känner inte till den rösten — kolla /voice list.',
  'voice.badSpeed':
    'Hastigheten måste vara mellan 0.5 och 2.0 (1.0 är normalt). Prova `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Din röst är nu **{name}** i {speed}×. Prova `/tts hej` för att höra den. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Röstinställning** — välj alternativen nedan och tryck sedan på **Spara**. Inget ändras förrän du gör det.',
  'voice.config.summary': 'Aktuellt val: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Språk…',
  'voice.config.pickVoice': 'Röst…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Hastighet…',
  'voice.config.more': '▼ Fler språk',
  'voice.config.engDefault': 'Standard (lokal)',
  'voice.config.save': 'Spara',
  'voice.config.cancel': 'Avbryt',
  'voice.config.cancelled': 'Inställningen avbröts — inget ändrades.',
  'voice.config.expired': 'Panelen har gått ut — kör `/voice config` igen för att fortsätta.',
  'voice.listHeader': 'Tillgängliga röster:',
  'voice.listEmpty': '(inga installerade)',
  'voice.reset':
    '✅ Din röst är återställd till standard. Välj en annan när som helst med `/voice list` och `/voice set`.',
  'voice.detection.on':
    '✅ Automatisk språkidentifiering är PÅ: varje meddelande läses upp med en röst för det identifierade språket (uppläsaren kan ändras). Stäng av med `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Automatisk språkidentifiering är AV: din enda fasta röst läser allt, så du låter alltid likadan.',
  'voice.optout':
    'Du läses inte upp automatiskt längre. Kör /voice opt-in för att slå på det igen.',
  'voice.optin': 'Du läses upp automatiskt igen.',
  'voice.nickname.set': '✅ Vozen kommer nu att kalla dig **{name}** högt.',
  'voice.nickname.cleared': '✅ Upplästa smeknamnet borttaget — Vozen använder ditt servernamn.',
  'voice.nickname.invalid':
    'Det namnet har inget uppläsbart att säga högt. Prova bokstäver eller siffror.',
  'voice.effect.set':
    '✅ Rösteffekt satt till **{effect}** — dina meddelanden spelas nu upp med den effekten. Använd `/voice effect none` för att stänga av.',
  'voice.effect.cleared': '✅ Rösteffekt borttagen — ren röst igen.',
  'voice.effect.locked':
    '🔒 **{effect}** är en Premium-effekt. Gratiseffekter: 🤖 Robot och 🔊 Echo. Lås upp alla med Vozen Premium — se `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** är en Premium-röstmotor. Lås upp den med Vozen Plus (personligt) eller Vozen Premium (server) — se `/premium`. Under tiden stannar din röst på den gratis lokala motorn.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** är en Premium-röstmotor. Lås upp den med Vozen Plus (personligt) eller Vozen Premium (server) — se `/premium`. Under tiden stannar din röst på den gratis lokala motorn.',
  'voice.notInVoice': 'Jag är inte i någon röstkanal än — kör /join först.',
  'voice.previewPlaying': 'Spelar upp ett prov…',
  'preview.sample': 'Hej, jag är Vozen. skriv det, hör det.',
  'laugh.playing': 'Haha! Spelar upp det med din röst…',
  'joke.playing': 'Berättar ett skämt…\n> {joke}',
  'joke.unknownLang': 'Jag känner inte till det språket. Välj ett från listan.',
  'rizz.playing': '😏 Kastar ur mig lite rizz…\n> {line}',
  'rizz.unknownLang': 'Jag känner inte till det språket. Välj ett från listan.',
  'rizz.locked':
    '🔒 **/rizz** är en Premium-förmån. Lås upp den med Vozen Plus (du) eller Premium (den här servern). Se `/premium`.',
  'sound.playing': '🔊 Spelar **{name}**…',
  'sound.unknown': 'Jag har inte det ljudet. Kör `/sound` för att se listan.',
  'sound.list':
    '🔊 **Ljud:** {sounds}\nSpela ett med `/sound name:<sound>` (jag måste vara i din röstkanal).',
  'sound.disabled':
    '🔇 Ljudbrädan är **av** på den här servern. En admin kan aktivera den med `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Födelsedag sparad: **{day}/{month}**. Jag önskar dig grattis när du går med i en röstkanal den dagen!',
  'birthday.invalid': 'Det är inget riktigt datum. Kontrollera dag och månad.',
  'birthday.cleared': '🎂 Födelsedag borttagen.',
  'birthday.show': '🎂 Din födelsedag är inställd på **{day}/{month}**.',
  'birthday.none': 'Du har inte angett någon födelsedag än. Använd `/birthday set`.',
  'topspeakers.title': '🗣️ **Toppratare** — vilka jag läser upp mest på den här servern:',
  'topspeakers.empty':
    'Jag har inte läst upp någons meddelanden än. Ställ in en uppläsningskanal med `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** meddelanden · 🔥 {streak} dagars streak',
  'serverstats.title': '📊 **Serverstatistik**',
  'serverstats.empty':
    'Ingen statistik än — jag har inte läst upp några meddelanden eller kört några spel här. Ställ in med `/setup`!',
  'serverstats.messages': '🗣️ **{total}** upplästa meddelanden · **{speakers}** personer',
  'serverstats.topTalkers': '**Toppratare:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} medd. · 🔥 {streak}d',
  'serverstats.streak': '🔥 Längsta aktiva streak: **{days}** dagar',
  'serverstats.games': '🎮 **{points}** spelpoäng · **{wins}** vinster · **{players}** spelare',
  'serverstats.topPlayers': '**Toppspelare:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} p · {wins} vinster',
  'serverstats.upsell':
    '🔒 Det är gratisförhandsvisningen. **Premium** låser upp streaks, spelstatistik och hela topp 5 — se `/premium`.',
  'streak.day':
    '🔥 <@{user}> har en **{n} dagars** streak! Fortsätt prata för att hålla den vid liv.',
  'leaderboard.autoTitle': '🏆 Toppratare på den här servern',
  'premium.title': '💎 **Vozen Premium-status**',
  'premium.lineServerActive': '🖥️ **Server:** Premium till {date}',
  'premium.lineServerFree': '🖥️ **Server:** Gratisplan',
  'premium.lineUserActive': '👤 **Du (Plus):** aktiv till {date}',
  'premium.lineUserFree': '👤 **Du (Plus):** inte aktiv',
  'premium.getHint':
    'Allt du använder idag förblir gratis. Premium lägger till alla 8 rösteffekter, 24/7 i samtal, 50 personliga uttal, /rizz och premiumspelen. Stöd: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Ditt Premium-pass:** {used}/{total} licenser i bruk · går ut {date}',
  'premium.passServers': '↳ I bruk på: {servers}',
  'premium.pitch':
    'Du har inte Premium än. **Vozen Premium** (€3.99/mån för 3 servrar, eller €7.99/mån för 8) låser upp för hela servern: alla 8 rösteffekter, 24/7 i samtal, 50 personliga uttal (mot 3), /rizz-kommandot och premiumspelen (Ordkedja, Wordle, Schack). **Vozen Plus** (€1.99/mån) ger dig de förmånerna personligen, på vilken server som helst.',
  'premium.buyHint':
    '▶ **Skaffa Premium:** {link}\nEfter köpet, kör `/premium activate` på servern du vill ha.',
  'premium.confirmActivate':
    'Använd **1 av dina {total} Premium-licenser** på **den här servern**? Du har **{used}** i bruk just nu. Du kan frigöra den senare med `/premium deactivate` — klockan tickar på passet oavsett.',
  'premium.confirmYes': '💎 Använd en licens',
  'premium.confirmNo': 'Avbryt',
  'premium.activateOk':
    '✅ Premium är nu aktivt på **den här servern** till {date}. Licenser: **{used}/{total}** i bruk.',
  'premium.activateCancelled': 'Avbrutet — ingen licens användes.',
  'premium.activateTimeout': 'Tidsgränsen nåddes — ingen licens användes.',
  'premium.noPass':
    'Du har inget aktivt Premium-pass. Skaffa ett så hamnar det på ditt konto — kör sedan `/premium activate` här.\n▶ {link}',
  'premium.alreadyActive': 'Den här servern har redan en av dina Premium-licenser. Inget att göra.',
  'premium.noSeats':
    'Alla dina **{total}** Premium-licenser är i bruk ({servers}). Frigör en med `/premium deactivate` där, försök sedan igen här.',
  'premium.needManageGuild':
    'Att aktivera Premium påverkar hela servern — bara medlemmar med **Hantera server** kan göra det. Fråga en admin.',
  'premium.deactivateOk':
    '✅ Frigjorde den här serverns Premium-licens. Använd den på en annan server med `/premium activate`.',
  'premium.deactivateNone': 'Den här servern har ingen Premium-licens från dig att frigöra.',
  'premium.thisServer': 'den här servern',
  'grant.denied': '⛔ Det här kommandot är bara för bottens ägare.',
  'grant.okPremium':
    '✅ Gav <@{user}> ett **Premium-pass** ({seats} licenser) i **{days}** dagar — går ut {date}. De aktiverar det med `/premium activate`.',
  'grant.okPlus': '✅ Gav <@{user}> **Vozen Plus** i **{days}** dagar — går ut {date}.',
  'gencode.done':
    '✅ Genererade **{count}** {plan}-kod(er), **{days}** dagar var. Dela dem privat:\n{list}',
  'redeem.okPlus': '🎁 Inlöst! Du fick **Vozen Plus** i **{days}** dagar — går ut {date}.',
  'redeem.okPremium':
    '🎁 Inlöst! Du fick ett **Premium-pass** ({seats} licenser) i **{days}** dagar — går ut {date}. Aktivera det på din server med `/premium activate`.',
  'redeem.notFound': '❌ Den koden finns inte. Dubbelkolla den och försök igen.',
  'redeem.used': '❌ Den koden har redan lösts in.',
  'redeem.expired': '❌ Den koden har gått ut.',
  'voice.abbrev.added': 'Uppfattat — {term} kommer att läsas som {replacement}.',
  'voice.abbrev.removed': 'Tog bort din förkortning för {term}.',
  'voice.abbrev.listHeader': 'Dina personliga förkortningar ({count}/{cap} använda):',
  'voice.abbrev.listEmpty': '(inga än — lägg till en med /voice abbrev add)',
  'voice.abbrev.capReached':
    'Du har nått gränsen på {cap} personliga förkortningar. Ta bort en innan du lägger till en ny.',
  'voice.abbrev.invalidTerm':
    'Termen måste vara ett enda ord (endast bokstäver och siffror), upp till 50 tecken.',
  'voice.abbrev.emptyReplacement': 'Uppläsningen kan inte vara tom.',
  'voice.abbrev.tooLong': 'Uppläsningen är för lång (max 200 tecken).',
  'config.wordEmpty': 'Ordet kan inte vara tomt.',
  'config.blocked': 'Blockerade: {word}.',
  'config.blockLimit':
    'Den här servern har redan maxantalet {max} blockerade ord. Ta bort ett innan du lägger till ett nytt.',
  'config.unblocked': 'Avblockerade: {word}.',
  'config.pronListHeader': 'Uttalsordlista:',
  'config.pronEmptyValue': '(tom)',
  'config.listEmpty': '(inga)',
  'config.termEmpty': 'Termen kan inte vara tom.',
  'config.pronEmpty': 'Uttalet kan inte vara tomt.',
  'config.pronSet': 'Uppfattat — {term} kommer att läsas som {replacement}.',
  'config.pronRemoved': 'Tog bort uttalet för {term}.',
  'config.channelWrongType': 'Välj en textkanal (inte en röstkanal eller en kategori).',
  'config.channelNoAccess': 'Jag kan inte se {channel} — kontrollera mina behörigheter där.',
  'config.channelSet':
    'Kanal för automatisk uppläsning satt till {channel}. Nästa: se till att automatisk uppläsning är på med `/config auto-read active:true`.',
  'config.autoreadOn': 'Automatisk uppläsning är nu **på**.',
  'config.autoreadOff': 'Automatisk uppläsning är nu **av**.',
  'config.maxCharsRange': 'Värdet för max antal tecken måste vara mellan 1 och 2000.',
  'config.maxCharsSet': 'Max antal tecken per meddelande satt till {value}.',
  'config.rateLimitRange': 'Värdet för hastighetsgränsen måste vara mellan 1 och 120.',
  'config.rateLimitSet': 'Hastighetsgräns satt till {value} meddelanden per minut.',
  'config.roleSet': 'Automatisk uppläsning är nu begränsad till medlemmar med {role}.',
  'config.roleCleared': 'Rollbegränsning borttagen — alla kan läsas upp nu.',
  'config.enabledOn': 'TTS är nu **på** för den här servern.',
  'config.enabledOff': 'TTS är nu **av** för den här servern.',
  'config.xsaidOn':
    'Vozen kommer nu att meddela **vem som talade** före varje meddelande (t.ex. "Alex sa hej"). Stäng av med `/config x-said active:false`.',
  'config.xsaidOff':
    'Vozen meddelar **inte längre** vem som talade — den läser bara upp meddelandet.',
  'config.autojoinOn':
    '✅ Automatisk anslutning **på** — Vozen går med i din röstkanal när du skriver i TTS-kanalen.',
  'config.autojoinOff':
    'Automatisk anslutning **av** — använd `/join` för att ta in Vozen i rösten.',
  'config.stayOn':
    '✅ 24/7 i samtal **på** — Vozen stannar i röstkanalen även när den töms, och kommer tillbaka efter omstarter. 💎 Kräver Premium för att träda i kraft (köp eller `/redeem` en kod, sedan `/premium activate`).',
  'config.stayOff': '24/7 i samtal **av** — Vozen lämnar när röstkanalen töms (standard).',
  'config.readBotsOn':
    '✅ Vozen läser nu också upp meddelanden från **andra bottar och webhooks**.',
  'config.readBotsOff':
    'Vozen **ignorerar** andra bottar och webhooks (bara riktiga personer läses upp).',
  'config.textInVoiceOn': '✅ Vozen läser också upp **textchatten inuti sin röstkanal**.',
  'config.textInVoiceOff': 'Vozen läser **inte** upp röstkanalens textchatt (bara TTS-kanalen).',
  'config.antispamOn':
    '✅ Antispam **på** — Vozen läser inte upp spammade meddelanden (massrepetition av ord eller samma stora meddelande om och om igen).',
  'config.antispamOff': 'Antispam **av** — Vozen läser upp varje meddelande som vanligt.',
  'config.streaksOn':
    '✅ Streak-aviseringar **på** — Vozen visar ett 🔥 dagsstreak-meddelande första gången varje person talar varje dag.',
  'config.streaksOff':
    'Streak-aviseringar **av** — Vozen håller fortfarande koll på streaks (se `/top-speakers`) men säger inget om dem.',
  'config.soundboardOn': 'Ljudbräda **på** — vem som helst kan spela upp klipp med `/sound`.',
  'config.soundboardOff': 'Ljudbräda **av** — `/sound` är inaktiverat på den här servern.',
  'config.votePromosLabel': 'Notiser om top.gg-belöningen + Vozen Support',
  'config.greetOn': '✅ Jag hälsar folk vid namn när de går med i röstkanalen.',
  'config.greetOff': '🔇 Jag hälsar **inte** folk när de går med i röstkanalen.',
  'config.greetLangSet': '✅ Språk för välkomsthälsning satt till **{language}**.',
  'config.defaultVoiceSet':
    '✅ Serverns standardröst satt till **{name}**. Medlemmar utan egen röst hör den här. (id: `{model}`)',
  'config.reset':
    'Konfigurationen återställd till standard. Din blocklista och dina uttal behölls.',
  'config.showTitle': '**Serverkonfiguration**',
  'config.showChannel': 'TTS-kanal: {value}',
  'config.showAutoread': 'Automatisk uppläsning: {value}',
  'config.showRole': 'Roll: {value}',
  'config.showEnabled': 'Aktiverad: {value}',
  'config.showXsaid': 'Meddela talare (xsaid): {value}',
  'config.showAutojoin': 'Automatisk anslutning: {value}',
  'config.showReadBots': 'Läs bottar/webhooks: {value}',
  'config.showTextInVoice': 'Text-i-röst: {value}',
  'config.showAntispam': 'Antispam: {value}',
  'config.showSoundboard': 'Ljudbräda (/sound): {value}',
  'config.showGreet': 'Hälsa vid anslutning: {value} ({language})',
  'config.showVoice': 'Standardröst: {value}',
  'config.showMaxChars': 'Max antal tecken: {value}',
  'config.showRateLimit': 'Hastighetsgräns: {value}/min',
  'config.showBlocklist': 'Blocklista: {count} ord',
  'config.showPronunciation': 'Uttal: {count} poster',
  'config.valueNone': '(inga)',
  'config.valueAny': 'vem som helst',
  'config.valueAutoDetect': '(automatisk identifiering)',
  'config.on': 'på',
  'config.off': 'av',
  'config.language.set': 'Gränssnittsspråk satt till {language}.',
  'config.language.unsupported': 'Det språket stöds inte ännu.',
  'setup.noChannel':
    'Jag kunde inte avgöra vilken kanal som skulle användas. Ange en textkanal i alternativet "channel".',
  'setup.channelWrongType':
    'Kanalen för automatisk uppläsning måste vara en textkanal (inte en röstkanal eller en kategori). Ange en i alternativet "channel".',
  'setup.done': '**Allt klart — Vozen är redo.**',
  'setup.channelLine': 'Kanal för automatisk uppläsning: {channel}',
  'setup.autoreadOn': 'Automatisk uppläsning: på',
  'setup.permsHeader': '**Behörigheter:**',
  'setup.permView': 'ViewChannel (se textkanalen)',
  'setup.permSend': 'SendMessages (posta i textkanalen)',
  'setup.permConnect': 'Connect (gå med i röstkanalen)',
  'setup.permSpeak': 'Speak (tala i röstkanalen)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — saknas',
  'setup.permUnchecked': '⏳ {label} — inte kontrollerad än (jag verifierar den vid /join)',
  'setup.fixHint':
    'För att åtgärda det som saknas: öppna Vozens roll (eller kanalens behörigheter) i dina serverinställningar och aktivera de punkter som är markerade med ❌.',
  'setup.voiceUncheckedNote':
    'Du är inte i någon röstkanal, så jag kunde inte kontrollera Connect/Speak än — jag verifierar dem när du kör /join.',
  'setup.allGood': 'Allt är redo. Hoppa in i en röstkanal och kör /join.',
  'setup.joinedVoice': 'Jag har gått med i {channel} också — du behöver inte köra /join.',
  'setup.readyTalk':
    'Allt är redo. Skriv i kanalen för automatisk uppläsning så läser jag upp det.',
  'setup.membersHeader': '**Berätta för dina medlemmar (flödet i 3 steg):**',
  'setup.membersBody':
    '1) Gå med i en röstkanal\n2) Kör /join så hoppar jag in med dig\n3) Skriv i den här kanalen (eller använd /tts) så läser jag upp det\nFullständig kommandolista: /help',
  'stats.title': '**Vozen-statistik**',
  'stats.messagesSpoken': 'Upplästa meddelanden: {value}',
  'stats.cacheHits': 'Cacheträffar: {value}',
  'stats.cacheMisses': 'Cachemissar: {value}',
  'stats.synthErrors': 'Syntesfel: {value}',
  'stats.synthLatency': 'Synteslatens: p50 {p50}ms / p95 {p95}ms ({count} prover)',
  'stats.voiceDrops': 'Röstavbrott: {value}',
  'stats.voiceReconnects': 'Återanslutningar: {value}',
  'stats.votes': 'top.gg-röster: {value}',
  'stats.activePlayers': 'Aktiva spelare: {value}',
  'stats.servers': 'Servrar: {value}',
  'stats.uptime': 'Drifttid: {value}s',
  'speak.emptyMessage': 'Det meddelandet har ingen text att läsa upp.',
  'uptime.text': '🟢 Vozen har varit online i **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistik**',
  'botstats.servers': 'Servrar: **{value}**',
  'botstats.voiceSessions': 'Röstsessioner nu: **{value}**',
  'botstats.messagesSpoken': 'Upplästa meddelanden: **{value}**',
  'botstats.uptime': 'Drifttid: **{value}**',
  'invite.noClientId':
    'Vozens inbjudningslänk är inte uppsatt ännu (CLIENT_ID saknas). Meddela bottens administratör.',
  'invite.link': 'Lägg till Vozen på din server:\n{url}',
  'vote.noClientId':
    'Vozens röstlänk är inte uppsatt ännu (CLIENT_ID saknas). Meddela bottens administratör.',
  'vote.link':
    'Rösta på Vozen (gratis, var 12:e timme) och hjälp fler att hitta den:\n{url}\nOm kontot aldrig har hämtat belöningen får det **48 timmar Vozen Plus**, endast en gång per konto.',
  'invite.button': 'Lägg till Vozen',
  'vote.button': 'Rösta på top.gg',
  'vote.upsell':
    '🗳️ Om kontot aldrig har hämtat belöningen får det **48 timmar Vozen Plus**, endast en gång per konto. {url}',
  'vote.cooldownStatus':
    '🗳️ Det här kontot har redan använt sin engångsbelöning för röstning. Du kan fortfarande rösta för att stödja Vozen, men får inget mer Plus.',
  'help.title': 'Vozen — skriv det, hör det.',
  'help.embedTitle': 'Vozen — Kommandon',
  'help.intro': 'Vozen läser upp din text i röstkanaler — gratis neurala röster, dussintals språk.',
  'help.quickStartTitle': 'Snabbstart (3 steg)',
  'help.quickStartBody':
    '1) Gå med i en röstkanal och kör sedan /join\n2) Skriv i textkanalen (eller använd /tts Hej allihopa!)\n3) (valfritt) Välj en röst med /voice set',
  'help.groupStarted': 'Komma igång',
  'help.groupStartedBody':
    '• /join — jag går med i din röstkanal\n• /leave — jag lämnar röstkanalen\n• /tts <text> — jag läser upp text · t.ex. /tts Hej allihopa!\n• /skip — hoppa över det jag läser upp just nu',
  'help.groupVoice': 'Din röst',
  'help.groupVoiceBody':
    '• /voice set <model> — välj din röst · t.ex. /voice set en_US-amy-medium\n• /voice list — se de tillgängliga rösterna\n• /voice preview — hör ett prov av din röst\n• /voice reset — gå tillbaka till standardrösten\n• /voice opt-out · /voice opt-in — slå av / på automatisk uppläsning för dig\n• /voice abbrev add|remove|list — personlig slang, uppläst på ditt sätt (upp till 10)',
  'help.groupFun': 'Kul',
  'help.groupFunBody':
    '• /joke — jag berättar ett kort skämt (välj ett språk + valfritt skratt) · t.ex. /joke English\n• /laugh — jag skrattar högt med din nuvarande röst',
  'help.groupAdmin': 'Serveradmin (kräver Hantera server)',
  'help.groupAdminBody':
    '• /setup — guidad konfiguration i ett steg · kör den här först\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · t.ex. /config tts-channel #general\n• /stats — botstatistik',
  'help.groupMore': 'Mer',
  'help.groupMoreBody':
    '• /invite — lägg till Vozen på en annan server\n• /vote — rösta på Vozen på top.gg\n• /help — visa den här hjälpen',
  'help.footer': 'Ny här? Kör {command} för att komma igång.',
  'help.support': '🛟 Behöver du hjälp eller vill rapportera ett problem? {url}',
  'help.source': '📄 Öppen källkod (AGPL-3.0) — hämta den exakta källkoden som körs här: {url}',
  'welcome.title': 'Tack för att du la till Vozen! 👋',
  'welcome.description':
    'Vozen läser upp din chatt i röstkanaler — skriv det, hör det.\n\n**Kom igång i ett steg:** kör {setup} så ställer jag in automatisk uppläsning och går med i din röstkanal.\n\nBehöver du hela kommandolistan? Kör {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Så använder medlemmar det (3 steg)',
  'welcome.stepsBody':
    '1) Gå med i en röstkanal\n2) Kör /join så går jag med dig\n3) Skriv i textkanalen (eller använd /tts) så läser jag upp det\nFullständig kommandolista: /help',
  'welcome.footer': 'Vozen — skriv det, hör det.',
  'welcome.tagline': 'Naturlig neural röst — gratis för alltid, ingen betalvägg.',
  'game.start.needVoice':
    'Det här är ett **röstspel** — hoppa in i en röstkanal och kör /join först, starta det sedan.',
  'game.start.alreadyActive':
    'Ett spel körs redan i <#{channel}>. Avsluta det (eller använd `/game stop`) innan du startar ett nytt.',
  'game.start.premiumLocked':
    '🔒 **{game}** är ett Premium-spel (det kostar riktig beräkningskraft). Se `/premium`.',
  'game.start.started': '🎮 Startar **{game}**! Håll koll på kanalen — lycka till!',
  'game.start.startedThread':
    '🎮 **{game}** startade i <#{channel}> — häng med där! Tråden raderar sig själv när spelet är slut.',
  'game.thread.winner': '🏆 {winner} vann spelet!',
  'game.thread.ended': '🎮 Spelet är slut.',
  'game.unknownGame': 'Jag känner inte till det spelet. Välj ett från listan.',
  'game.stop.ok': '🛑 Stoppade det pågående spelet.',
  'game.stop.none': 'Det finns inget spel som körs just nu.',
  'game.list.title': '🎮 **Spel** — starta ett med `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Topplista** — bästa spelarna på den här servern:',
  'game.leaderboard.empty': 'Inga spel har spelats än. Bli den första — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** p ({wins} vinster)',
  'game.finish.title': '🏁 **Spelet är slut!** Slutresultat:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Spelet är slut — ingen fick poäng den här gången. Nästa gång!',
  'game.finish.winnerVoice': '{user} vinner!',
  'game.guessLanguage.name': 'Gissa språket',
  'game.guessLanguage.desc':
    'Jag läser en mening på ett slumpmässigt språk — först att namnge det vinner poängen.',
  'game.guessLanguage.intro':
    '🗣️ **Gissa språket** — jag läser {rounds} meningar. Skriv vilket språk du hör. Snabbaste rätta svaret vinner varje runda!',
  'game.guessLanguage.round': '🎧 Runda {n}/{total} — lyssna…',
  'game.guessLanguage.correct': '✅ **{user}** klarade det — det var **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Tiden är ute! Det var **{language}**.',
  'game.guessLanguage.noLanguages':
    'Jag har inte tillräckligt många röster installerade för att spela det här. Be en admin lägga till fler röster.',
  'game.math.name': 'Huvudräkning',
  'game.math.desc': 'Jag säger en uträkning högt — först att skriva svaret vinner.',
  'game.math.intro':
    '🔢 **Huvudräkning** — {rounds} uträkningar. Lyssna och skriv svaret så fort du kan!',
  'game.math.round': '🧮 Runda {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** prickade rätt — svaret var **{answer}**!',
  'game.math.timeout': '⏱️ Tiden är ute! Svaret var **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'minus',
  'game.math.times': 'gånger',
  'game.skipCount.name': 'Talet som saknas',
  'game.skipCount.desc': 'Jag räknar högt men hoppar över ett tal — först att fånga det vinner.',
  'game.skipCount.intro':
    '🔢 **Talet som saknas** — jag räknar, men hoppar över ett. Skriv talet som saknas! ({rounds} rundor)',
  'game.skipCount.round': '👂 Runda {n}/{total} — vilket tal hoppade jag över?',
  'game.skipCount.correct': '✅ **{user}** fångade det — jag hoppade över **{answer}**!',
  'game.skipCount.timeout': '⏱️ Tiden är ute! Jag hoppade över **{answer}**.',
  'game.spelling.name': 'Stavningstävling',
  'game.spelling.desc': 'Jag säger ett ord — först att stava det rätt vinner.',
  'game.spelling.intro':
    '✍️ **Stavningstävling** — jag säger {rounds} ord. Skriv varje ord rätt stavat!',
  'game.spelling.round': '🗣️ Runda {n}/{total} — skriv ordet jag säger…',
  'game.spelling.correct': '✅ **{user}** stavade **{word}** rätt!',
  'game.spelling.timeout': '⏱️ Tiden är ute! Ordet var **{word}**.',
  'game.spelling.empty': 'Jag har ingen ordlista för den här serverns röstspråk än.',
  'game.spellOut.name': 'Tyd stavningen',
  'game.spellOut.desc':
    'Jag bokstaverar ett ord bokstav för bokstav — först att skriva hela ordet vinner.',
  'game.spellOut.intro':
    '🔡 **Tyd stavningen** — jag bokstaverar {rounds} ord bokstav för bokstav. Skriv hela ordet!',
  'game.spellOut.round': '🔤 Runda {n}/{total} — lyssna på bokstäverna…',
  'game.spellOut.correct': '✅ **{user}** klarade det — **{word}**!',
  'game.spellOut.timeout': '⏱️ Tiden är ute! Det stavade **{word}**.',
  'game.fastSpeech.name': 'Snabbprat',
  'game.fastSpeech.desc': 'Jag läser en mening jättesnabbt — först att skriva vad jag sa vinner.',
  'game.fastSpeech.intro': '💨 **Snabbprat** — {rounds} meningar i löjlig fart. Skriv vad du hör!',
  'game.fastSpeech.round': '⚡ Runda {n}/{total} — nu kommer den, snabbt!',
  'game.fastSpeech.correct': '✅ **{user}** knäckte det: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Tiden är ute! Det var: “{phrase}”',
  'game.fastSpeech.empty': 'Jag har inga fraser för den här serverns röstspråk än.',
  'game.accentSwap.name': 'Lustig brytning',
  'game.accentSwap.desc': 'Jag säger ett ord med utländsk brytning — först att skriva det vinner.',
  'game.accentSwap.intro':
    '🎭 **Lustig brytning** — {rounds} ord sagda med fel brytning. Skriv ordet!',
  'game.accentSwap.round': '🌍 Runda {n}/{total} — vilket ord försöker jag säga?',
  'game.accentSwap.correct': '✅ **{user}** klarade det — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Tiden är ute! Ordet var **{word}**.',
  'game.reflexes.name': 'Reflexer',
  'game.reflexes.desc':
    'Jag räknar ner och skriker sedan NU — först att skriva efter det vinner. Tjuvstarta inte!',
  'game.reflexes.intro':
    '⚡ **Reflexer** — {rounds} rundor. När jag skriker **NU**, skriv vad som helst så fort du kan. Skriv före NU och det är tjuvstart!',
  'game.reflexes.ready': '🚦 Runda {n}/{total} — gör dig redo…',
  'game.reflexes.countdown': 'tre… två… ett…',
  'game.reflexes.go': '🟢 **NU!!!**',
  'game.reflexes.goVoice': 'Nu!',
  'game.reflexes.tooSoon': '🔴 **{user}** tjuvstartade — för tidigt!',
  'game.reflexes.win': '⚡ **{user}** är snabbast! Poäng!',
  'game.reflexes.tooSlow': '😴 Ingen reagerade i tid. Nästa!',
  'game.headsOrTails.name': 'Krona eller klave',
  'game.headsOrTails.desc':
    'Gissa myntkastet — skriv krona eller klave innan jag singlar. Bästa gissaren vinner!',
  'game.headsOrTails.intro':
    '🪙 **Krona eller klave** — {rounds} rundor. Varje runda, skriv `heads` (krona) eller `tails` (klave) innan jag singlar slanten. 1 poäng per rätt gissning!',
  'game.headsOrTails.introVoice': 'Nu spelar vi krona eller klave!',
  'game.headsOrTails.round': '🪙 Runda {n}/{total} — krona eller klave? Skriv din gissning!',
  'game.headsOrTails.roundVoice': 'Krona… eller klave?',
  'game.headsOrTails.heads': 'krona',
  'game.headsOrTails.tails': 'klave',
  'game.headsOrTails.resultVoice': 'Det blev {side}!',
  'game.headsOrTails.winners': 'Det blev **{side}**! Poäng till: {users}',
  'game.headsOrTails.noWinners': 'Det blev **{side}**! Ingen gissade rätt — inga poäng.',
  'game.vozenSays.name': 'Vozen säger',
  'game.vozenSays.desc':
    "Lyd bara när ordern börjar med 'Vozen säger'. Går du på en fälla är du fast!",
  'game.vozenSays.intro':
    "🫡 **Vozen säger** — {rounds} order. Gör det BARA om jag börjar med **'Vozen säger'**. Annars — rör dig inte!",
  'game.vozenSays.prefix': 'Vozen säger',
  'game.vozenSays.verb': 'skriv',
  'game.vozenSays.real': '🗣️ Runda {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Runda {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** lydde först — poäng!',
  'game.vozenSays.caught': '🔴 **{user}** — jag sa inte Vozen säger! Fast!',
  'game.vozenSays.nobody': '😴 Ingen lydde **{word}** i tid. Nästa!',
  'game.vozenSays.trapCleared': '😌 Det var en fälla — bra sett, ingen gick på **{word}**.',
  'game.roulette.name': 'Sanning eller konsekvens (roulett)',
  'game.roulette.desc':
    'Jag snurrar och läser upp ett sanning-eller-konsekvens-uppdrag. Kör igen för ett till.',
  'game.roulette.header': '🎯 **Hjulet säger…**',
  'game.hangman.name': 'Hänga gubbe',
  'game.hangman.desc': 'Gissa ordet en bokstav i taget — 6 miss och det är slut.',
  'game.hangman.intro':
    '🪢 **Hänga gubbe** — skriv en bokstav i taget för att gissa ordet. Du kan också skriva hela ordet!',
  'game.hangman.hit': '🟢 **{user}** hittade **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — inget **{letter}**.',
  'game.hangman.wrongLetters': 'Fel: {letters}',
  'game.hangman.win': '🎉 **{user}** löste det — **{word}**!',
  'game.hangman.lose': '💀 Slut på försök! Ordet var **{word}**.',
  'game.hangman.idle': '🕹️ Spelet pausat (ingen spelar). Ordet var **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Gissa ordet på 5 bokstäver. 🟩 rätt plats, 🟨 fel plats, ⬛ inte i ordet. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — skriv ett ord på 5 bokstäver. Ni delar på {max} gissningar. 🟩 rätt plats · 🟨 fel plats · ⬛ inte i ordet.',
  'game.wordle.guess': '🔤 **{user}** gissade — **{left}** gissningar kvar',
  'game.wordle.inWord': '🟢 i ordet: {letters}',
  'game.wordle.out': '🚫 ute: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** klarade det på {n} — **{word}**!',
  'game.wordle.lose': '💀 Slut på gissningar! Ordet var **{word}**.',
  'game.wordle.idle': '🕹️ Spelet pausat (ingen spelar). Ordet var **{word}**.',
  'game.tictactoe.name': 'Tre i rad',
  'game.tictactoe.desc':
    'Två spelare — skriv en siffra 1-9 för att placera ditt märke. Tre i rad vinner.',
  'game.tictactoe.intro':
    '⭕ **Tre i rad** — de två första att spela blir ❌ och ⭕ (❌ börjar). Skriv en siffra 1-9 för att spela din ruta.',
  'game.tictactoe.turn': 'Tur: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, det är **{mark}**s tur.',
  'game.tictactoe.taken': '🚫 Ruta {cell} är upptagen — välj en annan.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) vinner!',
  'game.tictactoe.draw': '🤝 Oavgjort!',
  'game.tictactoe.idle': '🕹️ Spelet avslutat (ingen spelar).',
  'game.chess.name': 'Schack',
  'game.chess.desc':
    'Två spelare — riktiga schackregler (schack, rockad, förvandling…). Skriv ett drag som "e4" eller "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Schack** — de två första att dra blir Vit och Svart (Vit börjar). Skriv ett drag i algebraisk notation ("e4", "Nf3", "O-O") eller koordinater ("e2e4"). Skriv "resign" för att ge upp.',
  'game.chess.white': 'Vit',
  'game.chess.black': 'Svart',
  'game.chess.seats': '⚪ Vit: **{white}** · ⚫ Svart: **{black}**',
  'game.chess.turn': '{move} — tur: **{color}**',
  'game.chess.check': '♟️ Schack!',
  'game.chess.notYourTurn': '⏳ **{user}**, det är **{color}**s tur.',
  'game.chess.illegalMove': '🚫 "{move}" är inte ett tillåtet drag — försök igen.',
  'game.chess.checkmate': '🏆 Schackmatt ({move})! **{user}** vinner!',
  'game.chess.draw': '🤝 Oavgjort ({move})!',
  'game.chess.resigned': '🏳️ **{user}** gav upp — **{winner}** vinner!',
  'game.chess.idle': '🕹️ Spelet avslutat (ingen spelar).',
  'game.wordChain.name': 'Ordkedja',
  'game.wordChain.descr':
    'Turbaserad ordkedja på ett språk: säg ett ord som börjar på förra ordets sista bokstav. 2 liv, inga upprepningar, och klockan tickar snabbare. Välj språk med alternativet `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Ordkedja är inte tillgängligt på **{lang}** just nu (ordlista saknas).',
  'game.wordChain.lobby':
    '🔗 **Ordkedja** på **{lang}**! Skriv vad som helst i den här kanalen inom **{seconds}s** för att gå med.',
  'game.wordChain.notEnough':
    '😴 Inte tillräckligt många gick med (minst 2 krävs). Spelet avbrutet.',
  'game.wordChain.begin':
    '🚀 Startar! Spelare: {players}. Varje ord måste börja på föregående ords sista bokstav.',
  'game.wordChain.turn':
    '**{name}**, din tur! Ett **{lang}**-ord som börjar på **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — nästa bokstav: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Det måste börja på **{letter}**.',
  'game.wordChain.bad.short': '📏 För kort — minst **{min}** bokstäver.',
  'game.wordChain.bad.repeated': '🔁 Det ordet har redan använts.',
  'game.wordChain.bad.word': '📖 Det finns inte i ordlistan.',
  'game.wordChain.bad.latin': '🔤 Bara bokstäverna A–Z räknas.',
  'game.wordChain.timeout': '⏰ **{name}** fick slut på tid! {hearts} kvar.',
  'game.wordChain.eliminated': '💀 **{name}** är ute!',
  'game.wordChain.winner': '🏆 **{name}** vinner kedjan! ({chain} ord)',
  'game.stats.none': 'Du har inte spelat några spel än. Prova `/game play`!',
  'game.stats.body': '🎮 **Din statistik** — **{points}** poäng · **{wins}** vinster · {rank}',
  'game.stats.rank': 'placering **#{rank}** av {total}',
  'game.stats.unranked': 'ingen placering än',
  'game.pickPrompt': '🎮 Vilket spel vill du spela? Välj ett:',
  'game.pickPlaceholder': 'Välj ett spel…',
  'game.pickTimeout': '⏰ Inget spel valt — kör `/game play` igen när du är redo.',
  'pron.listHeader': '🗣️ **Dina uttal** ({count}/{limit}):',
  'pron.listEmpty': 'Du har inga än — lägg till ett med `/pronunciation add`.',
  'pron.set': '✅ Sparat! När **du** skriver “{term}” säger jag “{replacement}”.',
  'pron.removed': '🗑️ Tog bort “{term}”.',
  'pron.notFound': 'Du har inget uttal för “{term}”. Se dina med `/pronunciation list`.',
  'pron.empty': 'Ordet och hur det ska sägas får inte vara tomma.',
  'pron.limitHit':
    '🔒 Du nådde din gräns på **{limit}** uttal. Ta bort ett med `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus eller Premium höjer den till **50** → {url}',
  'pron.modalTitle': 'Lär Vozen ett uttal',
  'pron.modalTerm': 'Ordet (som folk skriver det)',
  'pron.modalSay': 'Hur Vozen ska säga det',
  'spron.listHeader': '🗣️ **Serveruttal** ({count}/{limit}) — gäller för alla:',
  'spron.listEmpty': 'Inga än — lägg till ett med `/server-pronunciation add`.',
  'spron.set': '✅ Sparat för hela servern! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ Tog bort “{term}” från servern.',
  'spron.notFound': 'Servern har inget uttal för “{term}”.',
  'spron.limitHit':
    '🔒 Servern nådde sin gräns på **{limit}** uttal. Ta bort ett med `/server-pronunciation remove`.',
  'spron.modalTitle': 'Serveruttal',
  'spron.modalSay': 'Hur Vozen säger det för alla',
  'rand.selectPrompt': '🎲 **Randomizer** — mellan hur många alternativ vill du att jag ska välja?',
  'rand.selectPlaceholder': 'Antal alternativ…',
  'rand.selectOption': '{n} alternativ',
  'rand.filling': '📝 Fyll i formuläret som just öppnades!',
  'rand.modalTitle': 'Randomizer — {amount} alternativ',
  'rand.modalOption': 'Alternativ {n}',
  'rand.needTwo': 'Ge mig minst 2 alternativ separerade med kommatecken (t.ex. "pizza, sushi").',
  'rand.result': 'Av {count} alternativ väljer jag… **{winner}**!',
  'rand.speak': 'Jag väljer… {winner}!',
  'rand.notInVoice': '_(gå med i en röstkanal med mig så säger jag det högt nästa gång)_',
  'rand.timeout': '⏰ Inget valt — kör `/randomizer` igen när du är redo.',
};
