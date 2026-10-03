import { describe, expect, it } from 'vitest';
import { closeDay, createMarket, depth, parsePriceCents, submitLimit } from './market';

describe('deterministic order book', () => {
  it('aggregates individual orders without losing identity', () => {
    const book = createMarket();
    expect(depth(book, 'sell')[0].quantity).toBe(125);
    expect(depth(book, 'sell')[0].orders.map(order => order.id)).toEqual(['P-005', 'P-006']);
    expect(createMarket()).toEqual(book);
  });

  it('matches price then arrival time, tracking passive and incoming partial fills', () => {
    const book = submitLimit(createMarket(), 'buy', 10010, 150);
    expect(book.trades.map(trade => [trade.passiveId, trade.quantity, trade.priceCents])).toEqual([
      ['P-005', 50, 10005], ['P-006', 75, 10005], ['P-007', 25, 10010],
    ]);
    expect(book.orders.find(order => order.id === 'P-007')).toMatchObject({ leaves: 105, cumQty: 25, status: 'Partially filled' });
    expect(book.orders.find(order => order.id === 'U-001')).toMatchObject({ leaves: 0, cumQty: 150, status: 'Filled' });
    expect(book.notices).toHaveLength(6);
    expect(book.notices.filter(notice => notice.order.id === 'U-001').map(notice => notice.order.cumQty)).toEqual([50, 125, 150]);
  });

  it('rests leaves and later fills the tracked ticket order', () => {
    const first = submitLimit(createMarket(), 'buy', 10005, 200);
    expect(depth(first, 'buy')[0].orders.at(-1)).toMatchObject({ id: 'U-001', leaves: 75 });
    const second = submitLimit(first, 'sell', 10005, 80);
    expect(second.trades.at(-1)).toMatchObject({ passiveId: 'U-001', quantity: 75 });
    expect(second.orders.find(order => order.id === 'U-001')).toMatchObject({ cumQty: 200, leaves: 0, status: 'Filled' });
    expect(second.orders.find(order => order.id === 'U-002')).toMatchObject({ leaves: 5, status: 'Partially filled' });
  });

  it('validates tick and closes DAY orders; reset is complete', () => {
    expect(parsePriceCents('100.05')).toBe(10005);
    expect(() => parsePriceCents('100.03')).toThrow(/tick/);
    expect(() => parsePriceCents('100.005')).toThrow();
    const closed = closeDay(submitLimit(createMarket('thin'), 'buy', 4200, 10));
    expect(closed.orders.find(order => order.id === 'U-001')?.status).toBe('Expired');
    expect(depth(closed, 'buy')).toEqual([]);
    expect(() => submitLimit(closed, 'buy', 4205, 1)).toThrow(/closed/);
    expect(createMarket('thin')).toMatchObject({ session: 'open', nextOrder: 1, trades: [], notices: [] });
  });
});
