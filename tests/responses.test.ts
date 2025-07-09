import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../src/services/storage';
import { Schedule, Response, ScheduleSummary } from '../src/types/schedule';
import { generateId } from '../src/utils/id';

// Mock KVNamespace
const createMockKVNamespace = () => {
  const storage = new Map();
  return {
    get: vi.fn(async (key: string) => storage.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async (options: { prefix: string }) => {
      const keys = Array.from(storage.keys())
        .filter(k => k.startsWith(options.prefix))
        .map(name => ({ name, metadata: {} }));
      return { keys };
    })
  } as unknown as KVNamespace;
};

describe('Response Management', () => {
  let storage: StorageService;
  let testSchedule: Schedule;
  
  beforeEach(async () => {
    const schedules = createMockKVNamespace();
    const responses = createMockKVNamespace();
    storage = new StorageService(schedules, responses);

    // Create test schedule
    testSchedule = {
      id: 'test_schedule_id',
      title: 'Test Event',
      dates: [
        { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
        { id: 'date2', datetime: '2024-12-26T18:00:00Z' },
        { id: 'date3', datetime: '2024-12-27T19:00:00Z' }
      ],
      createdBy: { id: 'creator_id', username: 'Creator' },
      channelId: 'test_channel',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };
    
    await storage.saveSchedule(testSchedule);
  });

  it('should save and retrieve user response', async () => {
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

    await storage.saveResponse(userResponse);
    const retrieved = await storage.getResponse(testSchedule.id, 'user1');
    
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

    await storage.saveResponse(initialResponse);

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

    await storage.saveResponse(updatedResponse);
    const retrieved = await storage.getResponse(testSchedule.id, 'user1');
    
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
      await storage.saveResponse(response);
    }

    const summary = await storage.getScheduleSummary(testSchedule.id);
    
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
    const summary = await storage.getScheduleSummary(testSchedule.id);
    
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
      await storage.saveResponse(response);
    }

    const list = await storage.listResponsesBySchedule(testSchedule.id);
    
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
    });

    // Delete schedule
    await storage.deleteSchedule(testSchedule.id);
    
    // Check that schedule is deleted
    const schedule = await storage.getSchedule(testSchedule.id);
    expect(schedule).toBeNull();
    
    // Check that responses are deleted
    const responses = await storage.listResponsesBySchedule(testSchedule.id);
    expect(responses).toHaveLength(0);
  });
});