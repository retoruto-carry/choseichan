/**
 * Dependency Injection Container
 * 
 * アプリケーション全体の依存関係を管理
 * Clean Architectureの依存性の注入を実現
 */

import { IRepositoryFactory } from '../../domain/repositories/interfaces';
import { IDiscordApiService, DiscordApiService } from '../services/DiscordApiService';
import { createRepositoryFactory } from './factory';
import { Env } from '../types/discord';

// Application Layer Use Cases
import { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import { UpdateScheduleUseCase } from '../../application/usecases/schedule/UpdateScheduleUseCase';
import { CloseScheduleUseCase } from '../../application/usecases/schedule/CloseScheduleUseCase';
import { GetScheduleUseCase } from '../../application/usecases/schedule/GetScheduleUseCase';
import { SubmitResponseUseCase } from '../../application/usecases/response/SubmitResponseUseCase';
import { UpdateResponseUseCase } from '../../application/usecases/response/UpdateResponseUseCase';
import { GetResponseUseCase } from '../../application/usecases/response/GetResponseUseCase';
import { FindSchedulesUseCase } from '../../application/usecases/schedule/FindSchedulesUseCase';
import { GetScheduleSummaryUseCase } from '../../application/usecases/schedule/GetScheduleSummaryUseCase';
import { DeadlineReminderUseCase } from '../../application/usecases/schedule/DeadlineReminderUseCase';
import { ProcessReminderUseCase } from '../../application/usecases/schedule/ProcessReminderUseCase';
import { ProcessDeadlineRemindersUseCase } from '../../application/usecases/ProcessDeadlineRemindersUseCase';
import { NotificationService } from '../../application/services/NotificationService';
import { ReopenScheduleUseCase } from '../../application/usecases/schedule/ReopenScheduleUseCase';
import { DeleteScheduleUseCase } from '../../application/usecases/schedule/DeleteScheduleUseCase';

export interface ApplicationServices {
  // Schedule Use Cases
  createScheduleUseCase: CreateScheduleUseCase;
  updateScheduleUseCase: UpdateScheduleUseCase;
  closeScheduleUseCase: CloseScheduleUseCase;
  reopenScheduleUseCase: ReopenScheduleUseCase;
  deleteScheduleUseCase: DeleteScheduleUseCase;
  getScheduleUseCase: GetScheduleUseCase;
  findSchedulesUseCase: FindSchedulesUseCase;
  getScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  deadlineReminderUseCase: DeadlineReminderUseCase;
  processReminderUseCase: ProcessReminderUseCase;
  processDeadlineRemindersUseCase: ProcessDeadlineRemindersUseCase;

  // Response Use Cases
  submitResponseUseCase: SubmitResponseUseCase;
  updateResponseUseCase: UpdateResponseUseCase;
  getResponseUseCase: GetResponseUseCase;
}

export interface InfrastructureServices {
  repositoryFactory: IRepositoryFactory;
  discordApiService: IDiscordApiService;
}

export class DependencyContainer {
  private readonly _infrastructureServices: InfrastructureServices;
  private readonly _applicationServices: ApplicationServices;
  private readonly _env: Env;

  constructor(env: Env) {
    this._env = env;
    // Infrastructure Services
    this._infrastructureServices = this.createInfrastructureServices(env);

    // Application Services
    this._applicationServices = this.createApplicationServices(this._infrastructureServices);
  }

  get infrastructureServices(): InfrastructureServices {
    return this._infrastructureServices;
  }

  get applicationServices(): ApplicationServices {
    return this._applicationServices;
  }

  private createInfrastructureServices(env: Env): InfrastructureServices {
    const repositoryFactory = createRepositoryFactory(env);
    const discordApiService = new DiscordApiService();

    return {
      repositoryFactory,
      discordApiService,
    };
  }

  private createApplicationServices(infrastructure: InfrastructureServices): ApplicationServices {
    const scheduleRepository = infrastructure.repositoryFactory.getScheduleRepository();
    const responseRepository = infrastructure.repositoryFactory.getResponseRepository();

    // Create base use cases
    const createScheduleUseCase = new CreateScheduleUseCase(scheduleRepository);
    const updateScheduleUseCase = new UpdateScheduleUseCase(scheduleRepository);
    const closeScheduleUseCase = new CloseScheduleUseCase(scheduleRepository);
    const reopenScheduleUseCase = new ReopenScheduleUseCase(scheduleRepository);
    const deleteScheduleUseCase = new DeleteScheduleUseCase(scheduleRepository, responseRepository);
    const getScheduleUseCase = new GetScheduleUseCase(scheduleRepository, responseRepository);
    const findSchedulesUseCase = new FindSchedulesUseCase(scheduleRepository);
    const getScheduleSummaryUseCase = new GetScheduleSummaryUseCase(scheduleRepository, responseRepository);
    const deadlineReminderUseCase = new DeadlineReminderUseCase(scheduleRepository);
    const processReminderUseCase = new ProcessReminderUseCase(scheduleRepository);
    const submitResponseUseCase = new SubmitResponseUseCase(scheduleRepository, responseRepository);
    const updateResponseUseCase = new UpdateResponseUseCase(scheduleRepository, responseRepository);
    const getResponseUseCase = new GetResponseUseCase(responseRepository);

    // Create NotificationService if credentials are available
    let notificationService: NotificationService | null = null;
    if (this._env.DISCORD_TOKEN && this._env.DISCORD_APPLICATION_ID) {
      notificationService = new NotificationService(
        scheduleRepository,
        responseRepository,
        getScheduleSummaryUseCase,
        this._env.DISCORD_TOKEN,
        this._env.DISCORD_APPLICATION_ID
      );
    }

    // Create composite use case
    const processDeadlineRemindersUseCase = notificationService
      ? new ProcessDeadlineRemindersUseCase(
          deadlineReminderUseCase,
          getScheduleUseCase,
          getScheduleSummaryUseCase,
          processReminderUseCase,
          closeScheduleUseCase,
          notificationService,
          this._env
        )
      : null;

    return {
      // Schedule Use Cases
      createScheduleUseCase,
      updateScheduleUseCase,
      closeScheduleUseCase,
      reopenScheduleUseCase,
      deleteScheduleUseCase,
      getScheduleUseCase,
      findSchedulesUseCase,
      getScheduleSummaryUseCase,
      deadlineReminderUseCase,
      processReminderUseCase,
      processDeadlineRemindersUseCase: processDeadlineRemindersUseCase!,

      // Response Use Cases
      submitResponseUseCase,
      updateResponseUseCase,
      getResponseUseCase,
    };
  }

  // Schedule Use Cases便利アクセサー
  get createScheduleUseCase() { return this._applicationServices.createScheduleUseCase; }
  get updateScheduleUseCase() { return this._applicationServices.updateScheduleUseCase; }
  get closeScheduleUseCase() { return this._applicationServices.closeScheduleUseCase; }
  get reopenScheduleUseCase() { return this._applicationServices.reopenScheduleUseCase; }
  get deleteScheduleUseCase() { return this._applicationServices.deleteScheduleUseCase; }
  get getScheduleUseCase() { return this._applicationServices.getScheduleUseCase; }
  get findSchedulesUseCase() { return this._applicationServices.findSchedulesUseCase; }
  get getScheduleSummaryUseCase() { return this._applicationServices.getScheduleSummaryUseCase; }
  get deadlineReminderUseCase() { return this._applicationServices.deadlineReminderUseCase; }
  get processReminderUseCase() { return this._applicationServices.processReminderUseCase; }
  get processDeadlineRemindersUseCase() { return this._applicationServices.processDeadlineRemindersUseCase; }

  // Response Use Cases便利アクセサー
  get submitResponseUseCase() { return this._applicationServices.submitResponseUseCase; }
  get updateResponseUseCase() { return this._applicationServices.updateResponseUseCase; }
  get getResponseUseCase() { return this._applicationServices.getResponseUseCase; }

  /**
   * テスト用にサービスをモックで置き換え
   */
  replaceService<K extends keyof ApplicationServices>(
    serviceName: K,
    mockService: ApplicationServices[K]
  ): void {
    (this._applicationServices as Record<keyof ApplicationServices, unknown>)[serviceName] = mockService;
  }

  /**
   * インフラストラクチャサービスをモックで置き換え
   */
  replaceInfrastructureService<K extends keyof InfrastructureServices>(
    serviceName: K,
    mockService: InfrastructureServices[K]
  ): void {
    (this._infrastructureServices as Record<keyof InfrastructureServices, unknown>)[serviceName] = mockService;
  }
}