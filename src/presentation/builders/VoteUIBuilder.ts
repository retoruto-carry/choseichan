/**
 * Vote UI Builder
 * 
 * 投票UIの構築専用クラス
 */

import { ScheduleResponse, ResponseDto } from '../../application/dto/ScheduleDto';
import { DISCORD_LIMITS } from '../../constants';

export class VoteUIBuilder {
  /**
   * 投票セレクトメニューを作成
   */
  createVoteSelectMenus(schedule: ScheduleResponse, userResponse: ResponseDto | null) {
    return schedule.dates.map((date) => {
      const existingStatus = userResponse?.dateStatuses?.[date.id];
      
      // Set placeholder based on current status
      const statusSymbol = existingStatus === 'ok' ? '✅' : 
                          existingStatus === 'maybe' ? '❔' : 
                          existingStatus === 'ng' ? '❌' : '未回答';
      const placeholder = `${statusSymbol} ${date.datetime}`;
      
      return {
        type: 1, // Action Row
        components: [{
          type: 3, // Select Menu
          custom_id: `dateselect:${schedule.id}:${date.id}`,
          placeholder,
          options: [
            {
              label: `未回答 ${date.datetime}`,
              value: 'none',
              default: !existingStatus
            },
            {
              label: `✅ ${date.datetime}`,
              value: 'yes',
              default: existingStatus === 'ok'
            },
            {
              label: `❔ ${date.datetime}`,
              value: 'maybe',
              default: existingStatus === 'maybe'
            },
            {
              label: `❌ ${date.datetime}`,
              value: 'no',
              default: existingStatus === 'ng'
            }
          ]
        }]
      };
    });
  }

  /**
   * 投票モーダルを作成
   */
  createVoteModal(schedule: any, currentResponses: any[]): any {
    const components = [];
    
    // Create input for each date (up to Discord's limit)
    const maxDates = Math.min(schedule.dates.length, DISCORD_LIMITS.MAX_BUTTON_ROWS - 1);
    
    for (let i = 0; i < maxDates; i++) {
      const date = schedule.dates[i];
      const existingResponse = currentResponses.find(r => r.dateId === date.id);
      const currentValue = existingResponse ? 
        (existingResponse.status === 'available' ? '○' : 
         existingResponse.status === 'maybe' ? '△' : '×') : '';
      
      components.push({
        type: 1,
        components: [{
          type: 4,
          custom_id: `vote_${date.id}`,
          label: date.datetime,
          style: 1,
          min_length: 0,
          max_length: 10,
          placeholder: '○、△、× のいずれかを入力',
          value: currentValue,
          required: false
        }]
      });
    }
    
    // Add comment field
    const existingComment = currentResponses.length > 0 && currentResponses[0].comment || '';
    components.push({
      type: 1,
      components: [{
        type: 4,
        custom_id: 'comment',
        label: 'コメント（任意）',
        style: 2,
        min_length: 0,
        max_length: 200,
        placeholder: '何かコメントがあれば入力してください',
        value: existingComment,
        required: false
      }]
    });
    
    return {
      title: schedule.title,
      custom_id: `vote:${schedule.id}`,
      components
    };
  }
}