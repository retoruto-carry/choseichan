/**
 * KV実装のリポジトリファクトリ
 */

import { IRepositoryFactory, IScheduleRepository, IResponseRepository, DatabaseConfig } from '../interfaces';
import { KVScheduleRepository } from './schedule-repository';
import { KVResponseRepository } from './response-repository';

export class KVRepositoryFactory implements IRepositoryFactory {
  private scheduleRepository: IScheduleRepository;
  private responseRepository: IResponseRepository;

  constructor(config: DatabaseConfig) {
    if (config.type !== 'kv' || !config.kvNamespaces) {
      throw new Error('Invalid configuration for KV repository factory');
    }

    this.scheduleRepository = new KVScheduleRepository(config.kvNamespaces.schedules);
    this.responseRepository = new KVResponseRepository(
      config.kvNamespaces.responses,
      this.scheduleRepository
    );
  }

  getScheduleRepository(): IScheduleRepository {
    return this.scheduleRepository;
  }

  getResponseRepository(): IResponseRepository {
    return this.responseRepository;
  }

  // KV doesn't support transactions
  async beginTransaction(): Promise<undefined> {
    return undefined;
  }
}