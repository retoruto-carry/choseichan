import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageServiceV2 } from '../../src/services/storage-v2';
import { Schedule } from '../../src/types/schedule';

describe('Deadline Index Management', () => {
  let mockKV: any;
  let storage: StorageServiceV2;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue({ keys: [] })
    };
    
    storage = new StorageServiceV2(mockKV, mockKV);
  });

  it('should clean up old deadline index when deadline is updated', async () => {
    const oldDeadline = new Date('2024-12-25 18:00');
    const newDeadline = new Date('2024-12-26 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule',
      title: 'Test Event',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: oldDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock existing schedule
    mockKV.get.mockImplementation((key: string) => {
      if (key === 'guild:guild123:schedule:test-schedule') {
        return Promise.resolve(JSON.stringify(existingSchedule));
      }
      return Promise.resolve(null);
    });
    
    // Update deadline
    const updatedSchedule = { ...existingSchedule, deadline: newDeadline };
    await storage.saveSchedule(updatedSchedule);
    
    // Verify old deadline index was deleted
    const oldTimestamp = Math.floor(oldDeadline.getTime() / 1000);
    expect(mockKV.delete).toHaveBeenCalledWith(
      `deadline:${oldTimestamp}:guild123:test-schedule`
    );
    
    // Verify new deadline index was created
    const newTimestamp = Math.floor(newDeadline.getTime() / 1000);
    expect(mockKV.put).toHaveBeenCalledWith(
      `deadline:${newTimestamp}:guild123:test-schedule`,
      'test-schedule',
      expect.objectContaining({
        expiration: expect.any(Number)
      })
    );
  });

  it('should clean up deadline index when deadline is removed', async () => {
    const oldDeadline = new Date('2024-12-25 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule-2',
      title: 'Test Event 2',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: oldDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock existing schedule
    mockKV.get.mockImplementation((key: string) => {
      if (key === 'guild:guild123:schedule:test-schedule-2') {
        return Promise.resolve(JSON.stringify(existingSchedule));
      }
      return Promise.resolve(null);
    });
    
    // Remove deadline
    const updatedSchedule = { ...existingSchedule, deadline: undefined };
    await storage.saveSchedule(updatedSchedule);
    
    // Verify old deadline index was deleted
    const oldTimestamp = Math.floor(oldDeadline.getTime() / 1000);
    expect(mockKV.delete).toHaveBeenCalledWith(
      `deadline:${oldTimestamp}:guild123:test-schedule-2`
    );
    
    // Verify no new deadline index was created
    expect(mockKV.put).not.toHaveBeenCalledWith(
      expect.stringMatching(/deadline:\d+:test-schedule-2$/),
      expect.any(String)
    );
  });

  it('should not delete deadline index if deadline remains the same', async () => {
    const deadline = new Date('2024-12-25 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule-3',
      title: 'Test Event 3',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock existing schedule
    mockKV.get.mockImplementation((key: string) => {
      if (key === 'guild:guild123:schedule:test-schedule-3') {
        return Promise.resolve(JSON.stringify(existingSchedule));
      }
      return Promise.resolve(null);
    });
    
    // Update without changing deadline
    const updatedSchedule = { ...existingSchedule, title: 'Updated Title' };
    await storage.saveSchedule(updatedSchedule);
    
    // Verify deadline index was NOT deleted
    expect(mockKV.delete).not.toHaveBeenCalledWith(
      expect.stringMatching(/deadline:\d+:test-schedule-3$/)
    );
    
    // Verify deadline index was still created (idempotent)
    const timestamp = Math.floor(deadline.getTime() / 1000);
    expect(mockKV.put).toHaveBeenCalledWith(
      `deadline:${timestamp}:guild123:test-schedule-3`,
      'test-schedule-3',
      expect.objectContaining({
        expiration: expect.any(Number)
      })
    );
  });

  it('should handle new schedule with deadline correctly', async () => {
    const deadline = new Date('2024-12-25 18:00');
    
    const newSchedule: Schedule = {
      id: 'test-schedule-4',
      title: 'New Event',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock no existing schedule
    mockKV.get.mockResolvedValue(null);
    
    await storage.saveSchedule(newSchedule);
    
    // Verify no deletion occurred
    expect(mockKV.delete).not.toHaveBeenCalled();
    
    // Verify deadline index was created
    const timestamp = Math.floor(deadline.getTime() / 1000);
    expect(mockKV.put).toHaveBeenCalledWith(
      `deadline:${timestamp}:guild123:test-schedule-4`,
      'test-schedule-4',
      expect.objectContaining({
        expiration: expect.any(Number)
      })
    );
  });
});