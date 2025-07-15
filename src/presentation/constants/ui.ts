/**
 * UI Constants
 *
 * UI関連の定数定義
 */

// Emoji mappings
export const STATUS_EMOJI = {
  yes: '✅',
  maybe: '❔',
  no: '❌',
} as const;

// Color mappings for embeds
export const EMBED_COLORS = {
  OPEN: 0x2ecc71, // Green
  CLOSED: 0xe74c3c, // Red
  INFO: 0x3498db, // Blue
  WARNING: 0xf39c12, // Orange
} as const;

// List display limits
export const LIST_LIMITS = {
  DEFAULT_SCHEDULE_LIMIT: 10,
  MAX_DISCORD_EMBED_FIELDS: 25,
} as const;
