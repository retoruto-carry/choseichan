import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { handleChoseichanCommand } from '../src/handlers/commands';
import { CommandInteraction, Env } from '../src/types/discord';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';
import { expectInteractionResponse } from './helpers/interaction-schemas';

describe('Choseichan Commands', () => {
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
        name: 'choseichan',
        options: [{
          name: 'create',
          type: 1,
          value: ''
        }]
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleChoseichanCommand(interaction, env);
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
        name: 'choseichan',
        options: [{
          name: 'list',
        value: '',
          type: 1
        }]
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleChoseichanCommand(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.flags).toBe(64);
  });
});