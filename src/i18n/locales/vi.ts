export default {
  'error.generic': 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  'error.needManageGuild': 'Bạn cần quyền **Quản lý máy chủ** để làm điều đó.',
  'join.needVoiceChannel': 'Hãy vào một kênh thoại trước, rồi chạy /join.',
  'join.missingPerms': 'Tôi cần quyền **Kết nối** và **Nói** trong {channel}.',
  'join.joined':
    '✅ Tôi đã vào {channel}! Bước tiếp theo: gõ `/tts hello` và tôi sẽ đọc to lên. Muốn tôi tự động đọc một kênh? Hãy chạy /setup.',
  'join.joinedAutoread':
    '✅ Tôi đã vào {channel}! Mọi thứ đã sẵn sàng. Hãy gõ trong kênh tự động đọc và tôi sẽ đọc to lên. → {readChannel}',
  'leave.left': 'Đã rời kênh thoại. Hẹn gặp lại lần sau!',
  'skip.notInVoice':
    'Tôi chưa ở trong kênh thoại nào — hãy vào một kênh và chạy /join trước, rồi thử lại.',
  'skip.skipped': 'Đã bỏ qua.',
  'skip.nothing': 'Hiện không có gì đang phát cả.',
  'tts.notInVoice':
    'Tôi chưa ở trong kênh thoại nào — hãy vào một kênh và chạy /join, rồi thử lại.',
  'tts.nothingToRead': 'Chẳng có gì để đọc ở đó — hãy gửi cho tôi một đoạn văn bản để đọc.',
  'tts.nothingAfterClean':
    'Sau khi dọn dẹp thì chẳng còn gì để đọc — hãy thử văn bản bình thường (chữ cái hoặc từ ngữ).',
  'tts.tooFast': 'Ối, chậm lại một chút nào — thử lại sau giây lát nhé.',
  'tts.blocked': 'Văn bản đó chứa một từ bị chặn, nên tôi đã bỏ qua.',
  'tts.queued': 'Đã nhận — nó đang nằm trong hàng đợi.',
  'tts.busy': 'Tôi đang bận — thử lại sau giây lát nhé.',
  'voice.unknownModel': 'Tôi không biết giọng đó — hãy kiểm tra /voice list.',
  'voice.badSpeed':
    'Tốc độ phải nằm trong khoảng 0.5 đến 2.0 (1.0 là bình thường). Thử `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Giọng của bạn giờ là **{name}** ở tốc độ {speed}×. Thử `/tts hello` để nghe thử. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Thiết lập giọng nói** — chọn các tùy chọn bên dưới rồi nhấn **Lưu**. Sẽ không có gì thay đổi cho đến lúc đó.',
  'voice.config.summary': 'Lựa chọn hiện tại: **{voice}** · bộ máy **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Ngôn ngữ…',
  'voice.config.pickVoice': 'Giọng nói…',
  'voice.config.pickEngine': 'Bộ máy…',
  'voice.config.pickSpeed': 'Tốc độ…',
  'voice.config.more': '▼ Thêm ngôn ngữ',
  'voice.config.engDefault': 'Mặc định (cục bộ)',
  'voice.config.save': 'Lưu',
  'voice.config.cancel': 'Hủy',
  'voice.config.cancelled': 'Đã hủy thiết lập — không có gì thay đổi.',
  'voice.config.expired': 'Bảng điều khiển đã hết hạn — chạy lại `/voice config` để tiếp tục.',
  'voice.listHeader': 'Các giọng có sẵn:',
  'voice.listEmpty': '(chưa cài giọng nào)',
  'voice.reset':
    '✅ Giọng của bạn đã trở về mặc định. Chọn giọng khác bất cứ lúc nào với `/voice list` và `/voice set`.',
  'voice.optout': 'Bạn sẽ không còn được đọc tự động nữa. Chạy /voice opt-in để bật lại.',
  'voice.optin': 'Bạn sẽ lại được đọc tự động.',
  'voice.notInVoice': 'Tôi chưa ở trong kênh thoại nào — hãy chạy /join trước.',
  'voice.previewPlaying': 'Đang phát một đoạn mẫu…',
  'preview.sample': 'Chào, tôi là Vozen. Gõ ra, nghe ngay.',
  'laugh.playing': 'Haha! Đang phát tiếng cười bằng giọng của bạn…',
  'joke.playing': 'Đang kể một câu chuyện cười…\n> {joke}',
  'joke.unknownLang': 'Tôi không biết ngôn ngữ đó. Hãy chọn một ngôn ngữ trong danh sách.',
  'voice.abbrev.added': 'Đã nhận — {term} sẽ được đọc thành {replacement}.',
  'voice.abbrev.removed': 'Đã xóa cách viết tắt của bạn cho {term}.',
  'voice.abbrev.listHeader': 'Các từ viết tắt cá nhân của bạn (đã dùng {count}/{cap}):',
  'voice.abbrev.listEmpty': '(chưa có — thêm một từ với /voice abbrev add)',
  'voice.abbrev.capReached':
    'Bạn đã đạt giới hạn {cap} từ viết tắt cá nhân. Hãy xóa bớt một từ trước khi thêm từ khác.',
  'voice.abbrev.invalidTerm':
    'Thuật ngữ phải là một từ duy nhất (chỉ chữ cái và chữ số), tối đa 50 ký tự.',
  'voice.abbrev.emptyReplacement': 'Cách đọc không được để trống.',
  'voice.abbrev.tooLong': 'Cách đọc quá dài (tối đa 200 ký tự).',
  'config.wordEmpty': 'Từ không được để trống.',
  'config.blocked': 'Đã chặn: {word}.',
  'config.unblocked': 'Đã bỏ chặn: {word}.',
  'config.pronListHeader': 'Từ điển phát âm:',
  'config.pronEmptyValue': '(trống)',
  'config.listEmpty': '(không có)',
  'config.termEmpty': 'Thuật ngữ không được để trống.',
  'config.pronEmpty': 'Cách phát âm không được để trống.',
  'config.pronSet': 'Đã nhận — {term} sẽ được đọc thành {replacement}.',
  'config.pronRemoved': 'Đã xóa cách phát âm cho {term}.',
  'config.channelWrongType': 'Hãy chọn một kênh văn bản (không phải kênh thoại hay danh mục).',
  'config.channelNoAccess': 'Tôi không thấy {channel} — vui lòng kiểm tra quyền của tôi ở đó.',
  'config.channelSet':
    'Đã đặt kênh tự động đọc thành {channel}. Tiếp theo: đảm bảo tự động đọc đã bật với `/config auto-read active:true`.',
  'config.autoreadOn': 'Tự động đọc giờ đã **bật**.',
  'config.autoreadOff': 'Tự động đọc giờ đã **tắt**.',
  'config.maxCharsRange': 'Giá trị số ký tự tối đa phải nằm trong khoảng 1 đến 2000.',
  'config.maxCharsSet': 'Đã đặt số ký tự tối đa mỗi tin nhắn là {value}.',
  'config.rateLimitRange': 'Giá trị giới hạn tần suất phải nằm trong khoảng 1 đến 120.',
  'config.rateLimitSet': 'Đã đặt giới hạn tần suất là {value} tin nhắn mỗi phút.',
  'config.roleSet': 'Tự động đọc giờ chỉ giới hạn cho thành viên có {role}.',
  'config.roleCleared': 'Đã gỡ hạn chế theo vai trò — giờ mọi người đều có thể được đọc.',
  'config.enabledOn': 'TTS giờ đã **bật** cho máy chủ này.',
  'config.enabledOff': 'TTS giờ đã **tắt** cho máy chủ này.',
  'config.defaultVoiceSet':
    '✅ Đã đặt giọng mặc định của máy chủ thành **{name}**. Thành viên chưa có giọng riêng sẽ nghe giọng này. (id: `{model}`)',
  'config.reset':
    'Đã đặt lại cấu hình về mặc định. Danh sách chặn và cách phát âm của bạn được giữ nguyên.',
  'config.showTitle': '**Cấu hình máy chủ**',
  'config.showChannel': 'Kênh TTS: {value}',
  'config.showAutoread': 'Tự động đọc: {value}',
  'config.showRole': 'Vai trò: {value}',
  'config.showEnabled': 'Đã bật: {value}',
  'config.showVoice': 'Giọng mặc định: {value}',
  'config.showMaxChars': 'Số ký tự tối đa: {value}',
  'config.showRateLimit': 'Giới hạn tần suất: {value}/phút',
  'config.showBlocklist': 'Danh sách chặn: {count} từ',
  'config.showPronunciation': 'Cách phát âm: {count} mục',
  'config.valueNone': '(không có)',
  'config.valueAny': 'bất kỳ ai',
  'config.valueAutoDetect': '(tự động nhận diện)',
  'config.on': 'bật',
  'config.off': 'tắt',
  'config.language.set': 'Đã đặt ngôn ngữ giao diện thành {language}.',
  'config.language.unsupported': 'Ngôn ngữ đó chưa được hỗ trợ.',
  'setup.noChannel':
    'Tôi không biết nên dùng kênh nào. Hãy chỉ định một kênh văn bản trong tùy chọn "channel".',
  'setup.channelWrongType':
    'Kênh tự động đọc phải là kênh văn bản (không phải kênh thoại hay danh mục). Hãy chỉ định một kênh trong tùy chọn "channel".',
  'setup.done': '**Xong hết rồi — Vozen đã sẵn sàng.**',
  'setup.channelLine': 'Kênh tự động đọc: {channel}',
  'setup.autoreadOn': 'Tự động đọc: bật',
  'setup.permsHeader': '**Quyền hạn:**',
  'setup.permView': 'ViewChannel (xem kênh văn bản)',
  'setup.permSend': 'SendMessages (đăng bài trong kênh văn bản)',
  'setup.permConnect': 'Connect (vào kênh thoại)',
  'setup.permSpeak': 'Speak (nói trong kênh thoại)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — thiếu',
  'setup.permUnchecked': '⏳ {label} — chưa kiểm tra (tôi sẽ xác minh khi bạn /join)',
  'setup.fixHint':
    'Để khắc phục những gì còn thiếu: trong cài đặt máy chủ, mở vai trò của Vozen (hoặc quyền của kênh) và bật các mục được đánh dấu ❌.',
  'setup.voiceUncheckedNote':
    'Bạn chưa ở trong kênh thoại nào, nên tôi chưa thể kiểm tra Connect/Speak — tôi sẽ xác minh khi bạn chạy /join.',
  'setup.allGood': 'Mọi thứ đã sẵn sàng. Hãy vào một kênh thoại và chạy /join.',
  'setup.joinedVoice': 'Tôi cũng đã vào {channel} rồi — không cần chạy /join đâu.',
  'setup.readyTalk': 'Mọi thứ đã sẵn sàng. Hãy gõ trong kênh tự động đọc và tôi sẽ đọc to lên.',
  'setup.membersHeader': '**Hãy hướng dẫn thành viên (quy trình 3 bước):**',
  'setup.membersBody':
    '1) Vào một kênh thoại\n2) Chạy /join để tôi vào cùng bạn\n3) Gõ trong kênh này (hoặc dùng /tts) và tôi sẽ đọc to lên\nDanh sách lệnh đầy đủ: /help',
  'stats.title': '**Thống kê Vozen**',
  'stats.messagesSpoken': 'Số tin nhắn đã đọc: {value}',
  'stats.cacheHits': 'Lượt trúng bộ nhớ đệm: {value}',
  'stats.cacheMisses': 'Lượt trượt bộ nhớ đệm: {value}',
  'stats.synthErrors': 'Lỗi tổng hợp giọng: {value}',
  'stats.voiceDrops': 'Số lần rớt thoại: {value}',
  'stats.voiceReconnects': 'Số lần kết nối lại: {value}',
  'stats.votes': 'Lượt bình chọn top.gg: {value}',
  'stats.activePlayers': 'Trình phát đang hoạt động: {value}',
  'stats.servers': 'Máy chủ: {value}',
  'stats.uptime': 'Thời gian hoạt động: {value}s',
  'invite.noClientId':
    'Liên kết mời Vozen chưa được thiết lập (thiếu CLIENT_ID). Hãy báo cho quản trị viên bot.',
  'invite.link': 'Thêm Vozen vào máy chủ của bạn:\n{url}',
  'vote.noClientId':
    'Liên kết bình chọn Vozen chưa được thiết lập (thiếu CLIENT_ID). Hãy báo cho quản trị viên bot.',
  'vote.link':
    'Bình chọn cho Vozen (miễn phí, mỗi 12 giờ) và giúp nhiều người biết đến nó hơn:\n{url}\nNếu tài khoản này chưa từng nhận thưởng, tài khoản sẽ có **48 giờ Vozen Plus**, chỉ một lần cho mỗi tài khoản.',
  'help.title': 'Vozen — gõ ra, nghe ngay.',
  'help.embedTitle': 'Vozen — Các lệnh',
  'help.intro':
    'Vozen đọc to văn bản của bạn trong kênh thoại — giọng neural miễn phí, hàng chục ngôn ngữ.',
  'help.quickStartTitle': 'Bắt đầu nhanh (3 bước)',
  'help.quickStartBody':
    '1) Vào một kênh thoại, rồi chạy /join\n2) Gõ trong kênh văn bản (hoặc dùng /tts Chào mọi người!)\n3) (tùy chọn) Chọn một giọng với /voice set',
  'help.groupStarted': 'Bắt đầu',
  'help.groupStartedBody':
    '• /join — Tôi vào kênh thoại của bạn\n• /leave — Tôi rời kênh thoại\n• /tts <text> — Tôi đọc to văn bản · ví dụ /tts Chào mọi người!\n• /skip — bỏ qua nội dung tôi đang đọc',
  'help.groupVoice': 'Giọng của bạn',
  'help.groupVoiceBody':
    '• /voice set <model> — chọn giọng của bạn · ví dụ /voice set en_US-amy-medium\n• /voice list — xem các giọng có sẵn\n• /voice preview — nghe thử một đoạn mẫu giọng của bạn\n• /voice reset — trở về giọng mặc định\n• /voice opt-out · /voice opt-in — tắt / bật tự động đọc cho bạn\n• /voice abbrev add|remove|list — từ lóng cá nhân, đọc theo cách của bạn (tối đa 10)',
  'help.groupFun': 'Giải trí',
  'help.groupFunBody':
    '• /joke — Tôi kể một câu chuyện cười ngắn (chọn ngôn ngữ + tùy chọn tiếng cười) · ví dụ /joke English\n• /laugh — Tôi cười to bằng giọng hiện tại của bạn',
  'help.groupAdmin': 'Quản trị máy chủ (cần Quản lý máy chủ)',
  'help.groupAdminBody':
    '• /setup — cấu hình một bước có hướng dẫn · chạy lệnh này trước\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · ví dụ /config tts-channel #general\n• /stats — thống kê bot',
  'help.groupMore': 'Thêm',
  'help.groupMoreBody':
    '• /invite — thêm Vozen vào máy chủ khác\n• /vote — bình chọn cho Vozen trên top.gg\n• /help — hiển thị trợ giúp này',
  'help.footer': 'Mới đến à? Chạy {command} để bắt đầu.',
  'welcome.title': 'Cảm ơn bạn đã thêm Vozen! 👋',
  'welcome.description':
    'Vozen đọc to cuộc trò chuyện của bạn trong kênh thoại — gõ ra, nghe ngay.\n\n**Bắt đầu chỉ trong một bước:** chạy {setup} và tôi sẽ thiết lập tự động đọc rồi vào kênh thoại của bạn.\n\nCần danh sách lệnh đầy đủ? Chạy {help}.',
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': 'Cách thành viên sử dụng (3 bước)',
  'welcome.stepsBody':
    '1) Vào một kênh thoại\n2) Chạy /join để tôi vào cùng bạn\n3) Gõ trong kênh văn bản (hoặc dùng /tts) và tôi sẽ đọc to lên\nDanh sách lệnh đầy đủ: /help',
  'welcome.footer': 'Vozen — gõ ra, nghe ngay.',
  'welcome.tagline': 'Giọng neural tự nhiên — miễn phí mãi mãi, không tường phí.',
  'stt.guildOnly': 'Chức năng ghi lời thoại chỉ hoạt động trong một máy chủ.',
  'stt.noManage': 'Bạn cần quyền **Quản lý máy chủ** để bắt đầu hoặc dừng ghi lời thoại.',
  'stt.notPremium':
    '🎙️ Ghi lời thoại trực tiếp là tính năng **Premium**. Xem `/premium info` để mở khóa cho máy chủ này.',
  'stt.unavailable':
    'Ghi lời thoại không khả dụng trên phiên bản này (chưa cài đặt bộ máy chuyển giọng nói thành văn bản).',
  'stt.notInVoice':
    'Tôi chưa ở trong kênh thoại nào — hãy vào một kênh và chạy `/join` trước, rồi bắt đầu ghi lời thoại.',
  'stt.alreadyRunning':
    'Ghi lời thoại đã đang chạy trên máy chủ này. Hãy dùng `/transcribe stop` trước.',
  'stt.atCapacity':
    'Hiện có quá nhiều phiên ghi lời thoại đang chạy trên tất cả các máy chủ. Vui lòng thử lại sau giây lát.',
  'stt.noChannel':
    'Tôi không thể đăng bản ghi trong kênh này. Hãy thử chạy lệnh từ một kênh văn bản thông thường.',
  'stt.started':
    '✅ Đã bắt đầu ghi lời thoại. Bất kỳ ai nhấn **Đồng ý** trong thông báo sẽ được ghi lời thoại vào kênh này.',
  'stt.startFailed':
    'Không thể bắt đầu ghi lời thoại (đăng thông báo thất bại). Tôi đã hoàn tác mọi thứ — không có gì đang được ghi lại. Vui lòng thử lại.',
  'stt.announceStart':
    '🎙️ **Ghi lời thoại trực tiếp đang BẬT trong kênh này.** Chỉ những người đồng ý mới được ghi lời thoại — hãy nhấn nút bên dưới để cho phép lời nói của bạn được viết ra đây. Bạn có thể rút lại bất cứ lúc nào với `/transcribe revoke`.',
  'stt.consentBtn': 'Đồng ý được ghi lời thoại',
  'stt.consentThanks':
    '✅ Cảm ơn — lời nói của bạn giờ sẽ được ghi lời thoại trên máy chủ này. Rút lại bất cứ lúc nào với `/transcribe revoke`.',
  'stt.stopped': '🛑 Đã dừng ghi lời thoại.',
  'stt.notRunning': 'Ghi lời thoại không đang chạy trên máy chủ này.',
  'stt.announceStop': '🛑 **Ghi lời thoại trực tiếp giờ đã TẮT.** Tôi đã ngừng lắng nghe.',
  'stt.revoked':
    '✅ Đã rút lại đồng ý — bạn sẽ không còn được ghi lời thoại trên máy chủ này nữa. (Các tin nhắn đã đăng vẫn còn; hãy xóa chúng trong Discord nếu bạn muốn.)',
  'stt.revokeNone': 'Bạn chưa đồng ý ghi lời thoại trên máy chủ này, nên không có gì để rút lại.',
  'privacy.eraseConfirm':
    '⚠️ Thao tác này xóa vĩnh viễn **toàn bộ** dữ liệu Vozen của bạn trên mọi máy chủ: cài đặt giọng, biệt danh đọc to, các từ viết tắt và cách phát âm cá nhân, ngày sinh đã lưu, điểm trò chơi, thống kê trò chuyện, và tùy chọn không đọc. **Không thể hoàn tác việc này.** Bạn có chắc không?',
  'privacy.erasePremiumNote':
    '_Lưu ý: gói Premium/Plus đã trả phí và lịch sử mua hàng của bạn được giữ lại — chúng thuộc về bạn và thuộc hồ sơ tài chính bắt buộc theo luật. Để dừng Premium, hãy để nó hết hạn hoặc liên hệ hỗ trợ._',
  'privacy.eraseYes': 'Xóa mọi thứ',
  'privacy.eraseNo': 'Hủy',
  'privacy.eraseCancelled': 'Đã hủy — không có gì bị xóa.',
  'privacy.eraseDone': '✅ Xong. Toàn bộ dữ liệu cá nhân của bạn đã bị xóa vĩnh viễn.',
  'shutup.notInVoice': 'Tôi chưa ở trong kênh thoại nào — hãy vào một kênh và chạy /join trước.',
  'shutup.nothing': 'Hiện không có gì đang phát cả.',
  'shutup.done': '🤐 Được rồi, tôi sẽ dừng — đã xóa sạch hàng đợi.',
  'voice.detection.on':
    '✅ Tự động nhận diện ngôn ngữ đang BẬT: mỗi tin nhắn được đọc bằng một giọng theo ngôn ngữ được nhận diện (giọng đọc có thể thay đổi). Tắt với `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Tự động nhận diện ngôn ngữ đang TẮT: một giọng cố định của bạn sẽ đọc mọi thứ, nên bạn luôn nghe giống nhau.',
  'voice.nickname.set': '✅ Vozen giờ sẽ gọi bạn là **{name}** khi đọc to.',
  'voice.nickname.cleared': '✅ Đã xóa biệt danh đọc to — Vozen sẽ dùng tên của bạn trên máy chủ.',
  'voice.nickname.invalid': 'Tên đó không có gì để đọc to được. Hãy thử chữ cái hoặc số.',
  'voice.effect.set':
    '✅ Đã đặt hiệu ứng giọng thành **{effect}** — các tin nhắn của bạn giờ sẽ phát với hiệu ứng đó. Dùng `/voice effect none` để tắt.',
  'voice.effect.cleared': '✅ Đã gỡ hiệu ứng giọng — giọng sạch trở lại.',
  'voice.effect.locked':
    '🔒 **{effect}** là hiệu ứng Premium. Hiệu ứng miễn phí: 🤖 Robot và 🔊 Echo. Mở khóa tất cả với Vozen Premium — xem `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** là bộ máy giọng Premium. Mở khóa với Vozen Plus (cá nhân) hoặc Vozen Premium (máy chủ) — xem `/premium`. Trong lúc đó giọng của bạn vẫn dùng bộ máy cục bộ miễn phí.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** là bộ máy giọng Premium. Mở khóa với Vozen Plus (cá nhân) hoặc Vozen Premium (máy chủ) — xem `/premium`. Trong lúc đó giọng của bạn vẫn dùng bộ máy cục bộ miễn phí.',
  'rizz.playing': '😏 Thả vài câu thả thính…\n> {line}',
  'rizz.unknownLang': 'Tôi không biết ngôn ngữ đó. Hãy chọn một ngôn ngữ trong danh sách.',
  'rizz.locked':
    '🔒 **/rizz** là đặc quyền Premium. Mở khóa với Vozen Plus (bạn) hoặc Premium (máy chủ này). Xem `/premium`.',
  'sound.playing': '🔊 Đang phát **{name}**…',
  'sound.unknown': 'Tôi không có âm thanh đó. Chạy `/sound` để xem danh sách.',
  'sound.list':
    '🔊 **Âm thanh:** {sounds}\nPhát một âm thanh với `/sound name:<sound>` (tôi cần ở trong kênh thoại của bạn).',
  'sound.disabled':
    '🔇 Bảng âm thanh đang **tắt** trên máy chủ này. Quản trị viên có thể bật nó với `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Đã lưu ngày sinh: **{day}/{month}**. Tôi sẽ chúc mừng sinh nhật bạn khi bạn vào kênh thoại vào ngày đó!',
  'birthday.invalid': 'Đó không phải ngày có thật. Hãy kiểm tra ngày và tháng.',
  'birthday.cleared': '🎂 Đã xóa ngày sinh.',
  'birthday.show': '🎂 Ngày sinh của bạn được đặt là **{day}/{month}**.',
  'birthday.none': 'Bạn chưa đặt ngày sinh. Hãy dùng `/birthday set`.',
  'topspeakers.title': '🗣️ **Người nói nhiều nhất** — người tôi đọc nhiều nhất trên máy chủ này:',
  'topspeakers.empty': 'Tôi chưa đọc tin nhắn của ai cả. Hãy thiết lập một kênh đọc với `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** tin nhắn · 🔥 chuỗi {streak} ngày',
  'serverstats.title': '📊 **Thống kê máy chủ**',
  'serverstats.empty':
    'Chưa có thống kê nào — tôi chưa đọc tin nhắn hay chạy trò chơi nào ở đây. Hãy thiết lập với `/setup`!',
  'serverstats.messages': '🗣️ **{total}** tin nhắn đã đọc · **{speakers}** người',
  'serverstats.topTalkers': '**Người nói nhiều nhất:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} tin · 🔥 {streak}d',
  'serverstats.streak': '🔥 Chuỗi hoạt động dài nhất: **{days}** ngày',
  'serverstats.games':
    '🎮 **{points}** điểm trò chơi · **{wins}** chiến thắng · **{players}** người chơi',
  'serverstats.topPlayers': '**Người chơi hàng đầu:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} điểm · {wins} thắng',
  'serverstats.upsell':
    '🔒 Đó là bản xem trước miễn phí. **Premium** mở khóa chuỗi ngày, thống kê trò chơi và toàn bộ top 5 — xem `/premium`.',
  'streak.day': '🔥 <@{user}> đang có chuỗi **{n} ngày**! Hãy tiếp tục trò chuyện để duy trì nó.',
  'leaderboard.autoTitle': '🏆 Người nói nhiều nhất trong máy chủ này',
  'premium.title': '💎 **Trạng thái Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Máy chủ:** Premium đến {date}',
  'premium.lineServerFree': '🖥️ **Máy chủ:** Gói miễn phí',
  'premium.lineUserActive': '👤 **Bạn (Plus):** hoạt động đến {date}',
  'premium.lineUserFree': '👤 **Bạn (Plus):** chưa kích hoạt',
  'premium.getHint':
    'Mọi thứ bạn dùng hôm nay vẫn miễn phí. Premium bổ sung cả 8 hiệu ứng giọng, 24/7 trong cuộc gọi, 50 cách phát âm cá nhân, /rizz và các trò chơi premium. Ủng hộ: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Vé Premium của bạn:** đang dùng {used}/{total} giấy phép · hết hạn {date}',
  'premium.passServers': '↳ Đang dùng trên: {servers}',
  'premium.pitch':
    'Bạn chưa có Premium. **Vozen Premium** (€3.99/tháng cho 3 máy chủ, hoặc €7.99/tháng cho 8) mở khóa cho toàn máy chủ: cả 8 hiệu ứng giọng, 24/7 trong cuộc gọi, 50 cách phát âm cá nhân (so với 3), lệnh /rizz và các trò chơi premium (Nối Chữ, Wordle, Cờ Vua). **Vozen Plus** (€1.99/tháng) cho bạn những đặc quyền đó theo cá nhân, trên bất kỳ máy chủ nào.',
  'premium.buyHint':
    '▶ **Nhận Premium:** {link}\nSau khi mua, chạy `/premium activate` trên máy chủ bạn muốn.',
  'premium.confirmActivate':
    'Dùng **1 trong số {total} giấy phép Premium của bạn** cho **máy chủ này**? Hiện bạn đang dùng **{used}** giấy phép. Bạn có thể giải phóng nó sau với `/premium deactivate` — dù sao thời gian của vé vẫn tiếp tục chạy.',
  'premium.confirmYes': '💎 Dùng một giấy phép',
  'premium.confirmNo': 'Hủy',
  'premium.activateOk':
    '✅ Premium giờ đã kích hoạt trên **máy chủ này** đến {date}. Giấy phép: đang dùng **{used}/{total}**.',
  'premium.activateCancelled': 'Đã hủy — không dùng giấy phép nào.',
  'premium.activateTimeout': 'Hết thời gian — không dùng giấy phép nào.',
  'premium.noPass':
    'Bạn không có vé Premium nào đang hoạt động. Hãy mua một vé và nó sẽ vào tài khoản của bạn — rồi chạy `/premium activate` ở đây.\n▶ {link}',
  'premium.alreadyActive':
    'Máy chủ này đã có một trong các giấy phép Premium của bạn. Không cần làm gì.',
  'premium.noSeats':
    'Cả **{total}** giấy phép Premium của bạn đều đang được dùng ({servers}). Hãy giải phóng một giấy phép với `/premium deactivate` ở đó, rồi thử lại ở đây.',
  'premium.needManageGuild':
    'Kích hoạt Premium ảnh hưởng đến toàn máy chủ — chỉ thành viên có quyền **Quản lý máy chủ** mới làm được. Hãy hỏi quản trị viên.',
  'premium.deactivateOk':
    '✅ Đã giải phóng giấy phép Premium của máy chủ này. Dùng nó trên máy chủ khác với `/premium activate`.',
  'premium.deactivateNone': 'Máy chủ này không có giấy phép Premium nào của bạn để giải phóng.',
  'premium.thisServer': 'máy chủ này',
  'grant.denied': '⛔ Lệnh này chỉ dành cho chủ sở hữu bot.',
  'grant.okPremium':
    '✅ Đã cấp cho <@{user}> một **vé Premium** ({seats} giấy phép) trong **{days}** ngày — hết hạn {date}. Họ kích hoạt nó với `/premium activate`.',
  'grant.okPlus': '✅ Đã cấp cho <@{user}> **Vozen Plus** trong **{days}** ngày — hết hạn {date}.',
  'gencode.done':
    '✅ Đã tạo **{count}** mã {plan}, mỗi mã **{days}** ngày. Hãy chia sẻ riêng tư:\n{list}',
  'redeem.okPlus':
    '🎁 Đã đổi! Bạn nhận được **Vozen Plus** trong **{days}** ngày — hết hạn {date}.',
  'redeem.okPremium':
    '🎁 Đã đổi! Bạn nhận được một **vé Premium** ({seats} giấy phép) trong **{days}** ngày — hết hạn {date}. Kích hoạt nó trong máy chủ của bạn với `/premium activate`.',
  'redeem.notFound': '❌ Mã đó không tồn tại. Hãy kiểm tra lại và thử lại.',
  'redeem.used': '❌ Mã đó đã được đổi rồi.',
  'redeem.expired': '❌ Mã đó đã hết hạn.',
  'config.blockLimit':
    'Máy chủ này đã đạt tối đa {max} từ bị chặn. Hãy xóa bớt một từ trước khi thêm từ khác.',
  'config.xsaidOn':
    'Vozen giờ sẽ thông báo **ai đã nói** trước mỗi tin nhắn (ví dụ "Alex đã nói xin chào"). Tắt với `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen sẽ **không còn** thông báo ai đã nói — chỉ đọc nội dung tin nhắn.',
  'config.autojoinOn':
    '✅ Tự động vào **bật** — Vozen sẽ vào kênh thoại của bạn khi bạn gõ trong kênh TTS.',
  'config.autojoinOff': 'Tự động vào **tắt** — dùng `/join` để đưa Vozen vào kênh thoại.',
  'config.stayOn':
    '✅ 24/7 trong cuộc gọi **bật** — Vozen sẽ ở lại kênh thoại kể cả khi kênh trống, và quay lại sau khi khởi động lại. 💎 Cần Premium để có hiệu lực (mua hoặc `/redeem` một mã, rồi `/premium activate`).',
  'config.stayOff': '24/7 trong cuộc gọi **tắt** — Vozen rời đi khi kênh thoại trống (mặc định).',
  'config.readBotsOn': '✅ Vozen giờ cũng sẽ đọc tin nhắn từ **các bot và webhook khác**.',
  'config.readBotsOff': 'Vozen sẽ **bỏ qua** các bot và webhook khác (chỉ đọc người thật).',
  'config.textInVoiceOn':
    '✅ Vozen cũng sẽ đọc **cuộc trò chuyện văn bản bên trong kênh thoại của nó**.',
  'config.textInVoiceOff':
    'Vozen sẽ **không** đọc cuộc trò chuyện văn bản của kênh thoại (chỉ kênh TTS).',
  'config.antispamOn':
    '✅ Chống spam **bật** — Vozen sẽ không đọc các tin nhắn spam (lặp từ hàng loạt hoặc cùng một tin nhắn dài đăng đi đăng lại).',
  'config.antispamOff': 'Chống spam **tắt** — Vozen đọc mọi tin nhắn như thường lệ.',
  'config.streaksOn':
    '✅ Thông báo chuỗi ngày **bật** — Vozen hiển thị thông báo chuỗi ngày 🔥 vào lần đầu mỗi người nói mỗi ngày.',
  'config.streaksOff':
    'Thông báo chuỗi ngày **tắt** — Vozen vẫn theo dõi chuỗi ngày (xem `/top-speakers`) nhưng không thông báo.',
  'config.soundboardOn': 'Bảng âm thanh **bật** — bất kỳ ai cũng có thể phát clip với `/sound`.',
  'config.soundboardOff': 'Bảng âm thanh **tắt** — `/sound` bị vô hiệu hóa trên máy chủ này.',
  'config.votePromosLabel': 'Thông báo phần thưởng top.gg + Vozen Support',
  'config.greetOn': '✅ Tôi sẽ chào mọi người theo tên khi họ vào kênh thoại.',
  'config.greetOff': '🔇 Tôi sẽ **không** chào mọi người khi họ vào kênh thoại.',
  'config.greetLangSet': '✅ Đã đặt ngôn ngữ lời chào khi vào thành **{language}**.',
  'config.showXsaid': 'Thông báo người nói (xsaid): {value}',
  'config.showAutojoin': 'Tự động vào: {value}',
  'config.showReadBots': 'Đọc bot/webhook: {value}',
  'config.showTextInVoice': 'Văn bản trong thoại: {value}',
  'config.showAntispam': 'Chống spam: {value}',
  'config.showSoundboard': 'Bảng âm thanh (/sound): {value}',
  'config.showGreet': 'Chào khi vào: {value} ({language})',
  'stats.synthLatency': 'Độ trễ tổng hợp giọng: p50 {p50}ms / p95 {p95}ms ({count} mẫu)',
  'speak.emptyMessage': 'Tin nhắn đó không có văn bản để đọc to.',
  'uptime.text': '🟢 Vozen đã trực tuyến được **{uptime}**.',
  'botstats.title': '📊 **Vozen — thống kê**',
  'botstats.servers': 'Máy chủ: **{value}**',
  'botstats.voiceSessions': 'Phiên thoại hiện tại: **{value}**',
  'botstats.messagesSpoken': 'Số tin nhắn đã đọc: **{value}**',
  'botstats.uptime': 'Thời gian hoạt động: **{value}**',
  'invite.button': 'Thêm Vozen',
  'vote.button': 'Bình chọn trên top.gg',
  'vote.upsell':
    '🗳️ Nếu tài khoản này chưa từng nhận thưởng, tài khoản sẽ có **48 giờ Vozen Plus**, chỉ một lần cho mỗi tài khoản. {url}',
  'vote.cooldownStatus':
    '🗳️ Tài khoản này đã dùng phần thưởng bình chọn một lần. Bạn vẫn có thể bình chọn để ủng hộ Vozen, nhưng sẽ không nhận thêm Plus.',
  'help.support': '🛟 Cần trợ giúp hoặc muốn báo cáo sự cố? {url}',
  'help.source': '📄 Mã nguồn mở (AGPL-3.0) — lấy mã nguồn chính xác đang chạy ở đây: {url}',
  'game.start.needVoice':
    'Đây là một **trò chơi bằng giọng nói** — hãy vào một kênh thoại và chạy /join trước, rồi bắt đầu.',
  'game.start.alreadyActive':
    'Đã có một trò chơi đang chạy trong <#{channel}>. Hãy kết thúc nó (hoặc dùng `/game stop`) trước khi bắt đầu trò khác.',
  'game.start.premiumLocked':
    '🔒 **{game}** là một trò chơi Premium (tốn tài nguyên tính toán thật sự). Xem `/premium`.',
  'game.start.started': '🎮 Đang bắt đầu **{game}**! Hãy chú ý kênh — chúc may mắn!',
  'game.start.startedThread':
    '🎮 **{game}** đã bắt đầu trong <#{channel}> — hãy tham gia ở đó! Luồng sẽ tự xóa khi trò chơi kết thúc.',
  'game.thread.winner': '🏆 {winner} đã thắng trò chơi!',
  'game.thread.ended': '🎮 Trò chơi đã kết thúc.',
  'game.unknownGame': 'Tôi không biết trò chơi đó. Hãy chọn một trò trong danh sách.',
  'game.stop.ok': '🛑 Đã dừng trò chơi hiện tại.',
  'game.stop.none': 'Hiện không có trò chơi nào đang chạy.',
  'game.list.title': '🎮 **Trò chơi** — bắt đầu một trò với `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Bảng xếp hạng** — người chơi hàng đầu trên máy chủ này:',
  'game.leaderboard.empty': 'Chưa có trò chơi nào được chơi. Hãy là người đầu tiên — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** điểm ({wins} thắng)',
  'game.finish.title': '🏁 **Kết thúc trò chơi!** Điểm số cuối cùng:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Kết thúc trò chơi — lần này không ai ghi điểm. Hẹn lần sau!',
  'game.finish.winnerVoice': '{user} thắng!',
  'game.guessLanguage.name': 'Đoán Ngôn Ngữ',
  'game.guessLanguage.desc':
    'Tôi đọc một câu bằng một ngôn ngữ ngẫu nhiên — ai gọi tên đúng đầu tiên được điểm.',
  'game.guessLanguage.intro':
    '🗣️ **Đoán Ngôn Ngữ** — tôi sẽ đọc {rounds} câu. Hãy gõ ngôn ngữ bạn nghe được. Câu trả lời đúng nhanh nhất thắng mỗi vòng!',
  'game.guessLanguage.round': '🎧 Vòng {n}/{total} — lắng nghe nào…',
  'game.guessLanguage.correct': '✅ **{user}** đã đoán đúng — đó là **{language}**!',
  'game.guessLanguage.timeout': '⏱️ Hết giờ! Đó là **{language}**.',
  'game.guessLanguage.noLanguages':
    'Tôi chưa cài đủ giọng để chơi trò này. Hãy nhờ quản trị viên thêm giọng.',
  'game.math.name': 'Tính Nhẩm',
  'game.math.desc': 'Tôi đọc to một phép tính — ai gõ kết quả đầu tiên thắng.',
  'game.math.intro':
    '🔢 **Tính Nhẩm** — {rounds} phép tính. Hãy nghe và gõ kết quả nhanh nhất có thể!',
  'game.math.round': '🧮 Vòng {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** đã đúng — kết quả là **{answer}**!',
  'game.math.timeout': '⏱️ Hết giờ! Kết quả là **{answer}**.',
  'game.math.plus': 'cộng',
  'game.math.minus': 'trừ',
  'game.math.times': 'nhân',
  'game.skipCount.name': 'Số Còn Thiếu',
  'game.skipCount.desc': 'Tôi đếm to nhưng bỏ qua một số — ai bắt được đầu tiên thắng.',
  'game.skipCount.intro':
    '🔢 **Số Còn Thiếu** — tôi đếm, nhưng bỏ qua một số. Hãy gõ số còn thiếu! ({rounds} vòng)',
  'game.skipCount.round': '👂 Vòng {n}/{total} — tôi đã bỏ qua số nào?',
  'game.skipCount.correct': '✅ **{user}** đã bắt được — tôi đã bỏ qua **{answer}**!',
  'game.skipCount.timeout': '⏱️ Hết giờ! Tôi đã bỏ qua **{answer}**.',
  'game.spelling.name': 'Đánh Vần',
  'game.spelling.desc': 'Tôi đọc một từ — ai đánh vần đúng đầu tiên thắng.',
  'game.spelling.intro': '✍️ **Đánh Vần** — tôi sẽ đọc {rounds} từ. Hãy gõ từng từ đúng chính tả!',
  'game.spelling.round': '🗣️ Vòng {n}/{total} — hãy viết từ tôi đọc…',
  'game.spelling.correct': '✅ **{user}** đã viết đúng **{word}**!',
  'game.spelling.timeout': '⏱️ Hết giờ! Từ đó là **{word}**.',
  'game.spelling.empty': 'Tôi chưa có danh sách từ cho ngôn ngữ giọng của máy chủ này.',
  'game.spellOut.name': 'Ghép Chữ Cái',
  'game.spellOut.desc': 'Tôi đọc một từ theo từng chữ cái — ai viết được cả từ đầu tiên thắng.',
  'game.spellOut.intro':
    '🔡 **Ghép Chữ Cái** — tôi đánh vần {rounds} từ theo từng chữ cái. Hãy gõ cả từ!',
  'game.spellOut.round': '🔤 Vòng {n}/{total} — hãy nghe các chữ cái…',
  'game.spellOut.correct': '✅ **{user}** đã đoán đúng — **{word}**!',
  'game.spellOut.timeout': '⏱️ Hết giờ! Nó đánh vần thành **{word}**.',
  'game.fastSpeech.name': 'Nói Nhanh',
  'game.fastSpeech.desc': 'Tôi đọc một câu cực nhanh — ai gõ lại được điều tôi nói đầu tiên thắng.',
  'game.fastSpeech.intro':
    '💨 **Nói Nhanh** — {rounds} câu ở tốc độ điên rồ. Hãy gõ điều bạn nghe được!',
  'game.fastSpeech.round': '⚡ Vòng {n}/{total} — nó tới đây, nhanh lắm!',
  'game.fastSpeech.correct': '✅ **{user}** đã giải mã được: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Hết giờ! Đó là: “{phrase}”',
  'game.fastSpeech.empty': 'Tôi chưa có câu cho ngôn ngữ giọng của máy chủ này.',
  'game.accentSwap.name': 'Giọng Vùng Miền',
  'game.accentSwap.desc': 'Tôi đọc một từ với giọng nước ngoài — ai viết được đầu tiên thắng.',
  'game.accentSwap.intro':
    '🎭 **Giọng Vùng Miền** — {rounds} từ được đọc với giọng sai. Hãy gõ từ đó!',
  'game.accentSwap.round': '🌍 Vòng {n}/{total} — tôi đang cố nói từ nào?',
  'game.accentSwap.correct': '✅ **{user}** đã đoán đúng — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Hết giờ! Từ đó là **{word}**.',
  'game.reflexes.name': 'Phản Xạ',
  'game.reflexes.desc':
    'Tôi đếm ngược, rồi hô NÀO — ai gõ đầu tiên sau đó thắng. Đừng nhảy vọt sớm!',
  'game.reflexes.intro':
    '⚡ **Phản Xạ** — {rounds} vòng. Khi tôi hô **NÀO**, hãy gõ bất cứ gì nhanh nhất có thể. Gõ trước khi NÀO là phạm quy!',
  'game.reflexes.ready': '🚦 Vòng {n}/{total} — sẵn sàng nào…',
  'game.reflexes.countdown': 'ba… hai… một…',
  'game.reflexes.go': '🟢 **NÀO!!!**',
  'game.reflexes.goVoice': 'Nào!',
  'game.reflexes.tooSoon': '🔴 **{user}** đã nhảy vọt — sớm quá!',
  'game.reflexes.win': '⚡ **{user}** nhanh nhất! Được điểm!',
  'game.reflexes.tooSlow': '😴 Không ai phản ứng kịp. Vòng sau!',
  'game.headsOrTails.name': 'Sấp hay Ngửa',
  'game.headsOrTails.desc':
    'Đoán mặt đồng xu — gõ ngửa hoặc sấp trước khi tôi tung. Ai đoán đúng nhiều nhất thắng!',
  'game.headsOrTails.intro':
    '🪙 **Sấp hay Ngửa** — {rounds} vòng. Mỗi vòng, gõ `ngửa` hoặc `sấp` trước khi tôi tung đồng xu. 1 điểm cho mỗi lần đoán đúng!',
  'game.headsOrTails.introVoice': 'Cùng chơi sấp hay ngửa nào!',
  'game.headsOrTails.round': '🪙 Vòng {n}/{total} — ngửa hay sấp? Gõ dự đoán của bạn!',
  'game.headsOrTails.roundVoice': 'Ngửa… hay sấp?',
  'game.headsOrTails.heads': 'ngửa',
  'game.headsOrTails.tails': 'sấp',
  'game.headsOrTails.resultVoice': 'Là {side}!',
  'game.headsOrTails.winners': 'Là **{side}**! Điểm cho: {users}',
  'game.headsOrTails.noWinners': 'Là **{side}**! Không ai đoán đúng — không có điểm.',
  'game.vozenSays.name': 'Vozen Nói',
  'game.vozenSays.desc':
    'Chỉ tuân theo khi mệnh lệnh bắt đầu bằng “Vozen nói”. Sập bẫy là bạn bị bắt!',
  'game.vozenSays.intro':
    '🫡 **Vozen Nói** — {rounds} mệnh lệnh. CHỈ làm nếu tôi bắt đầu bằng **“Vozen nói”**. Nếu không, đừng động đậy!',
  'game.vozenSays.prefix': 'Vozen nói',
  'game.vozenSays.verb': 'gõ',
  'game.vozenSays.real': '🗣️ Vòng {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Vòng {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ **{user}** đã tuân theo đầu tiên — được điểm!',
  'game.vozenSays.caught': '🔴 **{user}** — tôi đâu có nói Vozen nói! Bị bắt!',
  'game.vozenSays.nobody': '😴 Không ai tuân theo **{word}** kịp giờ. Vòng sau!',
  'game.vozenSays.trapCleared':
    '😌 Đó là một cái bẫy — phát hiện tốt lắm, không ai mắc **{word}**.',
  'game.roulette.name': 'Vòng Quay Thật hay Thách',
  'game.roulette.desc':
    'Tôi quay và đọc to một thử thách thật-hay-thách. Chạy lại để có thử thách khác.',
  'game.roulette.header': '🎯 **Vòng quay nói…**',
  'game.hangman.name': 'Người Treo Cổ',
  'game.hangman.desc': 'Đoán từ theo từng chữ cái — sai 6 lần là kết thúc.',
  'game.hangman.intro':
    '🪢 **Người Treo Cổ** — gõ từng chữ cái một để đoán từ. Bạn cũng có thể gõ cả từ!',
  'game.hangman.hit': '🟢 **{user}** đã tìm thấy **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — không có **{letter}**.',
  'game.hangman.wrongLetters': 'Sai: {letters}',
  'game.hangman.win': '🎉 **{user}** đã giải được — **{word}**!',
  'game.hangman.lose': '💀 Hết lượt! Từ đó là **{word}**.',
  'game.hangman.idle': '🕹️ Trò chơi tạm dừng (không ai chơi). Từ đó là **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Đoán từ 5 chữ cái. 🟩 đúng vị trí, 🟨 sai vị trí, ⬛ không có trong từ. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — gõ một từ 5 chữ cái. Cả nhóm chia sẻ {max} lượt đoán. 🟩 đúng vị trí · 🟨 sai vị trí · ⬛ không có trong từ.',
  'game.wordle.guess': '🔤 **{user}** đã đoán — còn **{left}** lượt',
  'game.wordle.inWord': '🟢 có trong từ: {letters}',
  'game.wordle.out': '🚫 loại: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** đã đoán ra ở lượt {n} — **{word}**!',
  'game.wordle.lose': '💀 Hết lượt đoán! Từ đó là **{word}**.',
  'game.wordle.idle': '🕹️ Trò chơi tạm dừng (không ai chơi). Từ đó là **{word}**.',
  'game.tictactoe.name': 'Cờ Ca-rô',
  'game.tictactoe.desc':
    'Hai người chơi — gõ một số từ 1-9 để đặt dấu của bạn. Ba dấu thẳng hàng là thắng.',
  'game.tictactoe.intro':
    '⭕ **Cờ Ca-rô** — hai người chơi đi đầu tiên là ❌ và ⭕ (❌ đi trước). Gõ một số từ 1-9 để đánh vào ô của bạn.',
  'game.tictactoe.turn': 'Lượt: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, đến lượt **{mark}**.',
  'game.tictactoe.taken': '🚫 Ô {cell} đã bị chiếm — hãy chọn ô khác.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) thắng!',
  'game.tictactoe.draw': '🤝 Hòa rồi!',
  'game.tictactoe.idle': '🕹️ Trò chơi đã kết thúc (không ai chơi).',
  'game.chess.name': 'Cờ Vua',
  'game.chess.desc':
    'Hai người chơi — luật cờ vua thật sự (chiếu, nhập thành, phong cấp…). Gõ một nước đi như "e4" hoặc "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Cờ Vua** — hai người chơi đi đầu tiên cầm quân Trắng và Đen (Trắng đi trước). Gõ một nước đi bằng ký hiệu đại số ("e4", "Nf3", "O-O") hoặc theo tọa độ ("e2e4"). Gõ "resign" để đầu hàng.',
  'game.chess.white': 'Trắng',
  'game.chess.black': 'Đen',
  'game.chess.seats': '⚪ Trắng: **{white}** · ⚫ Đen: **{black}**',
  'game.chess.turn': '{move} — lượt: **{color}**',
  'game.chess.check': '♟️ Chiếu!',
  'game.chess.notYourTurn': '⏳ **{user}**, đến lượt quân **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" không phải nước đi hợp lệ — hãy thử lại.',
  'game.chess.checkmate': '🏆 Chiếu hết ({move})! **{user}** thắng!',
  'game.chess.draw': '🤝 Hòa cờ ({move})!',
  'game.chess.resigned': '🏳️ **{user}** đã đầu hàng — **{winner}** thắng!',
  'game.chess.idle': '🕹️ Trò chơi đã kết thúc (không ai chơi).',
  'game.wordChain.name': 'Nối Chữ',
  'game.wordChain.descr':
    'Nối chữ theo lượt bằng một ngôn ngữ: nói một từ bắt đầu bằng chữ cái cuối của từ trước. 2 mạng, không lặp lại, đồng hồ chạy nhanh dần. Chọn ngôn ngữ bằng tùy chọn `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ Nối Chữ hiện không khả dụng bằng **{lang}** (thiếu danh sách từ).',
  'game.wordChain.lobby':
    '🔗 **Nối Chữ** bằng **{lang}**! Gõ bất cứ gì trong kênh này trong vòng **{seconds}s** để tham gia.',
  'game.wordChain.notEnough': '😴 Không đủ người chơi tham gia (cần ít nhất 2). Đã hủy trò chơi.',
  'game.wordChain.begin':
    '🚀 Bắt đầu! Người chơi: {players}. Mỗi từ phải bắt đầu bằng chữ cái cuối của từ trước.',
  'game.wordChain.turn':
    '**{name}**, đến lượt bạn! Một từ **{lang}** bắt đầu bằng **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — chữ cái tiếp theo: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Phải bắt đầu bằng **{letter}**.',
  'game.wordChain.bad.short': '📏 Quá ngắn — ít nhất **{min}** chữ cái.',
  'game.wordChain.bad.repeated': '🔁 Từ đó đã được dùng rồi.',
  'game.wordChain.bad.word': '📖 Từ đó không có trong từ điển.',
  'game.wordChain.bad.latin': '🔤 Chỉ tính các chữ cái A–Z.',
  'game.wordChain.timeout': '⏰ **{name}** đã hết giờ! Còn lại {hearts}.',
  'game.wordChain.eliminated': '💀 **{name}** đã bị loại!',
  'game.wordChain.winner': '🏆 **{name}** thắng chuỗi nối! ({chain} từ)',
  'game.stats.none': 'Bạn chưa chơi trò chơi nào. Hãy thử `/game play`!',
  'game.stats.body': '🎮 **Thống kê của bạn** — **{points}** điểm · **{wins}** thắng · {rank}',
  'game.stats.rank': 'hạng **#{rank}** trên {total}',
  'game.stats.unranked': 'chưa có hạng',
  'game.pickPrompt': '🎮 Bạn muốn chơi trò nào? Hãy chọn một trò:',
  'game.pickPlaceholder': 'Chọn một trò chơi…',
  'game.pickTimeout': '⏰ Chưa chọn trò nào — hãy chạy `/game play` lại khi sẵn sàng.',
  'pron.listHeader': '🗣️ **Cách phát âm của bạn** ({count}/{limit}):',
  'pron.listEmpty': 'Bạn chưa có mục nào — thêm một mục với `/pronunciation add`.',
  'pron.set': '✅ Đã lưu! Khi **bạn** gõ “{term}”, tôi sẽ đọc “{replacement}”.',
  'pron.removed': '🗑️ Đã xóa “{term}”.',
  'pron.notFound':
    'Bạn không có cách phát âm nào cho “{term}”. Xem của bạn với `/pronunciation list`.',
  'pron.empty': 'Từ và cách đọc nó không được để trống.',
  'pron.limitHit':
    '🔒 Bạn đã đạt giới hạn **{limit}** cách phát âm. Hãy xóa một mục với `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus hoặc Premium nâng lên **50** → {url}',
  'pron.modalTitle': 'Dạy Vozen một cách phát âm',
  'pron.modalTerm': 'Từ ngữ (theo cách mọi người gõ)',
  'pron.modalSay': 'Cách Vozen nên đọc nó',
  'spron.listHeader': '🗣️ **Cách phát âm của máy chủ** ({count}/{limit}) — áp dụng cho mọi người:',
  'spron.listEmpty': 'Chưa có mục nào — thêm một mục với `/server-pronunciation add`.',
  'spron.set': '✅ Đã lưu cho toàn máy chủ! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ Đã xóa “{term}” khỏi máy chủ.',
  'spron.notFound': 'Máy chủ không có cách phát âm nào cho “{term}”.',
  'spron.limitHit':
    '🔒 Máy chủ đã đạt giới hạn **{limit}** cách phát âm. Hãy xóa một mục với `/server-pronunciation remove`.',
  'spron.modalTitle': 'Cách phát âm của máy chủ',
  'spron.modalSay': 'Cách Vozen đọc nó cho mọi người',
  'rand.selectPrompt': '🎲 **Trình chọn ngẫu nhiên** — bạn muốn tôi chọn trong bao nhiêu lựa chọn?',
  'rand.selectPlaceholder': 'Số lựa chọn…',
  'rand.selectOption': '{n} lựa chọn',
  'rand.filling': '📝 Hãy điền vào biểu mẫu vừa mở!',
  'rand.modalTitle': 'Trình chọn ngẫu nhiên — {amount} lựa chọn',
  'rand.modalOption': 'Lựa chọn {n}',
  'rand.needTwo': 'Hãy cho tôi ít nhất 2 lựa chọn, cách nhau bằng dấu phẩy (ví dụ "pizza, sushi").',
  'rand.result': 'Trong {count} lựa chọn, tôi chọn… **{winner}**!',
  'rand.speak': 'Tôi chọn… {winner}!',
  'rand.notInVoice': '_(hãy vào một kênh thoại cùng tôi và lần sau tôi sẽ đọc to nó)_',
  'rand.timeout': '⏰ Chưa chọn gì — hãy chạy `/randomizer` lại khi sẵn sàng.',
};
