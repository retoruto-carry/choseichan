/**
 * Interaction response schemas for testing
 * Using a simple runtime validation approach without external dependencies
 */

// Base validation functions
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function hasProperty<K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<K, unknown> {
  return key in obj;
}

// Embed validation
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

function validateEmbed(embed: unknown): embed is DiscordEmbed {
  if (!isObject(embed)) return false;
  
  // Optional fields validation
  if ('title' in embed && typeof embed.title !== 'string') return false;
  if ('description' in embed && typeof embed.description !== 'string') return false;
  if ('color' in embed && typeof embed.color !== 'number') return false;
  
  if ('fields' in embed) {
    if (!isArray(embed.fields)) return false;
    for (const field of embed.fields) {
      if (!isObject(field)) return false;
      if (typeof field.name !== 'string' || typeof field.value !== 'string') return false;
      if ('inline' in field && typeof field.inline !== 'boolean') return false;
    }
  }
  
  return true;
}

// Modal component validation
export interface ModalComponent {
  type: number;
  components?: Array<{
    type: number;
    custom_id: string;
    label?: string;
    style?: number;
    placeholder?: string;
    value?: string;
    required?: boolean;
    min_length?: number;
    max_length?: number;
  }>;
}

// Component interfaces
export interface ButtonComponent {
  type: 2;
  style: number;
  label?: string;
  emoji?: {
    name: string;
  };
  custom_id: string;
  disabled?: boolean;
}

export interface ActionRow {
  type: 1;
  components: ButtonComponent[];
}

// Main interaction response interface
export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    flags?: number;
    embeds?: DiscordEmbed[];
    components?: ActionRow[];
    modal?: {
      custom_id: string;
      title: string;
      components: ModalComponent[];
    };
    // For modal responses
    title?: string;
    custom_id?: string;
  };
}

// Validation function with detailed error messages
export function validateInteractionResponse(
  value: unknown
): asserts value is InteractionResponse {
  if (!isObject(value)) {
    throw new Error('Response must be an object');
  }
  
  if (!hasProperty(value, 'type') || typeof value.type !== 'number') {
    throw new Error('Response must have a numeric type property');
  }
  
  if ('data' in value) {
    if (!isObject(value.data)) {
      throw new Error('Response data must be an object');
    }
    
    const data = value.data;
    
    if ('content' in data && typeof data.content !== 'string') {
      throw new Error('Response data.content must be a string');
    }
    
    if ('flags' in data && typeof data.flags !== 'number') {
      throw new Error('Response data.flags must be a number');
    }
    
    if ('embeds' in data) {
      if (!isArray(data.embeds)) {
        throw new Error('Response data.embeds must be an array');
      }
      
      for (let i = 0; i < data.embeds.length; i++) {
        if (!validateEmbed(data.embeds[i])) {
          throw new Error(`Invalid embed at index ${i}`);
        }
      }
    }
  }
}

// Helper function for tests
export function expectInteractionResponse(value: unknown): InteractionResponse {
  validateInteractionResponse(value);
  return value;
}