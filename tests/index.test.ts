import { describe, it, expect, beforeAll, vi } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import app from '../src/index';
import nacl from 'tweetnacl';

// Mock Discord signature
function createDiscordRequest(body: any, publicKey: string, privateKey: Uint8Array): Request {
  const timestamp = Date.now().toString();
  const bodyString = JSON.stringify(body);
  
  const message = Buffer.concat([
    Buffer.from(timestamp),
    Buffer.from(bodyString)
  ]);
  
  const signature = Buffer.from(
    nacl.sign.detached(message, privateKey)
  ).toString('hex');

  return new Request('http://localhost/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp
    },
    body: bodyString
  });
}

describe('Discord Bot', () => {
  let publicKey: string;
  let privateKey: Uint8Array;
  
  beforeAll(() => {
    // Generate test keys
    const keyPair = nacl.sign.keyPair();
    publicKey = Buffer.from(keyPair.publicKey).toString('hex');
    privateKey = keyPair.secretKey;
  });

  it('should respond to root endpoint', async () => {
    const env = {
      DISCORD_PUBLIC_KEY: publicKey,
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace
    };
    
    const res = await app.fetch(
      new Request('http://localhost/'),
      env
    );
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.service).toBe('Discord Choseisan Bot');
  });

  it('should respond to PING interaction', async () => {
    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;
    
    const env = {
      DISCORD_PUBLIC_KEY: publicKey,
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace
    };
    
    const interaction = {
      type: InteractionType.PING
    };
    
    const req = createDiscordRequest(interaction, publicKey, privateKey);
    const res = await app.fetch(req, env, mockExecutionContext);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(InteractionResponseType.PONG);
  });

  it('should reject invalid signatures', async () => {
    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;
    
    const wrongKeyPair = nacl.sign.keyPair();
    const wrongPublicKey = Buffer.from(wrongKeyPair.publicKey).toString('hex');
    
    const env = {
      DISCORD_PUBLIC_KEY: wrongPublicKey, // Different public key
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace
    };
    
    const interaction = {
      type: InteractionType.PING
    };
    
    // Request signed with original privateKey but validated with wrongPublicKey
    const req = createDiscordRequest(interaction, publicKey, privateKey);
    const res = await app.fetch(req, env, mockExecutionContext);
    
    expect(res.status).toBe(401);
  });

  it('should handle choseichan command without subcommand', async () => {
    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;
    
    const env = {
      DISCORD_PUBLIC_KEY: publicKey,
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace
    };
    
    const interaction = {
      type: InteractionType.APPLICATION_COMMAND,
      id: 'test_id',
      data: {
        id: 'cmd_id',
        name: 'choseichan'
      },
      token: 'test_token'
    };
    
    const req = createDiscordRequest(interaction, publicKey, privateKey);
    const res = await app.fetch(req, env, mockExecutionContext);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(json.data.content).toContain('サブコマンドを指定してください。');
    expect(json.data.flags).toBe(64); // Ephemeral
  });

  it('should handle button interactions', async () => {
    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;
    
    const env = {
      DISCORD_PUBLIC_KEY: publicKey,
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace
    };
    
    const interaction = {
      type: InteractionType.MESSAGE_COMPONENT,
      id: 'test_id',
      data: {
        custom_id: 'unknown_button', // Unknown button
        component_type: 2
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: []
      }
    };
    
    const req = createDiscordRequest(interaction, publicKey, privateKey);
    const res = await app.fetch(req, env, mockExecutionContext);
    
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(json.data.content).toBe('不明なボタンです。');
    expect(json.data.flags).toBe(64); // Ephemeral
  });
});