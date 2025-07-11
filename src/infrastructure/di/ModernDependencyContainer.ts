/**
 * Modern Dependency Container
 * 
 * 新しいDIシステムを使用した改良版依存関係コンテナ
 * 従来のDependencyContainerとの後方互換性を保持
 */

import { Env } from '../types/discord';
import { DIContainer, ServiceAccessor, SERVICE_TOKENS } from './DIContainer';
import { registerServices, ServiceConfiguration, registerServicesWithConfig } from './ServiceRegistration';

// Legacy interfaces for backward compatibility
export interface ApplicationServices {
  createScheduleUseCase: any;
  updateScheduleUseCase: any;
  closeScheduleUseCase: any;
  reopenScheduleUseCase: any;
  deleteScheduleUseCase: any;
  getScheduleUseCase: any;
  findSchedulesUseCase: any;
  getScheduleSummaryUseCase: any;
  deadlineReminderUseCase: any;
  processReminderUseCase: any;
  processDeadlineRemindersUseCase: any;
  submitResponseUseCase: any;
  updateResponseUseCase: any;
  getResponseUseCase: any;
}

export interface InfrastructureServices {
  repositoryFactory: any;
  discordApiService: any;
}

/**
 * Modern DependencyContainer with enhanced DI capabilities
 */
export class ModernDependencyContainer {
  private readonly container: DIContainer;
  private readonly accessor: ServiceAccessor;
  private readonly env: Env;
  private _applicationServices?: ApplicationServices;
  private _infrastructureServices?: InfrastructureServices;

  constructor(env: Env, config?: ServiceConfiguration) {
    this.env = env;
    this.container = new DIContainer();
    this.accessor = new ServiceAccessor(this.container);

    // Register all services
    if (config) {
      registerServicesWithConfig(this.container, env, config);
    } else {
      registerServices(this.container, env);
    }
  }

  // Modern service access methods
  getContainer(): DIContainer {
    return this.container;
  }

  getAccessor(): ServiceAccessor {
    return this.accessor;
  }

  // Service resolution with type safety
  resolve<T>(token: string | symbol): T {
    return this.container.resolve<T>(token);
  }

  // Create scoped container for request-level services
  createScope(): ModernDependencyContainer {
    const scopedContainer = new ModernDependencyContainer(this.env);
    // Copy the parent container's registrations
    return scopedContainer;
  }

  // Legacy compatibility methods
  get applicationServices(): ApplicationServices {
    if (!this._applicationServices) {
      this._applicationServices = {
        createScheduleUseCase: this.accessor.getCreateScheduleUseCase(),
        updateScheduleUseCase: this.accessor.getUpdateScheduleUseCase(),
        closeScheduleUseCase: this.accessor.getCloseScheduleUseCase(),
        reopenScheduleUseCase: this.accessor.getReopenScheduleUseCase(),
        deleteScheduleUseCase: this.accessor.getDeleteScheduleUseCase(),
        getScheduleUseCase: this.accessor.getGetScheduleUseCase(),
        findSchedulesUseCase: this.accessor.getFindSchedulesUseCase(),
        getScheduleSummaryUseCase: this.accessor.getGetScheduleSummaryUseCase(),
        deadlineReminderUseCase: this.accessor.getDeadlineReminderUseCase(),
        processReminderUseCase: this.accessor.getProcessReminderUseCase(),
        processDeadlineRemindersUseCase: this.container.isRegistered(SERVICE_TOKENS.PROCESS_DEADLINE_REMINDERS_USE_CASE)
          ? this.accessor.getProcessDeadlineRemindersUseCase()
          : null,
        submitResponseUseCase: this.accessor.getSubmitResponseUseCase(),
        updateResponseUseCase: this.accessor.getUpdateResponseUseCase(),
        getResponseUseCase: this.accessor.getGetResponseUseCase(),
      };
    }
    return this._applicationServices;
  }

  get infrastructureServices(): InfrastructureServices {
    if (!this._infrastructureServices) {
      this._infrastructureServices = {
        repositoryFactory: this.accessor.getRepositoryFactory(),
        discordApiService: this.accessor.getDiscordApiService(),
      };
    }
    return this._infrastructureServices;
  }

  // Individual use case getters for backward compatibility
  getCreateScheduleUseCase() {
    return this.accessor.getCreateScheduleUseCase();
  }

