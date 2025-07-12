/**
 * ResponseStatus Value Object
 *
 * 回答ステータスの値オブジェクト
 * 回答の状態を表現（参加可能、条件付き、不参加）
 */

export enum ResponseStatusValue {
  OK = 'ok', // 参加可能
  MAYBE = 'maybe', // 条件付き参加
  NG = 'ng', // 不参加
}

export class ResponseStatus {
  private constructor(private readonly _value: ResponseStatusValue) {}

  static create(value: ResponseStatusValue): ResponseStatus {
    if (!Object.values(ResponseStatusValue).includes(value)) {
      throw new Error('無効な回答ステータスです');
    }
    return new ResponseStatus(value);
  }

  static yes(): ResponseStatus {
    return new ResponseStatus(ResponseStatusValue.OK);
  }

  static maybe(): ResponseStatus {
    return new ResponseStatus(ResponseStatusValue.MAYBE);
  }

  static no(): ResponseStatus {
    return new ResponseStatus(ResponseStatusValue.NG);
  }

  static fromString(value: string): ResponseStatus {
    switch (value) {
      case 'ok':
      case 'yes':
      case 'available':
        return ResponseStatus.yes();
      case 'maybe':
        return ResponseStatus.maybe();
      case 'ng':
      case 'no':
      case 'unavailable':
        return ResponseStatus.no();
      default:
        throw new Error(`無効な回答ステータス文字列です: ${value}`);
    }
  }

  static getValidValues(): string[] {
    return Object.values(ResponseStatusValue);
  }

  static isValidStatus(value: string): boolean {
    return value != null && ['ok', 'maybe', 'ng'].includes(value);
  }

  get value(): ResponseStatusValue {
    return this._value;
  }

  get stringValue(): string {
    return this._value;
  }

  isOK(): boolean {
    return this._value === ResponseStatusValue.OK;
  }

  isYes(): boolean {
    return this._value === ResponseStatusValue.OK;
  }

  isMaybe(): boolean {
    return this._value === ResponseStatusValue.MAYBE;
  }

  isNG(): boolean {
    return this._value === ResponseStatusValue.NG;
  }

  isNo(): boolean {
    return this._value === ResponseStatusValue.NG;
  }

  toEmoji(): string {
    switch (this._value) {
      case ResponseStatusValue.OK:
        return '○';
      case ResponseStatusValue.MAYBE:
        return '△';
      case ResponseStatusValue.NG:
        return '×';
    }
  }

  getScore(): number {
    switch (this._value) {
      case ResponseStatusValue.OK:
        return 1;
      case ResponseStatusValue.MAYBE:
        return 0.5;
      case ResponseStatusValue.NG:
        return 0;
    }
  }

  equals(other: ResponseStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
