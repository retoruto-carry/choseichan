/**
 * Discord API レスポンス用の型定義
 * data: any の代替として使用
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: DiscordEmbedFooter;
  timestamp?: string;
  author?: DiscordEmbedAuthor;
  thumbnail?: DiscordEmbedImage;
  image?: DiscordEmbedImage;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbedAuthor {
  name: string;
  icon_url?: string;
  url?: string;
}

export interface DiscordEmbedImage {
  url: string;
  height?: number;
  width?: number;
}

export interface DiscordComponent {
  type: number;
  components?: DiscordComponent[];
  style?: number;
  label?: string;
  emoji?: DiscordEmoji;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options?: DiscordSelectOption[];
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
}

export interface DiscordSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: DiscordEmoji;
  default?: boolean;
}

export interface DiscordEmoji {
  id?: string;
  name: string;
  animated?: boolean;
}

export interface DiscordMessageData {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  flags?: number;
  ephemeral?: boolean;
}

export interface DiscordModalData {
  custom_id: string;
  title: string;
  components: DiscordComponent[];
}

export interface DiscordInteractionResponse {
  type: number;
  data?: DiscordMessageData | DiscordModalData;
}

/**
 * メッセージ参照用
 */
export interface DiscordMessageReference {
  message_id: string;
  channel_id?: string;
  guild_id?: string;
}

/**
 * Webhook用のメッセージデータ
 */
export interface DiscordWebhookMessageData {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  message_reference?: DiscordMessageReference;
}

/**
 * ボタンスタイル定数
 */
export const BUTTON_STYLES = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3,
  DANGER: 4,
  LINK: 5
} as const;

/**
 * コンポーネントタイプ定数
 */
export const COMPONENT_TYPES = {
  ACTION_ROW: 1,
  BUTTON: 2,
  SELECT_MENU: 3,
  TEXT_INPUT: 4
} as const;

/**
 * テキスト入力スタイル定数
 */
export const TEXT_INPUT_STYLES = {
  SHORT: 1,
  PARAGRAPH: 2
} as const;

/**
 * 型ガード関数
 */
export function isDiscordEmbed(obj: any): obj is DiscordEmbed {
  return typeof obj === 'object' && obj !== null;
}

export function isDiscordComponent(obj: any): obj is DiscordComponent {
  return typeof obj === 'object' && obj !== null && typeof obj.type === 'number';
}

export function isDiscordMessageData(obj: any): obj is DiscordMessageData {
  return typeof obj === 'object' && obj !== null;
}

/**
 * ヘルパー関数
 */
export class DiscordComponentBuilder {
  /**
   * ボタン作成ヘルパー
   */
  static createButton(
    customId: string,
    label: string,
    style: number = BUTTON_STYLES.SECONDARY,
    emoji?: DiscordEmoji,
    disabled?: boolean
  ): DiscordComponent {
    return {
      type: COMPONENT_TYPES.BUTTON,
      custom_id: customId,
      label,
      style,
      emoji,
      disabled
    };
  }

  /**
   * セレクトメニュー作成ヘルパー
   */
  static createSelectMenu(
    customId: string,
    placeholder: string,
    options: DiscordSelectOption[],
    minValues?: number,
    maxValues?: number
  ): DiscordComponent {
    return {
      type: COMPONENT_TYPES.SELECT_MENU,
      custom_id: customId,
      placeholder,
      options,
      min_values: minValues,
      max_values: maxValues
    };
  }

  /**
   * テキスト入力作成ヘルパー
   */
  static createTextInput(
    customId: string,
    label: string,
    style: number = TEXT_INPUT_STYLES.SHORT,
    placeholder?: string,
    required?: boolean,
    minLength?: number,
    maxLength?: number,
    value?: string
  ): DiscordComponent {
    return {
      type: COMPONENT_TYPES.TEXT_INPUT,
      custom_id: customId,
      label,
      style,
      placeholder,
      required,
      min_length: minLength,
      max_length: maxLength,
      value
    };
  }

  /**
   * アクション行作成ヘルパー
   */
  static createActionRow(...components: DiscordComponent[]): DiscordComponent {
    return {
      type: COMPONENT_TYPES.ACTION_ROW,
      components
    };
  }
}

/**
 * エンベッド作成ヘルパー
 */
export class DiscordEmbedBuilder {
  private embed: DiscordEmbed = {};

  constructor() {}

  setTitle(title: string): this {
    this.embed.title = title;
    return this;
  }

  setDescription(description: string): this {
    this.embed.description = description;
    return this;
  }

  setColor(color: number): this {
    this.embed.color = color;
    return this;
  }

  addField(name: string, value: string, inline?: boolean): this {
    if (!this.embed.fields) {
      this.embed.fields = [];
    }
    this.embed.fields.push({ name, value, inline });
    return this;
  }

  setFooter(text: string, iconUrl?: string): this {
    this.embed.footer = { text, icon_url: iconUrl };
    return this;
  }

  setTimestamp(timestamp?: string): this {
    this.embed.timestamp = timestamp || new Date().toISOString();
    return this;
  }

  setAuthor(name: string, iconUrl?: string, url?: string): this {
    this.embed.author = { name, icon_url: iconUrl, url };
    return this;
  }

  setThumbnail(url: string): this {
    this.embed.thumbnail = { url };
    return this;
  }

  setImage(url: string): this {
    this.embed.image = { url };
    return this;
  }

  build(): DiscordEmbed {
    return { ...this.embed };
  }
}