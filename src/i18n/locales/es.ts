export default {
  'error.generic': 'Algo salió mal. Inténtalo de nuevo.',
  'error.needManageGuild': 'Necesitas el permiso **Gestionar servidor** para hacer eso.',
  'join.needVoiceChannel': 'Únete primero a un canal de voz y luego ejecuta /join.',
  'join.missingPerms': 'Necesito los permisos **Conectar** y **Hablar** en {channel}.',
  'join.joined':
    '✅ ¡Ya estoy en {channel}! Siguiente paso: escribe `/tts hola` y lo leeré en voz alta. ¿Quieres que lea un canal automáticamente? Ejecuta /setup.',
  'join.joinedAutoread':
    '✅ ¡Ya estoy en {channel}! Todo listo. Escribe en el canal de lectura automática y lo leeré en voz alta. → {readChannel}',
  'leave.left': 'Salí del canal de voz. ¡Hasta la próxima!',
  'skip.notInVoice':
    'Aún no estoy en un canal de voz: únete a uno y ejecuta /join primero, luego vuelve a intentarlo.',
  'skip.skipped': 'Saltado.',
  'skip.nothing': 'Ahora mismo no se está reproduciendo nada.',
  'tts.notInVoice':
    'Aún no estoy en un canal de voz: únete a uno y ejecuta /join, luego vuelve a intentarlo.',
  'tts.nothingToRead': 'No hay nada que leer ahí: envíame algo de texto para decir.',
  'tts.nothingAfterClean':
    'Tras limpiar eso no quedó nada que leer: prueba con texto normal (letras o palabras).',
  'tts.tooFast': 'Uy, ve un poco más despacio: inténtalo de nuevo en un momento.',
  'tts.blocked': 'Ese texto contiene una palabra bloqueada, así que lo omití.',
  'tts.queued': '¡Listo! Está en la cola.',
  'tts.busy': 'Estoy ocupado ahora mismo: inténtalo de nuevo en un momento.',
  'voice.unknownModel': 'No conozco esa voz: revisa /voice list.',
  'voice.badSpeed':
    'La velocidad tiene que estar entre 0.5 y 2.0 (1.0 es lo normal). Prueba `/voice set model:… speed:1.0`.',
  'voice.set':
    '✅ Tu voz ahora es **{name}** a {speed}×. Prueba `/tts hola` para escucharla. (id: `{model}`)',
  'voice.config.title':
    '🎙️ **Configuración de voz** — elige las opciones de abajo y pulsa **Guardar**. Nada cambiará hasta entonces.',
  'voice.config.summary': 'Selección actual: **{voice}** · motor **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Idioma…',
  'voice.config.pickVoice': 'Voz…',
  'voice.config.pickEngine': 'Motor…',
  'voice.config.pickSpeed': 'Velocidad…',
  'voice.config.more': '▼ Más idiomas',
  'voice.config.engDefault': 'Predeterminado (local)',
  'voice.config.save': 'Guardar',
  'voice.config.cancel': 'Cancelar',
  'voice.config.cancelled': 'Configuración cancelada — no ha cambiado nada.',
  'voice.config.expired': 'El panel ha caducado — ejecuta `/voice config` de nuevo para continuar.',
  'voice.listHeader': 'Voces disponibles:',
  'voice.listEmpty': '(ninguna instalada)',
  'voice.reset':
    '✅ Tu voz volvió a la predeterminada. Elige otra cuando quieras con `/voice list` y `/voice set`.',
  'voice.optout':
    'Ya no se te leerá automáticamente. Ejecuta /voice opt-in para volver a activarlo.',
  'voice.optin': 'Se te volverá a leer automáticamente.',
  'voice.notInVoice': 'Aún no estoy en un canal de voz: ejecuta /join primero.',
  'voice.previewPlaying': 'Reproduciendo una muestra…',
  'preview.sample': 'Hola, soy Vozen. escríbelo, escúchalo.',
  'laugh.playing': '¡Jaja! Reproduciendo eso con tu voz…',
  'joke.playing': 'Contando un chiste…\n> {joke}',
  'joke.unknownLang': 'No conozco ese idioma. Elige uno de la lista.',
  'voice.abbrev.added': '¡Listo! {term} se leerá como {replacement}.',
  'voice.abbrev.removed': 'Eliminé tu abreviatura para {term}.',
  'voice.abbrev.listHeader': 'Tus abreviaturas personales ({count}/{cap} usadas):',
  'voice.abbrev.listEmpty': '(ninguna aún: añade una con /voice abbrev add)',
  'voice.abbrev.capReached':
    'Alcanzaste el límite de {cap} abreviaturas personales. Elimina una antes de añadir otra.',
  'voice.abbrev.invalidTerm':
    'El término debe ser una sola palabra (solo letras y dígitos), de hasta 50 caracteres.',
  'voice.abbrev.emptyReplacement': 'La lectura no puede estar vacía.',
  'voice.abbrev.tooLong': 'La lectura es demasiado larga (máximo 200 caracteres).',
  'config.wordEmpty': 'La palabra no puede estar vacía.',
  'config.blocked': 'Bloqueada: {word}.',
  'config.unblocked': 'Desbloqueada: {word}.',
  'config.pronListHeader': 'Diccionario de pronunciación:',
  'config.pronEmptyValue': '(vacío)',
  'config.listEmpty': '(ninguno)',
  'config.termEmpty': 'El término no puede estar vacío.',
  'config.pronEmpty': 'La pronunciación no puede estar vacía.',
  'config.pronSet': '¡Listo! {term} se leerá como {replacement}.',
  'config.pronRemoved': 'Eliminé la pronunciación para {term}.',
  'config.channelWrongType': 'Elige un canal de texto (no un canal de voz ni una categoría).',
  'config.channelNoAccess': 'No puedo ver {channel}: revisa mis permisos ahí.',
  'config.channelSet':
    'Canal de lectura automática configurado como {channel}. Siguiente: asegúrate de que la lectura automática esté activada con `/config auto-read active:true`.',
  'config.autoreadOn': 'La lectura automática ahora está **activada**.',
  'config.autoreadOff': 'La lectura automática ahora está **desactivada**.',
  'config.maxCharsRange': 'El valor de máximo de caracteres tiene que estar entre 1 y 2000.',
  'config.maxCharsSet': 'Máximo de caracteres por mensaje configurado en {value}.',
  'config.rateLimitRange': 'El valor del límite de frecuencia tiene que estar entre 1 y 120.',
  'config.rateLimitSet': 'Límite de frecuencia configurado en {value} mensajes por minuto.',
  'config.roleSet': 'La lectura automática ahora se limita a los miembros con {role}.',
  'config.roleCleared': 'Restricción por rol eliminada: ahora se puede leer a todos.',
  'config.enabledOn': 'El TTS ahora está **activado** en este servidor.',
  'config.enabledOff': 'El TTS ahora está **desactivado** en este servidor.',
  'config.defaultVoiceSet':
    '✅ Voz predeterminada del servidor configurada como **{name}**. Los miembros sin su propia voz escucharán esta. (id: `{model}`)',
  'config.reset':
    'Configuración restablecida a los valores predeterminados. Se conservaron tu lista de bloqueo y tus pronunciaciones.',
  'config.showTitle': '**Configuración del servidor**',
  'config.showChannel': 'Canal de TTS: {value}',
  'config.showAutoread': 'Lectura automática: {value}',
  'config.showRole': 'Rol: {value}',
  'config.showEnabled': 'Activado: {value}',
  'config.showVoice': 'Voz predeterminada: {value}',
  'config.showMaxChars': 'Máximo de caracteres: {value}',
  'config.showRateLimit': 'Límite de frecuencia: {value}/min',
  'config.showBlocklist': 'Lista de bloqueo: {count} palabras',
  'config.showPronunciation': 'Pronunciaciones: {count} entradas',
  'config.valueNone': '(ninguno)',
  'config.valueAny': 'cualquiera',
  'config.valueAutoDetect': '(detección automática)',
  'config.on': 'activado',
  'config.off': 'desactivado',
  'config.language.set': 'Idioma de la interfaz configurado en {language}.',
  'config.language.unsupported': 'Ese idioma aún no es compatible.',
  'setup.noChannel':
    'No pude saber qué canal usar. Indica un canal de texto en la opción "channel".',
  'setup.channelWrongType':
    'El canal de lectura automática tiene que ser un canal de texto (no un canal de voz ni una categoría). Indica uno en la opción "channel".',
  'setup.done': '**Todo listo: Vozen está preparado.**',
  'setup.channelLine': 'Canal de lectura automática: {channel}',
  'setup.autoreadOn': 'Lectura automática: activada',
  'setup.permsHeader': '**Permisos:**',
  'setup.permView': 'ViewChannel (ver el canal de texto)',
  'setup.permSend': 'SendMessages (publicar en el canal de texto)',
  'setup.permConnect': 'Connect (unirse al canal de voz)',
  'setup.permSpeak': 'Speak (hablar en el canal de voz)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — falta',
  'setup.permUnchecked': '⏳ {label} — aún sin verificar (lo comprobaré al ejecutar /join)',
  'setup.fixHint':
    'Para arreglar lo que falta: en la configuración de tu servidor abre el rol de Vozen (o los permisos del canal) y activa los elementos marcados con ❌.',
  'setup.voiceUncheckedNote':
    'No estás en un canal de voz, así que aún no pude comprobar Connect/Speak: los verificaré cuando ejecutes /join.',
  'setup.allGood': 'Todo listo. Únete a un canal de voz y ejecuta /join.',
  'setup.joinedVoice': 'También me uní a {channel}: no hace falta ejecutar /join.',
  'setup.readyTalk':
    'Todo listo. Escribe en el canal de lectura automática y lo leeré en voz alta.',
  'setup.membersHeader': '**Cuéntaselo a tus miembros (el flujo de 3 pasos):**',
  'setup.membersBody':
    '1) Únete a un canal de voz\n2) Ejecuta /join para que me una contigo\n3) Escribe en este canal (o usa /tts) y lo leeré en voz alta\nLista completa de comandos: /help',
  'stats.title': '**Estadísticas de Vozen**',
  'stats.messagesSpoken': 'Mensajes leídos: {value}',
  'stats.cacheHits': 'Aciertos de caché: {value}',
  'stats.cacheMisses': 'Fallos de caché: {value}',
  'stats.synthErrors': 'Errores de síntesis: {value}',
  'stats.voiceDrops': 'Caídas de voz: {value}',
  'stats.voiceReconnects': 'Reconexiones: {value}',
  'stats.votes': 'Votos en top.gg: {value}',
  'stats.activePlayers': 'Reproductores activos: {value}',
  'stats.servers': 'Servidores: {value}',
  'stats.uptime': 'Tiempo activo: {value}s',
  'invite.noClientId':
    'El enlace de invitación de Vozen aún no está configurado (falta CLIENT_ID). Avisa al administrador del bot.',
  'invite.link': 'Añade Vozen a tu servidor:\n{url}',
  'vote.noClientId':
    'El enlace de votación de Vozen aún no está configurado (falta CLIENT_ID). Avisa al administrador del bot.',
  'vote.link':
    'Vota por Vozen (gratis, cada 12h) y ayuda a que más gente lo descubra:\n{url}\nSi esta cuenta nunca ha reclamado la recompensa, recibe **48 h de Vozen Plus**, una sola vez por cuenta.',
  'help.title': 'Vozen — escríbelo, escúchalo.',
  'help.embedTitle': 'Vozen — Comandos',
  'help.intro':
    'Vozen lee tu texto en voz alta en los canales de voz: voces neuronales gratuitas, decenas de idiomas.',
  'help.quickStartTitle': 'Inicio rápido (3 pasos)',
  'help.quickStartBody':
    '1) Únete a un canal de voz y luego ejecuta /join\n2) Escribe en el canal de texto (o usa /tts ¡Hola a todos!)\n3) (opcional) Elige una voz con /voice set',
  'help.groupStarted': 'Primeros pasos',
  'help.groupStartedBody':
    '• /join — me uno a tu canal de voz\n• /leave — salgo del canal de voz\n• /tts <texto> — leo el texto en voz alta · p. ej. /tts ¡Hola a todos!\n• /skip — salta lo que estoy leyendo ahora mismo',
  'help.groupVoice': 'Tu voz',
  'help.groupVoiceBody':
    '• /voice set <model> — elige tu voz · p. ej. /voice set en_US-amy-medium\n• /voice list — mira las voces disponibles\n• /voice preview — escucha una muestra de tu voz\n• /voice reset — vuelve a la voz predeterminada\n• /voice opt-out · /voice opt-in — desactiva / activa la lectura automática para ti\n• /voice abbrev add|remove|list — jerga personal, leída a tu manera (hasta 10)',
  'help.groupFun': 'Diversión',
  'help.groupFunBody':
    '• /joke — cuento un chiste corto (elige un idioma + risa opcional) · p. ej. /joke English\n• /laugh — me río a carcajadas con tu voz actual',
  'help.groupAdmin': 'Administración del servidor (requiere Gestionar servidor)',
  'help.groupAdminBody':
    '• /setup — configuración guiada en un paso · ejecútalo primero\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · p. ej. /config tts-channel #general\n• /stats — estadísticas del bot',
  'help.groupMore': 'Más',
  'help.groupMoreBody':
    '• /invite — añade Vozen a otro servidor\n• /vote — vota por Vozen en top.gg\n• /help — muestra esta ayuda',
  'help.footer': '¿Eres nuevo aquí? Ejecuta {command} para empezar.',
  'welcome.title': '¡Gracias por añadir a Vozen! 👋',
  'welcome.description':
    'Vozen lee tu chat en voz alta en los canales de voz: escríbelo, escúchalo.\n\n**Empieza en un solo paso:** ejecuta {setup} y configuraré la lectura automática y me uniré a tu canal de voz.\n\n¿Necesitas la lista completa de comandos? Ejecuta {help}.',
  'welcome.enginePlans':
    'Las voces neurales Piper siguen siendo gratis. 💎 Kokoro y Google HD se desbloquean con Vozen Plus o Premium del servidor.',
  'welcome.stepsTitle': 'Cómo lo usan los miembros (3 pasos)',
  'welcome.stepsBody':
    '1) Únete a un canal de voz\n2) Ejecuta /join para que me una a ti\n3) Escribe en el canal de texto (o usa /tts) y lo leeré en voz alta\nLista completa de comandos: /help',
  'welcome.footer': 'Vozen — escríbelo, escúchalo.',
  'welcome.tagline': 'Voz neuronal natural: gratis para siempre, sin muros de pago.',
  'stt.guildOnly': 'La transcripción solo funciona dentro de un servidor.',
  'stt.noManage':
    'Necesitas el permiso **Gestionar servidor** para iniciar o detener la transcripción.',
  'stt.notPremium':
    '🎙️ La transcripción en vivo es una función **Premium**. Consulta `/premium info` para desbloquearla en este servidor.',
  'stt.unavailable':
    'La transcripción no está disponible en esta instancia (el motor de voz a texto no está instalado).',
  'stt.notInVoice':
    'No estoy en un canal de voz: únete a uno y ejecuta `/join` primero, luego inicia la transcripción.',
  'stt.alreadyRunning':
    'La transcripción ya se está ejecutando en este servidor. Usa `/transcribe stop` primero.',
  'stt.atCapacity':
    'Hay demasiadas transcripciones en marcha ahora mismo en todos los servidores. Inténtalo de nuevo en un momento.',
  'stt.noChannel':
    'No puedo publicar transcripciones en este canal. Prueba a ejecutar el comando desde un canal de texto normal.',
  'stt.started':
    '✅ Transcripción iniciada. Quien pulse **Consentir** en el anuncio será transcrito a este canal.',
  'stt.startFailed':
    'No se pudo iniciar la transcripción (falló la publicación del anuncio). Lo deshice todo: no se está grabando nada. Inténtalo de nuevo.',
  'stt.announceStart':
    '🎙️ **La transcripción en vivo está ACTIVADA en este canal.** Solo se transcribe a quienes consienten: pulsa el botón de abajo para permitir que tu voz se escriba aquí. Puedes retirarlo cuando quieras con `/transcribe revoke`.',
  'stt.consentBtn': 'Consentir ser transcrito',
  'stt.consentThanks':
    '✅ Gracias: tu voz se transcribirá a partir de ahora en este servidor. Retíralo cuando quieras con `/transcribe revoke`.',
  'stt.stopped': '🛑 Transcripción detenida.',
  'stt.notRunning': 'La transcripción no se está ejecutando en este servidor.',
  'stt.announceStop': '🛑 **La transcripción en vivo ahora está DESACTIVADA.** Dejé de escuchar.',
  'stt.revoked':
    '✅ Consentimiento retirado: ya no se te transcribirá en este servidor. (Los mensajes ya publicados permanecen; bórralos en Discord si quieres.)',
  'stt.revokeNone':
    'No habías consentido la transcripción en este servidor, así que no había nada que retirar.',
  'privacy.eraseConfirm':
    '⚠️ Esto elimina permanentemente **todos** tus datos de Vozen en todos los servidores: ajustes de voz, apodo hablado, abreviaturas y pronunciaciones personales, cumpleaños guardado, puntuaciones de juegos, estadísticas de conversación, y exclusión. **Esto no se puede deshacer.** ¿Estás seguro?',
  'privacy.erasePremiumNote':
    '_Nota: tu Premium/Plus de pago y su historial de compra se conservan: te pertenecen y forman parte de los registros financieros exigidos por ley. Para cancelar Premium, deja que caduque o contacta con soporte._',
  'privacy.eraseYes': 'Eliminar todo',
  'privacy.eraseNo': 'Cancelar',
  'privacy.eraseCancelled': 'Cancelado: no se eliminó nada.',
  'privacy.eraseDone': '✅ Listo. Todos tus datos personales se han eliminado permanentemente.',
  'shutup.notInVoice': 'Aún no estoy en un canal de voz: únete a uno y ejecuta /join primero.',
  'shutup.nothing': 'Ahora mismo no se está reproduciendo nada.',
  'shutup.done': '🤐 Vale, me callo: vacié todo lo que había en la cola.',
  'voice.detection.on':
    '✅ Detección automática de idioma ACTIVADA: cada mensaje se lee con una voz del idioma detectado (el locutor puede cambiar). Desactívala con `/voice detection active:false`.',
  'voice.detection.off':
    '✅ Detección automática de idioma DESACTIVADA: tu única voz fija lo lee todo, así que siempre suenas igual.',
  'voice.nickname.set': '✅ Vozen ahora te llamará **{name}** en voz alta.',
  'voice.nickname.cleared': '✅ Apodo hablado eliminado: Vozen usará tu nombre del servidor.',
  'voice.nickname.invalid':
    'Ese nombre no tiene nada legible para decir en voz alta. Prueba con letras o números.',
  'voice.effect.set':
    '✅ Efecto de voz configurado como **{effect}**: tus mensajes ahora se reproducen con ese efecto. Usa `/voice effect none` para desactivarlo.',
  'voice.effect.cleared': '✅ Efecto de voz eliminado: voz limpia de nuevo.',
  'voice.effect.locked':
    '🔒 **{effect}** es un efecto Premium. Efectos gratis: 🤖 Robot y 🔊 Echo. Desbloquéalos todos con Vozen Premium: consulta `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** es un motor de voz Premium. Desbloquéalo con Vozen Plus (personal) o Vozen Premium (servidor): consulta `/premium`. Mientras tanto, tu voz se queda en el motor local gratuito.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** es un motor de voz Premium. Desbloquéalo con Vozen Plus (personal) o Vozen Premium (servidor): consulta `/premium`. Mientras tanto, tu voz se queda en el motor local gratuito.',
  'rizz.playing': '😏 Soltando piropos…\n> {line}',
  'rizz.unknownLang': 'No conozco ese idioma. Elige uno de la lista.',
  'rizz.locked':
    '🔒 **/rizz** es un extra Premium. Desbloquéalo con Vozen Plus (tú) o Premium (este servidor). Consulta `/premium`.',
  'sound.playing': '🔊 Reproduciendo **{name}**…',
  'sound.unknown': 'No tengo ese sonido. Ejecuta `/sound` para ver la lista.',
  'sound.list':
    '🔊 **Sonidos:** {sounds}\nReproduce uno con `/sound name:<sound>` (tengo que estar en tu canal de voz).',
  'sound.disabled':
    '🔇 La tabla de sonidos está **desactivada** en este servidor. Un administrador puede activarla con `/config soundboard`.',
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Cumpleaños guardado: **{day}/{month}**. ¡Te felicitaré cuando entres en un canal de voz ese día!',
  'birthday.invalid': 'Esa fecha no existe. Revisa el día y el mes.',
  'birthday.cleared': '🎂 Cumpleaños eliminado.',
  'birthday.show': '🎂 Tu cumpleaños está configurado en **{day}/{month}**.',
  'birthday.none': 'Aún no has configurado un cumpleaños. Usa `/birthday set`.',
  'topspeakers.title': '🗣️ **Los más habladores** — a quién leo más en este servidor:',
  'topspeakers.empty':
    'Aún no he leído los mensajes de nadie. ¡Configura un canal de lectura con `/setup`!',
  'topspeakers.line': '{rank}. <@{user}> — **{count}** mensajes · 🔥 racha de {streak} días',
  'serverstats.title': '📊 **Estadísticas del servidor**',
  'serverstats.empty':
    'Aún sin estadísticas: no he leído mensajes ni ejecutado juegos aquí. ¡Configúralo con `/setup`!',
  'serverstats.messages': '🗣️ **{total}** mensajes leídos · **{speakers}** personas',
  'serverstats.topTalkers': '**Los más habladores:**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} msgs · 🔥 {streak}d',
  'serverstats.streak': '🔥 Racha activa más larga: **{days}** días',
  'serverstats.games':
    '🎮 **{points}** puntos de juego · **{wins}** victorias · **{players}** jugadores',
  'serverstats.topPlayers': '**Mejores jugadores:**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pts · {wins} victorias',
  'serverstats.upsell':
    '🔒 Esa es la vista previa gratuita. **Premium** desbloquea las rachas, las estadísticas de juegos y el top 5 completo: consulta `/premium`.',
  'streak.day': '🔥 ¡<@{user}> lleva una racha de **{n} días**! Sigue hablando para mantenerla.',
  'leaderboard.autoTitle': '🏆 Los que más hablan en este servidor',
  'premium.title': '💎 **Estado de Vozen Premium**',
  'premium.lineServerActive': '🖥️ **Servidor:** Premium hasta {date}',
  'premium.lineServerFree': '🖥️ **Servidor:** plan gratuito',
  'premium.lineUserActive': '👤 **Tú (Plus):** activo hasta {date}',
  'premium.lineUserFree': '👤 **Tú (Plus):** inactivo',
  'premium.getHint':
    'Todo lo que usas hoy sigue siendo gratis. Premium añade los 8 efectos de voz, 24/7 en la llamada, 50 pronunciaciones personales, /rizz y los juegos premium. Apoyo: https://ko-fi.com/',
  'premium.enginePerks':
    '💎 **Motores de voz Premium:** Kokoro neural y Google HD — se desbloquean para ti con Plus o para todos con Premium del servidor.',
  'premium.linePass': '🎟️ **Tu pase Premium:** {used}/{total} licencias en uso · caduca {date}',
  'premium.passServers': '↳ En uso en: {servers}',
  'premium.pitch':
    'Aún no tienes Premium. **Vozen Premium** (€3.99/mes para 3 servidores, o €7.99/mes para 8) desbloquea para todo el servidor: los 8 efectos de voz, 24/7 en la llamada, 50 pronunciaciones personales (frente a 3), el comando /rizz y los juegos premium (Cadena de Palabras, Wordle, Ajedrez). **Vozen Plus** (€1.99/mes) te da esos extras personalmente, en cualquier servidor.',
  'premium.buyHint':
    '▶ **Consigue Premium:** {link}\nDespués de comprar, ejecuta `/premium activate` en el servidor que quieras.',
  'premium.confirmActivate':
    '¿Usar **1 de tus {total} licencias Premium** en **este servidor**? Ahora mismo tienes **{used}** en uso. Puedes liberarla más tarde con `/premium deactivate`: el reloj del pase sigue corriendo de todos modos.',
  'premium.confirmYes': '💎 Usar una licencia',
  'premium.confirmNo': 'Cancelar',
  'premium.activateOk':
    '✅ Premium ya está activo en **este servidor** hasta {date}. Licencias: **{used}/{total}** en uso.',
  'premium.activateCancelled': 'Cancelado: no se usó ninguna licencia.',
  'premium.activateTimeout': 'Tiempo agotado: no se usó ninguna licencia.',
  'premium.noPass':
    'No tienes un pase Premium activo. Consigue uno y llegará a tu cuenta; luego ejecuta `/premium activate` aquí.\n▶ {link}',
  'premium.alreadyActive':
    'Este servidor ya tiene una de tus licencias Premium. No hay nada que hacer.',
  'premium.noSeats':
    'Todas tus **{total}** licencias Premium están en uso ({servers}). Libera una con `/premium deactivate` allí y luego vuelve a intentarlo aquí.',
  'premium.needManageGuild':
    'Activar Premium afecta a todo el servidor: solo los miembros con **Gestionar servidor** pueden hacerlo. Pídeselo a un administrador.',
  'premium.deactivateOk':
    '✅ Liberé la licencia Premium de este servidor. Úsala en otro servidor con `/premium activate`.',
  'premium.deactivateNone': 'Este servidor no tiene ninguna licencia Premium tuya que liberar.',
  'premium.thisServer': 'este servidor',
  'grant.denied': '⛔ Este comando es solo para el propietario del bot.',
  'grant.okPremium':
    '✅ Concedido a <@{user}> un **pase Premium** ({seats} licencias) durante **{days}** días — caduca {date}. Lo activa con `/premium activate`.',
  'grant.okPlus':
    '✅ Concedido a <@{user}> **Vozen Plus** durante **{days}** días — caduca {date}.',
  'gencode.done':
    '✅ Generado(s) **{count}** código(s) {plan}, **{days}** días cada uno. Compártelos en privado:\n{list}',
  'redeem.okPlus':
    '🎁 ¡Canjeado! Conseguiste **Vozen Plus** durante **{days}** días — caduca {date}.',
  'redeem.okPremium':
    '🎁 ¡Canjeado! Conseguiste un **pase Premium** ({seats} licencias) durante **{days}** días — caduca {date}. Actívalo en tu servidor con `/premium activate`.',
  'redeem.notFound': '❌ Ese código no existe. Compruébalo y vuelve a intentarlo.',
  'redeem.used': '❌ Ese código ya fue canjeado.',
  'redeem.expired': '❌ Ese código ha caducado.',
  'config.blockLimit':
    'Este servidor ya tiene el máximo de {max} palabras bloqueadas. Elimina una antes de añadir otra.',
  'config.xsaidOn':
    'Vozen ahora anunciará **quién habló** antes de cada mensaje (p. ej. "Alex dijo hola"). Desactívalo con `/config x-said active:false`.',
  'config.xsaidOff': 'Vozen **ya no** anunciará quién habló: lee solo el mensaje.',
  'config.autojoinOn':
    '✅ Autounión **activada**: Vozen entrará en tu canal de voz cuando escribas en el canal de TTS.',
  'config.autojoinOff': 'Autounión **desactivada**: usa `/join` para traer a Vozen a la voz.',
  'config.stayOn':
    '✅ 24/7 en la llamada **activado**: Vozen se quedará en el canal de voz aunque se vacíe, y volverá tras los reinicios. 💎 Necesita Premium para surtir efecto (compra o usa `/redeem` con un código, luego `/premium activate`).',
  'config.stayOff':
    '24/7 en la llamada **desactivado**: Vozen se va cuando el canal de voz se vacía (predeterminado).',
  'config.readBotsOn': '✅ Vozen ahora también leerá los mensajes de **otros bots y webhooks**.',
  'config.readBotsOff':
    'Vozen **ignorará** a otros bots y webhooks (solo se lee a personas reales).',
  'config.textInVoiceOn': '✅ Vozen también leerá el **chat de texto dentro de su canal de voz**.',
  'config.textInVoiceOff':
    'Vozen **no** leerá el chat de texto del canal de voz (solo el canal de TTS).',
  'config.antispamOn':
    '✅ Antispam **activado**: Vozen no leerá los mensajes de spam (repetición masiva de palabras o el mismo mensaje largo publicado una y otra vez).',
  'config.antispamOff': 'Antispam **desactivado**: Vozen lee todos los mensajes como siempre.',
  'config.streaksOn':
    '✅ Avisos de racha **activados**: Vozen muestra un mensaje de racha 🔥 la primera vez que cada persona habla cada día.',
  'config.streaksOff':
    'Avisos de racha **desactivados**: Vozen sigue contando las rachas (ve `/top-speakers`) pero no las anuncia.',
  'config.soundboardOn':
    'Tabla de sonidos **activada**: cualquiera puede reproducir clips con `/sound`.',
  'config.soundboardOff':
    'Tabla de sonidos **desactivada**: `/sound` está deshabilitado en este servidor.',
  'config.votePromosLabel': 'Avisos de recompensa de top.gg + Vozen Support',
  'config.greetOn': '✅ Saludaré a la gente por su nombre cuando entre en el canal de voz.',
  'config.greetOff': '🔇 **No** saludaré a la gente cuando entre en el canal de voz.',
  'config.greetLangSet': '✅ Idioma del saludo de entrada configurado en **{language}**.',
  'config.showXsaid': 'Anunciar hablante (xsaid): {value}',
  'config.showAutojoin': 'Autounión: {value}',
  'config.showReadBots': 'Leer bots/webhooks: {value}',
  'config.showTextInVoice': 'Texto en voz: {value}',
  'config.showAntispam': 'Antispam: {value}',
  'config.showSoundboard': 'Tabla de sonidos (/sound): {value}',
  'config.showGreet': 'Saludar al entrar: {value} ({language})',
  'stats.synthLatency': 'Latencia de síntesis: p50 {p50}ms / p95 {p95}ms ({count} muestras)',
  'speak.emptyMessage': 'Ese mensaje no tiene texto para leer en voz alta.',
  'uptime.text': '🟢 Vozen lleva en línea **{uptime}**.',
  'botstats.title': '📊 **Vozen — estadísticas**',
  'botstats.servers': 'Servidores: **{value}**',
  'botstats.voiceSessions': 'Sesiones de voz ahora: **{value}**',
  'botstats.messagesSpoken': 'Mensajes leídos: **{value}**',
  'botstats.uptime': 'En línea desde hace: **{value}**',
  'invite.button': 'Añadir Vozen',
  'vote.button': 'Votar en top.gg',
  'vote.upsell':
    '🗳️ Si esta cuenta nunca ha reclamado la recompensa, recibe **48 h de Vozen Plus**, una sola vez por cuenta. {url}',
  'vote.cooldownStatus':
    '🗳️ Esta cuenta ya utilizó su recompensa de voto única. Puedes seguir votando para apoyar a Vozen, pero no recibirás más Plus.',
  'help.support': '🛟 ¿Necesitas ayuda o quieres informar de un problema? {url}',
  'help.source':
    '📄 Código abierto (AGPL-3.0): consigue el código exacto que se ejecuta aquí: {url}',
  'game.start.needVoice':
    'Esto es un **juego de voz**: únete a un canal de voz y ejecuta /join primero, luego inícialo.',
  'game.start.alreadyActive':
    'Ya hay un juego en marcha en <#{channel}>. Termínalo (o usa `/game stop`) antes de empezar otro.',
  'game.start.premiumLocked':
    '🔒 **{game}** es un juego Premium (consume cómputo real). Consulta `/premium`.',
  'game.start.started': '🎮 ¡Empezando **{game}**! Atento al canal: ¡buena suerte!',
  'game.start.startedThread':
    '🎮 **{game}** empezó en <#{channel}>: ¡únete allí! El hilo se autoelimina cuando termina el juego.',
  'game.thread.winner': '🏆 ¡{winner} ganó el juego!',
  'game.thread.ended': '🎮 El juego terminó.',
  'game.unknownGame': 'No conozco ese juego. Elige uno de la lista.',
  'game.stop.ok': '🛑 Detuve el juego actual.',
  'game.stop.none': 'Ahora mismo no hay ningún juego en marcha.',
  'game.list.title': '🎮 **Juegos** — empieza uno con `/game play`:',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Clasificación** — mejores jugadores de este servidor:',
  'game.leaderboard.empty': 'Aún no se ha jugado a nada. Sé el primero: ¡`/game play`!',
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pts ({wins} victorias)',
  'game.finish.title': '🏁 **¡Fin del juego!** Puntuaciones finales:',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': '🏁 Fin del juego: nadie puntuó esta vez. ¡La próxima!',
  'game.finish.winnerVoice': '¡{user} gana!',
  'game.guessLanguage.name': 'Adivina el Idioma',
  'game.guessLanguage.desc':
    'Leo una frase en un idioma al azar: el primero en nombrarlo gana el punto.',
  'game.guessLanguage.intro':
    '🗣️ **Adivina el Idioma** — leeré {rounds} frases. Escribe qué idioma oyes. ¡La respuesta correcta más rápida gana cada ronda!',
  'game.guessLanguage.round': '🎧 Ronda {n}/{total} — escucha…',
  'game.guessLanguage.correct': '✅ **{user}** acertó: ¡era **{language}**!',
  'game.guessLanguage.timeout': '⏱️ ¡Tiempo! Era **{language}**.',
  'game.guessLanguage.noLanguages':
    'No tengo suficientes voces instaladas para jugar a esto. Pide a un administrador que añada más voces.',
  'game.math.name': 'Cálculo Mental',
  'game.math.desc': 'Digo una operación en voz alta: el primero en escribir la respuesta gana.',
  'game.math.intro':
    '🔢 **Cálculo Mental** — {rounds} operaciones. ¡Escucha y escribe la respuesta lo más rápido que puedas!',
  'game.math.round': '🧮 Ronda {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** lo clavó: ¡la respuesta era **{answer}**!',
  'game.math.timeout': '⏱️ ¡Tiempo! La respuesta era **{answer}**.',
  'game.math.plus': 'más',
  'game.math.minus': 'menos',
  'game.math.times': 'por',
  'game.skipCount.name': 'El Número Que Falta',
  'game.skipCount.desc': 'Cuento en voz alta pero me salto un número: el primero en pillarlo gana.',
  'game.skipCount.intro':
    '🔢 **El Número Que Falta** — cuento, pero me salto uno. ¡Escribe el número que falta! ({rounds} rondas)',
  'game.skipCount.round': '👂 Ronda {n}/{total} — ¿qué número me salté?',
  'game.skipCount.correct': '✅ **{user}** lo pilló: ¡me salté el **{answer}**!',
  'game.skipCount.timeout': '⏱️ ¡Tiempo! Me salté el **{answer}**.',
  'game.spelling.name': 'Concurso de Ortografía',
  'game.spelling.desc': 'Digo una palabra: el primero en escribirla correctamente gana.',
  'game.spelling.intro':
    '✍️ **Concurso de Ortografía** — diré {rounds} palabras. ¡Escribe cada una correctamente!',
  'game.spelling.round': '🗣️ Ronda {n}/{total} — escribe la palabra que digo…',
  'game.spelling.correct': '✅ ¡**{user}** escribió **{word}** correctamente!',
  'game.spelling.timeout': '⏱️ ¡Tiempo! La palabra era **{word}**.',
  'game.spelling.empty':
    'Aún no tengo una lista de palabras para el idioma de voz de este servidor.',
  'game.spellOut.name': 'Descifra el Deletreo',
  'game.spellOut.desc':
    'Deletreo una palabra letra a letra: el primero en escribir la palabra entera gana.',
  'game.spellOut.intro':
    '🔡 **Descifra el Deletreo** — deletreo {rounds} palabras letra a letra. ¡Escribe la palabra completa!',
  'game.spellOut.round': '🔤 Ronda {n}/{total} — escucha las letras…',
  'game.spellOut.correct': '✅ **{user}** acertó — ¡**{word}**!',
  'game.spellOut.timeout': '⏱️ ¡Tiempo! Deletreaba **{word}**.',
  'game.fastSpeech.name': 'Habla Rápida',
  'game.fastSpeech.desc': 'Leo una frase superrápido: el primero en escribir lo que dije gana.',
  'game.fastSpeech.intro':
    '💨 **Habla Rápida** — {rounds} frases a una velocidad absurda. ¡Escribe lo que oigas!',
  'game.fastSpeech.round': '⚡ Ronda {n}/{total} — ¡ahí va, rápido!',
  'game.fastSpeech.correct': '✅ **{user}** lo descifró: “{phrase}”',
  'game.fastSpeech.timeout': '⏱️ ¡Tiempo! Era: “{phrase}”',
  'game.fastSpeech.empty': 'Aún no tengo frases para el idioma de voz de este servidor.',
  'game.accentSwap.name': 'Acento Gracioso',
  'game.accentSwap.desc': 'Digo una palabra con acento extranjero: el primero en escribirla gana.',
  'game.accentSwap.intro':
    '🎭 **Acento Gracioso** — {rounds} palabras dichas con el acento equivocado. ¡Escribe la palabra!',
  'game.accentSwap.round': '🌍 Ronda {n}/{total} — ¿qué palabra intento decir?',
  'game.accentSwap.correct': '✅ **{user}** acertó — ¡**{word}**!',
  'game.accentSwap.timeout': '⏱️ ¡Tiempo! La palabra era **{word}**.',
  'game.reflexes.name': 'Reflejos',
  'game.reflexes.desc':
    'Hago la cuenta atrás y luego grito YA: el primero en escribir después gana. ¡No te adelantes!',
  'game.reflexes.intro':
    '⚡ **Reflejos** — {rounds} rondas. Cuando grite **YA**, escribe lo que sea lo más rápido posible. ¡Escribir antes del YA es salida en falso!',
  'game.reflexes.ready': '🚦 Ronda {n}/{total} — prepárate…',
  'game.reflexes.countdown': 'tres… dos… uno…',
  'game.reflexes.go': '🟢 **¡¡¡YA!!!**',
  'game.reflexes.goVoice': '¡Ya!',
  'game.reflexes.tooSoon': '🔴 **{user}** se adelantó: ¡demasiado pronto!',
  'game.reflexes.win': '⚡ ¡**{user}** es el más rápido! ¡Punto!',
  'game.reflexes.tooSlow': '😴 Nadie reaccionó a tiempo. ¡Siguiente!',
  'game.headsOrTails.name': 'Cara o Cruz',
  'game.headsOrTails.desc':
    'Adivina la moneda: escribe cara o cruz antes de que la lance. ¡Quien más acierte gana!',
  'game.headsOrTails.intro':
    '🪙 **Cara o Cruz** — {rounds} rondas. En cada ronda, escribe `cara` o `cruz` antes de que lance la moneda. ¡1 punto por cada acierto!',
  'game.headsOrTails.introVoice': '¡Vamos a jugar a cara o cruz!',
  'game.headsOrTails.round': '🪙 Ronda {n}/{total} — ¿cara o cruz? ¡Escribe tu apuesta!',
  'game.headsOrTails.roundVoice': '¿Cara… o cruz?',
  'game.headsOrTails.heads': 'cara',
  'game.headsOrTails.tails': 'cruz',
  'game.headsOrTails.resultVoice': '¡Salió {side}!',
  'game.headsOrTails.winners': '¡Salió **{side}**! Punto para: {users}',
  'game.headsOrTails.noWinners': '¡Salió **{side}**! Nadie lo acertó: sin puntos.',
  'game.vozenSays.name': 'Vozen Dice',
  'game.vozenSays.desc':
    "Solo obedeces cuando la orden empieza por 'Vozen dice'. ¡Cae en una trampa y estás pillado!",
  'game.vozenSays.intro':
    "🫡 **Vozen Dice** — {rounds} órdenes. Hazlo SOLO si empiezo por **'Vozen dice'**. ¡Si no, no te muevas!",
  'game.vozenSays.prefix': 'Vozen dice',
  'game.vozenSays.verb': 'escribe',
  'game.vozenSays.real': '🗣️ Ronda {n}/{total} — «{command}»',
  'game.vozenSays.trap': '🗣️ Ronda {n}/{total} — «{command}»',
  'game.vozenSays.obeyed': '✅ **{user}** obedeció primero: ¡punto!',
  'game.vozenSays.caught': '🔴 **{user}** — ¡yo no dije Vozen dice! ¡Pillado!',
  'game.vozenSays.nobody': '😴 Nadie obedeció **{word}** a tiempo. ¡Siguiente!',
  'game.vozenSays.trapCleared': '😌 Era una trampa: bien visto, nadie cayó en **{word}**.',
  'game.roulette.name': 'Ruleta de Verdad o Reto',
  'game.roulette.desc':
    'Giro la ruleta y leo en voz alta una propuesta de verdad o reto. Ejecútalo de nuevo para otra.',
  'game.roulette.header': '🎯 **La ruleta dice…**',
  'game.hangman.name': 'Ahorcado',
  'game.hangman.desc': 'Adivina la palabra letra a letra: 6 fallos y se acabó.',
  'game.hangman.intro':
    '🪢 **Ahorcado** — escribe una letra cada vez para adivinar la palabra. ¡También puedes escribir la palabra entera!',
  'game.hangman.hit': '🟢 ¡**{user}** encontró la **{letter}**!',
  'game.hangman.miss': '🔴 **{user}** — no hay **{letter}**.',
  'game.hangman.wrongLetters': 'Falladas: {letters}',
  'game.hangman.win': '🎉 **{user}** lo resolvió — ¡**{word}**!',
  'game.hangman.lose': '💀 ¡Sin intentos! La palabra era **{word}**.',
  'game.hangman.idle': '🕹️ Juego pausado (nadie juega). La palabra era **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Adivina la palabra de 5 letras. 🟩 posición correcta, 🟨 posición incorrecta, ⬛ no está en la palabra. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — escribe una palabra de 5 letras. Compartís {max} intentos. 🟩 posición correcta · 🟨 posición incorrecta · ⬛ no está en la palabra.',
  'game.wordle.guess': '🔤 **{user}** intentó — quedan **{left}** intentos',
  'game.wordle.inWord': '🟢 en la palabra: {letters}',
  'game.wordle.out': '🚫 fuera: ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** lo acertó en {n} — ¡**{word}**!',
  'game.wordle.lose': '💀 ¡Sin intentos! La palabra era **{word}**.',
  'game.wordle.idle': '🕹️ Juego pausado (nadie juega). La palabra era **{word}**.',
  'game.tictactoe.name': 'Tres en Raya',
  'game.tictactoe.desc':
    'Dos jugadores: escribe un número del 1 al 9 para colocar tu marca. Tres en raya gana.',
  'game.tictactoe.intro':
    '⭕ **Tres en Raya** — los dos primeros jugadores en mover son ❌ y ⭕ (❌ empieza). Escribe un número del 1 al 9 para jugar tu casilla.',
  'game.tictactoe.turn': 'Turno: **{mark}**',
  'game.tictactoe.notYourTurn': '⏳ **{user}**, es el turno de **{mark}**.',
  'game.tictactoe.taken': '🚫 La casilla {cell} está ocupada: elige otra.',
  'game.tictactoe.win': '🎉 ¡**{user}** ({mark}) gana!',
  'game.tictactoe.draw': '🤝 ¡Empate!',
  'game.tictactoe.idle': '🕹️ Juego terminado (nadie juega).',
  'game.chess.name': 'Ajedrez',
  'game.chess.desc':
    'Dos jugadores: reglas reales de ajedrez (jaque, enroque, promoción…). Escribe una jugada como "e4" o "Nf3". 💎 Premium.',
  'game.chess.intro':
    '♟️ **Ajedrez** — los dos primeros jugadores en mover son las blancas y las negras (empiezan las blancas). Escribe una jugada en notación algebraica ("e4", "Nf3", "O-O") o por coordenadas ("e2e4"). Escribe "resign" para rendirte.',
  'game.chess.white': 'blancas',
  'game.chess.black': 'negras',
  'game.chess.seats': '⚪ Blancas: **{white}** · ⚫ Negras: **{black}**',
  'game.chess.turn': '{move} — turno: **{color}**',
  'game.chess.check': '♟️ ¡Jaque!',
  'game.chess.notYourTurn': '⏳ **{user}**, es el turno de las **{color}**.',
  'game.chess.illegalMove': '🚫 "{move}" no es una jugada legal: inténtalo de nuevo.',
  'game.chess.checkmate': '🏆 ¡Jaque mate ({move})! ¡**{user}** gana!',
  'game.chess.draw': '🤝 ¡Empate ({move})!',
  'game.chess.resigned': '🏳️ **{user}** se rindió — ¡**{winner}** gana!',
  'game.chess.idle': '🕹️ Juego terminado (nadie juega).',
  'game.wordChain.name': 'Cadena de Palabras',
  'game.wordChain.descr':
    'Cadena de palabras por turnos en un idioma: di una palabra que empiece por la última letra de la anterior. 2 vidas, sin repetir, y el reloj acelera. Elige el idioma en la opción `language`. 💎 Premium.',
  'game.wordChain.unavailable':
    '⚠️ La Cadena de Palabras no está disponible en **{lang}** ahora mismo (falta la lista de palabras).',
  'game.wordChain.lobby':
    '🔗 **Cadena de Palabras** en **{lang}**! Escribe cualquier cosa en este canal en **{seconds}s** para unirte.',
  'game.wordChain.notEnough':
    '😴 No se unieron suficientes jugadores (se necesitan al menos 2). Juego cancelado.',
  'game.wordChain.begin':
    '🚀 ¡Empezando! Jugadores: {players}. Cada palabra debe empezar por la última letra de la anterior.',
  'game.wordChain.turn':
    '**{name}**, ¡tu turno! Una palabra en **{lang}** que empiece por **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — siguiente letra: **{letter}**',
  'game.wordChain.bad.letter': '↪️ Debe empezar por **{letter}**.',
  'game.wordChain.bad.short': '📏 Demasiado corta: al menos **{min}** letras.',
  'game.wordChain.bad.repeated': '🔁 Esa palabra ya se usó.',
  'game.wordChain.bad.word': '📖 No está en el diccionario.',
  'game.wordChain.bad.latin': '🔤 Solo cuentan las letras de la A a la Z.',
  'game.wordChain.timeout': '⏰ ¡**{name}** se quedó sin tiempo! Le quedan {hearts}.',
  'game.wordChain.eliminated': '💀 ¡**{name}** está fuera!',
  'game.wordChain.winner': '🏆 ¡**{name}** gana la cadena! ({chain} palabras)',
  'game.stats.none': 'Aún no has jugado a ningún juego. ¡Prueba `/game play`!',
  'game.stats.body':
    '🎮 **Tus estadísticas** — **{points}** puntos · **{wins}** victorias · {rank}',
  'game.stats.rank': 'posición **#{rank}** de {total}',
  'game.stats.unranked': 'aún sin posición',
  'game.pickPrompt': '🎮 ¿A qué juego quieres jugar? Elige uno:',
  'game.pickPlaceholder': 'Elige un juego…',
  'game.pickTimeout': '⏰ Ningún juego elegido: ejecuta `/game play` de nuevo cuando quieras.',
  'pron.listHeader': '🗣️ **Tus pronunciaciones** ({count}/{limit}):',
  'pron.listEmpty': 'Aún no tienes ninguna: añade una con `/pronunciation add`.',
  'pron.set': '✅ ¡Guardado! Cuando **tú** escribas “{term}”, diré “{replacement}”.',
  'pron.removed': '🗑️ “{term}” eliminado.',
  'pron.notFound':
    'No tienes ninguna pronunciación para “{term}”. Consulta las tuyas con `/pronunciation list`.',
  'pron.empty': 'La palabra y cómo decirla no pueden estar vacías.',
  'pron.limitHit':
    '🔒 Alcanzaste tu límite de **{limit}** pronunciaciones. Elimina una con `/pronunciation remove`.',
  'pron.limitUpsell': '💎 Vozen Plus o Premium lo sube a **50** → {url}',
  'pron.modalTitle': 'Enséñale una pronunciación a Vozen',
  'pron.modalTerm': 'La palabra (tal como la escribe la gente)',
  'pron.modalSay': 'Cómo debe decirla Vozen',
  'spron.listHeader': '🗣️ **Pronunciaciones del servidor** ({count}/{limit}) — se aplican a todos:',
  'spron.listEmpty': 'Aún ninguna: añade una con `/server-pronunciation add`.',
  'spron.set': '✅ ¡Guardado para todo el servidor! “{term}” → “{replacement}”.',
  'spron.removed': '🗑️ “{term}” eliminado del servidor.',
  'spron.notFound': 'El servidor no tiene ninguna pronunciación para “{term}”.',
  'spron.limitHit':
    '🔒 El servidor alcanzó su límite de **{limit}** pronunciaciones. Elimina una con `/server-pronunciation remove`.',
  'spron.modalTitle': 'Pronunciación del servidor',
  'spron.modalSay': 'Cómo la dice Vozen para todos',
  'rand.selectPrompt': '🎲 **Randomizer** — ¿entre cuántas opciones quieres que elija?',
  'rand.selectPlaceholder': 'Número de opciones…',
  'rand.selectOption': '{n} opciones',
  'rand.filling': '📝 ¡Rellena el formulario que acaba de abrirse!',
  'rand.modalTitle': 'Randomizer — {amount} opciones',
  'rand.modalOption': 'Opción {n}',
  'rand.needTwo': 'Dame al menos 2 opciones separadas por comas (p. ej. "pizza, sushi").',
  'rand.result': 'De {count} opciones, elijo… ¡**{winner}**!',
  'rand.speak': 'Elijo… ¡{winner}!',
  'rand.notInVoice': '_(únete a un canal de voz conmigo y la próxima vez lo diré en voz alta)_',
  'rand.timeout': '⏰ Nada elegido: ejecuta `/randomizer` de nuevo cuando quieras.',
};
