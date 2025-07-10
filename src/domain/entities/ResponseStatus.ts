/**
 * ResponseStatus Value Object
 * 
 * 回答ステータスの値オブジェクト
 * 回答の状態を表現（参加可能、条件付き、不参加）
 */

export enum ResponseStatusType {
  YES = 'ok',      // 参加可能
  MAYBE = 'maybe', // 条件付き参加
  NO = 'ng'        // 不参加
}

export class ResponseStatus {
  private constructor(private readonly _value: ResponseStatusType) {}

  static yes(): ResponseStatus {
    return new ResponseStatus(ResponseStatusType.YES);
  }

  static maybe(): ResponseStatus {
    return new ResponseStatus(ResponseStatusType.MAYBE);
  }

  static no(): ResponseStatus {
    return new ResponseStatus(ResponseStatusType.NO);
  }

  static fromString(value: string): ResponseStatus {
    switch (value) {
      case 'ok':
      case 'yes':
        return ResponseStatus.yes();
      case 'maybe':
        return ResponseStatus.maybe();
      case 'ng':
      case 'no':
        return ResponseStatus.no();
      default:
        throw new Error(`Invalid response status: ${value}`);
    }
  }

  get value(): ResponseStatusType {
    return this._value;
  }

  get stringValue(): string {
    return this._value;
  }

  isYes(): boolean {
    return this._value === ResponseStatusType.YES;
  }

  isMaybe(): boolean {
    return this._value === ResponseStatusType.MAYBE;
  }

  isNo(): boolean {
    return this._value === ResponseStatusType.NO;
  }

  equals(other: ResponseStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}