import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { DiscordEmbed, DiscordComponent } from './discord-api';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
  CRON_SECRET?: string;
  ctx?: ExecutionContext;
  // Rate limiting for cron jobs (optional)
  REMINDER_BATCH_SIZE?: string;
  REMINDER_BATCH_DELAY?: string;
  // D1 Database
  DB: D1Database;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface CommandInteraction {
  id: string;
  type: InteractionType;
  data: {
    id: string;
    name: string;
    options?: CommandOption[];
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: DiscordUser;
    roles: string[];
  };
  user?: DiscordUser;
  token: string;
}

export interface CommandOption {
  name: string;
  type: number;
  value: string | number | boolean;
  options?: CommandOption[];
}

export interface ButtonInteraction {
  id: string;
  type: InteractionType;
  data: {
    custom_id: string;
    component_type: number;
    values?: string[]; // For select menu interactions
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: DiscordUser;
    roles: string[];
  };
  user?: DiscordUser;
  token: string;
  message?: {
    id: string;
    embeds: DiscordEmbed[];
    components?: DiscordComponent[];
    message_reference?: {
      message_id: string;
    };
  };
}

export interface ModalInteraction {
  id: string;
  type: InteractionType;
  data: {
    custom_id: string;
    components: Array<{
      type: number;
      components: Array<{
        type: number;
        custom_id: string;
        value: string;
      }>;
    }>;
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: DiscordUser;
    roles: string[];
  };
  user?: DiscordUser;
  token: string;
  message?: {
    id: string;
    embeds: DiscordEmbed[];
    components?: DiscordComponent[];
    message_reference?: {
      message_id: string;
    };
  };
}

export interface InteractionResponse {
  type: InteractionResponseType;
  data?: import('./discord-api').DiscordMessageData | import('./discord-api').DiscordModalData;
}