export default {
  'error.generic': 'Бірдеңе дұрыс болмады. Қайталап көріңіз.',
  'error.needManageGuild': 'Ол үшін сізге **Manage Server** рұқсаты қажет.',
  'join.needVoiceChannel': 'Алдымен дауыстық арнаға кіріңіз, содан кейін /join орындаңыз.',
  'join.missingPerms': 'Маған {channel} арнасында **Connect** және **Speak** рұқсаттары қажет.',
  'join.joined':
    '✅ Мен {channel} арнасына кірдім! Келесі қадам: `/tts hello` деп жазыңыз, мен оны дауыстап оқимын. Арнаны автоматты оқығанымды қалайсыз ба? /setup орындаңыз.',
  'join.joinedAutoread':
    '✅ Мен {channel} арнасына кірдім! Бәрі дайын. Автоматты оқу арнасына жазыңыз, мен оны дауыстап оқимын. → {readChannel}',
  'leave.left': 'Дауыстық арнадан шықтым. Келесіде кездескенше!',
  'skip.notInVoice':
    'Мен әлі дауыстық арнада емеспін — біреуіне кіріп, алдымен /join орындаңыз, содан кейін қайталап көріңіз.',
  'skip.skipped': 'Өткізіп жіберілді.',
  'skip.nothing': 'Қазір ештеңе ойналып жатқан жоқ.',
  'tts.notInVoice':
    'Мен әлі дауыстық арнада емеспін — біреуіне кіріп, /join орындаңыз, содан кейін қайталап көріңіз.',
  'tts.nothingToRead': 'Онда оқитын ештеңе жоқ — маған айтатын мәтін жіберіңіз.',
  'tts.nothingAfterClean':
    'Оны тазалағаннан кейін оқитын ештеңе қалмады — қалыпты мәтін жазып көріңіз (әріптер немесе сөздер).',
  'tts.tooFast': 'Тоқтай тұрыңыз, сәл жайлаңыз — сәлден соң қайталап көріңіз.',
  'tts.blocked': 'Бұл мәтінде бұғатталған сөз бар, сондықтан оны өткізіп жібердім.',
  'tts.queued': 'Түсіндім — ол кезекте.',
  'tts.busy': 'Қазір бос емеспін — сәлден соң қайталап көріңіз.',
  'voice.unknownModel': 'Мұндай дауысты білмеймін — /voice list қараңыз.',
  'voice.badSpeed':
    'Жылдамдық 0.5 пен 2.0 аралығында болуы керек (1.0 — қалыпты). `/voice set model:… speed:1.0` деп көріңіз.',
  'voice.set':
    '✅ Дауысыңыз енді **{name}**, жылдамдығы {speed}×. Оны есту үшін `/tts hello` деп көріңіз. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Дауысты баптау** — төмендегі параметрлерді таңдап, **Сақтау** түймесін басыңыз. Оған дейін ештеңе өзгермейді.',
  'voice.config.summary': 'Ағымдағы таңдау: **{voice}** · қозғалтқыш **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Тіл…',
  'voice.config.pickVoice': 'Дауыс…',
  'voice.config.pickEngine': 'Қозғалтқыш…',
  'voice.config.pickSpeed': 'Жылдамдық…',
  'voice.config.more': '▼ Қосымша тілдер',
  'voice.config.engDefault': 'Әдепкі (жергілікті)',
  'voice.config.save': 'Сақтау',
  'voice.config.cancel': 'Болдырмау',
  'voice.config.cancelled': 'Баптау тоқтатылды — ештеңе өзгерген жоқ.',
  'voice.config.expired':
    'Панель мерзімі аяқталды — жалғастыру үшін `/voice config` пәрменін қайта іске қосыңыз.',
  'voice.listHeader': 'Қолжетімді дауыстар:',
  'voice.listEmpty': '(орнатылмаған)',
  'voice.reset':
    '✅ Дауысыңыз әдепкіге қайтарылды. `/voice list` және `/voice set` арқылы кез келген уақытта басқасын таңдаңыз.',
  'voice.optout':
    'Енді сізді автоматты түрде оқымаймын. Оны қайта қосу үшін /voice opt-in орындаңыз.',
  'voice.optin': 'Сізді қайтадан автоматты түрде оқитын боламын.',
  'voice.notInVoice': 'Мен әлі дауыстық арнада емеспін — алдымен /join орындаңыз.',
  'voice.previewPlaying': 'Үлгі ойналуда…',
  'preview.sample': 'Сәлем, мен Vozen. жазыңыз, тыңдаңыз.',
  'laugh.playing': 'Ха-ха! Оны сіздің дауысыңызбен ойнатып жатырмын…',
  'joke.playing': 'Әзіл айтып жатырмын…\n> {joke}',
  'joke.unknownLang': 'Мұндай тілді білмеймін. Тізімнен біреуін таңдаңыз.',
  'voice.abbrev.added': 'Түсіндім — {term} енді {replacement} деп оқылады.',
  'voice.abbrev.removed': '{term} үшін қысқартуыңыз жойылды.',
  'voice.abbrev.listHeader': 'Сіздің жеке қысқартуларыңыз ({count}/{cap} қолданылды):',
  'voice.abbrev.listEmpty': '(әзірге жоқ — /voice abbrev add арқылы қосыңыз)',
  'voice.abbrev.capReached':
    'Сіз {cap} жеке қысқарту шегіне жеттіңіз. Жаңасын қосу үшін алдымен біреуін жойыңыз.',
  'voice.abbrev.invalidTerm':
    'Термин бір сөз болуы керек (тек әріптер мен сандар), ең көбі 50 таңба.',
  'voice.abbrev.emptyReplacement': 'Оқылым бос болуы мүмкін емес.',
  'voice.abbrev.tooLong': 'Оқылым тым ұзын (ең көбі 200 таңба).',
  'config.wordEmpty': 'Сөз бос болуы мүмкін емес.',
  'config.blocked': 'Бұғатталды: {word}.',
  'config.unblocked': 'Бұғаттан шығарылды: {word}.',
  'config.pronListHeader': 'Айтылым сөздігі:',
  'config.pronEmptyValue': '(бос)',
  'config.listEmpty': '(жоқ)',
  'config.termEmpty': 'Термин бос болуы мүмкін емес.',
  'config.pronEmpty': 'Айтылым бос болуы мүмкін емес.',
  'config.pronSet': 'Түсіндім — {term} енді {replacement} деп оқылады.',
  'config.pronRemoved': '{term} үшін айтылым жойылды.',
  'config.channelWrongType': 'Мәтіндік арнаны таңдаңыз (дауыстық арна немесе санат емес).',
  'config.channelNoAccess':
    'Мен {channel} арнасын көре алмаймын — сол жердегі рұқсаттарымды тексеріңіз.',
  'config.channelSet':
    'Автоматты оқу арнасы {channel} болып орнатылды. Келесі: `/config auto-read active:true` арқылы автоматты оқу қосулы екеніне көз жеткізіңіз.',
  'config.autoreadOn': 'Автоматты оқу енді **қосулы**.',
  'config.autoreadOff': 'Автоматты оқу енді **өшірулі**.',
  'config.maxCharsRange': 'Ең көп таңба мәні 1 мен 2000 аралығында болуы керек.',
  'config.maxCharsSet': 'Хабарламаға ең көп таңба саны {value} болып орнатылды.',
  'config.rateLimitRange': 'Жиілік шегінің мәні 1 мен 120 аралығында болуы керек.',
  'config.rateLimitSet': 'Жиілік шегі минутына {value} хабарлама болып орнатылды.',
  'config.roleSet': 'Автоматты оқу енді тек {role} рөлі бар мүшелермен шектелген.',
  'config.roleCleared': 'Рөл шектеуі жойылды — енді барлығы оқылуы мүмкін.',
  'config.enabledOn': 'Бұл сервер үшін TTS енді **қосулы**.',
  'config.enabledOff': 'Бұл сервер үшін TTS енді **өшірулі**.',
  'config.defaultVoiceSet':
    '✅ Сервердің әдепкі дауысы **{name}** болып орнатылды. Өз дауысы жоқ мүшелер осыны естиді. (id: `{model}`)',
  'config.reset':
    'Конфигурация әдепкіге қайтарылды. Бұғаттау тізіміңіз бен айтылымдарыңыз сақталды.',
  'config.showTitle': '**Сервер конфигурациясы**',
  'config.showChannel': 'TTS арнасы: {value}',
  'config.showAutoread': 'Автоматты оқу: {value}',
  'config.showRole': 'Рөл: {value}',
  'config.showEnabled': 'Қосулы: {value}',
  'config.showVoice': 'Әдепкі дауыс: {value}',
  'config.showMaxChars': 'Ең көп таңба: {value}',
  'config.showRateLimit': 'Жиілік шегі: {value}/мин',
  'config.showBlocklist': 'Бұғаттау тізімі: {count} сөз',
  'config.showPronunciation': 'Айтылымдар: {count} жазба',
  'config.valueNone': '(жоқ)',
  'config.valueAny': 'кез келген',
  'config.valueAutoDetect': '(автоматты анықтау)',
  'config.on': 'қосулы',
  'config.off': 'өшірулі',
  'config.language.set': 'Интерфейс тілі {language} болып орнатылды.',
  'config.language.unsupported': 'Бұл тіл әзірге қолдау таппайды.',
  'setup.noChannel':
    'Қай арнаны қолданатынымды анықтай алмадым. "channel" опциясында мәтіндік арна көрсетіңіз.',
  'setup.channelWrongType':
    'Автоматты оқу арнасы мәтіндік арна болуы керек (дауыстық арна немесе санат емес). "channel" опциясында біреуін көрсетіңіз.',
  'setup.done': '**Бәрі дайын — Vozen жұмысқа әзір.**',
  'setup.channelLine': 'Автоматты оқу арнасы: {channel}',
  'setup.autoreadOn': 'Автоматты оқу: қосулы',
  'setup.permsHeader': '**Рұқсаттар:**',
  'setup.permView': 'ViewChannel (мәтіндік арнаны көру)',
  'setup.permSend': 'SendMessages (мәтіндік арнаға жазу)',
  'setup.permConnect': 'Connect (дауыстық арнаға кіру)',
  'setup.permSpeak': 'Speak (дауыстық арнада сөйлеу)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — жоқ',
  'setup.permUnchecked': '⏳ {label} — әлі тексерілмеген (/join кезінде тексеремін)',
  'setup.fixHint':
    'Жетіспейтінін түзету үшін: сервер параметрлерінде Vozen рөлін (немесе арнаның рұқсаттарын) ашып, ❌ белгіленген элементтерді қосыңыз.',
  'setup.voiceUncheckedNote':
    'Сіз дауыстық арнада емессіз, сондықтан Connect/Speak рұқсаттарын әлі тексере алмадым — /join орындағанда тексеремін.',
  'setup.allGood': 'Бәрі дайын. Дауыстық арнаға кіріп, /join орындаңыз.',
  'setup.joinedVoice': 'Мен {channel} арнасына да кірдім — /join орындаудың қажеті жоқ.',
  'setup.readyTalk': 'Бәрі дайын. Автоматты оқу арнасына жазыңыз, мен оны дауыстап оқимын.',
  'setup.membersHeader': '**Мүшелеріңізге айтыңыз (3 қадамдық ағын):**',
  'setup.membersBody':
    '1) Дауыстық арнаға кіріңіз\n2) /join орындаңыз, мен сізбен бірге кіремін\n3) Осы арнаға жазыңыз (немесе /tts қолданыңыз), мен оны дауыстап оқимын\nТолық команда тізімі: /help',
  'stats.title': '**Vozen статистикасы**',
  'stats.messagesSpoken': 'Айтылған хабарламалар: {value}',
  'stats.cacheHits': 'Кэш сәйкестіктері: {value}',
  'stats.cacheMisses': 'Кэш сәйкессіздіктері: {value}',
  'stats.synthErrors': 'Синтез қателері: {value}',
  'stats.voiceDrops': 'Дауыс үзілістері: {value}',
  'stats.voiceReconnects': 'Қайта қосылулар: {value}',
  'stats.votes': 'top.gg дауыстары: {value}',
  'stats.activePlayers': 'Белсенді ойнатқыштар: {value}',
  'stats.servers': 'Серверлер: {value}',
  'stats.uptime': 'Жұмыс уақыты: {value}с',
  'invite.noClientId':
    'Vozen шақыру сілтемесі әлі орнатылмаған (CLIENT_ID жоқ). Бот әкімшісіне хабарлаңыз.',
  'invite.link': 'Vozen-ды серверіңізге қосыңыз:\n{url}',
  'vote.noClientId':
    'Vozen дауыс беру сілтемесі әлі орнатылмаған (CLIENT_ID жоқ). Бот әкімшісіне хабарлаңыз.',
  'vote.link':
    'Vozen үшін дауыс беріңіз (тегін, әр 12h сайын) және оны көбірек адам тапсын:\n{url}\nЕгер бұл аккаунт сыйлықты бұрын алмаған болса, **48 сағат Vozen Plus** алады, әр аккаунтқа тек бір рет.',
  'help.title': 'Vozen — жазыңыз, тыңдаңыз.',
  'help.embedTitle': 'Vozen — Командалар',
  'help.intro':
    'Vozen мәтініңізді дауыстық арналарда дауыстап оқиды — тегін нейрондық дауыстар, ондаған тіл.',
  'help.quickStartTitle': 'Жылдам бастау (3 қадам)',
  'help.quickStartBody':
    '1) Дауыстық арнаға кіріңіз, содан кейін /join орындаңыз\n2) Мәтіндік арнаға жазыңыз (немесе /tts Сәлем, барлығына! қолданыңыз)\n3) (қосымша) /voice set арқылы дауыс таңдаңыз',
  'help.groupStarted': 'Бастау',
  'help.groupStartedBody':
    '• /join — мен сіздің дауыстық арнаңызға кіремін\n• /leave — мен дауыстық арнадан шығамын\n• /tts <text> — мен мәтінді дауыстап оқимын · мысалы /tts Сәлем, барлығына!\n• /skip — қазір оқып жатқанымды өткізіп жіберу',
  'help.groupVoice': 'Сіздің дауысыңыз',
  'help.groupVoiceBody':
    '• /voice set <model> — дауысыңызды таңдаңыз · мысалы /voice set en_US-amy-medium\n• /voice list — қолжетімді дауыстарды көру\n• /voice preview — дауысыңыздың үлгісін тыңдау\n• /voice reset — әдепкі дауысқа қайту\n• /voice opt-out · /voice opt-in — сіз үшін автоматты оқуды өшіру / қосу\n• /voice abbrev add|remove|list — жеке сленг, өз бетінше оқылады (10-ға дейін)',
  'help.groupFun': 'Көңіл көтеру',
  'help.groupFunBody':
    '• /joke — мен қысқа әзіл айтамын (тіл + қосымша күлкі таңдаңыз) · мысалы /joke English\n• /laugh — мен қазіргі дауысыңызбен дауыстап күлемін',
  'help.groupAdmin': 'Сервер әкімшісі (Manage Server қажет)',
  'help.groupAdminBody':
    '• /setup — бір қадамдық басқарылатын баптау · алдымен осыны орындаңыз\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · мысалы /config tts-channel #general\n• /stats — бот статистикасы',
  'help.groupMore': 'Тағы',
  'help.groupMoreBody':
    '• /invite — Vozen-ды басқа серверге қосу\n• /vote — top.gg-де Vozen үшін дауыс беру\n• /help — осы анықтаманы көрсету',
  'help.footer': 'Мұнда жаңа келдіңіз бе? Бастау үшін {command} орындаңыз.',
  'welcome.title': 'Vozen-ды қосқаныңызға рахмет! 👋',
  'welcome.description':
    'Vozen чатыңызды дауыстық арналарда дауыстап оқиды — жазыңыз, тыңдаңыз.\n\n**Бір қадаммен бастаңыз:** {setup} орындаңыз, мен автоматты оқуды баптап, дауыстық арнаңызға кіремін.\n\nТолық команда тізімі керек пе? {help} орындаңыз.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Мүшелер оны қалай қолданады (3 қадам)',
  'welcome.stepsBody':
    '1) Дауыстық арнаға кіріңіз\n2) /join орындаңыз, мен сізге қосыламын\n3) Мәтіндік арнаға жазыңыз (немесе /tts қолданыңыз), мен оны дауыстап оқимын\nТолық команда тізімі: /help',
  'welcome.footer': 'Vozen — жазыңыз, тыңдаңыз.',
  'welcome.tagline': 'Табиғи нейрондық дауыс — мәңгі тегін, ешқандай ақылы шектеусіз.',
  'stt.guildOnly': 'Транскрипция тек сервер ішінде жұмыс істейді.',
  'stt.noManage':
    'Транскрипцияны бастау немесе тоқтату үшін сізге **Manage Server** рұқсаты қажет.',
  'stt.notPremium':
    '🎙️ Тікелей транскрипция — **Premium** мүмкіндігі. Оны осы сервер үшін ашу үшін `/premium info` қараңыз.',
  'stt.unavailable':
    'Транскрипция осы данада қолжетімсіз (сөзді мәтінге айналдыру қозғалтқышы орнатылмаған).',
  'stt.notInVoice':
    'Мен дауыстық арнада емеспін — біреуіне кіріп, алдымен `/join` орындаңыз, содан кейін транскрипцияны бастаңыз.',
  'stt.alreadyRunning':
    'Транскрипция осы серверде әлдеқашан жұмыс істеп тұр. Алдымен `/transcribe stop` қолданыңыз.',
  'stt.atCapacity':
    'Қазір барлық серверлерде тым көп транскрипция жұмыс істеп жатыр. Сәлден соң қайталап көріңіз.',
  'stt.noChannel':
    'Мен бұл арнаға транскрипцияларды жариялай алмаймын. Команданы қалыпты мәтіндік арнадан орындап көріңіз.',
  'stt.started':
    '✅ Транскрипция басталды. Хабарландыруда **Consent** түймесін басқан кез келген адам осы арнаға транскрипцияланады.',
  'stt.startFailed':
    'Транскрипцияны бастау мүмкін болмады (хабарландыруды жариялау сәтсіз аяқталды). Мен бәрін кері қайтардым — ештеңе жазылып жатқан жоқ. Қайталап көріңіз.',
  'stt.announceStart':
    '🎙️ **Осы арнада тікелей транскрипция ҚОСУЛЫ.** Тек келісім берген адамдар ғана транскрипцияланады — сөзіңіздің осында жазылуына рұқсат беру үшін төмендегі түймені басыңыз. Кез келген уақытта `/transcribe revoke` арқылы бас тарта аласыз.',
  'stt.consentBtn': 'Транскрипциялануға келісемін',
  'stt.consentThanks':
    '✅ Рахмет — сөзіңіз енді осы серверде транскрипцияланады. Кез келген уақытта `/transcribe revoke` арқылы бас тартыңыз.',
  'stt.stopped': '🛑 Транскрипция тоқтатылды.',
  'stt.notRunning': 'Транскрипция осы серверде жұмыс істеп тұрған жоқ.',
  'stt.announceStop': '🛑 **Тікелей транскрипция енді ӨШІРУЛІ.** Мен тыңдауды тоқтаттым.',
  'stt.revoked':
    '✅ Келісім қайтарылды — енді осы серверде транскрипцияланбайсыз. (Жарияланып қойған хабарламалар қалады; қаласаңыз, оларды Discord-та жойыңыз.)',
  'stt.revokeNone':
    'Сіз осы серверде транскрипцияға келісім бермеген едіңіз, сондықтан қайтаратын ештеңе болмады.',
  'privacy.eraseConfirm':
    '⚠️ Бұл барлық серверлердегі **барлық** Vozen деректеріңізді біржола жояды: дауыс параметрлері, айтылатын лақап ат, жеке қысқартулар мен айтылымдар, сақталған туған күн, ойын ұпайлары, сөйлеу статистикасы, және бас тарту. **Мұны қайтару мүмкін емес.** Сенімдісіз бе?',
  'privacy.erasePremiumNote':
    '_Ескертпе: ақылы Premium/Plus және оның сатып алу тарихы сақталады — олар сізге және заңды түрде талап етілетін қаржылық жазбаларға тиесілі. Premium-ды тоқтату үшін оның мерзімі бітуіне жіберіңіз немесе қолдау қызметіне хабарласыңыз._',
  'privacy.eraseYes': 'Бәрін жою',
  'privacy.eraseNo': 'Болдырмау',
  'privacy.eraseCancelled': 'Болдырылмады — ештеңе жойылған жоқ.',
  'privacy.eraseDone': '✅ Дайын. Барлық жеке деректеріңіз біржола жойылды.',
  'shutup.notInVoice': 'Мен әлі дауыстық арнада емеспін — біреуіне кіріп, алдымен /join орындаңыз.',
  'shutup.nothing': 'Қазір ештеңе ойналып жатқан жоқ.',
  'shutup.done': '🤐 Жарайды, тоқтаймын — кезектегі барлығын тазаладым.',
  'voice.detection.on':
    '✅ Тілді автоматты анықтау ҚОСУЛЫ: әр хабарлама анықталған тіліне сай дауыспен оқылады (сөйлеуші өзгеруі мүмкін). Оны `/voice detection active:false` арқылы өшіріңіз.',
  'voice.detection.off':
    '✅ Тілді автоматты анықтау ӨШІРУЛІ: барлығын бір тұрақты дауысыңыз оқиды, сондықтан әрдайым бірдей естілесіз.',
  'voice.nickname.set': '✅ Vozen енді сізді дауыстап **{name}** деп атайды.',
  'voice.nickname.cleared':
    '✅ Айтылатын лақап ат тазаланды — Vozen сіздің сервердегі атыңызды қолданады.',
  'voice.nickname.invalid':
    'Бұл атта дауыстап айтуға болатын оқылымды ештеңе жоқ. Әріптер немесе сандарды қолданып көріңіз.',
  'voice.effect.set':
    '✅ Дауыс эффектісі **{effect}** болып орнатылды — хабарламаларыңыз енді сол эффектімен ойналады. Оны өшіру үшін `/voice effect none` қолданыңыз.',
  'voice.effect.cleared': '✅ Дауыс эффектісі жойылды — қайтадан таза дауыс.',
  'voice.effect.locked':
    '🔒 **{effect}** — Premium эффектісі. Тегін эффектілер: 🤖 Robot және 🔊 Echo. Барлығын Vozen Premium арқылы ашыңыз — `/premium` қараңыз.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** — Premium дауыс қозғалтқышы. Оны Vozen Plus (жеке) немесе Vozen Premium (сервер) арқылы ашыңыз — `/premium` қараңыз. Әзірге дауысыңыз тегін жергілікті қозғалтқышта қалады.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** — Premium дауыс қозғалтқышы. Оны Vozen Plus (жеке) немесе Vozen Premium (сервер) арқылы ашыңыз — `/premium` қараңыз. Әзірге дауысыңыз тегін жергілікті қозғалтқышта қалады.',
  'rizz.playing': '😏 Аздап сүйкімділік шашып жатырмын…\n> {line}',
  'rizz.unknownLang': 'Мұндай тілді білмеймін. Тізімнен біреуін таңдаңыз.',
  'rizz.locked':
    '🔒 **/rizz** — Premium артықшылығы. Оны Vozen Plus (сіз) немесе Premium (осы сервер) арқылы ашыңыз. `/premium` қараңыз.',
  'sound.playing': '🔊 **{name}** ойнатылуда…',
  'sound.unknown': 'Менде мұндай дыбыс жоқ. Тізімді көру үшін `/sound` орындаңыз.',
  'sound.list':
    '🔊 **Дыбыстар:** {sounds}\nБіреуін `/sound name:<sound>` арқылы ойнатыңыз (мен сіздің дауыстық арнаңызда болуым керек).',
  'sound.disabled':
    '🔇 Осы серверде дыбыс тақтасы **өшірулі**. Әкімші оны `/config soundboard` арқылы қоса алады.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Туған күн сақталды: **{day}/{month}**. Сол күні дауыстық арнаға кіргеніңізде сізді туған күніңізбен құттықтаймын!',
  'birthday.invalid': 'Бұл нақты күн емес. Күн мен айды тексеріңіз.',
  'birthday.cleared': '🎂 Туған күн жойылды.',
  'birthday.show': '🎂 Туған күніңіз **{day}/{month}** болып орнатылған.',
  'birthday.none': 'Сіз әлі туған күнді орнатпадыңыз. `/birthday set` қолданыңыз.',
  'topspeakers.title': '🗣️ **Ең белсенді сөйлеушілер** — осы серверде кімді ең көп оқыдым:',
  'topspeakers.empty':
    'Мен әлі ешкімнің хабарламаларын оқымадым. `/setup` арқылы оқу арнасын баптаңыз!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** хабарлама · 🔥 {streak} күндік серпін',
  'serverstats.title': '📊 **Сервер статистикасы**',
  'serverstats.empty':
    'Әзірге статистика жоқ — мен мұнда ешқандай хабарлама оқымадым немесе ойын өткізбедім. `/setup` арқылы баптаңыз!',
  'serverstats.messages': '🗣️ **{total}** хабарлама оқылды · **{speakers}** адам',
  'serverstats.topTalkers': '**Ең көп сөйлеушілер:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} хаб. · 🔥 {streak}к',
  'serverstats.streak': '🔥 Ең ұзақ белсенді серпін: **{days}** күн',
  'serverstats.games': '🎮 **{points}** ойын ұпайы · **{wins}** жеңіс · **{players}** ойыншы',
  'serverstats.topPlayers': '**Үздік ойыншылар:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} ұпай · {wins} жеңіс',
  'serverstats.upsell':
    '🔒 Бұл — тегін алдын ала қарау. **Premium** серпіндерді, ойын статистикасын және толық үздік 5-ті ашады — `/premium` қараңыз.',
  'streak.day': '🔥 <@{user}> **{n} күндік** серпінде! Оны сақтау үшін сөйлей беріңіз.',
  'leaderboard.autoTitle': '🏆 Осы сервердегі ең көп сөйлеушілер',
  'premium.title': '💎 **Vozen Premium күйі**',
  'premium.lineServerActive': '🖥️ **Сервер:** {date} дейін Premium',
  'premium.lineServerFree': '🖥️ **Сервер:** Тегін жоспар',
  'premium.lineUserActive': '👤 **Сіз (Plus):** {date} дейін белсенді',
  'premium.lineUserFree': '👤 **Сіз (Plus):** белсенді емес',
  'premium.getHint':
    'Бүгін қолданатын барлық нәрсе тегін болып қала береді. Premium 8 дауыс эффектісінің барлығын, қоңырауда 24/7 болуды, 50 жеке айтылымды, /rizz-ті және премиум ойындарды қосады. Қолдау: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Сіздің Premium рұқсатнамаңыз:** {used}/{total} лицензия қолданыста · {date} мерзімі бітеді',
  'premium.passServers': '↳ Қолданыста: {servers}',
  'premium.pitch':
    'Сізде әлі Premium жоқ. **Vozen Premium** (3 сервер үшін €3.99/ай немесе 8 сервер үшін €7.99/ай) бүкіл сервер үшін ашады: 8 дауыс эффектісінің барлығын, қоңырауда 24/7 болуды, 50 жеке айтылымды (3-тің орнына), /rizz командасын және премиум ойындарды (Сөз тізбегі, Wordle, Шахмат). **Vozen Plus** (€1.99/ай) осы артықшылықтарды кез келген серверде жеке өзіңізге береді.',
  'premium.buyHint':
    '▶ **Premium алу:** {link}\nСатып алғаннан кейін, қалаған серверде `/premium activate` орындаңыз.',
  'premium.confirmActivate':
    '**{total} Premium лицензияңыздың 1-еуін** **осы серверде** қолданасыз ба? Дәл қазір **{used}** қолданыста. Оны кейін `/premium deactivate` арқылы босата аласыз — уақыт бәрібір рұқсатнамада жүріп тұрады.',
  'premium.confirmYes': '💎 Лицензия қолдану',
  'premium.confirmNo': 'Болдырмау',
  'premium.activateOk':
    '✅ Premium енді **осы серверде** {date} дейін белсенді. Лицензиялар: **{used}/{total}** қолданыста.',
  'premium.activateCancelled': 'Болдырылмады — ешқандай лицензия қолданылған жоқ.',
  'premium.activateTimeout': 'Уақыт бітті — ешқандай лицензия қолданылған жоқ.',
  'premium.noPass':
    'Сізде белсенді Premium рұқсатнамасы жоқ. Біреуін алыңыз, ол сіздің тіркелгіңізге түседі — содан кейін осында `/premium activate` орындаңыз.\n▶ {link}',
  'premium.alreadyActive':
    'Бұл серверде сіздің Premium лицензияларыңыздың бірі бұрыннан бар. Ешнәрсе істеудің қажеті жоқ.',
  'premium.noSeats':
    'Сіздің **{total}** Premium лицензияңыздың барлығы қолданыста ({servers}). Сол жерде `/premium deactivate` арқылы біреуін босатыңыз, содан кейін осында қайталап көріңіз.',
  'premium.needManageGuild':
    'Premium-ды белсендіру бүкіл серверге әсер етеді — оны тек **Manage Server** рұқсаты бар мүшелер ғана жасай алады. Әкімшіден сұраңыз.',
  'premium.deactivateOk':
    '✅ Осы сервердің Premium лицензиясы босатылды. Оны басқа серверде `/premium activate` арқылы қолданыңыз.',
  'premium.deactivateNone': 'Бұл серверде сізден босатуға болатын Premium лицензиясы жоқ.',
  'premium.thisServer': 'осы сервер',
  'grant.denied': '⛔ Бұл команда тек бот иесіне арналған.',
  'grant.okPremium':
    '✅ <@{user}> қолданушысына **{days}** күнге **Premium рұқсатнамасы** ({seats} лицензия) берілді — {date} мерзімі бітеді. Оны `/premium activate` арқылы белсендіреді.',
  'grant.okPlus':
    '✅ <@{user}> қолданушысына **{days}** күнге **Vozen Plus** берілді — {date} мерзімі бітеді.',
  'gencode.done':
    '✅ Әрқайсысы **{days}** күндік **{count}** {plan} код(тары) жасалды. Оларды жеке түрде бөлісіңіз:\n{list}',
  'redeem.okPlus':
    '🎁 Өтелді! Сіз **{days}** күнге **Vozen Plus** алдыңыз — {date} мерзімі бітеді.',
  'redeem.okPremium':
    '🎁 Өтелді! Сіз **{days}** күнге **Premium рұқсатнамасын** ({seats} лицензия) алдыңыз — {date} мерзімі бітеді. Оны серверіңізде `/premium activate` арқылы белсендіріңіз.',
  'redeem.notFound': '❌ Мұндай код жоқ. Оны тексеріп, қайталап көріңіз.',
  'redeem.used': '❌ Бұл код әлдеқашан өтелген.',
  'redeem.expired': '❌ Бұл кодтың мерзімі бітті.',
  'config.blockLimit':
    'Бұл серверде бұғатталған сөздердің ең көп саны {max} бұрыннан бар. Жаңасын қоспас бұрын біреуін жойыңыз.',
  'config.xsaidOn':
    'Vozen енді әр хабарламаның алдында **кім сөйлегенін** хабарлайды (мысалы, "Alex сәлемдесті"). `/config x-said active:false` арқылы өшіріңіз.',
  'config.xsaidOff': 'Vozen кім сөйлегенін **бұдан былай** хабарламайды — тек хабарламаны оқиды.',
  'config.autojoinOn':
    '✅ Автоматты кіру **қосулы** — TTS арнасына жазғаныңызда Vozen сіздің дауыстық арнаңызға кіреді.',
  'config.autojoinOff':
    'Автоматты кіру **өшірулі** — Vozen-ды дауысқа әкелу үшін `/join` қолданыңыз.',
  'config.stayOn':
    '✅ Қоңырауда 24/7 **қосулы** — Vozen дауыстық арна босап қалса да онда қалады және қайта іске қосылғаннан кейін оралады. 💎 Күшіне енуі үшін Premium қажет (код сатып алыңыз немесе `/redeem` жасаңыз, содан кейін `/premium activate`).',
  'config.stayOff': 'Қоңырауда 24/7 **өшірулі** — дауыстық арна босағанда Vozen шығады (әдепкі).',
  'config.readBotsOn': '✅ Vozen енді **басқа боттар мен вебхуктардың** да хабарламаларын оқиды.',
  'config.readBotsOff':
    'Vozen басқа боттар мен вебхуктарды **елемейді** (тек нақты адамдар оқылады).',
  'config.textInVoiceOn':
    '✅ Vozen сонымен қатар **өзінің дауыстық арнасындағы мәтіндік чатты** оқиды.',
  'config.textInVoiceOff': 'Vozen дауыстық арнаның мәтіндік чатын **оқымайды** (тек TTS арнасын).',
  'config.antispamOn':
    '✅ Спамға қарсы **қосулы** — Vozen спам хабарламаларды оқымайды (сөздердің жаппай қайталануы немесе бір үлкен хабарламаның қайта-қайта жариялануы).',
  'config.antispamOff': 'Спамға қарсы **өшірулі** — Vozen әдеттегідей әр хабарламаны оқиды.',
  'config.streaksOn':
    '✅ Серпін хабарламалары **қосулы** — Vozen әр адам күн сайын алғаш сөйлегенде 🔥 күндік серпін хабарламасын көрсетеді.',
  'config.streaksOff':
    'Серпін хабарламалары **өшірулі** — Vozen серпіндерді әлі де есептейді (`/top-speakers` қараңыз), бірақ олар туралы үндемейді.',
  'config.soundboardOn':
    'Дыбыс тақтасы **қосулы** — кез келген адам `/sound` арқылы клиптерді ойната алады.',
  'config.soundboardOff': 'Дыбыс тақтасы **өшірулі** — осы серверде `/sound` ажыратылған.',
  'config.votePromosLabel': 'top.gg сыйлығы туралы хабарламалар + Vozen Support',
  'config.greetOn': '✅ Адамдар дауыстық арнаға кіргенде оларды атымен сәлемдесемін.',
  'config.greetOff': '🔇 Адамдар дауыстық арнаға кіргенде оларды **сәлемдеспеймін**.',
  'config.greetLangSet': '✅ Кіру сәлемдесуінің тілі **{language}** болып орнатылды.',
  'config.showXsaid': 'Сөйлеушіні хабарлау (xsaid): {value}',
  'config.showAutojoin': 'Автоматты кіру: {value}',
  'config.showReadBots': 'Боттарды/вебхуктарды оқу: {value}',
  'config.showTextInVoice': 'Дауыстағы мәтін: {value}',
  'config.showAntispam': 'Спамға қарсы: {value}',
  'config.showSoundboard': 'Дыбыс тақтасы (/sound): {value}',
  'config.showGreet': 'Кіргенде сәлемдесу: {value} ({language})',
  'stats.synthLatency': 'Синтез кідірісі: p50 {p50}мс / p95 {p95}мс ({count} үлгі)',
  'speak.emptyMessage': 'Бұл хабарламада дауыстап оқитын мәтін жоқ.',
  'uptime.text': '🟢 Vozen **{uptime}** бойы желіде.',
  'botstats.title': '📊 **Vozen — статистика**',
  'botstats.servers': 'Серверлер: **{value}**',
  'botstats.voiceSessions': 'Қазіргі дауыс сеанстары: **{value}**',
  'botstats.messagesSpoken': 'Айтылған хабарламалар: **{value}**',
  'botstats.uptime': 'Жұмыс уақыты: **{value}**',
  'invite.button': 'Vozen қосу',
  'vote.button': 'top.gg-де дауыс беру',
  'vote.upsell':
    '🗳️ Егер бұл аккаунт сыйлықты бұрын алмаған болса, **48 сағат Vozen Plus** алады, әр аккаунтқа тек бір рет. {url}',
  'vote.cooldownStatus':
    '🗳️ Бұл аккаунт бір реттік дауыс сыйлығын пайдаланып қойған. Vozen-ді қолдау үшін әлі де дауыс бере аласыз, бірақ қосымша Plus берілмейді.',
  'help.support': '🛟 Көмек керек пе немесе мәселе туралы хабарлағыңыз келе ме? {url}',
  'help.source':
    '📄 Ашық бастапқы код (AGPL-3.0) — осында жұмыс істеп тұрған нақты бастапқы кодты алыңыз: {url}',
  'game.start.needVoice':
    'Бұл — **дауыстық ойын** — алдымен дауыстық арнаға кіріп, /join орындаңыз, содан кейін оны бастаңыз.',
  'game.start.alreadyActive':
    '<#{channel}> арнасында ойын әлдеқашан жүріп жатыр. Жаңасын бастамас бұрын оны аяқтаңыз (немесе `/game stop` қолданыңыз).',
  'game.start.premiumLocked':
    '🔒 **{game}** — Premium ойыны (нақты есептеу ресурсын қажет етеді). `/premium` қараңыз.',
  'game.start.started': '🎮 **{game}** басталуда! Арнаны бақылаңыз — сәттілік!',
  'game.start.startedThread':
    '🎮 **{game}** <#{channel}> арнасында басталды — сонда қосылыңыз! Ойын аяқталғанда тармақ өздігінен жойылады.',
  'game.thread.winner': '🏆 {winner} ойында жеңді!',
  'game.thread.ended': '🎮 Ойын аяқталды.',
  'game.unknownGame': 'Мұндай ойынды білмеймін. Тізімнен біреуін таңдаңыз.',
  'game.stop.ok': '🛑 Ағымдағы ойын тоқтатылды.',
  'game.stop.none': 'Қазір жүріп жатқан ойын жоқ.',
  'game.list.title': '🎮 **Ойындар** — біреуін `/game play` арқылы бастаңыз:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Үздіктер тақтасы** — осы сервердегі үздік ойыншылар:',
  'game.leaderboard.empty': 'Әзірге ешбір ойын ойналмады. Бірінші болыңыз — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** ұпай ({wins} жеңіс)',
  'game.finish.title': '🏁 **Ойын аяқталды!** Қорытынды ұпайлар:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Ойын аяқталды — бұл жолы ешкім ұпай жинамады. Келесі жолы!',
  'game.finish.winnerVoice': '{user} жеңді!',
  'game.guessLanguage.name': 'Тілді тап',
  'game.guessLanguage.desc':
    'Мен кездейсоқ тілде сөйлем оқимын — бірінші болып атаған адам ұпай алады.',
  'game.guessLanguage.intro':
    '🗣️ **Тілді тап** — мен {rounds} сөйлем оқимын. Қай тілді естігеніңізді жазыңыз. Әр раундта ең жылдам дұрыс жауап жеңеді!',
  'game.guessLanguage.round': '🎧 {n}/{total} раунд — тыңдаңыз…',
  'game.guessLanguage.correct': '✅ **{user}** тапты — бұл **{language}** болды!',
  'game.guessLanguage.timeout': '⏱️ Уақыт бітті! Бұл **{language}** болды.',
  'game.guessLanguage.noLanguages':
    'Бұны ойнау үшін жеткілікті дауыстар орнатылмаған. Әкімшіден көбірек дауыс қосуды сұраңыз.',
  'game.math.name': 'Ойша есептеу',
  'game.math.desc': 'Мен есепті дауыстап айтамын — жауабын бірінші жазған жеңеді.',
  'game.math.intro':
    '🔢 **Ойша есептеу** — {rounds} есеп. Тыңдап, жауабын мүмкіндігінше жылдам жазыңыз!',
  'game.math.round': '🧮 {n}/{total} раунд — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** дәл тапты — жауабы **{answer}** болды!',
  'game.math.timeout': '⏱️ Уақыт бітті! Жауабы **{answer}** болды.',
  'game.math.plus': 'қосу',
  'game.math.minus': 'алу',
  'game.math.times': 'көбейту',
  'game.skipCount.name': 'Жоғалған сан',
  'game.skipCount.desc':
    'Мен дауыстап санаймын, бірақ бір санды өткізіп жіберемін — оны бірінші байқаған жеңеді.',
  'game.skipCount.intro':
    '🔢 **Жоғалған сан** — мен санаймын, бірақ біреуін өткізіп жіберемін. Жетіспейтін санды жазыңыз! ({rounds} раунд)',
  'game.skipCount.round': '👂 {n}/{total} раунд — қай санды өткізіп жібердім?',
  'game.skipCount.correct': '✅ **{user}** байқады — мен **{answer}** санын өткізіп жібердім!',
  'game.skipCount.timeout': '⏱️ Уақыт бітті! Мен **{answer}** санын өткізіп жібердім.',
  'game.spelling.name': 'Емле сайысы',
  'game.spelling.desc': 'Мен сөз айтамын — оны бірінші дұрыс жазған жеңеді.',
  'game.spelling.intro': '✍️ **Емле сайысы** — мен {rounds} сөз айтамын. Әрқайсысын дұрыс жазыңыз!',
  'game.spelling.round': '🗣️ {n}/{total} раунд — мен айтқан сөзді жазыңыз…',
  'game.spelling.correct': '✅ **{user}** **{word}** сөзін дұрыс жазды!',
  'game.spelling.timeout': '⏱️ Уақыт бітті! Сөз **{word}** болды.',
  'game.spelling.empty': 'Менде осы сервердің дауыс тіліне арналған сөздер тізімі әлі жоқ.',
  'game.spellOut.name': 'Әріптеп айтылған сөз',
  'game.spellOut.desc': 'Мен сөзді әріптеп айтамын — сөзді толық бірінші жазған жеңеді.',
  'game.spellOut.intro':
    '🔡 **Әріптеп айтылған сөз** — мен {rounds} сөзді әріптеп айтамын. Толық сөзді жазыңыз!',
  'game.spellOut.round': '🔤 {n}/{total} раунд — әріптерді тыңдаңыз…',
  'game.spellOut.correct': '✅ **{user}** тапты — **{word}**!',
  'game.spellOut.timeout': '⏱️ Уақыт бітті! Ол **{word}** сөзі еді.',
  'game.fastSpeech.name': 'Жылдам сөйлеу',
  'game.fastSpeech.desc': 'Мен сөйлемді өте жылдам оқимын — не айтқанымды бірінші жазған жеңеді.',
  'game.fastSpeech.intro':
    '💨 **Жылдам сөйлеу** — {rounds} сөйлем керемет жылдамдықпен. Естігеніңізді жазыңыз!',
  'game.fastSpeech.round': '⚡ {n}/{total} раунд — міне, жылдам!',
  'game.fastSpeech.correct': '✅ **{user}** шешті: «{phrase}»',
  'game.fastSpeech.timeout': '⏱️ Уақыт бітті! Бұл: «{phrase}»',
  'game.fastSpeech.empty': 'Менде осы сервердің дауыс тіліне арналған сөйлемдер әлі жоқ.',
  'game.accentSwap.name': 'Күлкілі акцент',
  'game.accentSwap.desc': 'Мен сөзді шетелдік акцентпен айтамын — оны бірінші жазған жеңеді.',
  'game.accentSwap.intro':
    '🎭 **Күлкілі акцент** — {rounds} сөз қате акцентпен айтылады. Сөзді жазыңыз!',
  'game.accentSwap.round': '🌍 {n}/{total} раунд — мен қай сөзді айтуға тырысып жатырмын?',
  'game.accentSwap.correct': '✅ **{user}** тапты — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Уақыт бітті! Сөз **{word}** болды.',
  'game.reflexes.name': 'Рефлекстер',
  'game.reflexes.desc':
    'Мен кері санаймын, содан кейін БАСТА деп айқайлаймын — содан кейін бірінші жазған жеңеді. Ерте бастамаңыз!',
  'game.reflexes.intro':
    '⚡ **Рефлекстер** — {rounds} раунд. Мен **БАСТА** деп айқайлағанда, мүмкіндігінше жылдам кез келген нәрсені жазыңыз. БАСТА-дан бұрын жазсаңыз — қате бастама!',
  'game.reflexes.ready': '🚦 {n}/{total} раунд — дайын болыңыз…',
  'game.reflexes.countdown': 'үш… екі… бір…',
  'game.reflexes.go': '🟢 **БАСТА!!!**',
  'game.reflexes.goVoice': 'Баста!',
  'game.reflexes.tooSoon': '🔴 **{user}** асығып кетті — тым ерте!',
  'game.reflexes.win': '⚡ **{user}** ең жылдам! Ұпай!',
  'game.reflexes.tooSlow': '😴 Ешкім уақтылы әрекет етпеді. Келесі!',
  'game.headsOrTails.name': 'Бүркіт немесе сан',
  'game.headsOrTails.desc':
    'Тиынды болжаңыз — мен лақтырмас бұрын бүркіт немесе сан деп жазыңыз. Ең көп тапқан жеңеді!',
  'game.headsOrTails.intro':
    '🪙 **Бүркіт немесе сан** — {rounds} раунд. Әр раундта мен тиынды лақтырмас бұрын `бүркіт` немесе `сан` деп жазыңыз. Әр дұрыс болжам үшін 1 ұпай!',
  'game.headsOrTails.introVoice': 'Бүркіт немесе сан ойнайық!',
  'game.headsOrTails.round': '🪙 {n}/{total} раунд — бүркіт пе, сан ба? Болжамыңызды жазыңыз!',
  'game.headsOrTails.roundVoice': 'Бүркіт пе… сан ба?',
  'game.headsOrTails.heads': 'бүркіт',
  'game.headsOrTails.tails': 'сан',
  'game.headsOrTails.resultVoice': '{side} түсті!',
  'game.headsOrTails.winners': '**{side}** түсті! Ұпай: {users}',
  'game.headsOrTails.noWinners': '**{side}** түсті! Ешкім таппады — ұпай жоқ.',
  'game.vozenSays.name': 'Vozen айтады',
  'game.vozenSays.desc':
    "Тек бұйрық 'Vozen айтады' деп басталғанда ғана орындаңыз. Тұзаққа түссеңіз — ұсталасыз!",
  'game.vozenSays.intro':
    "🫡 **Vozen айтады** — {rounds} бұйрық. Тек мен **'Vozen айтады'** деп бастасам ҒАНА орындаңыз. Әйтпесе, қозғалмаңыз!",
  'game.vozenSays.prefix': 'Vozen айтады',
  'game.vozenSays.verb': 'жазыңдар',
  'game.vozenSays.real': '🗣️ {n}/{total} раунд — «{command}»',
  'game.vozenSays.trap': '🗣️ {n}/{total} раунд — «{command}»',
  'game.vozenSays.obeyed': '✅ **{user}** бірінші орындады — ұпай!',
  'game.vozenSays.caught': '🔴 **{user}** — мен Vozen айтады деген жоқпын! Ұсталды!',
  'game.vozenSays.nobody': '😴 Ешкім **{word}** бұйрығын уақтылы орындамады. Келесі!',
  'game.vozenSays.trapCleared':
    '😌 Бұл тұзақ еді — жарайсыңдар, ешкім **{word}** дегенге алданбады.',
  'game.roulette.name': 'Шындық немесе тапсырма рулеткасы',
  'game.roulette.desc':
    'Мен рулетканы айналдырып, бір шындық-немесе-тапсырма сұрағын дауыстап оқимын. Тағы біреуі үшін қайта орындаңыз.',
  'game.roulette.header': '🎯 **Дөңгелек айтады…**',
  'game.hangman.name': 'Жасырын сөз',
  'game.hangman.desc': 'Сөзді бір-бірлеп әріппен табыңыз — 6 қате жіберсеңіз, ойын бітеді.',
  'game.hangman.intro':
    '🪢 **Жасырын сөз** — сөзді табу үшін бір-бірлеп әріп жазыңыз. Сондай-ақ бүкіл сөзді жаза аласыз!',
  'game.hangman.hit': '🟢 **{user}** **{letter}** әрпін тапты!',
  'game.hangman.miss': '🔴 **{user}** — **{letter}** жоқ.',
  'game.hangman.wrongLetters': 'Қате: {letters}',
  'game.hangman.win': '🎉 **{user}** шешті — **{word}**!',
  'game.hangman.lose': '💀 Мүмкіндіктер бітті! Сөз **{word}** болды.',
  'game.hangman.idle': '🕹️ Ойын кідіртілді (ешкім ойнамайды). Сөз **{word}** болды.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    '5 әріптен тұратын сөзді табыңыз. 🟩 дұрыс орын, 🟨 қате орын, ⬛ сөзде жоқ. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — 5 әріптен тұратын сөз жазыңыз. Сіздер {max} болжамды бөлісесіздер. 🟩 дұрыс орын · 🟨 қате орын · ⬛ сөзде жоқ.',
  'game.wordle.guess': '🔤 **{user}** болжады — **{left}** болжам қалды',
  'game.wordle.inWord': '🟢 сөзде бар: {letters}',
  'game.wordle.out': '🚫 жоқ: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** {n} әрекетте тапты — **{word}**!',
  'game.wordle.lose': '💀 Болжамдар бітті! Сөз **{word}** болды.',
  'game.wordle.idle': '🕹️ Ойын кідіртілді (ешкім ойнамайды). Сөз **{word}** болды.',
  'game.tictactoe.name': 'Крест-нөл',
  'game.tictactoe.desc':
    'Екі ойыншы — белгіңізді қою үшін 1-9 санын жазыңыз. Қатарынан үшеу жеңеді.',
  'game.tictactoe.intro':
    '⭕ **Крест-нөл** — алғашқы екі ойыншы ❌ және ⭕ болады (❌ бастайды). Ұяшығыңызды таңдау үшін 1-9 санын жазыңыз.',
  'game.tictactoe.turn': 'Кезек: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, кезек **{mark}**-те.',
  'game.tictactoe.taken': '🚫 {cell} ұяшығы бос емес — басқасын таңдаңыз.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) жеңді!',
  'game.tictactoe.draw': '🤝 Тең ойын!',
  'game.tictactoe.idle': '🕹️ Ойын аяқталды (ешкім ойнамайды).',
  'game.chess.name': 'Шахмат',
  'game.chess.desc':
    'Екі ойыншы — нағыз шахмат ережелері (шах, рокировка, түрлендіру…). "e4" немесе "Nf3" сияқты жүрісті жазыңыз. 💎 Premium.',
  'game.chess.intro':
    '♟️ **Шахмат** — алғашқы екі жүріс жасаған ойыншы ақ пен қара болады (ақ бастайды). Жүрісті алгебралық жазбада ("e4", "Nf3", "O-O") немесе координаталармен ("e2e4") жазыңыз. Берілу үшін "resign" деп жазыңыз.',
  'game.chess.white': 'Ақ',
  'game.chess.black': 'Қара',
  'game.chess.seats': '⚪ Ақ: **{white}** · ⚫ Қара: **{black}**',
  'game.chess.turn': '{move} — кезек: **{color}**',
  'game.chess.check': '♟️ Шах!',
  'game.chess.notYourTurn': '⏳ **{user}**, кезек **{color}**-та.',
  'game.chess.illegalMove': '🚫 "{move}" — жарамды жүріс емес — қайталап көріңіз.',
  'game.chess.checkmate': '🏆 Мат ({move})! **{user}** жеңді!',
  'game.chess.draw': '🤝 Тең ойын ({move})!',
  'game.chess.resigned': '🏳️ **{user}** берілді — **{winner}** жеңді!',
  'game.chess.idle': '🕹️ Ойын аяқталды (ешкім ойнамайды).',
  'game.wordChain.name': 'Сөз тізбегі',
  'game.wordChain.descr':
    'Бір тілдегі кезектесіп ойналатын сөз тізбегі: алдыңғы сөздің соңғы әрпінен басталатын сөз айтыңыз. 2 өмір, қайталауға болмайды, уақыт жылдамдай береді. Тілді `language` опциясымен таңдаңыз. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Сөз тізбегі қазір **{lang}** тілінде қолжетімсіз (сөздер тізімі жоқ).',
  'game.wordChain.lobby':
    '🔗 **{lang}** тіліндегі **Сөз тізбегі**! Қосылу үшін осы арнаға **{seconds}с** ішінде кез келген нәрсе жазыңыз.',
  'game.wordChain.notEnough':
    '😴 Жеткілікті ойыншы қосылмады (кемінде 2 қажет). Ойын болдырылмады.',
  'game.wordChain.begin':
    '🚀 Басталуда! Ойыншылар: {players}. Әр сөз алдыңғысының соңғы әрпінен басталуы керек.',
  'game.wordChain.turn':
    '**{name}**, кезек сізде! **{letter}** әрпінен басталатын **{lang}** сөзі — {hearts} · ⏱️ {seconds}с',
  'game.wordChain.accepted': '✅ **{word}** — келесі әріп: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Ол **{letter}** әрпінен басталуы керек.',
  'game.wordChain.bad.short': '📏 Тым қысқа — кемінде **{min}** әріп.',
  'game.wordChain.bad.repeated': '🔁 Бұл сөз бұрын қолданылған.',
  'game.wordChain.bad.word': '📖 Бұл сөздікте жоқ.',
  'game.wordChain.bad.latin': '🔤 Тек A–Z әріптері саналады.',
  'game.wordChain.timeout': '⏰ **{name}** уақыты бітті! {hearts} қалды.',
  'game.wordChain.eliminated': '💀 **{name}** ойыннан шықты!',
  'game.wordChain.winner': '🏆 **{name}** тізбекте жеңді! ({chain} сөз)',
  'game.stats.none': 'Сіз әлі ешбір ойын ойнамадыңыз. `/game play` көріңіз!',
  'game.stats.body': '🎮 **Сіздің статистикаңыз** — **{points}** ұпай · **{wins}** жеңіс · {rank}',
  'game.stats.rank': '{total} ішінде **#{rank}** орын',
  'game.stats.unranked': 'әлі орын жоқ',
  'game.pickPrompt': '🎮 Қай ойынды ойнағыңыз келеді? Біреуін таңдаңыз:',
  'game.pickPlaceholder': 'Ойын таңдаңыз…',
  'game.pickTimeout': '⏰ Ешбір ойын таңдалмады — дайын болғанда `/game play` қайта орындаңыз.',
  'pron.listHeader': '🗣️ **Сіздің айтылымдарыңыз** ({count}/{limit}):',
  'pron.listEmpty': 'Сізде әлі ешқайсысы жоқ — `/pronunciation add` арқылы қосыңыз.',
  'pron.set': '✅ Сақталды! **Сіз** «{term}» деп жазғанда, мен «{replacement}» деп айтамын.',
  'pron.removed': '🗑️ «{term}» жойылды.',
  'pron.notFound':
    'Сізде «{term}» үшін айтылым жоқ. Өзіңіздікін `/pronunciation list` арқылы қараңыз.',
  'pron.empty': 'Сөз бен оны айту тәсілі бос болуы мүмкін емес.',
  'pron.limitHit':
    '🔒 Сіз **{limit}** айтылым шегіне жеттіңіз. Біреуін `/pronunciation remove` арқылы жойыңыз.',
  'pron.limitUpsell': '💎 Vozen Plus немесе Premium оны **50**-ге дейін көтереді → {url}',
  'pron.modalTitle': 'Vozen-ге айтылымды үйретіңіз',
  'pron.modalTerm': 'Сөз (адамдар қалай жазады)',
  'pron.modalSay': 'Vozen оны қалай айтуы керек',
  'spron.listHeader': '🗣️ **Сервер айтылымдары** ({count}/{limit}) — бәріне қолданылады:',
  'spron.listEmpty': 'Әзірге ешқайсысы жоқ — `/server-pronunciation add` арқылы қосыңыз.',
  'spron.set': '✅ Бүкіл сервер үшін сақталды! «{term}» → «{replacement}».',
  'spron.removed': '🗑️ «{term}» серверден жойылды.',
  'spron.notFound': 'Серверде «{term}» үшін айтылым жоқ.',
  'spron.limitHit':
    '🔒 Сервер **{limit}** айтылым шегіне жетті. Біреуін `/server-pronunciation remove` арқылы жойыңыз.',
  'spron.modalTitle': 'Сервер айтылымы',
  'spron.modalSay': 'Vozen оны бәріне қалай айтады',
  'rand.selectPrompt': '🎲 **Кездейсоқ таңдаушы** — қанша нұсқаның ішінен таңдағанымды қалайсыз?',
  'rand.selectPlaceholder': 'Нұсқалар саны…',
  'rand.selectOption': '{n} нұсқа',
  'rand.filling': '📝 Жаңа ашылған форманы толтырыңыз!',
  'rand.modalTitle': 'Кездейсоқ таңдаушы — {amount} нұсқа',
  'rand.modalOption': '{n}-нұсқа',
  'rand.needTwo': 'Маған үтірмен бөлінген кемінде 2 нұсқа беріңіз (мысалы, "pizza, sushi").',
  'rand.result': '{count} нұсқаның ішінен мен… **{winner}** таңдаймын!',
  'rand.speak': 'Мен… {winner} таңдаймын!',
  'rand.notInVoice': '_(менімен бірге дауыстық арнаға кіріңіз, келесі жолы оны дауыстап айтамын)_',
  'rand.timeout': '⏰ Ештеңе таңдалмады — дайын болғанда `/randomizer` қайта орындаңыз.',
};
