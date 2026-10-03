import { SYMBOL, formatPrice, type ExecutionNotice } from '../domain/market';

export const SOH = '\x01';
export type SeparatorMode = 'soh' | 'pipe' | 'symbol';
export interface FixField { tag: string; value: string; name: string }
export interface ParseResult { fields: FixField[]; errors: string[]; valid: boolean; normalized: string }

const fieldNames: Record<string, string> = {
  '8': 'BeginString', '9': 'BodyLength', '35': 'MsgType', '34': 'MsgSeqNum',
  '49': 'SenderCompID', '52': 'SendingTime', '56': 'TargetCompID', '1128': 'ApplVerID',
  '37': 'OrderID', '11': 'ClOrdID', '17': 'ExecID', '150': 'ExecType', '39': 'OrdStatus',
  '55': 'Symbol', '54': 'Side', '38': 'OrderQty', '40': 'OrdType', '44': 'Price',
  '59': 'TimeInForce', '32': 'LastQty', '31': 'LastPx', '14': 'CumQty',
  '151': 'LeavesQty', '6': 'AvgPx', '10': 'CheckSum',
};
const required = Object.keys(fieldNames);
const enc = new TextEncoder();
const byteLength = (value: string) => enc.encode(value).length;
const checksum = (value: string) => enc.encode(value).reduce((sum, byte) => sum + byte, 0) % 256;
const padded = (value: number) => String(value).padStart(3, '0');

function averagePrice(notice: ExecutionNotice): string {
  return (notice.order.cumNotionalCents / notice.order.cumQty / 100).toFixed(4);
}

export function buildExecutionReport(notice: ExecutionNotice): string {
  const order = notice.order;
  const sequence = Number(notice.id.slice(2));
  const time = `20260101-12:${String(Math.floor((sequence - 1) / 60) % 60).padStart(2, '0')}:${String((sequence - 1) % 60).padStart(2, '0')}.000`;
  const fields: [string, string][] = [
    ['35', '8'], ['34', String(sequence)], ['49', 'LAB_EXCHANGE'], ['52', time], ['56', 'LAB_CLIENT'], ['1128', '9'],
    ['37', order.id], ['11', order.clientOrderId], ['17', notice.id], ['150', 'F'],
    ['39', order.leaves === 0 ? '2' : '1'], ['55', SYMBOL], ['54', order.side === 'buy' ? '1' : '2'],
    ['38', String(order.quantity)], ['40', '2'], ['44', formatPrice(order.priceCents)], ['59', '0'],
    ['32', String(notice.lastQty)], ['31', formatPrice(notice.lastPxCents)],
    ['14', String(order.cumQty)], ['151', String(order.leaves)], ['6', averagePrice(notice)],
  ];
  const body = fields.map(([tag, value]) => `${tag}=${value}${SOH}`).join('');
  const head = `8=FIXT.1.1${SOH}9=${byteLength(body)}${SOH}`;
  return `${head}${body}10=${padded(checksum(head + body))}${SOH}`;
}

export function displayFix(raw: string, mode: Exclude<SeparatorMode, 'soh'> = 'pipe'): string {
  return raw.replaceAll(SOH, mode === 'pipe' ? '|' : '␁');
}

