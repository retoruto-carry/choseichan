import { describe, expect, it, vi } from 'vitest';
import type {
  ScheduleResponseDto,
  ScheduleSummaryResponseDto,
} from '../../application/dto/ScheduleDto';
import { EMBED_COLORS } from '../constants/ui';
import {
  createScheduleEmbed,
  createScheduleEmbedWithTable,
  createSimpleScheduleComponents,
} from './embeds';

// モックの設定
vi.mock('./button-helpers', () => ({
  createButtonId: (action: string, scheduleId: string) => `${action}:${scheduleId}`,
}));

vi.mock('./date-formatter', () => ({
  formatDate: (dateString: string) => `formatted:${dateString}`,
}));

describe('embeds', () => {
  const mockSchedule: ScheduleResponseDto = {
    id: 'schedule123',
    guildId: 'guild123',
    channelId: 'channel123',
    title: 'テストスケジュール',
    description: 'テスト説明',
    dates: [
      { id: 'date1', datetime: '2024-12-25 19:00' },
      { id: 'date2', datetime: '2024-12-26 20:00' },
    ],
    createdBy: {
      id: 'user123',
      username: 'testuser',
      displayName: 'テストユーザー',
    },
    status: 'open',
    deadline: '2024-12-24T10:00:00.000Z',
    authorId: 'user123',
    notificationSent: false,
    totalResponses: 2,
    createdAt: '2024-12-20T00:00:00.000Z',
    updatedAt: '2024-12-20T00:00:00.000Z',
  };

  const mockSummary: ScheduleSummaryResponseDto = {
    schedule: mockSchedule,
    responses: [
      {
        userId: 'user1',
        username: 'user1',
        displayName: 'ユーザー1',
        scheduleId: 'schedule123',
        updatedAt: '2024-12-20T00:00:00.000Z',
        dateStatuses: {
          date1: 'ok',
          date2: 'maybe',
        },
      },
      {
        userId: 'user2',
        username: 'user2',
        displayName: 'ユーザー2',
        scheduleId: 'schedule123',
        updatedAt: '2024-12-20T00:00:00.000Z',
        dateStatuses: {
          date1: 'ng',
          date2: 'ok',
        },
      },
    ],
    responseCounts: {
      date1: { yes: 1, maybe: 0, no: 1 },
      date2: { yes: 1, maybe: 1, no: 0 },
    },
    statistics: {
      overallParticipation: {
        fullyAvailable: 1,
        partiallyAvailable: 1,
        unavailable: 0,
      },
      optimalDates: {
        optimalDateId: 'date2',
        alternativeDateIds: ['date1'],
        scores: { date1: 0.5, date2: 1.5 },
      },
    },
    bestDateId: 'date2',
    totalResponseUsers: 2,
  };

  describe('createScheduleEmbed', () => {
    it('基本的なスケジュールEmbedを作成できる', () => {
      const embed = createScheduleEmbed({ schedule: mockSchedule });

      expect(embed.title).toBe('📅 テストスケジュール');
      expect(embed.description).toContain('テスト説明');
      expect(embed.description).toContain('⏰ **締切：** formatted:2024-12-24T10:00:00.000Z');
      expect(embed.color).toBe(EMBED_COLORS.OPEN);
      expect(embed.footer?.text).toBe('作成：テストユーザー');
      expect(embed.timestamp).toBe('2024-12-20T00:00:00.000Z');
      expect(embed.fields).toHaveLength(2);
    });

    it('締切がない場合は締切情報を表示しない', () => {
      const scheduleWithoutDeadline = { ...mockSchedule, deadline: undefined };
      const embed = createScheduleEmbed({ schedule: scheduleWithoutDeadline });

      expect(embed.description).not.toContain('⏰ **締切：**');
    });

    it('説明がない場合でも正しく動作する', () => {
      const scheduleWithoutDescription = { ...mockSchedule, description: undefined };
      const embed = createScheduleEmbed({ schedule: scheduleWithoutDescription });

      expect(embed.description).not.toContain('テスト説明');
      expect(embed.description).toContain('⏰ **締切：**');
    });

    it('回答者数を表示できる', () => {
      const embed = createScheduleEmbed({ schedule: mockSchedule, totalResponses: 5 });

      expect(embed.description).toContain('**回答者：** 5人');
    });

    it('サマリー情報を使って集計を表示できる', () => {
      const embed = createScheduleEmbed({
        schedule: mockSchedule,
        totalResponses: 2,
        summary: mockSummary,
      });

      expect(embed.fields[0].name).toBe('1. **2024-12-25 19:00**');
      expect(embed.fields[0].value).toBe('**集計：** ✅ 1人 ❔ 0人 ❌ 1人');
      expect(embed.fields[1].name).toBe('⭐ 2. **2024-12-26 20:00**');
      expect(embed.fields[1].value).toBe('**集計：** ✅ 1人 ❔ 1人 ❌ 0人');
    });

    it('閉じたスケジュールは色が変わる', () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      const embed = createScheduleEmbed({ schedule: closedSchedule });

      expect(embed.color).toBe(EMBED_COLORS.CLOSED);
    });

    it('表示名がない場合はユーザー名を使用する', () => {
      const scheduleWithoutDisplayName = {
        ...mockSchedule,
        createdBy: { ...mockSchedule.createdBy, displayName: undefined },
      };
      const embed = createScheduleEmbed({ schedule: scheduleWithoutDisplayName });

      expect(embed.footer?.text).toBe('作成：testuser');
    });

    it('25個を超える日程は切り捨てられる', () => {
      const manyDates = Array.from({ length: 30 }, (_, i) => ({
        id: `date${i}`,
        datetime: `2024-12-${i + 1} 19:00`,
      }));
      const scheduleWithManyDates = { ...mockSchedule, dates: manyDates };
      const embed = createScheduleEmbed({ schedule: scheduleWithManyDates });

      expect(embed.fields).toHaveLength(25);
    });
  });

  describe('createScheduleEmbedWithTable', () => {
    it('基本的なテーブル形式のEmbedを作成できる', () => {
      const embed = createScheduleEmbedWithTable({ summary: mockSummary });

      expect(embed.title).toBe('📅 テストスケジュール');
      expect(embed.description).toContain('テスト説明');
      expect(embed.description).toContain('⏰ **締切：** formatted:2024-12-24T10:00:00.000Z');
      expect(embed.description).toContain('**回答者：** 2人');
      expect(embed.color).toBe(EMBED_COLORS.OPEN);
      expect(embed.footer?.text).toBe('作成：テストユーザー');
      expect(embed.timestamp).toBe('2024-12-20T00:00:00.000Z');
    });

    it('詳細表示モードで各ユーザーの回答を表示する', () => {
      const embed = createScheduleEmbedWithTable({ summary: mockSummary, showDetails: true });

      expect(embed.fields[0].name).toBe('1. **2024-12-25 19:00**');
      expect(embed.fields[0].value).toContain('**集計：** ✅ 1人 ❔ 0人 ❌ 1人');
      // 新しいフォーマット：状態別に改行、名前は斜体
      expect(embed.fields[0].value).toContain('✅ *ユーザー1*');
      expect(embed.fields[0].value).toContain('❌ *ユーザー2*');

      expect(embed.fields[1].name).toBe('⭐ 2. **2024-12-26 20:00**');
      expect(embed.fields[1].value).toContain('**集計：** ✅ 1人 ❔ 1人 ❌ 0人');
      // 順序固定：✅ → ❔ → ❌
      expect(embed.fields[1].value).toContain('✅ *ユーザー2*');
      expect(embed.fields[1].value).toContain('❔ *ユーザー1*');
    });

    it('詳細表示モードで回答がない日程も正しく表示する', () => {
      const summaryWithNoResponses = {
        ...mockSummary,
        responses: [],
        responseCounts: {
          date1: { yes: 0, maybe: 0, no: 0 },
          date2: { yes: 0, maybe: 0, no: 0 },
        },
      };
      const embed = createScheduleEmbedWithTable({
        summary: summaryWithNoResponses,
        showDetails: true,
      });

      expect(embed.fields[0].value).toBe('**集計：** ✅ 0人 ❔ 0人 ❌ 0人');
    });

    it('締切がDate型でも正しく処理される', () => {
      const scheduleWithDateDeadline = {
        ...mockSchedule,
        deadline: new Date('2024-12-24T10:00:00.000Z') as any,
      };
      const summaryWithDateDeadline = {
        ...mockSummary,
        schedule: scheduleWithDateDeadline,
      };
      const embed = createScheduleEmbedWithTable({ summary: summaryWithDateDeadline });

      expect(embed.description).toContain('⏰ **締切：** formatted:');
    });

    it('統計情報から最適な日程を判定できる', () => {
      const summaryWithStatistics = {
        ...mockSummary,
        bestDateId: undefined,
        statistics: {
          overallParticipation: {
            fullyAvailable: 1,
            partiallyAvailable: 1,
            unavailable: 0,
          },
          optimalDates: {
            optimalDateId: 'date1',
            alternativeDateIds: ['date2'],
            scores: { date1: 1.5, date2: 1.0 },
          },
        },
      };
      const embed = createScheduleEmbedWithTable({ summary: summaryWithStatistics });

      expect(embed.fields[0].name).toBe('⭐ 1. **2024-12-25 19:00**');
    });
  });

  describe('createSimpleScheduleComponents', () => {
    it('開いているスケジュールのコンポーネントを作成できる', () => {
      const components = createSimpleScheduleComponents({ schedule: mockSchedule });

      expect(components).toHaveLength(1);
      expect(components[0].type).toBe(1);
      expect(components[0].components).toHaveLength(3);

      const buttons = components[0].components;
      expect(buttons[0]).toEqual({
        type: 2,
        style: 1,
        label: '回答する',
        custom_id: 'respond:schedule123',
        emoji: { name: '✏️' },
      });
      expect(buttons[1]).toEqual({
        type: 2,
        style: 2,
        label: '詳細',
        custom_id: 'status:schedule123',
        emoji: { name: '👥' },
      });
      expect(buttons[2]).toEqual({
        type: 2,
        style: 2,
        label: '編集',
        custom_id: 'edit:schedule123',
        emoji: { name: '⚙️' },
      });
    });

    it('閉じたスケジュールは回答ボタンを表示しない', () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      const components = createSimpleScheduleComponents({ schedule: closedSchedule });

      const buttons = components[0].components;
      expect(buttons).toHaveLength(2);
      expect(buttons.find((b: any) => b.label === '回答する')).toBeUndefined();
    });

    it('詳細表示モードでは簡易表示ボタンを表示する', () => {
      const components = createSimpleScheduleComponents({
        schedule: mockSchedule,
        showDetails: true,
      });

      const buttons = components[0].components;
      expect(buttons[1]).toEqual({
        type: 2,
        style: 2,
        label: '簡易表示',
        custom_id: 'hide_details:schedule123',
        emoji: { name: '📊' },
      });
    });
  });
});
