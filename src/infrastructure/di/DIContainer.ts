/**
 * Enhanced Dependency Injection Container
 *
 * 高度なDIコンテナ実装:
 * - Lazy loading
 * - Singleton lifecycle management
 * - Service registration patterns
 * - Configuration-based injection
 * - Circular dependency detection
 */

export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

export interface ServiceDescriptor<T = unknown> {
  token: string | symbol;
  factory: (container: IDIContainer) => T;
  lifetime: ServiceLifetime;
  dependencies?: (string | symbol)[];
}

export interface IDIContainer {
  register<T>(descriptor: ServiceDescriptor<T>): void;
  registerSingleton<T>(token: string | symbol, factory: (container: IDIContainer) => T): void;
  registerTransient<T>(token: string | symbol, factory: (container: IDIContainer) => T): void;
  registerScoped<T>(token: string | symbol, factory: (container: IDIContainer) => T): void;
  registerInstance<T>(token: string | symbol, instance: T): void;
  resolve<T>(token: string | symbol): T;
  isRegistered(token: string | symbol): boolean;
  createScope(): IDIContainer;
  dispose(): void;
}

export class DIContainer implements IDIContainer {
  private services = new Map<string | symbol, ServiceDescriptor>();
  private instances = new Map<string | symbol, unknown>();
  private isDisposed = false;
  private readonly parent?: DIContainer;
  private readonly scopedServices = new Set<string | symbol>();
  private resolving = new Set<string | symbol>(); // For circular dependency detection

  constructor(parent?: DIContainer) {
    this.parent = parent;
  }

  register<T>(descriptor: ServiceDescriptor<T>): void {
    this.checkDisposed();
    this.services.set(descriptor.token, descriptor);
  }

  registerSingleton<T>(token: string | symbol, factory: (container: IDIContainer) => T): void {
    this.register({
      token,
      factory,
      lifetime: 'singleton',
    });
  }

  registerTransient<T>(token: string | symbol, factory: (container: IDIContainer) => T): void {
    this.register({
      token,
      factory,
      lifetime: 'transient',
    });
  }

  registerScoped<T>(token: string | symbol, factory: (container: IDIContainer) => T): void {
    this.register({
      token,
      factory,
      lifetime: 'scoped',
    });
  }

  registerInstance<T>(token: string | symbol, instance: T): void {
    this.checkDisposed();
    this.instances.set(token, instance);
  }

  resolve<T>(token: string | symbol): T {
    this.checkDisposed();

    // Check for circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected for service: ${String(token)}`);
    }

    // Try to get from instances first (for registered instances and singletons)
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Get service descriptor
    const descriptor = this.getServiceDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    // Mark as resolving for circular dependency detection
    this.resolving.add(token);

    try {
      const instance = this.createInstance(descriptor);

      // Store instance based on lifetime
      switch (descriptor.lifetime) {
        case 'singleton':
          this.instances.set(token, instance);
          break;
        case 'scoped':
          if (!this.parent) {
            // If this is a root container, treat scoped as singleton
            this.instances.set(token, instance);
            this.scopedServices.add(token);
          } else {
            // Store in current scope
            this.instances.set(token, instance);
            this.scopedServices.add(token);
          }
          break;
        case 'transient':
          // Don't store transient instances
          break;
      }

      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  isRegistered(token: string | symbol): boolean {
    return (
      this.services.has(token) ||
      this.instances.has(token) ||
      (this.parent?.isRegistered(token) ?? false)
    );
  }

  createScope(): IDIContainer {
    this.checkDisposed();
    return new DIContainer(this);
  }

  dispose(): void {
    if (this.isDisposed) return;

    // Dispose scoped services that implement IDisposable
    for (const token of this.scopedServices) {
      const instance = this.instances.get(token);
      if (
        instance &&
        typeof instance === 'object' &&
        'dispose' in instance &&
        typeof instance.dispose === 'function'
      ) {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`Error disposing service ${String(token)}:`, error);
        }
      }
    }

    this.instances.clear();
    this.services.clear();
    this.scopedServices.clear();
    this.isDisposed = true;
  }

  private getServiceDescriptor(token: string | symbol): ServiceDescriptor | undefined {
    return this.services.get(token) ?? this.parent?.getServiceDescriptor(token);
  }

  private createInstance<T>(descriptor: ServiceDescriptor<T>): T {
    try {
      return descriptor.factory(this);
    } catch (error) {
      throw new Error(`Failed to create service ${String(descriptor.token)}: ${error}`);
    }
  }

  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }
  }
}

