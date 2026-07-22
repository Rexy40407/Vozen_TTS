export default {
  'error.generic': 'Что-то пошло не так. Пожалуйста, попробуйте ещё раз.',
  'error.needManageGuild': 'Для этого вам нужно право **Управление сервером**.',
  'join.needVoiceChannel': 'Сначала зайдите в голосовой канал, затем запустите /join.',
  'join.missingPerms': 'Мне нужны права **Подключаться** и **Говорить** в {channel}.',
  'join.joined':
    '✅ Я в {channel}! Дальше: напишите `/tts привет`, и я произнесу это вслух. Хотите, чтобы я автоматически читал канал? Запустите /setup.',
  'join.joinedAutoread':
    '✅ Я в {channel}! Всё готово. Пишите в канале авточтения, и я буду читать это вслух. → {readChannel}',
  'leave.left': 'Покинул голосовой канал. До встречи!',
  'skip.notInVoice':
    'Я ещё не в голосовом канале — зайдите в него и сначала запустите /join, затем попробуйте снова.',
  'skip.skipped': 'Пропущено.',
  'skip.nothing': 'Сейчас ничего не воспроизводится.',
  'tts.notInVoice':
    'Я ещё не в голосовом канале — зайдите в него и запустите /join, затем попробуйте снова.',
  'tts.nothingToRead': 'Там нечего читать — пришлите мне текст, чтобы я его произнёс.',
  'tts.nothingAfterClean':
    'После обработки читать оказалось нечего — попробуйте обычный текст (буквы или слова).',
  'tts.tooFast': 'Ого, помедленнее — попробуйте ещё раз через мгновение.',
  'tts.blocked': 'Этот текст содержит запрещённое слово, поэтому я его пропустил.',
  'tts.queued': 'Готово — добавлено в очередь.',
  'tts.busy': 'Я сейчас занят — попробуйте ещё раз через мгновение.',
  'voice.unknownModel': 'Я не знаю такой голос — проверьте /voice list.',
  'voice.badSpeed':
    'Скорость должна быть от 0.5 до 2.0 (1.0 — обычная). Попробуйте `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Ваш голос теперь **{name}** со скоростью {speed}×. Напишите `/tts привет`, чтобы услышать его. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Настройка голоса** — выберите параметры ниже и нажмите **Сохранить**. До этого ничего не изменится.',
  'voice.config.summary': 'Текущий выбор: **{voice}** · движок **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Язык…',
  'voice.config.pickVoice': 'Голос…',
  'voice.config.pickEngine': 'Движок…',
  'voice.config.pickSpeed': 'Скорость…',
  'voice.config.more': '▼ Больше языков',
  'voice.config.engDefault': 'По умолчанию (локальный)',
  'voice.config.save': 'Сохранить',
  'voice.config.cancel': 'Отмена',
  'voice.config.cancelled': 'Настройка отменена — ничего не изменилось.',
  'voice.config.expired':
    'Срок действия панели истёк — снова запустите `/voice config` для продолжения.',
  'voice.listHeader': 'Доступные голоса:',
  'voice.listEmpty': '(не установлено)',
  'voice.reset':
    '✅ Ваш голос снова стандартный. В любой момент выберите другой через `/voice list` и `/voice set`.',
  'voice.optout':
    'Вас больше не будут читать автоматически. Запустите /voice opt-in, чтобы включить снова.',
  'voice.optin': 'Вас снова будут читать автоматически.',
  'voice.notInVoice': 'Я ещё не в голосовом канале — сначала запустите /join.',
  'voice.previewPlaying': 'Воспроизвожу образец…',
  'preview.sample': 'Привет, я Vozen. напиши — услышь.',
  'laugh.playing': 'Ха-ха! Воспроизвожу это вашим голосом…',
  'joke.playing': 'Рассказываю шутку…\n> {joke}',
  'joke.unknownLang': 'Я не знаю такой язык. Выберите один из списка.',
  'voice.abbrev.added': 'Готово — {term} будет читаться как {replacement}.',
  'voice.abbrev.removed': 'Ваше сокращение для {term} удалено.',
  'voice.abbrev.listHeader': 'Ваши личные сокращения (использовано {count}/{cap}):',
  'voice.abbrev.listEmpty': '(пока нет — добавьте через /voice abbrev add)',
  'voice.abbrev.capReached':
    'Вы достигли лимита в {cap} личных сокращений. Удалите одно, прежде чем добавить новое.',
  'voice.abbrev.invalidTerm':
    'Термин должен быть одним словом (только буквы и цифры), до 50 символов.',
  'voice.abbrev.emptyReplacement': 'Чтение не может быть пустым.',
  'voice.abbrev.tooLong': 'Чтение слишком длинное (максимум 200 символов).',
  'config.wordEmpty': 'Слово не может быть пустым.',
  'config.blocked': 'Заблокировано: {word}.',
  'config.unblocked': 'Разблокировано: {word}.',
  'config.pronListHeader': 'Словарь произношения:',
  'config.pronEmptyValue': '(пусто)',
  'config.listEmpty': '(нет)',
  'config.termEmpty': 'Термин не может быть пустым.',
  'config.pronEmpty': 'Произношение не может быть пустым.',
  'config.pronSet': 'Готово — {term} будет читаться как {replacement}.',
  'config.pronRemoved': 'Произношение для {term} удалено.',
  'config.channelWrongType': 'Выберите текстовый канал (не голосовой канал и не категорию).',
  'config.channelNoAccess': 'Я не вижу {channel} — пожалуйста, проверьте мои права там.',
  'config.channelSet':
    'Канал авточтения установлен на {channel}. Дальше: убедитесь, что авточтение включено, командой `/config auto-read active:true`.',
  'config.autoreadOn': 'Авточтение теперь **включено**.',
  'config.autoreadOff': 'Авточтение теперь **выключено**.',
  'config.maxCharsRange': 'Значение максимального числа символов должно быть от 1 до 2000.',
  'config.maxCharsSet': 'Максимум символов на сообщение установлен на {value}.',
  'config.rateLimitRange': 'Значение ограничения частоты должно быть от 1 до 120.',
  'config.rateLimitSet': 'Ограничение частоты установлено на {value} сообщений в минуту.',
  'config.roleSet': 'Авточтение теперь ограничено участниками с {role}.',
  'config.roleCleared': 'Ограничение по роли снято — теперь читать можно всех.',
  'config.enabledOn': 'TTS теперь **включён** на этом сервере.',
  'config.enabledOff': 'TTS теперь **выключен** на этом сервере.',
  'config.defaultVoiceSet':
    '✅ Голос сервера по умолчанию установлен на **{name}**. Участники без своего голоса будут слышать этот. (id: `{model}`)',
  'config.reset':
    'Настройки сброшены к значениям по умолчанию. Ваш список блокировок и произношения сохранены.',
  'config.showTitle': '**Настройки сервера**',
  'config.showChannel': 'Канал TTS: {value}',
  'config.showAutoread': 'Авточтение: {value}',
  'config.showRole': 'Роль: {value}',
  'config.showEnabled': 'Включено: {value}',
  'config.showVoice': 'Голос по умолчанию: {value}',
  'config.showMaxChars': 'Максимум символов: {value}',
  'config.showRateLimit': 'Ограничение частоты: {value}/мин',
  'config.showBlocklist': 'Список блокировок: {count} слов',
  'config.showPronunciation': 'Произношения: {count} записей',
  'config.valueNone': '(нет)',
  'config.valueAny': 'любой',
  'config.valueAutoDetect': '(автоопределение)',
  'config.on': 'вкл',
  'config.off': 'выкл',
  'config.language.set': 'Язык интерфейса установлен на {language}.',
  'config.language.unsupported': 'Этот язык пока не поддерживается.',
  'setup.noChannel':
    'Я не смог определить, какой канал использовать. Укажите текстовый канал в параметре "channel".',
  'setup.channelWrongType':
    'Канал авточтения должен быть текстовым каналом (не голосовым каналом и не категорией). Укажите такой в параметре "channel".',
  'setup.done': '**Всё готово — Vozen к работе готов.**',
  'setup.channelLine': 'Канал авточтения: {channel}',
  'setup.autoreadOn': 'Авточтение: вкл',
  'setup.permsHeader': '**Права:**',
  'setup.permView': 'ViewChannel (видеть текстовый канал)',
  'setup.permSend': 'SendMessages (писать в текстовый канал)',
  'setup.permConnect': 'Connect (подключаться к голосовому каналу)',
  'setup.permSpeak': 'Speak (говорить в голосовом канале)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — отсутствует',
  'setup.permUnchecked': '⏳ {label} — ещё не проверено (я проверю при /join)',
  'setup.fixHint':
    'Чтобы исправить недостающее: в настройках сервера откройте роль Vozen (или права канала) и включите пункты, отмеченные ❌.',
  'setup.voiceUncheckedNote':
    'Вы не в голосовом канале, поэтому я пока не смог проверить Connect/Speak — я проверю их, когда вы запустите /join.',
  'setup.allGood': 'Всё готово. Зайдите в голосовой канал и запустите /join.',
  'setup.joinedVoice': 'Я тоже зашёл в {channel} — запускать /join не нужно.',
  'setup.readyTalk': 'Всё готово. Пишите в канале авточтения, и я буду читать это вслух.',
  'setup.membersHeader': '**Расскажите участникам (процесс в 3 шага):**',
  'setup.membersBody':
    '1) Зайдите в голосовой канал\n2) Запустите /join, чтобы я зашёл вместе с вами\n3) Пишите в этом канале (или используйте /tts), и я прочитаю это вслух\nПолный список команд: /help',
  'stats.title': '**Статистика Vozen**',
  'stats.messagesSpoken': 'Сообщений произнесено: {value}',
  'stats.cacheHits': 'Попаданий в кэш: {value}',
  'stats.cacheMisses': 'Промахов кэша: {value}',
  'stats.synthErrors': 'Ошибок синтеза: {value}',
  'stats.voiceDrops': 'Обрывов голоса: {value}',
  'stats.voiceReconnects': 'Переподключений: {value}',
  'stats.votes': 'Голосов на top.gg: {value}',
  'stats.activePlayers': 'Активных проигрывателей: {value}',
  'stats.servers': 'Серверов: {value}',
  'stats.uptime': 'Время работы: {value}с',
  'invite.noClientId':
    'Ссылка-приглашение Vozen ещё не настроена (отсутствует CLIENT_ID). Сообщите об этом администратору бота.',
  'invite.link': 'Добавьте Vozen на свой сервер:\n{url}',
  'vote.noClientId':
    'Ссылка для голосования за Vozen ещё не настроена (отсутствует CLIENT_ID). Сообщите об этом администратору бота.',
  'vote.link':
    'Проголосуйте за Vozen (бесплатно, каждые 12 ч) и помогите большему числу людей найти его:\n{url}\nЕсли этот аккаунт ещё не получал награду, он получит **48 часов Vozen Plus**, только один раз на аккаунт.',
  'help.title': 'Vozen — напиши, услышь.',
  'help.embedTitle': 'Vozen — Команды',
  'help.intro':
    'Vozen читает ваш текст вслух в голосовых каналах — бесплатные нейросетевые голоса, десятки языков.',
  'help.quickStartTitle': 'Быстрый старт (3 шага)',
  'help.quickStartBody':
    '1) Зайдите в голосовой канал, затем запустите /join\n2) Пишите в текстовом канале (или используйте /tts Всем привет!)\n3) (по желанию) Выберите голос через /voice set',
  'help.groupStarted': 'С чего начать',
  'help.groupStartedBody':
    '• /join — я захожу в ваш голосовой канал\n• /leave — я покидаю голосовой канал\n• /tts <текст> — я читаю текст вслух · напр. /tts Всем привет!\n• /skip — пропустить то, что я читаю прямо сейчас',
  'help.groupVoice': 'Ваш голос',
  'help.groupVoiceBody':
    '• /voice set <model> — выберите свой голос · напр. /voice set en_US-amy-medium\n• /voice list — посмотреть доступные голоса\n• /voice preview — услышать образец своего голоса\n• /voice reset — вернуться к голосу по умолчанию\n• /voice opt-out · /voice opt-in — выключить / включить авточтение для вас\n• /voice abbrev add|remove|list — личный сленг, читается по-вашему (до 10)',
  'help.groupFun': 'Развлечения',
  'help.groupFunBody':
    '• /joke — я рассказываю короткую шутку (выберите язык + по желанию смех) · напр. /joke English\n• /laugh — я смеюсь вслух вашим текущим голосом',
  'help.groupAdmin': 'Администрирование сервера (нужно Управление сервером)',
  'help.groupAdminBody':
    '• /setup — пошаговая настройка в один шаг · запустите это первым\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · напр. /config tts-channel #general\n• /stats — статистика бота',
  'help.groupMore': 'Ещё',
  'help.groupMoreBody':
    '• /invite — добавить Vozen на другой сервер\n• /vote — проголосовать за Vozen на top.gg\n• /help — показать эту справку',
  'help.footer': 'Впервые здесь? Запустите {command}, чтобы начать.',
  'welcome.title': 'Спасибо, что добавили Vozen! 👋',
  'welcome.description':
    'Vozen читает ваш чат вслух в голосовых каналах — напиши, услышь.\n\n**Начните в один шаг:** запустите {setup}, и я настрою авточтение и зайду в ваш голосовой канал.\n\nНужен полный список команд? Запустите {help}.',
  'welcome.enginePlans':
    'Нейросетевые голоса Piper остаются бесплатными. 💎 Kokoro и Google HD доступны с Vozen Plus или серверным Premium.',
  'welcome.stepsTitle': 'Как участники это используют (3 шага)',
  'welcome.stepsBody':
    '1) Зайдите в голосовой канал\n2) Запустите /join, чтобы я зашёл к вам\n3) Пишите в текстовом канале (или используйте /tts), и я прочитаю это вслух\nПолный список команд: /help',
  'welcome.footer': 'Vozen — напиши, услышь.',
  'welcome.tagline': 'Естественный нейросетевой голос — бесплатно навсегда, без платного барьера.',
  'stt.guildOnly': 'Транскрипция работает только на сервере.',
  'stt.noManage': 'Для запуска или остановки транскрипции вам нужно право **Управление сервером**.',
  'stt.notPremium':
    '🎙️ Транскрипция в реальном времени — это функция **Premium**. Используйте `/premium info`, чтобы разблокировать её для этого сервера.',
  'stt.unavailable':
    'Транскрипция недоступна на этом экземпляре (движок распознавания речи не установлен).',
  'stt.notInVoice':
    'Я не в голосовом канале — сначала зайдите в него и запустите `/join`, затем начните транскрипцию.',
  'stt.alreadyRunning':
    'Транскрипция уже запущена на этом сервере. Сначала используйте `/transcribe stop`.',
  'stt.atCapacity':
    'Сейчас на всех серверах запущено слишком много транскрипций. Пожалуйста, попробуйте ещё раз чуть позже.',
  'stt.noChannel':
    'Я не могу публиковать транскрипты в этом канале. Попробуйте запустить команду из обычного текстового канала.',
  'stt.started':
    '✅ Транскрипция запущена. Каждый, кто нажмёт **Согласен** в объявлении, будет транскрибироваться в этот канал.',
  'stt.startFailed':
    'Не удалось запустить транскрипцию (не получилось опубликовать объявление). Я всё отменил — ничего не записывается. Пожалуйста, попробуйте ещё раз.',
  'stt.announceStart':
    '🎙️ **Транскрипция в реальном времени ВКЛЮЧЕНА в этом канале.** Транскрибируются только те, кто дал согласие — нажмите кнопку ниже, чтобы разрешить запись вашей речи здесь. Отозвать согласие можно в любой момент через `/transcribe revoke`.',
  'stt.consentBtn': 'Согласен на транскрипцию',
  'stt.consentThanks':
    '✅ Спасибо — теперь ваша речь будет транскрибироваться на этом сервере. Отозвать согласие можно в любой момент через `/transcribe revoke`.',
  'stt.stopped': '🛑 Транскрипция остановлена.',
  'stt.notRunning': 'Транскрипция не запущена на этом сервере.',
  'stt.announceStop':
    '🛑 **Транскрипция в реальном времени теперь ВЫКЛЮЧЕНА.** Я перестал слушать.',
  'stt.revoked':
    '✅ Согласие отозвано — вас больше не будут транскрибировать на этом сервере. (Уже опубликованные сообщения остаются; удалите их в Discord, если хотите.)',
  'stt.revokeNone':
    'Вы не давали согласия на транскрипцию на этом сервере, поэтому отзывать было нечего.',
  'privacy.eraseConfirm':
    '⚠️ Это навсегда удалит **все** ваши данные Vozen на всех серверах: настройки голоса, произносимое имя, личные сокращения и произношения, сохранённый день рождения, игровые очки, статистику речи и отказ от чтения. **Это нельзя отменить.** Вы уверены?',
  'privacy.erasePremiumNote':
    '_Примечание: ваши оплаченные Premium/Plus и история покупок сохраняются — они принадлежат вам и требуются по закону для финансовой отчётности. Чтобы прекратить Premium, дайте ему истечь или обратитесь в поддержку._',
  'privacy.eraseYes': 'Удалить всё',
  'privacy.eraseNo': 'Отмена',
  'privacy.eraseCancelled': 'Отменено — ничего не удалено.',
  'privacy.eraseDone': '✅ Готово. Все ваши персональные данные навсегда удалены.',
  'shutup.notInVoice': 'Я ещё не в голосовом канале — сначала зайдите в него и запустите /join.',
  'shutup.nothing': 'Сейчас ничего не воспроизводится.',
  'shutup.done': '🤐 Хорошо, я замолкаю — очистил всё в очереди.',
  'voice.detection.on':
    '✅ Автоопределение языка ВКЛЮЧЕНО: каждое сообщение читается голосом определённого для него языка (говорящий может меняться). Отключите через `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Автоопределение языка ВЫКЛЮЧЕНО: всё читает один ваш фиксированный голос, так что вы всегда звучите одинаково.',
  'voice.nickname.set': '✅ Теперь Vozen будет называть вас **{name}** вслух.',
  'voice.nickname.cleared':
    '✅ Произносимое имя сброшено — Vozen будет использовать ваше имя на сервере.',
  'voice.nickname.invalid':
    'В этом имени нет ничего, что можно прочитать вслух. Используйте буквы или цифры.',
  'voice.effect.set':
    '✅ Голосовой эффект установлен на **{effect}** — ваши сообщения теперь воспроизводятся с этим эффектом. Используйте `/voice effect none`, чтобы отключить.',
  'voice.effect.cleared': '✅ Голосовой эффект убран — снова чистый голос.',
  'voice.effect.locked':
    '🔒 **{effect}** — это Premium-эффект. Бесплатные эффекты: 🤖 Robot и 🔊 Echo. Разблокируйте все с Vozen Premium — см. `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** — это Premium-движок голоса. Разблокируйте его с Vozen Plus (личный) или Vozen Premium (сервер) — см. `/premium`. А пока ваш голос остаётся на бесплатном локальном движке.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** — это Premium-движок голоса. Разблокируйте его с Vozen Plus (личный) или Vozen Premium (сервер) — см. `/premium`. А пока ваш голос остаётся на бесплатном локальном движке.',
  'rizz.playing': '😏 Подкатываю…\n> {line}',
  'rizz.unknownLang': 'Я не знаю такой язык. Выберите один из списка.',
  'rizz.locked':
    '🔒 **/rizz** — это Premium-бонус. Разблокируйте его с Vozen Plus (для вас) или Premium (для этого сервера). См. `/premium`.',
  'sound.playing': '🔊 Воспроизвожу **{name}**…',
  'sound.unknown': 'У меня нет такого звука. Запустите `/sound`, чтобы увидеть список.',
  'sound.list':
    '🔊 **Звуки:** {sounds}\nВоспроизведите один через `/sound name:<sound>` (я должен быть в вашем голосовом канале).',
  'sound.disabled':
    '🔇 Саундборд **выключен** на этом сервере. Администратор может включить его через `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 День рождения сохранён: **{day}/{month}**. Я поздравлю вас, когда вы зайдёте в голосовой канал в этот день!',
  'birthday.invalid': 'Такой даты не существует. Проверьте день и месяц.',
  'birthday.cleared': '🎂 День рождения удалён.',
  'birthday.show': '🎂 Ваш день рождения установлен на **{day}/{month}**.',
  'birthday.none': 'Вы ещё не указали день рождения. Используйте `/birthday set`.',
  'topspeakers.title': '🗣️ **Самые говорливые** — кого я читаю больше всех на этом сервере:',
  'topspeakers.empty':
    'Я ещё не читал ничьих сообщений. Настройте канал для чтения через `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** сообщений · 🔥 серия {streak} дн.',
  'serverstats.title': '📊 **Статистика сервера**',
  'serverstats.empty':
    'Пока нет статистики — я не читал здесь сообщений и не проводил игр. Настройте через `/setup`!',
  'serverstats.messages': '🗣️ Прочитано сообщений: **{total}** · людей: **{speakers}**',
  'serverstats.topTalkers': '**Самые болтливые:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} сообщ. · 🔥 {streak}д',
  'serverstats.streak': '🔥 Самая длинная активная серия: **{days}** дн.',
  'serverstats.games':
    '🎮 Игровых очков: **{points}** · побед: **{wins}** · игроков: **{players}**',
  'serverstats.topPlayers': '**Лучшие игроки:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} очк. · {wins} побед',
  'serverstats.upsell':
    '🔒 Это бесплатный предпросмотр. **Premium** открывает серии, игровую статистику и полный топ-5 — см. `/premium`.',
  'streak.day':
    '🔥 <@{user}> держит серию **{n} дн.**! Продолжайте говорить, чтобы не прервать её.',
  'leaderboard.autoTitle': '🏆 Самые болтливые на этом сервере',
  'premium.title': '💎 **Статус Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Сервер:** Premium до {date}',
  'premium.lineServerFree': '🖥️ **Сервер:** бесплатный план',
  'premium.lineUserActive': '👤 **Вы (Plus):** активно до {date}',
  'premium.lineUserFree': '👤 **Вы (Plus):** не активно',
  'premium.getHint':
    'Всё, чем вы пользуетесь сегодня, остаётся бесплатным. Premium добавляет все 8 голосовых эффектов, режим 24/7 в звонке, 50 личных произношений, /rizz и премиум-игры. Поддержать: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium-движки голоса:** нейросетевой Kokoro и Google HD — Plus открывает их лично, а серверный Premium — для всех.',
  'premium.linePass':
    '🎟️ **Ваш пропуск Premium:** используется лицензий {used}/{total} · истекает {date}',
  'premium.passServers': '↳ Используется на: {servers}',
  'premium.pitch':
    'У вас пока нет Premium. **Vozen Premium** (€3.99/мес за 3 сервера или €7.99/мес за 8) разблокирует для всего сервера: все 8 голосовых эффектов, режим 24/7 в звонке, 50 личных произношений (вместо 3), команду /rizz и премиум-игры (Цепочка слов, Wordle, Шахматы). **Vozen Plus** (€1.99/мес) даёт вам эти бонусы лично, на любом сервере.',
  'premium.buyHint':
    '▶ **Получить Premium:** {link}\nПосле покупки запустите `/premium activate` на нужном сервере.',
  'premium.confirmActivate':
    'Использовать **1 из ваших {total} лицензий Premium** на **этом сервере**? Сейчас у вас используется **{used}**. Позже вы сможете освободить её через `/premium deactivate` — время на пропуске идёт в любом случае.',
  'premium.confirmYes': '💎 Использовать лицензию',
  'premium.confirmNo': 'Отмена',
  'premium.activateOk':
    '✅ Premium теперь активен на **этом сервере** до {date}. Лицензий используется: **{used}/{total}**.',
  'premium.activateCancelled': 'Отменено — лицензия не использована.',
  'premium.activateTimeout': 'Время вышло — лицензия не использована.',
  'premium.noPass':
    'У вас нет активного пропуска Premium. Приобретите его, и он появится на вашем аккаунте — затем запустите `/premium activate` здесь.\n▶ {link}',
  'premium.alreadyActive':
    'На этом сервере уже используется одна из ваших лицензий Premium. Делать ничего не нужно.',
  'premium.noSeats':
    'Все ваши **{total}** лицензий Premium используются ({servers}). Освободите одну через `/premium deactivate` там и попробуйте снова здесь.',
  'premium.needManageGuild':
    'Активация Premium затрагивает весь сервер — сделать это могут только участники с правом **Управление сервером**. Обратитесь к администратору.',
  'premium.deactivateOk':
    '✅ Лицензия Premium этого сервера освобождена. Используйте её на другом сервере через `/premium activate`.',
  'premium.deactivateNone': 'На этом сервере нет вашей лицензии Premium, которую можно освободить.',
  'premium.thisServer': 'этот сервер',
  'grant.denied': '⛔ Эта команда только для владельца бота.',
  'grant.okPremium':
    '✅ Выдан <@{user}> **пропуск Premium** ({seats} лицензий) на **{days}** дн. — истекает {date}. Активирует через `/premium activate`.',
  'grant.okPlus': '✅ Выдан <@{user}> **Vozen Plus** на **{days}** дн. — истекает {date}.',
  'gencode.done':
    '✅ Сгенерировано кодов {plan}: **{count}**, по **{days}** дн. каждый. Поделитесь ими лично:\n{list}',
  'redeem.okPlus':
    '🎁 Активировано! Вы получили **Vozen Plus** на **{days}** дн. — истекает {date}.',
  'redeem.okPremium':
    '🎁 Активировано! Вы получили **пропуск Premium** ({seats} лицензий) на **{days}** дн. — истекает {date}. Активируйте его на своём сервере через `/premium activate`.',
  'redeem.notFound': '❌ Такого кода не существует. Проверьте его и попробуйте снова.',
  'redeem.used': '❌ Этот код уже был активирован.',
  'redeem.expired': '❌ Срок действия этого кода истёк.',
  'config.blockLimit':
    'На этом сервере уже максимум заблокированных слов ({max}). Удалите одно, прежде чем добавить новое.',
  'config.xsaidOn':
    'Теперь Vozen будет объявлять, **кто сказал**, перед каждым сообщением (например, «Alex сказал привет»). Отключите через `/config x-said active:false`.',
  'config.xsaidOff':
    'Vozen **больше не** будет объявлять, кто сказал — он читает только сообщение.',
  'config.autojoinOn':
    '✅ Автовход **включён** — Vozen будет заходить в ваш голосовой канал, когда вы пишете в TTS-канале.',
  'config.autojoinOff':
    'Автовход **выключен** — используйте `/join`, чтобы привести Vozen в голосовой канал.',
  'config.stayOn':
    '✅ Режим 24/7 в звонке **включён** — Vozen будет оставаться в голосовом канале, даже когда он пустеет, и возвращаться после перезапусков. 💎 Для работы нужен Premium (купите или активируйте код через `/redeem`, затем `/premium activate`).',
  'config.stayOff':
    'Режим 24/7 в звонке **выключен** — Vozen выходит, когда голосовой канал пустеет (по умолчанию).',
  'config.readBotsOn': '✅ Теперь Vozen будет читать и сообщения от **других ботов и вебхуков**.',
  'config.readBotsOff':
    'Vozen будет **игнорировать** других ботов и вебхуки (читаются только реальные люди).',
  'config.textInVoiceOn':
    '✅ Vozen также будет читать **текстовый чат внутри своего голосового канала**.',
  'config.textInVoiceOff':
    'Vozen **не** будет читать текстовый чат голосового канала (только TTS-канал).',
  'config.antispamOn':
    '✅ Антиспам **включён** — Vozen не будет читать спам-сообщения (массовое повторение слов или одно и то же большое сообщение снова и снова).',
  'config.antispamOff': 'Антиспам **выключен** — Vozen читает каждое сообщение как обычно.',
  'config.streaksOn':
    '✅ Уведомления о сериях **включены** — Vozen показывает сообщение о серии 🔥 при первом высказывании каждого человека за день.',
  'config.streaksOff':
    'Уведомления о сериях **выключены** — Vozen всё равно считает серии (см. `/top-speakers`), но молчит о них.',
  'config.soundboardOn': 'Саундборд **включён** — любой может воспроизводить клипы через `/sound`.',
  'config.soundboardOff': 'Саундборд **выключен** — `/sound` отключён на этом сервере.',
  'config.votePromosLabel': 'Уведомления о награде top.gg + Vozen Support',
  'config.greetOn': '✅ Я буду приветствовать людей по имени, когда они заходят в голосовой канал.',
  'config.greetOff': '🔇 Я **не** буду приветствовать людей, когда они заходят в голосовой канал.',
  'config.greetLangSet': '✅ Язык приветствия при входе установлен на **{language}**.',
  'config.showXsaid': 'Объявлять говорящего (xsaid): {value}',
  'config.showAutojoin': 'Автовход: {value}',
  'config.showReadBots': 'Читать ботов/вебхуки: {value}',
  'config.showTextInVoice': 'Текст-в-голосе: {value}',
  'config.showAntispam': 'Антиспам: {value}',
  'config.showSoundboard': 'Саундборд (/sound): {value}',
  'config.showGreet': 'Приветствие при входе: {value} ({language})',
  'stats.synthLatency': 'Задержка синтеза: p50 {p50}мс / p95 {p95}мс (выборок: {count})',
  'speak.emptyMessage': 'В этом сообщении нет текста, который можно прочитать вслух.',
  'uptime.text': '🟢 Vozen онлайн уже **{uptime}**.',
  'botstats.title': '📊 **Vozen — статистика**',
  'botstats.servers': 'Серверов: **{value}**',
  'botstats.voiceSessions': 'Голосовых сессий сейчас: **{value}**',
  'botstats.messagesSpoken': 'Сообщений произнесено: **{value}**',
  'botstats.uptime': 'Время работы: **{value}**',
  'invite.button': 'Добавить Vozen',
  'vote.button': 'Голосовать на top.gg',
  'vote.upsell':
    '🗳️ Если этот аккаунт ещё не получал награду, он получит **48 часов Vozen Plus**, только один раз на аккаунт. {url}',
  'vote.cooldownStatus':
    '🗳️ Этот аккаунт уже использовал разовую награду за голос. Вы по-прежнему можете голосовать в поддержку Vozen, но дополнительный Plus не начисляется.',
  'help.support': '🛟 Нужна помощь или хотите сообщить о проблеме? {url}',
  'help.source':
    '📄 Открытый исходный код (AGPL-3.0) — получите точный исходный код, работающий здесь: {url}',
  'game.start.needVoice':
    'Это **голосовая игра** — сначала зайдите в голосовой канал и запустите /join, затем начните.',
  'game.start.alreadyActive':
    'Игра уже идёт в <#{channel}>. Завершите её (или используйте `/game stop`), прежде чем начинать новую.',
  'game.start.premiumLocked':
    '🔒 **{game}** — это Premium-игра (она требует реальных вычислений). См. `/premium`.',
  'game.start.started': '🎮 Запускаю **{game}**! Следите за каналом — удачи!',
  'game.start.startedThread':
    '🎮 **{game}** началась в <#{channel}> — заходите туда! Ветка удалится сама, когда игра закончится.',
  'game.thread.winner': '🏆 {winner} победил в игре!',
  'game.thread.ended': '🎮 Игра закончилась.',
  'game.unknownGame': 'Я не знаю такой игры. Выберите одну из списка.',
  'game.stop.ok': '🛑 Текущая игра остановлена.',
  'game.stop.none': 'Сейчас нет запущенной игры.',
  'game.list.title': '🎮 **Игры** — запустите одну через `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Таблица лидеров** — лучшие игроки этого сервера:',
  'game.leaderboard.empty': 'Пока не сыграно ни одной игры. Будьте первым — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** очк. ({wins} побед)',
  'game.finish.title': '🏁 **Игра окончена!** Итоговые очки:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Игра окончена — на этот раз никто не набрал очков. В следующий раз!',
  'game.finish.winnerVoice': '{user} побеждает!',
  'game.guessLanguage.name': 'Угадай язык',
  'game.guessLanguage.desc':
    'Я читаю предложение на случайном языке — кто первым назовёт язык, получает очко.',
  'game.guessLanguage.intro':
    '🗣️ **Угадай язык** — я прочитаю {rounds} предложений. Напишите, какой язык слышите. Самый быстрый правильный ответ выигрывает раунд!',
  'game.guessLanguage.round': '🎧 Раунд {n}/{total} — слушайте…',
  'game.guessLanguage.correct': '✅ **{user}** угадал — это был **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Время! Это был **{language}**.',
  'game.guessLanguage.noLanguages':
    'У меня установлено недостаточно голосов, чтобы играть в это. Попросите администратора добавить больше голосов.',
  'game.math.name': 'Устный счёт',
  'game.math.desc': 'Я произношу пример вслух — кто первым напишет ответ, побеждает.',
  'game.math.intro':
    '🔢 **Устный счёт** — {rounds} примеров. Слушайте и пишите ответ как можно быстрее!',
  'game.math.round': '🧮 Раунд {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** справился — ответ был **{answer}**!',
  'game.math.timeout': '⏱️ Время! Ответ был **{answer}**.',
  'game.math.plus': 'плюс',
  'game.math.minus': 'минус',
  'game.math.times': 'умножить на',
  'game.skipCount.name': 'Пропущенное число',
  'game.skipCount.desc':
    'Я считаю вслух, но пропускаю одно число — кто первым его заметит, побеждает.',
  'game.skipCount.intro':
    '🔢 **Пропущенное число** — я считаю, но одно число пропускаю. Напишите пропущенное число! (раундов: {rounds})',
  'game.skipCount.round': '👂 Раунд {n}/{total} — какое число я пропустил?',
  'game.skipCount.correct': '✅ **{user}** заметил — я пропустил **{answer}**!',
  'game.skipCount.timeout': '⏱️ Время! Я пропустил **{answer}**.',
  'game.spelling.name': 'Диктант',
  'game.spelling.desc': 'Я произношу слово — кто первым напишет его правильно, побеждает.',
  'game.spelling.intro': '✍️ **Диктант** — я произнесу {rounds} слов. Напишите каждое без ошибок!',
  'game.spelling.round': '🗣️ Раунд {n}/{total} — напишите слово, которое я произнесу…',
  'game.spelling.correct': '✅ **{user}** написал **{word}** правильно!',
  'game.spelling.timeout': '⏱️ Время! Слово было **{word}**.',
  'game.spelling.empty': 'У меня пока нет списка слов для языка голоса этого сервера.',
  'game.spellOut.name': 'Собери слово по буквам',
  'game.spellOut.desc': 'Я диктую слово по буквам — кто первым напишет слово целиком, побеждает.',
  'game.spellOut.intro':
    '🔡 **Собери слово по буквам** — я продиктую {rounds} слов по буквам. Напишите слово целиком!',
  'game.spellOut.round': '🔤 Раунд {n}/{total} — слушайте буквы…',
  'game.spellOut.correct': '✅ **{user}** угадал — **{word}**!',
  'game.spellOut.timeout': '⏱️ Время! Складывалось слово **{word}**.',
  'game.fastSpeech.name': 'Скороговорка',
  'game.fastSpeech.desc':
    'Я читаю предложение очень быстро — кто первым напишет, что я сказал, побеждает.',
  'game.fastSpeech.intro':
    '💨 **Скороговорка** — {rounds} предложений на безумной скорости. Напишите, что слышите!',
  'game.fastSpeech.round': '⚡ Раунд {n}/{total} — вот оно, быстро!',
  'game.fastSpeech.correct': '✅ **{user}** расшифровал: «{phrase}»',
  'game.fastSpeech.timeout': '⏱️ Время! Было: «{phrase}»',
  'game.fastSpeech.empty': 'У меня пока нет фраз для языка голоса этого сервера.',
  'game.accentSwap.name': 'Смешной акцент',
  'game.accentSwap.desc':
    'Я произношу слово с иностранным акцентом — кто первым его напишет, побеждает.',
  'game.accentSwap.intro':
    '🎭 **Смешной акцент** — {rounds} слов, произнесённых с неправильным акцентом. Напишите слово!',
  'game.accentSwap.round': '🌍 Раунд {n}/{total} — какое слово я пытаюсь произнести?',
  'game.accentSwap.correct': '✅ **{user}** угадал — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Время! Слово было **{word}**.',
  'game.reflexes.name': 'Рефлексы',
  'game.reflexes.desc':
    'Я веду обратный отсчёт, потом кричу СТАРТ — кто первым напишет после этого, побеждает. Не спешите раньше времени!',
  'game.reflexes.intro':
    '⚡ **Рефлексы** — {rounds} раундов. Когда я крикну **СТАРТ**, пишите что угодно как можно быстрее. Напишете до СТАРТ — фальстарт!',
  'game.reflexes.ready': '🚦 Раунд {n}/{total} — приготовьтесь…',
  'game.reflexes.countdown': 'три… два… один…',
  'game.reflexes.go': '🟢 **СТАРТ!!!**',
  'game.reflexes.goVoice': 'Старт!',
  'game.reflexes.tooSoon': '🔴 **{user}** поспешил — слишком рано!',
  'game.reflexes.win': '⚡ **{user}** оказался самым быстрым! Очко!',
  'game.reflexes.tooSlow': '😴 Никто не среагировал вовремя. Дальше!',
  'game.headsOrTails.name': 'Орёл или решка',
  'game.headsOrTails.desc':
    'Угадайте бросок монеты — напишите орёл или решка, прежде чем я подброшу. Кто угадает больше, побеждает!',
  'game.headsOrTails.intro':
    '🪙 **Орёл или решка** — {rounds} раундов. В каждом раунде пишите `heads` (орёл) или `tails` (решка), прежде чем я подброшу монету. 1 очко за правильную догадку!',
  'game.headsOrTails.introVoice': 'Сыграем в орла или решку!',
  'game.headsOrTails.round': '🪙 Раунд {n}/{total} — орёл или решка? Напишите свою догадку!',
  'game.headsOrTails.roundVoice': 'Орёл… или решка?',
  'game.headsOrTails.heads': 'орёл',
  'game.headsOrTails.tails': 'решка',
  'game.headsOrTails.resultVoice': 'Результат: {side}!',
  'game.headsOrTails.winners': 'Результат — **{side}**! Очко для: {users}',
  'game.headsOrTails.noWinners': 'Результат — **{side}**! Никто не угадал — без очков.',
  'game.vozenSays.name': 'Vozen говорит',
  'game.vozenSays.desc':
    'Выполняйте команду, только если она начинается с «Vozen говорит». Попадётесь в ловушку — проиграли!',
  'game.vozenSays.intro':
    '🫡 **Vozen говорит** — {rounds} команд. Выполняйте, ТОЛЬКО если я начинаю с **«Vozen говорит»**. Иначе — не двигайтесь!',
  'game.vozenSays.prefix': 'Vozen говорит',
  'game.vozenSays.verb': 'напишите',
  'game.vozenSays.real': '🗣️ Раунд {n}/{total} — «{command}»',
  'game.vozenSays.trap': '🗣️ Раунд {n}/{total} — «{command}»',
  'game.vozenSays.obeyed': '✅ **{user}** выполнил первым — очко!',
  'game.vozenSays.caught': '🔴 **{user}** — я не говорил «Vozen говорит»! Попался!',
  'game.vozenSays.nobody': '😴 Никто не выполнил **{word}** вовремя. Дальше!',
  'game.vozenSays.trapCleared': '😌 Это была ловушка — молодцы, никто не попался на **{word}**.',
  'game.roulette.name': 'Рулетка: правда или действие',
  'game.roulette.desc':
    'Я кручу рулетку и читаю одно задание (правда или действие) вслух. Запустите снова для нового.',
  'game.roulette.header': '🎯 **Рулетка говорит…**',
  'game.hangman.name': 'Виселица',
  'game.hangman.desc': 'Угадывайте слово по одной букве — 6 промахов, и всё кончено.',
  'game.hangman.intro':
    '🪢 **Виселица** — пишите по одной букве, чтобы угадать слово. Можно также написать слово целиком!',
  'game.hangman.hit': '🟢 **{user}** нашёл букву **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — буквы **{letter}** нет.',
  'game.hangman.wrongLetters': 'Ошибки: {letters}',
  'game.hangman.win': '🎉 **{user}** отгадал — **{word}**!',
  'game.hangman.lose': '💀 Попытки кончились! Слово было **{word}**.',
  'game.hangman.idle': '🕹️ Игра приостановлена (никто не играет). Слово было **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Угадайте слово из 5 букв. 🟩 верное место, 🟨 неверное место, ⬛ буквы нет в слове. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — напишите слово из 5 букв. У вас общие {max} попыток. 🟩 верное место · 🟨 неверное место · ⬛ буквы нет в слове.',
  'game.wordle.guess': '🔤 **{user}** сделал попытку — осталось попыток: **{left}**',
  'game.wordle.inWord': '🟢 в слове: {letters}',
  'game.wordle.out': '🚫 нет: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** угадал за {n} — **{word}**!',
  'game.wordle.lose': '💀 Попытки кончились! Слово было **{word}**.',
  'game.wordle.idle': '🕹️ Игра приостановлена (никто не играет). Слово было **{word}**.',
  'game.tictactoe.name': 'Крестики-нолики',
  'game.tictactoe.desc':
    'Два игрока — напишите число 1-9, чтобы поставить свой знак. Три в ряд — победа.',
  'game.tictactoe.intro':
    '⭕ **Крестики-нолики** — первые два игрока получают ❌ и ⭕ (❌ ходит первым). Напишите число 1-9, чтобы занять клетку.',
  'game.tictactoe.turn': 'Ход: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, сейчас ход **{mark}**.',
  'game.tictactoe.taken': '🚫 Клетка {cell} занята — выберите другую.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) побеждает!',
  'game.tictactoe.draw': '🤝 Ничья!',
  'game.tictactoe.idle': '🕹️ Игра завершена (никто не играет).',
  'game.chess.name': 'Шахматы',
  'game.chess.desc':
    'Два игрока — настоящие шахматные правила (шах, рокировка, превращение…). Напишите ход вроде "e4" или "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Шахматы** — первые два игрока получают белые и чёрные (белые ходят первыми). Напишите ход в алгебраической нотации ("e4", "Nf3", "O-O") или координатами ("e2e4"). Напишите "resign", чтобы сдаться.',
  'game.chess.white': 'белые',
  'game.chess.black': 'чёрные',
  'game.chess.seats': '⚪ Белые: **{white}** · ⚫ Чёрные: **{black}**',
  'game.chess.turn': '{move} — ход: **{color}**',
  'game.chess.check': '♟️ Шах!',
  'game.chess.notYourTurn': '⏳ **{user}**, сейчас ход **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" — недопустимый ход, попробуйте ещё раз.',
  'game.chess.checkmate': '🏆 Мат ({move})! **{user}** побеждает!',
  'game.chess.draw': '🤝 Ничья ({move})!',
  'game.chess.resigned': '🏳️ **{user}** сдался — **{winner}** побеждает!',
  'game.chess.idle': '🕹️ Игра завершена (никто не играет).',
  'game.wordChain.name': 'Цепочка слов',
  'game.wordChain.descr':
    'Пошаговая цепочка слов на одном языке: назовите слово, начинающееся на последнюю букву предыдущего. 2 жизни, без повторов, время ускоряется. Выберите язык в параметре `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Цепочка слов сейчас недоступна на языке **{lang}** (нет списка слов).',
  'game.wordChain.lobby':
    '🔗 **Цепочка слов** на языке **{lang}**! Напишите что-нибудь в этом канале в течение **{seconds}с**, чтобы присоединиться.',
  'game.wordChain.notEnough':
    '😴 Присоединилось недостаточно игроков (нужно минимум 2). Игра отменена.',
  'game.wordChain.begin':
    '🚀 Начинаем! Игроки: {players}. Каждое слово должно начинаться на последнюю букву предыдущего.',
  'game.wordChain.turn':
    '**{name}**, ваш ход! Слово на языке **{lang}**, начинающееся на **{letter}** — {hearts} · ⏱️ {seconds}с',
  'game.wordChain.accepted': '✅ **{word}** — следующая буква: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Должно начинаться на **{letter}**.',
  'game.wordChain.bad.short': '📏 Слишком коротко — минимум **{min}** букв.',
  'game.wordChain.bad.repeated': '🔁 Это слово уже использовали.',
  'game.wordChain.bad.word': '📖 Этого нет в словаре.',
  'game.wordChain.bad.latin': '🔤 Считаются только буквы.',
  'game.wordChain.timeout': '⏰ **{name}** не успел! Осталось: {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** выбывает!',
  'game.wordChain.winner': '🏆 **{name}** выигрывает цепочку! (слов: {chain})',
  'game.stats.none': 'Вы ещё не сыграли ни одной игры. Попробуйте `/game play`!',
  'game.stats.body': '🎮 **Ваша статистика** — **{points}** очков · **{wins}** побед · {rank}',
  'game.stats.rank': 'место **#{rank}** из {total}',
  'game.stats.unranked': 'пока без места',
  'game.pickPrompt': '🎮 В какую игру хотите сыграть? Выберите одну:',
  'game.pickPlaceholder': 'Выберите игру…',
  'game.pickTimeout': '⏰ Игра не выбрана — запустите `/game play` снова, когда будете готовы.',
  'pron.listHeader': '🗣️ **Ваши произношения** ({count}/{limit}):',
  'pron.listEmpty': 'У вас пока нет ни одного — добавьте через `/pronunciation add`.',
  'pron.set': '✅ Сохранено! Когда **вы** пишете «{term}», я говорю «{replacement}».',
  'pron.removed': '🗑️ «{term}» удалено.',
  'pron.notFound':
    'У вас нет произношения для «{term}». Посмотрите свои через `/pronunciation list`.',
  'pron.empty': 'Слово и способ его произношения не могут быть пустыми.',
  'pron.limitHit':
    '🔒 Вы достигли лимита в **{limit}** произношений. Удалите одно через `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus или Premium повышает лимит до **50** → {url}',
  'pron.modalTitle': 'Научить Vozen произношению',
  'pron.modalTerm': 'Слово (как его пишут)',
  'pron.modalSay': 'Как Vozen должен его произносить',
  'spron.listHeader': '🗣️ **Произношения сервера** ({count}/{limit}) — применяются ко всем:',
  'spron.listEmpty': 'Пока ни одного — добавьте через `/server-pronunciation add`.',
  'spron.set': '✅ Сохранено для всего сервера! «{term}» → «{replacement}».',
  'spron.removed': '🗑️ «{term}» удалено с сервера.',
  'spron.notFound': 'На сервере нет произношения для «{term}».',
  'spron.limitHit':
    '🔒 Сервер достиг лимита в **{limit}** произношений. Удалите одно через `/server-pronunciation remove`.',
  'spron.modalTitle': 'Произношение сервера',
  'spron.modalSay': 'Как Vozen произносит это для всех',
  'rand.selectPrompt': '🎲 **Рандомайзер** — из скольких вариантов мне выбирать?',
  'rand.selectPlaceholder': 'Количество вариантов…',
  'rand.selectOption': '{n} вариантов',
  'rand.filling': '📝 Заполните только что открывшуюся форму!',
  'rand.modalTitle': 'Рандомайзер — {amount} вариантов',
  'rand.modalOption': 'Вариант {n}',
  'rand.needTwo': 'Дайте мне минимум 2 варианта через запятую (например, "пицца, суши").',
  'rand.result': 'Из {count} вариантов я выбираю… **{winner}**!',
  'rand.speak': 'Я выбираю… {winner}!',
  'rand.notInVoice':
    '_(зайдите в голосовой канал вместе со мной, и в следующий раз я скажу это вслух)_',
  'rand.timeout': '⏰ Ничего не выбрано — запустите `/randomizer` снова, когда будете готовы.',
};
