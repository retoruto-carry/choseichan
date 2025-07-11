import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageServiceV2 as StorageService } from '../src/services/storage-v2';
import { Schedule, Response, ScheduleSummary } from '../src/types/schedule';
import { generateId } from '../src/utils/id';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';
import { createTestSchedule, createTestStorage } from './helpers/test-utils';


describe('Response Management', () => {
  let db: D1Database;
  let storage: StorageService;
  let testSchedule: Schedule;
  let mockEnv: any;
  
  beforeEach(async () => {
    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);
    
    mockEnv = createTestEnv(db);
    storage = await createTestStorage(mockEnv);

    // Create test schedule using helper with unique ID
    testSchedule = createTestSchedule({
      id: generateId(),
      dates: [
        { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
        { id: 'date2', datetime: '2024-12-26T18:00:00Z' },
        { id: 'date3', datetime: '2024-12-27T19:00:00Z' }
      ],
      authorId: 'creator_id',
      createdBy: { id: 'creator_id', username: 'Creator' }
    });
    
    await storage.saveSchedule(testSchedule);
  });
  
  afterEach(() => {
    closeTestDatabase(db);
  });
  

  it('should save and retrieve user response', async () => {
    // First verify the schedule was saved
    const savedSchedule = await storage.getSchedule(testSchedule.id, 'test-guild');
    expect(savedSchedule).toBeDefined();
    expect(savedSchedule?.id).toBe(testSchedule.id);
    
    const userResponse: Response = {
      scheduleId: testSchedule.id,
      userId: 'user1',
      userName: 'User One',
      responses: [
        { dateId: 'date1', status: 'yes' },
        { dateId: 'date2', status: 'no' },
        { dateId: 'date3', status: 'maybe' }
      ],
      comment: 'I can only make it on the 25th',
      updatedAt: new Date()
    };

    await storage.saveResponse(userResponse, 'test-guild');
    const retrieved = await storage.getResponse(testSchedule.id, 'user1', 'test-guild');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.userName).toBe('User One');
    expect(retrieved?.responses).toHaveLength(3);
    expect(retrieved?.responses[0].status).toBe('yes');
    expect(retrieved?.comment).toBe('I can only make it on the 25th');
  });

  it('should update existing response', async () => {
    const initialResponse: Response = {
      scheduleId: testSchedule.id,
      userId: 'user1',
      userName: 'User One',
      responses: [
        { dateId: 'date1', status: 'yes' }
      ],
      updatedAt: new Date()
    };

    await storage.saveResponse(initialResponse, 'test-guild');

    // Update response
    const updatedResponse: Response = {
      ...initialResponse,
      responses: [
        { dateId: 'date1', status: 'no' },
        { dateId: 'date2', status: 'yes' }
      ],
      comment: 'Changed my mind',
      updatedAt: new Date()
    };

    await storage.saveResponse(updatedResponse, 'test-guild');
    const retrieved = await storage.getResponse(testSchedule.id, 'user1', 'test-guild');
    
    expect(retrieved?.responses).toHaveLength(2);
    expect(retrieved?.responses[0].status).toBe('no');
    expect(retrieved?.comment).toBe('Changed my mind');
  });

  it('should calculate schedule summary correctly', async () => {
    // Add multiple responses
    const responses: Response[] = [
      {
        scheduleId: testSchedule.id,
        userId: 'user1',
        userName: 'User One',
        responses: [
          { dateId: 'date1', status: 'yes' },
          { dateId: 'date2', status: 'no' },
          { dateId: 'date3', status: 'maybe' }
        ],
        updatedAt: new Date()
      },
      {
        scheduleId: testSchedule.id,
        userId: 'user2',
        userName: 'User Two',
        responses: [
          { dateId: 'date1', status: 'yes' },
          { dateId: 'date2', status: 'yes' },
          { dateId: 'date3', status: 'no' }
        ],
        updatedAt: new Date()
      },
      {
        scheduleId: testSchedule.id,
        userId: 'user3',
        userName: 'User Three',
        responses: [
          { dateId: 'date1', status: 'maybe' },
          { dateId: 'date2', status: 'yes' },
          { dateId: 'date3', status: 'yes' }
        ],
        updatedAt: new Date()
      }
    ];

    for (const response of responses) {
      await storage.saveResponse(response, 'test-guild');
    }

    const summary = await storage.getScheduleSummary(testSchedule.id, 'test-guild');
    
    expect(summary).toBeDefined();
    expect(summary?.userResponses).toHaveLength(3);
    
    // Check response counts
    expect(summary?.responseCounts['date1']).toEqual({
      yes: 2,
      maybe: 1,
      no: 0,
      total: 3
    });
    
    expect(summary?.responseCounts['date2']).toEqual({
      yes: 2,
      maybe: 0,
      no: 1,
      total: 3
    });
    
    expect(summary?.responseCounts['date3']).toEqual({
      yes: 1,
      maybe: 1,
      no: 1,
      total: 3
    });
    
    // Best date should be date1 or date2 (both have 2 yes votes)
    expect(['date1', 'date2']).toContain(summary?.bestDateId);
  });

  it('should handle empty responses', async () => {
    const summary = await storage.getScheduleSummary(testSchedule.id, 'test-guild');
    
    expect(summary).toBeDefined();
    expect(summary?.userResponses).toHaveLength(0);
    
    // All counts should be 0
    for (const date of testSchedule.dates) {
      expect(summary?.responseCounts[date.id]).toEqual({
        yes: 0,
        maybe: 0,
        no: 0,
        total: 0
      });
    }
  });

  it('should list responses by schedule', async () => {
    const responses: Response[] = [
      {
        scheduleId: testSchedule.id,
        userId: 'user1',
        userName: 'Alice',
        responses: [{ dateId: 'date1', status: 'yes' }],
        updatedAt: new Date()
      },
      {
        scheduleId: testSchedule.id,
        userId: 'user2',
        userName: 'Bob',
        responses: [{ dateId: 'date1', status: 'no' }],
        updatedAt: new Date()
      }
    ];

    for (const response of responses) {
      await storage.saveResponse(response, 'test-guild');
    }

    const list = await storage.listResponsesBySchedule(testSchedule.id, 'test-guild');
    
    expect(list).toHaveLength(2);
    // Should be sorted by userName
    expect(list[0].userName).toBe('Alice');
    expect(list[1].userName).toBe('Bob');
  });

  it('should delete all responses when schedule is deleted', async () => {
    // Add responses
    await storage.saveResponse({
      scheduleId: testSchedule.id,
      userId: 'user1',
      userName: 'User One',
      responses: [{ dateId: 'date1', status: 'yes' }],
      updatedAt: new Date()
    }, 'test-guild');

    // Delete schedule
    const guildId = 'test-guild';
    await storage.deleteSchedule(testSchedule.id, guildId);
    
    // Check that schedule is deleted
    const schedule = await storage.getSchedule(testSchedule.id, guildId);
    expect(schedule).toBeNull();
    
    // Check that responses are deleted
    const responses = await storage.listResponsesBySchedule(testSchedule.id, guildId);
    expect(responses).toHaveLength(0);
  });
});