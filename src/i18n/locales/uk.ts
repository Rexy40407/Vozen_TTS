export default {
  'error.generic': 'Щось пішло не так. Спробуйте ще раз.',
  'stt.guildOnly': 'Транскрипція працює лише всередині сервера.',
  'stt.noManage':
    'Щоб запустити або зупинити транскрипцію, вам потрібен дозвіл **Керування сервером**.',
  'stt.notPremium':
    '🎙️ Транскрипція наживо — це функція **Premium**. Перегляньте `/premium info`, щоб розблокувати її для цього сервера.',
  'stt.unavailable':
    'Транскрипція недоступна на цьому екземплярі (рушій розпізнавання мовлення не встановлено).',
  'stt.notInVoice':
    'Я не в голосовому каналі — спершу зайдіть до нього та виконайте `/join`, потім запустіть транскрипцію.',
  'stt.alreadyRunning':
    'Транскрипція вже працює на цьому сервері. Спершу скористайтеся `/transcribe stop`.',
  'stt.atCapacity':
    'Зараз на всіх серверах виконується забагато транскрипцій. Будь ласка, спробуйте ще раз трохи згодом.',
  'stt.noChannel':
    'Я не можу публікувати транскрипти в цьому каналі. Спробуйте виконати команду зі звичайного текстового каналу.',
  'stt.started':
    '✅ Транскрипцію запущено. Кожен, хто натисне **Погоджуюся** в оголошенні, буде транскрибований у цей канал.',
  'stt.startFailed':
    'Не вдалося запустити транскрипцію (не вийшло опублікувати оголошення). Я все скасував — нічого не записується. Будь ласка, спробуйте ще раз.',
  'stt.announceStart':
    '🎙️ **Транскрипція наживо УВІМКНЕНА в цьому каналі.** Транскрибуються лише ті, хто дав згоду — натисніть кнопку нижче, щоб дозволити записувати вашу мову тут. Ви можете відкликати згоду будь-коли за допомогою `/transcribe revoke`.',
  'stt.consentBtn': 'Погоджуюся на транскрипцію',
  'stt.consentThanks':
    '✅ Дякую — тепер ваша мова транскрибуватиметься на цьому сервері. Відкликати згоду можна будь-коли за допомогою `/transcribe revoke`.',
  'stt.stopped': '🛑 Транскрипцію зупинено.',
  'stt.notRunning': 'Транскрипція не працює на цьому сервері.',
  'stt.announceStop': '🛑 **Транскрипцію наживо тепер ВИМКНЕНО.** Я перестав слухати.',
  'stt.revoked':
    '✅ Згоду відкликано — вас більше не транскрибуватимуть на цьому сервері. (Уже опубліковані повідомлення залишаються; за бажанням видаліть їх у Discord.)',
  'stt.revokeNone':
    'Ви не давали згоди на транскрипцію на цьому сервері, тож відкликати не було чого.',
  'privacy.eraseConfirm':
    "⚠️ Це назавжди видаляє **всі** ваші дані Vozen на кожному сервері: налаштування голосу, вимовлюване ім'я, особисті скорочення та вимови, збережений день народження, ігрові бали, статистику розмов та відмову від читання. **Це не можна скасувати.** Ви впевнені?",
  'privacy.erasePremiumNote':
    "_Примітка: ваш оплачений Premium/Plus та історія його придбання зберігаються — вони належать вам і законодавчо обов'язковій фінансовій звітності. Щоб припинити Premium, дайте йому сплинути або зверніться до підтримки._",
  'privacy.eraseYes': 'Видалити все',
  'privacy.eraseNo': 'Скасувати',
  'privacy.eraseCancelled': 'Скасовано — нічого не видалено.',
  'privacy.eraseDone': '✅ Готово. Усі ваші особисті дані назавжди видалено.',
  'error.needManageGuild': 'Для цього потрібен дозвіл **Керування сервером**.',
  'join.needVoiceChannel': 'Спочатку зайдіть до голосового каналу, а потім виконайте /join.',
  'join.missingPerms': 'Мені потрібні дозволи **Підключення** та **Говорити** в каналі {channel}.',
  'join.joined':
    '✅ Я в каналі {channel}! Наступний крок: напишіть `/tts привіт`, і я озвучу це вголос. Хочете, щоб я автоматично читав канал? Виконайте /setup.',
  'join.joinedAutoread':
    '✅ Я в каналі {channel}! Усе готово. Пишіть у каналі автозачитування, і я озвучуватиму це вголос. → {readChannel}',
  'leave.left': 'Вийшов з голосового каналу. До зустрічі!',
  'skip.notInVoice':
    'Я ще не в голосовому каналі — зайдіть до нього та виконайте /join, потім спробуйте ще раз.',
  'skip.skipped': 'Пропущено.',
  'skip.nothing': 'Зараз нічого не відтворюється.',
  'shutup.notInVoice': 'Я ще не в голосовому каналі — спершу зайдіть до нього та виконайте /join.',
  'shutup.nothing': 'Зараз нічого не відтворюється.',
  'shutup.done': '🤐 Гаразд, я замовкаю — очистив усе, що було в черзі.',
  'tts.notInVoice':
    'Я ще не в голосовому каналі — зайдіть до нього та виконайте /join, потім спробуйте ще раз.',
  'tts.nothingToRead': 'Там немає що читати — надішліть мені текст для озвучення.',
  'tts.nothingAfterClean':
    'Після очищення не залишилося тексту для читання — спробуйте звичайний текст (літери або слова).',
  'tts.tooFast': 'Ого, трохи повільніше — спробуйте за мить.',
  'tts.blocked': 'Цей текст містить заблоковане слово, тому я його пропустив.',
  'tts.queued': 'Готово — воно в черзі.',
  'tts.busy': 'Я зараз зайнятий — спробуйте за мить.',
  'voice.unknownModel': 'Я не знаю такого голосу — перегляньте /voice list.',
  'voice.badSpeed':
    'Швидкість має бути від 0.5 до 2.0 (1.0 — нормальна). Спробуйте `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Ваш голос тепер **{name}** зі швидкістю {speed}×. Напишіть `/tts привіт`, щоб почути його. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Налаштування голосу** — виберіть параметри нижче й натисніть **Зберегти**. До цього нічого не зміниться.',
  'voice.config.summary': 'Поточний вибір: **{voice}** · рушій **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Мова…',
  'voice.config.pickVoice': 'Голос…',
  'voice.config.pickEngine': 'Рушій…',
  'voice.config.pickSpeed': 'Швидкість…',
  'voice.config.more': '▼ Більше мов',
  'voice.config.engDefault': 'Типово (локальний)',
  'voice.config.save': 'Зберегти',
  'voice.config.cancel': 'Скасувати',
  'voice.config.cancelled': 'Налаштування скасовано — нічого не змінилося.',
  'voice.config.expired':
    'Термін дії панелі минув — знову запустіть `/voice config`, щоб продовжити.',
  'voice.listHeader': 'Доступні голоси:',
  'voice.listEmpty': '(жодного не встановлено)',
  'voice.reset':
    '✅ Ваш голос повернуто до типового. Оберіть інший будь-коли за допомогою `/voice list` і `/voice set`.',
  'voice.detection.on':
    '✅ Автоматичне визначення мови УВІМКНЕНО: кожне повідомлення читається голосом визначеної для нього мови (мовець може змінюватися). Вимкніть за допомогою `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Автоматичне визначення мови ВИМКНЕНО: усе читає ваш єдиний фіксований голос, тож ви завжди звучите однаково.',
  'voice.optout':
    'Вас більше не будуть читати автоматично. Виконайте /voice opt-in, щоб увімкнути знову.',
  'voice.optin': 'Вас знову будуть читати автоматично.',
  'voice.nickname.set': '✅ Тепер Vozen називатиме вас **{name}** вголос.',
  'voice.nickname.cleared':
    "✅ Вимовлюване ім'я очищено — Vozen використовуватиме ваше ім'я на сервері.",
  'voice.nickname.invalid':
    'У цьому імені немає нічого, що можна прочитати вголос. Спробуйте літери або цифри.',
  'voice.effect.set':
    '✅ Голосовий ефект встановлено на **{effect}** — ваші повідомлення тепер відтворюються з цим ефектом. Скористайтеся `/voice effect none`, щоб вимкнути.',
  'voice.effect.cleared': '✅ Голосовий ефект вимкнено — знову чистий голос.',
  'voice.effect.locked':
    '🔒 **{effect}** — це ефект Premium. Безкоштовні ефекти: 🤖 Robot і 🔊 Echo. Розблокуйте всі з Vozen Premium — перегляньте `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** — це голосовий рушій Premium. Розблокуйте його з Vozen Plus (особистий) або Vozen Premium (сервер) — перегляньте `/premium`. Тим часом ваш голос лишається на безкоштовному локальному рушії.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** — це голосовий рушій Premium. Розблокуйте його з Vozen Plus (особистий) або Vozen Premium (сервер) — перегляньте `/premium`. Тим часом ваш голос лишається на безкоштовному локальному рушії.',
  'voice.notInVoice': 'Я ще не в голосовому каналі — спочатку виконайте /join.',
  'voice.previewPlaying': 'Відтворюю зразок…',
  'preview.sample': 'Привіт, я Vozen. напишіть це, почуйте це.',
  'laugh.playing': 'Ха-ха! Відтворюю це вашим голосом…',
  'joke.playing': 'Розповідаю жарт…\n> {joke}',
  'joke.unknownLang': 'Я не знаю такої мови. Оберіть одну зі списку.',
  'rizz.playing': '😏 Закидаю трохи чарів…\n> {line}',
  'rizz.unknownLang': 'Я не знаю такої мови. Оберіть одну зі списку.',
  'rizz.locked':
    '🔒 **/rizz** — це перк Premium. Розблокуйте його з Vozen Plus (для вас) або Premium (для цього сервера). Перегляньте `/premium`.',
  'sound.playing': '🔊 Відтворюю **{name}**…',
  'sound.unknown': 'У мене немає такого звуку. Виконайте `/sound`, щоб побачити список.',
  'sound.list':
    '🔊 **Звуки:** {sounds}\nВідтворіть один за допомогою `/sound name:<sound>` (я маю бути у вашому голосовому каналі).',
  'sound.disabled':
    '🔇 Саундборд **вимкнено** на цьому сервері. Адміністратор може ввімкнути його за допомогою `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 День народження збережено: **{day}/{month}**. Я привітаю вас із днем народження, коли ви зайдете до голосового каналу того дня!',
  'birthday.invalid': 'Це не справжня дата. Перевірте день і місяць.',
  'birthday.cleared': '🎂 День народження видалено.',
  'birthday.show': '🎂 Ваш день народження встановлено на **{day}/{month}**.',
  'birthday.none': 'Ви ще не вказали день народження. Скористайтеся `/birthday set`.',
  'topspeakers.title': '🗣️ **Найактивніші мовці** — кого я найбільше читав на цьому сервері:',
  'topspeakers.empty':
    'Я ще не читав нічиїх повідомлень. Налаштуйте канал для читання за допомогою `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** повідомлень · 🔥 серія {streak} дн.',
  'serverstats.title': '📊 **Статистика сервера**',
  'serverstats.empty':
    'Поки що немає статистики — я не читав тут повідомлень і не проводив ігор. Налаштуйте за допомогою `/setup`!',
  'serverstats.messages': '🗣️ Прочитано повідомлень: **{total}** · осіб: **{speakers}**',
  'serverstats.topTalkers': '**Найбалакучіші:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} повід. · 🔥 {streak}д',
  'serverstats.streak': '🔥 Найдовша активна серія: **{days}** дн.',
  'serverstats.games':
    '🎮 Ігрових балів: **{points}** · перемог: **{wins}** · гравців: **{players}**',
  'serverstats.topPlayers': '**Найкращі гравці:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} б. · {wins} перемог',
  'serverstats.upsell':
    '🔒 Це безкоштовний попередній перегляд. **Premium** розблоковує серії, ігрову статистику та повний топ-5 — перегляньте `/premium`.',
  'streak.day': '🔥 <@{user}> тримає серію **{n} дн.**! Продовжуйте говорити, щоб її не перервати.',
  'leaderboard.autoTitle': '🏆 Найбалакучіші на цьому сервері',
  'premium.title': '💎 **Статус Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Сервер:** Premium до {date}',
  'premium.lineServerFree': '🖥️ **Сервер:** безкоштовний план',
  'premium.lineUserActive': '👤 **Ви (Plus):** активний до {date}',
  'premium.lineUserFree': '👤 **Ви (Plus):** неактивний',
  'premium.getHint':
    'Усе, чим ви користуєтеся сьогодні, лишається безкоштовним. Premium додає всі 8 голосових ефектів, режим 24/7 у дзвінку, 50 особистих вимов, /rizz та преміум-ігри. Підтримка: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Ваш пропуск Premium:** використано {used}/{total} ліцензій · спливає {date}',
  'premium.passServers': '↳ Використовується на: {servers}',
  'premium.pitch':
    'У вас ще немає Premium. **Vozen Premium** (€3.99/міс за 3 сервери або €7.99/міс за 8) розблоковує для всього сервера: усі 8 голосових ефектів, режим 24/7 у дзвінку, 50 особистих вимов (замість 3), команду /rizz та преміум-ігри (Ланцюжок слів, Wordle, Шахи). **Vozen Plus** (€1.99/міс) дає вам ці переваги особисто, на будь-якому сервері.',
  'premium.buyHint':
    '▶ **Отримати Premium:** {link}\nПісля придбання виконайте `/premium activate` на потрібному сервері.',
  'premium.confirmActivate':
    'Використати **1 з ваших {total} ліцензій Premium** на **цьому сервері**? Зараз у вас використано **{used}**. Ви можете звільнити її пізніше за допомогою `/premium deactivate` — час на пропуску в будь-якому разі спливає далі.',
  'premium.confirmYes': '💎 Використати ліцензію',
  'premium.confirmNo': 'Скасувати',
  'premium.activateOk':
    '✅ Premium тепер активний на **цьому сервері** до {date}. Ліцензій використано: **{used}/{total}**.',
  'premium.activateCancelled': 'Скасовано — жодної ліцензії не використано.',
  'premium.activateTimeout': 'Час вичерпано — жодної ліцензії не використано.',
  'premium.noPass':
    "У вас немає активного пропуску Premium. Придбайте його — і він з'явиться на вашому акаунті, після чого виконайте `/premium activate` тут.\n▶ {link}",
  'premium.alreadyActive':
    'Цей сервер уже має одну з ваших ліцензій Premium. Нічого робити не потрібно.',
  'premium.noSeats':
    'Усі ваші **{total}** ліцензій Premium використано ({servers}). Звільніть одну за допомогою `/premium deactivate` там і спробуйте ще раз тут.',
  'premium.needManageGuild':
    'Активація Premium стосується всього сервера — це можуть зробити лише учасники з дозволом **Керування сервером**. Зверніться до адміністратора.',
  'premium.deactivateOk':
    '✅ Ліцензію Premium цього сервера звільнено. Використайте її на іншому сервері за допомогою `/premium activate`.',
  'premium.deactivateNone': 'На цьому сервері немає вашої ліцензії Premium, яку можна звільнити.',
  'premium.thisServer': 'цей сервер',
  'grant.denied': '⛔ Ця команда лише для власника бота.',
  'grant.okPremium':
    '✅ Надано <@{user}> **пропуск Premium** ({seats} ліцензій) на **{days}** дн. — спливає {date}. Активується за допомогою `/premium activate`.',
  'grant.okPlus': '✅ Надано <@{user}> **Vozen Plus** на **{days}** дн. — спливає {date}.',
  'gencode.done':
    '✅ Згенеровано **{count}** код(ів) {plan}, по **{days}** дн. кожен. Поділіться ними приватно:\n{list}',
  'redeem.okPlus': '🎁 Активовано! Ви отримали **Vozen Plus** на **{days}** дн. — спливає {date}.',
  'redeem.okPremium':
    '🎁 Активовано! Ви отримали **пропуск Premium** ({seats} ліцензій) на **{days}** дн. — спливає {date}. Активуйте його на своєму сервері за допомогою `/premium activate`.',
  'redeem.notFound': '❌ Такого коду не існує. Перевірте його ще раз і спробуйте знову.',
  'redeem.used': '❌ Цей код уже було активовано.',
  'redeem.expired': '❌ Термін дії цього коду сплив.',
  'voice.abbrev.added': 'Готово — {term} читатиметься як {replacement}.',
  'voice.abbrev.removed': 'Видалено ваше скорочення для {term}.',
  'voice.abbrev.listHeader': 'Ваші особисті скорочення (використано {count}/{cap}):',
  'voice.abbrev.listEmpty': '(поки що жодного — додайте за допомогою /voice abbrev add)',
  'voice.abbrev.capReached':
    'Ви досягли ліміту в {cap} особистих скорочень. Видаліть одне, перш ніж додавати інше.',
  'voice.abbrev.invalidTerm':
    'Термін має бути одним словом (лише літери та цифри), до 50 символів.',
  'voice.abbrev.emptyReplacement': 'Читання не може бути порожнім.',
  'voice.abbrev.tooLong': 'Читання задовге (максимум 200 символів).',
  'config.wordEmpty': 'Слово не може бути порожнім.',
  'config.blocked': 'Заблоковано: {word}.',
  'config.blockLimit':
    'Цей сервер уже має максимум {max} заблокованих слів. Видаліть одне, перш ніж додавати інше.',
  'config.unblocked': 'Розблоковано: {word}.',
  'config.pronListHeader': 'Словник вимови:',
  'config.pronEmptyValue': '(порожньо)',
  'config.listEmpty': '(жодного)',
  'config.termEmpty': 'Термін не може бути порожнім.',
  'config.pronEmpty': 'Вимова не може бути порожньою.',
  'config.pronSet': 'Готово — {term} читатиметься як {replacement}.',
  'config.pronRemoved': 'Видалено вимову для {term}.',
  'config.channelWrongType': 'Оберіть текстовий канал (не голосовий канал і не категорію).',
  'config.channelNoAccess': 'Я не бачу {channel} — перевірте мої дозволи там.',
  'config.channelSet':
    'Канал автозачитування встановлено на {channel}. Далі: переконайтеся, що автозачитування ввімкнено за допомогою `/config auto-read active:true`.',
  'config.autoreadOn': 'Автозачитування тепер **увімкнено**.',
  'config.autoreadOff': 'Автозачитування тепер **вимкнено**.',
  'config.maxCharsRange': 'Значення макс. символів має бути від 1 до 2000.',
  'config.maxCharsSet': 'Максимум символів на повідомлення встановлено на {value}.',
  'config.rateLimitRange': 'Значення ліміту частоти має бути від 1 до 120.',
  'config.rateLimitSet': 'Ліміт частоти встановлено на {value} повідомлень за хвилину.',
  'config.roleSet': 'Автозачитування тепер обмежено учасниками з роллю {role}.',
  'config.roleCleared': 'Обмеження за роллю знято — тепер можна читати всіх.',
  'config.enabledOn': 'TTS тепер **увімкнено** для цього сервера.',
  'config.enabledOff': 'TTS тепер **вимкнено** для цього сервера.',
  'config.xsaidOn':
    'Тепер Vozen оголошуватиме, **хто говорив**, перед кожним повідомленням (напр. «Alex сказав привіт»). Вимкніть за допомогою `/config x-said active:false`.',
  'config.xsaidOff':
    'Vozen **більше не** оголошуватиме, хто говорив — він читає лише повідомлення.',
  'config.autojoinOn':
    '✅ Автоприєднання **увімкнено** — Vozen приєднається до вашого голосового каналу, коли ви пишете в каналі TTS.',
  'config.autojoinOff':
    'Автоприєднання **вимкнено** — використовуйте `/join`, щоб привести Vozen у голосовий канал.',
  'config.stayOn':
    '✅ Режим 24/7 у дзвінку **увімкнено** — Vozen залишатиметься в голосовому каналі, навіть коли той порожніє, і повертатиметься після перезапусків. 💎 Щоб це запрацювало, потрібен Premium (купіть або активуйте код через `/redeem`, потім `/premium activate`).',
  'config.stayOff':
    'Режим 24/7 у дзвінку **вимкнено** — Vozen виходить, коли голосовий канал порожніє (типово).',
  'config.readBotsOn': '✅ Тепер Vozen читатиме й повідомлення від **інших ботів і вебхуків**.',
  'config.readBotsOff':
    'Vozen **ігноруватиме** інших ботів і вебхуки (читаються лише справжні люди).',
  'config.textInVoiceOn':
    '✅ Vozen також читатиме **текстовий чат усередині свого голосового каналу**.',
  'config.textInVoiceOff':
    'Vozen **не** читатиме текстовий чат голосового каналу (лише канал TTS).',
  'config.antispamOn':
    '✅ Антиспам **увімкнено** — Vozen не читатиме спам-повідомлення (масове повторення слів або те саме велике повідомлення, надіслане знову і знову).',
  'config.antispamOff': 'Антиспам **вимкнено** — Vozen читає кожне повідомлення як зазвичай.',
  'config.streaksOn':
    '✅ Сповіщення про серії **увімкнено** — Vozen показує повідомлення про денну серію 🔥 щоразу, коли кожна людина вперше говорить за день.',
  'config.streaksOff':
    'Сповіщення про серії **вимкнено** — Vozen усе одно рахує серії (див. `/top-speakers`), але не оголошує їх.',
  'config.soundboardOn':
    'Саундборд **увімкнено** — будь-хто може відтворювати кліпи за допомогою `/sound`.',
  'config.soundboardOff': 'Саундборд **вимкнено** — `/sound` вимкнено на цьому сервері.',
  'config.votePromosLabel': 'Сповіщення про нагороду top.gg + Vozen Support',
  'config.greetOn': "✅ Я вітатиму людей на ім'я, коли вони заходять до голосового каналу.",
  'config.greetOff': '🔇 Я **не** вітатиму людей, коли вони заходять до голосового каналу.',
  'config.greetLangSet': '✅ Мову вітання при вході встановлено на **{language}**.',
  'config.defaultVoiceSet':
    '✅ Типовий голос сервера встановлено на **{name}**. Учасники без власного голосу чутимуть цей. (id: `{model}`)',
  'config.reset': 'Налаштування скинуто до типових. Ваш список блокувань і вимови збережено.',
  'config.showTitle': '**Налаштування сервера**',
  'config.showChannel': 'Канал TTS: {value}',
  'config.showAutoread': 'Автозачитування: {value}',
  'config.showRole': 'Роль: {value}',
  'config.showEnabled': 'Увімкнено: {value}',
  'config.showXsaid': 'Оголошувати мовця (xsaid): {value}',
  'config.showAutojoin': 'Автоприєднання: {value}',
  'config.showReadBots': 'Читати ботів/вебхуки: {value}',
  'config.showTextInVoice': 'Текст-у-голосі: {value}',
  'config.showAntispam': 'Антиспам: {value}',
  'config.showSoundboard': 'Саундборд (/sound): {value}',
  'config.showGreet': 'Вітання при вході: {value} ({language})',
  'config.showVoice': 'Типовий голос: {value}',
  'config.showMaxChars': 'Максимум символів: {value}',
  'config.showRateLimit': 'Ліміт частоти: {value}/хв',
  'config.showBlocklist': 'Список блокувань: {count} слів',
  'config.showPronunciation': 'Вимови: {count} записів',
  'config.valueNone': '(жодного)',
  'config.valueAny': 'будь-хто',
  'config.valueAutoDetect': '(автовизначення)',
  'config.on': 'увімкнено',
  'config.off': 'вимкнено',
  'config.language.set': 'Мову інтерфейсу встановлено на {language}.',
  'config.language.unsupported': 'Ця мова поки що не підтримується.',
  'setup.noChannel':
    'Я не зміг визначити, який канал використовувати. Вкажіть текстовий канал у параметрі "channel".',
  'setup.channelWrongType':
    'Канал автозачитування має бути текстовим каналом (не голосовим каналом і не категорією). Вкажіть його в параметрі "channel".',
  'setup.done': '**Усе готово — Vozen готовий до роботи.**',
  'setup.channelLine': 'Канал автозачитування: {channel}',
  'setup.autoreadOn': 'Автозачитування: увімкнено',
  'setup.permsHeader': '**Дозволи:**',
  'setup.permView': 'ViewChannel (бачити текстовий канал)',
  'setup.permSend': 'SendMessages (писати в текстовий канал)',
  'setup.permConnect': 'Connect (підключатися до голосового каналу)',
  'setup.permSpeak': 'Speak (говорити в голосовому каналі)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — відсутній',
  'setup.permUnchecked': '⏳ {label} — ще не перевірено (я перевірю це під час /join)',
  'setup.fixHint':
    'Щоб виправити те, чого бракує: у налаштуваннях сервера відкрийте роль Vozen (або дозволи каналу) та увімкніть пункти, позначені ❌.',
  'setup.voiceUncheckedNote':
    'Ви не в голосовому каналі, тож я ще не зміг перевірити Connect/Speak — я зроблю це, коли ви виконаєте /join.',
  'setup.allGood': 'Усе готово. Зайдіть до голосового каналу та виконайте /join.',
  'setup.joinedVoice': 'Я теж приєднався до {channel} — виконувати /join не потрібно.',
  'setup.readyTalk': 'Усе готово. Пишіть у каналі автозачитування, і я озвучуватиму це вголос.',
  'setup.membersHeader': '**Розкажіть своїм учасникам (процес із 3 кроків):**',
  'setup.membersBody':
    '1) Зайдіть до голосового каналу\n2) Виконайте /join, щоб я приєднався до вас\n3) Пишіть у цьому каналі (або скористайтеся /tts), і я озвучу це вголос\nПовний список команд: /help',
  'stats.title': '**Статистика Vozen**',
  'stats.messagesSpoken': 'Озвучено повідомлень: {value}',
  'stats.cacheHits': 'Влучань кешу: {value}',
  'stats.cacheMisses': 'Промахів кешу: {value}',
  'stats.synthErrors': 'Помилок синтезу: {value}',
  'stats.synthLatency': 'Затримка синтезу: p50 {p50}мс / p95 {p95}мс ({count} зразків)',
  'stats.voiceDrops': 'Розривів голосу: {value}',
  'stats.voiceReconnects': 'Перепідключень: {value}',
  'stats.votes': 'Голосів на top.gg: {value}',
  'stats.activePlayers': 'Активних плеєрів: {value}',
  'stats.servers': 'Серверів: {value}',
  'stats.uptime': 'Час роботи: {value}с',
  'speak.emptyMessage': 'У цьому повідомленні немає тексту для читання вголос.',
  'uptime.text': '🟢 Vozen онлайн уже **{uptime}**.',
  'botstats.title': '📊 **Vozen — статистика**',
  'botstats.servers': 'Серверів: **{value}**',
  'botstats.voiceSessions': 'Голосових сесій зараз: **{value}**',
  'botstats.messagesSpoken': 'Озвучено повідомлень: **{value}**',
  'botstats.uptime': 'Онлайн: **{value}**',
  'invite.noClientId':
    'Посилання для запрошення Vozen ще не налаштоване (відсутній CLIENT_ID). Повідомте про це адміністратора бота.',
  'invite.link': 'Додайте Vozen на свій сервер:\n{url}',
  'vote.noClientId':
    'Посилання для голосування за Vozen ще не налаштоване (відсутній CLIENT_ID). Повідомте про це адміністратора бота.',
  'vote.link':
    'Проголосуйте за Vozen (безкоштовно, кожні 12 год) і допоможіть більшій кількості людей знайти його:\n{url}\nЯкщо цей обліковий запис ще не отримував нагороду, він отримає **48 годин Vozen Plus**, лише один раз на обліковий запис.',
  'invite.button': 'Додати Vozen',
  'vote.button': 'Проголосувати на top.gg',
  'vote.upsell':
    '🗳️ Якщо цей обліковий запис ще не отримував нагороду, він отримає **48 годин Vozen Plus**, лише один раз на обліковий запис. {url}',
  'vote.cooldownStatus':
    '🗳️ Цей обліковий запис уже використав одноразову нагороду за голос. Ви все ще можете голосувати на підтримку Vozen, але додатковий Plus не нараховується.',
  'help.title': 'Vozen — напишіть це, почуйте це.',
  'help.embedTitle': 'Vozen — Команди',
  'help.intro':
    'Vozen зачитує ваш текст вголос у голосових каналах — безкоштовні нейронні голоси, десятки мов.',
  'help.quickStartTitle': 'Швидкий старт (3 кроки)',
  'help.quickStartBody':
    "1) Зайдіть до голосового каналу, потім виконайте /join\n2) Пишіть у текстовому каналі (або скористайтеся /tts Всім привіт!)\n3) (необов'язково) Оберіть голос за допомогою /voice set",
  'help.groupStarted': 'Початок роботи',
  'help.groupStartedBody':
    '• /join — я приєднуюся до вашого голосового каналу\n• /leave — я виходжу з голосового каналу\n• /tts <текст> — я зачитую текст вголос · напр. /tts Всім привіт!\n• /skip — пропустити те, що я зараз зачитую',
  'help.groupVoice': 'Ваш голос',
  'help.groupVoiceBody':
    '• /voice set <model> — оберіть свій голос · напр. /voice set en_US-amy-medium\n• /voice list — перегляньте доступні голоси\n• /voice preview — послухайте зразок свого голосу\n• /voice reset — повернутися до типового голосу\n• /voice opt-out · /voice opt-in — вимкнути / увімкнути автозачитування для вас\n• /voice abbrev add|remove|list — особистий сленг, читається по-вашому (до 10)',
  'help.groupFun': 'Розваги',
  'help.groupFunBody':
    "• /joke — я розповідаю короткий жарт (оберіть мову + необов'язковий сміх) · напр. /joke English\n• /laugh — я сміюся вголос вашим поточним голосом",
  'help.groupAdmin': 'Адмін сервера (потрібне Керування сервером)',
  'help.groupAdminBody':
    '• /setup — покрокове налаштування в один крок · виконайте це першим\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · напр. /config tts-channel #general\n• /stats — статистика бота',
  'help.groupMore': 'Більше',
  'help.groupMoreBody':
    '• /invite — додати Vozen на інший сервер\n• /vote — проголосувати за Vozen на top.gg\n• /help — показати цю довідку',
  'help.footer': 'Уперше тут? Виконайте {command}, щоб почати.',
  'help.support': '🛟 Потрібна допомога чи хочете повідомити про проблему? {url}',
  'help.source': '📄 Відкритий код (AGPL-3.0) — отримайте точний код, що працює тут: {url}',
  'welcome.title': 'Дякуємо, що додали Vozen! 👋',
  'welcome.description':
    'Vozen зачитує ваш чат вголос у голосових каналах — напишіть це, почуйте це.\n\n**Почніть в один крок:** виконайте {setup}, і я налаштую автозачитування та приєднаюся до вашого голосового каналу.\n\nПотрібен повний список команд? Виконайте {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Як учасники цим користуються (3 кроки)',
  'welcome.stepsBody':
    '1) Зайдіть до голосового каналу\n2) Виконайте /join, щоб я приєднався до вас\n3) Пишіть у текстовому каналі (або скористайтеся /tts), і я озвучу це вголос\nПовний список команд: /help',
  'welcome.footer': 'Vozen — напишіть це, почуйте це.',
  'welcome.tagline': 'Природний нейронний голос — безкоштовно назавжди, без платного доступу.',
  'game.start.needVoice':
    'Це **голосова гра** — спершу зайдіть до голосового каналу та виконайте /join, потім починайте.',
  'game.start.alreadyActive':
    'Гра вже триває в <#{channel}>. Завершіть її (або скористайтеся `/game stop`), перш ніж починати іншу.',
  'game.start.premiumLocked':
    '🔒 **{game}** — це гра Premium (вона потребує реальних обчислень). Перегляньте `/premium`.',
  'game.start.started': '🎮 Починаємо **{game}**! Стежте за каналом — щасти!',
  'game.start.startedThread':
    '🎮 **{game}** розпочато в <#{channel}> — приєднуйтесь там! Гілка видаляється сама, коли гра завершується.',
  'game.thread.winner': '🏆 {winner} виграв гру!',
  'game.thread.ended': '🎮 Гра завершилася.',
  'game.unknownGame': 'Я не знаю такої гри. Оберіть одну зі списку.',
  'game.stop.ok': '🛑 Поточну гру зупинено.',
  'game.stop.none': 'Зараз немає жодної гри, що триває.',
  'game.list.title': '🎮 **Ігри** — почніть одну за допомогою `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Таблиця лідерів** — найкращі гравці на цьому сервері:',
  'game.leaderboard.empty': 'Ще ніхто не грав. Будьте першим — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** б. ({wins} перемог)',
  'game.finish.title': '🏁 **Гру завершено!** Фінальні результати:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Гру завершено — цього разу ніхто не набрав балів. Наступного разу!',
  'game.finish.winnerVoice': '{user} перемагає!',
  'game.guessLanguage.name': 'Вгадай мову',
  'game.guessLanguage.desc':
    'Я читаю речення випадковою мовою — перший, хто її назве, отримує бал.',
  'game.guessLanguage.intro':
    '🗣️ **Вгадай мову** — я прочитаю {rounds} речень. Напишіть, яку мову ви чуєте. Найшвидша правильна відповідь виграє кожен раунд!',
  'game.guessLanguage.round': '🎧 Раунд {n}/{total} — слухайте…',
  'game.guessLanguage.correct': '✅ **{user}** вгадав — це була **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Час! Це була **{language}**.',
  'game.guessLanguage.noLanguages':
    'У мене недостатньо встановлених голосів, щоб зіграти в це. Попросіть адміністратора додати більше голосів.',
  'game.math.name': 'Усний рахунок',
  'game.math.desc': 'Я кажу приклад уголос — перший, хто напише відповідь, виграє.',
  'game.math.intro':
    '🔢 **Усний рахунок** — {rounds} прикладів. Слухайте й пишіть відповідь якнайшвидше!',
  'game.math.round': '🧮 Раунд {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** упорався — відповідь була **{answer}**!',
  'game.math.timeout': '⏱️ Час! Відповідь була **{answer}**.',
  'game.math.plus': 'плюс',
  'game.math.minus': 'мінус',
  'game.math.times': 'помножити на',
  'game.skipCount.name': 'Пропущене число',
  'game.skipCount.desc':
    'Я рахую вголос, але пропускаю одне число — перший, хто його впіймає, виграє.',
  'game.skipCount.intro':
    '🔢 **Пропущене число** — я рахую, але одне число пропускаю. Напишіть, якого числа бракує! ({rounds} раундів)',
  'game.skipCount.round': '👂 Раунд {n}/{total} — яке число я пропустив?',
  'game.skipCount.correct': '✅ **{user}** упіймав — я пропустив **{answer}**!',
  'game.skipCount.timeout': '⏱️ Час! Я пропустив **{answer}**.',
  'game.spelling.name': 'Диктант',
  'game.spelling.desc': 'Я кажу слово — перший, хто правильно його напише, виграє.',
  'game.spelling.intro': '✍️ **Диктант** — я скажу {rounds} слів. Напишіть кожне без помилок!',
  'game.spelling.round': '🗣️ Раунд {n}/{total} — напишіть слово, яке я скажу…',
  'game.spelling.correct': '✅ **{user}** правильно написав **{word}**!',
  'game.spelling.timeout': '⏱️ Час! Слово було **{word}**.',
  'game.spelling.empty': 'У мене ще немає списку слів для мови голосу цього сервера.',
  'game.spellOut.name': 'Склади слово за літерами',
  'game.spellOut.desc': 'Я вимовляю слово по літерах — перший, хто напише слово цілком, виграє.',
  'game.spellOut.intro':
    '🔡 **Склади слово за літерами** — я вимовлю {rounds} слів літера за літерою. Напишіть повне слово!',
  'game.spellOut.round': '🔤 Раунд {n}/{total} — слухайте літери…',
  'game.spellOut.correct': '✅ **{user}** вгадав — **{word}**!',
  'game.spellOut.timeout': '⏱️ Час! Складалося слово **{word}**.',
  'game.fastSpeech.name': 'Швидка мова',
  'game.fastSpeech.desc': 'Я читаю речення дуже швидко — перший, хто напише, що я сказав, виграє.',
  'game.fastSpeech.intro':
    '💨 **Швидка мова** — {rounds} речень на шаленій швидкості. Напишіть, що ви почули!',
  'game.fastSpeech.round': '⚡ Раунд {n}/{total} — ось воно, швидко!',
  'game.fastSpeech.correct': '✅ **{user}** розшифрував: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Час! Це було: “{phrase}”',
  'game.fastSpeech.empty': 'У мене ще немає фраз для мови голосу цього сервера.',
  'game.accentSwap.name': 'Кумедний акцент',
  'game.accentSwap.desc': 'Я кажу слово з іноземним акцентом — перший, хто його напише, виграє.',
  'game.accentSwap.intro':
    '🎭 **Кумедний акцент** — {rounds} слів, сказаних із неправильним акцентом. Напишіть слово!',
  'game.accentSwap.round': '🌍 Раунд {n}/{total} — яке слово я намагаюся сказати?',
  'game.accentSwap.correct': '✅ **{user}** вгадав — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Час! Слово було **{word}**.',
  'game.reflexes.name': 'Рефлекси',
  'game.reflexes.desc':
    'Я веду відлік, а потім кричу ВПЕРЕД — перший, хто напише після цього, виграє. Не поспішайте!',
  'game.reflexes.intro':
    '⚡ **Рефлекси** — {rounds} раундів. Коли я крикну **ВПЕРЕД**, пишіть будь-що якнайшвидше. Напишете до ВПЕРЕД — це фальстарт!',
  'game.reflexes.ready': '🚦 Раунд {n}/{total} — приготуйтеся…',
  'game.reflexes.countdown': 'три… два… один…',
  'game.reflexes.go': '🟢 **ВПЕРЕД!!!**',
  'game.reflexes.goVoice': 'Вперед!',
  'game.reflexes.tooSoon': '🔴 **{user}** поспішив — надто рано!',
  'game.reflexes.win': '⚡ **{user}** найшвидший! Бал!',
  'game.reflexes.tooSlow': '😴 Ніхто не встиг зреагувати. Далі!',
  'game.headsOrTails.name': 'Орел чи решка',
  'game.headsOrTails.desc':
    'Вгадайте підкидання монети — напишіть орел або решка, перш ніж я підкину. Найкращий вгадувач виграє!',
  'game.headsOrTails.intro':
    '🪙 **Орел чи решка** — {rounds} раундів. Щораунду пишіть `heads` (орел) або `tails` (решка), перш ніж я підкину монету. 1 бал за кожне вгадування!',
  'game.headsOrTails.introVoice': 'Зіграймо в орла чи решку!',
  'game.headsOrTails.round': '🪙 Раунд {n}/{total} — орел чи решка? Пишіть свій варіант!',
  'game.headsOrTails.roundVoice': 'Орел… чи решка?',
  'game.headsOrTails.heads': 'орел',
  'game.headsOrTails.tails': 'решка',
  'game.headsOrTails.resultVoice': 'Випало {side}!',
  'game.headsOrTails.winners': 'Випало **{side}**! Бал для: {users}',
  'game.headsOrTails.noWinners': 'Випало **{side}**! Ніхто не вгадав — без балів.',
  'game.vozenSays.name': 'Vozen каже',
  'game.vozenSays.desc':
    'Виконуйте наказ, лише коли він починається зі слів «Vozen каже». Потрапите в пастку — програли!',
  'game.vozenSays.intro':
    '🫡 **Vozen каже** — {rounds} наказів. Виконуйте, ЛИШЕ якщо я починаю з **«Vozen каже»**. Інакше — не рухайтеся!',
  'game.vozenSays.prefix': 'Vozen каже',
  'game.vozenSays.verb': 'напишіть',
  'game.vozenSays.real': '🗣️ Раунд {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Раунд {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** виконав першим — бал!',
  'game.vozenSays.caught': '🔴 **{user}** — я не казав «Vozen каже»! Спіймано!',
  'game.vozenSays.nobody': '😴 Ніхто не виконав **{word}** вчасно. Далі!',
  'game.vozenSays.trapCleared': '😌 Це була пастка — молодці, ніхто не попався на **{word}**.',
  'game.roulette.name': 'Рулетка: Правда чи Дія',
  'game.roulette.desc':
    'Я кручу рулетку й читаю один виклик (правда чи дія) вголос. Запустіть знову для іншого.',
  'game.roulette.header': '🎯 **Рулетка каже…**',
  'game.hangman.name': 'Шибениця',
  'game.hangman.desc': 'Вгадуйте слово по одній літері — 6 промахів, і гру завершено.',
  'game.hangman.intro':
    '🪢 **Шибениця** — пишіть по одній літері, щоб вгадати слово. Можна також написати ціле слово!',
  'game.hangman.hit': '🟢 **{user}** знайшов літеру **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — літери **{letter}** немає.',
  'game.hangman.wrongLetters': 'Помилки: {letters}',
  'game.hangman.win': '🎉 **{user}** відгадав — **{word}**!',
  'game.hangman.lose': '💀 Спроби вичерпано! Слово було **{word}**.',
  'game.hangman.idle': '🕹️ Гру призупинено (ніхто не грає). Слово було **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Вгадайте слово з 5 літер. 🟩 правильне місце, 🟨 неправильне місце, ⬛ немає в слові. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — напишіть слово з 5 літер. Ви ділите {max} спроб. 🟩 правильне місце · 🟨 неправильне місце · ⬛ немає в слові.',
  'game.wordle.guess': '🔤 **{user}** зробив спробу — лишилося **{left}** спроб',
  'game.wordle.inWord': '🟢 у слові: {letters}',
  'game.wordle.out': '🚫 немає: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** вгадав за {n} — **{word}**!',
  'game.wordle.lose': '💀 Спроби вичерпано! Слово було **{word}**.',
  'game.wordle.idle': '🕹️ Гру призупинено (ніхто не грає). Слово було **{word}**.',
  'game.tictactoe.name': 'Хрестики-нулики',
  'game.tictactoe.desc':
    'Двоє гравців — напишіть число 1-9, щоб поставити свою позначку. Три в ряд виграє.',
  'game.tictactoe.intro':
    '⭕ **Хрестики-нулики** — перші двоє гравців, які ходять, це ❌ і ⭕ (❌ починає). Напишіть число 1-9, щоб зайняти клітинку.',
  'game.tictactoe.turn': 'Хід: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, зараз хід **{mark}**.',
  'game.tictactoe.taken': '🚫 Клітинку {cell} вже зайнято — оберіть іншу.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) виграв!',
  'game.tictactoe.draw': '🤝 Нічия!',
  'game.tictactoe.idle': '🕹️ Гру завершено (ніхто не грає).',
  'game.chess.name': 'Шахи',
  'game.chess.desc':
    'Двоє гравців — справжні шахові правила (шах, рокіровка, перетворення…). Напишіть хід на кшталт "e4" або "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Шахи** — перші двоє гравців, які ходять, грають білими та чорними (білі починають). Напишіть хід у шаховій нотації ("e4", "Nf3", "O-O") або координатами ("e2e4"). Напишіть "resign", щоб здатися.',
  'game.chess.white': 'білі',
  'game.chess.black': 'чорні',
  'game.chess.seats': '⚪ Білі: **{white}** · ⚫ Чорні: **{black}**',
  'game.chess.turn': '{move} — хід: **{color}**',
  'game.chess.check': '♟️ Шах!',
  'game.chess.notYourTurn': '⏳ **{user}**, зараз хід **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" — недопустимий хід, спробуйте ще раз.',
  'game.chess.checkmate': '🏆 Мат ({move})! **{user}** виграв!',
  'game.chess.draw': '🤝 Нічия ({move})!',
  'game.chess.resigned': '🏳️ **{user}** здався — **{winner}** виграв!',
  'game.chess.idle': '🕹️ Гру завершено (ніхто не грає).',
  'game.wordChain.name': 'Ланцюжок слів',
  'game.wordChain.descr':
    'Покроковий ланцюжок слів однією мовою: назвіть слово, що починається останньою літерою попереднього. 2 життя, без повторів, а годинник пришвидшується. Оберіть мову опцією `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Ланцюжок слів зараз недоступний мовою **{lang}** (бракує списку слів).',
  'game.wordChain.lobby':
    '🔗 **Ланцюжок слів** мовою **{lang}**! Напишіть будь-що в цьому каналі протягом **{seconds}с**, щоб приєднатися.',
  'game.wordChain.notEnough':
    '😴 Приєдналося недостатньо гравців (потрібно щонайменше 2). Гру скасовано.',
  'game.wordChain.begin':
    '🚀 Починаємо! Гравці: {players}. Кожне слово має починатися останньою літерою попереднього.',
  'game.wordChain.turn':
    '**{name}**, ваш хід! Слово мовою **{lang}**, що починається на **{letter}** — {hearts} · ⏱️ {seconds}с',
  'game.wordChain.accepted': '✅ **{word}** — наступна літера: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Має починатися на **{letter}**.',
  'game.wordChain.bad.short': '📏 Надто коротке — щонайменше **{min}** літер.',
  'game.wordChain.bad.repeated': '🔁 Це слово вже використовували.',
  'game.wordChain.bad.word': '📖 Цього немає в словнику.',
  'game.wordChain.bad.latin': '🔤 Рахуються лише літери A–Z.',
  'game.wordChain.timeout': '⏰ У **{name}** вичерпався час! Лишилося {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** вибуває!',
  'game.wordChain.winner': '🏆 **{name}** перемагає в ланцюжку! ({chain} слів)',
  'game.stats.none': 'Ви ще не зіграли жодної гри. Спробуйте `/game play`!',
  'game.stats.body': '🎮 **Ваша статистика** — **{points}** балів · **{wins}** перемог · {rank}',
  'game.stats.rank': 'місце **#{rank}** з {total}',
  'game.stats.unranked': 'ще без місця',
  'game.pickPrompt': '🎮 У яку гру хочете зіграти? Оберіть одну:',
  'game.pickPlaceholder': 'Оберіть гру…',
  'game.pickTimeout': '⏰ Гру не обрано — виконайте `/game play` ще раз, коли будете готові.',
  'pron.listHeader': '🗣️ **Ваші вимови** ({count}/{limit}):',
  'pron.listEmpty': 'У вас ще немає жодної — додайте за допомогою `/pronunciation add`.',
  'pron.set': '✅ Збережено! Коли **ви** пишете «{term}», я казатиму «{replacement}».',
  'pron.removed': '🗑️ «{term}» видалено.',
  'pron.notFound':
    'У вас немає вимови для «{term}». Перегляньте свої за допомогою `/pronunciation list`.',
  'pron.empty': 'Слово і те, як його казати, не можуть бути порожніми.',
  'pron.limitHit':
    '🔒 Ви досягли свого ліміту в **{limit}** вимов. Видаліть одну за допомогою `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus або Premium піднімає ліміт до **50** → {url}',
  'pron.modalTitle': 'Навчіть Vozen вимови',
  'pron.modalTerm': 'Слово (як його пишуть)',
  'pron.modalSay': 'Як Vozen має його казати',
  'spron.listHeader': '🗣️ **Вимови сервера** ({count}/{limit}) — застосовуються до всіх:',
  'spron.listEmpty': 'Ще жодної — додайте за допомогою `/server-pronunciation add`.',
  'spron.set': '✅ Збережено для всього сервера! «{term}» → «{replacement}».',
  'spron.removed': '🗑️ «{term}» видалено із сервера.',
  'spron.notFound': 'На сервері немає вимови для «{term}».',
  'spron.limitHit':
    '🔒 Сервер досяг свого ліміту в **{limit}** вимов. Видаліть одну за допомогою `/server-pronunciation remove`.',
  'spron.modalTitle': 'Вимова сервера',
  'spron.modalSay': 'Як Vozen казатиме це для всіх',
  'rand.selectPrompt': '🎲 **Рандомайзер** — з-поміж скількох варіантів мені обирати?',
  'rand.selectPlaceholder': 'Кількість варіантів…',
  'rand.selectOption': '{n} варіантів',
  'rand.filling': '📝 Заповніть форму, що щойно відкрилася!',
  'rand.modalTitle': 'Рандомайзер — {amount} варіантів',
  'rand.modalOption': 'Варіант {n}',
  'rand.needTwo': 'Дайте мені щонайменше 2 варіанти через кому (напр. "піца, суші").',
  'rand.result': 'З-поміж {count} варіантів я обираю… **{winner}**!',
  'rand.speak': 'Я обираю… {winner}!',
  'rand.notInVoice':
    '_(зайдіть до голосового каналу разом зі мною, і наступного разу я скажу це вголос)_',
  'rand.timeout': '⏰ Нічого не обрано — виконайте `/randomizer` ще раз, коли будете готові.',
};
