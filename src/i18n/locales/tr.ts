export default {
  'error.generic': 'Bir şeyler ters gitti. Lütfen tekrar deneyin.',
  'stt.guildOnly': 'Transkripsiyon yalnızca bir sunucu içinde çalışır.',
  'stt.noManage':
    'Transkripsiyonu başlatmak veya durdurmak için **Sunucuyu Yönet** iznine ihtiyacın var.',
  'stt.notPremium':
    '🎙️ Canlı transkripsiyon bir **Premium** özelliğidir. Bu sunucu için açmak üzere `/premium info` komutuna bak.',
  'stt.unavailable':
    'Transkripsiyon bu örnekte kullanılamıyor (konuşmadan metne motoru yüklü değil).',
  'stt.notInVoice':
    'Bir ses kanalında değilim — önce bir kanala katıl ve `/join` komutunu çalıştır, sonra transkripsiyonu başlat.',
  'stt.alreadyRunning':
    'Bu sunucuda transkripsiyon zaten çalışıyor. Önce `/transcribe stop` komutunu kullan.',
  'stt.atCapacity':
    'Şu anda tüm sunucularda çok fazla transkripsiyon çalışıyor. Lütfen birazdan tekrar dene.',
  'stt.noChannel':
    'Bu kanala transkript gönderemiyorum. Komutu normal bir metin kanalından çalıştırmayı dene.',
  'stt.started':
    '✅ Transkripsiyon başladı. Duyurudaki **Onayla** düğmesine basan herkes bu kanala transkript edilecek.',
  'stt.startFailed':
    'Transkripsiyon başlatılamadı (duyuru gönderilemedi). Her şeyi geri aldım — hiçbir şey kaydedilmiyor. Lütfen tekrar dene.',
  'stt.announceStart':
    '🎙️ **Bu kanalda canlı transkripsiyon AÇIK.** Yalnızca onay verenler transkript edilir — konuşmanın buraya yazılmasına izin vermek için aşağıdaki düğmeye bas. İstediğin zaman `/transcribe revoke` ile geri çekebilirsin.',
  'stt.consentBtn': 'Transkript edilmeyi onayla',
  'stt.consentThanks':
    '✅ Teşekkürler — konuşman artık bu sunucuda transkript edilecek. İstediğin zaman `/transcribe revoke` ile geri çek.',
  'stt.stopped': '🛑 Transkripsiyon durduruldu.',
  'stt.notRunning': 'Bu sunucuda transkripsiyon çalışmıyor.',
  'stt.announceStop': '🛑 **Canlı transkripsiyon artık KAPALI.** Dinlemeyi bıraktım.',
  'stt.revoked':
    "✅ Onay geri çekildi — artık bu sunucuda transkript edilmeyeceksin. (Zaten gönderilmiş mesajlar kalır; istersen Discord'da sil.)",
  'stt.revokeNone':
    'Bu sunucuda transkripsiyona onay vermemiştin, bu yüzden geri çekilecek bir şey yoktu.',
  'privacy.eraseConfirm':
    '⚠️ Bu, her sunucudaki **tüm** Vozen verilerini kalıcı olarak siler: ses ayarları, sesli takma ad, kişisel kısaltmalar ve telaffuzlar, kayıtlı doğum günü, oyun puanları, konuşma istatistikleri ve otomatik okuma tercihi. **Bu geri alınamaz.** Emin misin?',
  'privacy.erasePremiumNote':
    "_Not: ödediğin Premium/Plus ve satın alma geçmişi saklanır — bunlar sana ve yasal olarak zorunlu mali kayıtlara aittir. Premium'u durdurmak için süresinin dolmasını bekle veya destekle iletişime geç._",
  'privacy.eraseYes': 'Her şeyi sil',
  'privacy.eraseNo': 'İptal',
  'privacy.eraseCancelled': 'İptal edildi — hiçbir şey silinmedi.',
  'privacy.eraseDone': '✅ Tamamlandı. Tüm kişisel verilerin kalıcı olarak silindi.',
  'error.needManageGuild': 'Bunu yapmak için **Sunucuyu Yönet** iznine ihtiyacın var.',
  'join.needVoiceChannel': 'Önce bir ses kanalına katıl, sonra /join komutunu çalıştır.',
  'join.missingPerms': '{channel} kanalında **Bağlan** ve **Konuş** izinlerine ihtiyacım var.',
  'join.joined':
    '✅ {channel} kanalındayım! Sıradaki adım: `/tts merhaba` yaz, sesli okuyayım. Bir kanalı otomatik okumamı ister misin? /setup komutunu çalıştır.',
  'join.joinedAutoread':
    '✅ {channel} kanalındayım! Her şey hazır. Otomatik okuma kanalına yaz, sesli okuyayım. → {readChannel}',
  'leave.left': 'Ses kanalından ayrıldım. Görüşmek üzere!',
  'skip.notInVoice':
    'Henüz bir ses kanalında değilim — bir kanala katıl ve önce /join komutunu çalıştır, sonra tekrar dene.',
  'skip.skipped': 'Atlandı.',
  'skip.nothing': 'Şu anda hiçbir şey çalmıyor.',
  'shutup.notInVoice':
    'Henüz bir ses kanalında değilim — önce bir kanala katıl ve /join komutunu çalıştır.',
  'shutup.nothing': 'Şu anda hiçbir şey çalmıyor.',
  'shutup.done': '🤐 Tamam, susuyorum — sıradaki her şeyi temizledim.',
  'tts.notInVoice':
    'Henüz bir ses kanalında değilim — bir kanala katıl ve /join komutunu çalıştır, sonra tekrar dene.',
  'tts.nothingToRead': 'Orada okunacak bir şey yok — bana söylemem için biraz metin gönder.',
  'tts.nothingAfterClean':
    'Düzenledikten sonra okunacak bir şey kalmadı — normal bir metin dene (harfler veya kelimeler).',
  'tts.tooFast': 'Vay, biraz yavaşla — birazdan tekrar dene.',
  'tts.blocked': 'Bu metin engellenmiş bir kelime içeriyor, bu yüzden atladım.',
  'tts.queued': 'Tamamdır — sıraya eklendi.',
  'tts.busy': 'Şu anda meşgulüm — birazdan tekrar dene.',
  'voice.unknownModel': 'O sesi tanımıyorum — /voice list ile kontrol et.',
  'voice.badSpeed':
    'Hız 0.5 ile 2.0 arasında olmalı (1.0 normaldir). `/voice set model:… speed:1.0` şeklinde dene.',
  'voice.set':
    '✅ Sesin artık **{name}**, {speed}× hızında. Duymak için `/tts merhaba` dene. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Ses ayarı** — aşağıdaki seçenekleri belirleyip **Kaydet** düğmesine bas. Bunu yapana kadar hiçbir şey değişmez.',
  'voice.config.summary': 'Geçerli seçim: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Dil…',
  'voice.config.pickVoice': 'Ses…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Hız…',
  'voice.config.more': '▼ Daha fazla dil',
  'voice.config.engDefault': 'Varsayılan (yerel)',
  'voice.config.save': 'Kaydet',
  'voice.config.cancel': 'İptal',
  'voice.config.cancelled': 'Ayar iptal edildi — hiçbir şey değişmedi.',
  'voice.config.expired':
    'Panelin süresi doldu — devam etmek için `/voice config` komutunu yeniden çalıştır.',
  'voice.listHeader': 'Mevcut sesler:',
  'voice.listEmpty': '(hiçbiri yüklü değil)',
  'voice.reset':
    '✅ Sesin varsayılana döndü. `/voice list` ve `/voice set` ile istediğin zaman başka bir tane seçebilirsin.',
  'voice.detection.on':
    '✅ Otomatik dil algılama AÇIK: her mesaj, algılanan diline uygun bir sesle okunur (konuşmacı değişebilir). Kapatmak için `/voice detection active:false` kullan.',
  'voice.detection.off':
    '✅ Otomatik dil algılama KAPALI: tek sabit sesin her şeyi okur, böylece hep aynı sesle konuşursun.',
  'voice.optout':
    'Artık otomatik olarak okunmayacaksın. Tekrar açmak için /voice opt-in komutunu çalıştır.',
  'voice.optin': 'Artık tekrar otomatik olarak okunacaksın.',
  'voice.nickname.set': '✅ Vozen artık sana sesli olarak **{name}** diye seslenecek.',
  'voice.nickname.cleared': '✅ Sesli takma ad temizlendi — Vozen sunucu adını kullanacak.',
  'voice.nickname.invalid': 'Bu adda sesli okunacak bir şey yok. Harf veya rakam dene.',
  'voice.effect.set':
    '✅ Ses efekti **{effect}** olarak ayarlandı — mesajların artık bu efektle çalıyor. Kapatmak için `/voice effect none` kullan.',
  'voice.effect.cleared': '✅ Ses efekti kaldırıldı — yine temiz ses.',
  'voice.effect.locked':
    '🔒 **{effect}** bir Premium efektidir. Ücretsiz efektler: 🤖 Robot ve 🔊 Echo. Hepsini Vozen Premium ile aç — `/premium` komutuna bak.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** bir Premium ses motorudur. Vozen Plus (kişisel) veya Vozen Premium (sunucu) ile aç — `/premium` komutuna bak. Bu arada sesin ücretsiz yerel motorda kalır.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** bir Premium ses motorudur. Vozen Plus (kişisel) veya Vozen Premium (sunucu) ile aç — `/premium` komutuna bak. Bu arada sesin ücretsiz yerel motorda kalır.',
  'voice.notInVoice': 'Henüz bir ses kanalında değilim — önce /join komutunu çalıştır.',
  'voice.previewPlaying': 'Bir örnek çalıyor…',
  'preview.sample': 'Merhaba, ben Vozen. yaz, dinle.',
  'laugh.playing': 'Haha! Bunu senin sesinle çalıyorum…',
  'joke.playing': 'Bir espri yapıyorum…\n> {joke}',
  'joke.unknownLang': 'O dili bilmiyorum. Listeden birini seç.',
  'rizz.playing': '😏 Biraz laf atıyorum…\n> {line}',
  'rizz.unknownLang': 'O dili bilmiyorum. Listeden birini seç.',
  'rizz.locked':
    '🔒 **/rizz** bir Premium ayrıcalığıdır. Vozen Plus (sen) veya Premium (bu sunucu) ile aç. `/premium` komutuna bak.',
  'sound.playing': '🔊 **{name}** çalıyor…',
  'sound.unknown': 'O ses bende yok. Listeyi görmek için `/sound` komutunu çalıştır.',
  'sound.list':
    '🔊 **Sesler:** {sounds}\nBirini `/sound name:<sound>` ile çal (senin ses kanalında olmam gerekir).',
  'sound.disabled':
    '🔇 Ses panosu bu sunucuda **kapalı**. Bir yönetici `/config soundboard` ile etkinleştirebilir.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Doğum günü kaydedildi: **{day}/{month}**. O gün bir ses kanalına katıldığında sana mutlu yıllar dilerim!',
  'birthday.invalid': 'Bu geçerli bir tarih değil. Günü ve ayı kontrol et.',
  'birthday.cleared': '🎂 Doğum günü kaldırıldı.',
  'birthday.show': '🎂 Doğum günün **{day}/{month}** olarak ayarlı.',
  'birthday.none': 'Henüz bir doğum günü ayarlamadın. `/birthday set` kullan.',
  'topspeakers.title': '🗣️ **En çok konuşanlar** — bu sunucuda en çok okuduğum kişiler:',
  'topspeakers.empty': 'Henüz kimsenin mesajını okumadım. `/setup` ile bir okuma kanalı ayarla!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** mesaj · 🔥 {streak} günlük seri',
  'serverstats.title': '📊 **Sunucu istatistikleri**',
  'serverstats.empty':
    'Henüz istatistik yok — burada hiç mesaj okumadım veya oyun oynatmadım. `/setup` ile ayarla!',
  'serverstats.messages': '🗣️ **{total}** mesaj okundu · **{speakers}** kişi',
  'serverstats.topTalkers': '**En çok konuşanlar:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} mesaj · 🔥 {streak}g',
  'serverstats.streak': '🔥 En uzun aktif seri: **{days}** gün',
  'serverstats.games': '🎮 **{points}** oyun puanı · **{wins}** galibiyet · **{players}** oyuncu',
  'serverstats.topPlayers': '**En iyi oyuncular:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} puan · {wins} galibiyet',
  'serverstats.upsell':
    "🔒 Bu ücretsiz önizleme. **Premium**; serileri, oyun istatistiklerini ve tam ilk 5'i açar — `/premium` komutuna bak.",
  'streak.day': '🔥 <@{user}> **{n} günlük** bir seride! Sürdürmek için konuşmaya devam et.',
  'leaderboard.autoTitle': '🏆 Bu sunucuda en çok konuşanlar',
  'premium.title': '💎 **Vozen Premium durumu**',
  'premium.lineServerActive': '🖥️ **Sunucu:** {date} tarihine kadar Premium',
  'premium.lineServerFree': '🖥️ **Sunucu:** Ücretsiz plan',
  'premium.lineUserActive': '👤 **Sen (Plus):** {date} tarihine kadar aktif',
  'premium.lineUserFree': '👤 **Sen (Plus):** aktif değil',
  'premium.getHint':
    "Bugün kullandığın her şey ücretsiz kalır. Premium; 8 ses efektinin tümünü, 7/24 çağrıda kalmayı, 50 kişisel telaffuzu, /rizz'i ve premium oyunları ekler. Destek: https://ko-fi.com/",
  'premium.enginePerks':
    '💎 **Premium ses motorları:** Kokoro nöral ve Google HD — Plus ile kişisel olarak veya sunucu Premium ile herkes için açılır.',
  'premium.linePass':
    '🎟️ **Premium geçişin:** {used}/{total} lisans kullanımda · {date} tarihinde sona erer',
  'premium.passServers': '↳ Kullanımda: {servers}',
  'premium.pitch':
    "Henüz Premium'un yok. **Vozen Premium** (3 sunucu için €3.99/ay veya 8 sunucu için €7.99/ay) tüm sunucu için şunları açar: 8 ses efektinin tümü, 7/24 çağrıda kalma, 50 kişisel telaffuz (3 yerine), /rizz komutu ve premium oyunlar (Kelime Zinciri, Wordle, Satranç). **Vozen Plus** (€1.99/ay) bu ayrıcalıkları sana kişisel olarak, her sunucuda verir.",
  'premium.buyHint':
    '▶ **Premium al:** {link}\nSatın aldıktan sonra istediğin sunucuda `/premium activate` komutunu çalıştır.',
  'premium.confirmActivate':
    "**{total} Premium lisansından 1'ini** **bu sunucuda** kullanmak ister misin? Şu anda **{used}** tanesi kullanımda. Daha sonra `/premium deactivate` ile serbest bırakabilirsin — geçişin süresi her durumda işlemeye devam eder.",
  'premium.confirmYes': '💎 Lisans kullan',
  'premium.confirmNo': 'İptal',
  'premium.activateOk':
    '✅ Premium artık {date} tarihine kadar **bu sunucuda** aktif. Lisanslar: **{used}/{total}** kullanımda.',
  'premium.activateCancelled': 'İptal edildi — hiçbir lisans kullanılmadı.',
  'premium.activateTimeout': 'Zaman aşımına uğradı — hiçbir lisans kullanılmadı.',
  'premium.noPass':
    'Aktif bir Premium geçişin yok. Bir tane al, hesabına düşsün — sonra burada `/premium activate` komutunu çalıştır.\n▶ {link}',
  'premium.alreadyActive':
    'Bu sunucuda zaten Premium lisanslarından biri var. Yapılacak bir şey yok.',
  'premium.noSeats':
    '**{total}** Premium lisansının tümü kullanımda ({servers}). Orada `/premium deactivate` ile birini serbest bırak, sonra burada tekrar dene.',
  'premium.needManageGuild':
    "Premium'u etkinleştirmek tüm sunucuyu etkiler — bunu yalnızca **Sunucuyu Yönet** iznine sahip üyeler yapabilir. Bir yöneticiye sor.",
  'premium.deactivateOk':
    '✅ Bu sunucunun Premium lisansı serbest bırakıldı. Başka bir sunucuda `/premium activate` ile kullan.',
  'premium.deactivateNone': 'Bu sunucuda serbest bırakacağın bir Premium lisansın yok.',
  'premium.thisServer': 'bu sunucu',
  'grant.denied': '⛔ Bu komut yalnızca bot sahibi içindir.',
  'grant.okPremium':
    '✅ <@{user}> kullanıcısına **{days}** günlüğüne bir **Premium geçişi** ({seats} lisans) verildi — {date} tarihinde sona erer. `/premium activate` ile etkinleştirir.',
  'grant.okPlus':
    '✅ <@{user}> kullanıcısına **{days}** günlüğüne **Vozen Plus** verildi — {date} tarihinde sona erer.',
  'gencode.done':
    '✅ Her biri **{days}** günlük **{count}** {plan} kodu oluşturuldu. Bunları özel olarak paylaş:\n{list}',
  'redeem.okPlus':
    '🎁 Kullanıldı! **{days}** günlüğüne **Vozen Plus** kazandın — {date} tarihinde sona erer.',
  'redeem.okPremium':
    '🎁 Kullanıldı! **{days}** günlüğüne bir **Premium geçişi** ({seats} lisans) kazandın — {date} tarihinde sona erer. Sunucunda `/premium activate` ile etkinleştir.',
  'redeem.notFound': '❌ Bu kod mevcut değil. Tekrar kontrol edip yeniden dene.',
  'redeem.used': '❌ Bu kod zaten kullanılmış.',
  'redeem.expired': '❌ Bu kodun süresi dolmuş.',
  'voice.abbrev.added': 'Tamamdır — {term} artık {replacement} olarak okunacak.',
  'voice.abbrev.removed': '{term} için kısaltman kaldırıldı.',
  'voice.abbrev.listHeader': 'Kişisel kısaltmaların ({count}/{cap} kullanıldı):',
  'voice.abbrev.listEmpty': '(henüz yok — /voice abbrev add ile bir tane ekle)',
  'voice.abbrev.capReached':
    '{cap} kişisel kısaltma sınırına ulaştın. Yenisini eklemeden önce birini kaldır.',
  'voice.abbrev.invalidTerm':
    'Terim tek bir kelime olmalı (yalnızca harf ve rakam), en fazla 50 karakter.',
  'voice.abbrev.emptyReplacement': 'Okunuş boş olamaz.',
  'voice.abbrev.tooLong': 'Okunuş çok uzun (en fazla 200 karakter).',
  'config.wordEmpty': 'Kelime boş olamaz.',
  'config.blocked': 'Engellendi: {word}.',
  'config.blockLimit':
    'Bu sunucuda zaten en fazla {max} engellenmiş kelime var. Yenisini eklemeden önce birini kaldır.',
  'config.unblocked': 'Engel kaldırıldı: {word}.',
  'config.pronListHeader': 'Telaffuz sözlüğü:',
  'config.pronEmptyValue': '(boş)',
  'config.listEmpty': '(hiçbiri)',
  'config.termEmpty': 'Terim boş olamaz.',
  'config.pronEmpty': 'Telaffuz boş olamaz.',
  'config.pronSet': 'Tamamdır — {term} artık {replacement} olarak okunacak.',
  'config.pronRemoved': '{term} için telaffuz kaldırıldı.',
  'config.channelWrongType': 'Bir metin kanalı seç (ses kanalı veya kategori değil).',
  'config.channelNoAccess':
    '{channel} kanalını göremiyorum — lütfen oradaki izinlerimi kontrol et.',
  'config.channelSet':
    'Otomatik okuma kanalı {channel} olarak ayarlandı. Sıradaki: `/config auto-read active:true` ile otomatik okumanın açık olduğundan emin ol.',
  'config.autoreadOn': 'Otomatik okuma artık **açık**.',
  'config.autoreadOff': 'Otomatik okuma artık **kapalı**.',
  'config.maxCharsRange': 'Maksimum karakter değeri 1 ile 2000 arasında olmalı.',
  'config.maxCharsSet': 'Mesaj başına maksimum karakter {value} olarak ayarlandı.',
  'config.rateLimitRange': 'Hız sınırı değeri 1 ile 120 arasında olmalı.',
  'config.rateLimitSet': 'Hız sınırı dakikada {value} mesaj olarak ayarlandı.',
  'config.roleSet': 'Otomatik okuma artık yalnızca {role} rolüne sahip üyelerle sınırlı.',
  'config.roleCleared': 'Rol kısıtlaması kaldırıldı — artık herkes okunabilir.',
  'config.enabledOn': 'TTS bu sunucu için artık **açık**.',
  'config.enabledOff': 'TTS bu sunucu için artık **kapalı**.',
  'config.xsaidOn':
    'Vozen artık her mesajdan önce **kimin konuştuğunu** duyuracak (örn. "Alex merhaba dedi"). Kapatmak için `/config x-said active:false` kullan.',
  'config.xsaidOff': 'Vozen kimin konuştuğunu **artık** duyurmayacak — yalnızca mesajı okur.',
  'config.autojoinOn':
    '✅ Otomatik katılma **açık** — TTS kanalına yazdığında Vozen senin ses kanalına katılır.',
  'config.autojoinOff': "Otomatik katılma **kapalı** — Vozen'yi sese getirmek için `/join` kullan.",
  'config.stayOn':
    '✅ 7/24 çağrıda kalma **açık** — Vozen boşalsa bile ses kanalında kalır ve yeniden başlatmalardan sonra geri döner. 💎 Etkili olması için Premium gerekir (satın al veya bir kodu `/redeem` et, sonra `/premium activate`).',
  'config.stayOff':
    '7/24 çağrıda kalma **kapalı** — ses kanalı boşaldığında Vozen ayrılır (varsayılan).',
  'config.readBotsOn':
    "✅ Vozen artık **diğer botlardan ve webhook'lardan** gelen mesajları da okuyacak.",
  'config.readBotsOff':
    "Vozen diğer botları ve webhook'ları **yok sayar** (yalnızca gerçek kişiler okunur).",
  'config.textInVoiceOn':
    '✅ Vozen ayrıca **bulunduğu ses kanalındaki metin sohbetini** de okuyacak.',
  'config.textInVoiceOff': 'Vozen ses kanalı metin sohbetini **okumaz** (yalnızca TTS kanalını).',
  'config.antispamOn':
    '✅ Anti-spam **açık** — Vozen spam mesajları okumaz (toplu kelime tekrarı veya aynı büyük mesajın tekrar tekrar gönderilmesi).',
  'config.antispamOff': 'Anti-spam **kapalı** — Vozen her mesajı her zamanki gibi okur.',
  'config.streaksOn':
    '✅ Seri bildirimleri **açık** — Vozen, her kişi her gün ilk konuştuğunda bir 🔥 günlük seri mesajı gösterir.',
  'config.streaksOff':
    "Seri bildirimleri **kapalı** — Vozen serileri yine de takip eder (`/top-speakers`'e bak) ama bunları duyurmaz.",
  'config.soundboardOn': 'Ses panosu **açık** — herkes `/sound` ile klip çalabilir.',
  'config.soundboardOff': 'Ses panosu **kapalı** — `/sound` bu sunucuda devre dışı.',
  'config.votePromosLabel': 'top.gg ödül bildirimleri + Vozen Support',
  'config.greetOn': '✅ Ses kanalına katıldıklarında insanları adlarıyla selamlayacağım.',
  'config.greetOff': '🔇 Ses kanalına katıldıklarında insanları **selamlamayacağım**.',
  'config.greetLangSet': '✅ Katılım selamlama dili **{language}** olarak ayarlandı.',
  'config.defaultVoiceSet':
    '✅ Sunucu varsayılan sesi **{name}** olarak ayarlandı. Kendi sesi olmayan üyeler bunu duyacak. (id: `{model}`)',
  'config.reset':
    'Yapılandırma varsayılanlara sıfırlandı. Engelleme listen ve telaffuzların korundu.',
  'config.showTitle': '**Sunucu yapılandırması**',
  'config.showChannel': 'TTS kanalı: {value}',
  'config.showAutoread': 'Otomatik okuma: {value}',
  'config.showRole': 'Rol: {value}',
  'config.showEnabled': 'Etkin: {value}',
  'config.showXsaid': 'Konuşanı duyur (xsaid): {value}',
  'config.showAutojoin': 'Otomatik katılma: {value}',
  'config.showReadBots': "Botları/webhook'ları oku: {value}",
  'config.showTextInVoice': 'Seste metin: {value}',
  'config.showAntispam': 'Anti-spam: {value}',
  'config.showSoundboard': 'Ses panosu (/sound): {value}',
  'config.showGreet': 'Katılışta selamla: {value} ({language})',
  'config.showVoice': 'Varsayılan ses: {value}',
  'config.showMaxChars': 'Maksimum karakter: {value}',
  'config.showRateLimit': 'Hız sınırı: {value}/dk',
  'config.showBlocklist': 'Engelleme listesi: {count} kelime',
  'config.showPronunciation': 'Telaffuzlar: {count} kayıt',
  'config.valueNone': '(hiçbiri)',
  'config.valueAny': 'herkes',
  'config.valueAutoDetect': '(otomatik algıla)',
  'config.on': 'açık',
  'config.off': 'kapalı',
  'config.language.set': 'Arayüz dili {language} olarak ayarlandı.',
  'config.language.unsupported': 'Bu dil henüz desteklenmiyor.',
  'setup.noChannel':
    'Hangi kanalı kullanacağımı anlayamadım. "channel" seçeneğinde bir metin kanalı belirt.',
  'setup.channelWrongType':
    'Otomatik okuma kanalı bir metin kanalı olmalı (ses kanalı veya kategori değil). "channel" seçeneğinde bir tane belirt.',
  'setup.done': '**Her şey hazır — Vozen kullanıma hazır.**',
  'setup.channelLine': 'Otomatik okuma kanalı: {channel}',
  'setup.autoreadOn': 'Otomatik okuma: açık',
  'setup.permsHeader': '**İzinler:**',
  'setup.permView': 'ViewChannel (metin kanalını görme)',
  'setup.permSend': 'SendMessages (metin kanalına gönderi paylaşma)',
  'setup.permConnect': 'Connect (ses kanalına katılma)',
  'setup.permSpeak': 'Speak (ses kanalında konuşma)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — eksik',
  'setup.permUnchecked':
    '⏳ {label} — henüz kontrol edilmedi (/join çalıştırdığında doğrulayacağım)',
  'setup.fixHint':
    "Eksikleri düzeltmek için: sunucu ayarlarında Vozen'nin rolünü (veya kanalın izinlerini) aç ve ❌ ile işaretli öğeleri etkinleştir.",
  'setup.voiceUncheckedNote':
    'Bir ses kanalında değilsin, bu yüzden Connect/Speak izinlerini henüz kontrol edemedim — /join çalıştırdığında doğrulayacağım.',
  'setup.allGood': 'Her şey hazır. Bir ses kanalına katıl ve /join komutunu çalıştır.',
  'setup.joinedVoice': '{channel} kanalına da katıldım — /join çalıştırmana gerek yok.',
  'setup.readyTalk': 'Her şey hazır. Otomatik okuma kanalına yaz, sesli okuyayım.',
  'setup.membersHeader': '**Üyelerine anlat (3 adımlı akış):**',
  'setup.membersBody':
    '1) Bir ses kanalına katıl\n2) Seninle birlikte katılmam için /join komutunu çalıştır\n3) Bu kanala yaz (veya /tts kullan), sesli okuyayım\nTam komut listesi: /help',
  'stats.title': '**Vozen istatistikleri**',
  'stats.messagesSpoken': 'Seslendirilen mesajlar: {value}',
  'stats.cacheHits': 'Önbellek isabetleri: {value}',
  'stats.cacheMisses': 'Önbellek ıskaları: {value}',
  'stats.synthErrors': 'Sentez hataları: {value}',
  'stats.synthLatency': 'Sentez gecikmesi: p50 {p50}ms / p95 {p95}ms ({count} örnek)',
  'stats.voiceDrops': 'Ses kesintileri: {value}',
  'stats.voiceReconnects': 'Yeniden bağlanmalar: {value}',
  'stats.votes': 'top.gg oyları: {value}',
  'stats.activePlayers': 'Etkin oynatıcılar: {value}',
  'stats.servers': 'Sunucular: {value}',
  'stats.uptime': 'Çalışma süresi: {value}sn',
  'speak.emptyMessage': 'Bu mesajda sesli okunacak metin yok.',
  'uptime.text': '🟢 Vozen **{uptime}** boyunca çevrimiçi.',
  'botstats.title': '📊 **Vozen — istatistikler**',
  'botstats.servers': 'Sunucular: **{value}**',
  'botstats.voiceSessions': 'Şu anki ses oturumları: **{value}**',
  'botstats.messagesSpoken': 'Seslendirilen mesajlar: **{value}**',
  'botstats.uptime': 'Çalışma süresi: **{value}**',
  'invite.noClientId':
    "Vozen'nin davet bağlantısı henüz ayarlanmadı (CLIENT_ID eksik). Bot yöneticisine bildir.",
  'invite.link': "Vozen'yi sunucuna ekle:\n{url}",
  'vote.noClientId':
    "Vozen'nin oy bağlantısı henüz ayarlanmadı (CLIENT_ID eksik). Bot yöneticisine bildir.",
  'vote.link':
    "Vozen'ye oy ver (ücretsiz, her 12 saatte bir) ve daha fazla kişinin onu bulmasına yardım et:\n{url}\nBu hesap ödülü daha önce hiç almadıysa **48 saatlik Vozen Plus** kazanır, hesap başına yalnızca bir kez.",
  'invite.button': "Vozen'yi ekle",
  'vote.button': "top.gg'de oy ver",
  'vote.upsell':
    '🗳️ Bu hesap ödülü daha önce hiç almadıysa **48 saatlik Vozen Plus** kazanır, hesap başına yalnızca bir kez. {url}',
  'vote.cooldownStatus':
    '🗳️ Bu hesap tek seferlik oy ödülünü zaten kullandı. Vozen’i desteklemek için oy vermeye devam edebilirsin, ancak daha fazla Plus verilmez.',
  'help.title': 'Vozen — yaz, dinle.',
  'help.embedTitle': 'Vozen — Komutlar',
  'help.intro': 'Vozen metnini ses kanallarında sesli okur — ücretsiz nöral sesler, onlarca dil.',
  'help.quickStartTitle': 'Hızlı başlangıç (3 adım)',
  'help.quickStartBody':
    '1) Bir ses kanalına katıl, sonra /join komutunu çalıştır\n2) Metin kanalına yaz (veya /tts Herkese merhaba! kullan)\n3) (isteğe bağlı) /voice set ile bir ses seç',
  'help.groupStarted': 'Başlarken',
  'help.groupStartedBody':
    '• /join — ses kanalına katılırım\n• /leave — ses kanalından ayrılırım\n• /tts <metin> — metni sesli okurum · örn. /tts Herkese merhaba!\n• /skip — şu anda okuduğum şeyi atla',
  'help.groupVoice': 'Senin sesin',
  'help.groupVoiceBody':
    '• /voice set <model> — sesini seç · örn. /voice set en_US-amy-medium\n• /voice list — mevcut sesleri gör\n• /voice preview — sesinin bir örneğini dinle\n• /voice reset — varsayılan sese geri dön\n• /voice opt-out · /voice opt-in — senin için otomatik okumayı kapat / aç\n• /voice abbrev add|remove|list — kişisel argo, senin istediğin gibi okunsun (en fazla 10)',
  'help.groupFun': 'Eğlence',
  'help.groupFunBody':
    '• /joke — kısa bir espri yaparım (bir dil + isteğe bağlı kahkaha seç) · örn. /joke English\n• /laugh — mevcut sesinle kahkaha atarım',
  'help.groupAdmin': 'Sunucu yöneticisi (Sunucuyu Yönet gerekir)',
  'help.groupAdminBody':
    '• /setup — rehberli tek adımlı yapılandırma · önce bunu çalıştır\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · örn. /config tts-channel #genel\n• /stats — bot istatistikleri',
  'help.groupMore': 'Daha fazla',
  'help.groupMoreBody':
    "• /invite — Vozen'yi başka bir sunucuya ekle\n• /vote — top.gg'de Vozen'ye oy ver\n• /help — bu yardımı göster",
  'help.footer': 'Yeni misin? Başlamak için {command} komutunu çalıştır.',
  'help.support': '🛟 Yardıma mı ihtiyacın var ya da bir sorunu mu bildirmek istiyorsun? {url}',
  'help.source': '📄 Açık kaynak (AGPL-3.0) — burada çalışan tam kaynak kodunu al: {url}',
  'welcome.title': "Vozen'yi eklediğin için teşekkürler! 👋",
  'welcome.description':
    'Vozen sohbetini ses kanallarında sesli okur — yaz, dinle.\n\n**Tek adımda başla:** {setup} komutunu çalıştır, otomatik okumayı ayarlayıp ses kanalına katılayım.\n\nTam komut listesi mi lazım? {help} komutunu çalıştır.',
  'welcome.enginePlans':
    'Piper nöral sesleri ücretsiz kalır. 💎 Kokoro ve Google HD, Vozen Plus veya sunucu Premium ile açılır.',
  'welcome.stepsTitle': 'Üyeler nasıl kullanır (3 adım)',
  'welcome.stepsBody':
    '1) Bir ses kanalına katıl\n2) Sana katılmam için /join komutunu çalıştır\n3) Metin kanalına yaz (veya /tts kullan), sesli okuyayım\nTam komut listesi: /help',
  'welcome.footer': 'Vozen — yaz, dinle.',
  'welcome.tagline': 'Doğal nöral ses — sonsuza dek ücretsiz, ödeme duvarı yok.',
  'game.start.needVoice':
    'Bu bir **sesli oyun** — önce bir ses kanalına atla ve /join komutunu çalıştır, sonra başlat.',
  'game.start.alreadyActive':
    '<#{channel}> kanalında zaten bir oyun çalışıyor. Yenisine başlamadan önce onu bitir (veya `/game stop` kullan).',
  'game.start.premiumLocked':
    '🔒 **{game}** bir Premium oyundur (gerçek işlem gücü tüketir). `/premium` komutuna bak.',
  'game.start.started': '🎮 **{game}** başlıyor! Kanalı izle — bol şans!',
  'game.start.startedThread':
    '🎮 **{game}**, <#{channel}> kanalında başladı — oraya katıl! Konu, oyun bittiğinde kendini siler.',
  'game.thread.winner': '🏆 {winner} oyunu kazandı!',
  'game.thread.ended': '🎮 Oyun sona erdi.',
  'game.unknownGame': 'O oyunu bilmiyorum. Listeden birini seç.',
  'game.stop.ok': '🛑 Mevcut oyun durduruldu.',
  'game.stop.none': 'Şu anda çalışan bir oyun yok.',
  'game.list.title': '🎮 **Oyunlar** — birini `/game play` ile başlat:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Lider Tablosu** — bu sunucudaki en iyi oyuncular:',
  'game.leaderboard.empty': 'Henüz hiç oyun oynanmadı. İlk sen ol — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** puan ({wins} galibiyet)',
  'game.finish.title': '🏁 **Oyun bitti!** Nihai puanlar:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Oyun bitti — bu sefer kimse puan alamadı. Bir dahaki sefere!',
  'game.finish.winnerVoice': '{user} kazandı!',
  'game.guessLanguage.name': 'Dili Tahmin Et',
  'game.guessLanguage.desc':
    'Rastgele bir dilde bir cümle okurum — dili ilk söyleyen puanı kazanır.',
  'game.guessLanguage.intro':
    '🗣️ **Dili Tahmin Et** — {rounds} cümle okuyacağım. Hangi dili duyduğunu yaz. Her turda en hızlı doğru cevap kazanır!',
  'game.guessLanguage.round': '🎧 Tur {n}/{total} — dinle…',
  'game.guessLanguage.correct': '✅ **{user}** bildi — dil **{language}** idi!',
  'game.guessLanguage.timeout': '⏱️ Süre doldu! O **{language}** idi.',
  'game.guessLanguage.noLanguages':
    'Bunu oynamak için yeterli ses yüklü değil. Bir yöneticiden daha fazla ses eklemesini iste.',
  'game.math.name': 'Zihinden Matematik',
  'game.math.desc': 'Bir işlemi sesli söylerim — cevabı ilk yazan kazanır.',
  'game.math.intro':
    '🔢 **Zihinden Matematik** — {rounds} işlem. Dinle ve cevabı olabildiğince hızlı yaz!',
  'game.math.round': '🧮 Tur {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** tam isabet — cevap **{answer}** idi!',
  'game.math.timeout': '⏱️ Süre doldu! Cevap **{answer}** idi.',
  'game.math.plus': 'artı',
  'game.math.minus': 'eksi',
  'game.math.times': 'çarpı',
  'game.skipCount.name': 'Eksik Sayı',
  'game.skipCount.desc': 'Sesli sayarım ama bir sayıyı atlarım — ilk yakalayan kazanır.',
  'game.skipCount.intro':
    '🔢 **Eksik Sayı** — sayarım ama birini atlarım. Eksik sayıyı yaz! ({rounds} tur)',
  'game.skipCount.round': '👂 Tur {n}/{total} — hangi sayıyı atladım?',
  'game.skipCount.correct': '✅ **{user}** yakaladı — **{answer}** sayısını atladım!',
  'game.skipCount.timeout': '⏱️ Süre doldu! **{answer}** sayısını atladım.',
  'game.spelling.name': 'Yazım Yarışı',
  'game.spelling.desc': 'Bir kelime söylerim — doğru yazan ilk kişi kazanır.',
  'game.spelling.intro':
    '✍️ **Yazım Yarışı** — {rounds} kelime söyleyeceğim. Her birini doğru yaz!',
  'game.spelling.round': '🗣️ Tur {n}/{total} — söylediğim kelimeyi yaz…',
  'game.spelling.correct': '✅ **{user}** **{word}** kelimesini doğru yazdı!',
  'game.spelling.timeout': '⏱️ Süre doldu! Kelime **{word}** idi.',
  'game.spelling.empty': 'Bu sunucunun ses dili için henüz bir kelime listem yok.',
  'game.spellOut.name': 'Harfleri Birleştir',
  'game.spellOut.desc': 'Bir kelimeyi harf harf söylerim — kelimenin tamamını ilk yazan kazanır.',
  'game.spellOut.intro':
    '🔡 **Harfleri Birleştir** — {rounds} kelimeyi harf harf söylerim. Kelimenin tamamını yaz!',
  'game.spellOut.round': '🔤 Tur {n}/{total} — harfleri dinle…',
  'game.spellOut.correct': '✅ **{user}** bildi — **{word}**!',
  'game.spellOut.timeout': '⏱️ Süre doldu! **{word}** kelimesiydi.',
  'game.fastSpeech.name': 'Hızlı Konuşma',
  'game.fastSpeech.desc': 'Bir cümleyi çok hızlı okurum — söylediğimi ilk yazan kazanır.',
  'game.fastSpeech.intro': '💨 **Hızlı Konuşma** — çılgın hızda {rounds} cümle. Duyduğunu yaz!',
  'game.fastSpeech.round': '⚡ Tur {n}/{total} — geliyor, hızlı!',
  'game.fastSpeech.correct': '✅ **{user}** çözdü: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Süre doldu! Şuydu: “{phrase}”',
  'game.fastSpeech.empty': 'Bu sunucunun ses dili için henüz ifadelerim yok.',
  'game.accentSwap.name': 'Komik Aksan',
  'game.accentSwap.desc': 'Bir kelimeyi yabancı bir aksanla söylerim — ilk yazan kazanır.',
  'game.accentSwap.intro':
    '🎭 **Komik Aksan** — yanlış aksanla söylenen {rounds} kelime. Kelimeyi yaz!',
  'game.accentSwap.round': '🌍 Tur {n}/{total} — hangi kelimeyi söylemeye çalışıyorum?',
  'game.accentSwap.correct': '✅ **{user}** bildi — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Süre doldu! Kelime **{word}** idi.',
  'game.reflexes.name': 'Refleksler',
  'game.reflexes.desc':
    'Geri sayarım, sonra BAŞLA diye bağırırım — bundan sonra ilk yazan kazanır. Erken atlama!',
  'game.reflexes.intro':
    "⚡ **Refleksler** — {rounds} tur. **BAŞLA** diye bağırdığımda, olabildiğince hızlı herhangi bir şey yaz. BAŞLA'dan önce yazarsan hatalı çıkış olur!",
  'game.reflexes.ready': '🚦 Tur {n}/{total} — hazır ol…',
  'game.reflexes.countdown': 'üç… iki… bir…',
  'game.reflexes.go': '🟢 **BAŞLA!!!**',
  'game.reflexes.goVoice': 'Başla!',
  'game.reflexes.tooSoon': '🔴 **{user}** erken davrandı — çok erken!',
  'game.reflexes.win': '⚡ **{user}** en hızlısı! Puan!',
  'game.reflexes.tooSlow': '😴 Kimse zamanında tepki vermedi. Sıradaki!',
  'game.headsOrTails.name': 'Yazı Tura',
  'game.headsOrTails.desc':
    'Para atışını tahmin et — ben atmadan önce `heads` ya da `tails` yaz. En iyi tahminci kazanır!',
  'game.headsOrTails.intro':
    '🪙 **Yazı Tura** — {rounds} tur. Her turda, ben parayı atmadan önce `heads` ya da `tails` yaz. Her doğru tahmin için 1 puan!',
  'game.headsOrTails.introVoice': 'Hadi yazı tura oynayalım!',
  'game.headsOrTails.round': '🪙 Tur {n}/{total} — heads mı tails mı? Tahminini yaz!',
  'game.headsOrTails.roundVoice': 'Yazı… mı tura mı?',
  'game.headsOrTails.heads': 'heads',
  'game.headsOrTails.tails': 'tails',
  'game.headsOrTails.resultVoice': '{side} geldi!',
  'game.headsOrTails.winners': '**{side}** geldi! Puan: {users}',
  'game.headsOrTails.noWinners': '**{side}** geldi! Kimse bilemedi — puan yok.',
  'game.vozenSays.name': 'Vozen Diyor Ki',
  'game.vozenSays.desc':
    "Yalnızca emir 'Vozen diyor ki' ile başladığında uy. Bir tuzağa düşersen yakalanırsın!",
  'game.vozenSays.intro':
    "🫡 **Vozen Diyor Ki** — {rounds} emir. Bunu YALNIZCA **'Vozen diyor ki'** ile başlarsam yap. Aksi halde kıpırdama!",
  'game.vozenSays.prefix': 'Vozen diyor ki',
  'game.vozenSays.verb': 'yaz',
  'game.vozenSays.real': '🗣️ Tur {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Tur {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** ilk uyan oldu — puan!',
  'game.vozenSays.caught': '🔴 **{user}** — Vozen diyor ki demedim! Yakalandın!',
  'game.vozenSays.nobody': '😴 Kimse **{word}** emrine zamanında uymadı. Sıradaki!',
  'game.vozenSays.trapCleared':
    '😌 Bir tuzaktı — iyi fark ettiniz, kimse **{word}** tuzağına düşmedi.',
  'game.roulette.name': 'Doğruluk mu Cesaret mi Ruleti',
  'game.roulette.desc':
    'Çarkı çevirir ve bir doğruluk-cesaret sorusunu sesli okurum. Bir yenisi için tekrar çalıştır.',
  'game.roulette.header': '🎯 **Çark diyor ki…**',
  'game.hangman.name': 'Adam Asmaca',
  'game.hangman.desc': 'Kelimeyi birer harf tahmin et — 6 yanlışta oyun biter.',
  'game.hangman.intro':
    '🪢 **Adam Asmaca** — kelimeyi tahmin etmek için birer harf yaz. Kelimenin tamamını da yazabilirsin!',
  'game.hangman.hit': '🟢 **{user}** **{letter}** harfini buldu!',
  'game.hangman.miss': '🔴 **{user}** — **{letter}** yok.',
  'game.hangman.wrongLetters': 'Yanlış: {letters}',
  'game.hangman.win': '🎉 **{user}** çözdü — **{word}**!',
  'game.hangman.lose': '💀 Deneme hakkı bitti! Kelime **{word}** idi.',
  'game.hangman.idle': '🕹️ Oyun duraklatıldı (oynayan yok). Kelime **{word}** idi.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    '5 harfli kelimeyi tahmin et. 🟩 doğru yer, 🟨 yanlış yer, ⬛ kelimede yok. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — 5 harfli bir kelime yaz. {max} tahmini paylaşırsınız. 🟩 doğru yer · 🟨 yanlış yer · ⬛ kelimede yok.',
  'game.wordle.guess': '🔤 **{user}** tahmin etti — **{left}** tahmin kaldı',
  'game.wordle.inWord': '🟢 kelimede: {letters}',
  'game.wordle.out': '🚫 elenen: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** {n} denemede bildi — **{word}**!',
  'game.wordle.lose': '💀 Tahminler bitti! Kelime **{word}** idi.',
  'game.wordle.idle': '🕹️ Oyun duraklatıldı (oynayan yok). Kelime **{word}** idi.',
  'game.tictactoe.name': 'XOX',
  'game.tictactoe.desc':
    'İki oyuncu — işaretini koymak için 1-9 arası bir sayı yaz. Üçü bir sırada olan kazanır.',
  'game.tictactoe.intro':
    '⭕ **XOX** — ilk hamle yapan iki oyuncu ❌ ve ⭕ olur (❌ başlar). Hücreni oynamak için 1-9 arası bir sayı yaz.',
  'game.tictactoe.turn': 'Sıra: **{mark}**',
  'game.tictactoe.notYourTurn': "⏳ **{user}**, sıra **{mark}**'te.",
  'game.tictactoe.taken': '🚫 {cell} hücresi dolu — başka birini seç.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) kazandı!',
  'game.tictactoe.draw': '🤝 Berabere!',
  'game.tictactoe.idle': '🕹️ Oyun sona erdi (oynayan yok).',
  'game.chess.name': 'Satranç',
  'game.chess.desc':
    'İki oyuncu — gerçek satranç kuralları (şah, rok, terfi…). "e4" veya "Nf3" gibi bir hamle yaz. 💎 Premium.',
  'game.chess.intro':
    '♟️ **Satranç** — ilk hamle yapan iki oyuncu Beyaz ve Siyah olur (Beyaz başlar). Cebirsel notasyonla ("e4", "Nf3", "O-O") veya koordinatlarla ("e2e4") bir hamle yaz. Pes etmek için "resign" yaz.',
  'game.chess.white': 'Beyaz',
  'game.chess.black': 'Siyah',
  'game.chess.seats': '⚪ Beyaz: **{white}** · ⚫ Siyah: **{black}**',
  'game.chess.turn': '{move} — sıra: **{color}**',
  'game.chess.check': '♟️ Şah!',
  'game.chess.notYourTurn': "⏳ **{user}**, sıra **{color}**'ta.",
  'game.chess.illegalMove': '🚫 "{move}" geçerli bir hamle değil — tekrar dene.',
  'game.chess.checkmate': '🏆 Şah mat ({move})! **{user}** kazandı!',
  'game.chess.draw': '🤝 Berabere ({move})!',
  'game.chess.resigned': '🏳️ **{user}** pes etti — **{winner}** kazandı!',
  'game.chess.idle': '🕹️ Oyun sona erdi (oynayan yok).',
  'game.wordChain.name': 'Kelime Zinciri',
  'game.wordChain.descr':
    'Tek bir dilde sıra tabanlı kelime zinciri: bir öncekinin son harfiyle başlayan bir kelime söyle. 2 can, tekrar yok, saat hızlanır. Dili `language` seçeneğiyle seç. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Kelime Zinciri şu anda **{lang}** dilinde kullanılamıyor (kelime listesi eksik).',
  'game.wordChain.lobby':
    '🔗 **{lang}** dilinde **Kelime Zinciri**! Katılmak için **{seconds}sn** içinde bu kanala herhangi bir şey yaz.',
  'game.wordChain.notEnough': '😴 Yeterli oyuncu katılmadı (en az 2 gerekir). Oyun iptal edildi.',
  'game.wordChain.begin':
    '🚀 Başlıyor! Oyuncular: {players}. Her kelime bir öncekinin son harfiyle başlamalı.',
  'game.wordChain.turn':
    '**{name}**, sıra sende! **{letter}** ile başlayan bir **{lang}** kelimesi — {hearts} · ⏱️ {seconds}sn',
  'game.wordChain.accepted': '✅ **{word}** — sonraki harf: **{letter}**',
  'game.wordChain.bad.letter': '↪️ **{letter}** ile başlamalı.',
  'game.wordChain.bad.short': '📏 Çok kısa — en az **{min}** harf.',
  'game.wordChain.bad.repeated': '🔁 Bu kelime zaten kullanıldı.',
  'game.wordChain.bad.word': '📖 Bu sözlükte yok.',
  'game.wordChain.bad.latin': '🔤 Yalnızca A–Z harfleri sayılır.',
  'game.wordChain.timeout': '⏰ **{name}** süresi doldu! {hearts} kaldı.',
  'game.wordChain.eliminated': '💀 **{name}** elendi!',
  'game.wordChain.winner': '🏆 **{name}** zinciri kazandı! ({chain} kelime)',
  'game.stats.none': 'Henüz hiç oyun oynamadın. `/game play` dene!',
  'game.stats.body': '🎮 **İstatistiklerin** — **{points}** puan · **{wins}** galibiyet · {rank}',
  'game.stats.rank': 'sıralama **#{rank}** / {total}',
  'game.stats.unranked': 'henüz sıralanmadı',
  'game.pickPrompt': '🎮 Hangi oyunu oynamak istersin? Birini seç:',
  'game.pickPlaceholder': 'Bir oyun seç…',
  'game.pickTimeout': '⏰ Oyun seçilmedi — hazır olduğunda `/game play` komutunu tekrar çalıştır.',
  'pron.listHeader': '🗣️ **Telaffuzların** ({count}/{limit}):',
  'pron.listEmpty': 'Henüz hiç yok — `/pronunciation add` ile bir tane ekle.',
  'pron.set': '✅ Kaydedildi! **Sen** “{term}” yazdığında, ben “{replacement}” derim.',
  'pron.removed': '🗑️ “{term}” kaldırıldı.',
  'pron.notFound':
    '“{term}” için bir telaffuzun yok. Kendininkileri `/pronunciation list` ile gör.',
  'pron.empty': 'Kelime ve nasıl söyleneceği boş olamaz.',
  'pron.limitHit':
    '🔒 **{limit}** telaffuz sınırına ulaştın. `/pronunciation remove` ile birini kaldır.',
  'pron.limitUpsell': "💎 Vozen Plus veya Premium bunu **50**'ye çıkarır → {url}",
  'pron.modalTitle': "Vozen'e bir telaffuz öğret",
  'pron.modalTerm': 'Kelime (yazıldığı gibi)',
  'pron.modalSay': "Vozen'in nasıl söylemesi gerektiği",
  'spron.listHeader': '🗣️ **Sunucu telaffuzları** ({count}/{limit}) — herkese uygulanır:',
  'spron.listEmpty': 'Henüz yok — `/server-pronunciation add` ile bir tane ekle.',
  'spron.set': '✅ Tüm sunucu için kaydedildi! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ “{term}” sunucudan kaldırıldı.',
  'spron.notFound': 'Sunucunun “{term}” için bir telaffuzu yok.',
  'spron.limitHit':
    '🔒 Sunucu **{limit}** telaffuz sınırına ulaştı. `/server-pronunciation remove` ile birini kaldır.',
  'spron.modalTitle': 'Sunucu telaffuzu',
  'spron.modalSay': "Vozen'in bunu herkes için nasıl söyleyeceği",
  'rand.selectPrompt': '🎲 **Rastgele Seçici** — kaç seçenek arasından seçmemi istersin?',
  'rand.selectPlaceholder': 'Seçenek sayısı…',
  'rand.selectOption': '{n} seçenek',
  'rand.filling': '📝 Az önce açılan formu doldur!',
  'rand.modalTitle': 'Rastgele Seçici — {amount} seçenek',
  'rand.modalOption': 'Seçenek {n}',
  'rand.needTwo': 'Bana virgülle ayrılmış en az 2 seçenek ver (örn. "pizza, suşi").',
  'rand.result': '{count} seçenek arasından şunu seçiyorum… **{winner}**!',
  'rand.speak': 'Şunu seçiyorum… {winner}!',
  'rand.notInVoice': '_(benimle bir ses kanalına katıl, bir dahaki sefere sesli söyleyeyim)_',
  'rand.timeout':
    '⏰ Hiçbir şey seçilmedi — hazır olduğunda `/randomizer` komutunu tekrar çalıştır.',
};
