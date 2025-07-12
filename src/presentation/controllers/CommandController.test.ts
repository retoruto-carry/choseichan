import { InteractionResponseType, InteractionType } from 'discord-interactions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '../../../tests/helpers/d1-database';
import {
  applyMigrations,
  closeTestDatabase,
  createTestD1Database,
  createTestEnv,
} from '../../../tests/helpers/d1-database';
import { expectInteractionResponse } from '../../../tests/helpers/interaction-schemas';
import type { CommandInteraction, Env } from '../../infrastructure/types/discord';
import { createCommandController } from './CommandController';

describe('Chouseichan Commands', () => {
  let db: D1Database;
  let env: Env;

  beforeEach(async () => {
    db = createTestD1Database();
    await applyMigrations(db);
    env = createTestEnv(db);
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should show modal for schedule creation', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'chouseichan',
        options: [
          {
            name: 'create',
            type: 1,
            value: '',
          },
        ],
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001',
        },
        roles: [],
      },
      token: 'test_token',
    };

    const response = await createCommandController(env).handleChouseichanCommand(interaction, env);
    const data = expectInteractionResponse(await response.json());

    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.MODAL);
    expect(data.data?.title).toBe('日程調整を作成');
    expect(data.data?.components).toHaveLength(4);
    expect(data.data?.custom_id).toBe('modal:create_schedule');
  });

  it('should list schedules in channel', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'chouseichan',
        options: [
          {
            name: 'list',
            value: '',
            type: 1,
          },
        ],
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001',
        },
        roles: [],
      },
      token: 'test_token',
    };

    const response = await createCommandController(env).handleChouseichanCommand(interaction, env);
    const data = expectInteractionResponse(await response.json());

    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.flags).toBe(64);
  });
});
