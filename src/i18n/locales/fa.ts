export default {
  'error.generic': 'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
  'error.needManageGuild': 'برای این کار به مجوز **مدیریت سرور** نیاز دارید.',
  'join.needVoiceChannel': 'اول وارد یک کانال صوتی شو، بعد /join را اجرا کن.',
  'join.missingPerms': 'من در {channel} به مجوزهای **اتصال** و **صحبت** نیاز دارم.',
  'join.joined':
    '✅ من در {channel} هستم! گام بعدی: `/tts hello` را بگو تا با صدای بلند بخوانمش. می‌خواهی یک کانال را خودکار بخوانم؟ /setup را اجرا کن.',
  'join.joinedAutoread':
    '✅ من در {channel} هستم! همه‌چیز آماده است. در کانال خواندن خودکار بنویس تا با صدای بلند بخوانمش. → {readChannel}',
  'leave.left': 'از کانال صوتی خارج شدم. دفعهٔ بعد می‌بینمت!',
  'skip.notInVoice':
    'هنوز در کانال صوتی نیستم — وارد یکی شو و اول /join را اجرا کن، بعد دوباره امتحان کن.',
  'skip.skipped': 'رد شد.',
  'skip.nothing': 'الان چیزی در حال پخش نیست.',
  'tts.notInVoice':
    'هنوز در کانال صوتی نیستم — وارد یکی شو و /join را اجرا کن، بعد دوباره امتحان کن.',
  'tts.nothingToRead': 'چیزی برای خواندن آنجا نیست — یک متن برایم بفرست تا بگویم.',
  'tts.nothingAfterClean':
    'بعد از مرتب‌سازی، چیزی برای خواندن باقی نماند — یک متن معمولی امتحان کن (حروف یا کلمات).',
  'tts.tooFast': 'آرام‌تر، کمی صبر کن — چند لحظهٔ دیگر دوباره امتحان کن.',
  'tts.blocked': 'این متن یک کلمهٔ مسدودشده دارد، برای همین از آن رد شدم.',
  'tts.queued': 'گرفتمش — در صف قرار گرفت.',
  'tts.busy': 'الان مشغولم — چند لحظهٔ دیگر دوباره امتحان کن.',
  'voice.unknownModel': 'این صدا را نمی‌شناسم — /voice list را ببین.',
  'voice.badSpeed':
    'سرعت باید بین 0.5 و 2.0 باشد (1.0 عادی است). `/voice set model:… speed:1.0` را امتحان کن.',
  'voice.set':
    '✅ صدای تو حالا **{name}** با سرعت {speed}× است. برای شنیدنش `/tts hello` را امتحان کن. (شناسه: `{model}`)',
  'voice.config.title':
    '🎙️ **تنظیم صدا** — گزینه‌های زیر را انتخاب کنید، سپس **ذخیره** را بزنید. تا آن زمان چیزی تغییر نمی‌کند.',
  'voice.config.summary': 'انتخاب فعلی: **{voice}** · موتور **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'زبان…',
  'voice.config.pickVoice': 'صدا…',
  'voice.config.pickEngine': 'موتور…',
  'voice.config.pickSpeed': 'سرعت…',
  'voice.config.more': '▼ زبان‌های بیشتر',
  'voice.config.engDefault': 'پیش‌فرض (محلی)',
  'voice.config.save': 'ذخیره',
  'voice.config.cancel': 'لغو',
  'voice.config.cancelled': 'تنظیم لغو شد — چیزی تغییر نکرد.',
  'voice.config.expired': 'پنل منقضی شد — برای ادامه دوباره `/voice config` را اجرا کنید.',
  'voice.listHeader': 'صداهای موجود:',
  'voice.listEmpty': '(هیچ‌کدام نصب نشده)',
  'voice.reset':
    '✅ صدای تو به حالت پیش‌فرض بازگشت. هر وقت خواستی با `/voice list` و `/voice set` یکی دیگر انتخاب کن.',
  'voice.optout':
    'دیگر به‌طور خودکار خوانده نمی‌شوی. برای روشن کردن دوباره /voice opt-in را اجرا کن.',
  'voice.optin': 'دوباره به‌طور خودکار خوانده می‌شوی.',
  'voice.detection.on':
    '✅ تشخیص خودکار زبان روشن است: هر پیام با صدایی متناسب با زبانِ تشخیص‌داده‌شده‌اش خوانده می‌شود (ممکن است گوینده تغییر کند). با `/voice detection active:false` خاموشش کن.',
  'voice.detection.off':
    '✅ تشخیص خودکار زبان خاموش است: صدای ثابتِ تو همه‌چیز را می‌خواند، پس همیشه یک‌جور به نظر می‌رسی.',
  'voice.notInVoice': 'هنوز در کانال صوتی نیستم — اول /join را اجرا کن.',
  'voice.previewPlaying': 'در حال پخش یک نمونه…',
  'preview.sample': 'سلام، من ووکسی هستم. بنویسش، بشنوش.',
  'laugh.playing': 'هاها! دارم آن را با صدای تو پخش می‌کنم…',
  'joke.playing': 'در حال گفتن یک جوک…\n> {joke}',
  'joke.unknownLang': 'این زبان را نمی‌شناسم. یکی از فهرست انتخاب کن.',
  'voice.abbrev.added': 'گرفتمش — {term} به‌صورت {replacement} خوانده خواهد شد.',
  'voice.abbrev.removed': 'کوته‌نوشت تو برای {term} حذف شد.',
  'voice.abbrev.listHeader': 'کوته‌نوشت‌های شخصی تو ({count}/{cap} استفاده‌شده):',
  'voice.abbrev.listEmpty': '(هنوز هیچ‌کدام — با /voice abbrev add یکی اضافه کن)',
  'voice.abbrev.capReached':
    'به سقف {cap} کوته‌نوشت شخصی رسیدی. قبل از افزودن یکی دیگر، یکی را حذف کن.',
  'voice.abbrev.invalidTerm': 'اصطلاح باید یک کلمهٔ واحد باشد (فقط حروف و ارقام)، حداکثر 50 نویسه.',
  'voice.abbrev.emptyReplacement': 'متن خواندن نمی‌تواند خالی باشد.',
  'voice.abbrev.tooLong': 'متن خواندن خیلی بلند است (حداکثر 200 نویسه).',
  'config.wordEmpty': 'کلمه نمی‌تواند خالی باشد.',
  'config.blocked': 'مسدود شد: {word}.',
  'config.unblocked': 'رفع مسدودی شد: {word}.',
  'config.pronListHeader': 'واژه‌نامهٔ تلفظ:',
  'config.pronEmptyValue': '(خالی)',
  'config.listEmpty': '(هیچ‌کدام)',
  'config.termEmpty': 'اصطلاح نمی‌تواند خالی باشد.',
  'config.pronEmpty': 'تلفظ نمی‌تواند خالی باشد.',
  'config.pronSet': 'گرفتمش — {term} به‌صورت {replacement} خوانده خواهد شد.',
  'config.pronRemoved': 'تلفظ {term} حذف شد.',
  'config.channelWrongType': 'یک کانال متنی انتخاب کن (نه کانال صوتی یا دسته‌بندی).',
  'config.channelNoAccess': 'نمی‌توانم {channel} را ببینم — لطفاً مجوزهای من را آنجا بررسی کن.',
  'config.channelSet':
    'کانال خواندن خودکار روی {channel} تنظیم شد. بعدی: با `/config auto-read active:true` مطمئن شو که خواندن خودکار روشن است.',
  'config.autoreadOn': 'خواندن خودکار حالا **روشن** است.',
  'config.autoreadOff': 'خواندن خودکار حالا **خاموش** است.',
  'config.maxCharsRange': 'مقدار حداکثر نویسه باید بین 1 و 2000 باشد.',
  'config.maxCharsSet': 'حداکثر نویسه در هر پیام روی {value} تنظیم شد.',
  'config.rateLimitRange': 'مقدار محدودیت نرخ باید بین 1 و 120 باشد.',
  'config.rateLimitSet': 'محدودیت نرخ روی {value} پیام در دقیقه تنظیم شد.',
  'config.roleSet': 'خواندن خودکار حالا فقط به اعضای دارای {role} محدود شد.',
  'config.roleCleared': 'محدودیت نقش برداشته شد — حالا همه می‌توانند خوانده شوند.',
  'config.enabledOn': 'تبدیل متن به گفتار حالا برای این سرور **روشن** است.',
  'config.enabledOff': 'تبدیل متن به گفتار حالا برای این سرور **خاموش** است.',
  'config.defaultVoiceSet':
    '✅ صدای پیش‌فرض سرور روی **{name}** تنظیم شد. اعضایی که صدای خودشان را ندارند این را می‌شنوند. (شناسه: `{model}`)',
  'config.reset': 'پیکربندی به پیش‌فرض‌ها بازگشت. فهرست مسدودی و تلفظ‌های تو حفظ شدند.',
  'config.showTitle': '**پیکربندی سرور**',
  'config.showChannel': 'کانال تبدیل متن به گفتار: {value}',
  'config.showAutoread': 'خواندن خودکار: {value}',
  'config.showRole': 'نقش: {value}',
  'config.showEnabled': 'فعال: {value}',
  'config.showVoice': 'صدای پیش‌فرض: {value}',
  'config.showMaxChars': 'حداکثر نویسه: {value}',
  'config.showRateLimit': 'محدودیت نرخ: {value}/دقیقه',
  'config.showBlocklist': 'فهرست مسدودی: {count} کلمه',
  'config.showPronunciation': 'تلفظ‌ها: {count} مورد',
  'config.valueNone': '(هیچ‌کدام)',
  'config.valueAny': 'هرکسی',
  'config.valueAutoDetect': '(تشخیص خودکار)',
  'config.on': 'روشن',
  'config.off': 'خاموش',
  'config.language.set': 'زبان رابط روی {language} تنظیم شد.',
  'config.language.unsupported': 'این زبان هنوز پشتیبانی نمی‌شود.',
  'setup.noChannel':
    'نتوانستم تشخیص دهم کدام کانال را استفاده کنم. یک کانال متنی را در گزینهٔ "channel" وارد کن.',
  'setup.channelWrongType':
    'کانال خواندن خودکار باید یک کانال متنی باشد (نه کانال صوتی یا دسته‌بندی). یکی را در گزینهٔ "channel" وارد کن.',
  'setup.done': '**همه‌چیز آماده است — ووکسی حاضر است.**',
  'setup.channelLine': 'کانال خواندن خودکار: {channel}',
  'setup.autoreadOn': 'خواندن خودکار: روشن',
  'setup.permsHeader': '**مجوزها:**',
  'setup.permView': 'ViewChannel (دیدن کانال متنی)',
  'setup.permSend': 'SendMessages (ارسال پیام در کانال متنی)',
  'setup.permConnect': 'Connect (پیوستن به کانال صوتی)',
  'setup.permSpeak': 'Speak (صحبت در کانال صوتی)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — موجود نیست',
  'setup.permUnchecked': '⏳ {label} — هنوز بررسی نشده (هنگام /join بررسی‌اش می‌کنم)',
  'setup.fixHint':
    'برای رفع موارد کم: در تنظیمات سرورت نقش ووکسی (یا مجوزهای کانال) را باز کن و موارد نشان‌دار با ❌ را فعال کن.',
  'setup.voiceUncheckedNote':
    'تو در کانال صوتی نیستی، برای همین هنوز نتوانستم اتصال/صحبت را بررسی کنم — وقتی /join را اجرا کنی بررسی‌شان می‌کنم.',
  'setup.allGood': 'همه‌چیز آماده است. وارد یک کانال صوتی شو و /join را اجرا کن.',
  'setup.joinedVoice': 'من هم به {channel} پیوستم — نیازی به اجرای /join نیست.',
  'setup.readyTalk': 'همه‌چیز آماده است. در کانال خواندن خودکار بنویس تا با صدای بلند بخوانمش.',
  'setup.membersHeader': '**به اعضایت بگو (روند ۳ گامی):**',
  'setup.membersBody':
    '۱) وارد یک کانال صوتی شو\n۲) /join را اجرا کن تا من هم بیایم\n۳) در این کانال بنویس (یا از /tts استفاده کن) تا با صدای بلند بخوانمش\nفهرست کامل دستورها: /help',
  'stats.title': '**آمار ووکسی**',
  'stats.messagesSpoken': 'پیام‌های خوانده‌شده: {value}',
  'stats.cacheHits': 'برخوردهای حافظهٔ نهان: {value}',
  'stats.cacheMisses': 'عدم‌برخوردهای حافظهٔ نهان: {value}',
  'stats.synthErrors': 'خطاهای سنتز: {value}',
  'stats.voiceDrops': 'قطعی‌های صوتی: {value}',
  'stats.voiceReconnects': 'اتصال‌های مجدد: {value}',
  'stats.votes': 'رأی‌های top.gg: {value}',
  'stats.activePlayers': 'پخش‌کننده‌های فعال: {value}',
  'stats.servers': 'سرورها: {value}',
  'stats.uptime': 'زمان فعالیت: {value} ثانیه',
  'invite.noClientId':
    'لینک دعوت ووکسی هنوز تنظیم نشده (CLIENT_ID موجود نیست). به مدیر ربات اطلاع بده.',
  'invite.link': 'ووکسی را به سرورت اضافه کن:\n{url}',
  'vote.noClientId':
    'لینک رأی ووکسی هنوز تنظیم نشده (CLIENT_ID موجود نیست). به مدیر ربات اطلاع بده.',
  'vote.link':
    'به ووکسی رأی بده (رایگان، هر ۱۲ ساعت) و کمک کن افراد بیشتری پیدایش کنند:\n{url}\nاگر این حساب هرگز پاداش را دریافت نکرده باشد، **۴۸ ساعت Vozen Plus** می‌گیرد، فقط یک بار برای هر حساب.',
  'help.title': 'ووکسی — بنویسش، بشنوش.',
  'help.embedTitle': 'ووکسی — دستورها',
  'help.intro':
    'ووکسی متن تو را در کانال‌های صوتی با صدای بلند می‌خواند — صداهای عصبی رایگان، ده‌ها زبان.',
  'help.quickStartTitle': 'شروع سریع (۳ گام)',
  'help.quickStartBody':
    '۱) وارد یک کانال صوتی شو، بعد /join را اجرا کن\n۲) در کانال متنی بنویس (یا از /tts Hello everyone! استفاده کن)\n۳) (اختیاری) با /voice set یک صدا انتخاب کن',
  'help.groupStarted': 'شروع کار',
  'help.groupStartedBody':
    '• /join — به کانال صوتی تو می‌پیوندم\n• /leave — از کانال صوتی خارج می‌شوم\n• /tts <text> — متن را با صدای بلند می‌خوانم · مثلاً /tts Hello everyone!\n• /skip — از چیزی که همین حالا می‌خوانم رد شو',
  'help.groupVoice': 'صدای تو',
  'help.groupVoiceBody':
    '• /voice set <model> — صدایت را انتخاب کن · مثلاً /voice set en_US-amy-medium\n• /voice list — صداهای موجود را ببین\n• /voice preview — یک نمونه از صدایت را بشنو\n• /voice reset — به صدای پیش‌فرض بازگرد\n• /voice opt-out · /voice opt-in — خواندن خودکار را برای خودت خاموش / روشن کن\n• /voice abbrev add|remove|list — اصطلاح شخصی، به سبک خودت خوانده شود (تا ۱۰ تا)',
  'help.groupFun': 'سرگرمی',
  'help.groupFunBody':
    '• /joke — یک جوک کوتاه می‌گویم (یک زبان + خندهٔ اختیاری انتخاب کن) · مثلاً /joke English\n• /laugh — با صدای فعلی تو با صدای بلند می‌خندم',
  'help.groupAdmin': 'مدیریت سرور (به مجوز مدیریت سرور نیاز دارد)',
  'help.groupAdminBody':
    '• /setup — پیکربندی راهنمایی‌شدهٔ یک‌مرحله‌ای · اول این را اجرا کن\n• /config — خواندن خودکار، کانال tts، زبان، صدای پیش‌فرض، کلمهٔ مسدود، تلفظ،\n  محدودیت نرخ، نقش، حداکثر نویسه، فعال‌سازی · مثلاً /config tts-channel #general\n• /stats — آمار ربات',
  'help.groupMore': 'بیشتر',
  'help.groupMoreBody':
    '• /invite — ووکسی را به سرور دیگری اضافه کن\n• /vote — در top.gg به ووکسی رأی بده\n• /help — نمایش همین راهنما',
  'help.footer': 'تازه‌واردی؟ برای شروع {command} را اجرا کن.',
  'welcome.title': 'ممنون که ووکسی را اضافه کردی! 👋',
  'welcome.description':
    'ووکسی گفتگوی تو را در کانال‌های صوتی با صدای بلند می‌خواند — بنویسش، بشنوش.\n\n**در یک گام شروع کن:** {setup} را اجرا کن تا خواندن خودکار را تنظیم کنم و به کانال صوتی‌ات بپیوندم.\n\nفهرست کامل دستورها را می‌خواهی؟ {help} را اجرا کن.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'اعضا چطور از آن استفاده می‌کنند (۳ گام)',
  'welcome.stepsBody':
    '۱) وارد یک کانال صوتی شو\n۲) /join را اجرا کن تا به تو بپیوندم\n۳) در کانال متنی بنویس (یا از /tts استفاده کن) تا با صدای بلند بخوانمش\nفهرست کامل دستورها: /help',
  'welcome.footer': 'ووکسی — بنویسش، بشنوش.',
  'welcome.tagline': 'صدای عصبی طبیعی — همیشه رایگان، بدون پرداخت.',

  // ── /transcribe (STT) ──
  'stt.guildOnly': 'رونویسی فقط داخل یک سرور کار می‌کند.',
  'stt.noManage': 'برای شروع یا توقف رونویسی به مجوز **مدیریت سرور** نیاز داری.',
  'stt.notPremium':
    '🎙️ رونویسی زنده یک ویژگی **پریمیوم** است. برای فعال‌سازی آن در این سرور `/premium info` را ببین.',
  'stt.unavailable': 'رونویسی روی این نمونه در دسترس نیست (موتور تبدیل گفتار به متن نصب نشده است).',
  'stt.notInVoice':
    'من در کانال صوتی نیستم — اول وارد یکی شو و `/join` را اجرا کن، بعد رونویسی را شروع کن.',
  'stt.alreadyRunning':
    'رونویسی از پیش روی این سرور در حال اجراست. اول از `/transcribe stop` استفاده کن.',
  'stt.atCapacity':
    'همین حالا رونویسی‌های زیادی در همهٔ سرورها در حال اجراست. لطفاً کمی بعد دوباره امتحان کن.',
  'stt.noChannel':
    'نمی‌توانم رونویسی‌ها را در این کانال بفرستم. دستور را از یک کانال متنی عادی اجرا کن.',
  'stt.started':
    '✅ رونویسی شروع شد. هر کسی که در اعلان روی **رضایت** بزند، گفتارش در این کانال رونویسی می‌شود.',
  'stt.startFailed':
    'نتوانستم رونویسی را شروع کنم (ارسال اعلان ناموفق بود). همه‌چیز را برگرداندم — هیچ‌چیز ضبط نمی‌شود. لطفاً دوباره امتحان کن.',
  'stt.announceStart':
    '🎙️ **رونویسی زنده در این کانال روشن است.** فقط گفتار افرادی که رضایت می‌دهند رونویسی می‌شود — برای اجازهٔ نوشتن گفتارت اینجا، دکمهٔ زیر را بزن. هر وقت خواستی می‌توانی با `/transcribe revoke` رضایتت را پس بگیری.',
  'stt.consentBtn': 'رضایت به رونویسی',
  'stt.consentThanks':
    '✅ ممنون — گفتارت از این پس در این سرور رونویسی می‌شود. هر وقت خواستی با `/transcribe revoke` پسش بگیر.',
  'stt.stopped': '🛑 رونویسی متوقف شد.',
  'stt.notRunning': 'رونویسی روی این سرور در حال اجرا نیست.',
  'stt.announceStop': '🛑 **رونویسی زنده حالا خاموش است.** دیگر گوش نمی‌دهم.',
  'stt.revoked':
    '✅ رضایت پس گرفته شد — دیگر در این سرور رونویسی نمی‌شوی. (پیام‌هایی که تا الان فرستاده شده باقی می‌مانند؛ اگر خواستی خودت در دیسکورد پاکشان کن.)',
  'stt.revokeNone': 'تو در این سرور به رونویسی رضایت نداده بودی، پس چیزی برای پس گرفتن نبود.',

  // ── /privacy erase ──
  'privacy.eraseConfirm':
    '⚠️ این کار **همهٔ** داده‌های تو در ووکسی را در تمام سرورها برای همیشه پاک می‌کند: تنظیمات صدا، نام مستعار گفتاری، کوته‌نوشت‌ها و تلفظ‌های شخصی، تاریخ تولد ذخیره‌شده، امتیازهای بازی، آمار گفتار، و انصراف از خواندن. **این کار قابل بازگشت نیست.** مطمئنی؟',
  'privacy.erasePremiumNote':
    '_توجه: پریمیوم/پلاس پولی‌ات و سابقهٔ خریدش حفظ می‌شوند — این‌ها به تو و به سوابق مالی الزامیِ قانونی تعلق دارند. برای توقف پریمیوم، بگذار منقضی شود یا با پشتیبانی تماس بگیر._',
  'privacy.eraseYes': 'پاک کردن همه‌چیز',
  'privacy.eraseNo': 'لغو',
  'privacy.eraseCancelled': 'لغو شد — چیزی پاک نشد.',
  'privacy.eraseDone': '✅ انجام شد. همهٔ داده‌های شخصی‌ات برای همیشه پاک شد.',

  // ── /shut-up ──
  'shutup.notInVoice': 'هنوز در کانال صوتی نیستم — اول وارد یکی شو و /join را اجرا کن.',
  'shutup.nothing': 'الان چیزی در حال پخش نیست.',
  'shutup.done': '🤐 باشه، ساکت می‌شوم — همهٔ صف را پاک کردم.',

  // ── /voice nickname · effect ──
  'voice.nickname.set': '✅ ووکسی از این پس تو را با صدای بلند **{name}** صدا می‌زند.',
  'voice.nickname.cleared': '✅ نام مستعار گفتاری پاک شد — ووکسی از نام سرورت استفاده می‌کند.',
  'voice.nickname.invalid':
    'این نام چیز قابل‌خواندنی برای گفتن با صدای بلند ندارد. حروف یا اعداد را امتحان کن.',
  'voice.effect.set':
    '✅ افکت صدا روی **{effect}** تنظیم شد — پیام‌هایت از این پس با آن افکت پخش می‌شوند. برای خاموش کردن از `/voice effect none` استفاده کن.',
  'voice.effect.cleared': '✅ افکت صدا حذف شد — دوباره صدای بدون افکت.',

  'voice.effect.locked':
    '🔒 **{effect}** یک افکت پریمیوم است. افکت‌های رایگان: 🤖 Robot و 🔊 Echo. همه را با ووکسی پریمیوم باز کن — `/premium` را ببین.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** یک موتور صدای پریمیوم است. آن را با ووکسی پلاس (شخصی) یا ووکسی پریمیوم (سرور) باز کن — `/premium` را ببین. در این مدت صدای تو روی موتور محلی رایگان می‌ماند.',

  // ── /rizz ──
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** یک موتور صدای پریمیوم است. آن را با ووکسی پلاس (شخصی) یا ووکسی پریمیوم (سرور) باز کن — `/premium` را ببین. در این مدت صدای تو روی موتور محلی رایگان می‌ماند.',

  // ── /rizz ──
  'rizz.playing': '😏 دارم مخ می‌زنم…\n> {line}',
  'rizz.unknownLang': 'این زبان را نمی‌شناسم. یکی از فهرست انتخاب کن.',
  'rizz.locked':
    '🔒 **/rizz** یک امکان پریمیوم است. آن را با ووکسی پلاس (برای خودت) یا پریمیوم (این سرور) باز کن. `/premium` را ببین.',

  // ── /sound ──
  'sound.playing': '🔊 در حال پخش **{name}**…',
  'sound.unknown': 'این صدا را ندارم. برای دیدن فهرست `/sound` را اجرا کن.',
  'sound.list':
    '🔊 **صداها:** {sounds}\nیکی را با `/sound name:<sound>` پخش کن (باید در کانال صوتی‌ات باشم).',
  'sound.disabled':
    '🔇 ساندبورد در این سرور **خاموش** است. یک مدیر می‌تواند با `/config soundboard` آن را روشن کند.',

  // ── micro-fun ──
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',

  // ── /birthday ──
  'birthday.set':
    '🎂 تاریخ تولد ذخیره شد: **{day}/{month}**. آن روز وقتی وارد یک کانال صوتی شوی، تولدت را تبریک می‌گویم!',
  'birthday.invalid': 'این تاریخ واقعی نیست. روز و ماه را بررسی کن.',
  'birthday.cleared': '🎂 تاریخ تولد حذف شد.',
  'birthday.show': '🎂 تاریخ تولد تو روی **{day}/{month}** تنظیم شده است.',
  'birthday.none': 'هنوز تاریخ تولدی تنظیم نکرده‌ای. از `/birthday set` استفاده کن.',

  // ── /top-speakers ──
  'topspeakers.title':
    '🗣️ **پرگوترین‌ها** — کسانی که در این سرور بیشترین پیام‌هایشان را خوانده‌ام:',
  'topspeakers.empty': 'هنوز پیام کسی را نخوانده‌ام. با `/setup` یک کانال خواندن راه‌اندازی کن!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** پیام · 🔥 زنجیرهٔ {streak} روزه',

  // ── /server-stats ──
  'serverstats.title': '📊 **آمار سرور**',
  'serverstats.empty':
    'هنوز آماری نیست — اینجا نه پیامی خوانده‌ام و نه بازی‌ای اجرا کرده‌ام. با `/setup` راه‌اندازی کن!',
  'serverstats.messages': '🗣️ **{total}** پیام خوانده‌شده · **{speakers}** نفر',
  'serverstats.topTalkers': '**پرحرف‌ترین‌ها:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} پیام · 🔥 {streak} روز',
  'serverstats.streak': '🔥 بلندترین زنجیرهٔ فعال: **{days}** روز',
  'serverstats.games': '🎮 **{points}** امتیاز بازی · **{wins}** برد · **{players}** بازیکن',
  'serverstats.topPlayers': '**بهترین بازیکنان:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} امتیاز · {wins} برد',
  'serverstats.upsell':
    '🔒 این پیش‌نمایش رایگان است. **پریمیوم** زنجیره‌ها، آمار بازی و پنج‌تای برتر کامل را باز می‌کند — `/premium` را ببین.',
  'streak.day':
    '🔥 <@{user}> در یک زنجیرهٔ **{n} روزه** است! برای زنده نگه‌داشتنش به صحبت ادامه بده.',
  'leaderboard.autoTitle': '🏆 پرحرف‌ترین‌های این سرور',

  // ── /premium & /redeem ──
  'premium.title': '💎 **وضعیت ووکسی پریمیوم**',
  'premium.lineServerActive': '🖥️ **سرور:** پریمیوم تا {date}',
  'premium.lineServerFree': '🖥️ **سرور:** پلن رایگان',
  'premium.lineUserActive': '👤 **تو (پلاس):** فعال تا {date}',
  'premium.lineUserFree': '👤 **تو (پلاس):** غیرفعال',
  'premium.getHint':
    'هر چیزی که امروز استفاده می‌کنی رایگان می‌ماند. پریمیوم هر 8 افکت صدا، حضور 24/7 در تماس، 50 تلفظ شخصی، /rizz و بازی‌های پریمیوم را اضافه می‌کند. حمایت: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass': '🎟️ **پاس پریمیوم تو:** {used}/{total} لایسنس در حال استفاده · انقضا {date}',
  'premium.passServers': '↳ در حال استفاده در: {servers}',
  'premium.pitch':
    'هنوز پریمیوم نداری. **ووکسی پریمیوم** (€3.99 در ماه برای 3 سرور، یا €7.99 در ماه برای 8) برای کل سرور باز می‌کند: هر 8 افکت صدا، حضور 24/7 در تماس، 50 تلفظ شخصی (به‌جای 3)، دستور /rizz و بازی‌های پریمیوم (زنجیرهٔ کلمات، وردل، شطرنج). **ووکسی پلاس** (€1.99 در ماه) این امکانات را به‌صورت شخصی، در هر سروری، به تو می‌دهد.',
  'premium.buyHint':
    '▶ **تهیهٔ پریمیوم:** {link}\nپس از خرید، `/premium activate` را در سروری که می‌خواهی اجرا کن.',
  'premium.confirmActivate':
    '**1 لایسنس از {total} لایسنس پریمیوم** خود را روی **این سرور** استفاده کنی؟ همین حالا **{used}** لایسنس در حال استفاده داری. بعداً می‌توانی با `/premium deactivate` آزادش کنی — در هر صورت زمان پاس همچنان می‌گذرد.',
  'premium.confirmYes': '💎 استفاده از لایسنس',
  'premium.confirmNo': 'لغو',
  'premium.activateOk':
    '✅ پریمیوم حالا روی **این سرور** تا {date} فعال است. لایسنس‌ها: **{used}/{total}** در حال استفاده.',
  'premium.activateCancelled': 'لغو شد — هیچ لایسنسی استفاده نشد.',
  'premium.activateTimeout': 'زمان تمام شد — هیچ لایسنسی استفاده نشد.',
  'premium.noPass':
    'پاس پریمیوم فعالی نداری. یکی تهیه کن تا روی حسابت بنشیند — بعد `/premium activate` را اینجا اجرا کن.\n▶ {link}',
  'premium.alreadyActive': 'این سرور از پیش یکی از لایسنس‌های پریمیوم تو را دارد. کاری لازم نیست.',
  'premium.noSeats':
    'همهٔ **{total}** لایسنس پریمیوم تو در حال استفاده‌اند ({servers}). یکی را آنجا با `/premium deactivate` آزاد کن، بعد دوباره اینجا امتحان کن.',
  'premium.needManageGuild':
    'فعال‌سازی پریمیوم روی کل سرور اثر می‌گذارد — فقط اعضای دارای **مدیریت سرور** می‌توانند این کار را بکنند. از یک مدیر بخواه.',
  'premium.deactivateOk':
    '✅ لایسنس پریمیوم این سرور آزاد شد. آن را با `/premium activate` روی سرور دیگری استفاده کن.',
  'premium.deactivateNone': 'این سرور هیچ لایسنس پریمیومی از تو ندارد که آزاد شود.',
  'premium.thisServer': 'این سرور',
  'grant.denied': '⛔ این دستور فقط برای مالک ربات است.',
  'grant.okPremium':
    '✅ به <@{user}> یک **پاس پریمیوم** ({seats} لایسنس) برای **{days}** روز داده شد — انقضا {date}. آن را با `/premium activate` فعال می‌کند.',
  'grant.okPlus': '✅ به <@{user}> **ووکسی پلاس** برای **{days}** روز داده شد — انقضا {date}.',
  'gencode.done':
    '✅ **{count}** کد {plan} ساخته شد، هرکدام **{days}** روز. آن‌ها را به‌صورت خصوصی به اشتراک بگذار:\n{list}',
  'redeem.okPlus': '🎁 اعمال شد! **ووکسی پلاس** را برای **{days}** روز گرفتی — انقضا {date}.',
  'redeem.okPremium':
    '🎁 اعمال شد! یک **پاس پریمیوم** ({seats} لایسنس) برای **{days}** روز گرفتی — انقضا {date}. آن را در سرورت با `/premium activate` فعال کن.',
  'redeem.notFound': '❌ این کد وجود ندارد. دوباره بررسی‌اش کن و امتحان کن.',
  'redeem.used': '❌ این کد قبلاً اعمال شده است.',
  'redeem.expired': '❌ این کد منقضی شده است.',

  // ── /config (extras) ──
  'config.blockLimit':
    'این سرور از پیش حداکثرِ {max} کلمهٔ مسدود را دارد. قبل از افزودن یکی دیگر، یکی را حذف کن.',
  'config.xsaidOn':
    'ووکسی از این پس قبل از هر پیام **گویندهٔ آن** را اعلام می‌کند (مثلاً «Alex گفت سلام»). با `/config x-said active:false` خاموشش کن.',
  'config.xsaidOff': 'ووکسی **دیگر** گویندهٔ پیام را اعلام نمی‌کند — فقط خودِ پیام را می‌خواند.',
  'config.autojoinOn':
    '✅ پیوستن خودکار **روشن** — وقتی در کانال TTS بنویسی، ووکسی به کانال صوتی‌ات می‌پیوندد.',
  'config.autojoinOff': 'پیوستن خودکار **خاموش** — برای آوردن ووکسی به صوت از `/join` استفاده کن.',
  'config.stayOn':
    '✅ حضور 24/7 در تماس **روشن** — ووکسی حتی وقتی کانال صوتی خالی شود در آن می‌ماند و پس از راه‌اندازی مجدد برمی‌گردد. 💎 برای اثرگذاری به پریمیوم نیاز دارد (بخر یا یک کد را `/redeem` کن، بعد `/premium activate`).',
  'config.stayOff':
    'حضور 24/7 در تماس **خاموش** — وقتی کانال صوتی خالی شود ووکسی خارج می‌شود (پیش‌فرض).',
  'config.readBotsOn': '✅ ووکسی از این پس پیام‌های **ربات‌ها و وب‌هوک‌های دیگر** را هم می‌خواند.',
  'config.readBotsOff':
    'ووکسی ربات‌ها و وب‌هوک‌های دیگر را **نادیده می‌گیرد** (فقط افراد واقعی خوانده می‌شوند).',
  'config.textInVoiceOn': '✅ ووکسی همچنین **چت متنی داخل کانال صوتی‌اش** را هم می‌خواند.',
  'config.textInVoiceOff': 'ووکسی چت متنی کانال صوتی را **نمی‌خواند** (فقط کانال TTS).',
  'config.antispamOn':
    '✅ ضداسپم **روشن** — ووکسی پیام‌های اسپم را نمی‌خواند (تکرار انبوه یک کلمه یا ارسال مکرر همان پیام بزرگ).',
  'config.antispamOff': 'ضداسپم **خاموش** — ووکسی مثل همیشه همهٔ پیام‌ها را می‌خواند.',
  'config.streaksOn':
    '✅ اعلان زنجیره **روشن** — ووکسی اولین باری که هر کس هر روز صحبت می‌کند، پیام زنجیرهٔ 🔥 روزانه را نشان می‌دهد.',
  'config.streaksOff':
    'اعلان زنجیره **خاموش** — ووکسی همچنان زنجیره‌ها را می‌شمارد (به `/top-speakers` نگاه کن) اما دربارهٔ آن‌ها ساکت می‌ماند.',
  'config.soundboardOn': 'ساندبورد **روشن** — هرکسی می‌تواند با `/sound` کلیپ پخش کند.',
  'config.soundboardOff': 'ساندبورد **خاموش** — `/sound` در این سرور غیرفعال است.',
  'config.votePromosLabel': 'اعلان‌های پاداش top.gg + Vozen Support',
  'config.greetOn': '✅ وقتی افراد وارد کانال صوتی شوند، آن‌ها را با نام خوش‌آمد می‌گویم.',
  'config.greetOff': '🔇 وقتی افراد وارد کانال صوتی شوند، به آن‌ها خوش‌آمد **نمی‌گویم**.',
  'config.greetLangSet': '✅ زبان خوش‌آمدِ ورود روی **{language}** تنظیم شد.',
  'config.showXsaid': 'اعلام گوینده (xsaid): {value}',
  'config.showAutojoin': 'پیوستن خودکار: {value}',
  'config.showReadBots': 'خواندن ربات‌ها/وب‌هوک‌ها: {value}',
  'config.showTextInVoice': 'متن در صوت: {value}',
  'config.showAntispam': 'ضداسپم: {value}',
  'config.showSoundboard': 'ساندبورد (/sound): {value}',
  'config.showGreet': 'خوش‌آمد هنگام ورود: {value} ({language})',

  // ── /stats · /speak · /uptime · /bot-stats ──
  'stats.synthLatency': 'تأخیر سنتز: p50 {p50}ms / p95 {p95}ms ({count} نمونه)',
  'speak.emptyMessage': 'این پیام متنی برای خواندن با صدای بلند ندارد.',
  'uptime.text': '🟢 ووکسی به مدت **{uptime}** آنلاین بوده است.',
  'botstats.title': '📊 **ووکسی — آمار**',
  'botstats.servers': 'سرورها: **{value}**',
  'botstats.voiceSessions': 'نشست‌های صوتی فعلی: **{value}**',
  'botstats.messagesSpoken': 'پیام‌های خوانده‌شده: **{value}**',
  'botstats.uptime': 'زمان فعالیت: **{value}**',

  // ── /invite · /vote (extras) ──
  'invite.button': 'افزودن ووکسی',
  'vote.button': 'رأی در top.gg',
  'vote.upsell':
    '🗳️ اگر این حساب هرگز پاداش را دریافت نکرده باشد، **۴۸ ساعت Vozen Plus** می‌گیرد، فقط یک بار برای هر حساب. {url}',
  'vote.cooldownStatus':
    '🗳️ این حساب قبلاً پاداش یک‌بارهٔ رأی را استفاده کرده است. هنوز می‌توانید برای حمایت از Vozen رأی دهید، اما Plus بیشتری دریافت نمی‌کنید.',

  // ── /help (extras) ──
  'help.support': '🛟 به کمک نیاز داری یا می‌خواهی مشکلی را گزارش کنی؟ {url}',
  'help.source': '📄 متن‌باز (AGPL-3.0) — کد دقیقی که اینجا اجرا می‌شود را بگیر: {url}',

  // ── /game — chrome ──
  'game.start.needVoice':
    'این یک **بازی صوتی** است — اول وارد یک کانال صوتی شو و /join را اجرا کن، بعد شروعش کن.',
  'game.start.alreadyActive':
    'یک بازی از پیش در <#{channel}> در حال اجراست. قبل از شروع بازی دیگر، آن را تمام کن (یا از `/game stop` استفاده کن).',
  'game.start.premiumLocked':
    '🔒 **{game}** یک بازی پریمیوم است (پردازش واقعی مصرف می‌کند). `/premium` را ببین.',
  'game.start.started': '🎮 شروع **{game}**! حواست به کانال باشد — موفق باشی!',
  'game.start.startedThread':
    '🎮 **{game}** در <#{channel}> شروع شد — همان‌جا بپیوند! وقتی بازی تمام شود، ترد خودش پاک می‌شود.',
  'game.thread.winner': '🏆 {winner} برندهٔ بازی شد!',
  'game.thread.ended': '🎮 بازی تمام شد.',
  'game.unknownGame': 'این بازی را نمی‌شناسم. یکی از فهرست انتخاب کن.',
  'game.stop.ok': '🛑 بازی فعلی متوقف شد.',
  'game.stop.none': 'الان هیچ بازی‌ای در حال اجرا نیست.',
  'game.list.title': '🎮 **بازی‌ها** — یکی را با `/game play` شروع کن:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **جدول امتیازها** — بهترین بازیکنان این سرور:',
  'game.leaderboard.empty': 'هنوز هیچ بازی‌ای انجام نشده. اولین نفر باش — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** امتیاز ({wins} برد)',
  'game.finish.title': '🏁 **بازی تمام شد!** امتیازهای نهایی:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 بازی تمام شد — این بار کسی امتیاز نگرفت. دفعهٔ بعد!',
  'game.finish.winnerVoice': '{user} برنده شد!',

  // ── Guess the Language ──
  'game.guessLanguage.name': 'زبان را حدس بزن',
  'game.guessLanguage.desc':
    'یک جمله را به زبانی تصادفی می‌خوانم — اولین کسی که نامش را بگوید امتیاز را می‌برد.',
  'game.guessLanguage.intro':
    '🗣️ **زبان را حدس بزن** — {rounds} جمله می‌خوانم. بنویس چه زبانی می‌شنوی. سریع‌ترین پاسخ درست، هر دور را می‌برد!',
  'game.guessLanguage.round': '🎧 دور {n}/{total} — گوش کن…',
  'game.guessLanguage.correct': '✅ **{user}** درست گفت — **{language}** بود!',
  'game.guessLanguage.timeout': '⏱️ وقت تمام! آن **{language}** بود.',
  'game.guessLanguage.noLanguages':
    'برای این بازی صداهای کافی نصب ندارم. از یک مدیر بخواه صداهای بیشتری اضافه کند.',

  // ── Mental Math ──
  'game.math.name': 'حساب ذهنی',
  'game.math.desc': 'یک محاسبه را با صدای بلند می‌گویم — اولین کسی که پاسخ را بنویسد می‌برد.',
  'game.math.intro': '🔢 **حساب ذهنی** — {rounds} محاسبه. گوش کن و پاسخ را هر چه سریع‌تر بنویس!',
  'game.math.round': '🧮 دور {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** درست زد — پاسخ **{answer}** بود!',
  'game.math.timeout': '⏱️ وقت تمام! پاسخ **{answer}** بود.',
  'game.math.plus': 'به‌علاوه',
  'game.math.minus': 'منهای',
  'game.math.times': 'ضرب در',

  // ── Missing Number ──
  'game.skipCount.name': 'عدد جاافتاده',
  'game.skipCount.desc':
    'با صدای بلند می‌شمارم اما یک عدد را جا می‌اندازم — اولین کسی که آن را بگیرد می‌برد.',
  'game.skipCount.intro':
    '🔢 **عدد جاافتاده** — می‌شمارم، اما یکی را جا می‌اندازم. عدد جاافتاده را بنویس! ({rounds} دور)',
  'game.skipCount.round': '👂 دور {n}/{total} — کدام عدد را جا انداختم؟',
  'game.skipCount.correct': '✅ **{user}** گرفتش — من **{answer}** را جا انداختم!',
  'game.skipCount.timeout': '⏱️ وقت تمام! من **{answer}** را جا انداختم.',

  // ── Spelling Bee ──
  'game.spelling.name': 'مسابقهٔ املا',
  'game.spelling.desc': 'یک کلمه می‌گویم — اولین کسی که درست بنویسدش می‌برد.',
  'game.spelling.intro': '✍️ **مسابقهٔ املا** — {rounds} کلمه می‌گویم. هر کدام را درست بنویس!',
  'game.spelling.round': '🗣️ دور {n}/{total} — کلمه‌ای که می‌گویم را بنویس…',
  'game.spelling.correct': '✅ **{user}** کلمهٔ **{word}** را درست نوشت!',
  'game.spelling.timeout': '⏱️ وقت تمام! کلمه **{word}** بود.',
  'game.spelling.empty': 'هنوز برای زبان صدای این سرور فهرست کلمات ندارم.',

  // ── Unscramble the Spelling ──
  'game.spellOut.name': 'حروف را بچین',
  'game.spellOut.desc': 'یک کلمه را حرف‌به‌حرف هجی می‌کنم — اولین کسی که کل کلمه را بنویسد می‌برد.',
  'game.spellOut.intro':
    '🔡 **حروف را بچین** — {rounds} کلمه را حرف‌به‌حرف هجی می‌کنم. کلمهٔ کامل را بنویس!',
  'game.spellOut.round': '🔤 دور {n}/{total} — به حروف گوش کن…',
  'game.spellOut.correct': '✅ **{user}** درست گفت — **{word}**!',
  'game.spellOut.timeout': '⏱️ وقت تمام! کلمه **{word}** بود.',

  // ── Fast Talk ──
  'game.fastSpeech.name': 'تندگویی',
  'game.fastSpeech.desc': 'یک جمله را خیلی تند می‌خوانم — اولین کسی که آنچه گفتم را بنویسد می‌برد.',
  'game.fastSpeech.intro':
    '💨 **تندگویی** — {rounds} جمله با سرعتی سرسام‌آور. آنچه می‌شنوی را بنویس!',
  'game.fastSpeech.round': '⚡ دور {n}/{total} — الان می‌آید، سریع!',
  'game.fastSpeech.correct': '✅ **{user}** رمزگشایی‌اش کرد: «{phrase}»',
  'game.fastSpeech.timeout': '⏱️ وقت تمام! این بود: «{phrase}»',
  'game.fastSpeech.empty': 'هنوز برای زبان صدای این سرور عبارتی ندارم.',

  // ── Funny Accent ──
  'game.accentSwap.name': 'لهجهٔ بامزه',
  'game.accentSwap.desc': 'یک کلمه را با لهجه‌ای خارجی می‌گویم — اولین کسی که آن را بنویسد می‌برد.',
  'game.accentSwap.intro':
    '🎭 **لهجهٔ بامزه** — {rounds} کلمه با لهجهٔ اشتباه گفته می‌شود. کلمه را بنویس!',
  'game.accentSwap.round': '🌍 دور {n}/{total} — دارم چه کلمه‌ای را می‌گویم؟',
  'game.accentSwap.correct': '✅ **{user}** درست گفت — **{word}**!',
  'game.accentSwap.timeout': '⏱️ وقت تمام! کلمه **{word}** بود.',

  // ── Reflexes ──
  'game.reflexes.name': 'واکنش',
  'game.reflexes.desc':
    'شمارش معکوس می‌کنم، بعد داد می‌زنم «برو» — اولین کسی که بعد از آن بنویسد می‌برد. زودتر نپر!',
  'game.reflexes.intro':
    '⚡ **واکنش** — {rounds} دور. وقتی داد زدم **برو**، هر چیزی را هر چه سریع‌تر بنویس. اگر قبل از «برو» بنویسی، شروع زودهنگام حساب می‌شود!',
  'game.reflexes.ready': '🚦 دور {n}/{total} — آماده شو…',
  'game.reflexes.countdown': 'سه… دو… یک…',
  'game.reflexes.go': '🟢 **برو!!!**',
  'game.reflexes.goVoice': 'برو!',
  'game.reflexes.tooSoon': '🔴 **{user}** زودتر پرید — خیلی زود!',
  'game.reflexes.win': '⚡ **{user}** سریع‌ترین بود! امتیاز!',
  'game.reflexes.tooSlow': '😴 کسی به‌موقع واکنش نشان نداد. بعدی!',

  // ── Heads or Tails ──
  'game.headsOrTails.name': 'شیر یا خط',
  'game.headsOrTails.desc':
    'نتیجهٔ پرتاب سکه را حدس بزن — قبل از پرتاب، شیر یا خط را بنویس. بهترین حدس‌زننده می‌برد!',
  'game.headsOrTails.intro':
    '🪙 **شیر یا خط** — {rounds} دور. هر دور، قبل از پرتاب سکه `شیر` یا `خط` را بنویس. هر حدس درست 1 امتیاز!',
  'game.headsOrTails.introVoice': 'بیایید شیر یا خط بازی کنیم!',
  'game.headsOrTails.round': '🪙 دور {n}/{total} — شیر یا خط؟ حدست را بنویس!',
  'game.headsOrTails.roundVoice': 'شیر… یا خط؟',
  'game.headsOrTails.heads': 'شیر',
  'game.headsOrTails.tails': 'خط',
  'game.headsOrTails.resultVoice': '{side} آمد!',
  'game.headsOrTails.winners': '**{side}** آمد! امتیاز برای: {users}',
  'game.headsOrTails.noWinners': '**{side}** آمد! کسی درست حدس نزد — بدون امتیاز.',

  // ── Vozen Says ──
  'game.vozenSays.name': 'ووکسی می‌گوید',
  'game.vozenSays.desc':
    'فقط وقتی اطاعت کن که دستور با «ووکسی می‌گوید» شروع شود. در دام بیفتی، گیر می‌افتی!',
  'game.vozenSays.intro':
    '🫡 **ووکسی می‌گوید** — {rounds} دستور. فقط اگر با **«ووکسی می‌گوید»** شروع کردم انجامش بده. وگرنه تکان نخور!',
  'game.vozenSays.prefix': 'ووکسی می‌گوید',
  'game.vozenSays.verb': 'بنویسید',
  'game.vozenSays.real': '🗣️ دور {n}/{total} — «{command}»',
  'game.vozenSays.trap': '🗣️ دور {n}/{total} — «{command}»',
  'game.vozenSays.obeyed': '✅ **{user}** اول اطاعت کرد — امتیاز!',
  'game.vozenSays.caught': '🔴 **{user}** — من نگفتم ووکسی می‌گوید! گیر افتادی!',
  'game.vozenSays.nobody': '😴 کسی به‌موقع از **{word}** اطاعت نکرد. بعدی!',
  'game.vozenSays.trapCleared': '😌 دام بود — خوب فهمیدید، کسی در دام **{word}** نیفتاد.',

  // ── Truth or Dare Roulette ──
  'game.roulette.name': 'رولت جرئت یا حقیقت',
  'game.roulette.desc':
    'رولت را می‌چرخانم و یک چالش جرئت‌یا‌حقیقت را با صدای بلند می‌خوانم. برای یکی دیگر دوباره اجرا کن.',
  'game.roulette.header': '🎯 **چرخ می‌گوید…**',

  // ── Hangman ──
  'game.hangman.name': 'مرد حلق‌آویز',
  'game.hangman.desc': 'کلمه را حرف‌به‌حرف حدس بزن — 6 خطا و تمام است.',
  'game.hangman.intro':
    '🪢 **مرد حلق‌آویز** — برای حدس کلمه، هر بار یک حرف بنویس. می‌توانی کل کلمه را هم بنویسی!',
  'game.hangman.hit': '🟢 **{user}** حرف **{letter}** را پیدا کرد!',
  'game.hangman.miss': '🔴 **{user}** — حرف **{letter}** نیست.',
  'game.hangman.wrongLetters': 'اشتباه: {letters}',
  'game.hangman.win': '🎉 **{user}** حلش کرد — **{word}**!',
  'game.hangman.lose': '💀 تلاش‌ها تمام شد! کلمه **{word}** بود.',
  'game.hangman.idle': '🕹️ بازی متوقف شد (کسی بازی نمی‌کند). کلمه **{word}** بود.',

  // ── Wordle ──
  'game.wordle.name': 'وردل',
  'game.wordle.desc':
    'کلمهٔ 5 حرفی را حدس بزن. 🟩 جای درست، 🟨 جای اشتباه، ⬛ در کلمه نیست. 💎 پریمیوم.',
  'game.wordle.intro':
    '🟩 **وردل** — یک کلمهٔ 5 حرفی بنویس. {max} حدس مشترک دارید. 🟩 جای درست · 🟨 جای اشتباه · ⬛ در کلمه نیست.',
  'game.wordle.guess': '🔤 **{user}** حدس زد — **{left}** حدس باقی مانده',
  'game.wordle.inWord': '🟢 در کلمه: {letters}',
  'game.wordle.out': '🚫 خارج: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** در {n} حدس زدش — **{word}**!',
  'game.wordle.lose': '💀 حدس‌ها تمام شد! کلمه **{word}** بود.',
  'game.wordle.idle': '🕹️ بازی متوقف شد (کسی بازی نمی‌کند). کلمه **{word}** بود.',

  // ── Tic-Tac-Toe ──
  'game.tictactoe.name': 'دوز',
  'game.tictactoe.desc':
    'دو بازیکن — برای گذاشتن نشانت یک عدد 1 تا 9 بنویس. سه‌تا در یک ردیف می‌برد.',
  'game.tictactoe.intro':
    '⭕ **دوز** — دو بازیکن اول که حرکت کنند ❌ و ⭕ می‌شوند (❌ شروع می‌کند). برای بازی در یک خانه، عددی 1 تا 9 بنویس.',
  'game.tictactoe.turn': 'نوبت: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**، نوبت **{mark}** است.',
  'game.tictactoe.taken': '🚫 خانهٔ {cell} پر است — یکی دیگر انتخاب کن.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) برنده شد!',
  'game.tictactoe.draw': '🤝 مساوی شد!',
  'game.tictactoe.idle': '🕹️ بازی تمام شد (کسی بازی نمی‌کند).',

  // ── Chess ──
  'game.chess.name': 'شطرنج',
  'game.chess.desc':
    'دو بازیکن — قوانین واقعی شطرنج (کیش، قلعه، ارتقا…). یک حرکت مثل «e4» یا «Nf3» بنویس. 💎 پریمیوم.',
  'game.chess.intro':
    '♟️ **شطرنج** — دو بازیکن اول که حرکت کنند سفید و سیاه می‌شوند (سفید شروع می‌کند). یک حرکت را با نماد جبری («e4»، «Nf3»، «O-O») یا مختصات («e2e4») بنویس. برای تسلیم «resign» را بنویس.',
  'game.chess.white': 'سفید',
  'game.chess.black': 'سیاه',
  'game.chess.seats': '⚪ سفید: **{white}** · ⚫ سیاه: **{black}**',
  'game.chess.turn': '{move} — نوبت: **{color}**',
  'game.chess.check': '♟️ کیش!',
  'game.chess.notYourTurn': '⏳ **{user}**، نوبت **{color}** است.',
  'game.chess.illegalMove': '🚫 «{move}» حرکت مجاز نیست — دوباره امتحان کن.',
  'game.chess.checkmate': '🏆 کیش‌ومات ({move})! **{user}** برنده شد!',
  'game.chess.draw': '🤝 مساوی شد ({move})!',
  'game.chess.resigned': '🏳️ **{user}** تسلیم شد — **{winner}** برنده شد!',
  'game.chess.idle': '🕹️ بازی تمام شد (کسی بازی نمی‌کند).',

  // ── Word Chain ──
  'game.wordChain.name': 'زنجیرهٔ کلمات',
  'game.wordChain.descr':
    'زنجیرهٔ کلمات نوبتی در یک زبان: کلمه‌ای بگو که با آخرین حرف کلمهٔ قبلی شروع شود. 2 جان، بدون تکرار، و زمان تندتر می‌شود. زبان را با گزینهٔ `language` انتخاب کن. 💎 پریمیوم.',
  'game.wordChain.unavailable':
    '⚠️ زنجیرهٔ کلمات همین حالا در **{lang}** در دسترس نیست (فهرست کلمات موجود نیست).',
  'game.wordChain.lobby':
    '🔗 **زنجیرهٔ کلمات** در **{lang}**! برای پیوستن، در **{seconds} ثانیه** آینده هر چیزی در این کانال بنویس.',
  'game.wordChain.notEnough': '😴 بازیکن کافی نپیوست (دست‌کم 2 نفر لازم است). بازی لغو شد.',
  'game.wordChain.begin':
    '🚀 شروع! بازیکنان: {players}. هر کلمه باید با آخرین حرف کلمهٔ قبلی شروع شود.',
  'game.wordChain.turn':
    '**{name}**، نوبت توست! یک کلمهٔ **{lang}** که با **{letter}** شروع شود — {hearts} · ⏱️ {seconds} ثانیه',
  'game.wordChain.accepted': '✅ **{word}** — حرف بعدی: **{letter}**',
  'game.wordChain.bad.letter': '↪️ باید با **{letter}** شروع شود.',
  'game.wordChain.bad.short': '📏 خیلی کوتاه — دست‌کم **{min}** حرف.',
  'game.wordChain.bad.repeated': '🔁 این کلمه قبلاً استفاده شده.',
  'game.wordChain.bad.word': '📖 این در واژه‌نامه نیست.',
  'game.wordChain.bad.latin': '🔤 فقط حروف A–Z به‌حساب می‌آیند.',
  'game.wordChain.timeout': '⏰ **{name}** وقتش تمام شد! {hearts} باقی مانده.',
  'game.wordChain.eliminated': '💀 **{name}** حذف شد!',
  'game.wordChain.winner': '🏆 **{name}** زنجیره را برد! ({chain} کلمه)',

  // ── /game stats · pick ──
  'game.stats.none': 'هنوز هیچ بازی‌ای نکرده‌ای. `/game play` را امتحان کن!',
  'game.stats.body': '🎮 **آمار تو** — **{points}** امتیاز · **{wins}** برد · {rank}',
  'game.stats.rank': 'رتبهٔ **#{rank}** از {total}',
  'game.stats.unranked': 'هنوز بدون رتبه',
  'game.pickPrompt': '🎮 کدام بازی را می‌خواهی بازی کنی؟ یکی انتخاب کن:',
  'game.pickPlaceholder': 'یک بازی انتخاب کن…',
  'game.pickTimeout': '⏰ بازی‌ای انتخاب نشد — هر وقت آماده بودی دوباره `/game play` را اجرا کن.',

  // ── /pronunciation (personal) ──
  'pron.listHeader': '🗣️ **تلفظ‌های تو** ({count}/{limit}):',
  'pron.listEmpty': 'هنوز هیچ‌کدام را نداری — با `/pronunciation add` یکی اضافه کن.',
  'pron.set': '✅ ذخیره شد! وقتی **تو** «{term}» را بنویسی، من «{replacement}» را می‌گویم.',
  'pron.removed': '🗑️ «{term}» حذف شد.',
  'pron.notFound': 'برای «{term}» تلفظی نداری. تلفظ‌هایت را با `/pronunciation list` ببین.',
  'pron.empty': 'کلمه و نحوهٔ گفتنش نمی‌توانند خالی باشند.',
  'pron.limitHit': '🔒 به سقف **{limit}** تلفظ رسیدی. یکی را با `/pronunciation remove` حذف کن.',
  'pron.limitUpsell': '💎 ووکسی پلاس یا پریمیوم آن را به **50** می‌رساند → {url}',
  'pron.modalTitle': 'یک تلفظ به ووکسی یاد بده',
  'pron.modalTerm': 'کلمه (همان‌طور که نوشته می‌شود)',
  'pron.modalSay': 'ووکسی چطور آن را بگوید',

  // ── /server-pronunciation ──
  'spron.listHeader': '🗣️ **تلفظ‌های سرور** ({count}/{limit}) — برای همه اعمال می‌شوند:',
  'spron.listEmpty': 'هنوز هیچ‌کدام — با `/server-pronunciation add` یکی اضافه کن.',
  'spron.set': '✅ برای کل سرور ذخیره شد! «{term}» → «{replacement}».',
  'spron.removed': '🗑️ «{term}» از سرور حذف شد.',
  'spron.notFound': 'سرور برای «{term}» تلفظی ندارد.',
  'spron.limitHit':
    '🔒 سرور به سقف **{limit}** تلفظ رسید. یکی را با `/server-pronunciation remove` حذف کن.',
  'spron.modalTitle': 'تلفظ سرور',
  'spron.modalSay': 'ووکسی چطور آن را برای همه بگوید',

  // ── /randomizer ──
  'rand.selectPrompt': '🎲 **قرعه‌کش** — می‌خواهی از بین چند گزینه انتخاب کنم؟',
  'rand.selectPlaceholder': 'تعداد گزینه‌ها…',
  'rand.selectOption': '{n} گزینه',
  'rand.filling': '📝 فرمی که همین حالا باز شد را پر کن!',
  'rand.modalTitle': 'قرعه‌کش — {amount} گزینه',
  'rand.modalOption': 'گزینهٔ {n}',
  'rand.needTwo': 'دست‌کم 2 گزینه جداشده با ویرگول به من بده (مثلاً «pizza, sushi»).',
  'rand.result': 'از بین {count} گزینه، انتخابم… **{winner}**!',
  'rand.speak': 'من انتخاب می‌کنم… {winner}!',
  'rand.notInVoice': '_(با من به یک کانال صوتی بپیوند تا دفعهٔ بعد آن را با صدای بلند بگویم)_',
  'rand.timeout': '⏰ چیزی انتخاب نشد — هر وقت آماده بودی دوباره `/randomizer` را اجرا کن.',
};
