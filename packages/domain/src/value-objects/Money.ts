/**
 * Immutable money value represented exclusively in minor units.
 * Example: 1_000n with exp=2 represents SAR 10.00.
 */
export interface Money {
  readonly minor: bigint;
  readonly exp: 2;
  readonly currency: string;
}

interface Rational {
  numerator: bigint;
  denominator: bigint;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_INDIC = '۰۱۲۳۴۵۶۷۸۹';

function normalizeDigits(value: string): string {
  let output = '';
  for (const character of value) {
    const arabic = ARABIC_INDIC.indexOf(character);
    if (arabic >= 0) {
      output += String(arabic);
      continue;
    }
    const extended = EXTENDED_INDIC.indexOf(character);
    output += extended >= 0 ? String(extended) : character;
  }
  return output;
}

function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 100) {
    throw new Error('Decimal exponent must be an integer between 0 and 100');
  }
  return 10n ** BigInt(exponent);
}

function parseRational(value: number | string): Rational {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Numeric factor must be finite');
    value = String(value);
  }

  const normalized = normalizeDigits(value.trim()).replace(/[٫]/g, '.').replace(/[٬,_\s]/g, '');
  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new Error(`Invalid decimal value: ${value}`);

  const sign = match[1] === '-' ? -1n : 1n;
  const integer = match[2];
  const fraction = match[3] ?? '';
  const exponent = Number.parseInt(match[4] ?? '0', 10);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
    throw new Error('Decimal exponent is outside the supported range');
  }

  let numerator = BigInt(integer + fraction) * sign;
  let denominator = pow10(fraction.length);
  if (exponent > 0) numerator *= pow10(exponent);
  if (exponent < 0) denominator *= pow10(-exponent);

  return { numerator, denominator };
}

function divideAndRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('Division by zero');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  const remainder = n % d;
  if (remainder * 2n >= d) quotient += 1n;
  return negative ? -quotient : quotient;
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency must be a three-letter uppercase ISO code');
  }
  return normalized;
}

export class MoneyValue {
  static zero(currency = 'SAR'): Money {
    return { minor: 0n, exp: 2, currency: normalizeCurrency(currency) };
  }

  static fromMinor(minor: bigint | number | string, currency = 'SAR'): Money {
    let parsed: bigint;
    if (typeof minor === 'bigint') {
      parsed = minor;
    } else if (typeof minor === 'number') {
      if (!Number.isSafeInteger(minor)) {
        throw new Error('Numeric minor amount must be a safe integer; use a string for larger values');
      }
      parsed = BigInt(minor);
    } else {
      const normalized = normalizeDigits(minor.trim()).replace(/[٬,_\s]/g, '');
      if (!/^[+-]?\d+$/.test(normalized)) {
        throw new Error('Minor amount must be an integer');
      }
      parsed = BigInt(normalized);
    }

    return { minor: parsed, exp: 2, currency: normalizeCurrency(currency) };
  }

  static fromMajor(major: number | string, currency = 'SAR'): Money {
    const value = parseRational(major);
    return {
      minor: divideAndRoundHalfUp(value.numerator * 100n, value.denominator),
      exp: 2,
      currency: normalizeCurrency(currency),
    };
  }

  static add(a: Money, b: Money): Money {
    this.assertCompatible(a, b, 'add');
    return { minor: a.minor + b.minor, exp: 2, currency: a.currency };
  }

  static subtract(a: Money, b: Money): Money {
    this.assertCompatible(a, b, 'subtract');
    return { minor: a.minor - b.minor, exp: 2, currency: a.currency };
  }

  static multiply(money: Money, factor: number | string): Money {
    this.validate(money);
    const value = parseRational(factor);
    return {
      minor: divideAndRoundHalfUp(money.minor * value.numerator, value.denominator),
      exp: 2,
      currency: money.currency,
    };
  }

  static divide(money: Money, divisor: number | string): Money {
    this.validate(money);
    const value = parseRational(divisor);
    if (value.numerator === 0n) throw new Error('Division by zero');
    return {
      minor: divideAndRoundHalfUp(money.minor * value.denominator, value.numerator),
      exp: 2,
      currency: money.currency,
    };
  }

