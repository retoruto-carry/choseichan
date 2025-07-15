/**
 * Dependency Injection Container
 *
 * アプリケーション全体の依存関係を管理
 * Clean Architectureの依存性の注入を実現
 */

import type { BackgroundExecutorPort } from '../../application/ports/BackgroundExecutorPort';
import type { DeadlineReminderQueuePort } from '../../application/ports/DeadlineReminderQueuePort';
import type { MessageUpdateQueuePort } from '../../application/ports/MessageUpdateQueuePort';
import { MessageUpdateServiceImpl } from '../../application/services/MessageUpdateServiceImpl';
import { NotificationService } from '../../application/services/NotificationService';
import { ScheduleUpdaterService } from '../../application/services/ScheduleUpdaterService';
import { ProcessMessageUpdateUseCase } from '../../application/usecases/message/ProcessMessageUpdateUseCase';
import { ProcessDeadlineRemindersUseCase } from '../../application/usecases/ProcessDeadlineRemindersUseCase';
import { GetResponseUseCase } from '../../application/usecases/response/GetResponseUseCase';
import { SubmitResponseUseCase } from '../../application/usecases/response/SubmitResponseUseCase';
import { UpdateResponseUseCase } from '../../application/usecases/response/UpdateResponseUseCase';
import { CloseScheduleUseCase } from '../../application/usecases/schedule/CloseScheduleUseCase';
// Application Layer Use Cases
import { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import { DeadlineReminderUseCase } from '../../application/usecases/schedule/DeadlineReminderUseCase';
import { DeleteScheduleUseCase } from '../../application/usecases/schedule/DeleteScheduleUseCase';
import { FindSchedulesUseCase } from '../../application/usecases/schedule/FindSchedulesUseCase';
import { GetScheduleSummaryUseCase } from '../../application/usecases/schedule/GetScheduleSummaryUseCase';
import { GetScheduleUseCase } from '../../application/usecases/schedule/GetScheduleUseCase';
import { ProcessReminderUseCase } from '../../application/usecases/schedule/ProcessReminderUseCase';
import { UpdateScheduleUseCase } from '../../application/usecases/schedule/UpdateScheduleUseCase';
import type { IRepositoryFactory } from '../../domain/repositories/interfaces';
import type { MessageUpdateService } from '../../domain/services/MessageUpdateService';
import { CloudflareQueueAdapter } from '../adapters/CloudflareQueueAdapter';
import { DeadlineReminderQueueAdapter } from '../adapters/DeadlineReminderQueueAdapter';
import { DiscordApiAdapter } from '../adapters/DiscordApiAdapter';
import { EnvironmentAdapter } from '../adapters/EnvironmentAdapter';
import { LoggerAdapter } from '../adapters/LoggerAdapter';
import { MessageFormatterAdapter } from '../adapters/MessageFormatterAdapter';
import { TestBackgroundExecutorAdapter } from '../adapters/TestBackgroundExecutorAdapter';
import { WorkersBackgroundExecutorAdapter } from '../adapters/WorkersBackgroundExecutorAdapter';
import type { Env } from '../types/discord';
import { createRepositoryFactory } from './factory';

export interface ApplicationServices {
  // Schedule Use Cases
  createScheduleUseCase: CreateScheduleUseCase;
  updateScheduleUseCase: UpdateScheduleUseCase;
  closeScheduleUseCase: CloseScheduleUseCase;
  deleteScheduleUseCase: DeleteScheduleUseCase;
  getScheduleUseCase: GetScheduleUseCase;
  findSchedulesUseCase: FindSchedulesUseCase;
  getScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  deadlineReminderUseCase: DeadlineReminderUseCase;
  processReminderUseCase: ProcessReminderUseCase;
  processDeadlineRemindersUseCase: ProcessDeadlineRemindersUseCase | null;

  // Response Use Cases
  submitResponseUseCase: SubmitResponseUseCase;
  updateResponseUseCase: UpdateResponseUseCase;
  getResponseUseCase: GetResponseUseCase;

  // Message Update Use Cases
  processMessageUpdateUseCase: ProcessMessageUpdateUseCase | null;

  // Services
  notificationService: NotificationService | null;
  scheduleUpdaterService: ScheduleUpdaterService;
}

export interface InfrastructureServices {
  repositoryFactory: IRepositoryFactory;
  messageUpdateQueuePort: MessageUpdateQueuePort;
  backgroundExecutor: BackgroundExecutorPort;
  deadlineReminderQueue?: DeadlineReminderQueuePort;
}

export interface DomainServices {
  messageUpdateService: MessageUpdateService;
}

export class DependencyContainer {
  private readonly _infrastructureServices: InfrastructureServices;
  private readonly _domainServices: DomainServices;
  private readonly _applicationServices: ApplicationServices;
  private readonly _env: Env;

  constructor(env: Env) {
    this._env = env;
    // Infrastructure Services
    this._infrastructureServices = this.createInfrastructureServices(env);

    // Domain Services
    this._domainServices = this.createDomainServices(this._infrastructureServices);

    // Application Services
    this._applicationServices = this.createApplicationServices(
      this._infrastructureServices,
      this._domainServices
    );
  }

  get infrastructureServices(): InfrastructureServices {
    return this._infrastructureServices;
  }

  get domainServices(): DomainServices {
    return this._domainServices;
  }

  get applicationServices(): ApplicationServices {
    return this._applicationServices;
  }

  private createInfrastructureServices(env: Env): InfrastructureServices {
    const repositoryFactory = createRepositoryFactory(env);
    const messageUpdateQueuePort = new CloudflareQueueAdapter(env.MESSAGE_UPDATE_QUEUE);

    // BackgroundExecutor: Workers環境かどうかでアダプターを切り替え
    const backgroundExecutor = env.ctx
      ? new WorkersBackgroundExecutorAdapter(env.ctx)
      : new TestBackgroundExecutorAdapter();

    // DeadlineReminderQueue: 利用可能な場合のみ
    const deadlineReminderQueue = env.DEADLINE_REMINDER_QUEUE
      ? new DeadlineReminderQueueAdapter(env.DEADLINE_REMINDER_QUEUE)
      : undefined;

    return {
      repositoryFactory,
      messageUpdateQueuePort,
      backgroundExecutor,
      deadlineReminderQueue,
    };
  }

  private createDomainServices(infrastructure: InfrastructureServices): DomainServices {
    const messageUpdateService = new MessageUpdateServiceImpl(
      infrastructure.messageUpdateQueuePort
    );

    return {
      messageUpdateService,
    };
  }

  private createApplicationServices(
    infrastructure: InfrastructureServices,
    _domainServices: DomainServices
  ): ApplicationServices {
    const scheduleRepository = infrastructure.repositoryFactory.getScheduleRepository();
    const responseRepository = infrastructure.repositoryFactory.getResponseRepository();

    // Create Adapters
    const loggerAdapter = new LoggerAdapter();
    const discordApiAdapter = new DiscordApiAdapter();

    // Create base use cases
    const createScheduleUseCase = new CreateScheduleUseCase(scheduleRepository, loggerAdapter);
    const updateScheduleUseCase = new UpdateScheduleUseCase(scheduleRepository, loggerAdapter);
    const closeScheduleUseCase = new CloseScheduleUseCase(scheduleRepository);
    const deleteScheduleUseCase = new DeleteScheduleUseCase(scheduleRepository, responseRepository);
    const getScheduleUseCase = new GetScheduleUseCase(scheduleRepository, responseRepository);
    const findSchedulesUseCase = new FindSchedulesUseCase(scheduleRepository);
    const getScheduleSummaryUseCase = new GetScheduleSummaryUseCase(
      scheduleRepository,
      responseRepository
    );
    const deadlineReminderUseCase = new DeadlineReminderUseCase(
      new LoggerAdapter(),
      scheduleRepository
    );
    const processReminderUseCase = new ProcessReminderUseCase(scheduleRepository);
    const submitResponseUseCase = new SubmitResponseUseCase(scheduleRepository, responseRepository);
    const updateResponseUseCase = new UpdateResponseUseCase(scheduleRepository, responseRepository);
    const getResponseUseCase = new GetResponseUseCase(responseRepository);

    const environmentAdapter = new EnvironmentAdapter(this._env);

    // Create NotificationService if credentials are available
    let notificationService: NotificationService | null = null;
    if (this._env.DISCORD_TOKEN && this._env.DISCORD_APPLICATION_ID) {
      notificationService = new NotificationService(
        loggerAdapter,
        discordApiAdapter,
        scheduleRepository,
        responseRepository,
        getScheduleSummaryUseCase,
        this._env.DISCORD_TOKEN,
        this._env.DISCORD_APPLICATION_ID,
        infrastructure.backgroundExecutor,
        new MessageFormatterAdapter()
      );
    }

    // Create composite use case
    const processDeadlineRemindersUseCase = notificationService
      ? new ProcessDeadlineRemindersUseCase(
          loggerAdapter,
          deadlineReminderUseCase,
          getScheduleUseCase,
          getScheduleSummaryUseCase,
          processReminderUseCase,
          closeScheduleUseCase,
          notificationService,
          environmentAdapter,
          infrastructure.deadlineReminderQueue
        )
      : null;

    // Create message update use case
    const processMessageUpdateUseCase = this._env.DISCORD_TOKEN
      ? new ProcessMessageUpdateUseCase(
          loggerAdapter,
          getScheduleSummaryUseCase,
          discordApiAdapter,
          new MessageFormatterAdapter(),
          this._env.DISCORD_TOKEN
        )
      : null;

    // Create ScheduleUpdaterService
    const scheduleUpdaterService = new ScheduleUpdaterService(
      getScheduleUseCase,
      getScheduleSummaryUseCase,
      updateScheduleUseCase,
      discordApiAdapter,
      new MessageFormatterAdapter(),
      loggerAdapter
    );

    return {
      // Schedule Use Cases
      createScheduleUseCase,
      updateScheduleUseCase,
      closeScheduleUseCase,
      deleteScheduleUseCase,
      getScheduleUseCase,
      findSchedulesUseCase,
      getScheduleSummaryUseCase,
      deadlineReminderUseCase,
      processReminderUseCase,
      processDeadlineRemindersUseCase,

      // Response Use Cases
      submitResponseUseCase,
      updateResponseUseCase,
      getResponseUseCase,

      // Message Update Use Cases
      processMessageUpdateUseCase,

      // Services
      notificationService,
      scheduleUpdaterService,
    };
  }

  // Schedule Use Cases便利アクセサー
  get createScheduleUseCase() {
    return this._applicationServices.createScheduleUseCase;
  }
  get updateScheduleUseCase() {
    return this._applicationServices.updateScheduleUseCase;
  }
  get closeScheduleUseCase() {
    return this._applicationServices.closeScheduleUseCase;
  }
  get deleteScheduleUseCase() {
    return this._applicationServices.deleteScheduleUseCase;
  }
  get getScheduleUseCase() {
    return this._applicationServices.getScheduleUseCase;
  }
  get findSchedulesUseCase() {
    return this._applicationServices.findSchedulesUseCase;
  }
  get getScheduleSummaryUseCase() {
    return this._applicationServices.getScheduleSummaryUseCase;
  }
  get deadlineReminderUseCase() {
    return this._applicationServices.deadlineReminderUseCase;
  }
  get processReminderUseCase() {
    return this._applicationServices.processReminderUseCase;
  }
  get processDeadlineRemindersUseCase() {
    return this._applicationServices.processDeadlineRemindersUseCase;
  }

  // Response Use Cases便利アクセサー
  get submitResponseUseCase() {
    return this._applicationServices.submitResponseUseCase;
  }
  get updateResponseUseCase() {
    return this._applicationServices.updateResponseUseCase;
  }
  get getResponseUseCase() {
    return this._applicationServices.getResponseUseCase;
  }

  // Message Update Use Cases便利アクセサー
  get processMessageUpdateUseCase() {
    return this._applicationServices.processMessageUpdateUseCase;
  }

  // Domain Services便利アクセサー
  get messageUpdateService() {
    return this._domainServices.messageUpdateService;
  }

  /**
   * テスト用にサービスをモックで置き換え
   */
  replaceService<K extends keyof ApplicationServices>(
    serviceName: K,
    mockService: ApplicationServices[K]
  ): void {
    (this._applicationServices as Record<keyof ApplicationServices, unknown>)[serviceName] =
      mockService;
  }

  /**
   * インフラストラクチャサービスをモックで置き換え
   */
  replaceInfrastructureService<K extends keyof InfrastructureServices>(
    serviceName: K,
    mockService: InfrastructureServices[K]
  ): void {
    (this._infrastructureServices as Record<keyof InfrastructureServices, unknown>)[serviceName] =
      mockService;
  }

  // 環境変数アクセサー
  get env(): Env {
    return this._env;
  }
}
