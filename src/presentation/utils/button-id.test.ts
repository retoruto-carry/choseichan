import { describe, expect, it } from 'vitest';
import {
  type ButtonIdParams,
  ButtonIdParseError,
  createButtonIdFromParams,
  createCancelDeleteButtonId,
  createCloseButtonId,
  createConfirmDeleteButtonId,
  createDeleteButtonId,
  createDetailsButtonId,
  createEditButtonId,
  createEditReminderButtonId,
  createRespondButtonId,
  createVoteButtonId,
  extractScheduleIdFromButton,
  isButtonIdAction,
  parseButtonIdToComponents,
} from './button-id';

describe('button-id', () => {
  describe('createButtonIdFromParams', () => {
    it('基本的なボタンIDを作成できる', () => {
      const params: ButtonIdParams = {
        action: 'respond',
        scheduleId: 'schedule123',
      };
      expect(createButtonIdFromParams(params)).toBe('respond:schedule123');
    });

    it('追加パラメータ付きのボタンIDを作成できる', () => {
      const params: ButtonIdParams = {
        action: 'vote',
        scheduleId: 'schedule123',
        additionalParams: ['date456', 'ok'],
      };
      expect(createButtonIdFromParams(params)).toBe('vote:schedule123:date456:ok');
    });

    it('空の追加パラメータは無視される', () => {
      const params: ButtonIdParams = {
        action: 'respond',
        scheduleId: 'schedule123',
        additionalParams: [],
      };
      expect(createButtonIdFromParams(params)).toBe('respond:schedule123');
    });

    it('セパレータを含む値はエラーになる', () => {
      const params: ButtonIdParams = {
        action: 'respond:invalid',
        scheduleId: 'schedule123',
      };
      expect(() => createButtonIdFromParams(params)).toThrow(
        'ボタンID部分に区切り文字 ":" を含めることはできません'
      );
    });

    it('空の値はエラーになる', () => {
      const params: ButtonIdParams = {
        action: '',
        scheduleId: 'schedule123',
      };
      expect(() => createButtonIdFromParams(params)).toThrow(
        'ボタンID部分を空にすることはできません'
      );
    });

    it('空白のみの値はエラーになる', () => {
      const params: ButtonIdParams = {
        action: '  ',
        scheduleId: 'schedule123',
      };
      expect(() => createButtonIdFromParams(params)).toThrow(
        'ボタンID部分を空にすることはできません'
      );
    });

    it('追加パラメータにセパレータが含まれる場合もエラーになる', () => {
      const params: ButtonIdParams = {
        action: 'vote',
        scheduleId: 'schedule123',
        additionalParams: ['date:invalid', 'ok'],
      };
      expect(() => createButtonIdFromParams(params)).toThrow(
        'ボタンID部分に区切り文字 ":" を含めることはできません'
      );
    });
  });

  describe('parseButtonIdToComponents', () => {
    it('基本的なボタンIDをパースできる', () => {
      const result = parseButtonIdToComponents('respond:schedule123');
      expect(result).toEqual({
        action: 'respond',
        scheduleId: 'schedule123',
        additionalParams: [],
      });
    });

    it('追加パラメータ付きのボタンIDをパースできる', () => {
      const result = parseButtonIdToComponents('vote:schedule123:date456:ok');
      expect(result).toEqual({
        action: 'vote',
        scheduleId: 'schedule123',
        additionalParams: ['date456', 'ok'],
      });
    });

    it('前後の空白はトリムされる', () => {
      const result = parseButtonIdToComponents(' respond : schedule123 ');
      expect(result).toEqual({
        action: 'respond',
        scheduleId: 'schedule123',
        additionalParams: [],
      });
    });

    it('空のボタンIDはエラーになる', () => {
      expect(() => parseButtonIdToComponents('')).toThrow(ButtonIdParseError);
      expect(() => parseButtonIdToComponents('')).toThrow('ボタンIDが空です');
    });

    it('空白のみのボタンIDはエラーになる', () => {
      expect(() => parseButtonIdToComponents('  ')).toThrow(ButtonIdParseError);
      expect(() => parseButtonIdToComponents('  ')).toThrow('ボタンIDが空です');
    });

    it('部分が足りない場合はエラーになる', () => {
      expect(() => parseButtonIdToComponents('respond')).toThrow(ButtonIdParseError);
      expect(() => parseButtonIdToComponents('respond')).toThrow(
        '最低 2 個の部分が必要ですが、1 個でした'
      );
    });

    it('アクション部分が空の場合はエラーになる', () => {
      expect(() => parseButtonIdToComponents(':schedule123')).toThrow(ButtonIdParseError);
      expect(() => parseButtonIdToComponents(':schedule123')).toThrow('アクション部分が空です');
    });

    it('スケジュールID部分が空の場合はエラーになる', () => {
      expect(() => parseButtonIdToComponents('respond:')).toThrow(ButtonIdParseError);
      expect(() => parseButtonIdToComponents('respond:')).toThrow('スケジュールID部分が空です');
    });
  });

  describe('isButtonIdAction', () => {
    it('指定したアクションのボタンIDを正しく判定できる', () => {
      expect(isButtonIdAction('respond:schedule123', 'respond')).toBe(true);
      expect(isButtonIdAction('edit:schedule123', 'respond')).toBe(false);
      expect(isButtonIdAction('vote:schedule123:date456:ok', 'vote')).toBe(true);
    });

    it('無効なボタンIDの場合はfalseを返す', () => {
      expect(isButtonIdAction('invalid', 'respond')).toBe(false);
      expect(isButtonIdAction('', 'respond')).toBe(false);
      expect(isButtonIdAction(':schedule123', 'respond')).toBe(false);
    });
  });

  describe('extractScheduleIdFromButton', () => {
    it('ボタンIDからスケジュールIDを抽出できる', () => {
      expect(extractScheduleIdFromButton('respond:schedule123')).toBe('schedule123');
      expect(extractScheduleIdFromButton('vote:schedule456:date789:ok')).toBe('schedule456');
    });

    it('無効なボタンIDの場合はnullを返す', () => {
      expect(extractScheduleIdFromButton('invalid')).toBeNull();
      expect(extractScheduleIdFromButton('')).toBeNull();
      expect(extractScheduleIdFromButton(':schedule123')).toBeNull();
    });
  });

  describe('ヘルパー関数', () => {
    const scheduleId = 'schedule123';

    it('createRespondButtonId', () => {
      expect(createRespondButtonId(scheduleId)).toBe('respond:schedule123');
    });

    it('createEditButtonId', () => {
      expect(createEditButtonId(scheduleId)).toBe('edit:schedule123');
    });

    it('createCloseButtonId', () => {
      expect(createCloseButtonId(scheduleId)).toBe('close:schedule123');
    });

    it('createDetailsButtonId', () => {
      expect(createDetailsButtonId(scheduleId)).toBe('details:schedule123');
    });

    it('createDeleteButtonId', () => {
      expect(createDeleteButtonId(scheduleId)).toBe('delete:schedule123');
    });

    it('createConfirmDeleteButtonId', () => {
      expect(createConfirmDeleteButtonId(scheduleId)).toBe('confirm_delete:schedule123');
    });

    it('createCancelDeleteButtonId', () => {
      expect(createCancelDeleteButtonId(scheduleId)).toBe('cancel_delete:schedule123');
    });

    it('createVoteButtonId', () => {
      expect(createVoteButtonId(scheduleId, 'date456', 'ok')).toBe('vote:schedule123:date456:ok');
    });

    it('createEditReminderButtonId', () => {
      expect(createEditReminderButtonId(scheduleId)).toBe('reminder_edit:schedule123');
    });
  });

  describe('ButtonIdParseError', () => {
    it('エラーメッセージが正しく生成される', () => {
      const error = new ButtonIdParseError('invalid:button', '部分が不足');
      expect(error.message).toBe('ボタンID "invalid:button" のパースに失敗しました: 部分が不足');
      expect(error.name).toBe('ButtonIdParseError');
    });
  });
});
