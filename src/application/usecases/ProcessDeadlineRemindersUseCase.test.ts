import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleResponse } from '../dto/ScheduleDto';
import type { IEnvironmentPort } from '../ports/EnvironmentPort';
import type { ILogger } from '../ports/LoggerPort';
import { ProcessDeadlineRemindersUseCase } from './ProcessDeadlineRemindersUseCase';

describe('ProcessDeadlineRemindersUseCase', () => {
  let useCase: ProcessDeadlineRemindersUseCase;
  let mockLogger: ILogger;
  let mockDeadlineReminderUseCase: any;
  let mockGetScheduleUseCase: any;
  let mockGetScheduleSummaryUseCase: any;
  let mockProcessReminderUseCase: any;
  let mockCloseScheduleUseCase: any;
  let mockNotificationService: any;
  let mockEnv: IEnvironmentPort;

  const mockSchedule: ScheduleResponse = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    messageId: 'msg-123',
    title: 'Test Schedule',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' },
    ],
    deadline: '2024-01-19T00:00:00.000Z',
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'open',
    notificationSent: false,
    totalResponses: 5,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockSummary = {
    scheduleId: 'schedule-123',
    totalResponseUsers: 5,
    responsesByDate: {
      'date-1': {
        yes: 3,
        maybe: 1,
        no: 1,
        total: 5,
      },
      'date-2': {
        yes: 2,
        maybe: 2,
        no: 1,
        total: 5,
      },
    },
  };

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Setup mock environment
    mockEnv = {
      get: vi.fn((key: string) => {
        const env: Record<string, string> = {
          DISCORD_TOKEN: 'test_token',
          DISCORD_APPLICATION_ID: 'test_app',
          REMINDER_BATCH_SIZE: '10',
          REMINDER_BATCH_DELAY: '50',
        };
        return env[key];
      }),
      getOptional: vi.fn((key: string) => {
        const env: Record<string, string> = {
          REMINDER_BATCH_SIZE: '10',
          REMINDER_BATCH_DELAY: '50',
        };
        return env[key];
      }),
      getRequired: vi.fn(),
    };

    // Setup mock use cases
    mockDeadlineReminderUseCase = {
      checkDeadlines: vi.fn(),
    } as any;

    mockGetScheduleUseCase = {
      execute: vi.fn(),
    } as any;

    mockGetScheduleSummaryUseCase = {
      execute: vi.fn(),
    } as any;

    mockProcessReminderUseCase = {
      markReminderSent: vi.fn(),
    } as any;

    mockCloseScheduleUseCase = {
      execute: vi.fn(),
    } as any;

    mockNotificationService = {
      sendDeadlineReminder: vi.fn(),
      sendSummaryMessage: vi.fn(),
      sendPRMessage: vi.fn(),
      updateMainMessage: vi.fn(),
    } as any;

    useCase = new ProcessDeadlineRemindersUseCase(
      mockLogger,
      mockDeadlineReminderUseCase as any,
      mockGetScheduleUseCase as any,
      mockGetScheduleSummaryUseCase as any,
      mockProcessReminderUseCase as any,
      mockCloseScheduleUseCase as any,
      mockNotificationService as any,
      mockEnv
    );
  });

  describe('execute', () => {
    it('should process reminders and closures successfully', async () => {
      // Setup mock responses
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [
            {
              scheduleId: 'schedule-123',
              guildId: 'guild-123',
              reminderType: '1d',
              message: '締切まで1日',
            },
            {
              scheduleId: 'schedule-456',
              guildId: 'guild-123',
              reminderType: '8h',
              message: '締切まで8時間',
            },
          ],
          justClosed: [{ scheduleId: 'schedule-789', guildId: 'guild-123' }],
        },
      });

      vi.mocked(mockGetScheduleUseCase.execute).mockResolvedValue({
        success: true,
        schedule: mockSchedule,
      });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      vi.mocked(mockProcessReminderUseCase.markReminderSent).mockResolvedValue({
        success: true,
      });

      vi.mocked(mockCloseScheduleUseCase.execute).mockResolvedValue({
        success: true,
      });

      // Execute
      await useCase.execute();

      // Verify deadline check
      expect(mockDeadlineReminderUseCase.checkDeadlines).toHaveBeenCalled();

      // Verify reminders were sent
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
        mockSchedule,
        '締切まで1日'
      );

      // Verify reminder status was updated
      expect(mockProcessReminderUseCase.markReminderSent).toHaveBeenCalledTimes(2);
      expect(mockProcessReminderUseCase.markReminderSent).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        reminderType: '1d',
      });

      // Verify closure processing
      expect(mockCloseScheduleUseCase.execute).toHaveBeenCalledWith({
        scheduleId: 'schedule-789',
        guildId: 'guild-123',
        editorUserId: 'system',
      });

      // Verify closure notifications
      expect(mockNotificationService.updateMainMessage).toHaveBeenCalledWith(
        'schedule-789',
        'guild-123'
      );
      expect(mockNotificationService.sendSummaryMessage).toHaveBeenCalledWith(
        'schedule-789',
        'guild-123'
      );
      // 一時的にPR通知機能をオフのため、テストもスキップ
      // expect(mockNotificationService.sendPRMessage).toHaveBeenCalledWith(mockSchedule);
    });

    it('should skip processing when missing Discord credentials', async () => {
      // Mock environment without credentials
      const envWithoutCreds: IEnvironmentPort = {
        get: vi.fn((key: string) => {
          if (key === 'DISCORD_TOKEN' || key === 'DISCORD_APPLICATION_ID') {
            return undefined;
          }
          return 'test_value';
        }),
        getOptional: vi.fn(),
        getRequired: vi.fn(),
      };

      const useCaseWithoutCreds = new ProcessDeadlineRemindersUseCase(
        mockLogger,
        mockDeadlineReminderUseCase as any,
        mockGetScheduleUseCase as any,
        mockGetScheduleSummaryUseCase as any,
        mockProcessReminderUseCase as any,
        mockCloseScheduleUseCase as any,
        mockNotificationService as any,
        envWithoutCreds
      );

      await useCaseWithoutCreds.execute();

      // Should not call any methods
      expect(mockDeadlineReminderUseCase.checkDeadlines).not.toHaveBeenCalled();
      expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [],
          justClosed: [],
        },
      });

      await useCase.execute();

      // Should check deadlines but not send any notifications
      expect(mockDeadlineReminderUseCase.checkDeadlines).toHaveBeenCalled();
      expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
      expect(mockCloseScheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('should handle deadline check failure', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: false,
        errors: ['Database error'],
      });

      await useCase.execute();

      // Should not proceed with notifications
      expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
      expect(mockCloseScheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('should continue processing other reminders when one fails', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [
            {
              scheduleId: 'schedule-123',
              guildId: 'guild-123',
              reminderType: '1d',
              message: '締切まで1日',
            },
            {
              scheduleId: 'schedule-456',
              guildId: 'guild-123',
              reminderType: '8h',
              message: '締切まで8時間',
            },
          ],
          justClosed: [],
        },
      });

      // First schedule fails, second succeeds
      vi.mocked(mockGetScheduleUseCase.execute)
        .mockResolvedValueOnce({
          success: false,
          errors: ['Schedule not found'],
        })
        .mockResolvedValueOnce({
          success: true,
          schedule: mockSchedule,
        });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      await useCase.execute();

      // Should send reminder for the second schedule
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
        mockSchedule,
        '締切まで8時間'
      );
    });

    it('should continue processing when summary fetch fails', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [
            {
              scheduleId: 'schedule-123',
              guildId: 'guild-123',
              reminderType: '1d',
              message: '締切まで1日',
            },
          ],
          justClosed: [],
        },
      });

      vi.mocked(mockGetScheduleUseCase.execute).mockResolvedValue({
        success: true,
        schedule: mockSchedule,
      });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: false,
        errors: ['Summary not found'],
      });

      await useCase.execute();

      // Should still send reminder
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
        mockSchedule,
        '締切まで1日'
      );
    });

    it('should handle notification service errors gracefully', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [
            {
              scheduleId: 'schedule-123',
              guildId: 'guild-123',
              reminderType: '1d',
              message: '締切まで1日',
            },
          ],
          justClosed: [],
        },
      });

      vi.mocked(mockGetScheduleUseCase.execute).mockResolvedValue({
        success: true,
        schedule: mockSchedule,
      });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      vi.mocked(mockProcessReminderUseCase.markReminderSent).mockResolvedValue({
        success: true,
      });

      vi.mocked(mockNotificationService.sendDeadlineReminder).mockRejectedValueOnce(
        new Error('Discord API error')
      );

      // Should not throw, error is caught
      await expect(useCase.execute()).resolves.not.toThrow();
    });

    it('should use custom batch configuration', async () => {
      const customEnv: IEnvironmentPort = {
        get: vi.fn((key: string) => {
          const env: Record<string, string> = {
            DISCORD_TOKEN: 'test_token',
            DISCORD_APPLICATION_ID: 'test_app',
          };
          return env[key];
        }),
        getOptional: vi.fn((key: string) => {
          const env: Record<string, string> = {
            REMINDER_BATCH_SIZE: '5',
            REMINDER_BATCH_DELAY: '200',
          };
          return env[key];
        }),
        getRequired: vi.fn(),
      };

      const customUseCase = new ProcessDeadlineRemindersUseCase(
        mockLogger,
        mockDeadlineReminderUseCase as any,
        mockGetScheduleUseCase as any,
        mockGetScheduleSummaryUseCase as any,
        mockProcessReminderUseCase as any,
        mockCloseScheduleUseCase as any,
        mockNotificationService as any,
        customEnv
      );

      // Create many reminders to test batching
      const manyReminders = Array.from({ length: 12 }, (_, i) => ({
        scheduleId: `schedule-${i}`,
        guildId: 'guild-123',
        reminderType: '1d',
        message: '締切まで1日',
      }));

      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: manyReminders,
          justClosed: [],
        },
      });

      vi.mocked(mockGetScheduleUseCase.execute).mockResolvedValue({
        success: true,
        schedule: mockSchedule,
      });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      vi.mocked(mockProcessReminderUseCase.markReminderSent).mockResolvedValue({
        success: true,
      });

      await customUseCase.execute();

      // All reminders should be processed
      expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(12);
    });

    it('should handle closure failures gracefully', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [],
          justClosed: [{ scheduleId: 'schedule-789', guildId: 'guild-123' }],
        },
      });

      vi.mocked(mockCloseScheduleUseCase.execute).mockResolvedValueOnce({
        success: false,
        errors: ['Cannot close schedule'],
      });

      await useCase.execute();

      // Should not send closure notifications
      expect(mockNotificationService.sendSummaryMessage).not.toHaveBeenCalled();
      expect(mockNotificationService.sendPRMessage).not.toHaveBeenCalled();
    });

    it('should skip closure notification when schedule fetch fails', async () => {
      vi.mocked(mockDeadlineReminderUseCase.checkDeadlines).mockResolvedValueOnce({
        success: true,
        result: {
          upcomingReminders: [],
          justClosed: [{ scheduleId: 'schedule-789', guildId: 'guild-123' }],
        },
      });

      vi.mocked(mockCloseScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
      });

      vi.mocked(mockGetScheduleUseCase.execute).mockResolvedValueOnce({
        success: false,
        errors: ['Schedule not found'],
      });

      await useCase.execute();

      // Should close but not send notifications
      expect(mockCloseScheduleUseCase.execute).toHaveBeenCalled();
      expect(mockNotificationService.sendSummaryMessage).not.toHaveBeenCalled();
      expect(mockNotificationService.sendPRMessage).not.toHaveBeenCalled();
    });
  });
});