  static compare(a: Money, b: Money): -1 | 0 | 1 {
    this.assertCompatible(a, b, 'compare');
    if (a.minor < b.minor) return -1;
    if (a.minor > b.minor) return 1;
    return 0;
  }

  static isZero(money: Money): boolean {
    this.validate(money);
    return money.minor === 0n;
  }

  static isPositive(money: Money): boolean {
    this.validate(money);
    return money.minor > 0n;
  }

  static isNegative(money: Money): boolean {
    this.validate(money);
    return money.minor < 0n;
  }

  static abs(money: Money): Money {
    this.validate(money);
    return { ...money, minor: money.minor < 0n ? -money.minor : money.minor };
  }

  /**
   * Locale formatting is isolated to presentation and preserves arbitrary-size integers.
   */
  static format(money: Money, locale = 'ar-SA'): string {
    this.validate(money);
    const negative = money.minor < 0n;
    const absolute = negative ? -money.minor : money.minor;
    const major = absolute / 100n;
    const fraction = absolute % 100n;

    const integerText = new Intl.NumberFormat(locale, {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(major);
    const fractionText = new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumIntegerDigits: 2,
      maximumFractionDigits: 0,
    }).format(fraction);
    const template = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(negative ? -1 : 1);

    let integerInserted = false;
    return template.map((part) => {
      if (part.type === 'integer' && !integerInserted) {
        integerInserted = true;
        return integerText;
      }
      if (part.type === 'integer' || part.type === 'group') return '';
      if (part.type === 'fraction') return fractionText;
      return part.value;
    }).join('');
  }

  static toString(money: Money, decimalPlaces = 2): string {
    this.validate(money);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 20) {
      throw new Error('decimalPlaces must be an integer between 0 and 20');
    }

    const negative = money.minor < 0n;
    let absolute = negative ? -money.minor : money.minor;
    if (decimalPlaces < 2) {
      absolute = divideAndRoundHalfUp(absolute, pow10(2 - decimalPlaces));
    } else if (decimalPlaces > 2) {
      absolute *= pow10(decimalPlaces - 2);
    }

    const scale = pow10(decimalPlaces);
    const integer = decimalPlaces === 0 ? absolute : absolute / scale;
    const fraction = decimalPlaces === 0 ? '' : (absolute % scale).toString().padStart(decimalPlaces, '0');
    return `${negative ? '-' : ''}${integer.toString()}${decimalPlaces ? `.${fraction}` : ''}`;
  }

  static validate(money: Money): void {
    if (typeof money.minor !== 'bigint') throw new Error('Money.minor must be bigint');
    if (money.exp !== 2) throw new Error('Money.exp must be 2');
    if (money.currency !== normalizeCurrency(money.currency)) throw new Error('Money.currency is invalid');
  }

  private static assertCompatible(a: Money, b: Money, operation: 'add' | 'subtract' | 'compare'): void {
    this.validate(a);
    this.validate(b);
    if (a.currency === b.currency) return;
    if (operation === 'add') throw new Error(`Cannot add ${b.currency} to ${a.currency}`);
    if (operation === 'subtract') throw new Error(`Cannot subtract ${b.currency} from ${a.currency}`);
    throw new Error('Cannot compare different currencies');
  }
}

export class MoneyCalculator {
  private value: Money;

  constructor(initial: Money) {
    MoneyValue.validate(initial);
    this.value = initial;
  }

  add(other: Money): this {
    this.value = MoneyValue.add(this.value, other);
    return this;
  }

  subtract(other: Money): this {
    this.value = MoneyValue.subtract(this.value, other);
    return this;
  }

  multiply(factor: number | string): this {
    this.value = MoneyValue.multiply(this.value, factor);
    return this;
  }

  divide(divisor: number | string): this {
    this.value = MoneyValue.divide(this.value, divisor);
    return this;
  }

  abs(): this {
    this.value = MoneyValue.abs(this.value);
    return this;
  }

  result(): Money {
    return this.value;
  }

  format(locale = 'ar-SA'): string {
    return MoneyValue.format(this.value, locale);
  }

  toString(decimalPlaces = 2): string {
    return MoneyValue.toString(this.value, decimalPlaces);
  }
}
