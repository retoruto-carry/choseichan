/**
 * Response Mapper
 * 
 * レガシー型とドメインエンティティ間の変換を行う
 */

import { Response as ResponseEntity } from '../../domain/entities/Response';
import { User as UserEntity } from '../../domain/entities/User';
import { ResponseStatus } from '../../domain/entities/ResponseStatus';
import { Response as ResponseLegacy, ResponseStatus as ResponseStatusLegacy } from '../../types/schedule-v2';

export class ResponseMapper {
  /**
   * レガシー型からドメインエンティティに変換
   */
  static toDomain(legacy: ResponseLegacy): ResponseEntity {
    const user = UserEntity.create(
      legacy.userId,
      legacy.username,
      legacy.displayName
    );

    // ResponseStatus の変換
    const dateStatuses: Record<string, ResponseStatus> = {};
    Object.entries(legacy.dateStatuses).forEach(([dateId, status]) => {
      dateStatuses[dateId] = ResponseStatus.fromString(status);
    });

    return ResponseEntity.create(
      legacy.scheduleId,
      user,
      dateStatuses,
      legacy.comment
    );
  }

  /**
   * ドメインエンティティからレガシー型に変換
   */
  static toLegacy(domain: ResponseEntity): ResponseLegacy {
    const primitives = domain.toPrimitives();
    
    // primitives.dateStatuses はすでに文字列なので、直接マッピング
    const dateStatuses: Record<string, ResponseStatusLegacy> = {};
    Object.entries(primitives.dateStatuses).forEach(([dateId, statusString]) => {
      dateStatuses[dateId] = statusString as ResponseStatusLegacy;
    });

    return {
      scheduleId: primitives.scheduleId,
      userId: primitives.userId,
      username: primitives.username,
      displayName: primitives.displayName,
      dateStatuses,
      comment: primitives.comment,
      updatedAt: primitives.updatedAt
    };
  }

  /**
   * レガシー型の配列からドメインエンティティの配列に変換
   */
  static toDomainList(legacyList: ResponseLegacy[]): ResponseEntity[] {
    return legacyList.map(legacy => this.toDomain(legacy));
  }

  /**
   * ドメインエンティティの配列からレガシー型の配列に変換
   */
  static toLegacyList(domainList: ResponseEntity[]): ResponseLegacy[] {
    return domainList.map(domain => this.toLegacy(domain));
  }
}