// Service tokens - Use symbols for type safety
export const SERVICE_TOKENS = {
  // Infrastructure
  REPOSITORY_FACTORY: Symbol('RepositoryFactory'),
  DISCORD_API_SERVICE: Symbol('DiscordApiService'),
  SCHEDULE_REPOSITORY: Symbol('ScheduleRepository'),
  RESPONSE_REPOSITORY: Symbol('ResponseRepository'),

  // Adapters
  LOGGER_ADAPTER: Symbol('LoggerAdapter'),
  DISCORD_API_ADAPTER: Symbol('DiscordApiAdapter'),
  ENVIRONMENT_ADAPTER: Symbol('EnvironmentAdapter'),
  BACKGROUND_EXECUTOR: Symbol('BackgroundExecutor'),
  MESSAGE_FORMATTER: Symbol('MessageFormatter'),

  // Application Services
  NOTIFICATION_SERVICE: Symbol('NotificationService'),

  // Use Cases - Schedule
  CREATE_SCHEDULE_USE_CASE: Symbol('CreateScheduleUseCase'),
  UPDATE_SCHEDULE_USE_CASE: Symbol('UpdateScheduleUseCase'),
  CLOSE_SCHEDULE_USE_CASE: Symbol('CloseScheduleUseCase'),
  DELETE_SCHEDULE_USE_CASE: Symbol('DeleteScheduleUseCase'),
  GET_SCHEDULE_USE_CASE: Symbol('GetScheduleUseCase'),
  FIND_SCHEDULES_USE_CASE: Symbol('FindSchedulesUseCase'),
  GET_SCHEDULE_SUMMARY_USE_CASE: Symbol('GetScheduleSummaryUseCase'),
  DEADLINE_REMINDER_USE_CASE: Symbol('DeadlineReminderUseCase'),
  PROCESS_REMINDER_USE_CASE: Symbol('ProcessReminderUseCase'),
  PROCESS_DEADLINE_REMINDERS_USE_CASE: Symbol('ProcessDeadlineRemindersUseCase'),

  // Use Cases - Response
  SUBMIT_RESPONSE_USE_CASE: Symbol('SubmitResponseUseCase'),
  UPDATE_RESPONSE_USE_CASE: Symbol('UpdateResponseUseCase'),
  GET_RESPONSE_USE_CASE: Symbol('GetResponseUseCase'),

  // Environment
  ENV: Symbol('Env'),
} as const;

// Type-safe service accessor methods
export class ServiceAccessor {
  constructor(private container: IDIContainer) {}

  // Infrastructure
  getRepositoryFactory() {
    return this.container.resolve(SERVICE_TOKENS.REPOSITORY_FACTORY);
  }

  getDiscordApiService() {
    return this.container.resolve(SERVICE_TOKENS.DISCORD_API_SERVICE);
  }

  getScheduleRepository() {
    return this.container.resolve(SERVICE_TOKENS.SCHEDULE_REPOSITORY);
  }

  getResponseRepository() {
    return this.container.resolve(SERVICE_TOKENS.RESPONSE_REPOSITORY);
  }

  // Application Services
  getNotificationService() {
    return this.container.resolve(SERVICE_TOKENS.NOTIFICATION_SERVICE);
  }

  // Use Cases - Schedule
  getCreateScheduleUseCase() {
    return this.container.resolve(SERVICE_TOKENS.CREATE_SCHEDULE_USE_CASE);
  }

  getUpdateScheduleUseCase() {
    return this.container.resolve(SERVICE_TOKENS.UPDATE_SCHEDULE_USE_CASE);
  }

  getCloseScheduleUseCase() {
    return this.container.resolve(SERVICE_TOKENS.CLOSE_SCHEDULE_USE_CASE);
  }

  getDeleteScheduleUseCase() {
    return this.container.resolve(SERVICE_TOKENS.DELETE_SCHEDULE_USE_CASE);
  }

  getGetScheduleUseCase() {
    return this.container.resolve(SERVICE_TOKENS.GET_SCHEDULE_USE_CASE);
  }

  getFindSchedulesUseCase() {
    return this.container.resolve(SERVICE_TOKENS.FIND_SCHEDULES_USE_CASE);
  }

  getGetScheduleSummaryUseCase() {
    return this.container.resolve(SERVICE_TOKENS.GET_SCHEDULE_SUMMARY_USE_CASE);
  }

  getDeadlineReminderUseCase() {
    return this.container.resolve(SERVICE_TOKENS.DEADLINE_REMINDER_USE_CASE);
  }

  getProcessReminderUseCase() {
    return this.container.resolve(SERVICE_TOKENS.PROCESS_REMINDER_USE_CASE);
  }

  getProcessDeadlineRemindersUseCase() {
    return this.container.resolve(SERVICE_TOKENS.PROCESS_DEADLINE_REMINDERS_USE_CASE);
  }

  // Use Cases - Response
  getSubmitResponseUseCase() {
    return this.container.resolve(SERVICE_TOKENS.SUBMIT_RESPONSE_USE_CASE);
  }

  getUpdateResponseUseCase() {
    return this.container.resolve(SERVICE_TOKENS.UPDATE_RESPONSE_USE_CASE);
  }

  getGetResponseUseCase() {
    return this.container.resolve(SERVICE_TOKENS.GET_RESPONSE_USE_CASE);
  }
}
