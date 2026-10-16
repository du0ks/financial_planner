import { describe, expect, it } from 'vitest';
import { parseDecimal, parseMoney, toMinor, fromMinor, scaleMinor, currencyDigits, formatMoney, setNumberLocale } from '../money';
import { convertMinor, pairRate, goldValueMinor, goldGramPrice, changeRatio } from '../fx';
import { parseGrams } from '../gold';

describe('parsing amounts', () => {
    it('reads both decimal styles', () => {
        expect(parseMoney('41.093,72', 'TRY')).toBe(4109372);
        expect(parseMoney('41,093.72', 'TRY')).toBe(4109372);
        expect(parseMoney('886,18', 'TRY')).toBe(88618);
        expect(parseMoney('1498.48', 'CZK')).toBe(149848);
    });
    it('treats a lone separator before three digits as thousands for money', () => {
        expect(parseMoney('1.500', 'CZK')).toBe(150000);
        expect(parseMoney('60,000', 'TRY')).toBe(6000000);
        expect(parseMoney('1.234.567', 'TRY')).toBe(123456700);
    });
    it('treats it as a decimal point for grams', () => {
        expect(parseGrams('6.800')).toBe(6800);
        expect(parseGrams('6,8')).toBe(6800);
        expect(parseGrams('0,125')).toBe(125);
    });
    it('rejects junk and too many decimals', () => {
        expect(parseMoney('abc', 'TRY')).toBeNull();
        expect(parseMoney('', 'TRY')).toBeNull();
        expect(parseMoney('1,2345', 'TRY')).toBeNull();
        expect(parseDecimal('12.5.6,7', 2)?.toString()).toBe('1256.7');
    });
    it('keeps signs and symbols out of the way', () => {
        expect(parseMoney('-250 Kč', 'CZK')).toBe(-25000);
        expect(parseMoney('₺ 1 200', 'TRY')).toBe(120000);
    });
});

describe('minor units', () => {
    it('knows currency digits', () => {
        expect(currencyDigits('TRY')).toBe(2);
        expect(currencyDigits('JPY')).toBe(0);
        expect(currencyDigits('CZK')).toBe(2);
    });
    it('is exact where floats are not', () => {
        expect(toMinor('0.1', 'EUR') + toMinor('0.2', 'EUR')).toBe(toMinor('0.3', 'EUR'));
        expect(fromMinor(3307117, 'TRY').toString()).toBe('33071.17');
        expect(scaleMinor(3307117, '0.04875')).toBe(161222);
    });
    it('formats in the amount\'s own currency', () => {
        setNumberLocale('en-US');
        expect(formatMoney(625000, 'CZK').replace(/\s/g, ' ')).toBe('Kč 6,250');
        expect(formatMoney(88618, 'TRY')).toBe('₺886.18');
        expect(formatMoney(88618, 'TRY', { decimals: 'never' })).toBe('₺886');
        expect(formatMoney(40000, 'EUR', { signed: true })).toBe('+€400');
        expect(formatMoney(100, 'UAH')).toBe('₴1');
    });
});

describe('conversion', () => {
    const fx = { rates: { USD: '1', TRY: '49.50379267', CZK: '21.66332137', EUR: '0.88987006', XAU: '0.0002390663' }, overrides: {} };
    it('converts through USD', () => {
        expect(convertMinor(100000, 'USD', 'TRY', fx)).toBe(4950379);
        expect(convertMinor(625000, 'CZK', 'TRY', fx)).toBe(1428215);
        expect(convertMinor(0, 'CZK', 'TRY', fx)).toBe(0);
        expect(convertMinor(500, 'TRY', 'TRY', fx)).toBe(500);
    });
    it('returns null for an unknown rate', () => {
        expect(convertMinor(100, 'UAH', 'TRY', fx)).toBeNull();
    });
    it('uses a manual pair override in both directions', () => {
        const manual = { ...fx, overrides: { 'CZK/TRY': '2.30' } };
        expect(convertMinor(625000, 'CZK', 'TRY', manual)).toBe(1437500);
        expect(convertMinor(120000, 'TRY', 'CZK', manual)).toBe(52174);
        expect(pairRate('EUR', 'TRY', manual).toFixed(4)).toBe(pairRate('EUR', 'TRY', fx).toFixed(4));
    });
    it('prices gold per gram and per milligram holding', () => {
        expect(goldGramPrice('TRY', fx).toFixed(0)).toBe('6658');
        expect(goldValueMinor(6800, 'TRY', fx)).toBe(4527100);
        expect(goldValueMinor(6800, 'UAH', fx)).toBeNull();
    });
    it('computes change ratios', () => {
        expect(changeRatio('100', '117')).toBeCloseTo(0.17);
        expect(changeRatio(null, '1')).toBeNull();
    });
});
