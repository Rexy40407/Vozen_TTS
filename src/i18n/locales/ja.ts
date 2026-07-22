// Japanese (ja) interface translation. Same key set as the other locales (mirrors
// es.ts). Prepared to the same bar as the Fase B set — a native review is welcome.
// Placeholders {param}, markdown, emoji, command names and \n are preserved verbatim.
export default {
  'error.generic': '問題が発生しました。もう一度お試しください。',
  'error.needManageGuild': 'それを行うには**サーバー管理**権限が必要です。',
  'join.needVoiceChannel': '先にボイスチャンネルに参加してから /join を実行してください。',
  'join.missingPerms': '{channel} で**接続**と**発言**の権限が必要です。',
  'join.joined':
    '✅ {channel} に参加しました！次のステップ：`/tts こんにちは` と入力すると読み上げます。チャンネルを自動で読み上げてほしいですか？ /setup を実行してください。',
  'join.joinedAutoread':
    '✅ {channel} に参加しました！ 準備完了。自動読み上げチャンネルに入力すると読み上げます。 → {readChannel}',
  'leave.left': 'ボイスチャンネルから退出しました。またね！',
  'skip.notInVoice':
    'まだボイスチャンネルにいません。参加して先に /join を実行してから、もう一度お試しください。',
  'skip.skipped': 'スキップしました。',
  'skip.nothing': '今は何も再生していません。',
  'tts.notInVoice':
    'まだボイスチャンネルにいません。参加して /join を実行してから、もう一度お試しください。',
  'tts.nothingToRead': '読み上げるものがありません。読み上げたいテキストを送ってください。',
  'tts.nothingAfterClean':
    '整形したら読み上げるものが残りませんでした。通常のテキスト（文字や単語）で試してください。',
  'tts.tooFast': 'おっと、少しゆっくりいきましょう。少し待ってからもう一度お試しください。',
  'tts.blocked': 'そのテキストにはブロックされた単語が含まれているのでスキップしました。',
  'tts.queued': '了解！キューに追加しました。',
  'tts.busy': '今は手がふさがっています。少し待ってからもう一度お試しください。',
  'voice.unknownModel': 'その声はわかりません。/voice list を確認してください。',
  'voice.badSpeed':
    '速度は 0.5 から 2.0 の間で指定してください（1.0 が標準）。`/voice set model:… speed:1.0` を試してください。',
  'voice.set':
    '✅ あなたの声を **{name}**（{speed}×）に設定しました。`/tts こんにちは` で聞いてみてください。(id: `{model}`)',
  'voice.config.title':
    '🎙️ **音声設定** — 下の項目を選び、**保存**を押してください。保存するまで変更は反映されません。',
  'voice.config.summary': '現在の選択：**{voice}** · エンジン **{engine}** · {speed}×',
  'voice.config.pickLanguage': '言語…',
  'voice.config.pickVoice': '音声…',
  'voice.config.pickEngine': 'エンジン…',
  'voice.config.pickSpeed': '速度…',
  'voice.config.more': '▼ その他の言語',
  'voice.config.engDefault': 'デフォルト（ローカル）',
  'voice.config.save': '保存',
  'voice.config.cancel': 'キャンセル',
  'voice.config.cancelled': '設定をキャンセルしました。変更はありません。',
  'voice.config.expired':
    'パネルの有効期限が切れました。続けるには `/voice config` をもう一度実行してください。',
  'voice.listHeader': '利用できる声：',
  'voice.listEmpty': '（インストールされていません）',
  'voice.reset':
    '✅ あなたの声を既定に戻しました。いつでも `/voice list` と `/voice set` で別の声を選べます。',
  'voice.optout': '今後は自動で読み上げません。/voice opt-in で再度有効にできます。',
  'voice.optin': '今後はまた自動で読み上げます。',
  'voice.notInVoice': 'まだボイスチャンネルにいません。先に /join を実行してください。',
  'voice.previewPlaying': 'サンプルを再生中…',
  'preview.sample': 'こんにちは、Vozen です。入力して、聞いてみて。',
  'laugh.playing': 'ははは！あなたの声で再生中…',
  'joke.playing': 'ジョークをひとつ…\n> {joke}',
  'joke.unknownLang': 'その言語はわかりません。リストから選んでください。',
  'voice.abbrev.added': '了解！{term} は {replacement} として読み上げます。',
  'voice.abbrev.removed': '{term} の略語を削除しました。',
  'voice.abbrev.listHeader': 'あなたの個人略語（{count}/{cap} 使用中）：',
  'voice.abbrev.listEmpty': '（まだありません。/voice abbrev add で追加できます）',
  'voice.abbrev.capReached':
    '個人略語の上限（{cap} 個）に達しました。追加する前にひとつ削除してください。',
  'voice.abbrev.invalidTerm': '用語は1単語（英数字のみ）で、最大50文字までにしてください。',
  'voice.abbrev.emptyReplacement': '読み方を空にはできません。',
  'voice.abbrev.tooLong': '読み方が長すぎます（最大200文字）。',
  'config.wordEmpty': '単語を空にはできません。',
  'config.blocked': 'ブロックしました：{word}。',
  'config.unblocked': 'ブロックを解除しました：{word}。',
  'config.pronListHeader': '発音辞書：',
  'config.pronEmptyValue': '（空）',
  'config.listEmpty': '（なし）',
  'config.termEmpty': '用語を空にはできません。',
  'config.pronEmpty': '発音を空にはできません。',
  'config.pronSet': '了解！{term} は {replacement} として読み上げます。',
  'config.pronRemoved': '{term} の発音を削除しました。',
  'config.channelWrongType':
    'テキストチャンネルを選んでください（ボイスチャンネルやカテゴリーではなく）。',
  'config.channelNoAccess': '{channel} が見えません。そこでの権限を確認してください。',
  'config.channelSet':
    '自動読み上げチャンネルを {channel} に設定しました。次に：`/config auto-read active:true` で自動読み上げが有効になっていることを確認してください。',
  'config.autoreadOn': '自動読み上げが**有効**になりました。',
  'config.autoreadOff': '自動読み上げが**無効**になりました。',
  'config.maxCharsRange': '最大文字数は 1 から 2000 の間で指定してください。',
  'config.maxCharsSet': '1メッセージあたりの最大文字数を {value} に設定しました。',
  'config.rateLimitRange': 'レート制限は 1 から 120 の間で指定してください。',
  'config.rateLimitSet': 'レート制限を1分あたり {value} メッセージに設定しました。',
  'config.roleSet': '自動読み上げは {role} を持つメンバーに限定されました。',
  'config.roleCleared': 'ロール制限を解除しました：全員が読み上げ対象になります。',
  'config.enabledOn': 'このサーバーで TTS が**有効**になりました。',
  'config.enabledOff': 'このサーバーで TTS が**無効**になりました。',
  'config.defaultVoiceSet':
    '✅ サーバーの既定の声を **{name}** に設定しました。自分の声を設定していないメンバーはこの声を聞きます。(id: `{model}`)',
  'config.reset': '設定を既定値にリセットしました。ブロックリストと発音はそのまま残しました。',
  'config.showTitle': '**サーバー設定**',
  'config.showChannel': 'TTS チャンネル：{value}',
  'config.showAutoread': '自動読み上げ：{value}',
  'config.showRole': 'ロール：{value}',
  'config.showEnabled': '有効：{value}',
  'config.showVoice': '既定の声：{value}',
  'config.showMaxChars': '最大文字数：{value}',
  'config.showRateLimit': 'レート制限：{value}/分',
  'config.showBlocklist': 'ブロックリスト：{count} 単語',
  'config.showPronunciation': '発音：{count} 件',
  'config.valueNone': '（なし）',
  'config.valueAny': 'すべて',
  'config.valueAutoDetect': '（自動検出）',
  'config.on': '有効',
  'config.off': '無効',
  'config.language.set': 'インターフェースの言語を {language} に設定しました。',
  'config.language.unsupported': 'その言語はまだ対応していません。',
  'setup.noChannel':
    'どのチャンネルを使えばよいか分かりませんでした。「channel」オプションでテキストチャンネルを指定してください。',
  'setup.channelWrongType':
    '自動読み上げチャンネルはテキストチャンネルである必要があります（ボイスチャンネルやカテゴリーではなく）。「channel」オプションで指定してください。',
  'setup.done': '**準備完了：Vozen の用意ができました。**',
  'setup.channelLine': '自動読み上げチャンネル：{channel}',
  'setup.autoreadOn': '自動読み上げ：有効',
  'setup.permsHeader': '**権限：**',
  'setup.permView': 'ViewChannel（テキストチャンネルを見る）',
  'setup.permSend': 'SendMessages（テキストチャンネルに投稿する）',
  'setup.permConnect': 'Connect（ボイスチャンネルに参加する）',
  'setup.permSpeak': 'Speak（ボイスチャンネルで話す）',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — 不足',
  'setup.permUnchecked': '⏳ {label} — 未確認（/join 実行時に確認します）',
  'setup.fixHint':
    '不足しているものを直すには：サーバー設定で Vozen のロール（またはチャンネルの権限）を開き、❌ が付いた項目を有効にしてください。',
  'setup.voiceUncheckedNote':
    'ボイスチャンネルにいないため、Connect/Speak はまだ確認できませんでした：/join を実行したときに確認します。',
  'setup.allGood': '準備完了。ボイスチャンネルに参加して /join を実行してください。',
  'setup.joinedVoice': '{channel} にも参加しました：/join を実行する必要はありません。',
  'setup.readyTalk': '準備完了。自動読み上げチャンネルに入力すると読み上げます。',
  'setup.membersHeader': '**メンバーに伝えましょう（3ステップの流れ）：**',
  'setup.membersBody':
    '1) ボイスチャンネルに参加\n2) /join を実行して私を呼ぶ\n3) このチャンネルに入力（または /tts を使用）すると読み上げます\nコマンド一覧：/help',
  'stats.title': '**Vozen の統計**',
  'stats.messagesSpoken': '読み上げたメッセージ：{value}',
  'stats.cacheHits': 'キャッシュヒット：{value}',
  'stats.cacheMisses': 'キャッシュミス：{value}',
  'stats.synthErrors': '合成エラー：{value}',
  'stats.voiceDrops': '音声切断：{value}',
  'stats.voiceReconnects': '再接続：{value}',
  'stats.votes': 'top.gg の投票：{value}',
  'stats.activePlayers': 'アクティブなプレイヤー：{value}',
  'stats.servers': 'サーバー：{value}',
  'stats.uptime': '稼働時間：{value}秒',
  'invite.noClientId':
    'Vozen の招待リンクはまだ設定されていません（CLIENT_ID がありません）。ボットの管理者にお知らせください。',
  'invite.link': 'Vozen をあなたのサーバーに追加：\n{url}',
  'vote.noClientId':
    'Vozen の投票リンクはまだ設定されていません（CLIENT_ID がありません）。ボットの管理者にお知らせください。',
  'vote.link':
    'Vozen に投票して（無料・12時間ごと）、もっと多くの人に見つけてもらいましょう：\n{url}\nこのアカウントで報酬を受け取ったことがなければ、**Vozen Plusを48時間**獲得できます。報酬は1アカウントにつき一度限りです。',
  'help.title': 'Vozen — 入力して、聞く。',
  'help.embedTitle': 'Vozen — コマンド',
  'help.intro':
    'Vozen はあなたのテキストをボイスチャンネルで読み上げます：無料のニューラル音声、何十もの言語。',
  'help.quickStartTitle': 'クイックスタート（3ステップ）',
  'help.quickStartBody':
    '1) ボイスチャンネルに参加してから /join を実行\n2) テキストチャンネルに入力（または /tts みんな、こんにちは！）\n3)（任意）/voice set で声を選ぶ',
  'help.groupStarted': 'はじめに',
  'help.groupStartedBody':
    '• /join — あなたのボイスチャンネルに参加します\n• /leave — ボイスチャンネルから退出します\n• /tts <テキスト> — テキストを読み上げます · 例：/tts みんな、こんにちは！\n• /skip — 今読み上げているものをスキップします',
  'help.groupVoice': 'あなたの声',
  'help.groupVoiceBody':
    '• /voice set <model> — 声を選びます · 例：/voice set en_US-amy-medium\n• /voice list — 利用できる声を見ます\n• /voice preview — 自分の声のサンプルを聞きます\n• /voice reset — 既定の声に戻します\n• /voice opt-out · /voice opt-in — 自分への自動読み上げを無効／有効にします\n• /voice abbrev add|remove|list — 個人の略語を自分好みの読み方で（最大10個）',
  'help.groupFun': 'お楽しみ',
  'help.groupFunBody':
    '• /joke — 短いジョークを言います（言語＋任意の笑いを選択）· 例：/joke English\n• /laugh — 今の声で大笑いします',
  'help.groupAdmin': 'サーバー管理（サーバー管理権限が必要）',
  'help.groupAdminBody':
    '• /setup — 1ステップのガイド付き設定 · 最初に実行してください\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · 例：/config tts-channel #general\n• /stats — ボットの統計',
  'help.groupMore': 'その他',
  'help.groupMoreBody':
    '• /invite — Vozen を別のサーバーに追加\n• /vote — top.gg で Vozen に投票\n• /help — このヘルプを表示',
  'help.footer': '初めてですか？ {command} を実行して始めましょう。',
  'welcome.title': 'Vozen を追加してくれてありがとう！ 👋',
  'welcome.description':
    'Vozen はあなたのチャットをボイスチャンネルで読み上げます：入力して、聞く。\n\n**1ステップで始める：** {setup} を実行すると、自動読み上げを設定してあなたのボイスチャンネルに参加します。\n\nコマンドの一覧が必要ですか？ {help} を実行してください。',
  'welcome.enginePlans':
    'Piperニューラル音声は引き続き無料です。💎 KokoroとGoogle HDはVozen PlusまたはサーバーPremiumで解放されます。',
  'welcome.stepsTitle': 'メンバーの使い方（3ステップ）',
  'welcome.stepsBody':
    '1) ボイスチャンネルに参加\n2) /join を実行して私を呼ぶ\n3) テキストチャンネルに入力（または /tts を使用）すると読み上げます\nコマンド一覧：/help',
  'welcome.footer': 'Vozen — 入力して、聞く。',
  'welcome.tagline': '自然なニューラル音声：ずっと無料、ペイウォールなし。',
  'stt.guildOnly': '文字起こしはサーバー内でのみ動作します。',
  'stt.noManage': '文字起こしを開始・停止するには**サーバー管理**権限が必要です。',
  'stt.notPremium':
    '🎙️ ライブ文字起こしは**Premium**機能です。このサーバーで有効にするには `/premium info` を確認してください。',
  'stt.unavailable':
    '文字起こしはこのインスタンスでは利用できません（音声認識エンジンがインストールされていません）。',
  'stt.notInVoice':
    'まだボイスチャンネルにいません。参加して先に `/join` を実行してから、文字起こしを開始してください。',
  'stt.alreadyRunning':
    'このサーバーではすでに文字起こしが実行中です。先に `/transcribe stop` を使ってください。',
  'stt.atCapacity':
    '現在すべてのサーバーで文字起こしが実行されすぎています。しばらくしてからもう一度お試しください。',
  'stt.noChannel':
    'このチャンネルには文字起こしを投稿できません。通常のテキストチャンネルからコマンドを実行してみてください。',
  'stt.started':
    '✅ 文字起こしを開始しました。お知らせで**同意**を押した人は、このチャンネルに文字起こしされます。',
  'stt.startFailed':
    '文字起こしを開始できませんでした（お知らせの投稿に失敗しました）。すべて元に戻しました。何も記録されていません。もう一度お試しください。',
  'stt.announceStart':
    '🎙️ **このチャンネルでライブ文字起こしがオンになりました。** 文字起こしされるのは同意した人だけです。あなたの発言をここに書き起こすのを許可するには、下のボタンを押してください。いつでも `/transcribe revoke` で撤回できます。',
  'stt.consentBtn': '文字起こしに同意する',
  'stt.consentThanks':
    '✅ ありがとうございます。今後、このサーバーであなたの発言が文字起こしされます。いつでも `/transcribe revoke` で撤回できます。',
  'stt.stopped': '🛑 文字起こしを停止しました。',
  'stt.notRunning': 'このサーバーでは文字起こしは実行されていません。',
  'stt.announceStop': '🛑 **ライブ文字起こしがオフになりました。** 聞き取りを停止しました。',
  'stt.revoked':
    '✅ 同意を撤回しました。今後、このサーバーであなたが文字起こしされることはありません。（すでに投稿されたメッセージは残ります。必要なら Discord で削除してください。）',
  'stt.revokeNone':
    'このサーバーでの文字起こしに同意していなかったため、撤回するものはありませんでした。',
  'privacy.eraseConfirm':
    '⚠️ これはすべてのサーバーにわたるあなたの Vozen データ**すべて**を完全に削除します：声の設定、読み上げ用ニックネーム、個人の略語と発音、保存した誕生日、ゲームのスコア、会話統計、そしてオプトアウト。**これは元に戻せません。** よろしいですか？',
  'privacy.erasePremiumNote':
    '_注意：購入済みの Premium/Plus とその購入履歴は保持されます。これらはあなたのものであり、法的に必要な会計記録でもあります。Premium をやめるには、期限切れになるまで待つかサポートにお問い合わせください。_',
  'privacy.eraseYes': 'すべて削除',
  'privacy.eraseNo': 'キャンセル',
  'privacy.eraseCancelled': 'キャンセルしました。何も削除されていません。',
  'privacy.eraseDone': '✅ 完了しました。あなたの個人データはすべて完全に削除されました。',
  'shutup.notInVoice': 'まだボイスチャンネルにいません。参加して先に /join を実行してください。',
  'shutup.nothing': '今は何も再生していません。',
  'shutup.done': '🤐 わかりました、止めます。キューをすべてクリアしました。',
  'voice.detection.on':
    '✅ 自動言語検出がオンです：各メッセージは検出された言語の声で読み上げられます（話者が変わることがあります）。オフにするには `/voice detection active:false` を使ってください。',
  'voice.detection.off':
    '✅ 自動言語検出がオフです：固定した1つの声がすべてを読み上げるので、いつも同じ声になります。',
  'voice.nickname.set': '✅ Vozen は今後あなたを **{name}** と読み上げます。',
  'voice.nickname.cleared':
    '✅ 読み上げ用ニックネームを削除しました。Vozen はあなたのサーバー名を使います。',
  'voice.nickname.invalid':
    'その名前には読み上げられるものがありません。文字か数字を使ってください。',
  'voice.effect.set':
    '✅ ボイスエフェクトを **{effect}** に設定しました。あなたのメッセージはそのエフェクトで再生されます。オフにするには `/voice effect none` を使ってください。',
  'voice.effect.cleared': '✅ ボイスエフェクトを解除しました。またクリアな声に戻ります。',
  'voice.effect.locked':
    '🔒 **{effect}** は Premium エフェクトです。無料エフェクト：🤖 Robot と 🔊 Echo。Vozen Premium ですべて解除できます。`/premium` を確認してください。',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** は Premium の音声エンジンです。Vozen Plus（個人）または Vozen Premium（サーバー）で解除できます。`/premium` を確認してください。それまであなたの声は無料のローカルエンジンのままです。',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** は Premium の音声エンジンです。Vozen Plus（個人）または Vozen Premium（サーバー）で解除できます。`/premium` を確認してください。それまであなたの声は無料のローカルエンジンのままです。',
  'rizz.playing': '😏 ちょっとキメ台詞を…\n> {line}',
  'rizz.unknownLang': 'その言語はわかりません。リストから選んでください。',
  'rizz.locked':
    '🔒 **/rizz** は Premium 特典です。Vozen Plus（あなた）または Premium（このサーバー）で解除できます。`/premium` を確認してください。',
  'sound.playing': '🔊 **{name}** を再生中…',
  'sound.unknown': 'その音はありません。`/sound` を実行してリストを見てください。',
  'sound.list':
    '🔊 **サウンド：** {sounds}\n`/sound name:<sound>` で再生できます（あなたのボイスチャンネルにいる必要があります）。',
  'sound.disabled':
    '🔇 このサーバーではサウンドボードが**オフ**です。管理者は `/config soundboard` で有効にできます。',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 誕生日を保存しました：**{day}/{month}**。その日にボイスチャンネルに参加したら、お誕生日おめでとうと言いますね！',
  'birthday.invalid': 'それは実在しない日付です。日と月を確認してください。',
  'birthday.cleared': '🎂 誕生日を削除しました。',
  'birthday.show': '🎂 あなたの誕生日は **{day}/{month}** に設定されています。',
  'birthday.none': 'まだ誕生日を設定していません。`/birthday set` を使ってください。',
  'topspeakers.title': '🗣️ **トークスピーカー上位** — このサーバーで最も読み上げた人：',
  'topspeakers.empty':
    'まだ誰のメッセージも読み上げていません。`/setup` で読み上げチャンネルを設定しましょう！',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** メッセージ · 🔥 {streak}日連続',
  'serverstats.title': '📊 **サーバー統計**',
  'serverstats.empty':
    'まだ統計がありません。ここではメッセージの読み上げもゲームの実行もしていません。`/setup` で設定しましょう！',
  'serverstats.messages': '🗣️ **{total}** メッセージ読み上げ · **{speakers}** 人',
  'serverstats.topTalkers': '**トーク上位：**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} メッセージ · 🔥 {streak}日',
  'serverstats.streak': '🔥 最長の継続記録：**{days}** 日',
  'serverstats.games': '🎮 **{points}** ゲームポイント · **{wins}** 勝 · **{players}** 人',
  'serverstats.topPlayers': '**プレイヤー上位：**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pts · {wins} 勝',
  'serverstats.upsell':
    '🔒 これは無料プレビューです。**Premium** で継続記録、ゲーム統計、トップ5全体が解除されます。`/premium` を確認してください。',
  'streak.day': '🔥 <@{user}> は **{n}日**連続中！続けて話して記録を維持しましょう。',
  'leaderboard.autoTitle': '🏆 このサーバーでよく話す人たち',
  'premium.title': '💎 **Vozen Premium ステータス**',
  'premium.lineServerActive': '🖥️ **サーバー：** {date} まで Premium',
  'premium.lineServerFree': '🖥️ **サーバー：** 無料プラン',
  'premium.lineUserActive': '👤 **あなた（Plus）：** {date} まで有効',
  'premium.lineUserFree': '👤 **あなた（Plus）：** 無効',
  'premium.getHint':
    '今お使いのものはすべて無料のままです。Premium では8種類すべてのボイスエフェクト、24時間通話常駐、個人発音50件、/rizz、そしてプレミアムゲームが追加されます。支援：https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Premium音声エンジン:** ニューラルKokoroとGoogle HD — Plusでは個人向け、サーバーPremiumでは全員に解放されます。',
  'premium.linePass':
    '🎟️ **あなたの Premium パス：** ライセンス {used}/{total} 使用中 · {date} に期限切れ',
  'premium.passServers': '↳ 使用中：{servers}',
  'premium.pitch':
    'まだ Premium をお持ちではありません。**Vozen Premium**（3サーバーで €3.99/月、8サーバーで €7.99/月）は、サーバー全体に対して次を解除します：8種類すべてのボイスエフェクト、24時間通話常駐、個人発音50件（無料は3件）、/rizz コマンド、そしてプレミアムゲーム（Word Chain、Wordle、Chess）。**Vozen Plus**（€1.99/月）は、これらの特典をあなた個人にどのサーバーでも付与します。',
  'premium.buyHint':
    '▶ **Premium を入手：** {link}\n購入後、使いたいサーバーで `/premium activate` を実行してください。',
  'premium.confirmActivate':
    '**このサーバー**で**{total} 個の Premium ライセンスのうち1個**を使いますか？ 現在 **{used}** 個を使用中です。あとで `/premium deactivate` で解放できます。いずれにしてもパスの有効期限は進み続けます。',
  'premium.confirmYes': '💎 ライセンスを使う',
  'premium.confirmNo': 'キャンセル',
  'premium.activateOk':
    '✅ **このサーバー**で {date} まで Premium が有効になりました。ライセンス：**{used}/{total}** 使用中。',
  'premium.activateCancelled': 'キャンセルしました。ライセンスは使われていません。',
  'premium.activateTimeout': 'タイムアウトしました。ライセンスは使われていません。',
  'premium.noPass':
    '有効な Premium パスがありません。購入するとあなたのアカウントに反映されます。その後ここで `/premium activate` を実行してください。\n▶ {link}',
  'premium.alreadyActive':
    'このサーバーにはすでにあなたの Premium ライセンスが1つ適用されています。行うことはありません。',
  'premium.noSeats':
    'あなたの **{total}** 個の Premium ライセンスはすべて使用中です（{servers}）。そちらで `/premium deactivate` を使って1つ解放してから、ここでもう一度お試しください。',
  'premium.needManageGuild':
    'Premium の有効化はサーバー全体に影響します。実行できるのは**サーバー管理**権限を持つメンバーだけです。管理者に依頼してください。',
  'premium.deactivateOk':
    '✅ このサーバーの Premium ライセンスを解放しました。`/premium activate` で別のサーバーに使えます。',
  'premium.deactivateNone': 'このサーバーには、あなたが解放できる Premium ライセンスがありません。',
  'premium.thisServer': 'このサーバー',
  'grant.denied': '⛔ このコマンドはボットのオーナー専用です。',
  'grant.okPremium':
    '✅ <@{user}> に **Premium パス**（{seats} ライセンス）を **{days}** 日間付与しました。{date} に期限切れ。`/premium activate` で有効化できます。',
  'grant.okPlus':
    '✅ <@{user}> に **Vozen Plus** を **{days}** 日間付与しました。{date} に期限切れ。',
  'gencode.done':
    '✅ {plan} コードを **{count}** 個生成しました（各 **{days}** 日）。非公開で共有してください：\n{list}',
  'redeem.okPlus':
    '🎁 引き換え完了！ **Vozen Plus** を **{days}** 日間獲得しました。{date} に期限切れ。',
  'redeem.okPremium':
    '🎁 引き換え完了！ **Premium パス**（{seats} ライセンス）を **{days}** 日間獲得しました。{date} に期限切れ。`/premium activate` でサーバーに有効化してください。',
  'redeem.notFound': '❌ そのコードは存在しません。よく確認してもう一度お試しください。',
  'redeem.used': '❌ そのコードはすでに引き換え済みです。',
  'redeem.expired': '❌ そのコードは期限切れです。',
  'config.blockLimit':
    'このサーバーはすでにブロック単語の上限（{max} 個）に達しています。追加する前にひとつ削除してください。',
  'config.xsaidOn':
    'Vozen は今後、各メッセージの前に**誰が話したか**を読み上げます（例：「Alex がこんにちは」）。オフにするには `/config x-said active:false` を使ってください。',
  'config.xsaidOff': 'Vozen は**今後**誰が話したかを読み上げません。メッセージのみを読み上げます。',
  'config.autojoinOn':
    '✅ 自動参加**オン** — TTS チャンネルに入力すると、Vozen があなたのボイスチャンネルに参加します。',
  'config.autojoinOff': '自動参加**オフ** — `/join` を使って Vozen をボイスに呼んでください。',
  'config.stayOn':
    '✅ 24時間通話常駐**オン** — Vozen はボイスチャンネルが空になっても留まり、再起動後も戻ってきます。💎 有効にするには Premium が必要です（購入するかコードを `/redeem` し、その後 `/premium activate`）。',
  'config.stayOff':
    '24時間通話常駐**オフ** — ボイスチャンネルが空になると Vozen は退出します（既定）。',
  'config.readBotsOn': '✅ Vozen は今後、**他のボットや Webhook** のメッセージも読み上げます。',
  'config.readBotsOff':
    'Vozen は他のボットや Webhook を**無視**します（実在の人だけを読み上げます）。',
  'config.textInVoiceOn': '✅ Vozen は**いるボイスチャンネル内のテキストチャット**も読み上げます。',
  'config.textInVoiceOff':
    'Vozen はボイスチャンネルのテキストチャットを読み上げ**ません**（TTS チャンネルのみ）。',
  'config.antispamOn':
    '✅ スパム対策**オン** — Vozen はスパムメッセージ（単語の大量繰り返しや、同じ長いメッセージの連投）を読み上げません。',
  'config.antispamOff': 'スパム対策**オフ** — Vozen は通常どおりすべてのメッセージを読み上げます。',
  'config.streaksOn':
    '✅ 継続記録の通知**オン** — Vozen は各人がその日に初めて話したときに 🔥 の連続記録メッセージを表示します。',
  'config.streaksOff':
    '継続記録の通知**オフ** — Vozen は引き続き連続記録を集計しますが（`/top-speakers` を参照）、それを知らせません。',
  'config.soundboardOn': 'サウンドボード**オン** — 誰でも `/sound` でクリップを再生できます。',
  'config.soundboardOff': 'サウンドボード**オフ** — このサーバーでは `/sound` は無効です。',
  'config.votePromosLabel': 'top.gg報酬のお知らせ + Vozen Support',
  'config.greetOn': '✅ 人がボイスチャンネルに参加したら、名前で挨拶します。',
  'config.greetOff': '🔇 人がボイスチャンネルに参加しても挨拶し**ません**。',
  'config.greetLangSet': '✅ 参加時の挨拶の言語を **{language}** に設定しました。',
  'config.showXsaid': '話者の読み上げ（xsaid）：{value}',
  'config.showAutojoin': '自動参加：{value}',
  'config.showReadBots': 'ボット/Webhook を読む：{value}',
  'config.showTextInVoice': 'ボイス内テキスト：{value}',
  'config.showAntispam': 'スパム対策：{value}',
  'config.showSoundboard': 'サウンドボード（/sound）：{value}',
  'config.showGreet': '参加時の挨拶：{value}（{language}）',
  'stats.synthLatency': '合成レイテンシ：p50 {p50}ms / p95 {p95}ms（{count} サンプル）',
  'speak.emptyMessage': 'そのメッセージには読み上げるテキストがありません。',
  'uptime.text': '🟢 Vozen は **{uptime}** オンラインです。',
  'botstats.title': '📊 **Vozen — 統計**',
  'botstats.servers': 'サーバー：**{value}**',
  'botstats.voiceSessions': '現在の音声セッション：**{value}**',
  'botstats.messagesSpoken': '読み上げたメッセージ：**{value}**',
  'botstats.uptime': '稼働時間：**{value}**',
  'invite.button': 'Vozen を追加',
  'vote.button': 'top.gg で投票',
  'vote.upsell':
    '🗳️ このアカウントで報酬を受け取ったことがなければ、**Vozen Plusを48時間**獲得できます。報酬は1アカウントにつき一度限りです。 {url}',
  'vote.cooldownStatus':
    '🗳️ このアカウントは一度限りの投票報酬をすでに使用しています。Vozenを応援するために投票はできますが、追加のPlusは付与されません。',
  'help.support': '🛟 サポートが必要ですか、または問題を報告したいですか？ {url}',
  'help.source': '📄 オープンソース（AGPL-3.0）— ここで動いているソースそのものを入手：{url}',
  'game.start.needVoice':
    'これは**音声ゲーム**です。先にボイスチャンネルに参加して /join を実行してから開始してください。',
  'game.start.alreadyActive':
    'すでに <#{channel}> でゲームが進行中です。別のを始める前に、それを終える（または `/game stop` を使う）してください。',
  'game.start.premiumLocked':
    '🔒 **{game}** は Premium ゲームです（実際の計算リソースがかかります）。`/premium` を確認してください。',
  'game.start.started': '🎮 **{game}** を開始します！ チャンネルに注目 — 頑張って！',
  'game.start.startedThread':
    '🎮 **{game}** が <#{channel}> で始まりました — そこに参加してください！ ゲームが終わるとスレッドは自動削除されます。',
  'game.thread.winner': '🏆 {winner} がゲームに勝ちました！',
  'game.thread.ended': '🎮 ゲームが終了しました。',
  'game.unknownGame': 'そのゲームはわかりません。リストから選んでください。',
  'game.stop.ok': '🛑 現在のゲームを停止しました。',
  'game.stop.none': '今は進行中のゲームがありません。',
  'game.list.title': '🎮 **ゲーム** — `/game play` で始められます：',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **リーダーボード** — このサーバーの上位プレイヤー：',
  'game.leaderboard.empty':
    'まだゲームがプレイされていません。最初のプレイヤーになろう — `/game play`！',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pts（{wins} 勝）',
  'game.finish.title': '🏁 **ゲーム終了！** 最終スコア：',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 ゲーム終了 — 今回は誰も得点しませんでした。次回に期待！',
  'game.finish.winnerVoice': '{user} の勝ち！',
  'game.guessLanguage.name': '言語当て',
  'game.guessLanguage.desc':
    'ランダムな言語で文を読み上げます — 最初に言語名を当てた人がポイントを獲得します。',
  'game.guessLanguage.intro':
    '🗣️ **言語当て** — {rounds} 個の文を読み上げます。聞こえた言語を入力してください。各ラウンド、最速の正解が勝ちです！',
  'game.guessLanguage.round': '🎧 ラウンド {n}/{total} — 聞いてください…',
  'game.guessLanguage.correct': '✅ **{user}** が正解 — **{language}** でした！',
  'game.guessLanguage.timeout': '⏱️ 時間切れ！ **{language}** でした。',
  'game.guessLanguage.noLanguages':
    'これをプレイするのに十分な声がインストールされていません。管理者に声を追加するよう頼んでください。',
  'game.math.name': '暗算',
  'game.math.desc': '計算を声に出して言います — 最初に答えを入力した人が勝ちです。',
  'game.math.intro':
    '🔢 **暗算** — {rounds} 問の計算。聞いてできるだけ速く答えを入力してください！',
  'game.math.round': '🧮 ラウンド {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** が正解 — 答えは **{answer}** でした！',
  'game.math.timeout': '⏱️ 時間切れ！ 答えは **{answer}** でした。',
  'game.math.plus': 'たす',
  'game.math.minus': 'ひく',
  'game.math.times': 'かける',
  'game.skipCount.name': '抜けた数字',
  'game.skipCount.desc': '声に出して数えますが、1つ数字を飛ばします — 最初に気づいた人が勝ちです。',
  'game.skipCount.intro':
    '🔢 **抜けた数字** — 数を数えますが、1つ飛ばします。抜けた数字を入力してください！（{rounds} ラウンド）',
  'game.skipCount.round': '👂 ラウンド {n}/{total} — どの数字を飛ばしたでしょう？',
  'game.skipCount.correct': '✅ **{user}** が気づいた — 飛ばしたのは **{answer}** でした！',
  'game.skipCount.timeout': '⏱️ 時間切れ！ **{answer}** を飛ばしました。',
  'game.spelling.name': 'スペリング',
  'game.spelling.desc': '単語を言います — 最初に正しくつづった人が勝ちです。',
  'game.spelling.intro':
    '✍️ **スペリング** — {rounds} 個の単語を言います。それぞれ正しくつづって入力してください！',
  'game.spelling.round': '🗣️ ラウンド {n}/{total} — 私が言う単語を書いてください…',
  'game.spelling.correct': '✅ **{user}** が **{word}** を正しくつづりました！',
  'game.spelling.timeout': '⏱️ 時間切れ！ 単語は **{word}** でした。',
  'game.spelling.empty': 'このサーバーの音声言語向けの単語リストがまだありません。',
  'game.spellOut.name': 'つづり当て',
  'game.spellOut.desc': '単語を1文字ずつつづります — 最初に単語全体を書いた人が勝ちです。',
  'game.spellOut.intro':
    '🔡 **つづり当て** — {rounds} 個の単語を1文字ずつつづります。単語全体を入力してください！',
  'game.spellOut.round': '🔤 ラウンド {n}/{total} — 文字を聞いてください…',
  'game.spellOut.correct': '✅ **{user}** が正解 — **{word}**！',
  'game.spellOut.timeout': '⏱️ 時間切れ！ つづりは **{word}** でした。',
  'game.fastSpeech.name': '早口',
  'game.fastSpeech.desc':
    '文をものすごく速く読み上げます — 最初に私が言ったことを入力した人が勝ちです。',
  'game.fastSpeech.intro':
    '💨 **早口** — とんでもない速さで {rounds} 個の文。聞こえたものを入力してください！',
  'game.fastSpeech.round': '⚡ ラウンド {n}/{total} — いくよ、速いよ！',
  'game.fastSpeech.correct': '✅ **{user}** が解読：「{phrase}」',
  'game.fastSpeech.timeout': '⏱️ 時間切れ！ 正解は：「{phrase}」',
  'game.fastSpeech.empty': 'このサーバーの音声言語向けのフレーズがまだありません。',
  'game.accentSwap.name': 'ヘンなアクセント',
  'game.accentSwap.desc': '外国語アクセントで単語を言います — 最初に書いた人が勝ちです。',
  'game.accentSwap.intro':
    '🎭 **ヘンなアクセント** — 違うアクセントで言う {rounds} 個の単語。その単語を入力してください！',
  'game.accentSwap.round': '🌍 ラウンド {n}/{total} — 私が言おうとしている単語は何でしょう？',
  'game.accentSwap.correct': '✅ **{user}** が正解 — **{word}**！',
  'game.accentSwap.timeout': '⏱️ 時間切れ！ 単語は **{word}** でした。',
  'game.reflexes.name': '反射神経',
  'game.reflexes.desc':
    'カウントダウンして GO と叫びます — その後に最初に入力した人が勝ちです。フライングは禁物！',
  'game.reflexes.intro':
    '⚡ **反射神経** — {rounds} ラウンド。**GO** と叫んだら、できるだけ速く何でも入力してください。GO の前に入力するとフライングです！',
  'game.reflexes.ready': '🚦 ラウンド {n}/{total} — 準備して…',
  'game.reflexes.countdown': 'さん… に… いち…',
  'game.reflexes.go': '🟢 **GO！！！**',
  'game.reflexes.goVoice': 'ゴー！',
  'game.reflexes.tooSoon': '🔴 **{user}** がフライング — 早すぎ！',
  'game.reflexes.win': '⚡ **{user}** が最速！ ポイント！',
  'game.reflexes.tooSlow': '😴 誰も間に合いませんでした。次！',
  'game.headsOrTails.name': '表か裏か',
  'game.headsOrTails.desc':
    'コイントスを予想 — 投げる前に表か裏かを入力してください。一番当てた人が勝ちです！',
  'game.headsOrTails.intro':
    '🪙 **表か裏か** — {rounds} ラウンド。各ラウンド、私がコインを投げる前に `表` か `裏` を入力してください。正解ごとに1ポイント！',
  'game.headsOrTails.introVoice': '表か裏か、やってみよう！',
  'game.headsOrTails.round': '🪙 ラウンド {n}/{total} — 表か裏か？ 予想を入力してください！',
  'game.headsOrTails.roundVoice': '表… それとも裏？',
  'game.headsOrTails.heads': '表',
  'game.headsOrTails.tails': '裏',
  'game.headsOrTails.resultVoice': '{side}！',
  'game.headsOrTails.winners': '**{side}**！ ポイント：{users}',
  'game.headsOrTails.noWinners': '**{side}**！ 誰も当てられませんでした — ポイントなし。',
  'game.vozenSays.name': 'Vozen が言う',
  'game.vozenSays.desc':
    '命令が「Vozen が言う」で始まるときだけ従ってください。ワナに引っかかったら負けです！',
  'game.vozenSays.intro':
    '🫡 **Vozen が言う** — {rounds} 個の命令。私が **「Vozen が言う」** で始めたときだけ実行してください。それ以外は動かないで！',
  'game.vozenSays.prefix': 'Vozen が言う',
  'game.vozenSays.verb': '入力',
  'game.vozenSays.real': '🗣️ ラウンド {n}/{total} — 「{command}」',
  'game.vozenSays.trap': '🗣️ ラウンド {n}/{total} — 「{command}」',
  'game.vozenSays.obeyed': '✅ **{user}** が最初に従った — ポイント！',
  'game.vozenSays.caught': '🔴 **{user}** — 「Vozen が言う」とは言っていません！ 引っかかった！',
  'game.vozenSays.nobody': '😴 誰も時間内に **{word}** に従いませんでした。次！',
  'game.vozenSays.trapCleared':
    '😌 ワナでした — お見事、誰も **{word}** に引っかかりませんでした。',
  'game.roulette.name': '真実か挑戦かルーレット',
  'game.roulette.desc':
    'ルーレットを回して、真実か挑戦のお題を1つ読み上げます。もう一度実行すると別のお題が出ます。',
  'game.roulette.header': '🎯 **ルーレットのお題は…**',
  'game.hangman.name': 'ハングマン',
  'game.hangman.desc': '1文字ずつ単語を当てましょう — 6回間違えると終了です。',
  'game.hangman.intro':
    '🪢 **ハングマン** — 1文字ずつ入力して単語を当ててください。単語全体を入力してもOK！',
  'game.hangman.hit': '🟢 **{user}** が **{letter}** を見つけた！',
  'game.hangman.miss': '🔴 **{user}** — **{letter}** はありません。',
  'game.hangman.wrongLetters': '間違い：{letters}',
  'game.hangman.win': '🎉 **{user}** が解いた — **{word}**！',
  'game.hangman.lose': '💀 挑戦回数切れ！ 単語は **{word}** でした。',
  'game.hangman.idle': '🕹️ ゲームを中断しました（プレイヤーなし）。単語は **{word}** でした。',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    '5文字の単語を当てましょう。🟩 位置も正解、🟨 位置違い、⬛ 単語に含まれない。💎 Premium。',
  'game.wordle.intro':
    '🟩 **Wordle** — 5文字の単語を入力してください。みんなで {max} 回まで推測を共有します。🟩 位置も正解 · 🟨 位置違い · ⬛ 単語に含まれない。',
  'game.wordle.guess': '🔤 **{user}** が推測 — 残り **{left}** 回',
  'game.wordle.inWord': '🟢 単語に含まれる：{letters}',
  'game.wordle.out': '🚫 含まれない：~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** が {n} 回で正解 — **{word}**！',
  'game.wordle.lose': '💀 推測回数切れ！ 単語は **{word}** でした。',
  'game.wordle.idle': '🕹️ ゲームを中断しました（プレイヤーなし）。単語は **{word}** でした。',
  'game.tictactoe.name': '○×ゲーム',
  'game.tictactoe.desc':
    '2人用 — 1〜9の数字を入力して自分のマークを置きます。3つ並べたら勝ちです。',
  'game.tictactoe.intro':
    '⭕ **○×ゲーム** — 最初に動いた2人が ❌ と ⭕ です（❌ が先攻）。1〜9の数字を入力してマスに打ちます。',
  'game.tictactoe.turn': '手番：**{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**、今は **{mark}** の手番です。',
  'game.tictactoe.taken': '🚫 マス {cell} は埋まっています — 別のを選んでください。',
  'game.tictactoe.win': '🎉 **{user}**（{mark}）の勝ち！',
  'game.tictactoe.draw': '🤝 引き分け！',
  'game.tictactoe.idle': '🕹️ ゲームが終了しました（プレイヤーなし）。',
  'game.chess.name': 'チェス',
  'game.chess.desc':
    '2人用 — 本格的なチェスのルール（チェック、キャスリング、プロモーション…）。"e4" や "Nf3" のように手を入力してください。💎 Premium。',
  'game.chess.intro':
    '♟️ **チェス** — 最初に動いた2人が白と黒になります（白が先手）。代数記法（"e4"、"Nf3"、"O-O"）または座標（"e2e4"）で手を入力してください。投了するには "resign" と入力します。',
  'game.chess.white': '白',
  'game.chess.black': '黒',
  'game.chess.seats': '⚪ 白：**{white}** · ⚫ 黒：**{black}**',
  'game.chess.turn': '{move} — 手番：**{color}**',
  'game.chess.check': '♟️ チェック！',
  'game.chess.notYourTurn': '⏳ **{user}**、今は **{color}** の手番です。',
  'game.chess.illegalMove': '🚫 "{move}" は合法手ではありません — もう一度お試しください。',
  'game.chess.checkmate': '🏆 チェックメイト（{move}）！ **{user}** の勝ち！',
  'game.chess.draw': '🤝 引き分け（{move}）！',
  'game.chess.resigned': '🏳️ **{user}** が投了 — **{winner}** の勝ち！',
  'game.chess.idle': '🕹️ ゲームが終了しました（プレイヤーなし）。',
  'game.wordChain.name': 'しりとり',
  'game.wordChain.descr':
    '1つの言語で行うターン制のしりとり：前の単語の最後の文字で始まる単語を言います。ライフは2、繰り返し禁止、時間はだんだん短くなります。言語は `language` オプションで選んでください。💎 Premium。',
  'game.wordChain.unavailable':
    '⚠️ しりとりは今 **{lang}** では利用できません（単語リストがありません）。',
  'game.wordChain.lobby':
    '🔗 **{lang}** で **しりとり**！ 参加するには **{seconds}秒**以内にこのチャンネルに何か入力してください。',
  'game.wordChain.notEnough': '😴 参加者が足りません（最低2人必要）。ゲームを中止しました。',
  'game.wordChain.begin':
    '🚀 開始！ プレイヤー：{players}。各単語は前の単語の最後の文字で始めてください。',
  'game.wordChain.turn':
    '**{name}**、あなたの番！ **{letter}** で始まる **{lang}** の単語を — {hearts} · ⏱️ {seconds}秒',
  'game.wordChain.accepted': '✅ **{word}** — 次の文字：**{letter}**',
  'game.wordChain.bad.letter': '↪️ **{letter}** で始めてください。',
  'game.wordChain.bad.short': '📏 短すぎます — 最低 **{min}** 文字。',
  'game.wordChain.bad.repeated': '🔁 その単語はすでに使われています。',
  'game.wordChain.bad.word': '📖 辞書にありません。',
  'game.wordChain.bad.latin': '🔤 A〜Z の文字のみ有効です。',
  'game.wordChain.timeout': '⏰ **{name}** が時間切れ！ 残り {hearts}。',
  'game.wordChain.eliminated': '💀 **{name}** が脱落！',
  'game.wordChain.winner': '🏆 **{name}** がしりとりに勝利！（{chain} 単語）',
  'game.stats.none': 'まだゲームをプレイしていません。`/game play` を試してください！',
  'game.stats.body': '🎮 **あなたの統計** — **{points}** ポイント · **{wins}** 勝 · {rank}',
  'game.stats.rank': '{total} 人中 **#{rank}** 位',
  'game.stats.unranked': 'まだ順位なし',
  'game.pickPrompt': '🎮 どのゲームをプレイしますか？ 選んでください：',
  'game.pickPlaceholder': 'ゲームを選択…',
  'game.pickTimeout':
    '⏰ ゲームが選ばれませんでした — 準備ができたら `/game play` をもう一度実行してください。',
  'pron.listHeader': '🗣️ **あなたの発音** （{count}/{limit}）：',
  'pron.listEmpty': 'まだありません — `/pronunciation add` で追加してください。',
  'pron.set':
    '✅ 保存しました！ **あなた**が「{term}」と入力すると、「{replacement}」と読み上げます。',
  'pron.removed': '🗑️ 「{term}」を削除しました。',
  'pron.notFound':
    '「{term}」の発音は登録されていません。`/pronunciation list` で自分の発音を確認できます。',
  'pron.empty': '単語と読み方は空にはできません。',
  'pron.limitHit':
    '🔒 発音の上限（**{limit}** 件）に達しました。`/pronunciation remove` でひとつ削除してください。',
  'pron.limitUpsell': '💎 Vozen Plus または Premium で上限が **50** に上がります → {url}',
  'pron.modalTitle': 'Vozen に発音を教える',
  'pron.modalTerm': '単語（入力されるとおりに）',
  'pron.modalSay': 'Vozen がどう読むか',
  'spron.listHeader': '🗣️ **サーバーの発音** （{count}/{limit}） — 全員に適用：',
  'spron.listEmpty': 'まだありません — `/server-pronunciation add` で追加してください。',
  'spron.set': '✅ サーバー全体に保存しました！ 「{term}」→「{replacement}」。',
  'spron.removed': '🗑️ サーバーから「{term}」を削除しました。',
  'spron.notFound': 'サーバーには「{term}」の発音がありません。',
  'spron.limitHit':
    '🔒 サーバーは発音の上限（**{limit}** 件）に達しました。`/server-pronunciation remove` でひとつ削除してください。',
  'spron.modalTitle': 'サーバーの発音',
  'spron.modalSay': 'Vozen が全員に対してどう読むか',
  'rand.selectPrompt': '🎲 **ランダマイザー** — いくつの選択肢から選びましょうか？',
  'rand.selectPlaceholder': '選択肢の数…',
  'rand.selectOption': '{n} 個の選択肢',
  'rand.filling': '📝 今開いたフォームに記入してください！',
  'rand.modalTitle': 'ランダマイザー — {amount} 個の選択肢',
  'rand.modalOption': '選択肢 {n}',
  'rand.needTwo': 'カンマで区切って少なくとも2つの選択肢を入力してください（例："pizza, sushi"）。',
  'rand.result': '{count} 個の選択肢の中から、選ぶのは… **{winner}**！',
  'rand.speak': '選ぶのは… {winner}！',
  'rand.notInVoice': '_（私と一緒にボイスチャンネルに参加すれば、次回は声に出して言います）_',
  'rand.timeout':
    '⏰ 何も選ばれませんでした — 準備ができたら `/randomizer` をもう一度実行してください。',
};
