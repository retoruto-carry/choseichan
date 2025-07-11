/**
 * Test utility functions for better test practices
 */

import type { Schedule } from '../../src/types/schedule';
import type { StorageServiceV2 } from '../../src/services/storage-v2';
import type { Env } from '../../src/types/discord';

/**
 * Create a test schedule with default values
 */
export function createTestSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'test-schedule-id',
    title: 'Test Event',
    description: 'Test description',
    dates: [
      { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
      { id: 'date2', datetime: '2024-12-26T18:00:00Z' }
    ],
    createdBy: { id: 'user123', username: 'TestUser' },
    authorId: 'user123',
    channelId: 'test-channel',
    guildId: 'test-guild',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'open' as const,
    notificationSent: false,
    totalResponses: 0,
    ...overrides
  };
}

/**
 * Create a test storage service instance
 */
export async function createTestStorage(env: Env): Promise<StorageServiceV2> {
  const { StorageServiceV2 } = await import('../../src/services/storage-v2');
  return new StorageServiceV2(env);
}

/**
 * Extract schedule ID from response components
 */
export function extractScheduleIdFromResponse(data: any): string | undefined {
  const buttonRow = data.data?.components?.[0];
  const buttons = buttonRow?.components || [];
  const respondButton = buttons.find((btn: any) => btn.custom_id?.startsWith('respond:'));
  return respondButton?.custom_id?.split(':')[1];
}

/**
 * Type guard for checking if a value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Assert that a value is defined, throw error otherwise
 */
export function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(`${name} is null or undefined`);
  }
}