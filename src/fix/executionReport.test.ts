import { describe, expect, it } from 'vitest';
import { createMarket, submitLimit } from '../domain/market';
import { buildExecutionReport, displayFix, parseExecutionReport, SOH } from './executionReport';

const notices = submitLimit(createMarket(), 'buy', 10010, 150).notices;
const message = buildExecutionReport(notices[4]);

describe('FIXT.1.1 ExecutionReport subset', () => {
  it('round trips generated messages with byte-correct framing', () => {
    const parsed = parseExecutionReport(message, 'soh');
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields.find(field => field.tag === '1128')?.value).toBe('9');
    expect(parseExecutionReport(displayFix(message, 'pipe'), 'pipe').valid).toBe(true);
    expect(parseExecutionReport(displayFix(message, 'symbol'), 'symbol').valid).toBe(true);
  });

  it('keeps last fill distinct from cumulative quantity and weighted average', () => {
    const parsed = parseExecutionReport(message, 'soh');
    const value = (tag: string) => parsed.fields.find(field => field.tag === tag)?.value;
    expect(value('32')).toBe('25');
    expect(value('14')).toBe('150');
    expect(value('31')).toBe('100.10');
    expect(value('6')).toBe('100.0583');
    expect(value('151')).toBe('0');
  });

  it('rejects incorrect BodyLength, CheckSum, unsupported tags and separator mode', () => {
    expect(parseExecutionReport(message.replace(/9=\d+/, '9=1'), 'soh').errors.join(' ')).toMatch(/BodyLength/);
    expect(parseExecutionReport(message.replace(/10=\d{3}/, '10=000'), 'soh').errors.join(' ')).toMatch(/CheckSum/);
    expect(parseExecutionReport(message.replace(`55=NOVA${SOH}`, `55=NOVA${SOH}453=1${SOH}`), 'soh').errors.join(' ')).toMatch(/Unsupported tag 453/);
    expect(parseExecutionReport(displayFix(message), 'soh').errors.join(' ')).toMatch(/No SOH/);
  });

  it('rejects malformed and inconsistent fields', () => {
    expect(parseExecutionReport(message.replace('151=0', '151=4'), 'soh').errors.join(' ')).toMatch(/inconsistent/);
    expect(parseExecutionReport(message.replace('150=F', '150=0'), 'soh').errors.join(' ')).toMatch(/Tag 150/);
    expect(parseExecutionReport(message.slice(0, -1), 'soh').errors.join(' ')).toMatch(/final field/);
  });
});
