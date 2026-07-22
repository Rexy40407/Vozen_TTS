import { ActivityType, type PresenceData } from 'discord.js';
import type { AppConfig } from '../config/index';

/**
 * Texto por defeito da presenca — auto-marketing subtil. Cada vez que alguem ve
 * o Vozen online, ve a marca ("type it, hear it.") + um CTA para um comando real
 * (/setup). Curto de proposito: o cliente Discord trunca atividades compridas.
 */
export const DEFAULT_PRESENCE_TEXT = 'type it, hear it. • /setup';

/**
 * Constroi o objeto de presenca do discord.js. Funcao PURA (sem Discord real,
 * sem efeitos) para ser testavel; o wiring em client.ts so a aplica no ready.
 *
 * Escolha de ActivityType.Listening: e o tipo cujo `name` RENDERIZA no cliente
 * ("Listening to type it, hear it. • /setup") e encaixa num bot de voz. Evita-se
 * ActivityType.Custom de proposito — em Custom o Discord mostra o campo `state`,
 * nao o `name`, pelo que o texto de marca apareceria em branco.
 *
 * Override: se config.presenceText estiver definido (env PRESENCE_TEXT), e usado
 * tal e qual; caso contrario cai no DEFAULT_PRESENCE_TEXT.
 */
export function buildPresence(config: AppConfig): PresenceData {
  const name = config.presenceText ?? DEFAULT_PRESENCE_TEXT;
  return {
    status: 'online',
    activities: [{ name, type: ActivityType.Listening }],
  };
}
