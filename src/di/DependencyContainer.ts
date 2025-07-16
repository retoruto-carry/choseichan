/**
 * 依存性注入コンテナ
 *
 * アプリケーション全体の依存関係を管理
 * Clean Architectureの依存性の注入を実現
 */

import type { BackgroundExecutorPort } from '../application/ports/BackgroundExecutorPort';
import type { DeadlineReminderQueuePort } from '../application/ports/DeadlineReminderQueuePort';
import type { MessageUpdateQueuePort } from '../application/ports/MessageUpdateQueuePort';
import { MessageUpdateService } from '../application/services/MessageUpdateService';
import { NotificationService } from '../application/services/NotificationService';
import { ScheduleUpdaterService } from '../application/services/ScheduleUpdaterService';
import { ProcessMessageUpdateUseCase } from '../application/usecases/message/ProcessMessageUpdateUseCase';
import { ProcessDeadlineRemindersUseCase } from '../application/usecases/ProcessDeadlineRemindersUseCase';
import { GetResponseUseCase } from '../application/usecases/response/GetResponseUseCase';
import { SubmitResponseUseCase } from '../application/usecases/response/SubmitResponseUseCase';
import { UpdateResponseUseCase } from '../application/usecases/response/UpdateResponseUseCase';
import { CloseScheduleUseCase } from '../application/usecases/schedule/CloseScheduleUseCase';
// アプリケーション層ユースケース
import { CreateScheduleUseCase } from '../application/usecases/schedule/CreateScheduleUseCase';
import { DeadlineReminderUseCase } from '../application/usecases/schedule/DeadlineReminderUseCase';
import { DeleteScheduleUseCase } from '../application/usecases/schedule/DeleteScheduleUseCase';
import { FindSchedulesUseCase } from '../application/usecases/schedule/FindSchedulesUseCase';
import { GetScheduleSummaryUseCase } from '../application/usecases/schedule/GetScheduleSummaryUseCase';
import { GetScheduleUseCase } from '../application/usecases/schedule/GetScheduleUseCase';
import { ProcessReminderUseCase } from '../application/usecases/schedule/ProcessReminderUseCase';
import { UpdateScheduleUseCase } from '../application/usecases/schedule/UpdateScheduleUseCase';
import type { IRepositoryFactory } from '../domain/repositories/interfaces';
import type { MessageUpdateService as IMessageUpdateService } from '../domain/services/MessageUpdateService';
import { CloudflareQueueAdapter } from '../infrastructure/adapters/CloudflareQueueAdapter';
import { DeadlineReminderQueueAdapter } from '../infrastructure/adapters/DeadlineReminderQueueAdapter';
import { DiscordApiAdapter } from '../infrastructure/adapters/DiscordApiAdapter';
import { EnvironmentAdapter } from '../infrastructure/adapters/EnvironmentAdapter';
import { LoggerAdapter } from '../infrastructure/adapters/LoggerAdapter';
import { TestBackgroundExecutorAdapter } from '../infrastructure/adapters/TestBackgroundExecutorAdapter';
import { WorkersBackgroundExecutorAdapter } from '../infrastructure/adapters/WorkersBackgroundExecutorAdapter';
import type { Env } from '../infrastructure/types/discord';
import { DiscordMessageService } from '../presentation/services/DiscordMessageService';
import { createRepositoryFactory } from './factory';

export interface ApplicationServices {
  // スケジュール関連ユースケース
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

  // 回答関連ユースケース
  submitResponseUseCase: SubmitResponseUseCase;
  updateResponseUseCase: UpdateResponseUseCase;
  getResponseUseCase: GetResponseUseCase;

  // メッセージ更新ユースケース
  processMessageUpdateUseCase: ProcessMessageUpdateUseCase | null;

  // サービス
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
  messageUpdateService: IMessageUpdateService;
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
    const messageUpdateService = new MessageUpdateService(infrastructure.messageUpdateQueuePort);

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

    // アダプター作成
    const loggerAdapter = new LoggerAdapter();
    const discordApiAdapter = new DiscordApiAdapter();

    // 基本ユースケース作成
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

    // 認証情報が利用可能な場合、通知サービスを作成
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
        new DiscordMessageService()
      );
    }

    // 複合ユースケース作成
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

    // メッセージ更新ユースケース作成
    const processMessageUpdateUseCase = this._env.DISCORD_TOKEN
      ? new ProcessMessageUpdateUseCase(
          loggerAdapter,
          getScheduleSummaryUseCase,
          discordApiAdapter,
          new DiscordMessageService(),
          this._env.DISCORD_TOKEN
        )
      : null;

    // スケジュール更新サービス作成
    const scheduleUpdaterService = new ScheduleUpdaterService(
      getScheduleUseCase,
      getScheduleSummaryUseCase,
      updateScheduleUseCase,
      discordApiAdapter,
      new DiscordMessageService(),
      loggerAdapter
    );

    return {
      // スケジュール関連ユースケース
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

      // 回答関連ユースケース
      submitResponseUseCase,
      updateResponseUseCase,
      getResponseUseCase,

      // メッセージ更新ユースケース
      processMessageUpdateUseCase,

      // サービス
      notificationService,
      scheduleUpdaterService,
    };
  }

  // スケジュール関連ユースケース便利アクセサー
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

  // 回答関連ユースケース便利アクセサー
  get submitResponseUseCase() {
    return this._applicationServices.submitResponseUseCase;
  }
  get updateResponseUseCase() {
    return this._applicationServices.updateResponseUseCase;
  }
  get getResponseUseCase() {
    return this._applicationServices.getResponseUseCase;
  }

  // メッセージ更新ユースケース便利アクセサー
  get processMessageUpdateUseCase() {
    return this._applicationServices.processMessageUpdateUseCase;
  }

  // ドメインサービス便利アクセサー
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