  getUpdateScheduleUseCase() {
    return this.accessor.getUpdateScheduleUseCase();
  }

  getCloseScheduleUseCase() {
    return this.accessor.getCloseScheduleUseCase();
  }

  getReopenScheduleUseCase() {
    return this.accessor.getReopenScheduleUseCase();
  }

  getDeleteScheduleUseCase() {
    return this.accessor.getDeleteScheduleUseCase();
  }

  getGetScheduleUseCase() {
    return this.accessor.getGetScheduleUseCase();
  }

  getFindSchedulesUseCase() {
    return this.accessor.getFindSchedulesUseCase();
  }

  getGetScheduleSummaryUseCase() {
    return this.accessor.getGetScheduleSummaryUseCase();
  }

  getDeadlineReminderUseCase() {
    return this.accessor.getDeadlineReminderUseCase();
  }

  getProcessReminderUseCase() {
    return this.accessor.getProcessReminderUseCase();
  }

  getProcessDeadlineRemindersUseCase() {
    return this.container.isRegistered(SERVICE_TOKENS.PROCESS_DEADLINE_REMINDERS_USE_CASE)
      ? this.accessor.getProcessDeadlineRemindersUseCase()
      : null;
  }

  getSubmitResponseUseCase() {
    return this.accessor.getSubmitResponseUseCase();
  }

  getUpdateResponseUseCase() {
    return this.accessor.getUpdateResponseUseCase();
  }

  getGetResponseUseCase() {
    return this.accessor.getGetResponseUseCase();
  }

  getScheduleRepository() {
    return this.accessor.getScheduleRepository();
  }

  getResponseRepository() {
    return this.accessor.getResponseRepository();
  }

  getNotificationService() {
    return this.container.isRegistered(SERVICE_TOKENS.NOTIFICATION_SERVICE)
      ? this.accessor.getNotificationService()
      : null;
  }

  // Mock replacement methods for testing (backward compatibility)
  replaceScheduleRepository(mockRepository: any): void {
    this.container.registerInstance(SERVICE_TOKENS.SCHEDULE_REPOSITORY, mockRepository);
    // Clear cached services that depend on this
    this._applicationServices = undefined;
    this._infrastructureServices = undefined;
  }

  replaceResponseRepository(mockRepository: any): void {
    this.container.registerInstance(SERVICE_TOKENS.RESPONSE_REPOSITORY, mockRepository);
    // Clear cached services that depend on this
    this._applicationServices = undefined;
    this._infrastructureServices = undefined;
  }

  replaceNotificationService(mockService: any): void {
    this.container.registerInstance(SERVICE_TOKENS.NOTIFICATION_SERVICE, mockService);
    this._applicationServices = undefined;
  }

  // Lifecycle management
  dispose(): void {
    this.container.dispose();
  }

  // Health check for container
  healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const requiredServices = [
      SERVICE_TOKENS.REPOSITORY_FACTORY,
      SERVICE_TOKENS.DISCORD_API_SERVICE,
      SERVICE_TOKENS.SCHEDULE_REPOSITORY,
      SERVICE_TOKENS.RESPONSE_REPOSITORY,
    ];

    for (const token of requiredServices) {
      if (!this.container.isRegistered(token)) {
        issues.push(`Required service not registered: ${String(token)}`);
      }
    }

    // Test service resolution
    try {
      this.accessor.getScheduleRepository();
      this.accessor.getResponseRepository();
    } catch (error) {
      issues.push(`Service resolution failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  // Service configuration for different environments
  static createForTesting(env: Env): ModernDependencyContainer {
    return new ModernDependencyContainer(env, {
      environment: 'testing',
      enableNotifications: false,
      enableDebugLogging: true,
      useMockServices: true
    });
  }

  static createForProduction(env: Env): ModernDependencyContainer {
    return new ModernDependencyContainer(env, {
      environment: 'production',
      enableNotifications: true,
      enableDebugLogging: false,
      useMockServices: false
    });
  }

  static createForDevelopment(env: Env): ModernDependencyContainer {
    return new ModernDependencyContainer(env, {
      environment: 'development',
      enableNotifications: true,
      enableDebugLogging: true,
      useMockServices: false
    });
  }
}