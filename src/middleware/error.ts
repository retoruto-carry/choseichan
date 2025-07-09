import { Context, Next } from 'hono';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error in request:', error);
    
    if (error instanceof AppError && error.isOperational) {
      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ エラー: ${error.message}`,
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
    }
    
    // Generic error response
    return c.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ 予期しないエラーが発生しました。しばらく時間をおいて再度お試しください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    });
  }
};

export const validateInteraction = async (c: Context, next: Next) => {
  const body = await c.req.text();
  
  if (!body) {
    throw new AppError('リクエストボディが空です', 400);
  }
  
  try {
    const interaction = JSON.parse(body);
    c.set('interaction', interaction);
    c.set('body', body);
  } catch (error) {
    throw new AppError('無効なJSONフォーマットです', 400);
  }
  
  await next();
};