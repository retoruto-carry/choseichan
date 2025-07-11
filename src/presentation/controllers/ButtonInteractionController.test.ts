import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ButtonInteractionController } from './ButtonInteractionController';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { parseButtonId } from '../../utils/id';

// Mock dependencies
vi.mock('../../utils/id', () => ({
  parseButtonId: vi.fn()
}));

vi.mock('../../infrastructure/factories/DependencyContainer');

// Mock other controllers
vi.mock('./VoteController', () => ({
  VoteController: vi.fn().mockImplementation(() => ({
    handleRespondButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleCloseButton: vi.fn().mockResolvedValue({ type: 1 })
  }))
}));

vi.mock('./DisplayController', () => ({
  DisplayController: vi.fn().mockImplementation(() => ({
    handleShowDetailsButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleHideDetailsButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleRefreshButton: vi.fn().mockResolvedValue({ type: 1 })
  }))
}));

vi.mock('./ScheduleEditController', () => ({
  ScheduleEditController: vi.fn().mockImplementation(() => ({
    handleEditButton: vi.fn().mockResolvedValue({ type: 1 })
  }))
}));

vi.mock('./ScheduleManagementController', () => ({
  ScheduleManagementController: vi.fn().mockImplementation(() => ({
    handleReopenButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleDeleteButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleDeleteConfirmButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleDeleteCancelButton: vi.fn().mockResolvedValue({ type: 1 })
  }))
}));

vi.mock('./EditModalController', () => ({
  EditModalController: vi.fn().mockImplementation(() => ({
    handleAddDateButton: vi.fn().mockResolvedValue({ type: 1 }),
    handleAddReminderButton: vi.fn().mockResolvedValue({ type: 1 })
  }))
}));

describe('ButtonInteractionController', () => {
  let controller: ButtonInteractionController;
  let mockContainer: DependencyContainer;
  let mockInteraction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContainer = {} as DependencyContainer;
    controller = new ButtonInteractionController(mockContainer);
    
    mockInteraction = {
      data: {
        custom_id: 'respond:schedule-123',
        components: []
      },
      member: {
        user: {
          id: 'user-123',
          username: 'TestUser'
        }
      },
      guild_id: 'guild-123',
      channel_id: 'channel-123',
      message: {
        id: 'message-123'
      }
    };
  });

  describe('handle', () => {
    it('should handle respond button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'respond', id: 'schedule-123' });

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
      expect(parseButtonId).toHaveBeenCalledWith('respond:schedule-123');
    });

    it('should handle status button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'status', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'status:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle hide_details button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'hide_details', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'hide_details:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle refresh button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'refresh', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'refresh:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle edit button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'edit', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'edit:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle close button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'close', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'close:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle reopen button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'reopen', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'reopen:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle delete button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'delete', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'delete:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle delete_confirm button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'delete_confirm', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'delete_confirm:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle delete_cancel button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'delete_cancel', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'delete_cancel:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle add_date button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'add_date', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'add_date:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should handle add_reminder button', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'add_reminder', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'add_reminder:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({ type: 1 });
    });

    it('should return error for unknown action', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce({ action: 'unknown', id: 'schedule-123' });
      mockInteraction.data.custom_id = 'unknown:schedule-123';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ 不明なアクションです',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
    });

    it('should handle parse error', async () => {
      vi.mocked(parseButtonId).mockReturnValueOnce(null);
      mockInteraction.data.custom_id = 'invalid-format';

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ ボタンIDの解析に失敗しました',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(parseButtonId).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await controller.handle(mockInteraction);

      expect(result).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ エラーが発生しました: Parse error',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
    });
  });
});