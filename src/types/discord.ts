import { InteractionType, InteractionResponseType } from 'discord-interactions';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
  SCHEDULES: KVNamespace;
  RESPONSES: KVNamespace;
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
    embeds: any[];
    message_reference?: {
      message_id: string;
    };
  };
}

export interface InteractionResponse {
  type: InteractionResponseType;
  data?: any;
}