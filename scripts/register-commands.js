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
        description: '新しい日程調整を作成（対話形式）',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'list',
        description: 'このチャンネルの日程調整一覧を表示',
        type: ApplicationCommandOptionType.Subcommand
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