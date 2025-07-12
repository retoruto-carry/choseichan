/**
 * Discord API Interfaces
 *
 * Discord APIと連携するためのインターフェース定義
 */

// Discord API Types
export interface DiscordUser {
  readonly id: string;
  readonly username: string;
  readonly discriminator?: string;
  readonly avatar?: string;
  readonly global_name?: string;
}

export interface DiscordMember {
  readonly user: DiscordUser;
  readonly nick?: string;
  readonly roles: string[];
  readonly joined_at: string;
  readonly premium_since?: string;
  readonly pending?: boolean;
  readonly permissions?: string;
}

export interface DiscordGuild {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly owner_id: string;
  readonly permissions?: string;
}

export interface DiscordChannel {
  readonly id: string;
  readonly type: number;
  readonly guild_id?: string;
  readonly name?: string;
  readonly topic?: string;
  readonly nsfw?: boolean;
  readonly parent_id?: string;
}

// Discord Interaction Types
export interface DiscordInteraction {
  readonly id: string;
  readonly type: number;
  readonly application_id: string;
  readonly token: string;
  readonly version: number;
  readonly guild_id?: string;
  readonly channel_id?: string;
  readonly member?: DiscordMember;
  readonly user?: DiscordUser;
  readonly locale?: string;
  readonly guild_locale?: string;
}

export interface SlashCommandInteraction extends DiscordInteraction {
  readonly type: 2; // APPLICATION_COMMAND
  readonly data: {
    readonly id: string;
    readonly name: string;
    readonly type: number;
    readonly options?: SlashCommandOption[];
  };
}

export interface ButtonInteraction extends DiscordInteraction {
  readonly type: 3; // MESSAGE_COMPONENT
  readonly data: {
    readonly custom_id: string;
    readonly component_type: 2; // BUTTON
  };
  readonly message: DiscordMessage;
}

export interface ModalInteraction extends DiscordInteraction {
  readonly type: 5; // MODAL_SUBMIT
  readonly data: {
    readonly custom_id: string;
    readonly components: ModalComponent[];
  };
}

// Discord Component Types
export interface SlashCommandOption {
  readonly type: number;
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
  readonly choices?: SlashCommandChoice[];
  readonly options?: SlashCommandOption[];
  readonly value?: string | number | boolean;
}

export interface SlashCommandChoice {
  readonly name: string;
  readonly value: string | number;
}

export interface ModalComponent {
  readonly type: number;
  readonly components: ActionRowComponent[];
}

export interface ActionRowComponent {
  readonly type: number;
  readonly custom_id: string;
  readonly value?: string;
  readonly label?: string;
  readonly style?: number;
  readonly placeholder?: string;
  readonly min_length?: number;
  readonly max_length?: number;
  readonly required?: boolean;
}

// Discord Message Types
export interface DiscordMessage {
  readonly id: string;
  readonly channel_id: string;
  readonly guild_id?: string;
  readonly author: DiscordUser;
  readonly content: string;
  readonly timestamp: string;
  readonly edited_timestamp?: string;
  readonly embeds: DiscordEmbed[];
  readonly components?: DiscordComponent[];
  readonly attachments: DiscordAttachment[];
  readonly pinned: boolean;
  readonly type: number;
}

export interface DiscordEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly timestamp?: string;
  readonly color?: number;
  readonly footer?: {
    text: string;
    icon_url?: string;
  };
  readonly image?: {
    url: string;
    height?: number;
    width?: number;
  };
  readonly thumbnail?: {
    url: string;
    height?: number;
    width?: number;
  };
  readonly author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  readonly fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

export interface DiscordComponent {
  readonly type: number;
  readonly style?: number;
  readonly label?: string;
  readonly emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
  readonly custom_id?: string;
  readonly url?: string;
  readonly disabled?: boolean;
  readonly components?: DiscordComponent[];
}

export interface DiscordAttachment {
  readonly id: string;
  readonly filename: string;
  readonly size: number;
  readonly url: string;
  readonly proxy_url: string;
  readonly content_type?: string;
  readonly height?: number;
  readonly width?: number;
  readonly ephemeral?: boolean;
}

// Discord API Response Types
export interface DiscordInteractionResponse {
  readonly type: number;
  readonly data?: {
    readonly content?: string;
    readonly embeds?: DiscordEmbed[];
    readonly components?: DiscordComponent[];
    readonly flags?: number;
    readonly tts?: boolean;
    readonly allowed_mentions?: {
      parse?: string[];
      users?: string[];
      roles?: string[];
      replied_user?: boolean;
    };
  };
}

// Environment Configuration
export interface DiscordEnvironment {
  readonly DISCORD_APPLICATION_ID: string;
  readonly DISCORD_PUBLIC_KEY: string;
  readonly DISCORD_TOKEN?: string;
  readonly DISCORD_CLIENT_ID?: string;
  readonly DISCORD_CLIENT_SECRET?: string;
}

// API Service Interface
export interface DiscordApiService {
  sendWebhookMessage(webhookUrl: string, message: DiscordMessage): Promise<Response>;
  updateMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
    botToken: string
  ): Promise<Response>;
  deleteMessage(channelId: string, messageId: string, botToken: string): Promise<Response>;
  getGuildMember(guildId: string, userId: string, botToken: string): Promise<DiscordMember>;
  createInteractionResponse(response: DiscordInteractionResponse): DiscordInteractionResponse;
}

// Error Types
export interface DiscordApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly response?: Response;
}

// Webhook Types
export interface WebhookMessage {
  readonly content?: string;
  readonly username?: string;
  readonly avatar_url?: string;
  readonly tts?: boolean;
  readonly embeds?: DiscordEmbed[];
  readonly components?: DiscordComponent[];
  readonly allowed_mentions?: {
    parse?: string[];
    users?: string[];
    roles?: string[];
  };
  readonly flags?: number;
}
