export default {
  'error.generic': "Une erreur s'est produite. Veuillez réessayer.",
  'stt.guildOnly': "La transcription ne fonctionne qu'à l'intérieur d'un serveur.",
  'stt.noManage':
    'Vous avez besoin de la permission **Gérer le serveur** pour démarrer ou arrêter la transcription.',
  'stt.notPremium':
    '🎙️ La transcription en direct est une fonctionnalité **Premium**. Voir `/premium info` pour la débloquer sur ce serveur.',
  'stt.unavailable':
    "La transcription n'est pas disponible sur cette instance (le moteur de reconnaissance vocale n'est pas installé).",
  'stt.notInVoice':
    "Je ne suis pas dans un salon vocal — rejoignez-en un et lancez d'abord `/join`, puis démarrez la transcription.",
  'stt.alreadyRunning':
    "La transcription tourne déjà sur ce serveur. Utilisez d'abord `/transcribe stop`.",
  'stt.atCapacity':
    "Trop de transcriptions sont en cours en ce moment sur l'ensemble des serveurs. Veuillez réessayer dans un instant.",
  'stt.noChannel':
    'Je ne peux pas publier de transcriptions dans ce salon. Essayez de lancer la commande depuis un salon textuel normal.',
  'stt.started':
    "✅ Transcription démarrée. Toute personne qui appuie sur **Consentir** dans l'annonce sera transcrite dans ce salon.",
  'stt.startFailed':
    "Je n'ai pas pu démarrer la transcription (la publication de l'annonce a échoué). J'ai tout annulé — rien n'est enregistré. Veuillez réessayer.",
  'stt.announceStart':
    "🎙️ **La transcription en direct est ACTIVÉE dans ce salon.** Seules les personnes qui consentent sont transcrites — appuyez sur le bouton ci-dessous pour autoriser l'écriture de votre parole ici. Vous pouvez vous rétracter à tout moment avec `/transcribe revoke`.",
  'stt.consentBtn': 'Consentir à être transcrit',
  'stt.consentThanks':
    '✅ Merci — votre parole sera désormais transcrite sur ce serveur. Rétractez-vous à tout moment avec `/transcribe revoke`.',
  'stt.stopped': '🛑 Transcription arrêtée.',
  'stt.notRunning': 'La transcription ne tourne pas sur ce serveur.',
  'stt.announceStop':
    "🛑 **La transcription en direct est maintenant DÉSACTIVÉE.** J'ai arrêté d'écouter.",
  'stt.revoked':
    '✅ Consentement retiré — vous ne serez plus transcrit sur ce serveur. (Les messages déjà publiés restent ; supprimez-les dans Discord si vous le souhaitez.)',
  'stt.revokeNone':
    "Vous n'aviez pas consenti à la transcription sur ce serveur, il n'y avait donc rien à retirer.",
  'privacy.eraseConfirm':
    "⚠️ Cela supprime définitivement **toutes** vos données Vozen sur l'ensemble des serveurs : réglages de voix, surnom prononcé, abréviations et prononciations personnelles, anniversaire enregistré, scores de jeux, statistiques de parole, et désinscription. **Ceci est irréversible.** Êtes-vous sûr ?",
  'privacy.erasePremiumNote':
    "_Note : votre Premium/Plus payant et son historique d'achat sont conservés — ils vous appartiennent et relèvent des registres financiers exigés par la loi. Pour arrêter Premium, laissez-le expirer ou contactez le support._",
  'privacy.eraseYes': 'Tout supprimer',
  'privacy.eraseNo': 'Annuler',
  'privacy.eraseCancelled': "Annulé — rien n'a été supprimé.",
  'privacy.eraseDone':
    '✅ Terminé. Toutes vos données personnelles ont été définitivement supprimées.',
  'error.needManageGuild':
    'Vous avez besoin de la permission **Gérer le serveur** pour faire cela.',
  'join.needVoiceChannel': "Rejoignez d'abord un salon vocal, puis lancez /join.",
  'join.missingPerms': "J'ai besoin des permissions **Se connecter** et **Parler** dans {channel}.",
  'join.joined':
    '✅ Je suis dans {channel} ! Étape suivante : dites `/tts bonjour` et je le lirai à voix haute. Vous voulez que je lise automatiquement un salon ? Lancez /setup.',
  'join.joinedAutoread':
    '✅ Je suis dans {channel} ! Tout est prêt. Écrivez dans le salon de lecture automatique et je le lirai à voix haute. → {readChannel}',
  'leave.left': "J'ai quitté le salon vocal. À bientôt !",
  'skip.notInVoice':
    "Je ne suis pas encore dans un salon vocal — rejoignez-en un et lancez d'abord /join, puis réessayez.",
  'skip.skipped': 'Passé.',
  'skip.nothing': "Rien n'est en cours de lecture pour l'instant.",
  'shutup.notInVoice':
    "Je ne suis pas encore dans un salon vocal — rejoignez-en un et lancez d'abord /join.",
  'shutup.nothing': "Rien n'est en cours de lecture pour l'instant.",
  'shutup.done': "🤐 D'accord, j'arrête — j'ai vidé toute la file d'attente.",
  'tts.notInVoice':
    'Je ne suis pas encore dans un salon vocal — rejoignez-en un et lancez /join, puis réessayez.',
  'tts.nothingToRead': "Il n'y a rien à lire ici — envoyez-moi du texte à dire.",
  'tts.nothingAfterClean':
    'Après nettoyage, il ne restait rien à lire — essayez du texte normal (des lettres ou des mots).',
  'tts.tooFast': 'Doucement, ralentissez un peu — réessayez dans un instant.',
  'tts.blocked': "Ce texte contient un mot bloqué, je l'ai donc ignoré.",
  'tts.queued': "C'est noté — c'est dans la file d'attente.",
  'tts.busy': 'Je suis occupé pour le moment — réessayez dans un instant.',
  'voice.unknownModel': 'Je ne connais pas cette voix — consultez /voice list.',
  'voice.badSpeed':
    'La vitesse doit être comprise entre 0.5 et 2.0 (1.0 est la valeur normale). Essayez `/voice set model:… speed:1.0`.',
  'voice.set':
    "✅ Votre voix est maintenant **{name}** à {speed}×. Essayez `/tts bonjour` pour l'entendre. (id : `{model}`)",
  'voice.config.title':
    '🎙️ **Configuration de la voix** — choisissez les options ci-dessous, puis appuyez sur **Enregistrer**. Rien ne change avant cela.',
  'voice.config.summary': 'Sélection actuelle : **{voice}** · moteur **{engine}** · {speed}×',
  'voice.config.pickLanguage': 'Langue…',
  'voice.config.pickVoice': 'Voix…',
  'voice.config.pickEngine': 'Moteur…',
  'voice.config.pickSpeed': 'Vitesse…',
  'voice.config.more': '▼ Plus de langues',
  'voice.config.engDefault': 'Par défaut (local)',
  'voice.config.save': 'Enregistrer',
  'voice.config.cancel': 'Annuler',
  'voice.config.cancelled': "Configuration annulée — rien n'a changé.",
  'voice.config.expired': 'Le panneau a expiré — relancez `/voice config` pour continuer.',
  'voice.listHeader': 'Voix disponibles :',
  'voice.listEmpty': '(aucune installée)',
  'voice.reset':
    '✅ Votre voix est revenue à celle par défaut. Choisissez-en une autre à tout moment avec `/voice list` et `/voice set`.',
  'voice.detection.on':
    '✅ La détection automatique de la langue est ACTIVÉE : chaque message est lu avec une voix correspondant à sa langue détectée (le locuteur peut changer). Désactivez-la avec `/voice detection active:false`.',
  'voice.detection.off':
    '✅ La détection automatique de la langue est DÉSACTIVÉE : votre voix fixe unique lit tout, pour que vous sonniez toujours pareil.',
  'voice.optout':
    'Vous ne serez plus lu automatiquement. Lancez /voice opt-in pour réactiver la fonction.',
  'voice.optin': 'Vous serez à nouveau lu automatiquement.',
  'voice.nickname.set': '✅ Vozen vous appellera désormais **{name}** à voix haute.',
  'voice.nickname.cleared': '✅ Surnom prononcé effacé — Vozen utilisera votre nom sur le serveur.',
  'voice.nickname.invalid':
    "Ce nom n'a rien de lisible à dire à voix haute. Essayez des lettres ou des chiffres.",
  'voice.effect.set':
    '✅ Effet de voix défini sur **{effect}** — vos messages sont désormais joués avec cet effet. Utilisez `/voice effect none` pour le désactiver.',
  'voice.effect.cleared': '✅ Effet de voix retiré — voix propre à nouveau.',
  'voice.effect.locked':
    '🔒 **{effect}** est un effet Premium. Effets gratuits : 🤖 Robot et 🔊 Echo. Débloquez-les tous avec Vozen Premium — voir `/premium`.',
  'voice.engine.gcloudLocked':
    '🔒 **💎 Google HD** est un moteur de voix Premium. Débloquez-le avec Vozen Plus (personnel) ou Vozen Premium (serveur) — voir `/premium`. En attendant, votre voix reste sur le moteur local gratuit.',
  'voice.engine.kokoroLocked':
    '🔒 **💎 Kokoro** est un moteur de voix Premium. Débloquez-le avec Vozen Plus (personnel) ou Vozen Premium (serveur) — voir `/premium`. En attendant, votre voix reste sur le moteur local gratuit.',
  'voice.notInVoice': "Je ne suis pas encore dans un salon vocal — lancez d'abord /join.",
  'voice.previewPlaying': "Lecture d'un échantillon…",
  'preview.sample': 'Salut, je suis Vozen. Tapez-le, entendez-le.',
  'laugh.playing': 'Haha ! Lecture de ça dans votre voix…',
  'joke.playing': 'Je raconte une blague…\n> {joke}',
  'joke.unknownLang': 'Je ne connais pas cette langue. Choisissez-en une dans la liste.',
  'rizz.playing': '😏 Je te sors du rizz…\n> {line}',
  'rizz.unknownLang': 'Je ne connais pas cette langue. Choisissez-en une dans la liste.',
  'rizz.locked':
    '🔒 **/rizz** est un avantage Premium. Débloquez-le avec Vozen Plus (vous) ou Premium (ce serveur). Voir `/premium`.',
  'sound.playing': '🔊 Lecture de **{name}**…',
  'sound.unknown': "Je n'ai pas ce son. Lancez `/sound` pour voir la liste.",
  'sound.list':
    '🔊 **Sons :** {sounds}\nJouez-en un avec `/sound name:<sound>` (je dois être dans votre salon vocal).',
  'sound.disabled':
    "🔇 Le soundboard est **désactivé** sur ce serveur. Un admin peut l'activer avec `/config soundboard`.",
  'fun.eightball': '🎱 **{question}**\n> {answer}',
  'fun.fortune': '🥠 {text}',
  'fun.fact': '💡 {text}',
  'fun.wyr': '🤔 {text}',
  'birthday.set':
    '🎂 Anniversaire enregistré : **{day}/{month}**. Je vous souhaiterai un joyeux anniversaire quand vous rejoindrez un salon vocal ce jour-là !',
  'birthday.invalid': "Ce n'est pas une date valide. Vérifiez le jour et le mois.",
  'birthday.cleared': '🎂 Anniversaire supprimé.',
  'birthday.show': '🎂 Votre anniversaire est défini au **{day}/{month}**.',
  'birthday.none': "Vous n'avez pas encore défini d'anniversaire. Utilisez `/birthday set`.",
  'topspeakers.title': '🗣️ **Meilleurs orateurs** — ceux que je lis le plus sur ce serveur :',
  'topspeakers.empty':
    "Je n'ai encore lu les messages de personne. Configurez un salon de lecture avec `/setup` !",
  'topspeakers.line': '{rank}. <@{user}> — **{count}** messages · 🔥 série de {streak} jours',
  'serverstats.title': '📊 **Statistiques du serveur**',
  'serverstats.empty':
    "Pas encore de statistiques — je n'ai lu aucun message ni lancé aucun jeu ici. Configurez avec `/setup` !",
  'serverstats.messages': '🗣️ **{total}** messages lus · **{speakers}** personnes',
  'serverstats.topTalkers': '**Meilleurs bavards :**',
  'serverstats.talkerLine': '{rank}. <@{user}> — {count} msgs · 🔥 {streak}j',
  'serverstats.streak': '🔥 Plus longue série active : **{days}** jours',
  'serverstats.games':
    '🎮 **{points}** points de jeu · **{wins}** victoires · **{players}** joueurs',
  'serverstats.topPlayers': '**Meilleurs joueurs :**',
  'serverstats.playerLine': '{rank}. <@{user}> — {points} pts · {wins} victoires',
  'serverstats.upsell':
    "🔒 Ceci est l'aperçu gratuit. **Premium** débloque les séries, les statistiques de jeu et le top 5 complet — voir `/premium`.",
  'streak.day':
    '🔥 <@{user}> est sur une série de **{n} jours** ! Continuez à parler pour la garder en vie.',
  'leaderboard.autoTitle': '🏆 Les plus bavards de ce serveur',
  'premium.title': '💎 **Statut Vozen Premium**',
  'premium.lineServerActive': "🖥️ **Serveur :** Premium jusqu'au {date}",
  'premium.lineServerFree': '🖥️ **Serveur :** Formule gratuite',
  'premium.lineUserActive': "👤 **Vous (Plus) :** actif jusqu'au {date}",
  'premium.lineUserFree': '👤 **Vous (Plus) :** inactif',
  'premium.getHint':
    "Tout ce que vous utilisez aujourd'hui reste gratuit. Premium ajoute les 8 effets de voix, le 24/7 en appel, 50 prononciations personnelles, /rizz et les jeux premium. Soutien : https://ko-fi.com/",
  'premium.enginePerks':
    '💎 **Moteurs vocaux Premium :** Kokoro neuronal et Google HD — débloqués pour vous avec Plus ou pour tous avec le Premium du serveur.',
  'premium.linePass':
    '🎟️ **Votre pass Premium :** {used}/{total} licences utilisées · expire le {date}',
  'premium.passServers': '↳ Utilisé sur : {servers}',
  'premium.pitch':
    "Vous n'avez pas encore Premium. **Vozen Premium** (€3.99/mois pour 3 serveurs, ou €7.99/mois pour 8) débloque pour tout le serveur : les 8 effets de voix, le 24/7 en appel, 50 prononciations personnelles (contre 3), la commande /rizz et les jeux premium (Chaîne de Mots, Wordle, Échecs). **Vozen Plus** (€1.99/mois) vous offre ces avantages à titre personnel, sur n'importe quel serveur.",
  'premium.buyHint':
    "▶ **Obtenir Premium :** {link}\nAprès l'achat, lancez `/premium activate` sur le serveur de votre choix.",
  'premium.confirmActivate':
    "Utiliser **1 de vos {total} licences Premium** sur **ce serveur** ? Vous en avez **{used}** en cours d'utilisation en ce moment. Vous pourrez la libérer plus tard avec `/premium deactivate` — le compteur du pass continue de tourner quoi qu'il arrive.",
  'premium.confirmYes': '💎 Utiliser une licence',
  'premium.confirmNo': 'Annuler',
  'premium.activateOk':
    "✅ Premium est maintenant actif sur **ce serveur** jusqu'au {date}. Licences : **{used}/{total}** utilisées.",
  'premium.activateCancelled': "Annulé — aucune licence n'a été utilisée.",
  'premium.activateTimeout': "Délai dépassé — aucune licence n'a été utilisée.",
  'premium.noPass':
    "Vous n'avez pas de pass Premium actif. Procurez-vous-en un et il arrivera sur votre compte — puis lancez `/premium activate` ici.\n▶ {link}",
  'premium.alreadyActive': "Ce serveur possède déjà l'une de vos licences Premium. Rien à faire.",
  'premium.noSeats':
    'Vos **{total}** licences Premium sont toutes utilisées ({servers}). Libérez-en une avec `/premium deactivate` là-bas, puis réessayez ici.',
  'premium.needManageGuild':
    "L'activation de Premium concerne tout le serveur — seuls les membres ayant **Gérer le serveur** peuvent le faire. Demandez à un admin.",
  'premium.deactivateOk':
    '✅ Licence Premium de ce serveur libérée. Utilisez-la sur un autre serveur avec `/premium activate`.',
  'premium.deactivateNone': "Ce serveur n'a aucune licence Premium de votre part à libérer.",
  'premium.thisServer': 'ce serveur',
  'grant.denied': '⛔ Cette commande est réservée au propriétaire du bot.',
  'grant.okPremium':
    "✅ Accordé à <@{user}> un **pass Premium** ({seats} licences) pour **{days}** jours — expire le {date}. Il l'active avec `/premium activate`.",
  'grant.okPlus': '✅ Accordé à <@{user}> **Vozen Plus** pour **{days}** jours — expire le {date}.',
  'gencode.done':
    '✅ **{count}** code(s) {plan} générés, **{days}** jours chacun. Partagez-les en privé :\n{list}',
  'redeem.okPlus':
    '🎁 Code utilisé ! Vous avez obtenu **Vozen Plus** pour **{days}** jours — expire le {date}.',
  'redeem.okPremium':
    '🎁 Code utilisé ! Vous avez obtenu un **pass Premium** ({seats} licences) pour **{days}** jours — expire le {date}. Activez-le sur votre serveur avec `/premium activate`.',
  'redeem.notFound': "❌ Ce code n'existe pas. Vérifiez-le et réessayez.",
  'redeem.used': '❌ Ce code a déjà été utilisé.',
  'redeem.expired': '❌ Ce code a expiré.',
  'voice.abbrev.added': "C'est noté — {term} sera lu comme {replacement}.",
  'voice.abbrev.removed': "J'ai supprimé votre abréviation pour {term}.",
  'voice.abbrev.listHeader': 'Vos abréviations personnelles ({count}/{cap} utilisées) :',
  'voice.abbrev.listEmpty': "(aucune pour l'instant — ajoutez-en une avec /voice abbrev add)",
  'voice.abbrev.capReached':
    "Vous avez atteint la limite de {cap} abréviations personnelles. Supprimez-en une avant d'en ajouter une autre.",
  'voice.abbrev.invalidTerm':
    "Le terme doit être un seul mot (lettres et chiffres uniquement), jusqu'à 50 caractères.",
  'voice.abbrev.emptyReplacement': 'La lecture ne peut pas être vide.',
  'voice.abbrev.tooLong': 'La lecture est trop longue (200 caractères maximum).',
  'config.wordEmpty': 'Le mot ne peut pas être vide.',
  'config.blocked': 'Bloqué : {word}.',
  'config.blockLimit':
    "Ce serveur a déjà le maximum de {max} mots bloqués. Supprimez-en un avant d'en ajouter un autre.",
  'config.unblocked': 'Débloqué : {word}.',
  'config.pronListHeader': 'Dictionnaire de prononciation :',
  'config.pronEmptyValue': '(vide)',
  'config.listEmpty': '(aucun)',
  'config.termEmpty': 'Le terme ne peut pas être vide.',
  'config.pronEmpty': 'La prononciation ne peut pas être vide.',
  'config.pronSet': "C'est noté — {term} sera lu comme {replacement}.",
  'config.pronRemoved': "J'ai supprimé la prononciation pour {term}.",
  'config.channelWrongType': 'Choisissez un salon textuel (pas un salon vocal ni une catégorie).',
  'config.channelNoAccess': 'Je ne vois pas {channel} — veuillez vérifier mes permissions là-bas.',
  'config.channelSet':
    'Salon de lecture automatique défini sur {channel}. Ensuite : assurez-vous que la lecture automatique est activée avec `/config auto-read active:true`.',
  'config.autoreadOn': 'La lecture automatique est maintenant **activée**.',
  'config.autoreadOff': 'La lecture automatique est maintenant **désactivée**.',
  'config.maxCharsRange':
    'La valeur du nombre max. de caractères doit être comprise entre 1 et 2000.',
  'config.maxCharsSet': 'Nombre maximal de caractères par message défini sur {value}.',
  'config.rateLimitRange': 'La valeur de la limite de débit doit être comprise entre 1 et 120.',
  'config.rateLimitSet': 'Limite de débit définie sur {value} messages par minute.',
  'config.roleSet': 'La lecture automatique est désormais limitée aux membres ayant {role}.',
  'config.roleCleared': 'Restriction de rôle supprimée — tout le monde peut désormais être lu.',
  'config.enabledOn': 'La synthèse vocale est maintenant **activée** pour ce serveur.',
  'config.enabledOff': 'La synthèse vocale est maintenant **désactivée** pour ce serveur.',
  'config.xsaidOn':
    'Vozen annoncera désormais **qui a parlé** avant chaque message (par ex. « Alex a dit salut »). Désactivez avec `/config x-said active:false`.',
  'config.xsaidOff': "Vozen **n'annoncera plus** qui a parlé — il ne lit que le message.",
  'config.autojoinOn':
    '✅ Connexion automatique **activée** — Vozen rejoindra votre salon vocal quand vous écrirez dans le salon de synthèse vocale.',
  'config.autojoinOff':
    'Connexion automatique **désactivée** — utilisez `/join` pour amener Vozen dans le vocal.',
  'config.stayOn':
    '✅ 24/7 en appel **activé** — Vozen restera dans le salon vocal même quand il se vide, et reviendra après les redémarrages. 💎 Nécessite Premium pour prendre effet (achetez ou utilisez `/redeem` sur un code, puis `/premium activate`).',
  'config.stayOff':
    '24/7 en appel **désactivé** — Vozen part quand le salon vocal se vide (par défaut).',
  'config.readBotsOn':
    '✅ Vozen lira désormais aussi les messages des **autres bots et webhooks**.',
  'config.readBotsOff':
    'Vozen **ignorera** les autres bots et webhooks (seules les vraies personnes sont lues).',
  'config.textInVoiceOn':
    "✅ Vozen lira aussi le **chat textuel à l'intérieur de son salon vocal**.",
  'config.textInVoiceOff':
    'Vozen **ne lira pas** le chat textuel du salon vocal (uniquement le salon de synthèse vocale).',
  'config.antispamOn':
    '✅ Anti-spam **activé** — Vozen ne lira pas les messages spammés (répétition massive de mots ou le même gros message publié en boucle).',
  'config.antispamOff': "Anti-spam **désactivé** — Vozen lit chaque message comme d'habitude.",
  'config.streaksOn':
    '✅ Avis de série **activés** — Vozen affiche un message de série 🔥 la première fois que chaque personne parle chaque jour.',
  'config.streaksOff':
    'Avis de série **désactivés** — Vozen continue de suivre les séries (voir `/top-speakers`) mais reste discret à leur sujet.',
  'config.soundboardOn':
    "Soundboard **activé** — n'importe qui peut jouer des clips avec `/sound`.",
  'config.soundboardOff': 'Soundboard **désactivé** — `/sound` est désactivé sur ce serveur.',
  'config.votePromosLabel': 'Avis de récompense top.gg + Vozen Support',
  'config.greetOn': '✅ Je saluerai les gens par leur nom quand ils rejoindront le salon vocal.',
  'config.greetOff': '🔇 Je **ne saluerai pas** les gens quand ils rejoindront le salon vocal.',
  'config.greetLangSet': "✅ Langue du message d'accueil à l'arrivée définie sur **{language}**.",
  'config.defaultVoiceSet':
    '✅ Voix par défaut du serveur définie sur **{name}**. Les membres sans voix propre entendront celle-ci. (id : `{model}`)',
  'config.reset':
    'Configuration réinitialisée aux valeurs par défaut. Votre liste de blocage et vos prononciations ont été conservées.',
  'config.showTitle': '**Configuration du serveur**',
  'config.showChannel': 'Salon de synthèse vocale : {value}',
  'config.showAutoread': 'Lecture automatique : {value}',
  'config.showRole': 'Rôle : {value}',
  'config.showEnabled': 'Activé : {value}',
  'config.showXsaid': 'Annoncer le locuteur (xsaid) : {value}',
  'config.showAutojoin': 'Connexion automatique : {value}',
  'config.showReadBots': 'Lire les bots/webhooks : {value}',
  'config.showTextInVoice': 'Texte-dans-le-vocal : {value}',
  'config.showAntispam': 'Anti-spam : {value}',
  'config.showSoundboard': 'Soundboard (/sound) : {value}',
  'config.showGreet': "Saluer à l'arrivée : {value} ({language})",
  'config.showVoice': 'Voix par défaut : {value}',
  'config.showMaxChars': 'Nombre max. de caractères : {value}',
  'config.showRateLimit': 'Limite de débit : {value}/min',
  'config.showBlocklist': 'Liste de blocage : {count} mots',
  'config.showPronunciation': 'Prononciations : {count} entrées',
  'config.valueNone': '(aucun)',
  'config.valueAny': 'tout le monde',
  'config.valueAutoDetect': '(détection automatique)',
  'config.on': 'activé',
  'config.off': 'désactivé',
  'config.language.set': "Langue de l'interface définie sur {language}.",
  'config.language.unsupported': "Cette langue n'est pas encore prise en charge.",
  'setup.noChannel':
    "Je n'ai pas pu déterminer quel salon utiliser. Indiquez un salon textuel dans l'option « channel ».",
  'setup.channelWrongType':
    "Le salon de lecture automatique doit être un salon textuel (pas un salon vocal ni une catégorie). Indiquez-en un dans l'option « channel ».",
  'setup.done': '**Tout est prêt — Vozen est opérationnel.**',
  'setup.channelLine': 'Salon de lecture automatique : {channel}',
  'setup.autoreadOn': 'Lecture automatique : activée',
  'setup.permsHeader': '**Permissions :**',
  'setup.permView': 'ViewChannel (voir le salon textuel)',
  'setup.permSend': 'SendMessages (publier dans le salon textuel)',
  'setup.permConnect': 'Connect (rejoindre le salon vocal)',
  'setup.permSpeak': 'Speak (parler dans le salon vocal)',
  'setup.permOk': '✅ {label}',
  'setup.permMissing': '❌ {label} — manquante',
  'setup.permUnchecked': '⏳ {label} — pas encore vérifiée (je la vérifierai lors du /join)',
  'setup.fixHint':
    "Pour corriger ce qui manque : dans les paramètres de votre serveur, ouvrez le rôle de Vozen (ou les permissions du salon) et activez les éléments marqués d'un ❌.",
  'setup.voiceUncheckedNote':
    "Vous n'êtes pas dans un salon vocal, je n'ai donc pas encore pu vérifier Connect/Speak — je les vérifierai lorsque vous lancerez /join.",
  'setup.allGood': 'Tout est prêt. Rejoignez un salon vocal et lancez /join.',
  'setup.joinedVoice': "J'ai aussi rejoint {channel} — pas besoin de lancer /join.",
  'setup.readyTalk':
    'Tout est prêt. Écrivez dans le salon de lecture automatique et je le lirai à voix haute.',
  'setup.membersHeader': '**Prévenez vos membres (la procédure en 3 étapes) :**',
  'setup.membersBody':
    '1) Rejoignez un salon vocal\n2) Lancez /join pour que je vous rejoigne\n3) Écrivez dans ce salon (ou utilisez /tts) et je lis à voix haute\nListe complète des commandes : /help',
  'stats.title': '**Statistiques de Vozen**',
  'stats.messagesSpoken': 'Messages énoncés : {value}',
  'stats.cacheHits': 'Succès de cache : {value}',
  'stats.cacheMisses': 'Échecs de cache : {value}',
  'stats.synthErrors': 'Erreurs de synthèse : {value}',
  'stats.synthLatency': 'Latence de synthèse : p50 {p50}ms / p95 {p95}ms ({count} échantillons)',
  'stats.voiceDrops': 'Coupures vocales : {value}',
  'stats.voiceReconnects': 'Reconnexions : {value}',
  'stats.votes': 'Votes top.gg : {value}',
  'stats.activePlayers': 'Lecteurs actifs : {value}',
  'stats.servers': 'Serveurs : {value}',
  'stats.uptime': 'Temps de fonctionnement : {value}s',
  'speak.emptyMessage': "Ce message n'a pas de texte à lire à voix haute.",
  'uptime.text': '🟢 Vozen est en ligne depuis **{uptime}**.',
  'botstats.title': '📊 **Vozen — statistiques**',
  'botstats.servers': 'Serveurs : **{value}**',
  'botstats.voiceSessions': 'Sessions vocales actuelles : **{value}**',
  'botstats.messagesSpoken': 'Messages énoncés : **{value}**',
  'botstats.uptime': 'En ligne depuis : **{value}**',
  'invite.noClientId':
    "Le lien d'invitation de Vozen n'est pas encore configuré (CLIENT_ID est manquant). Prévenez l'administrateur du bot.",
  'invite.link': 'Ajoutez Vozen à votre serveur :\n{url}',
  'vote.noClientId':
    "Le lien de vote de Vozen n'est pas encore configuré (CLIENT_ID est manquant). Prévenez l'administrateur du bot.",
  'vote.link':
    'Votez pour Vozen (gratuit, toutes les 12 h) et aidez plus de gens à le découvrir :\n{url}\nSi ce compte n’a jamais réclamé la récompense, il reçoit **48 h de Vozen Plus**, une seule fois par compte.',
  'invite.button': 'Ajouter Vozen',
  'vote.button': 'Voter sur top.gg',
  'vote.upsell':
    '🗳️ Si ce compte n’a jamais réclamé la récompense, il reçoit **48 h de Vozen Plus**, une seule fois par compte. {url}',
  'vote.cooldownStatus':
    '🗳️ Ce compte a déjà utilisé sa récompense de vote unique. Vous pouvez toujours voter pour soutenir Vozen, mais vous ne recevrez plus de Plus.',
  'help.title': 'Vozen — tapez-le, entendez-le.',
  'help.embedTitle': 'Vozen — Commandes',
  'help.intro':
    'Vozen lit votre texte à voix haute dans les salons vocaux — voix neuronales gratuites, des dizaines de langues.',
  'help.quickStartTitle': 'Démarrage rapide (3 étapes)',
  'help.quickStartBody':
    '1) Rejoignez un salon vocal, puis lancez /join\n2) Écrivez dans le salon textuel (ou utilisez /tts Bonjour tout le monde !)\n3) (facultatif) Choisissez une voix avec /voice set',
  'help.groupStarted': 'Pour commencer',
  'help.groupStartedBody':
    '• /join — je rejoins votre salon vocal\n• /leave — je quitte le salon vocal\n• /tts <texte> — je lis le texte à voix haute · ex. /tts Bonjour tout le monde !\n• /skip — passer ce que je suis en train de lire',
  'help.groupVoice': 'Votre voix',
  'help.groupVoiceBody':
    "• /voice set <model> — choisissez votre voix · ex. /voice set en_US-amy-medium\n• /voice list — voir les voix disponibles\n• /voice preview — écouter un échantillon de votre voix\n• /voice reset — revenir à la voix par défaut\n• /voice opt-out · /voice opt-in — désactiver / activer la lecture automatique pour vous\n• /voice abbrev add|remove|list — argot personnel, lu à votre façon (jusqu'à 10)",
  'help.groupFun': 'Divertissement',
  'help.groupFunBody':
    '• /joke — je raconte une courte blague (choisissez une langue + rire facultatif) · ex. /joke English\n• /laugh — je ris à voix haute dans votre voix actuelle',
  'help.groupAdmin': 'Admin du serveur (nécessite Gérer le serveur)',
  'help.groupAdminBody':
    '• /setup — configuration guidée en une étape · lancez ceci en premier\n• /config — auto-read, tts-channel, language, default-voice, block-word, pronunciation,\n  rate-limit, role, max-chars, enabled · ex. /config tts-channel #general\n• /stats — statistiques du bot',
  'help.groupMore': 'Plus',
  'help.groupMoreBody':
    '• /invite — ajouter Vozen à un autre serveur\n• /vote — voter pour Vozen sur top.gg\n• /help — afficher cette aide',
  'help.footer': 'Nouveau ici ? Lancez {command} pour commencer.',
  'help.support': "🛟 Besoin d'aide ou envie de signaler un problème ? {url}",
  'help.source': '📄 Open source (AGPL-3.0) — obtenez le code source exact qui tourne ici : {url}',
  'welcome.title': "Merci d'avoir ajouté Vozen ! 👋",
  'welcome.description':
    'Vozen lit votre discussion à voix haute dans les salons vocaux — tapez-le, entendez-le.\n\n**Commencez en une seule étape :** lancez {setup} et je configurerai la lecture automatique et rejoindrai votre salon vocal.\n\nBesoin de la liste complète des commandes ? Lancez {help}.',
  'welcome.enginePlans':
    'Les voix neuronales Piper restent gratuites. 💎 Kokoro et Google HD se débloquent avec Vozen Plus ou le Premium du serveur.',
  'welcome.stepsTitle': "Comment les membres l'utilisent (3 étapes)",
  'welcome.stepsBody':
    '1) Rejoignez un salon vocal\n2) Lancez /join pour que je vous rejoigne\n3) Écrivez dans le salon textuel (ou utilisez /tts) et je lis à voix haute\nListe complète des commandes : /help',
  'welcome.footer': 'Vozen — tapez-le, entendez-le.',
  'welcome.tagline': 'Voix neuronale naturelle — gratuite pour toujours, sans péage.',
  'game.start.needVoice':
    "C'est un **jeu vocal** — rejoignez un salon vocal et lancez d'abord /join, puis démarrez-le.",
  'game.start.alreadyActive':
    "Un jeu est déjà en cours dans <#{channel}>. Terminez-le (ou utilisez `/game stop`) avant d'en commencer un autre.",
  'game.start.premiumLocked':
    '🔒 **{game}** est un jeu Premium (il coûte du vrai calcul). Voir `/premium`.',
  'game.start.started': '🎮 Lancement de **{game}** ! Surveillez le salon — bonne chance !',
  'game.start.startedThread':
    '🎮 **{game}** a commencé dans <#{channel}> — rejoignez-y ! Le fil se supprime tout seul à la fin du jeu.',
  'game.thread.winner': '🏆 {winner} a gagné la partie !',
  'game.thread.ended': '🎮 La partie est terminée.',
  'game.unknownGame': 'Je ne connais pas ce jeu. Choisissez-en un dans la liste.',
  'game.stop.ok': "🛑 J'ai arrêté le jeu en cours.",
  'game.stop.none': "Il n'y a aucun jeu en cours pour l'instant.",
  'game.list.title': '🎮 **Jeux** — lancez-en un avec `/game play` :',
  'game.list.line': '• **{name}** — {desc}',
  'game.leaderboard.title': '🏆 **Classement** — meilleurs joueurs de ce serveur :',
  'game.leaderboard.empty': "Aucun jeu n'a encore été joué. Soyez le premier — `/game play` !",
  'game.leaderboard.line': '{rank} <@{user}> — **{points}** pts ({wins} victoires)',
  'game.finish.title': '🏁 **Fin de partie !** Scores finaux :',
  'game.finish.line': '{rank} **{user}** — {points}',
  'game.finish.noScores': "🏁 Fin de partie — personne n'a marqué cette fois. La prochaine fois !",
  'game.finish.winnerVoice': '{user} gagne !',
  'game.guessLanguage.name': 'Devine la Langue',
  'game.guessLanguage.desc':
    'Je lis une phrase dans une langue au hasard — le premier à la nommer gagne le point.',
  'game.guessLanguage.intro':
    '🗣️ **Devine la Langue** — je vais lire {rounds} phrases. Écrivez quelle langue vous entendez. La bonne réponse la plus rapide gagne chaque manche !',
  'game.guessLanguage.round': '🎧 Manche {n}/{total} — écoutez…',
  'game.guessLanguage.correct': "✅ **{user}** a trouvé — c'était **{language}** !",
  'game.guessLanguage.timeout': "⏱️ Temps écoulé ! C'était **{language}**.",
  'game.guessLanguage.noLanguages':
    "Je n'ai pas assez de voix installées pour jouer à ça. Demandez à un admin d'ajouter plus de voix.",
  'game.math.name': 'Calcul Mental',
  'game.math.desc': 'Je dis un calcul à voix haute — le premier à écrire la réponse gagne.',
  'game.math.intro':
    '🔢 **Calcul Mental** — {rounds} calculs. Écoutez et écrivez la réponse le plus vite possible !',
  'game.math.round': '🧮 Manche {n}/{total} — **{a} {op} {b} = ?**',
  'game.math.correct': '✅ **{user}** a assuré — la réponse était **{answer}** !',
  'game.math.timeout': '⏱️ Temps écoulé ! La réponse était **{answer}**.',
  'game.math.plus': 'plus',
  'game.math.minus': 'moins',
  'game.math.times': 'fois',
  'game.skipCount.name': 'Le Nombre Manquant',
  'game.skipCount.desc':
    "Je compte à voix haute mais je saute un nombre — le premier à l'attraper gagne.",
  'game.skipCount.intro':
    "🔢 **Le Nombre Manquant** — je compte, mais j'en saute un. Écrivez le nombre manquant ! ({rounds} manches)",
  'game.skipCount.round': '👂 Manche {n}/{total} — quel nombre ai-je sauté ?',
  'game.skipCount.correct': "✅ **{user}** l'a attrapé — j'ai sauté **{answer}** !",
  'game.skipCount.timeout': "⏱️ Temps écoulé ! J'ai sauté **{answer}**.",
  'game.spelling.name': 'Dictée',
  'game.spelling.desc': "Je dis un mot — le premier à l'écrire correctement gagne.",
  'game.spelling.intro':
    '✍️ **Dictée** — je vais dire {rounds} mots. Écrivez chacun correctement !',
  'game.spelling.round': '🗣️ Manche {n}/{total} — écrivez le mot que je dis…',
  'game.spelling.correct': '✅ **{user}** a bien écrit **{word}** !',
  'game.spelling.timeout': '⏱️ Temps écoulé ! Le mot était **{word}**.',
  'game.spelling.empty':
    "Je n'ai pas encore de liste de mots pour la langue de la voix de ce serveur.",
  'game.spellOut.name': 'Épellation',
  'game.spellOut.desc':
    "J'épelle un mot lettre par lettre — le premier à écrire le mot entier gagne.",
  'game.spellOut.intro':
    "🔡 **Épellation** — j'épelle {rounds} mots lettre par lettre. Écrivez le mot complet !",
  'game.spellOut.round': '🔤 Manche {n}/{total} — écoutez les lettres…',
  'game.spellOut.correct': '✅ **{user}** a trouvé — **{word}** !',
  'game.spellOut.timeout': '⏱️ Temps écoulé ! Ça épelait **{word}**.',
  'game.fastSpeech.name': 'Parle Vite',
  'game.fastSpeech.desc':
    "Je lis une phrase super vite — le premier à écrire ce que j'ai dit gagne.",
  'game.fastSpeech.intro':
    '💨 **Parle Vite** — {rounds} phrases à une vitesse ridicule. Écrivez ce que vous entendez !',
  'game.fastSpeech.round': '⚡ Manche {n}/{total} — ça arrive, vite !',
  'game.fastSpeech.correct': '✅ **{user}** a déchiffré : « {phrase} »',
  'game.fastSpeech.timeout': "⏱️ Temps écoulé ! C'était : « {phrase} »",
  'game.fastSpeech.empty': "Je n'ai pas encore de phrases pour la langue de la voix de ce serveur.",
  'game.accentSwap.name': "Drôle d'Accent",
  'game.accentSwap.desc': "Je dis un mot avec un accent étranger — le premier à l'écrire gagne.",
  'game.accentSwap.intro':
    "🎭 **Drôle d'Accent** — {rounds} mots dits avec le mauvais accent. Écrivez le mot !",
  'game.accentSwap.round': "🌍 Manche {n}/{total} — quel mot j'essaie de dire ?",
  'game.accentSwap.correct': '✅ **{user}** a trouvé — **{word}** !',
  'game.accentSwap.timeout': '⏱️ Temps écoulé ! Le mot était **{word}**.',
  'game.reflexes.name': 'Réflexes',
  'game.reflexes.desc':
    'Je fais le compte à rebours, puis je crie PARTEZ — le premier à écrire après ça gagne. Ne partez pas trop tôt !',
  'game.reflexes.intro':
    "⚡ **Réflexes** — {rounds} manches. Quand je crie **PARTEZ**, écrivez n'importe quoi le plus vite possible. Écrire avant PARTEZ, c'est un faux départ !",
  'game.reflexes.ready': '🚦 Manche {n}/{total} — préparez-vous…',
  'game.reflexes.countdown': 'trois… deux… un…',
  'game.reflexes.go': '🟢 **PARTEZ !!!**',
  'game.reflexes.goVoice': 'Partez !',
  'game.reflexes.tooSoon': '🔴 **{user}** a grillé le départ — trop tôt !',
  'game.reflexes.win': '⚡ **{user}** est le plus rapide ! Point !',
  'game.reflexes.tooSlow': "😴 Personne n'a réagi à temps. Suivant !",
  'game.headsOrTails.name': 'Pile ou Face',
  'game.headsOrTails.desc':
    'Annoncez le résultat avant que je lance la pièce. Le meilleur pronostiqueur gagne !',
  'game.headsOrTails.intro':
    '🪙 **Pile ou Face** — {rounds} manches. À chaque manche, écrivez `heads` (face) ou `tails` (pile) avant que je lance la pièce. 1 point par bonne annonce !',
  'game.headsOrTails.introVoice': 'Jouons à pile ou face !',
  'game.headsOrTails.round': '🪙 Manche {n}/{total} — face ou pile ? Écrivez votre annonce !',
  'game.headsOrTails.roundVoice': 'Face… ou pile ?',
  'game.headsOrTails.heads': 'face',
  'game.headsOrTails.tails': 'pile',
  'game.headsOrTails.resultVoice': "C'est {side} !",
  'game.headsOrTails.winners': "C'est **{side}** ! Point pour : {users}",
  'game.headsOrTails.noWinners': "C'est **{side}** ! Personne ne l'a annoncé — pas de points.",
  'game.vozenSays.name': 'Vozen dit',
  'game.vozenSays.desc':
    "N'obéissez que si l'ordre commence par « Vozen dit ». Tombez dans un piège et vous êtes pris !",
  'game.vozenSays.intro':
    '🫡 **Vozen dit** — {rounds} ordres. Faites-le UNIQUEMENT si je commence par **« Vozen dit »**. Sinon, ne bougez pas !',
  'game.vozenSays.prefix': 'Vozen dit',
  'game.vozenSays.verb': 'écrivez',
  'game.vozenSays.real': '🗣️ Manche {n}/{total} — « {command} »',
  'game.vozenSays.trap': '🗣️ Manche {n}/{total} — « {command} »',
  'game.vozenSays.obeyed': '✅ **{user}** a obéi en premier — point !',
  'game.vozenSays.caught': "🔴 **{user}** — je n'ai pas dit Vozen dit ! Pris !",
  'game.vozenSays.nobody': "😴 Personne n'a obéi à **{word}** à temps. Suivant !",
  'game.vozenSays.trapCleared':
    "😌 C'était un piège — bien vu, personne n'est tombé dans **{word}**.",
  'game.roulette.name': 'Roulette Action ou Vérité',
  'game.roulette.desc':
    'Je fais tourner la roue et lis un défi (action ou vérité) à voix haute. Relancez pour un autre.',
  'game.roulette.header': '🎯 **La roue dit…**',
  'game.hangman.name': 'Le Pendu',
  'game.hangman.desc': "Devinez le mot une lettre à la fois — 6 erreurs et c'est fini.",
  'game.hangman.intro':
    '🪢 **Le Pendu** — écrivez une lettre à la fois pour deviner le mot. Vous pouvez aussi écrire le mot entier !',
  'game.hangman.hit': '🟢 **{user}** a trouvé le **{letter}** !',
  'game.hangman.miss': '🔴 **{user}** — pas de **{letter}**.',
  'game.hangman.wrongLetters': 'Fausses : {letters}',
  'game.hangman.win': '🎉 **{user}** a résolu — **{word}** !',
  'game.hangman.lose': "💀 Plus d'essais ! Le mot était **{word}**.",
  'game.hangman.idle': '🕹️ Jeu en pause (personne ne joue). Le mot était **{word}**.',
  'game.wordle.name': 'Wordle',
  'game.wordle.desc':
    'Devinez le mot de 5 lettres. 🟩 bonne place, 🟨 mauvaise place, ⬛ pas dans le mot. 💎 Premium.',
  'game.wordle.intro':
    '🟩 **Wordle** — écrivez un mot de 5 lettres. Vous partagez {max} essais. 🟩 bonne place · 🟨 mauvaise place · ⬛ pas dans le mot.',
  'game.wordle.guess': '🔤 **{user}** a tenté — **{left}** essais restants',
  'game.wordle.inWord': '🟢 dans le mot : {letters}',
  'game.wordle.out': '🚫 hors : ~~{letters}~~',
  'game.wordle.win': '🎉 **{user}** a trouvé en {n} — **{word}** !',
  'game.wordle.lose': "💀 Plus d'essais ! Le mot était **{word}**.",
  'game.wordle.idle': '🕹️ Jeu en pause (personne ne joue). Le mot était **{word}**.',
  'game.tictactoe.name': 'Morpion',
  'game.tictactoe.desc':
    'Deux joueurs — écrivez un nombre de 1 à 9 pour placer votre marque. Trois alignés gagnent.',
  'game.tictactoe.intro':
    '⭕ **Morpion** — les deux premiers joueurs à jouer sont ❌ et ⭕ (❌ commence). Écrivez un nombre de 1 à 9 pour jouer votre case.',
  'game.tictactoe.turn': 'Tour : **{mark}**',
  'game.tictactoe.notYourTurn': "⏳ **{user}**, c'est au tour de **{mark}**.",
  'game.tictactoe.taken': '🚫 La case {cell} est prise — choisissez-en une autre.',
  'game.tictactoe.win': '🎉 **{user}** ({mark}) gagne !',
  'game.tictactoe.draw': '🤝 Match nul !',
  'game.tictactoe.idle': '🕹️ Jeu terminé (personne ne joue).',
  'game.chess.name': 'Échecs',
  'game.chess.desc':
    "Deux joueurs — vraies règles d'échecs (échec, roque, promotion…). Écrivez un coup comme « e4 » ou « Nf3 ». 💎 Premium.",
  'game.chess.intro':
    '♟️ **Échecs** — les deux premiers joueurs à jouer ont les Blancs et les Noirs (les Blancs commencent). Écrivez un coup en notation algébrique (« e4 », « Nf3 », « O-O ») ou en coordonnées (« e2e4 »). Écrivez « resign » pour abandonner.',
  'game.chess.white': 'Blancs',
  'game.chess.black': 'Noirs',
  'game.chess.seats': '⚪ Blancs : **{white}** · ⚫ Noirs : **{black}**',
  'game.chess.turn': '{move} — tour : **{color}**',
  'game.chess.check': '♟️ Échec !',
  'game.chess.notYourTurn': "⏳ **{user}**, c'est au tour des **{color}**.",
  'game.chess.illegalMove': "🚫 « {move} » n'est pas un coup légal — réessayez.",
  'game.chess.checkmate': '🏆 Échec et mat ({move}) ! **{user}** gagne !',
  'game.chess.draw': '🤝 Match nul ({move}) !',
  'game.chess.resigned': '🏳️ **{user}** a abandonné — **{winner}** gagne !',
  'game.chess.idle': '🕹️ Jeu terminé (personne ne joue).',
  'game.wordChain.name': 'Chaîne de Mots',
  'game.wordChain.descr':
    "Chaîne de mots au tour par tour dans une langue : dites un mot commençant par la dernière lettre du précédent. 2 vies, sans répéter, et l'horloge accélère. Choisissez la langue avec l'option `language`. 💎 Premium.",
  'game.wordChain.unavailable':
    "⚠️ La Chaîne de Mots n'est pas disponible en **{lang}** pour le moment (liste de mots manquante).",
  'game.wordChain.lobby':
    "🔗 **Chaîne de Mots** en **{lang}** ! Écrivez n'importe quoi dans ce salon dans les **{seconds}s** pour participer.",
  'game.wordChain.notEnough': '😴 Pas assez de joueurs (il en faut au moins 2). Jeu annulé.',
  'game.wordChain.begin':
    "🚀 C'est parti ! Joueurs : {players}. Chaque mot doit commencer par la dernière lettre du précédent.",
  'game.wordChain.turn':
    '**{name}**, à vous ! Un mot en **{lang}** commençant par **{letter}** — {hearts} · ⏱️ {seconds}s',
  'game.wordChain.accepted': '✅ **{word}** — lettre suivante : **{letter}**',
  'game.wordChain.bad.letter': '↪️ Il doit commencer par **{letter}**.',
  'game.wordChain.bad.short': '📏 Trop court — au moins **{min}** lettres.',
  'game.wordChain.bad.repeated': '🔁 Ce mot a déjà été utilisé.',
  'game.wordChain.bad.word': "📖 Il n'est pas dans le dictionnaire.",
  'game.wordChain.bad.latin': '🔤 Seules les lettres A–Z comptent.',
  'game.wordChain.timeout': "⏰ **{name}** n'a plus de temps ! Il reste {hearts}.",
  'game.wordChain.eliminated': '💀 **{name}** est éliminé !',
  'game.wordChain.winner': '🏆 **{name}** remporte la chaîne ! ({chain} mots)',
  'game.stats.none': "Vous n'avez encore joué à aucun jeu. Essayez `/game play` !",
  'game.stats.body':
    '🎮 **Vos statistiques** — **{points}** points · **{wins}** victoires · {rank}',
  'game.stats.rank': 'rang **#{rank}** sur {total}',
  'game.stats.unranked': 'pas encore classé',
  'game.pickPrompt': '🎮 À quel jeu voulez-vous jouer ? Choisissez-en un :',
  'game.pickPlaceholder': 'Choisissez un jeu…',
  'game.pickTimeout': '⏰ Aucun jeu choisi — relancez `/game play` quand vous êtes prêt.',
  'pron.listHeader': '🗣️ **Vos prononciations** ({count}/{limit}) :',
  'pron.listEmpty': "Vous n'en avez pas encore — ajoutez-en une avec `/pronunciation add`.",
  'pron.set': '✅ Enregistré ! Quand **vous** écrivez « {term} », je dirai « {replacement} ».',
  'pron.removed': '🗑️ « {term} » supprimé.',
  'pron.notFound':
    "Vous n'avez aucune prononciation pour « {term} ». Consultez les vôtres avec `/pronunciation list`.",
  'pron.empty': 'Le mot et la façon de le dire ne peuvent pas être vides.',
  'pron.limitHit':
    '🔒 Vous avez atteint votre limite de **{limit}** prononciations. Supprimez-en une avec `/pronunciation remove`.',
  'pron.limitUpsell': "💎 Vozen Plus ou Premium l'augmente à **50** → {url}",
  'pron.modalTitle': 'Apprenez une prononciation à Vozen',
  'pron.modalTerm': "Le mot (tel qu'on l'écrit)",
  'pron.modalSay': 'Comment Vozen doit le dire',
  'spron.listHeader':
    "🗣️ **Prononciations du serveur** ({count}/{limit}) — s'appliquent à tout le monde :",
  'spron.listEmpty': "Aucune pour l'instant — ajoutez-en une avec `/server-pronunciation add`.",
  'spron.set': '✅ Enregistré pour tout le serveur ! « {term} » → « {replacement} ».',
  'spron.removed': '🗑️ « {term} » supprimé du serveur.',
  'spron.notFound': "Le serveur n'a aucune prononciation pour « {term} ».",
  'spron.limitHit':
    '🔒 Le serveur a atteint sa limite de **{limit}** prononciations. Supprimez-en une avec `/server-pronunciation remove`.',
  'spron.modalTitle': 'Prononciation du serveur',
  'spron.modalSay': 'Comment Vozen la dit pour tout le monde',
  'rand.selectPrompt':
    "🎲 **Randomiseur** — parmi combien d'options voulez-vous que je choisisse ?",
  'rand.selectPlaceholder': "Nombre d'options…",
  'rand.selectOption': '{n} options',
  'rand.filling': "📝 Remplissez le formulaire qui vient de s'ouvrir !",
  'rand.modalTitle': 'Randomiseur — {amount} options',
  'rand.modalOption': 'Option {n}',
  'rand.needTwo':
    'Donnez-moi au moins 2 options séparées par des virgules (par ex. « pizza, sushi »).',
  'rand.result': 'Parmi {count} options, je choisis… **{winner}** !',
  'rand.speak': 'Je choisis… {winner} !',
  'rand.notInVoice':
    '_(rejoignez un salon vocal avec moi et je le dirai à voix haute la prochaine fois)_',
  'rand.timeout': '⏰ Rien de choisi — relancez `/randomizer` quand vous êtes prêt.',
};
