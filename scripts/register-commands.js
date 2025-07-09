import { REST, Routes, ApplicationCommandOptionType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  {
    name: 'schedule',
    description: '日程調整を管理します',
    options: [
      {
        name: 'create',
        description: '新しい日程調整を作成',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'title',
            description: '日程調整のタイトル',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'date1',
            description: '候補日時1（例: 12/25 19:00）',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'description',
            description: '説明（任意）',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date2',
            description: '候補日時2',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date3',
            description: '候補日時3',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date4',
            description: '候補日時4',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date5',
            description: '候補日時5',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date6',
            description: '候補日時6',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date7',
            description: '候補日時7',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date8',
            description: '候補日時8',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date9',
            description: '候補日時9',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'date10',
            description: '候補日時10',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'deadline',
            description: '回答締切（例: 12/24 23:59）',
            type: ApplicationCommandOptionType.String,
            required: false
          }
        ]
      },
      {
        name: 'list',
        description: 'このチャンネルの日程調整一覧を表示',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'status',
        description: '日程調整の集計状況を確認',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'id',
            description: '日程調整ID',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      },
      {
        name: 'close',
        description: '日程調整を締め切る',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'id',
            description: '日程調整ID',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'help',
    description: 'ちょうせいくんの使い方を表示'
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();