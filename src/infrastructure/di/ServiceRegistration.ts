/**
 * Service Registration
 *
 * アプリケーションの全サービスをDIコンテナに登録
 */

// Application Services
import { NotificationService } from '../../application/services/NotificationService';
import { ProcessDeadlineRemindersUseCase } from '../../application/usecases/ProcessDeadlineRemindersUseCase';
import { GetResponseUseCase } from '../../application/usecases/response/GetResponseUseCase';
// Use Cases - Response
import { SubmitResponseUseCase } from '../../application/usecases/response/SubmitResponseUseCase';
import { UpdateResponseUseCase } from '../../application/usecases/response/UpdateResponseUseCase';
import { CloseScheduleUseCase } from '../../application/usecases/schedule/CloseScheduleUseCase';

// Use Cases - Schedule
import { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import { DeadlineReminderUseCase } from '../../application/usecases/schedule/DeadlineReminderUseCase';
import { DeleteScheduleUseCase } from '../../application/usecases/schedule/DeleteScheduleUseCase';
import { FindSchedulesUseCase } from '../../application/usecases/schedule/FindSchedulesUseCase';
import { GetScheduleSummaryUseCase } from '../../application/usecases/schedule/GetScheduleSummaryUseCase';
import { GetScheduleUseCase } from '../../application/usecases/schedule/GetScheduleUseCase';
import { ProcessReminderUseCase } from '../../application/usecases/schedule/ProcessReminderUseCase';
import { ReopenScheduleUseCase } from '../../application/usecases/schedule/ReopenScheduleUseCase';
import { UpdateScheduleUseCase } from '../../application/usecases/schedule/UpdateScheduleUseCase';
import type { IRepositoryFactory } from '../../domain/repositories/interfaces';
import { DiscordApiAdapter } from '../adapters/DiscordApiAdapter';
import { EnvironmentAdapter } from '../adapters/EnvironmentAdapter';
import { LoggerAdapter } from '../adapters/LoggerAdapter';
// Infrastructure
import { createRepositoryFactory } from '../factories/factory';
import { DiscordApiService } from '../services/DiscordApiService';
import type { Env } from '../types/discord';
import { type IDIContainer, SERVICE_TOKENS } from './DIContainer';

export function registerServices(container: IDIContainer, env: Env): void {
  // Register environment
  container.registerInstance(SERVICE_TOKENS.ENV, env);

  // Register Infrastructure Services
  registerInfrastructureServices(container, env);

  // Register Application Services
  registerApplicationServices(container, env);

  // Register Use Cases
  registerUseCases(container, env);
}

function registerInfrastructureServices(container: IDIContainer, env: Env): void {
  // Repository Factory (Singleton)
  container.registerSingleton(SERVICE_TOKENS.REPOSITORY_FACTORY, () =>
    createRepositoryFactory(env)
  );

  // Discord API Service (Singleton)
  container.registerSingleton(SERVICE_TOKENS.DISCORD_API_SERVICE, () => new DiscordApiService());

  // Individual Repositories (Singleton - derived from factory)
  container.registerSingleton(SERVICE_TOKENS.SCHEDULE_REPOSITORY, (c) =>
    (c.resolve(SERVICE_TOKENS.REPOSITORY_FACTORY) as IRepositoryFactory).getScheduleRepository()
  );

  container.registerSingleton(SERVICE_TOKENS.RESPONSE_REPOSITORY, (c) =>
    (c.resolve(SERVICE_TOKENS.REPOSITORY_FACTORY) as IRepositoryFactory).getResponseRepository()
  );

  // Adapters (Singleton)
  container.registerSingleton(SERVICE_TOKENS.LOGGER_ADAPTER, () => new LoggerAdapter());

  container.registerSingleton(SERVICE_TOKENS.DISCORD_API_ADAPTER, () => new DiscordApiAdapter());

  container.registerSingleton(
    SERVICE_TOKENS.ENVIRONMENT_ADAPTER,
    (c) => new EnvironmentAdapter(c.resolve(SERVICE_TOKENS.ENV))
  );
}

function registerApplicationServices(container: IDIContainer, env: Env): void {
  // Notification Service (Singleton - only if credentials available)
  if (env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID) {
    container.registerSingleton(SERVICE_TOKENS.NOTIFICATION_SERVICE, (c) => {
      const discordToken = env.DISCORD_TOKEN ?? '';
      const applicationId = env.DISCORD_APPLICATION_ID ?? '';

      if (!discordToken || !applicationId) {
        throw new Error('Discord credentials are not configured for NotificationService');
      }

      return new NotificationService(
        c.resolve(SERVICE_TOKENS.LOGGER_ADAPTER),
        c.resolve(SERVICE_TOKENS.DISCORD_API_ADAPTER),
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.GET_SCHEDULE_SUMMARY_USE_CASE),
        discordToken,
        applicationId
      );
    });
  }
}

