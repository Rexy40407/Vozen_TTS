export default {
  'error.generic': "Aeth rhywbeth o'i le. Rho gynnig arall arni os gweli'n dda.",
  'error.needManageGuild': "Mae angen y caniatâd **Rheoli'r Gweinydd** arnat i wneud hynny.",
  'join.needVoiceChannel': 'Ymuna â sianel lais yn gyntaf, yna rheda /join.',
  'join.missingPerms': 'Mae angen y caniatadau **Connect** a **Speak** arna i yn {channel}.',
  'join.joined':
    "✅ Dw i yn {channel}! Y cam nesaf: dwed `/tts helo` a bydda i'n ei ddarllen yn uchel. Eisiau i mi ddarllen sianel yn awtomatig? Rheda /setup.",
  'join.joinedAutoread':
    "✅ Dw i yn {channel}! Mae popeth yn barod. Teipia yn y sianel darllen awtomatig a bydda i'n ei ddarllen yn uchel. → {readChannel}",
  'leave.left': 'Wedi gadael y sianel lais. Wela i di y tro nesaf!',
  'skip.notInVoice':
    'Dydw i ddim mewn sianel lais eto — ymuna ag un a rheda /join yn gyntaf, yna rho gynnig arall arni.',
  'skip.skipped': "Wedi'i hepgor.",
  'skip.nothing': 'Does dim byd yn chwarae ar hyn o bryd.',
  'tts.notInVoice':
    'Dydw i ddim mewn sianel lais eto — ymuna ag un a rheda /join, yna rho gynnig arall arni.',
  'tts.nothingToRead': "Does dim byd i'w ddarllen yno — anfona ychydig o destun ata i i'w ddweud.",
  'tts.nothingAfterClean':
    "Ar ôl tacluso hynny doedd dim byd ar ôl i'w ddarllen — rho gynnig ar destun arferol (llythrennau neu eiriau).",
  'tts.tooFast': 'Wow, arafa ychydig — rho gynnig arall arni mewn eiliad.',
  'tts.blocked': "Mae'r testun yn cynnwys gair sydd wedi'i rwystro, felly gwnes i ei hepgor.",
  'tts.queued': 'Iawn — mae yn y ciw.',
  'tts.busy': "Dw i'n brysur ar hyn o bryd — rho gynnig arall arni mewn eiliad.",
  'voice.unknownModel': 'Dw i ddim yn adnabod y llais yna — gwiria /voice list.',
  'voice.badSpeed':
    "Rhaid i'r cyflymder fod rhwng 0.5 a 2.0 (mae 1.0 yn arferol). Rho gynnig ar `/voice set model:… speed:1.0`.",
  'voice.set':
    "✅ Dy lais nawr yw **{name}** ar {speed}×. Rho gynnig ar `/tts helo` i'w glywed. (id: `{model}`)",
  'voice.config.title':
    '🎙️ **Gosodiad llais** — dewiswch yr opsiynau isod, yna pwyswch **Cadw**. Ni fydd dim yn newid tan hynny.',
  'voice.config.summary': 'Dewis cyfredol: **{voice}** · peiriant **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Iaith…',
  'voice.config.pickVoice': 'Llais…',
  'voice.config.pickEngine': 'Peiriant…',
  'voice.config.pickSpeed': 'Cyflymder…',
  'voice.config.more': '▼ Rhagor o ieithoedd',
  'voice.config.engDefault': 'Diofyn (lleol)',
  'voice.config.save': 'Cadw',
  'voice.config.cancel': 'Canslo',
  'voice.config.cancelled': 'Gosodiad wedi ei ganslo — ni newidiodd dim.',
  'voice.config.expired': 'Mae’r panel wedi dod i ben — rhedwch `/voice config` eto i barhau.',
  'voice.listHeader': 'Lleisiau ar gael:',
  'voice.listEmpty': "(dim wedi'u gosod)",
  'voice.reset':
    "✅ Mae dy lais yn ôl i'r rhagosodiad. Dewisa un arall unrhyw bryd gyda `/voice list` a `/voice set`.",
  'voice.optout':
    "Ni fyddi'n cael dy ddarllen yn awtomatig mwyach. Rheda /voice opt-in i'w droi yn ôl ymlaen.",
  'voice.optin': "Byddi'n cael dy ddarllen yn awtomatig eto.",
  'voice.notInVoice': 'Dydw i ddim mewn sianel lais eto — rheda /join yn gyntaf.',
  'voice.previewPlaying': 'Yn chwarae sampl…',
  'preview.sample': 'Helo, Vozen ydw i. teipia fo, clyw fo.',
  'laugh.playing': 'Haha! Yn chwarae hynny yn dy lais…',
  'joke.playing': 'Yn dweud jôc…\n> {joke}',
  'joke.unknownLang': "Dw i ddim yn adnabod yr iaith yna. Dewisa un o'r rhestr.",
  'voice.abbrev.added': 'Iawn — bydd {term} yn cael ei ddarllen fel {replacement}.',
  'voice.abbrev.removed': 'Wedi tynnu dy dalfyriad ar gyfer {term}.',
  'voice.abbrev.listHeader': "Dy dalfyriadau personol ({count}/{cap} wedi'u defnyddio):",
  'voice.abbrev.listEmpty': '(dim eto — ychwanega un gyda /voice abbrev add)',
  'voice.abbrev.capReached':
    'Rwyt ti wedi cyrraedd y terfyn o {cap} talfyriad personol. Tynna un cyn ychwanegu un arall.',
  'voice.abbrev.invalidTerm':
    "Rhaid i'r term fod yn un gair (llythrennau a digidau yn unig), hyd at 50 nod.",
  'voice.abbrev.emptyReplacement': 'Ni all y darlleniad fod yn wag.',
  'voice.abbrev.tooLong': "Mae'r darlleniad yn rhy hir (uchafswm 200 nod).",
  'config.wordEmpty': 'Ni all y gair fod yn wag.',
  'config.blocked': "Wedi'i rwystro: {word}.",
  'config.unblocked': "Wedi'i ddadrwystro: {word}.",
  'config.pronListHeader': 'Geiriadur ynganu:',
  'config.pronEmptyValue': '(gwag)',
  'config.listEmpty': '(dim)',
  'config.termEmpty': 'Ni all y term fod yn wag.',
  'config.pronEmpty': 'Ni all yr ynganiad fod yn wag.',
  'config.pronSet': 'Iawn — bydd {term} yn cael ei ddarllen fel {replacement}.',
  'config.pronRemoved': "Wedi tynnu'r ynganiad ar gyfer {term}.",
  'config.channelWrongType': 'Dewisa sianel destun (nid sianel lais na chategori).',
  'config.channelNoAccess':
    "Alla i ddim gweld {channel} — gwiria fy nghaniatadau yno os gweli'n dda.",
  'config.channelSet':
    "Sianel darllen awtomatig wedi'i gosod i {channel}. Nesaf: gwna'n siŵr fod darllen awtomatig ymlaen gyda `/config auto-read active:true`.",
  'config.autoreadOn': 'Mae darllen awtomatig nawr **ymlaen**.',
  'config.autoreadOff': 'Mae darllen awtomatig nawr **i ffwrdd**.',
  'config.maxCharsRange': "Rhaid i'r gwerth uchafswm-nodau fod rhwng 1 a 2000.",
  'config.maxCharsSet': "Uchafswm y nodau fesul neges wedi'i osod i {value}.",
  'config.rateLimitRange': "Rhaid i'r gwerth terfyn-cyfradd fod rhwng 1 a 120.",
  'config.rateLimitSet': "Terfyn cyfradd wedi'i osod i {value} neges y funud.",
  'config.roleSet': "Mae darllen awtomatig nawr wedi'i gyfyngu i aelodau â {role}.",
  'config.roleCleared': "Cyfyngiad rôl wedi'i dynnu — gall pawb gael eu darllen nawr.",
  'config.enabledOn': 'Mae TTS nawr **ymlaen** ar gyfer y gweinydd hwn.',
  'config.enabledOff': 'Mae TTS nawr **i ffwrdd** ar gyfer y gweinydd hwn.',
  'config.defaultVoiceSet':
    "✅ Llais rhagosodedig y gweinydd wedi'i osod i **{name}**. Bydd aelodau heb eu llais eu hunain yn clywed hwn. (id: `{model}`)",
  'config.reset':
    "Cyfluniad wedi'i ailosod i'r rhagosodiadau. Cadwyd dy restr rwystro a'th ynganiadau.",
  'config.showTitle': '**Cyfluniad y gweinydd**',
  'config.showChannel': 'Sianel TTS: {value}',
  'config.showAutoread': 'Darllen awtomatig: {value}',
  'config.showRole': 'Rôl: {value}',
  'config.showEnabled': "Wedi'i alluogi: {value}",
  'config.showVoice': 'Llais rhagosodedig: {value}',
  'config.showMaxChars': 'Uchafswm nodau: {value}',
  'config.showRateLimit': 'Terfyn cyfradd: {value}/mun',
  'config.showBlocklist': 'Rhestr rwystro: {count} gair',
  'config.showPronunciation': 'Ynganiadau: {count} cofnod',
  'config.valueNone': '(dim)',
  'config.valueAny': 'unrhyw un',
  'config.valueAutoDetect': '(canfod awtomatig)',
  'config.on': 'ymlaen',
  'config.off': 'i ffwrdd',
  'config.language.set': "Iaith y rhyngwyneb wedi'i gosod i {language}.",
  'config.language.unsupported': "Nid yw'r iaith yna'n cael ei chefnogi eto.",
  'setup.noChannel':
    'Allwn i ddim dweud pa sianel i\'w defnyddio. Pasia sianel destun yn yr opsiwn "channel".',
  'setup.channelWrongType':
    'Rhaid i\'r sianel darllen awtomatig fod yn sianel destun (nid sianel lais na chategori). Pasia un yn yr opsiwn "channel".',
  'setup.done': "**Popeth yn barod — mae Vozen'n barod.**",
  'setup.channelLine': 'Sianel darllen awtomatig: {channel}',
  'setup.autoreadOn': 'Darllen awtomatig: ymlaen',
  'setup.permsHeader': '**Caniatadau:**',
  'setup.permView': 'ViewChannel (gweld y sianel destun)',
  'setup.permSend': 'SendMessages (postio yn y sianel destun)',
  'setup.permConnect': "Connect (ymuno â'r sianel lais)",
  'setup.permSpeak': 'Speak (siarad yn y sianel lais)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — ar goll',
  'setup.permUnchecked': "⏳ {label} — heb ei wirio eto (bydda i'n ei wirio ar /join)",
  'setup.fixHint':
    "I drwsio'r hyn sydd ar goll: yng ngosodiadau dy weinydd agora rôl Vozen (neu ganiatadau'r sianel) a galluoga'r eitemau sydd wedi'u marcio â ❌.",
  'setup.voiceUncheckedNote':
    "Dwyt ti ddim mewn sianel lais, felly allwn i ddim gwirio Connect/Speak eto — bydda i'n eu gwirio pan redi di /join.",
  'setup.allGood': 'Mae popeth yn barod. Ymuna â sianel lais a rheda /join.',
  'setup.joinedVoice': 'Dw i wedi ymuno â {channel} hefyd — does dim angen rhedeg /join.',
  'setup.readyTalk':
    "Mae popeth yn barod. Teipia yn y sianel darllen awtomatig a bydda i'n ei ddarllen yn uchel.",
  'setup.membersHeader': '**Dwed wrth dy aelodau (y llif 3 cham):**',
  'setup.membersBody':
    "1) Ymuna â sianel lais\n2) Rheda /join er mwyn i mi ymuno â thi\n3) Teipia yn y sianel hon (neu defnyddia /tts) a bydda i'n ei ddarllen yn uchel\nRhestr gorchmynion lawn: /help",
  'stats.title': '**Ystadegau Vozen**',
  'stats.messagesSpoken': "Negeseuon wedi'u llefaru: {value}",
  'stats.cacheHits': 'Trawiadau storfa: {value}',
  'stats.cacheMisses': 'Methiannau storfa: {value}',
  'stats.synthErrors': 'Gwallau syntheseiddio: {value}',
  'stats.voiceDrops': 'Colledion llais: {value}',
  'stats.voiceReconnects': 'Ailgysylltiadau: {value}',
  'stats.votes': 'Pleidleisiau top.gg: {value}',
  'stats.activePlayers': 'Chwaraewyr gweithredol: {value}',
  'stats.servers': 'Gweinyddion: {value}',
  'stats.uptime': 'Amser gweithredu: {value}e',
  'invite.noClientId':
    "Nid yw dolen wahodd Vozen wedi'i sefydlu eto (mae CLIENT_ID ar goll). Rho wybod i weinyddwr y bot.",
  'invite.link': 'Ychwanega Vozen at dy weinydd:\n{url}',
  'vote.noClientId':
    "Nid yw dolen bleidleisio Vozen wedi'i sefydlu eto (mae CLIENT_ID ar goll). Rho wybod i weinyddwr y bot.",
  'vote.link':
    "Pleidleisia dros Vozen (am ddim, bob 12 awr) a helpa mwy o bobl i'w ganfod:\n{url}\nOs nad yw’r cyfrif hwn erioed wedi hawlio’r wobr, mae’n cael **48 awr o Vozen Plus**, unwaith yn unig fesul cyfrif.",
  'help.title': 'Vozen — teipia fo, clyw fo.',
  'help.embedTitle': 'Vozen — Gorchmynion',
  'help.intro':
    "Mae Vozen'n darllen dy destun yn uchel mewn sianeli llais — lleisiau niwral am ddim, dwsinau o ieithoedd.",
  'help.quickStartTitle': 'Dechrau cyflym (3 cham)',
  'help.quickStartBody':
    '1) Ymuna â sianel lais, yna rheda /join\n2) Teipia yn y sianel destun (neu defnyddia /tts Helo bawb!)\n3) (dewisol) Dewisa lais gyda /voice set',
  'help.groupStarted': 'Cychwyn arni',
  'help.groupStartedBody':
    "• /join — dw i'n ymuno â'th sianel lais\n• /leave — dw i'n gadael y sianel lais\n• /tts <testun> — dw i'n darllen testun yn uchel · e.e. /tts Helo bawb!\n• /skip — hepgor beth bynnag dw i'n ei ddarllen nawr",
  'help.groupVoice': 'Dy lais',
  'help.groupVoiceBody':
    "• /voice set <model> — dewisa dy lais · e.e. /voice set en_US-amy-medium\n• /voice list — gweld y lleisiau sydd ar gael\n• /voice preview — clywed sampl o'th lais\n• /voice reset — mynd yn ôl i'r llais rhagosodedig\n• /voice opt-out · /voice opt-in — troi darllen awtomatig i ffwrdd / ymlaen i ti\n• /voice abbrev add|remove|list — slang personol, wedi'i ddarllen dy ffordd (hyd at 10)",
  'help.groupFun': 'Hwyl',
  'help.groupFunBody':
    "• /joke — dw i'n dweud jôc fer (dewisa iaith + chwerthin dewisol) · e.e. /joke English\n• /laugh — dw i'n chwerthin yn uchel yn dy lais presennol",
  'help.groupAdmin': "Gweinyddwr y gweinydd (angen Rheoli'r Gweinydd)",
  'help.groupAdminBody':
    "• /setup — cyfluniad tywysedig un cam · rheda hwn yn gyntaf\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · e.e. /config tts-channel #general\n• /stats — ystadegau'r bot",
  'help.groupMore': 'Rhagor',
  'help.groupMoreBody':
    '• /invite — ychwanega Vozen at weinydd arall\n• /vote — pleidleisia dros Vozen ar top.gg\n• /help — dangos y cymorth hwn',
  'help.footer': 'Newydd yma? Rheda {command} i ddechrau arni.',
  'welcome.title': 'Diolch am ychwanegu Vozen! 👋',
  'welcome.description':
    "Mae Vozen'n darllen dy sgwrs yn uchel mewn sianeli llais — teipia fo, clyw fo.\n\n**Dechrau mewn un cam:** rheda {setup} a bydda i'n sefydlu darllen awtomatig ac ymuno â'th sianel lais.\n\nAngen y rhestr gorchmynion lawn? Rheda {help}.",
  'welcome.enginePlans':
    'Piper neural voices stay free. 💎 Kokoro and Google HD unlock with Vozen Plus or server Premium.',
  'welcome.stepsTitle': "Sut mae aelodau'n ei ddefnyddio (3 cham)",
  'welcome.stepsBody':
    "1) Ymuna â sianel lais\n2) Rheda /join er mwyn i mi ymuno â thi\n3) Teipia yn y sianel destun (neu defnyddia /tts) a bydda i'n ei ddarllen yn uchel\nRhestr gorchmynion lawn: /help",
  'welcome.footer': 'Vozen — teipia fo, clyw fo.',
  'welcome.tagline': 'Llais niwral naturiol — am ddim am byth, dim wal dalu.',
  'stt.guildOnly': "Dim ond y tu mewn i weinydd mae trawsgrifio'n gweithio.",
  'stt.noManage':
    "Mae angen y caniatâd **Rheoli'r Gweinydd** arnat i ddechrau neu stopio trawsgrifio.",
  'stt.notPremium':
    "🎙️ Nodwedd **Premium** yw trawsgrifio byw. Gwela `/premium info` i'w ddatgloi ar gyfer y gweinydd hwn.",
  'stt.unavailable':
    "Nid yw trawsgrifio ar gael ar yr achos hwn (nid yw'r peiriant lleferydd-i-destun wedi'i osod).",
  'stt.notInVoice':
    'Dydw i ddim mewn sianel lais — ymuna ag un a rheda `/join` yn gyntaf, yna dechrau trawsgrifio.',
  'stt.alreadyRunning':
    'Mae trawsgrifio eisoes yn rhedeg ar y gweinydd hwn. Defnyddia `/transcribe stop` yn gyntaf.',
  'stt.atCapacity':
    "Mae gormod o drawsgrifiadau'n rhedeg ar hyn o bryd ar draws pob gweinydd. Rho gynnig arall arni cyn bo hir.",
  'stt.noChannel':
    'Alla i ddim postio trawsgrifiadau yn y sianel hon. Rho gynnig ar redeg y gorchymyn o sianel destun arferol.',
  'stt.started':
    "✅ Trawsgrifio wedi dechrau. Bydd unrhyw un sy'n pwyso **Cydsynio** yn y cyhoeddiad yn cael ei drawsgrifio i'r sianel hon.",
  'stt.startFailed':
    "Allwn i ddim dechrau trawsgrifio (methais â phostio'r cyhoeddiad). Dw i wedi dadwneud popeth — does dim byd yn cael ei recordio. Rho gynnig arall arni.",
  'stt.announceStart':
    "🎙️ **Mae trawsgrifio byw YMLAEN yn y sianel hon.** Dim ond pobl sy'n cydsynio sy'n cael eu trawsgrifio — pwysa'r botwm isod i ganiatáu i'th leferydd gael ei ysgrifennu yma. Gelli dynnu'n ôl unrhyw bryd gyda `/transcribe revoke`.",
  'stt.consentBtn': 'Cydsynio i gael dy drawsgrifio',
  'stt.consentThanks':
    "✅ Diolch — bydd dy leferydd nawr yn cael ei drawsgrifio ar y gweinydd hwn. Tynna'n ôl unrhyw bryd gyda `/transcribe revoke`.",
  'stt.stopped': '🛑 Trawsgrifio wedi stopio.',
  'stt.notRunning': "Nid yw trawsgrifio'n rhedeg ar y gweinydd hwn.",
  'stt.announceStop': '🛑 **Mae trawsgrifio byw NAWR I FFWRDD.** Stopiais i wrando.',
  'stt.revoked':
    "✅ Caniatâd wedi'i dynnu'n ôl — ni chei di dy drawsgrifio ar y gweinydd hwn mwyach. (Mae negeseuon sydd eisoes wedi'u postio'n aros; dilëa nhw yn Discord os wyt ti eisiau.)",
  'stt.revokeNone':
    "Doeddet ti ddim wedi cydsynio i drawsgrifio ar y gweinydd hwn, felly doedd dim byd i'w dynnu'n ôl.",
  'privacy.eraseConfirm':
    "⚠️ Mae hyn yn dileu **pob un** o'th ddata Vozen ar draws pob gweinydd yn barhaol: gosodiadau llais, llysenw llafar, talfyriadau ac ynganiadau personol, pen-blwydd wedi'i gadw, sgorau gemau, ystadegau siarad, ac optio-allan. **Ni ellir dadwneud hyn.** Wyt ti'n siŵr?",
  'privacy.erasePremiumNote':
    "_Nodyn: mae dy Premium/Plus taledig a'i hanes prynu'n cael eu cadw — maen nhw'n perthyn i ti ac i gofnodion ariannol sy'n ofynnol yn ôl y gyfraith. I stopio Premium, gad iddo ddod i ben neu cysyllta â'r cymorth._",
  'privacy.eraseYes': 'Dileu popeth',
  'privacy.eraseNo': 'Canslo',
  'privacy.eraseCancelled': "Wedi'i ganslo — ni ddilëwyd dim byd.",
  'privacy.eraseDone':
    "✅ Wedi'i wneud. Mae'r holl ddata personol amdanat ti wedi'i ddileu'n barhaol.",
  'shutup.notInVoice': 'Dydw i ddim mewn sianel lais eto — ymuna ag un a rheda /join yn gyntaf.',
  'shutup.nothing': 'Does dim byd yn chwarae ar hyn o bryd.',
  'shutup.done': "🤐 Iawn, bydda i'n stopio — clíriais bopeth yn y ciw.",
  'voice.detection.on':
    '✅ Mae canfod iaith yn awtomatig YMLAEN: darllenir pob neges mewn llais ar gyfer ei hiaith a ganfuwyd (gall y siaradwr newid). Diffodda fe gyda `/voice detection active:false`.',
  'voice.detection.off':
    "✅ Mae canfod iaith yn awtomatig I FFWRDD: mae dy un llais sefydlog yn darllen popeth, felly rwyt ti'n swnio'r un fath bob tro.",
  'voice.nickname.set': "✅ Bydd Vozen nawr yn dy alw'n **{name}** yn uchel.",
  'voice.nickname.cleared':
    "✅ Llysenw llafar wedi'i glirio — bydd Vozen yn defnyddio dy enw ar y gweinydd.",
  'voice.nickname.invalid':
    "Does dim byd darllenadwy yn yr enw yna i'w ddweud yn uchel. Rho gynnig ar lythrennau neu rifau.",
  'voice.effect.set':
    "✅ Effaith llais wedi'i gosod i **{effect}** — mae dy negeseuon nawr yn chwarae gyda'r effaith honno. Defnyddia `/voice effect none` i'w diffodd.",
  'voice.effect.cleared': "✅ Effaith llais wedi'i thynnu — llais glân eto.",
  'voice.effect.locked':
    '🔒 Effaith Premium yw **{effect}**. Effeithiau am ddim: 🤖 Robot ac 🔊 Echo. Datgloa bob un gyda Vozen Premium — gwela `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 Peiriant llais Premium yw **💎 Google HD**. Datgloa fe gyda Vozen Plus (personol) neu Vozen Premium (gweinydd) — gwela `/premium`. Yn y cyfamser mae dy lais yn aros ar y peiriant lleol am ddim.',
  'voice.engine.kokoroLocked':
    '🔒 Peiriant llais Premium yw **💎 Kokoro**. Datgloa fe gyda Vozen Plus (personol) neu Vozen Premium (gweinydd) — gwela `/premium`. Yn y cyfamser mae dy lais yn aros ar y peiriant lleol am ddim.',
  'rizz.playing': '😏 Yn gollwng ychydig o swyn…\n> {line}',
  'rizz.unknownLang': "Dw i ddim yn adnabod yr iaith yna. Dewisa un o'r rhestr.",
  'rizz.locked':
    '🔒 Braint Premium yw **/rizz**. Datgloa fe gyda Vozen Plus (ti) neu Premium (y gweinydd hwn). Gwela `/premium`.',
  'sound.playing': '🔊 Yn chwarae **{name}**…',
  'sound.unknown': 'Does gennyf ddim y sain yna. Rheda `/sound` i weld y rhestr.',
  'sound.list':
    '🔊 **Synau:** {sounds}\nChwaraea un gyda `/sound name:<sound>` (mae angen i mi fod yn dy sianel lais).',
  'sound.disabled':
    "🔇 Mae'r bwrdd sain **i ffwrdd** ar y gweinydd hwn. Gall gweinyddwr ei alluogi gyda `/config soundboard`.",
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    "🎂 Pen-blwydd wedi'i gadw: **{day}/{month}**. Bydda i'n dymuno pen-blwydd hapus i ti pan ymuni â sianel lais y diwrnod hwnnw!",
  'birthday.invalid': "Nid yw hwnna'n ddyddiad go iawn. Gwiria'r diwrnod a'r mis.",
  'birthday.cleared': "🎂 Pen-blwydd wedi'i dynnu.",
  'birthday.show': "🎂 Mae dy ben-blwydd wedi'i osod i **{day}/{month}**.",
  'birthday.none': 'Dwyt ti ddim wedi gosod pen-blwydd eto. Defnyddia `/birthday set`.',
  'topspeakers.title': "🗣️ **Prif siaradwyr** — pwy dw i'n eu darllen fwyaf ar y gweinydd hwn:",
  'topspeakers.empty':
    'Dydw i ddim wedi darllen negeseuon neb eto. Sefydla sianel ddarllen gyda `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** neges · 🔥 rhediad o {streak} diwrnod',
  'serverstats.title': "📊 **Ystadegau'r gweinydd**",
  'serverstats.empty':
    'Dim ystadegau eto — dydw i ddim wedi darllen unrhyw negeseuon na rhedeg unrhyw gemau yma. Sefydla gyda `/setup`!',
  'serverstats.messages': "🗣️ **{total}** neges wedi'u darllen · **{speakers}** o bobl",
  'serverstats.topTalkers': '**Prif siaradwyr:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} neg · 🔥 {streak}d',
  'serverstats.streak': '🔥 Y rhediad gweithredol hiraf: **{days}** diwrnod',
  'serverstats.games':
    '🎮 **{points}** pwynt gêm · **{wins}** buddugoliaeth · **{players}** chwaraewr',
  'serverstats.topPlayers': '**Prif chwaraewyr:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pt · {wins} buddugoliaeth',
  'serverstats.upsell':
    "🔒 Dyna'r rhagolwg am ddim. Mae **Premium** yn datgloi rhediadau, ystadegau gemau a'r 5 uchaf llawn — gwela `/premium`.",
  'streak.day': "🔥 Mae <@{user}> ar rediad o **{n} diwrnod**! Dal ati i siarad i'w gadw'n fyw.",
  'leaderboard.autoTitle': '🏆 Prif siaradwyr y gweinydd hwn',
  'premium.title': '💎 **Statws Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Gweinydd:** Premium tan {date}',
  'premium.lineServerFree': '🖥️ **Gweinydd:** Cynllun am ddim',
  'premium.lineUserActive': '👤 **Ti (Plus):** yn weithredol tan {date}',
  'premium.lineUserFree': '👤 **Ti (Plus):** ddim yn weithredol',
  'premium.getHint':
    "Mae popeth rwyt ti'n ei ddefnyddio heddiw yn aros am ddim. Mae Premium yn ychwanegu'r 8 effaith llais i gyd, 24/7 mewn galwad, 50 ynganiad personol, /rizz a'r gemau premium. Cefnogaeth: https://ko-fi.com/",
  'premium.enginePerks':
    '💎 **Premium voice engines:** Kokoro neural and Google HD — unlocked personally with Plus or for everyone with server Premium.',
  'premium.linePass':
    '🎟️ **Dy bas Premium:** {used}/{total} trwydded yn cael eu defnyddio · yn dod i ben {date}',
  'premium.passServers': '↳ Yn cael ei ddefnyddio ar: {servers}',
  'premium.pitch':
    "Does gennyt ti ddim Premium eto. Mae **Vozen Premium** (€3.99/mis am 3 gweinydd, neu €7.99/mis am 8) yn datgloi ar gyfer y gweinydd cyfan: yr 8 effaith llais i gyd, 24/7 mewn galwad, 50 ynganiad personol (yn erbyn 3), y gorchymyn /rizz a'r gemau premium (Cadwyn Eiriau, Wordle, Gwyddbwyll). Mae **Vozen Plus** (€1.99/mis) yn rhoi'r breintiau hynny i ti'n bersonol, ar unrhyw weinydd.",
  'premium.buyHint':
    '▶ **Cael Premium:** {link}\nAr ôl prynu, rheda `/premium activate` ar y gweinydd rwyt ti eisiau.',
  'premium.confirmActivate':
    "Defnyddio **1 o'th {total} trwydded Premium** ar **y gweinydd hwn**? Mae gennyt **{used}** yn cael eu defnyddio ar hyn o bryd. Gelli ei rhyddhau'n hwyrach gyda `/premium deactivate` — mae'r cloc yn dal i redeg ar y pas y naill ffordd neu'r llall.",
  'premium.confirmYes': '💎 Defnyddio trwydded',
  'premium.confirmNo': 'Canslo',
  'premium.activateOk':
    '✅ Mae Premium nawr yn weithredol ar **y gweinydd hwn** tan {date}. Trwyddedau: **{used}/{total}** yn cael eu defnyddio.',
  'premium.activateCancelled': "Wedi'i ganslo — ni ddefnyddiwyd unrhyw drwydded.",
  'premium.activateTimeout': 'Amser wedi dod i ben — ni ddefnyddiwyd unrhyw drwydded.',
  'premium.noPass':
    'Does gennyt ti ddim pas Premium gweithredol. Cael un a bydd yn glanio ar dy gyfrif — yna rheda `/premium activate` yma.\n▶ {link}',
  'premium.alreadyActive':
    "Mae gan y gweinydd hwn un o'th drwyddedau Premium eisoes. Dim byd i'w wneud.",
  'premium.noSeats':
    'Mae dy holl **{total}** trwydded Premium yn cael eu defnyddio ({servers}). Rhyddha un gyda `/premium deactivate` yno, yna rho gynnig arall arni yma.',
  'premium.needManageGuild':
    "Mae actifadu Premium yn effeithio ar y gweinydd cyfan — dim ond aelodau â **Rheoli'r Gweinydd** all ei wneud. Gofynna i weinyddwr.",
  'premium.deactivateOk':
    '✅ Rhyddhawyd trwydded Premium y gweinydd hwn. Defnyddia hi ar weinydd arall gyda `/premium activate`.',
  'premium.deactivateNone': "Does gan y gweinydd hwn ddim trwydded Premium gennyt ti i'w rhyddhau.",
  'premium.thisServer': 'y gweinydd hwn',
  'grant.denied': "⛔ Mae'r gorchymyn hwn ar gyfer perchennog y bot yn unig.",
  'grant.okPremium':
    "✅ Rhoddwyd i <@{user}> **bas Premium** ({seats} trwydded) am **{days}** diwrnod — yn dod i ben {date}. Maen nhw'n ei actifadu gyda `/premium activate`.",
  'grant.okPlus':
    '✅ Rhoddwyd i <@{user}> **Vozen Plus** am **{days}** diwrnod — yn dod i ben {date}.',
  'gencode.done':
    "✅ Cynhyrchwyd **{count}** cod {plan}, **{days}** diwrnod yr un. Rhanna nhw'n breifat:\n{list}",
  'redeem.okPlus':
    "🎁 Wedi'i adbrynu! Cefaist **Vozen Plus** am **{days}** diwrnod — yn dod i ben {date}.",
  'redeem.okPremium':
    "🎁 Wedi'i adbrynu! Cefaist **bas Premium** ({seats} trwydded) am **{days}** diwrnod — yn dod i ben {date}. Actifada fe yn dy weinydd gyda `/premium activate`.",
  'redeem.notFound': "❌ Nid yw'r cod yna'n bodoli. Gwiria fe eto a rho gynnig arall arni.",
  'redeem.used': "❌ Mae'r cod yna eisoes wedi'i adbrynu.",
  'redeem.expired': "❌ Mae'r cod yna wedi dod i ben.",
  'config.blockLimit':
    "Mae gan y gweinydd hwn eisoes yr uchafswm o {max} gair wedi'u rhwystro. Tynna un cyn ychwanegu un arall.",
  'config.xsaidOn':
    'Bydd Vozen nawr yn cyhoeddi **pwy siaradodd** cyn pob neges (e.e. "Dywedodd Alex helo"). Diffodda gyda `/config x-said active:false`.',
  'config.xsaidOff':
    "**Ni fydd** Vozen yn cyhoeddi pwy siaradodd mwyach — mae'n darllen y neges yn unig.",
  'config.autojoinOn':
    "✅ Ymuno awtomatig **ymlaen** — bydd Vozen yn ymuno â'th sianel lais pan deipi di yn y sianel TTS.",
  'config.autojoinOff':
    "Ymuno awtomatig **i ffwrdd** — defnyddia `/join` i ddod â Vozen i'r llais.",
  'config.stayOn':
    '✅ 24/7 mewn galwad **ymlaen** — bydd Vozen yn aros yn y sianel lais hyd yn oed pan fydd yn gwagio, ac yn dod yn ôl ar ôl ailgychwyn. 💎 Angen Premium i gael effaith (pryna neu `/redeem` cod, yna `/premium activate`).',
  'config.stayOff':
    '24/7 mewn galwad **i ffwrdd** — mae Vozen yn gadael pan fydd y sianel lais yn gwagio (rhagosodedig).',
  'config.readBotsOn':
    '✅ Bydd Vozen nawr yn darllen negeseuon o **fotiau eraill a webhooks** hefyd.',
  'config.readBotsOff':
    "Bydd Vozen yn **anwybyddu** botiau eraill a webhooks (dim ond pobl go iawn sy'n cael eu darllen).",
  'config.textInVoiceOn':
    "✅ Bydd Vozen hefyd yn darllen y **sgwrs destun y tu mewn i'w sianel lais**.",
  'config.textInVoiceOff':
    '**Ni fydd** Vozen yn darllen sgwrs destun y sianel lais (dim ond y sianel TTS).',
  'config.antispamOn':
    "✅ Gwrth-sbam **ymlaen** — ni fydd Vozen yn darllen negeseuon sbam (ailadrodd geiriau'n dorfol neu'r un neges fawr wedi'i phostio dro ar ôl tro).",
  'config.antispamOff': 'Gwrth-sbam **i ffwrdd** — mae Vozen yn darllen pob neges fel arfer.',
  'config.streaksOn':
    '✅ Hysbysiadau rhediad **ymlaen** — mae Vozen yn dangos neges rhediad diwrnod 🔥 y tro cyntaf mae pob person yn siarad bob dydd.',
  'config.streaksOff':
    "Hysbysiadau rhediad **i ffwrdd** — mae Vozen yn dal i olrhain rhediadau (gwela `/top-speakers`) ond yn cadw'n dawel amdanyn nhw.",
  'config.soundboardOn': 'Bwrdd sain **ymlaen** — gall unrhyw un chwarae clipiau gyda `/sound`.',
  'config.soundboardOff':
    "Bwrdd sain **i ffwrdd** — mae `/sound` wedi'i analluogi ar y gweinydd hwn.",
  'config.votePromosLabel': 'Hysbysiadau gwobr top.gg + Vozen Support',
  'config.greetOn': "✅ Bydda i'n cyfarch pobl wrth eu henw pan ymunan nhw â'r sianel lais.",
  'config.greetOff': "🔇 **Ni fydda i'n** cyfarch pobl pan ymunan nhw â'r sianel lais.",
  'config.greetLangSet': "✅ Iaith cyfarch wrth ymuno wedi'i gosod i **{language}**.",
  'config.showXsaid': "Cyhoeddi'r siaradwr (xsaid): {value}",
  'config.showAutojoin': 'Ymuno awtomatig: {value}',
  'config.showReadBots': 'Darllen botiau/webhooks: {value}',
  'config.showTextInVoice': 'Testun-mewn-llais: {value}',
  'config.showAntispam': 'Gwrth-sbam: {value}',
  'config.showSoundboard': 'Bwrdd sain (/sound): {value}',
  'config.showGreet': 'Cyfarch wrth ymuno: {value} ({language})',
  'stats.synthLatency': 'Hwyrni syntheseiddio: p50 {p50}ms / p95 {p95}ms ({count} sampl)',
  'speak.emptyMessage': "Does dim testun yn y neges yna i'w ddarllen yn uchel.",
  'uptime.text': '🟢 Mae Vozen wedi bod ar-lein ers **{uptime}**.',
  'botstats.title': '📊 **Vozen — ystadegau**',
  'botstats.servers': 'Gweinyddion: **{value}**',
  'botstats.voiceSessions': 'Sesiynau llais nawr: **{value}**',
  'botstats.messagesSpoken': "Negeseuon wedi'u llefaru: **{value}**",
  'botstats.uptime': 'Amser gweithredu: **{value}**',
  'invite.button': 'Ychwanega Vozen',
  'vote.button': 'Pleidleisia ar top.gg',
  'vote.upsell':
    '🗳️ Os nad yw’r cyfrif hwn erioed wedi hawlio’r wobr, mae’n cael **48 awr o Vozen Plus**, unwaith yn unig fesul cyfrif. {url}',
  'vote.cooldownStatus':
    '🗳️ Mae’r cyfrif hwn eisoes wedi defnyddio ei wobr bleidleisio unwaith. Gallwch bleidleisio o hyd i gefnogi Vozen, ond ni fydd yn rhoi rhagor o Plus.',
  'help.support': '🛟 Angen help neu eisiau riportio problem? {url}',
  'help.source': "📄 Cod agored (AGPL-3.0) — cael y cod union sy'n rhedeg yma: {url}",
  'game.start.needVoice':
    '**Gêm lais** yw hon — neidia i mewn i sianel lais a rheda /join yn gyntaf, yna dechrau hi.',
  'game.start.alreadyActive':
    'Mae gêm eisoes yn rhedeg yn <#{channel}>. Gorffena hi (neu defnyddia `/game stop`) cyn dechrau un arall.',
  'game.start.premiumLocked':
    "🔒 Gêm Premium yw **{game}** (mae'n costio cyfrifiant go iawn). Gwela `/premium`.",
  'game.start.started': '🎮 Yn dechrau **{game}**! Cadw lygad ar y sianel — pob lwc!',
  'game.start.startedThread':
    "🎮 Dechreuodd **{game}** yn <#{channel}> — ymuna yno! Mae'r edefyn yn dileu ei hun pan fydd y gêm yn gorffen.",
  'game.thread.winner': '🏆 Enillodd {winner} y gêm!',
  'game.thread.ended': '🎮 Daeth y gêm i ben.',
  'game.unknownGame': "Dw i ddim yn adnabod y gêm yna. Dewisa un o'r rhestr.",
  'game.stop.ok': '🛑 Stopiwyd y gêm bresennol.',
  'game.stop.none': 'Does dim gêm yn rhedeg ar hyn o bryd.',
  'game.list.title': '🎮 **Gemau** — dechrau un gyda `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Tabl Arweinwyr** — prif chwaraewyr y gweinydd hwn:',
  'game.leaderboard.empty': 'Does neb wedi chwarae unrhyw gemau eto. Bydd y cyntaf — `/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pt ({wins} buddugoliaeth)',
  'game.finish.title': '🏁 **Diwedd y gêm!** Sgorau terfynol:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Diwedd y gêm — sgoriodd neb y tro hwn. Tro nesaf!',
  'game.finish.winnerVoice': "{user} sy'n ennill!",
  'game.guessLanguage.name': "Dyfala'r Iaith",
  'game.guessLanguage.desc':
    "Dw i'n darllen brawddeg mewn iaith ar hap — yr un cyntaf i'w henwi sy'n ennill y pwynt.",
  'game.guessLanguage.intro':
    "🗣️ **Dyfala'r Iaith** — bydda i'n darllen {rounds} brawddeg. Teipia pa iaith rwyt ti'n ei chlywed. Yr ateb cywir cyflymaf sy'n ennill pob rownd!",
  'game.guessLanguage.round': '🎧 Rownd {n}/{total} — gwranda…',
  'game.guessLanguage.correct': '✅ Cafodd **{user}** hi — **{language}** oedd hi!',
  'game.guessLanguage.timeout': '⏱️ Amser! **{language}** oedd honno.',
  'game.guessLanguage.noLanguages':
    "Does gennyf ddim digon o leisiau wedi'u gosod i chwarae hyn. Gofynna i weinyddwr ychwanegu mwy o leisiau.",
  'game.math.name': 'Mathemateg Pen',
  'game.math.desc': "Dw i'n dweud swm yn uchel — yr un cyntaf i deipio'r ateb sy'n ennill.",
  'game.math.intro':
    "🔢 **Mathemateg Pen** — {rounds} swm. Gwranda a theipia'r ateb mor gyflym ag y galli!",
  'game.math.round': '🧮 Rownd {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': "✅ Cafodd **{user}** hi'n berffaith — **{answer}** oedd yr ateb!",
  'game.math.timeout': '⏱️ Amser! **{answer}** oedd yr ateb.',
  'game.math.plus': 'adio',
  'game.math.minus': 'tynnu',
  'game.math.times': 'lluosi',
  'game.skipCount.name': 'Y Rhif Coll',
  'game.skipCount.desc':
    "Dw i'n cyfri'n uchel ond yn hepgor un rhif — yr un cyntaf i'w ddal sy'n ennill.",
  'game.skipCount.intro':
    "🔢 **Y Rhif Coll** — dw i'n cyfri, ond dw i'n hepgor un. Teipia'r rhif coll! ({rounds} rownd)",
  'game.skipCount.round': '👂 Rownd {n}/{total} — pa rif wnes i ei hepgor?',
  'game.skipCount.correct': '✅ Daliodd **{user}** e — hepgorais i **{answer}**!',
  'game.skipCount.timeout': '⏱️ Amser! Hepgorais i **{answer}**.',
  'game.spelling.name': 'Sillafu',
  'game.spelling.desc': "Dw i'n dweud gair — yr un cyntaf i'w sillafu'n gywir sy'n ennill.",
  'game.spelling.intro':
    "✍️ **Sillafu** — bydda i'n dweud {rounds} gair. Teipia bob un wedi'i sillafu'n gywir!",
  'game.spelling.round': "🗣️ Rownd {n}/{total} — ysgrifenna'r gair dw i'n ei ddweud…",
  'game.spelling.correct': '✅ Sillafodd **{user}** **{word}** yn gywir!',
  'game.spelling.timeout': '⏱️ Amser! **{word}** oedd y gair.',
  'game.spelling.empty': 'Does gennyf ddim rhestr eiriau ar gyfer iaith llais y gweinydd hwn eto.',
  'game.spellOut.name': 'Sillafu o Chwith',
  'game.spellOut.desc':
    "Dw i'n sillafu gair lythyren wrth lythyren — yr un cyntaf i ysgrifennu'r gair cyfan sy'n ennill.",
  'game.spellOut.intro':
    "🔡 **Sillafu o Chwith** — dw i'n sillafu {rounds} gair lythyren wrth lythyren. Teipia'r gair cyfan!",
  'game.spellOut.round': '🔤 Rownd {n}/{total} — gwranda ar y llythrennau…',
  'game.spellOut.correct': '✅ Cafodd **{user}** hi — **{word}**!',
  'game.spellOut.timeout': '⏱️ Amser! Roedd yn sillafu **{word}**.',
  'game.fastSpeech.name': 'Siarad Cyflym',
  'game.fastSpeech.desc':
    "Dw i'n darllen brawddeg yn super gyflym — yr un cyntaf i deipio beth ddwedais i sy'n ennill.",
  'game.fastSpeech.intro':
    "💨 **Siarad Cyflym** — {rounds} brawddeg ar gyflymder gwallgof. Teipia beth rwyt ti'n ei glywed!",
  'game.fastSpeech.round': "⚡ Rownd {n}/{total} — dyma fe'n dod, yn gyflym!",
  'game.fastSpeech.correct': '✅ Datgododd **{user}** e: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ Amser! Dyma oedd e: “{phrase}”',
  'game.fastSpeech.empty': 'Does gennyf ddim ymadroddion ar gyfer iaith llais y gweinydd hwn eto.',
  'game.accentSwap.name': 'Acen Ddoniol',
  'game.accentSwap.desc':
    "Dw i'n dweud gair ag acen dramor — yr un cyntaf i'w ysgrifennu sy'n ennill.",
  'game.accentSwap.intro':
    "🎭 **Acen Ddoniol** — {rounds} gair wedi'u dweud â'r acen anghywir. Teipia'r gair!",
  'game.accentSwap.round': "🌍 Rownd {n}/{total} — pa air dw i'n ceisio'i ddweud?",
  'game.accentSwap.correct': '✅ Cafodd **{user}** hi — **{word}**!',
  'game.accentSwap.timeout': '⏱️ Amser! **{word}** oedd y gair.',
  'game.reflexes.name': 'Atgyrchau',
  'game.reflexes.desc':
    "Dw i'n cyfri i lawr, yna'n gweiddi EWCH — yr un cyntaf i deipio ar ôl hynny sy'n ennill. Paid â neidio'n gynnar!",
  'game.reflexes.intro':
    "⚡ **Atgyrchau** — {rounds} rownd. Pan fydda i'n gweiddi **EWCH**, teipia unrhyw beth mor gyflym ag y galli. Teipia cyn EWCH ac mae'n gychwyn ffug!",
  'game.reflexes.ready': '🚦 Rownd {n}/{total} — bydd yn barod…',
  'game.reflexes.countdown': 'tri… dau… un…',
  'game.reflexes.go': '🟢 **EWCH!!!**',
  'game.reflexes.goVoice': 'Ewch!',
  'game.reflexes.tooSoon': '🔴 Neidiodd **{user}** yn rhy fuan — rhy gynnar!',
  'game.reflexes.win': "⚡ **{user}** yw'r cyflymaf! Pwynt!",
  'game.reflexes.tooSlow': '😴 Ni ymatebodd neb mewn pryd. Nesaf!',
  'game.headsOrTails.name': 'Pen neu Gynffon',
  'game.headsOrTails.desc':
    "Galwa'r darn arian — teipia pen neu cynffon cyn i mi ei daflu. Y dyfalwr gorau sy'n ennill!",
  'game.headsOrTails.intro':
    "🪙 **Pen neu Gynffon** — {rounds} rownd. Ym mhob rownd, teipia `heads` neu `tails` cyn i mi daflu'r darn arian. 1 pwynt am bob galwad gywir!",
  'game.headsOrTails.introVoice': 'Gadewch i ni chwarae pen neu gynffon!',
  'game.headsOrTails.round': '🪙 Rownd {n}/{total} — pen neu gynffon? Teipia dy alwad!',
  'game.headsOrTails.roundVoice': 'Pen… neu gynffon?',
  'game.headsOrTails.heads': 'pen',
  'game.headsOrTails.tails': 'cynffon',
  'game.headsOrTails.resultVoice': '{side} yw hi!',
  'game.headsOrTails.winners': '**{side}** yw hi! Pwynt i: {users}',
  'game.headsOrTails.noWinners': '**{side}** yw hi! Ni alwodd neb hi — dim pwyntiau.',
  'game.vozenSays.name': 'Vozen yn Dweud',
  'game.vozenSays.desc':
    "Ufuddha dim ond pan fydd y gorchymyn yn dechrau gyda 'Vozen yn dweud'. Syrthia am fagl ac rwyt ti wedi dy ddal!",
  'game.vozenSays.intro':
    "🫡 **Vozen yn Dweud** — {rounds} gorchymyn. Gwna fe DIM OND os dechreua i gyda **'Vozen yn dweud'**. Fel arall, paid â symud!",
  'game.vozenSays.prefix': 'Vozen yn dweud',
  'game.vozenSays.verb': 'teipiwch',
  'game.vozenSays.real': '🗣️ Rownd {n}/{total} — “{command}”',
  'game.vozenSays.trap': '🗣️ Rownd {n}/{total} — “{command}”',
  'game.vozenSays.obeyed': '✅ Ufuddhaodd **{user}** yn gyntaf — pwynt!',
  'game.vozenSays.caught': '🔴 **{user}** — ddwedais i ddim Vozen yn dweud! Wedi dy ddal!',
  'game.vozenSays.nobody': '😴 Ni ufuddhaodd neb i **{word}** mewn pryd. Nesaf!',
  'game.vozenSays.trapCleared': '😌 Magl oedd hi — da iawn, syrthiodd neb am **{word}**.',
  'game.roulette.name': 'Rwlét Gwir neu Her',
  'game.roulette.desc':
    "Dw i'n troelli ac yn darllen un her gwir-neu-her yn uchel. Rheda fe eto am un arall.",
  'game.roulette.header': "🎯 **Mae'r olwyn yn dweud…**",
  'game.hangman.name': 'Crocbren',
  'game.hangman.desc': "Dyfala'r gair un lythyren ar y tro — 6 methiant ac mae ar ben.",
  'game.hangman.intro':
    "🪢 **Crocbren** — teipia un lythyren ar y tro i ddyfalu'r gair. Gelli hefyd deipio'r gair cyfan!",
  'game.hangman.hit': '🟢 Ffeindiodd **{user}** **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — dim **{letter}**.',
  'game.hangman.wrongLetters': 'Anghywir: {letters}',
  'game.hangman.win': '🎉 Datrysodd **{user}** e — **{word}**!',
  'game.hangman.lose': '💀 Allan o gynigion! **{word}** oedd y gair.',
  'game.hangman.idle': "🕹️ Gêm wedi'i hoedi (neb yn chwarae). **{word}** oedd y gair.",
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    "Dyfala'r gair 5-llythyren. 🟩 lle cywir, 🟨 lle anghywir, ⬛ ddim yn y gair. 💎 Premium.",
  'game.wordle.intro':
    "🟩 **Wordle** — teipia air 5-llythyren. Rydych chi'n rhannu {max} cynnig. 🟩 lle cywir · 🟨 lle anghywir · ⬛ ddim yn y gair.",
  'game.wordle.guess': '🔤 Ceisiodd **{user}** — **{left}** cynnig ar ôl',
  'game.wordle.inWord': '🟢 yn y gair: {letters}',
  'game.wordle.out': '🚫 allan: ~~{letters}~~',
  'game.wordle.win': '🎉 Cafodd **{user}** hi mewn {n} — **{word}**!',
  'game.wordle.lose': '💀 Allan o gynigion! **{word}** oedd y gair.',
  'game.wordle.idle': "🕹️ Gêm wedi'i hoedi (neb yn chwarae). **{word}** oedd y gair.",
  'game.tictactoe.name': 'Croesau a Chylchau',
  'game.tictactoe.desc':
    "Dau chwaraewr — teipia rif 1-9 i osod dy farc. Tri mewn rhes sy'n ennill.",
  'game.tictactoe.intro':
    "⭕ **Croesau a Chylchau** — y ddau chwaraewr cyntaf i symud yw ❌ a ⭕ (❌ sy'n dechrau). Teipia rif 1-9 i chwarae dy gell.",
  'game.tictactoe.turn': 'Tro: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, tro **{mark}** yw hi.',
  'game.tictactoe.taken': "🚫 Mae cell {cell} wedi'i chymryd — dewisa un arall.",
  'game.tictactoe.win': '🎉 Mae **{user}** ({mark}) yn ennill!',
  'game.tictactoe.draw': '🤝 Gêm gyfartal!',
  'game.tictactoe.idle': '🕹️ Daeth y gêm i ben (neb yn chwarae).',
  'game.chess.name': 'Gwyddbwyll',
  'game.chess.desc':
    'Dau chwaraewr — rheolau gwyddbwyll go iawn (siec, castellu, dyrchafu…). Teipia symudiad fel "e4" neu "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Gwyddbwyll** — y ddau chwaraewr cyntaf i symud yw Gwyn a Du (Gwyn sy\'n dechrau). Teipia symudiad mewn nodiant algebraidd ("e4", "Nf3", "O-O") neu gyfesurynnau ("e2e4"). Teipia "resign" i ildio.',
  'game.chess.white': 'Gwyn',
  'game.chess.black': 'Du',
  'game.chess.seats': '⚪ Gwyn: **{white}** · ⚫ Du: **{black}**',
  'game.chess.turn': '{move} — tro: **{color}**',
  'game.chess.check': '♟️ Siec!',
  'game.chess.notYourTurn': '⏳ **{user}**, tro **{color}** yw hi.',
  'game.chess.illegalMove': '🚫 Nid yw "{move}" yn symudiad cyfreithlon — rho gynnig arall arni.',
  'game.chess.checkmate': '🏆 Siachmat ({move})! Mae **{user}** yn ennill!',
  'game.chess.draw': '🤝 Gêm gyfartal ({move})!',
  'game.chess.resigned': '🏳️ Ildiodd **{user}** — mae **{winner}** yn ennill!',
  'game.chess.idle': '🕹️ Daeth y gêm i ben (neb yn chwarae).',
  'game.wordChain.name': 'Cadwyn Eiriau',
  'game.wordChain.descr':
    "Cadwyn eiriau yn ôl y tro mewn un iaith: dwed air sy'n dechrau gyda llythyren olaf yr un blaenorol. 2 fywyd, dim ailadrodd, mae'r cloc yn cyflymu. Dewisa'r iaith gyda'r opsiwn `language`. 💎 Premium.",
  'game.wordChain.unavailable':
    '⚠️ Nid yw Cadwyn Eiriau ar gael yn **{lang}** ar hyn o bryd (rhestr eiriau ar goll).',
  'game.wordChain.lobby':
    '🔗 **Cadwyn Eiriau** yn **{lang}**! Teipia unrhyw beth yn y sianel hon o fewn **{seconds}e** i ymuno.',
  'game.wordChain.notEnough':
    "😴 Ni ymunodd digon o chwaraewyr (angen o leiaf 2). Gêm wedi'i chanslo.",
  'game.wordChain.begin':
    "🚀 Yn dechrau! Chwaraewyr: {players}. Rhaid i bob gair ddechrau gyda llythyren olaf yr un o'i flaen.",
  'game.wordChain.turn':
    '**{name}**, dy dro di! Gair **{lang}** yn dechrau gyda **{letter}** — {hearts} · ⏱️ {seconds}e',
  'game.wordChain.accepted': '✅ **{word}** — llythyren nesaf: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Rhaid iddo ddechrau gyda **{letter}**.',
  'game.wordChain.bad.short': '📏 Rhy fyr — o leiaf **{min}** llythyren.',
  'game.wordChain.bad.repeated': '🔁 Defnyddiwyd y gair yna eisoes.',
  'game.wordChain.bad.word': '📖 Nid yw hwnna yn y geiriadur.',
  'game.wordChain.bad.latin': "🔤 Dim ond llythrennau A–Z sy'n cyfrif.",
  'game.wordChain.timeout': '⏰ Rhedodd **{name}** allan o amser! {hearts} ar ôl.',
  'game.wordChain.eliminated': '💀 Mae **{name}** allan!',
  'game.wordChain.winner': '🏆 Mae **{name}** yn ennill y gadwyn! ({chain} gair)',
  'game.stats.none': 'Dwyt ti ddim wedi chwarae unrhyw gemau eto. Rho gynnig ar `/game play`!',
  'game.stats.body': '🎮 **Dy ystadegau** — **{points}** pwynt · **{wins}** buddugoliaeth · {rank}',
  'game.stats.rank': 'safle **#{rank}** o {total}',
  'game.stats.unranked': 'dim safle eto',
  'game.pickPrompt': '🎮 Pa gêm rwyt ti eisiau ei chwarae? Dewisa un:',
  'game.pickPlaceholder': 'Dewisa gêm…',
  'game.pickTimeout': "⏰ Ni ddewiswyd gêm — rheda `/game play` eto pan fyddi'n barod.",
  'pron.listHeader': '🗣️ **Dy ynganiadau** ({count}/{limit}):',
  'pron.listEmpty': 'Does gennyt ti ddim un eto — ychwanega un gyda `/pronunciation add`.',
  'pron.set': "✅ Wedi'i gadw! Pan deipi **di** “{term}”, bydda i'n dweud “{replacement}”.",
  'pron.removed': '🗑️ Tynnwyd “{term}”.',
  'pron.notFound':
    'Does gennyt ti ddim ynganiad ar gyfer “{term}”. Gwela dy rai gyda `/pronunciation list`.',
  'pron.empty': "Ni all y gair a sut i'w ddweud fod yn wag.",
  'pron.limitHit':
    '🔒 Cyrhaeddaist dy derfyn o **{limit}** ynganiad. Tynna un gyda `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Mae Vozen Plus neu Premium yn ei godi i **50** → {url}',
  'pron.modalTitle': 'Dysga ynganiad i Vozen',
  'pron.modalTerm': 'Y gair (fel mae pobl yn ei deipio)',
  'pron.modalSay': 'Sut y dylai Vozen ei ddweud',
  'spron.listHeader': "🗣️ **Ynganiadau'r gweinydd** ({count}/{limit}) — yn berthnasol i bawb:",
  'spron.listEmpty': 'Dim un eto — ychwanega un gyda `/server-pronunciation add`.',
  'spron.set': "✅ Wedi'i gadw ar gyfer y gweinydd cyfan! “{term}” → “{replacement}”.",
  'spron.removed': "🗑️ Tynnwyd “{term}” o'r gweinydd.",
  'spron.notFound': 'Does gan y gweinydd ddim ynganiad ar gyfer “{term}”.',
  'spron.limitHit':
    '🔒 Cyrhaeddodd y gweinydd ei derfyn o **{limit}** ynganiad. Tynna un gyda `/server-pronunciation remove`.',
  'spron.modalTitle': 'Ynganiad y gweinydd',
  'spron.modalSay': 'Sut mae Vozen yn ei ddweud i bawb',
  'rand.selectPrompt': '🎲 **Randomizer** — o faint o opsiynau rwyt ti eisiau i mi ddewis?',
  'rand.selectPlaceholder': 'Nifer o opsiynau…',
  'rand.selectOption': '{n} opsiwn',
  'rand.filling': "📝 Llenwa'r ffurflen sydd newydd agor!",
  'rand.modalTitle': 'Randomizer — {amount} opsiwn',
  'rand.modalOption': 'Opsiwn {n}',
  'rand.needTwo': 'Rho o leiaf 2 opsiwn i mi wedi\'u gwahanu gan atalnodau (e.e. "pizza, sushi").',
  'rand.result': "O blith {count} opsiwn, dw i'n dewis… **{winner}**!",
  'rand.speak': "Dw i'n dewis… {winner}!",
  'rand.notInVoice': "_(ymuna â sianel lais gyda mi a bydda i'n ei ddweud yn uchel y tro nesaf)_",
  'rand.timeout': "⏰ Dim byd wedi'i ddewis — rheda `/randomizer` eto pan fyddi'n barod.",
};
