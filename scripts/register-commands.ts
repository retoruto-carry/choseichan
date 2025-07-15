import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

interface Command {
  name: string;
  description: string;
}

const commands: Command[] = [
  {
    name: 'chouseichan',
    description: '新しい日程調整を作成',
  },
];

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

async function registerCommands(): Promise<void> {
  try {
    console.log('Started refreshing application (/) commands.');

    const discordToken = getRequiredEnvVar('DISCORD_TOKEN');
    const applicationId = getRequiredEnvVar('DISCORD_APPLICATION_ID');

    const rest = new REST({ version: '10' }).setToken(discordToken);

    await rest.put(Routes.applicationCommands(applicationId), {
      body: commands,
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
}

registerCommands();
