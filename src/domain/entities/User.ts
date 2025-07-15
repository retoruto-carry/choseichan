/**
 * User Domain Entity
 *
 * ユーザーのドメインエンティティ
 * 不変なユーザー情報を表現
 */

import { BUSINESS_CONSTANTS } from '../constants/BusinessConstants';

export interface UserId {
  readonly value: string;
}

export interface UserName {
  readonly value: string;
}

export class User {
  private constructor(
    private readonly _id: UserId,
    private readonly _username: UserName,
    private readonly _displayName?: string
  ) {}

  static create(id: string, username: string, displayName?: string): User {
    if (!id || !id.trim()) {
      throw new Error('ユーザーIDは必須です');
    }
    if (!username || !username.trim()) {
      throw new Error('ユーザー名は必須です');
    }
    if (username.length > BUSINESS_CONSTANTS.MAX_USERNAME_LENGTH) {
      throw new Error(
        `ユーザー名は${BUSINESS_CONSTANTS.MAX_USERNAME_LENGTH}文字以内で入力してください`
      );
    }

    return new User({ value: id }, { value: username }, displayName);
  }

  static fromPrimitives(data: { id: string; username: string; displayName?: string }): User {
    return User.create(data.id, data.username, data.displayName);
  }

  get id(): string {
    return this._id.value;
  }

  get username(): string {
    return this._username.value;
  }

  get displayName(): string | undefined {
    return this._displayName;
  }

  toPrimitives(): {
    id: string;
    username: string;
    displayName?: string;
  } {
    return {
      id: this.id,
      username: this.username,
      displayName: this.displayName,
    };
  }

  equals(other: User): boolean {
    return this.id === other.id;
  }
}