function registerUseCases(container: IDIContainer, env: Env): void {
  // Schedule Use Cases (Transient - stateless)
  container.registerTransient(
    SERVICE_TOKENS.CREATE_SCHEDULE_USE_CASE,
    (c) => new CreateScheduleUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  container.registerTransient(
    SERVICE_TOKENS.UPDATE_SCHEDULE_USE_CASE,
    (c) => new UpdateScheduleUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  container.registerTransient(
    SERVICE_TOKENS.CLOSE_SCHEDULE_USE_CASE,
    (c) => new CloseScheduleUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  container.registerTransient(
    SERVICE_TOKENS.REOPEN_SCHEDULE_USE_CASE,
    (c) => new ReopenScheduleUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  container.registerTransient(
    SERVICE_TOKENS.DELETE_SCHEDULE_USE_CASE,
    (c) =>
      new DeleteScheduleUseCase(
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.GET_SCHEDULE_USE_CASE,
    (c) =>
      new GetScheduleUseCase(
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.FIND_SCHEDULES_USE_CASE,
    (c) => new FindSchedulesUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  container.registerTransient(
    SERVICE_TOKENS.GET_SCHEDULE_SUMMARY_USE_CASE,
    (c) =>
      new GetScheduleSummaryUseCase(
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.DEADLINE_REMINDER_USE_CASE,
    (c) =>
      new DeadlineReminderUseCase(
        c.resolve(SERVICE_TOKENS.LOGGER_ADAPTER),
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.PROCESS_REMINDER_USE_CASE,
    (c) => new ProcessReminderUseCase(c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY))
  );

  // Response Use Cases (Transient)
  container.registerTransient(
    SERVICE_TOKENS.SUBMIT_RESPONSE_USE_CASE,
    (c) =>
      new SubmitResponseUseCase(
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.UPDATE_RESPONSE_USE_CASE,
    (c) =>
      new UpdateResponseUseCase(
        c.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY),
        c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY)
      )
  );

  container.registerTransient(
    SERVICE_TOKENS.GET_RESPONSE_USE_CASE,
    (c) => new GetResponseUseCase(c.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY))
  );

  // Composite Use Cases (Transient - only if notification service is available)
  if (env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID) {
    container.registerTransient(
      SERVICE_TOKENS.PROCESS_DEADLINE_REMINDERS_USE_CASE,
      (c) =>
        new ProcessDeadlineRemindersUseCase(
          c.resolve(SERVICE_TOKENS.LOGGER_ADAPTER),
          c.resolve(SERVICE_TOKENS.DEADLINE_REMINDER_USE_CASE),
          c.resolve(SERVICE_TOKENS.GET_SCHEDULE_USE_CASE),
          c.resolve(SERVICE_TOKENS.GET_SCHEDULE_SUMMARY_USE_CASE),
          c.resolve(SERVICE_TOKENS.PROCESS_REMINDER_USE_CASE),
          c.resolve(SERVICE_TOKENS.CLOSE_SCHEDULE_USE_CASE),
          c.resolve(SERVICE_TOKENS.NOTIFICATION_SERVICE),
          c.resolve(SERVICE_TOKENS.ENVIRONMENT_ADAPTER)
        )
    );
  }
}

// Configuration-based registration for different environments
export interface ServiceConfiguration {
  environment: 'development' | 'testing' | 'production';
  enableNotifications: boolean;
  enableDebugLogging: boolean;
  useMockServices: boolean;
}

export function registerServicesWithConfig(
  container: IDIContainer,
  env: Env,
  config: ServiceConfiguration
): void {
  if (config.useMockServices) {
    registerMockServices(container, env, config);
  } else {
    registerServices(container, env);
  }
}

function registerMockServices(
  container: IDIContainer,
  env: Env,
  _config: ServiceConfiguration
): void {
  // Register mock implementations for testing
  // This would be useful for unit tests and integration tests

  // Mock Repository Factory
  container.registerSingleton(SERVICE_TOKENS.REPOSITORY_FACTORY, () => ({
    getScheduleRepository: () => ({
      // Mock schedule repository implementation
    }),
    getResponseRepository: () => ({
      // Mock response repository implementation
    }),
  }));

  // Continue with regular service registration but with mocks
  registerApplicationServices(container, env);
  registerUseCases(container, env);
}
