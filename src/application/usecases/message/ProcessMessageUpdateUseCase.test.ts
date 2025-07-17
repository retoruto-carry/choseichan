/**
 * ProcessMessageUpdateUseCase テスト
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscordMessageService } from '../../../presentation/services/DiscordMessageService';
import type { IDiscordApiPort } from '../../ports/DiscordApiPort';
import type { ILogger } from '../../ports/LoggerPort';
import type { MessageUpdateTask } from '../../types/MessageUpdateTypes';
import type { GetScheduleSummaryUseCase } from '../schedule/GetScheduleSummaryUseCase';
import { ProcessMessageUpdateUseCase } from './ProcessMessageUpdateUseCase';

describe('ProcessMessageUpdateUseCase', () => {
  let mockLogger: ILogger;
  let mockGetScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  let mockDiscordApiService: IDiscordApiPort;
  let mockDiscordMessageService: DiscordMessageService;
  let useCase: ProcessMessageUpdateUseCase;

  const mockSummary = {
    schedule: {
      id: 'schedule-123',
      title: 'テストスケジュール',
      description: 'テストの説明',
      dates: [{ id: 'date-1', datetime: '2024/12/25 19:00' }],
      deadline: '2024-12-24T15:00:00.000Z',
      status: 'open' as const,
      createdBy: { id: 'user-123', username: 'TestUser', displayName: 'Test User' },
      totalResponses: 5,
    },
    statistics: {
      totalResponseUsers: 5,
      dateStatistics: {
        'date-1': {
          yesCount: 3,
          maybeCount: 1,
          noCount: 1,
          totalCount: 5,
        },
      },
    },
    responses: [],
  };

  const mockEmbed = {
    title: 'テストスケジュール',
    description: 'テストの説明',
    fields: [],
  };

  const mockComponents = [
    {
      type: 1,
      components: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockGetScheduleSummaryUseCase = {
      execute: vi.fn(),
    } as any;

    mockDiscordApiService = {
      sendWebhookMessage: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
      getGuildMember: vi.fn(),
      createInteractionResponse: vi.fn(),
      searchGuildMembers: vi.fn(),
    };

    mockDiscordMessageService = {
      formatScheduleMessage: vi.fn().mockReturnValue({
        embed: mockEmbed,
        components: mockComponents,
      }),
    } as any;

    useCase = new ProcessMessageUpdateUseCase(
      mockLogger,
      mockGetScheduleSummaryUseCase,
      mockDiscordApiService,
      mockDiscordMessageService,
      'test-discord-token'
    );
  });

  describe('execute', () => {
    const mockTask: MessageUpdateTask = {
      scheduleId: 'schedule-123',
      guildId: 'guild-123',
      channelId: 'channel-123',
      messageId: 'msg-123',
      updateType: 'vote',
    };

    it('should update message successfully', async () => {
      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValueOnce({
        success: true,
        summary: mockSummary,
      });

      await useCase.execute(mockTask);

      expect(mockGetScheduleSummaryUseCase.execute).toHaveBeenCalledWith(
        'schedule-123',
        'guild-123'
      );

      expect(mockDiscordMessageService.formatScheduleMessage).toHaveBeenCalledWith(
        mockSummary,
        true
      );

      expect(mockDiscordApiService.updateMessage).toHaveBeenCalledWith({
        channelId: 'channel-123',
        messageId: 'msg-123',
        message: {
          embeds: [mockEmbed],
          components: mockComponents,
        },
        botToken: 'test-discord-token',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Message updated successfully',
        expect.objectContaining({
          operation: 'process-message-update',
          scheduleId: 'schedule-123',
          messageId: 'msg-123',
          updateType: 'vote',
        })
      );
    });

    it('should throw error when summary fetch fails', async () => {
      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValueOnce({
        success: false,
        errors: ['Schedule not found'],
      });

      await expect(useCase.execute(mockTask)).rejects.toThrow(
        'Failed to get schedule summary: schedule-123'
      );

      expect(mockDiscordApiService.updateMessage).not.toHaveBeenCalled();
    });

    it('should log error when Discord API fails', async () => {
      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValueOnce({
        success: true,
        summary: mockSummary,
      });

      const apiError = new Error('Discord API error');
      vi.mocked(mockDiscordApiService.updateMessage).mockRejectedValueOnce(apiError);

      await expect(useCase.execute(mockTask)).rejects.toThrow('Discord API error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message update',
        apiError,
        expect.objectContaining({
          operation: 'process-message-update',
          scheduleId: 'schedule-123',
          messageId: 'msg-123',
          updateType: 'vote',
        })
      );
    });

    it('should handle non-error objects in catch', async () => {
      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValueOnce({
        success: true,
        summary: mockSummary,
      });

      vi.mocked(mockDiscordApiService.updateMessage).mockRejectedValueOnce('string error');

      await expect(useCase.execute(mockTask)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message update',
        expect.any(Error),
        expect.objectContaining({
          operation: 'process-message-update',
        })
      );
    });
  });

  describe('executeBatch', () => {
    it('should process unique messages only', async () => {
      const tasks: MessageUpdateTask[] = [
        {
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          messageId: 'msg-123',
          updateType: 'vote',
        },
        {
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          messageId: 'msg-123',
          updateType: 'vote',
        },
        {
          scheduleId: 'schedule-456',
          guildId: 'guild-456',
          channelId: 'channel-456',
          messageId: 'msg-456',
          updateType: 'close',
        },
      ];

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      await useCase.executeBatch(tasks);

      // 重複を除いて2回のみ実行される
      expect(mockGetScheduleSummaryUseCase.execute).toHaveBeenCalledTimes(2);
      expect(mockDiscordApiService.updateMessage).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other tasks when one fails', async () => {
      const tasks: MessageUpdateTask[] = [
        {
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          messageId: 'msg-123',
          updateType: 'vote',
        },
        {
          scheduleId: 'schedule-456',
          guildId: 'guild-456',
          channelId: 'channel-456',
          messageId: 'msg-456',
          updateType: 'vote',
        },
      ];

      vi.mocked(mockGetScheduleSummaryUseCase.execute)
        .mockResolvedValueOnce({
          success: false,
          errors: ['Schedule not found'],
        })
        .mockResolvedValueOnce({
          success: true,
          summary: mockSummary,
        });

      await useCase.executeBatch(tasks);

      // 1つ目は失敗するが、2つ目は成功する
      expect(mockDiscordApiService.updateMessage).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update message in batch',
        expect.any(Error),
        expect.objectContaining({
          operation: 'batch-message-update',
          scheduleId: 'schedule-123',
        })
      );
    });

    it('should handle empty batch', async () => {
      await useCase.executeBatch([]);

      expect(mockGetScheduleSummaryUseCase.execute).not.toHaveBeenCalled();
      expect(mockDiscordApiService.updateMessage).not.toHaveBeenCalled();
    });

    it('should keep only the latest update for each message', async () => {
      const tasks: MessageUpdateTask[] = [
        {
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          messageId: 'msg-123',
          updateType: 'vote',
        },
        {
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          messageId: 'msg-123',
          updateType: 'close', // これが最新
        },
      ];

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValue({
        success: true,
        summary: mockSummary,
      });

      await useCase.executeBatch(tasks);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Message updated successfully',
        expect.objectContaining({
          updateType: 'close', // 最新のupdateTypeが使用される
        })
      );
    });
  });
});