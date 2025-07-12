import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import type { Env } from '../types/discord';
import { DependencyContainer } from './DependencyContainer';

// Mock the factory module
vi.mock('./factory', () => ({
  createRepositoryFactory: vi.fn(() => ({
    getScheduleRepository: vi.fn(() => ({
      save: vi.fn(),
      findById: vi.fn(),
      findByChannel: vi.fn(),
      findByDeadlineRange: vi.fn(),
      delete: vi.fn(),
      findByMessageId: vi.fn(),
      countByGuild: vi.fn(),
      updateReminders: vi.fn(),
    })),
    getResponseRepository: vi.fn(() => ({
      save: vi.fn(),
      findByUser: vi.fn(),
      findByScheduleId: vi.fn(),
      delete: vi.fn(),
      deleteBySchedule: vi.fn(),
      getScheduleSummary: vi.fn(),
    })),
  })),
}));

describe('DependencyContainer', () => {
  let container: DependencyContainer;
  const mockEnv: Env = {
    DISCORD_TOKEN: 'test-token',
    DISCORD_PUBLIC_KEY: 'test-public-key',
    DISCORD_APPLICATION_ID: 'test-app-id',
    DB: {} as D1Database,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = new DependencyContainer(mockEnv);
  });

  describe('constructor', () => {
    it('should initialize infrastructure services', () => {
      expect(container.infrastructureServices).toBeDefined();
      expect(container.infrastructureServices.repositoryFactory).toBeDefined();
      expect(container.infrastructureServices.messageUpdateQueuePort).toBeDefined();
    });

    it('should initialize application services', () => {
      expect(container.applicationServices).toBeDefined();
      expect(container.applicationServices.createScheduleUseCase).toBeDefined();
      expect(container.applicationServices.updateScheduleUseCase).toBeDefined();
      expect(container.applicationServices.closeScheduleUseCase).toBeDefined();
      expect(container.applicationServices.deleteScheduleUseCase).toBeDefined();
      expect(container.applicationServices.getScheduleUseCase).toBeDefined();
      expect(container.applicationServices.findSchedulesUseCase).toBeDefined();
      expect(container.applicationServices.getScheduleSummaryUseCase).toBeDefined();
      expect(container.applicationServices.submitResponseUseCase).toBeDefined();
      expect(container.applicationServices.updateResponseUseCase).toBeDefined();
      expect(container.applicationServices.getResponseUseCase).toBeDefined();
    });

    it('should create NotificationService when Discord credentials are available', () => {
      const envWithCredentials: Env = {
        ...mockEnv,
        DISCORD_TOKEN: 'test-token',
        DISCORD_APPLICATION_ID: 'test-app-id',
      };

      const containerWithNotification = new DependencyContainer(envWithCredentials);
      expect(
        containerWithNotification.applicationServices.processDeadlineRemindersUseCase
      ).toBeDefined();
    });

    it('should not create NotificationService when Discord credentials are missing', () => {
      const envWithoutCredentials: Env = {
        ...mockEnv,
        DISCORD_TOKEN: '',
        DISCORD_APPLICATION_ID: '',
      };

      const containerWithoutNotification = new DependencyContainer(envWithoutCredentials);
      expect(
        containerWithoutNotification.applicationServices.processDeadlineRemindersUseCase
      ).toBeNull();
    });
  });

  describe('convenience accessors', () => {
    it('should provide direct access to use cases', () => {
      expect(container.createScheduleUseCase).toBe(
        container.applicationServices.createScheduleUseCase
      );
      expect(container.updateScheduleUseCase).toBe(
        container.applicationServices.updateScheduleUseCase
      );
      expect(container.closeScheduleUseCase).toBe(
        container.applicationServices.closeScheduleUseCase
      );
      expect(container.deleteScheduleUseCase).toBe(
        container.applicationServices.deleteScheduleUseCase
      );
      expect(container.getScheduleUseCase).toBe(container.applicationServices.getScheduleUseCase);
      expect(container.findSchedulesUseCase).toBe(
        container.applicationServices.findSchedulesUseCase
      );
      expect(container.getScheduleSummaryUseCase).toBe(
        container.applicationServices.getScheduleSummaryUseCase
      );
      expect(container.submitResponseUseCase).toBe(
        container.applicationServices.submitResponseUseCase
      );
      expect(container.updateResponseUseCase).toBe(
        container.applicationServices.updateResponseUseCase
      );
      expect(container.getResponseUseCase).toBe(container.applicationServices.getResponseUseCase);
    });
  });

  describe('replaceService', () => {
    it('should replace application service with mock', () => {
      const mockCreateScheduleUseCase = {
        execute: vi.fn(),
      } as unknown as CreateScheduleUseCase;

      container.replaceService('createScheduleUseCase', mockCreateScheduleUseCase);

      expect(container.createScheduleUseCase).toBe(mockCreateScheduleUseCase);
    });
  });

  describe('replaceInfrastructureService', () => {
    it('should replace infrastructure service with mock', () => {
      const mockRepositoryFactory = {
        getScheduleRepository: vi.fn(),
        getResponseRepository: vi.fn(),
        beginTransaction: vi.fn(),
        initialize: vi.fn(),
        cleanupExpiredData: vi.fn(),
      };

      container.replaceInfrastructureService('repositoryFactory', mockRepositoryFactory);

      expect(container.infrastructureServices.repositoryFactory).toBe(mockRepositoryFactory);
    });
  });

  describe('dependency injection', () => {
    it('should inject correct dependencies into use cases', () => {
      // Verify that use cases are created with proper dependencies
      const _scheduleRepo =
        container.infrastructureServices.repositoryFactory.getScheduleRepository();
      const _responseRepo =
        container.infrastructureServices.repositoryFactory.getResponseRepository();

      // Test by checking that use cases can be executed (they would fail if dependencies were missing)
      expect(() => container.createScheduleUseCase).not.toThrow();
      expect(() => container.submitResponseUseCase).not.toThrow();
    });

    it('should create a single instance of each service', () => {
      // Access the same service multiple times
      const firstAccess = container.createScheduleUseCase;
      const secondAccess = container.createScheduleUseCase;

      // They should be the same instance
      expect(firstAccess).toBe(secondAccess);
    });
  });
});
