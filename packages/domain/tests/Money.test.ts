import { describe, it, expect } from 'vitest';
import { MoneyValue, MoneyCalculator } from '../src/value-objects/Money.js';

describe('MoneyValue', () => {
  describe('Creation', () => {
    it('should create money from minor units (bigint)', () => {
      const money = MoneyValue.fromMinor(10000n);
      expect(money.minor).toBe(10000n);
      expect(money.exp).toBe(2);
      expect(money.currency).toBe('SAR');
    });

    it('should create money from minor units (number)', () => {
      const money = MoneyValue.fromMinor(10000);
      expect(money.minor).toBe(10000n);
      expect(money.currency).toBe('SAR');
    });

    it('should create money from minor units (string)', () => {
      const money = MoneyValue.fromMinor('10000');
      expect(money.minor).toBe(10000n);
    });

    it('should parse Arabic-Indic minor units exactly', () => {
      const money = MoneyValue.fromMinor('١٬٢٣٤');
      expect(money.minor).toBe(1234n);
    });

    it('should create money from major units', () => {
      const money = MoneyValue.fromMajor(100); // SAR 100
      expect(money.minor).toBe(10000n); // 100 * 100 cents
      expect(money.exp).toBe(2);
    });

    it('should create zero money', () => {
      const money = MoneyValue.zero();
      expect(money.minor).toBe(0n);
      expect(MoneyValue.isZero(money)).toBe(true);
    });

    it('should preserve currency', () => {
      const usd = MoneyValue.fromMinor(1000, 'USD');
      expect(usd.currency).toBe('USD');
    });
  });

  describe('Arithmetic', () => {
    it('should add two money values', () => {
      const a = MoneyValue.fromMinor(50000n);
      const b = MoneyValue.fromMinor(30000n);
      const result = MoneyValue.add(a, b);
      expect(result.minor).toBe(80000n);
      expect(result.currency).toBe('SAR');
    });

    it('should subtract two money values', () => {
      const a = MoneyValue.fromMinor(50000n);
      const b = MoneyValue.fromMinor(20000n);
      const result = MoneyValue.subtract(a, b);
      expect(result.minor).toBe(30000n);
    });

    it('should multiply money by factor', () => {
      const money = MoneyValue.fromMinor(10000n);
      const result = MoneyValue.multiply(money, 2.5);
      expect(result.minor).toBe(25000n);
    });

    it('should divide money by divisor', () => {
      const money = MoneyValue.fromMinor(10000n);
      const result = MoneyValue.divide(money, 2);
      expect(result.minor).toBe(5000n);
    });

    it('should handle negative money', () => {
      const negative = MoneyValue.fromMinor(-10000n);
      expect(MoneyValue.isNegative(negative)).toBe(true);
      const positive = MoneyValue.abs(negative);
      expect(positive.minor).toBe(10000n);
    });
  });

  describe('Comparison', () => {
    it('should compare money values', () => {
      const a = MoneyValue.fromMinor(1000n);
      const b = MoneyValue.fromMinor(2000n);

      expect(MoneyValue.compare(a, b)).toBe(-1);
      expect(MoneyValue.compare(b, a)).toBe(1);
      expect(MoneyValue.compare(a, a)).toBe(0);
    });

    it('should prevent comparing different currencies', () => {
      const sar = MoneyValue.fromMinor(1000n, 'SAR');
      const usd = MoneyValue.fromMinor(1000n, 'USD');

      expect(() => MoneyValue.compare(sar, usd)).toThrow('Cannot compare different currencies');
    });
  });

  describe('Validation', () => {
    it('should prevent adding different currencies', () => {
      const sar = MoneyValue.fromMinor(1000n, 'SAR');
      const usd = MoneyValue.fromMinor(1000n, 'USD');

      expect(() => MoneyValue.add(sar, usd)).toThrow('Cannot add USD to SAR');
    });

    it('should prevent subtracting different currencies', () => {
      const sar = MoneyValue.fromMinor(1000n, 'SAR');
      const usd = MoneyValue.fromMinor(1000n, 'USD');

      expect(() => MoneyValue.subtract(sar, usd)).toThrow('Cannot subtract USD from SAR');
    });

    it('should always use bigint internally', () => {
      const money = MoneyValue.fromMinor(123);
      expect(typeof money.minor).toBe('bigint');
      expect(money.minor).toBe(123n);
    });

    it('should always have exp of 2', () => {
      const money = MoneyValue.fromMinor(1000n);
      expect(money.exp).toBe(2);
    });
  });

  describe('Formatting', () => {
    it('should format money for Arabic locale', () => {
      const money = MoneyValue.fromMinor(100000n); // SAR 1,000
      const formatted = MoneyValue.format(money, 'ar-SA');
      expect(formatted).toMatch(/[1١][٬,\.٫]/); // Contains localized leading digit and separator
      expect(formatted).toMatch(/SAR|﷼|ر\.س/i); // Contains currency
    });

    it('should format money for English locale', () => {
      const money = MoneyValue.fromMinor(100000n); // SAR 1,000
      const formatted = MoneyValue.format(money, 'en-US');
      expect(formatted).toMatch(/1[,\.]/);
    });

    it('should convert to string', () => {
      const money = MoneyValue.fromMinor(123456n);
      const str = MoneyValue.toString(money, 2);
      expect(str).toBe('1234.56');
    });
  });

  describe('Predicates', () => {
    it('should check if money is zero', () => {
      const zero = MoneyValue.zero();
      const notZero = MoneyValue.fromMinor(1n);

      expect(MoneyValue.isZero(zero)).toBe(true);
      expect(MoneyValue.isZero(notZero)).toBe(false);
    });

    it('should check if money is positive', () => {
      const positive = MoneyValue.fromMinor(1000n);
      const negative = MoneyValue.fromMinor(-1000n);

      expect(MoneyValue.isPositive(positive)).toBe(true);
      expect(MoneyValue.isPositive(negative)).toBe(false);
    });

    it('should check if money is negative', () => {
      const positive = MoneyValue.fromMinor(1000n);
      const negative = MoneyValue.fromMinor(-1000n);

      expect(MoneyValue.isNegative(negative)).toBe(true);
      expect(MoneyValue.isNegative(positive)).toBe(false);
    });
  });

  describe('MoneyCalculator', () => {
    it('should chain arithmetic operations', () => {
      const calculator = new MoneyCalculator(MoneyValue.fromMinor(10000n))
        .add(MoneyValue.fromMinor(5000n))
        .multiply(2)
        .divide(2);

      const result = calculator.result();
      expect(result.minor).toBe(15000n);
    });

    it('should chain with formatting', () => {
      const calculator = new MoneyCalculator(MoneyValue.fromMinor(123456n));
      const str = calculator.toString(2);
      expect(str).toBe('1234.56');
    });

    it('should handle abs in chain', () => {
      const calculator = new MoneyCalculator(MoneyValue.fromMinor(-10000n)).abs();
      expect(calculator.result().minor).toBe(10000n);
    });
  });

  describe('Real-world scenarios', () => {
    it('should calculate materiality (5% of revenue)', () => {
      const revenue = MoneyValue.fromMajor(10000000); // SAR 10M
      const materiality = MoneyValue.divide(revenue, 20); // 5%

      expect(MoneyValue.toString(materiality, 2)).toBe('500000.00');
    });

    it('should calculate performance materiality (75% of overall)', () => {
      const overall = MoneyValue.fromMajor(500000);
      const performance = MoneyValue.multiply(overall, 0.75);

      expect(MoneyValue.toString(performance, 2)).toBe('375000.00');
    });

    it('should sum multiple transactions without floating-point errors', () => {
      const transactions = [
        MoneyValue.fromMinor(10000n),
        MoneyValue.fromMinor(20000n),
        MoneyValue.fromMinor(30000n),
        MoneyValue.fromMinor(40000n),
      ];

      const sum = transactions.reduce((acc, tx) => MoneyValue.add(acc, tx));
      expect(sum.minor).toBe(100000n);
    });

    it('should prevent floating-point errors in division', () => {
      const total = MoneyValue.fromMinor(1000n);
      const divided = MoneyValue.divide(total, 3);

      // Should not have floating point errors
      expect(typeof divided.minor).toBe('bigint');
      expect(divided.minor).toBe(333n); // Integer division result
    });
  });
});