export function parseExecutionReport(input: string, mode: SeparatorMode): ParseResult {
  const delimiter = mode === 'soh' ? SOH : mode === 'pipe' ? '|' : '␁';
  const errors: string[] = [];
  if (!input) return { fields: [], errors: ['Paste an ExecutionReport to inspect.'], valid: false, normalized: '' };
  if (mode !== 'soh' && input.includes(SOH)) errors.push('Input contains SOH; select the SOH separator mode.');
  if (mode === 'soh' && !input.includes(SOH)) errors.push('No SOH bytes found; select a visible separator mode if needed.');
  const normalized = input.replaceAll(delimiter, SOH);
  if (!normalized.endsWith(SOH)) errors.push('The final field must end with the selected separator.');
  if (/[\u0080-\uFFFF]/.test(normalized)) errors.push('Only ASCII field bytes are supported.');
  const chunks = normalized.split(SOH);
  if (chunks.at(-1) === '') chunks.pop();
  const fields: FixField[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const equals = chunk.indexOf('=');
    if (equals < 1 || equals === chunk.length - 1 || !/^\d+$/.test(chunk.slice(0, equals))) {
      errors.push(`Malformed field: ${chunk || '(empty)'}.`);
      continue;
    }
    const tag = chunk.slice(0, equals);
    const value = chunk.slice(equals + 1);
    if (!(tag in fieldNames)) errors.push(`Unsupported tag ${tag}; repeating groups and extensions are outside this subset.`);
    if (seen.has(tag)) errors.push(`Duplicate tag ${tag}.`);
    seen.add(tag);
    fields.push({ tag, value, name: fieldNames[tag] ?? 'Unsupported' });
  }
  const map = new Map(fields.map(field => [field.tag, field.value]));
  for (const tag of required) if (!map.has(tag)) errors.push(`Missing required tag ${tag} (${fieldNames[tag]}).`);
  if (fields[0]?.tag !== '8' || fields[1]?.tag !== '9' || fields[2]?.tag !== '35' || fields.at(-1)?.tag !== '10')
    errors.push('Expected 8, 9, 35 at the start and 10 at the end.');

  const exact = (tag: string, value: string) => { if (map.has(tag) && map.get(tag) !== value) errors.push(`Tag ${tag} must be ${value} in this subset.`); };
  exact('8', 'FIXT.1.1'); exact('35', '8'); exact('1128', '9'); exact('150', 'F'); exact('40', '2'); exact('59', '0');
  for (const [tag, accepted] of [['39', ['1', '2']], ['54', ['1', '2']]] as const)
    if (map.has(tag) && !accepted.includes(map.get(tag) as never)) errors.push(`Unsupported value for tag ${tag}.`);
  for (const tag of ['34', '38', '32', '14', '151'])
    if (map.has(tag) && !/^\d+$/.test(map.get(tag)!) ) errors.push(`Tag ${tag} must be an unsigned integer.`);
  for (const tag of ['44', '31', '6'])
    if (map.has(tag) && !/^\d+(?:\.\d{1,4})?$/.test(map.get(tag)!)) errors.push(`Tag ${tag} must be a decimal with up to four places.`);
  if (map.has('52') && !/^\d{8}-\d{2}:\d{2}:\d{2}\.\d{3}$/.test(map.get('52')!)) errors.push('Tag 52 must be a FIX UTC timestamp.');
  for (const tag of ['49', '56', '37', '11', '17', '55'])
    if (map.has(tag) && !/^[A-Za-z0-9_-]+$/.test(map.get(tag)!)) errors.push(`Tag ${tag} has unsupported characters.`);
  const qty = Number(map.get('38')); const last = Number(map.get('32')); const cum = Number(map.get('14')); const leaves = Number(map.get('151'));
  if ([qty, last, cum, leaves].every(Number.isSafeInteger)) {
    if (qty <= 0 || last <= 0 || cum <= 0 || leaves < 0 || last > cum || cum + leaves !== qty) errors.push('Quantity fields are inconsistent (LastQty ≤ CumQty and CumQty + LeavesQty = OrderQty).');
    if (map.get('39') === '2' && leaves !== 0 || map.get('39') === '1' && leaves === 0) errors.push('OrdStatus conflicts with LeavesQty.');
  }
  if (Number(map.get('31')) <= 0 || Number(map.get('44')) <= 0 || Number(map.get('6')) <= 0) errors.push('Trade and limit prices must be positive.');

  const bodyStart = normalized.indexOf(SOH, normalized.indexOf('9=')) + 1;
  const checksumStart = normalized.lastIndexOf(`${SOH}10=`) + 1;
  if (bodyStart > 0 && checksumStart > bodyStart) {
    const actualLength = byteLength(normalized.slice(bodyStart, checksumStart));
    if (!/^\d+$/.test(map.get('9') ?? '') || Number(map.get('9')) !== actualLength) errors.push(`BodyLength mismatch: declared ${map.get('9') ?? 'missing'}, actual ${actualLength} bytes.`);
    const actualChecksum = padded(checksum(normalized.slice(0, checksumStart)));
    if (!/^\d{3}$/.test(map.get('10') ?? '') || map.get('10') !== actualChecksum) errors.push(`CheckSum mismatch: declared ${map.get('10') ?? 'missing'}, actual ${actualChecksum}.`);
  } else errors.push('Cannot locate BodyLength or CheckSum boundaries.');
  return { fields, errors, valid: errors.length === 0, normalized };
}
