export type Side = 'buy' | 'sell';
export type OrderStatus = 'New' | 'Partially filled' | 'Filled' | 'Expired';

export interface Order {
  id: string;
  clientOrderId: string;
  side: Side;
  priceCents: number;
  quantity: number;
  leaves: number;
  cumQty: number;
  cumNotionalCents: number;
  status: OrderStatus;
  arrival: number;
  source: 'seed' | 'ticket';
}

export interface Trade {
  id: string;
  aggressorId: string;
  passiveId: string;
  quantity: number;
  priceCents: number;
}

export interface ExecutionNotice {
  id: string;
  tradeId: string;
  order: Order;
  lastQty: number;
  lastPxCents: number;
}

export interface MarketState {
  scenario: ScenarioId;
  orders: Order[];
  trades: Trade[];
  notices: ExecutionNotice[];
  nextOrder: number;
  nextTrade: number;
  nextNotice: number;
  session: 'open' | 'closed';
  lastPxCents: number;
}

export type ScenarioId = 'balanced' | 'thin';
export const TICK_CENTS = 5;
export const SYMBOL = 'NOVA';

type Seed = [Side, number, number];
const SCENARIOS: Record<ScenarioId, { name: string; description: string; last: number; seeds: Seed[] }> = {
  balanced: {
    name: 'Balanced book', description: 'Three levels on each side, with a price-time queue.', last: 10000,
    seeds: [
      ['buy', 9995, 80], ['buy', 9995, 120], ['buy', 9990, 160], ['buy', 9985, 220],
      ['sell', 10005, 50], ['sell', 10005, 75], ['sell', 10010, 130], ['sell', 10015, 200],
    ],
  },
  thin: {
    name: 'Thin offer', description: 'Small displayed offers reveal partial fills and resting leaves.', last: 4200,
    seeds: [
      ['buy', 4195, 25], ['buy', 4190, 60], ['sell', 4205, 12], ['sell', 4205, 18], ['sell', 4210, 30],
    ],
  },
};

export const scenarioDetails = (id: ScenarioId) => SCENARIOS[id];

export function createMarket(scenario: ScenarioId = 'balanced'): MarketState {
  const definition = SCENARIOS[scenario];
  return {
    scenario,
    orders: definition.seeds.map(([side, priceCents, quantity], index) => ({
      id: `P-${String(index + 1).padStart(3, '0')}`,
      clientOrderId: `SEED-${String(index + 1).padStart(3, '0')}`,
      side, priceCents, quantity, leaves: quantity, cumQty: 0, cumNotionalCents: 0,
      status: 'New', arrival: index + 1, source: 'seed',
    })),
    trades: [], notices: [], nextOrder: 1, nextTrade: 1, nextNotice: 1,
    session: 'open', lastPxCents: definition.last,
  };
}

export function parsePriceCents(input: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.trim())) throw new Error('Enter a positive price with at most two decimal places.');
  const [whole, fraction = ''] = input.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Price is outside the supported range.');
  if (cents % TICK_CENTS !== 0) throw new Error('Price must align to the $0.05 tick.');
  return cents;
}

export function parseQuantity(input: string): number {
  if (!/^[1-9]\d*$/.test(input.trim())) throw new Error('Quantity must be a positive whole number.');
  const quantity = Number(input.trim());
  if (!Number.isSafeInteger(quantity) || quantity > 1_000_000) throw new Error('Quantity must be at most 1,000,000.');
  return quantity;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface DepthLevel { priceCents: number; quantity: number; orders: Order[] }
export function depth(state: MarketState, side: Side): DepthLevel[] {
  const active = state.orders.filter(order => order.side === side && order.leaves > 0 && order.status !== 'Expired');
  active.sort((a, b) => side === 'buy' ? b.priceCents - a.priceCents || a.arrival - b.arrival : a.priceCents - b.priceCents || a.arrival - b.arrival);
  const levels: DepthLevel[] = [];
  for (const order of active) {
    const last = levels.at(-1);
    if (last?.priceCents === order.priceCents) { last.quantity += order.leaves; last.orders.push(order); }
    else levels.push({ priceCents: order.priceCents, quantity: order.leaves, orders: [order] });
  }
  return levels;
}

export function submitLimit(state: MarketState, side: Side, priceCents: number, quantity: number): MarketState {
  if (state.session !== 'open') throw new Error('The DAY session is closed. Reset or choose a scenario to trade again.');
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || priceCents % TICK_CENTS !== 0) throw new Error('Price must align to the $0.05 tick.');
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error('Quantity must be between 1 and 1,000,000.');

  const orders = state.orders.map(order => ({ ...order }));
  const sequence = state.nextOrder;
  const incoming: Order = {
    id: `U-${String(sequence).padStart(3, '0')}`, clientOrderId: `LAB-${String(sequence).padStart(3, '0')}`,
    side, priceCents, quantity, leaves: quantity, cumQty: 0, cumNotionalCents: 0,
    status: 'New', arrival: orders.length + 1, source: 'ticket',
  };
  orders.push(incoming);
  const opposite = orders.filter(order => order.side !== side && order.leaves > 0)
    .sort((a, b) => side === 'buy' ? a.priceCents - b.priceCents || a.arrival - b.arrival : b.priceCents - a.priceCents || a.arrival - b.arrival);
  const trades = [...state.trades];
  const notices = [...state.notices];
  let nextTrade = state.nextTrade;
  let nextNotice = state.nextNotice;
  let lastPxCents = state.lastPxCents;

  for (const passive of opposite) {
    if (incoming.leaves === 0) break;
    if (side === 'buy' ? passive.priceCents > priceCents : passive.priceCents < priceCents) break;
    const filled = Math.min(incoming.leaves, passive.leaves);
    for (const order of [incoming, passive]) {
      order.leaves -= filled;
      order.cumQty += filled;
      order.cumNotionalCents += filled * passive.priceCents;
      order.status = order.leaves === 0 ? 'Filled' : 'Partially filled';
    }
    const tradeId = `T-${String(nextTrade++).padStart(3, '0')}`;
    trades.push({ id: tradeId, aggressorId: incoming.id, passiveId: passive.id, quantity: filled, priceCents: passive.priceCents });
    for (const order of [incoming, passive]) {
      notices.push({ id: `E-${String(nextNotice++).padStart(3, '0')}`, tradeId, order: { ...order }, lastQty: filled, lastPxCents: passive.priceCents });
    }
    lastPxCents = passive.priceCents;
  }
  return { ...state, orders, trades, notices, nextOrder: sequence + 1, nextTrade, nextNotice, lastPxCents };
}

export function closeDay(state: MarketState): MarketState {
  if (state.session === 'closed') return state;
  return { ...state, session: 'closed', orders: state.orders.map(order => order.leaves > 0 ? { ...order, status: 'Expired' } : { ...order }) };
}
