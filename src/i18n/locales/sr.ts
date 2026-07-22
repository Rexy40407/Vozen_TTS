export default {
  'error.generic': 'Нешто је пошло наопако. Покушај поново.',
  'stt.guildOnly': 'Транскрипција ради само унутар сервера.',
  'stt.noManage':
    'Потребна ти је дозвола **Управљање сервером** да покренеш или зауставиш транскрипцију.',
  'stt.notPremium':
    '🎙️ Транскрипција уживо је **Premium** функција. Погледај `/premium info` да је откључаш за овај сервер.',
  'stt.unavailable':
    'Транскрипција није доступна на овој инстанци (мотор за претварање говора у текст није инсталиран).',
  'stt.notInVoice':
    'Нисам у гласовном каналу — уђи у један и прво покрени `/join`, па онда покрени транскрипцију.',
  'stt.alreadyRunning': 'Транскрипција већ ради на овом серверу. Прво користи `/transcribe stop`.',
  'stt.atCapacity':
    'Тренутно ради превише транскрипција на свим серверима. Покушај поново за кратко.',
  'stt.noChannel':
    'Не могу да објављујем транскрипте у овом каналу. Покушај да покренеш команду из обичног текстуалног канала.',
  'stt.started':
    '✅ Транскрипција је покренута. Свако ко притисне **Пристајем** у обавештењу биће транскрибован у овај канал.',
  'stt.startFailed':
    'Нисам могао да покренем транскрипцију (није успело објављивање обавештења). Поништио сам све — ништа се не снима. Покушај поново.',
  'stt.announceStart':
    '🎙️ **Транскрипција уживо је УКЉУЧЕНА у овом каналу.** Транскрибују се само они који пристану — притисни дугме испод да дозволиш да се твој говор овде записује. Можеш повући пристанак у било ком тренутку помоћу `/transcribe revoke`.',
  'stt.consentBtn': 'Пристајем на транскрипцију',
  'stt.consentThanks':
    '✅ Хвала — твој говор ће сада бити транскрибован на овом серверу. Повуци пристанак кад год желиш помоћу `/transcribe revoke`.',
  'stt.stopped': '🛑 Транскрипција заустављена.',
  'stt.notRunning': 'Транскрипција не ради на овом серверу.',
  'stt.announceStop': '🛑 **Транскрипција уживо је сада ИСКЉУЧЕНА.** Престао сам да слушам.',
  'stt.revoked':
    '✅ Пристанак повучен — више нећеш бити транскрибован на овом серверу. (Поруке које су већ објављене остају; обриши их у Discord-у ако желиш.)',
  'stt.revokeNone':
    'Ниси био пристао на транскрипцију на овом серверу, па није било шта да се повуче.',
  'privacy.eraseConfirm':
    '⚠️ Ово трајно брише **све** твоје Vozen податке на сваком серверу: подешавања гласа, изговорени надимак, личне скраћенице и изговоре, сачувани рођендан, резултате игара, статистику причања, и искључивање. **Ово се не може опозвати.** Јеси ли сигуран?',
  'privacy.erasePremiumNote':
    '_Напомена: твој плаћени Premium/Plus и историја куповине се задржавају — припадају теби и законски обавезним финансијским евиденцијама. Да зауставиш Premium, пусти га да истекне или контактирај подршку._',
  'privacy.eraseYes': 'Обриши све',
  'privacy.eraseNo': 'Откажи',
  'privacy.eraseCancelled': 'Отказано — ништа није обрисано.',
  'privacy.eraseDone': '✅ Готово. Сви твоји лични подаци су трајно обрисани.',
  'error.needManageGuild': 'Потребна ти је дозвола **Управљање сервером** за то.',
  'join.needVoiceChannel': 'Прво уђи у гласовни канал, па онда покрени /join.',
  'join.missingPerms': 'Потребне су ми дозволе **Connect** и **Speak** у {channel}.',
  'join.joined':
    '✅ Ту сам, у {channel}! Следећи корак: напиши `/tts здраво` и прочитаћу то наглас. Желиш да аутоматски читам канал? Покрени /setup.',
  'join.joinedAutoread':
    '✅ Ту сам, у {channel}! Све је спремно. Пиши у каналу за аутоматско читање и прочитаћу то наглас. → {readChannel}',
  'leave.left': 'Напустио сам гласовни канал. Видимо се следећи пут!',
  'skip.notInVoice':
    'Још нисам у гласовном каналу — уђи у један и прво покрени /join, па покушај поново.',
  'skip.skipped': 'Прескочено.',
  'skip.nothing': 'Тренутно се ништа не пушта.',
  'shutup.notInVoice': 'Још нисам у гласовном каналу — уђи у један и прво покрени /join.',
  'shutup.nothing': 'Тренутно се ништа не пушта.',
  'shutup.done': '🤐 У реду, ућуткаћу се — очистио сам све из реда.',
  'tts.notInVoice':
    'Још нисам у гласовном каналу — уђи у један и покрени /join, па покушај поново.',
  'tts.nothingToRead': 'Ту нема шта да се прочита — пошаљи ми неки текст да изговорим.',
  'tts.nothingAfterClean':
    'Након сређивања није остало ништа за читање — пробај са обичним текстом (слова или речи).',
  'tts.tooFast': 'Полако, успори мало — покушај поново за тренутак.',
  'tts.blocked': 'Тај текст садржи блокирану реч, па сам га прескочио.',
  'tts.queued': 'Разумем — на реду је.',
  'tts.busy': 'Тренутно сам заузет — покушај поново за тренутак.',
  'voice.unknownModel': 'Не познајем тај глас — погледај /voice list.',
  'voice.badSpeed':
    'Брзина мора бити између 0.5 и 2.0 (1.0 је нормално). Пробај `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Твој глас је сада **{name}** при {speed}×. Пробај `/tts здраво` да га чујеш. (ид: `{model}`)',
  'voice.config.title':
    '🎙️ **Подешавање гласа** — изаберите опције испод, па притисните **Сачувај**. До тада се ништа неће променити.',
  'voice.config.summary': 'Тренутни избор: **{voice}** · механизам **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Језик…',
  'voice.config.pickVoice': 'Глас…',
  'voice.config.pickEngine': 'Механизам…',
  'voice.config.pickSpeed': 'Брзина…',
  'voice.config.more': '▼ Још језика',
  'voice.config.engDefault': 'Подразумевано (локално)',
  'voice.config.save': 'Сачувај',
  'voice.config.cancel': 'Откажи',
  'voice.config.cancelled': 'Подешавање је отказано — ништа није промењено.',
  'voice.config.expired': 'Панел је истекао — поново покрените `/voice config` да наставите.',
  'voice.listHeader': 'Доступни гласови:',
  'voice.listEmpty': '(ниједан није инсталиран)',
  'voice.reset':
    '✅ Твој глас је враћен на подразумевани. Изабери други кад год желиш помоћу `/voice list` и `/voice set`.',
  'voice.detection.on':
    '✅ Аутоматско препознавање језика је УКЉУЧЕНО: свака порука се чита гласом за препознати језик (говорник се може мењати). Искључи помоћу `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Аутоматско препознавање језика је ИСКЉУЧЕНО: твој један фиксни глас чита све, па увек звучиш исто.',
  'voice.optout': 'Више нећеш бити читан аутоматски. Покрени /voice opt-in да поново укључиш.',
  'voice.optin': 'Поново ћеш бити читан аутоматски.',
  'voice.nickname.set': '✅ Vozen ће те сада наглас звати **{name}**.',
  'voice.nickname.cleared':
    '✅ Изговорени надимак уклоњен — Vozen ће користити твоје име на серверу.',
  'voice.nickname.invalid':
    'То име нема ништа читљиво за изговарање наглас. Пробај слова или бројеве.',
  'voice.effect.set':
    '✅ Гласовни ефекат постављен на **{effect}** — твоје поруке се сада пуштају са тим ефектом. Користи `/voice effect none` да га искључиш.',
  'voice.effect.cleared': '✅ Гласовни ефекат уклоњен — поново чист глас.',
  'voice.effect.locked':
    '🔒 **{effect}** је Premium ефекат. Бесплатни ефекти: 🤖 Robot и 🔊 Echo. Откључај све уз Vozen Premium — погледај `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** је Premium гласовни мотор. Откључај га уз Vozen Plus (лично) или Vozen Premium (сервер) — погледај `/premium`. У међувремену твој глас остаје на бесплатном локалном мотору.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** је Premium гласовни мотор. Откључај га уз Vozen Plus (лично) или Vozen Premium (сервер) — погледај `/premium`. У међувремену твој глас остаје на бесплатном локалном мотору.',
  'voice.notInVoice': 'Још нисам у гласовном каналу — прво покрени /join.',
  'voice.previewPlaying': 'Пуштам узорак…',
  'preview.sample': 'Здраво, ја сам Vozen. напиши, чуј.',
  'laugh.playing': 'Хаха! Пуштам то твојим гласом…',
  'joke.playing': 'Причам виц…\n> {joke}',
  'joke.unknownLang': 'Не познајем тај језик. Изабери један са листе.',
  'rizz.playing': '😏 Бацам мало шарма…\n> {line}',
  'rizz.unknownLang': 'Не познајем тај језик. Изабери један са листе.',
  'rizz.locked':
    '🔒 **/rizz** је Premium погодност. Откључај је уз Vozen Plus (ти) или Premium (овај сервер). Погледај `/premium`.',
  'sound.playing': '🔊 Пуштам **{name}**…',
  'sound.unknown': 'Немам тај звук. Покрени `/sound` да видиш листу.',
  'sound.list':
    '🔊 **Звукови:** {sounds}\nПусти неки помоћу `/sound name:<звук>` (морам бити у твом гласовном каналу).',
  'sound.disabled':
    '🔇 Звучна табла је **искључена** на овом серверу. Администратор може да је укључи помоћу `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Рођендан сачуван: **{day}/{month}**. Честитаћу ти рођендан када уђеш у гласовни канал тог дана!',
  'birthday.invalid': 'То није стварни датум. Провери дан и месец.',
  'birthday.cleared': '🎂 Рођендан уклоњен.',
  'birthday.show': '🎂 Твој рођендан је постављен на **{day}/{month}**.',
  'birthday.none': 'Још ниси поставио рођендан. Користи `/birthday set`.',
  'topspeakers.title': '🗣️ **Највећи говорници** — кога сам највише читао на овом серверу:',
  'topspeakers.empty': 'Још нисам прочитао ничије поруке. Подеси канал за читање помоћу `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** порука · 🔥 низ од {streak} дана',
  'serverstats.title': '📊 **Статистика сервера**',
  'serverstats.empty':
    'Још нема статистике — нисам прочитао ниједну поруку нити покренуо игру овде. Подеси помоћу `/setup`!',
  'serverstats.messages': '🗣️ **{total}** прочитаних порука · **{speakers}** особа',
  'serverstats.topTalkers': '**Највеће причалице:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} порука · 🔥 {streak}д',
  'serverstats.streak': '🔥 Најдужи активни низ: **{days}** дана',
  'serverstats.games': '🎮 **{points}** поена у играма · **{wins}** победа · **{players}** играча',
  'serverstats.topPlayers': '**Најбољи играчи:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} поена · {wins} победа',
  'serverstats.upsell':
    '🔒 То је бесплатан преглед. **Premium** откључава низове, статистику игара и цео топ 5 — погледај `/premium`.',
  'streak.day': '🔥 <@{user}> је у низу од **{n} дана**! Настави да причаш да га одржиш.',
  'leaderboard.autoTitle': '🏆 Највеће причалице на овом серверу',
  'premium.title': '💎 **Статус Vozen Premium-а**',
  'premium.lineServerActive': '🖥️ **Сервер:** Premium до {date}',
  'premium.lineServerFree': '🖥️ **Сервер:** Бесплатан план',
  'premium.lineUserActive': '👤 **Ти (Plus):** активан до {date}',
  'premium.lineUserFree': '👤 **Ти (Plus):** није активан',
  'premium.getHint':
    'Све што данас користиш остаје бесплатно. Premium додаје свих 8 гласовних ефеката, 24/7 у позиву, 50 личних изговора, /rizz и premium игре. Подршка: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **Твој Premium пас:** {used}/{total} лиценци у употреби · истиче {date}',
  'premium.passServers': '↳ У употреби на: {servers}',
  'premium.pitch':
    'Још немаш Premium. **Vozen Premium** (€3.99/мес за 3 сервера, или €7.99/мес за 8) откључава за цео сервер: свих 8 гласовних ефеката, 24/7 у позиву, 50 личних изговора (уместо 3), команду /rizz и premium игре (Ланац речи, Wordle, Шах). **Vozen Plus** (€1.99/мес) даје ти те погодности лично, на било ком серверу.',
  'premium.buyHint':
    '▶ **Набави Premium:** {link}\nНакон куповине, покрени `/premium activate` на серверу који желиш.',
  'premium.confirmActivate':
    'Да искористиш **1 од твојих {total} Premium лиценци** на **овом серверу**? Тренутно имаш **{used}** у употреби. Можеш је ослободити касније помоћу `/premium deactivate` — сат на пасу тече у сваком случају.',
  'premium.confirmYes': '💎 Искористи лиценцу',
  'premium.confirmNo': 'Откажи',
  'premium.activateOk':
    '✅ Premium је сада активан на **овом серверу** до {date}. Лиценце: **{used}/{total}** у употреби.',
  'premium.activateCancelled': 'Отказано — ниједна лиценца није искоришћена.',
  'premium.activateTimeout': 'Време истекло — ниједна лиценца није искоришћена.',
  'premium.noPass':
    'Немаш активан Premium пас. Набави један и стићи ће на твој налог — па онда овде покрени `/premium activate`.\n▶ {link}',
  'premium.alreadyActive':
    'Овај сервер већ има једну од твојих Premium лиценци. Нема шта да се ради.',
  'premium.noSeats':
    'Све твоје **{total}** Premium лиценце су у употреби ({servers}). Ослободи једну помоћу `/premium deactivate` тамо, па покушај поново овде.',
  'premium.needManageGuild':
    'Активирање Premium-а утиче на цео сервер — само чланови са **Управљање сервером** то могу. Питај администратора.',
  'premium.deactivateOk':
    '✅ Ослободио сам Premium лиценцу овог сервера. Искористи је на другом серверу помоћу `/premium activate`.',
  'premium.deactivateNone': 'Овај сервер нема твоју Premium лиценцу за ослобађање.',
  'premium.thisServer': 'овај сервер',
  'grant.denied': '⛔ Ова команда је само за власника бота.',
  'grant.okPremium':
    '✅ Додељен <@{user}> **Premium пас** ({seats} лиценци) на **{days}** дана — истиче {date}. Активира га помоћу `/premium activate`.',
  'grant.okPlus': '✅ Додељен <@{user}> **Vozen Plus** на **{days}** дана — истиче {date}.',
  'gencode.done':
    '✅ Генерисано **{count}** {plan} код(ова), по **{days}** дана. Подели их приватно:\n{list}',
  'redeem.okPlus': '🎁 Искоришћено! Добио си **Vozen Plus** на **{days}** дана — истиче {date}.',
  'redeem.okPremium':
    '🎁 Искоришћено! Добио си **Premium пас** ({seats} лиценци) на **{days}** дана — истиче {date}. Активирај га на свом серверу помоћу `/premium activate`.',
  'redeem.notFound': '❌ Тај код не постоји. Провери га и покушај поново.',
  'redeem.used': '❌ Тај код је већ искоришћен.',
  'redeem.expired': '❌ Тај код је истекао.',
  'voice.abbrev.added': 'Разумем — {term} ће бити прочитано као {replacement}.',
  'voice.abbrev.removed': 'Уклоњена је твоја скраћеница за {term}.',
  'voice.abbrev.listHeader': 'Твоје личне скраћенице (искоришћено {count}/{cap}):',
  'voice.abbrev.listEmpty': '(још ниједна — додај је помоћу /voice abbrev add)',
  'voice.abbrev.capReached':
    'Достигао си ограничење од {cap} личних скраћеница. Уклони једну пре него што додаш нову.',
  'voice.abbrev.invalidTerm': 'Појам мора бити једна реч (само слова и цифре), до 50 знакова.',
  'voice.abbrev.emptyReplacement': 'Читање не може бити празно.',
  'voice.abbrev.tooLong': 'Читање је предугачко (највише 200 знакова).',
  'config.wordEmpty': 'Реч не може бити празна.',
  'config.blocked': 'Блокирано: {word}.',
  'config.blockLimit':
    'Овај сервер већ има максималних {max} блокираних речи. Уклони једну пре него што додаш нову.',
  'config.unblocked': 'Одблокирано: {word}.',
  'config.pronListHeader': 'Речник изговора:',
  'config.pronEmptyValue': '(празно)',
  'config.listEmpty': '(ниједно)',
  'config.termEmpty': 'Појам не може бити празан.',
  'config.pronEmpty': 'Изговор не може бити празан.',
  'config.pronSet': 'Разумем — {term} ће бити прочитано као {replacement}.',
  'config.pronRemoved': 'Уклоњен је изговор за {term}.',
  'config.channelWrongType': 'Изабери текстуални канал (не гласовни канал ни категорију).',
  'config.channelNoAccess': 'Не видим {channel} — провери моје дозволе тамо.',
  'config.channelSet':
    'Канал за аутоматско читање постављен на {channel}. Следеће: провери да ли је аутоматско читање укључено помоћу `/config auto-read active:true`.',
  'config.autoreadOn': 'Аутоматско читање је сада **укључено**.',
  'config.autoreadOff': 'Аутоматско читање је сада **искључено**.',
  'config.maxCharsRange': 'Вредност максималног броја знакова мора бити између 1 и 2000.',
  'config.maxCharsSet': 'Максималан број знакова по поруци постављен на {value}.',
  'config.rateLimitRange': 'Вредност ограничења брзине мора бити између 1 и 120.',
  'config.rateLimitSet': 'Ограничење брзине постављено на {value} порука у минути.',
  'config.roleSet': 'Аутоматско читање је сада ограничено на чланове са улогом {role}.',
  'config.roleCleared': 'Ограничење по улози уклоњено — сада сви могу бити читани.',
  'config.enabledOn': 'TTS је сада **укључен** за овај сервер.',
  'config.enabledOff': 'TTS је сада **искључен** за овај сервер.',
  'config.xsaidOn':
    'Vozen ће сада најавити **ко је говорио** пре сваке поруке (нпр. „Alex је рекао ћао“). Искључи помоћу `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **више неће** најављивати ко је говорио — чита само поруку.',
  'config.autojoinOn':
    '✅ Аутоматско придруживање **укључено** — Vozen ће се придружити твом гласовном каналу када пишеш у TTS каналу.',
  'config.autojoinOff':
    'Аутоматско придруживање **искључено** — користи `/join` да доведеш Vozen у глас.',
  'config.stayOn':
    '✅ 24/7 у позиву **укључено** — Vozen ће остати у гласовном каналу чак и када се испразни, и вратиће се после рестартова. 💎 Потребан је Premium да ступи на снагу (купи или `/redeem` код, па `/premium activate`).',
  'config.stayOff':
    '24/7 у позиву **искључено** — Vozen излази када се гласовни канал испразни (подразумевано).',
  'config.readBotsOn': '✅ Vozen ће сада читати и поруке **других ботова и вебхукова**.',
  'config.readBotsOff':
    'Vozen ће **игнорисати** друге ботове и вебхукове (читају се само стварне особе).',
  'config.textInVoiceOn':
    '✅ Vozen ће такође читати **текстуални чет унутар свог гласовног канала**.',
  'config.textInVoiceOff':
    'Vozen **неће** читати текстуални чет гласовног канала (само TTS канал).',
  'config.antispamOn':
    '✅ Анти-спам **укључен** — Vozen неће читати спамоване поруке (масовно понављање речи или иста велика порука објављена изнова и изнова).',
  'config.antispamOff': 'Анти-спам **искључен** — Vozen чита сваку поруку као и обично.',
  'config.streaksOn':
    '✅ Обавештења о низовима **укључена** — Vozen приказује 🔥 поруку о дневном низу први пут када свака особа проговори сваког дана.',
  'config.streaksOff':
    'Обавештења о низовима **искључена** — Vozen и даље прати низове (види `/top-speakers`) али ћути о њима.',
  'config.soundboardOn': 'Звучна табла **укључена** — свако може да пушта клипове помоћу `/sound`.',
  'config.soundboardOff': 'Звучна табла **искључена** — `/sound` је онемогућен на овом серверу.',
  'config.votePromosLabel': 'Обавештења о top.gg награди + Vozen Support',
  'config.greetOn': '✅ Поздрављаћу људе по имену када уђу у гласовни канал.',
  'config.greetOff': '🔇 **Нећу** поздрављати људе када уђу у гласовни канал.',
  'config.greetLangSet': '✅ Језик поздрава при уласку постављен на **{language}**.',
  'config.defaultVoiceSet':
    '✅ Подразумевани глас сервера постављен на **{name}**. Чланови без сопственог гласа чуће овај. (ид: `{model}`)',
  'config.reset':
    'Конфигурација враћена на подразумеване вредности. Твоја листа блокираних речи и изговори су сачувани.',
  'config.showTitle': '**Конфигурација сервера**',
  'config.showChannel': 'TTS канал: {value}',
  'config.showAutoread': 'Аутоматско читање: {value}',
  'config.showRole': 'Улога: {value}',
  'config.showEnabled': 'Омогућено: {value}',
  'config.showXsaid': 'Најави говорника (xsaid): {value}',
  'config.showAutojoin': 'Аутоматско придруживање: {value}',
  'config.showReadBots': 'Читање ботова/вебхукова: {value}',
  'config.showTextInVoice': 'Текст-у-гласу: {value}',
  'config.showAntispam': 'Анти-спам: {value}',
  'config.showSoundboard': 'Звучна табла (/sound): {value}',
  'config.showGreet': 'Поздрав при уласку: {value} ({language})',
  'config.showVoice': 'Подразумевани глас: {value}',
  'config.showMaxChars': 'Максималан број знакова: {value}',
  'config.showRateLimit': 'Ограничење брзине: {value}/мин',
  'config.showBlocklist': 'Листа блокираних: {count} речи',
  'config.showPronunciation': 'Изговори: {count} ставки',
  'config.valueNone': '(ниједно)',
  'config.valueAny': 'било ко',
  'config.valueAutoDetect': '(аутоматско препознавање)',
  'config.on': 'укључено',
  'config.off': 'искључено',
  'config.language.set': 'Језик интерфејса постављен на {language}.',
  'config.language.unsupported': 'Тај језик још није подржан.',
  'setup.noChannel':
    'Нисам могао да утврдим који канал да користим. Проследи текстуални канал у опцији „channel“.',
  'setup.channelWrongType':
    'Канал за аутоматско читање мора бити текстуални канал (не гласовни канал ни категорија). Проследи један у опцији „channel“.',
  'setup.done': '**Све је спремно — Vozen је спреман.**',
  'setup.channelLine': 'Канал за аутоматско читање: {channel}',
  'setup.autoreadOn': 'Аутоматско читање: укључено',
  'setup.permsHeader': '**Дозволе:**',
  'setup.permView': 'ViewChannel (види текстуални канал)',
  'setup.permSend': 'SendMessages (пише у текстуалном каналу)',
  'setup.permConnect': 'Connect (придружује се гласовном каналу)',
  'setup.permSpeak': 'Speak (говори у гласовном каналу)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — недостаје',
  'setup.permUnchecked': '⏳ {label} — још није проверено (проверићу приликом /join)',
  'setup.fixHint':
    'Да поправиш оно што недостаје: у подешавањима сервера отвори Vozen-јеву улогу (или дозволе канала) и омогући ставке означене са ❌.',
  'setup.voiceUncheckedNote':
    'Ниси у гласовном каналу, па још нисам могао да проверим Connect/Speak — проверићу их када покренеш /join.',
  'setup.allGood': 'Све је спремно. Уђи у гласовни канал и покрени /join.',
  'setup.joinedVoice': 'Придружио сам се и {channel} — нема потребе да покрећеш /join.',
  'setup.readyTalk': 'Све је спремно. Пиши у каналу за аутоматско читање и прочитаћу то наглас.',
  'setup.membersHeader': '**Реци својим члановима (ток у 3 корака):**',
  'setup.membersBody':
    '1) Уђи у гласовни канал\n2) Покрени /join да се придружим с тобом\n3) Пиши у овом каналу (или користи /tts) и прочитаћу то наглас\nПотпуна листа команди: /help',
  'stats.title': '**Vozen статистика**',
  'stats.messagesSpoken': 'Изговорених порука: {value}',
  'stats.cacheHits': 'Погодака у кешу: {value}',
  'stats.cacheMisses': 'Промашаја у кешу: {value}',
  'stats.synthErrors': 'Грешака синтезе: {value}',
  'stats.synthLatency': 'Кашњење синтезе: p50 {p50}ms / p95 {p95}ms ({count} узорака)',
  'stats.voiceDrops': 'Прекида везе: {value}',
  'stats.voiceReconnects': 'Поновних повезивања: {value}',
  'stats.votes': 'top.gg гласова: {value}',
  'stats.activePlayers': 'Активних плејера: {value}',
  'stats.servers': 'Сервера: {value}',
  'stats.uptime': 'Време рада: {value}с',
  'speak.emptyMessage': 'Та порука нема текст за читање наглас.',
  'uptime.text': '🟢 Vozen је онлајн већ **{uptime}**.',
  'botstats.title': '📊 **Vozen — статистика**',
  'botstats.servers': 'Сервера: **{value}**',
  'botstats.voiceSessions': 'Гласовних сесија сада: **{value}**',
  'botstats.messagesSpoken': 'Изговорених порука: **{value}**',
  'botstats.uptime': 'Време рада: **{value}**',
  'invite.noClientId':
    'Vozen-јев линк за позивницу још није подешен (CLIENT_ID недостаје). Обавести администратора бота.',
  'invite.link': 'Додај Vozen на свој сервер:\n{url}',
  'vote.noClientId':
    'Vozen-јев линк за гласање још није подешен (CLIENT_ID недостаје). Обавести администратора бота.',
  'vote.link':
    'Гласај за Vozen (бесплатно, сваких 12ч) и помози да га више људи открије:\n{url}\nАко овај налог никада није преузео награду, добија **48 сати Vozen Plus-а**, само једном по налогу.',
  'invite.button': 'Додај Vozen',
  'vote.button': 'Гласај на top.gg',
  'vote.upsell':
    '🗳️ Ако овај налог никада није преузео награду, добија **48 сати Vozen Plus-а**, само једном по налогу. {url}',
  'vote.cooldownStatus':
    '🗳️ Овај налог је већ искористио једнократну награду за глас. И даље можеш да гласаш и подржиш Vozen, али нећеш добити још Plus-а.',
  'help.title': 'Vozen — напиши, чуј.',
  'help.embedTitle': 'Vozen — Команде',
  'help.intro':
    'Vozen чита твој текст наглас у гласовним каналима — бесплатни неуронски гласови, десетине језика.',
  'help.quickStartTitle': 'Брзи почетак (3 корака)',
  'help.quickStartBody':
    '1) Уђи у гласовни канал, па покрени /join\n2) Пиши у текстуалном каналу (или користи /tts Здраво свима!)\n3) (опционо) Изабери глас помоћу /voice set',
  'help.groupStarted': 'Први кораци',
  'help.groupStartedBody':
    '• /join — придружујем се твом гласовном каналу\n• /leave — напуштам гласовни канал\n• /tts <текст> — читам текст наглас · нпр. /tts Здраво свима!\n• /skip — прескочи оно што тренутно читам',
  'help.groupVoice': 'Твој глас',
  'help.groupVoiceBody':
    '• /voice set <model> — изабери свој глас · нпр. /voice set en_US-amy-medium\n• /voice list — погледај доступне гласове\n• /voice preview — чуј узорак свог гласа\n• /voice reset — врати се на подразумевани глас\n• /voice opt-out · /voice opt-in — искључи / укључи аутоматско читање за тебе\n• /voice abbrev add|remove|list — лични сленг, прочитан на твој начин (до 10)',
  'help.groupFun': 'Забава',
  'help.groupFunBody':
    '• /joke — причам кратак виц (изабери језик + опционо смех) · нпр. /joke English\n• /laugh — смејем се наглас твојим тренутним гласом',
  'help.groupAdmin': 'Администрација сервера (потребно је Управљање сервером)',
  'help.groupAdminBody':
    '• /setup — вођено подешавање у једном кораку · покрени ово прво\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · нпр. /config tts-channel #general\n• /stats — статистика бота',
  'help.groupMore': 'Још',
  'help.groupMoreBody':
    '• /invite — додај Vozen на други сервер\n• /vote — гласај за Vozen на top.gg\n• /help — прикажи ову помоћ',
  'help.footer': 'Нов си овде? Покрени {command} да почнеш.',
  'help.support': '🛟 Треба ти помоћ или желиш да пријавиш проблем? {url}',
  'help.source': '📄 Отворен код (AGPL-3.0) — преузми тачан код који се овде извршава: {url}',
  'welcome.title': 'Хвала што си додао Vozen! 👋',
  'welcome.description':
    'Vozen чита твој чет наглас у гласовним каналима — напиши, чуј.\n\n**Почни у једном кораку:** покрени {setup} и подесићу аутоматско читање и придружити се твом гласовном каналу.\n\nТреба ти потпуна листа команди? Покрени {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Како чланови то користе (3 корака)',
  'welcome.stepsBody':
    '1) Уђи у гласовни канал\n2) Покрени /join да ти се придружим\n3) Пиши у текстуалном каналу (или користи /tts) и прочитаћу то наглас\nПотпуна листа команди: /help',
  'welcome.footer': 'Vozen — напиши, чуј.',
  'welcome.tagline': 'Природан неуронски глас — бесплатно заувек, без плаћања.',
  'game.start.needVoice':
    'Ово је **гласовна игра** — уђи у гласовни канал и прво покрени /join, па је покрени.',
  'game.start.alreadyActive':
    'Игра већ траје у <#{channel}>. Заврши је (или користи `/game stop`) пре него што почнеш нову.',
  'game.start.premiumLocked':
    '🔒 **{game}** је Premium игра (кошта праву рачунарску снагу). Погледај `/premium`.',
  'game.start.started': '🎮 Почињем **{game}**! Прати канал — срећно!',
  'game.start.startedThread':
    '🎮 **{game}** је почела у <#{channel}> — придружите се тамо! Нит се сама брише када игра заврши.',
  'game.thread.winner': '🏆 {winner} је победио у игри!',
  'game.thread.ended': '🎮 Игра је завршена.',
  'game.unknownGame': 'Не познајем ту игру. Изабери једну са листе.',
  'game.stop.ok': '🛑 Зауставио сам тренутну игру.',
  'game.stop.none': 'Тренутно не траје ниједна игра.',
  'game.list.title': '🎮 **Игре** — покрени неку помоћу `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Ранг-листа** — најбољи играчи на овом серверу:',
  'game.leaderboard.empty': 'Још се није играло ништа. Буди први — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** поена ({wins} победа)',
  'game.finish.title': '🏁 **Крај игре!** Коначни резултати:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Крај игре — нико није освојио поене овог пута. Следећи пут!',
  'game.finish.winnerVoice': '{user} побеђује!',
  'game.guessLanguage.name': 'Погоди језик',
  'game.guessLanguage.desc':
    'Читам реченицу на насумичном језику — први ко га именује осваја поен.',
  'game.guessLanguage.intro':
    '🗣️ **Погоди језик** — прочитаћу {rounds} реченица. Напиши који језик чујеш. Најбржи тачан одговор осваја сваку рунду!',
  'game.guessLanguage.round': '🎧 Рунда {n}/{total} — слушај…',
  'game.guessLanguage.correct': '✅ **{user}** је погодио — био је **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Време! То је био **{language}**.',
  'game.guessLanguage.noLanguages':
    'Немам довољно инсталираних гласова да играм ово. Замоли администратора да дода више гласова.',
  'game.math.name': 'Рачунање у глави',
  'game.math.desc': 'Изговарам рачун наглас — први ко напише резултат побеђује.',
  'game.math.intro':
    '🔢 **Рачунање у глави** — {rounds} рачуна. Слушај и напиши резултат што брже можеш!',
  'game.math.round': '🧮 Рунда {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** је погодио — резултат је био **{answer}**!',
  'game.math.timeout': '⏱️ Време! Резултат је био **{answer}**.',
  'game.math.plus': 'плус',
  'game.math.minus': 'минус',
  'game.math.times': 'пута',
  'game.skipCount.name': 'Прескочени број',
  'game.skipCount.desc': 'Бројим наглас али прескочим један број — први ко га ухвати побеђује.',
  'game.skipCount.intro':
    '🔢 **Прескочени број** — бројим, али прескочим један. Напиши који број недостаје! ({rounds} рунди)',
  'game.skipCount.round': '👂 Рунда {n}/{total} — који број сам прескочио?',
  'game.skipCount.correct': '✅ **{user}** је ухватио — прескочио сам **{answer}**!',
  'game.skipCount.timeout': '⏱️ Време! Прескочио сам **{answer}**.',
  'game.spelling.name': 'Диктат',
  'game.spelling.desc': 'Изговарам реч — први ко је правилно напише побеђује.',
  'game.spelling.intro': '✍️ **Диктат** — изговорићу {rounds} речи. Напиши сваку правилно!',
  'game.spelling.round': '🗣️ Рунда {n}/{total} — напиши реч коју изговорим…',
  'game.spelling.correct': '✅ **{user}** је правилно написао **{word}**!',
  'game.spelling.timeout': '⏱️ Време! Реч је била **{word}**.',
  'game.spelling.empty': 'Још немам листу речи за језик гласа овог сервера.',
  'game.spellOut.name': 'Слово по слово',
  'game.spellOut.desc': 'Срицам реч слово по слово — први ко напише целу реч побеђује.',
  'game.spellOut.intro':
    '🔡 **Слово по слово** — срицам {rounds} речи слово по слово. Напиши целу реч!',
  'game.spellOut.round': '🔤 Рунда {n}/{total} — слушај слова…',
  'game.spellOut.correct': '✅ **{user}** је погодио — **{word}**!',
  'game.spellOut.timeout': '⏱️ Време! Срицало се **{word}**.',
  'game.fastSpeech.name': 'Брзо причање',
  'game.fastSpeech.desc': 'Читам реченицу супер брзо — први ко напише шта сам рекао побеђује.',
  'game.fastSpeech.intro':
    '💨 **Брзо причање** — {rounds} реченица невероватном брзином. Напиши шта чујеш!',
  'game.fastSpeech.round': '⚡ Рунда {n}/{total} — ево иде, брзо!',
  'game.fastSpeech.correct': '✅ **{user}** је одгонетнуо: „{phrase}“',
  'game.fastSpeech.timeout': '⏱️ Време! Било је: „{phrase}“',
  'game.fastSpeech.empty': 'Још немам реченице за језик гласа овог сервера.',
  'game.accentSwap.name': 'Смешан акценат',
  'game.accentSwap.desc': 'Изговарам реч са страним акцентом — први ко је напише побеђује.',
  'game.accentSwap.intro':
    '🎭 **Смешан акценат** — {rounds} речи изговорених погрешним акцентом. Напиши реч!',
  'game.accentSwap.round': '🌍 Рунда {n}/{total} — коју реч покушавам да изговорим?',
  'game.accentSwap.correct': '✅ **{user}** је погодио — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Време! Реч је била **{word}**.',
  'game.reflexes.name': 'Рефлекси',
  'game.reflexes.desc':
    'Одбројавам, па викнем КРЕНИ — први ко напише после тога побеђује. Не жури пре времена!',
  'game.reflexes.intro':
    '⚡ **Рефлекси** — {rounds} рунди. Када викнем **КРЕНИ**, напиши било шта што брже можеш. Ако напишеш пре КРЕНИ, то је погрешан старт!',
  'game.reflexes.ready': '🚦 Рунда {n}/{total} — приправи се…',
  'game.reflexes.countdown': 'три… два… један…',
  'game.reflexes.go': '🟢 **КРЕНИ!!!**',
  'game.reflexes.goVoice': 'Крени!',
  'game.reflexes.tooSoon': '🔴 **{user}** је поранио — прерано!',
  'game.reflexes.win': '⚡ **{user}** је најбржи! Поен!',
  'game.reflexes.tooSlow': '😴 Нико није реаговао на време. Следеће!',
  'game.headsOrTails.name': 'Глава или писмо',
  'game.headsOrTails.desc':
    'Погоди бацање новчића — напиши глава или писмо пре него што бацим. Ко највише погоди, побеђује!',
  'game.headsOrTails.intro':
    '🪙 **Глава или писмо** — {rounds} рунди. У свакој рунди напиши `heads` (глава) или `tails` (писмо) пре него што бацим новчић. 1 поен по тачном погодку!',
  'game.headsOrTails.introVoice': 'Хајде да играмо главу или писмо!',
  'game.headsOrTails.round': '🪙 Рунда {n}/{total} — глава или писмо? Напиши `heads` или `tails`!',
  'game.headsOrTails.roundVoice': 'Глава… или писмо?',
  'game.headsOrTails.heads': 'глава',
  'game.headsOrTails.tails': 'писмо',
  'game.headsOrTails.resultVoice': 'Пало је {side}!',
  'game.headsOrTails.winners': 'Пало је **{side}**! Поен за: {users}',
  'game.headsOrTails.noWinners': 'Пало је **{side}**! Нико није погодио — без поена.',
  'game.vozenSays.name': 'Vozen каже',
  'game.vozenSays.desc':
    'Слушај само када наредба почиње са „Vozen каже“. Ако упаднеш у замку, ухваћен си!',
  'game.vozenSays.intro':
    '🫡 **Vozen каже** — {rounds} наредби. Уради то САМО ако почнем са **„Vozen каже“**. Иначе се не мичи!',
  'game.vozenSays.prefix': 'Vozen каже',
  'game.vozenSays.verb': 'напишите',
  'game.vozenSays.real': '🗣️ Рунда {n}/{total} — „{command}“',
  'game.vozenSays.trap': '🗣️ Рунда {n}/{total} — „{command}“',
  'game.vozenSays.obeyed': '✅ **{user}** је први послушао — поен!',
  'game.vozenSays.caught': '🔴 **{user}** — нисам рекао Vozen каже! Ухваћен!',
  'game.vozenSays.nobody': '😴 Нико није послушао **{word}** на време. Следеће!',
  'game.vozenSays.trapCleared': '😌 Била је замка — добро уочено, нико није насео на **{word}**.',
  'game.roulette.name': 'Рулет истине или изазова',
  'game.roulette.desc':
    'Завртим и прочитам један задатак истине или изазова наглас. Покрени поново за нови.',
  'game.roulette.header': '🎯 **Точак каже…**',
  'game.hangman.name': 'Вешала',
  'game.hangman.desc': 'Погоди реч слово по слово — 6 промашаја и готово је.',
  'game.hangman.intro':
    '🪢 **Вешала** — напиши једно по једно слово да погодиш реч. Такође можеш написати целу реч!',
  'game.hangman.hit': '🟢 **{user}** је нашао **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — нема **{letter}**.',
  'game.hangman.wrongLetters': 'Погрешно: {letters}',
  'game.hangman.win': '🎉 **{user}** је решио — **{word}**!',
  'game.hangman.lose': '💀 Нема више покушаја! Реч је била **{word}**.',
  'game.hangman.idle': '🕹️ Игра паузирана (нико не игра). Реч је била **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Погоди реч од 5 слова. 🟩 право место, 🟨 погрешно место, ⬛ није у речи. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — напиши реч од 5 слова. Делите {max} покушаја. 🟩 право место · 🟨 погрешно место · ⬛ није у речи.',
  'game.wordle.guess': '🔤 **{user}** је покушао — још **{left}** покушаја',
  'game.wordle.inWord': '🟢 у речи: {letters}',
  'game.wordle.out': '🚫 напоље: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** је погодио у {n} — **{word}**!',
  'game.wordle.lose': '💀 Нема више покушаја! Реч је била **{word}**.',
  'game.wordle.idle': '🕹️ Игра паузирана (нико не игра). Реч је била **{word}**.',
  'game.tictactoe.name': 'Икс-окс',
  'game.tictactoe.desc': 'Два играча — напиши број 1-9 да поставиш свој знак. Три у низу побеђује.',
  'game.tictactoe.intro':
    '⭕ **Икс-окс** — прва два играча која потезну су ❌ и ⭕ (❌ почиње). Напиши број 1-9 да одиграш своје поље.',
  'game.tictactoe.turn': 'На потезу: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, на потезу је **{mark}**.',
  'game.tictactoe.taken': '🚫 Поље {cell} је заузето — изабери друго.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) побеђује!',
  'game.tictactoe.draw': '🤝 Нерешено!',
  'game.tictactoe.idle': '🕹️ Игра завршена (нико не игра).',
  'game.chess.name': 'Шах',
  'game.chess.desc':
    'Два играча — права шаховска правила (шах, рокада, промоција…). Напиши потез попут „e4“ или „Nf3“. 💎 Premium.',
  'game.chess.intro':
    '♟️ **Шах** — прва два играча која потезну играју белим и црним (бели почиње). Напиши потез у алгебарској нотацији („e4“, „Nf3“, „O-O“) или координатама („e2e4“). Напиши „resign“ да предаш.',
  'game.chess.white': 'бели',
  'game.chess.black': 'црни',
  'game.chess.seats': '⚪ Бели: **{white}** · ⚫ Црни: **{black}**',
  'game.chess.turn': '{move} — на потезу: **{color}**',
  'game.chess.check': '♟️ Шах!',
  'game.chess.notYourTurn': '⏳ **{user}**, на потезу је **{color}**.',
  'game.chess.illegalMove': '🚫 „{move}“ није дозвољен потез — покушај поново.',
  'game.chess.checkmate': '🏆 Шах-мат ({move})! **{user}** побеђује!',
  'game.chess.draw': '🤝 Нерешено ({move})!',
  'game.chess.resigned': '🏳️ **{user}** је предао — **{winner}** побеђује!',
  'game.chess.idle': '🕹️ Игра завршена (нико не игра).',
  'game.wordChain.name': 'Ланац речи',
  'game.wordChain.descr':
    'Ланац речи по потезима на једном језику: реци реч која почиње последњим словом претходне. 2 живота, без понављања, а сат убрзава. Изабери језик у опцији `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Ланац речи тренутно није доступан на **{lang}** (недостаје листа речи).',
  'game.wordChain.lobby':
    '🔗 **Ланац речи** на **{lang}**! Напиши било шта у овом каналу у наредних **{seconds}с** да се придружиш.',
  'game.wordChain.notEnough':
    '😴 Није се придружило довољно играча (потребна су бар 2). Игра отказана.',
  'game.wordChain.begin':
    '🚀 Почињемо! Играчи: {players}. Свака реч мора почети последњим словом претходне.',
  'game.wordChain.turn':
    '**{name}**, твој ред! **{lang}** реч која почиње са **{letter}** — {hearts} · ⏱️ {seconds}с',
  'game.wordChain.accepted': '✅ **{word}** — следеће слово: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Мора почети са **{letter}**.',
  'game.wordChain.bad.short': '📏 Прекратка — бар **{min}** слова.',
  'game.wordChain.bad.repeated': '🔁 Та реч је већ употребљена.',
  'game.wordChain.bad.word': '📖 То није у речнику.',
  'game.wordChain.bad.latin': '🔤 Рачунају се само слова A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** је остао без времена! Преостаје {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** испада!',
  'game.wordChain.winner': '🏆 **{name}** побеђује у ланцу! ({chain} речи)',
  'game.stats.none': 'Још ниси одиграо ниједну игру. Пробај `/game play`!',
  'game.stats.body': '🎮 **Твоја статистика** — **{points}** поена · **{wins}** победа · {rank}',
  'game.stats.rank': 'позиција **#{rank}** од {total}',
  'game.stats.unranked': 'још без позиције',
  'game.pickPrompt': '🎮 Коју игру желиш да играш? Изабери једну:',
  'game.pickPlaceholder': 'Изабери игру…',
  'game.pickTimeout':
    '⏰ Ниједна игра није изабрана — покрени `/game play` поново кад будеш спреман.',
  'pron.listHeader': '🗣️ **Твоји изговори** ({count}/{limit}):',
  'pron.listEmpty': 'Још немаш ниједан — додај један помоћу `/pronunciation add`.',
  'pron.set': '✅ Сачувано! Када **ти** напишеш „{term}“, изговорићу „{replacement}“.',
  'pron.removed': '🗑️ Уклоњено „{term}“.',
  'pron.notFound': 'Немаш изговор за „{term}“. Погледај своје помоћу `/pronunciation list`.',
  'pron.empty': 'Реч и начин како да се изговори не могу бити празни.',
  'pron.limitHit':
    '🔒 Достигао си свој лимит од **{limit}** изговора. Уклони један помоћу `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus или Premium подиже га на **50** → {url}',
  'pron.modalTitle': 'Научи Vozen изговор',
  'pron.modalTerm': 'Реч (како је људи пишу)',
  'pron.modalSay': 'Како Vozen треба да је изговори',
  'spron.listHeader': '🗣️ **Изговори сервера** ({count}/{limit}) — примењују се на све:',
  'spron.listEmpty': 'Још ниједан — додај један помоћу `/server-pronunciation add`.',
  'spron.set': '✅ Сачувано за цео сервер! „{term}“ → „{replacement}“.',
  'spron.removed': '🗑️ Уклоњено „{term}“ са сервера.',
  'spron.notFound': 'Сервер нема изговор за „{term}“.',
  'spron.limitHit':
    '🔒 Сервер је достигао свој лимит од **{limit}** изговора. Уклони један помоћу `/server-pronunciation remove`.',
  'spron.modalTitle': 'Изговор сервера',
  'spron.modalSay': 'Како Vozen то изговара за све',
  'rand.selectPrompt': '🎲 **Randomizer** — између колико опција желиш да бирам?',
  'rand.selectPlaceholder': 'Број опција…',
  'rand.selectOption': '{n} опција',
  'rand.filling': '📝 Попуни формулар који се управо отворио!',
  'rand.modalTitle': 'Randomizer — {amount} опција',
  'rand.modalOption': 'Опција {n}',
  'rand.needTwo': 'Дај ми бар 2 опције раздвојене зарезима (нпр. „пица, суши“).',
  'rand.result': 'Између {count} опција, бирам… **{winner}**!',
  'rand.speak': 'Бирам… {winner}!',
  'rand.notInVoice': '_(уђи у гласовни канал са мном и следећи пут ћу то рећи наглас)_',
  'rand.timeout': '⏰ Ништа није изабрано — покрени `/randomizer` поново кад будеш спреман.',
};
