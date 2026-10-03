import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { closeDay, createMarket, depth, formatPrice, parsePriceCents, parseQuantity, submitLimit, type DepthLevel, type MarketState, type Order, type ScenarioId, type Side } from '../domain/market';
import { buildExecutionReport, displayFix, parseExecutionReport, type SeparatorMode } from '../fix/executionReport';
import { Button, Field, Input, SegmentedControl, Select, StatusBadge, Textarea, TradingNumber } from '../design-system/primitives';

const quantityFormat = new Intl.NumberFormat('en-US');
type ViewMode = 'aggregate' | 'order';
type Row = { priceCents: number; quantity: number; order?: Order; levelIndex: number; orderIndex?: number };

function rowsFor(levels: DepthLevel[], mode: ViewMode): Row[] {
  return levels.flatMap((level, levelIndex) => mode === 'aggregate'
    ? [{ priceCents: level.priceCents, quantity: level.quantity, levelIndex }]
    : level.orders.map((order, orderIndex) => ({ priceCents: level.priceCents, quantity: order.leaves, order, levelIndex, orderIndex })));
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' { return status === 'Filled' ? 'success' : status === 'Expired' ? 'warning' : 'neutral'; }

export default function App() {
  const [market, setMarket] = useState<MarketState>(() => createMarket());
  const [view, setView] = useState<ViewMode>('aggregate');
  const [side, setSide] = useState<Side>('buy');
  const [price, setPrice] = useState('100.10');
  const [quantity, setQuantity] = useState('150');
  const [error, setError] = useState('');
  const [separator, setSeparator] = useState<SeparatorMode>('pipe');
  const [input, setInput] = useState('');
  const [selectedNotice, setSelectedNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('market-depth-fix-lab.theme') === 'light' ? 'light' : 'dark');
  useEffect(() => {
    localStorage.setItem('market-depth-fix-lab.theme', theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const bids = useMemo(() => depth(market, 'buy'), [market]);
  const asks = useMemo(() => depth(market, 'sell'), [market]);
  const bidRows = rowsFor(bids, view);
  const askRows = rowsFor(asks, view);
  const parsed = useMemo(() => parseExecutionReport(input, separator), [input, separator]);
  const ticketOrders = market.orders.filter(order => order.source === 'ticket').reverse();

  function reset(nextScenario: ScenarioId = market.scenario) {
    const next = createMarket(nextScenario);
    setMarket(next);
    setView('aggregate'); setSide('buy'); setPrice(formatPrice(depth(next, 'sell')[0].priceCents)); setQuantity(nextScenario === 'thin' ? '75' : '150');
    setError(''); setInput(''); setSelectedNotice(''); setSeparator('pipe'); setCopied(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const next = submitLimit(market, side, parsePriceCents(price), parseQuantity(quantity));
      setMarket(next); setError('');
      const latest = next.notices.at(-1);
      if (latest) {
        setSelectedNotice(latest.id); setSeparator('pipe'); setInput(displayFix(buildExecutionReport(latest)));
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Order rejected.'); }
  }

  function chooseDepth(target: Side, row: Row) {
    const opposite = target === 'buy' ? asks : bids;
    const prior = opposite.slice(0, row.levelIndex).reduce((sum, level) => sum + level.quantity, 0);
    const atLevel = row.orderIndex === undefined ? opposite[row.levelIndex].quantity
      : opposite[row.levelIndex].orders.slice(0, row.orderIndex + 1).reduce((sum, order) => sum + order.leaves, 0);
    setSide(target); setPrice(formatPrice(row.priceCents)); setQuantity(String(prior + atLevel)); setError('');
  }

  function inspectNotice(id: string) {
    const notice = market.notices.find(item => item.id === id);
    if (!notice) return;
    setSelectedNotice(id); setSeparator('pipe'); setInput(displayFix(buildExecutionReport(notice))); setCopied(false);
  }

  async function copySoh() {
    const notice = market.notices.find(item => item.id === selectedNotice);
    if (!notice) return;
    await navigator.clipboard.writeText(buildExecutionReport(notice));
    setCopied(true);
  }

  return <div className="app-shell" data-theme={theme}>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Market Depth + FIX Lab home"><span className="brand-mark">TW</span><span>TRADING WORKSTATION <b>/ MARKET DEPTH + FIX LAB</b></span></a>
      <nav aria-label="Main navigation"><a href="#workstation">Market depth</a><a href="#fix">FIX inspector</a><a href="#about">Scope</a></nav>
      <div className="topbar-actions"><span className="topbar-tag"><i /> LOCAL SIMULATION</span><Button aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Light' : '◐ Dark'}</Button></div>
    </header>

    <main id="top">
      <section className="lab-intro section-wrap"><div><span className="section-kicker">PERSONAL SYSTEMS LAB / 01</span><h1>Market Depth <span>+ FIX</span></h1><p>Submit a synthetic limit order, inspect price-time matching, and validate the resulting ExecutionReports.</p></div><div className="intro-meta"><span>INSTRUMENT <strong>NOVA / USD</strong></span><span>VENUE <strong>LOCAL SIM</strong></span><span>TRANSPORT <strong>FIXT.1.1</strong></span></div></section>

      <section className="workstation section-wrap" id="workstation">
        <div className="section-heading"><div><div className="section-kicker">01 / MARKET SIMULATOR</div><h2>Order book</h2><p>Select a price level to load its cumulative quantity into the ticket.</p></div><div className="session-controls"><StatusBadge tone={market.session === 'open' ? 'success' : 'warning'}>SESSION {market.session.toUpperCase()}</StatusBadge><Button onClick={() => reset()}>↺ Reset all</Button></div></div>
        <div className="workspace-grid">
          <div className="book panel">
            <div className="panel-header"><div><span className="panel-overline">MARKET DEPTH / SYNTHETIC</span><h3>NOVA <span>USD · $0.05 TICK</span></h3></div><Field label="Scenario" className="scenario-select"><Select aria-label="Scenario" value={market.scenario} onChange={event => reset(event.target.value as ScenarioId)}><option value="balanced">Balanced book</option><option value="thin">Thin offer</option></Select></Field></div>
            <div className="market-metrics"><div><small>LAST TRADE</small><strong><TradingNumber>${formatPrice(market.lastPxCents)}</TradingNumber></strong></div><div><small>BEST BID</small><strong><TradingNumber tone="buy">{bids[0] ? `$${formatPrice(bids[0].priceCents)}` : '—'}</TradingNumber></strong></div><div><small>BEST ASK</small><strong><TradingNumber tone="sell">{asks[0] ? `$${formatPrice(asks[0].priceCents)}` : '—'}</TradingNumber></strong></div><div><small>SPREAD</small><strong><TradingNumber>{bids[0] && asks[0] ? `$${formatPrice(asks[0].priceCents - bids[0].priceCents)}` : '—'}</TradingNumber></strong></div></div>
            <div className="book-toolbar"><span>{view === 'aggregate' ? 'PRICE LEVELS' : 'INDIVIDUAL ORDERS'}</span><SegmentedControl label="Depth view" value={view} options={[{ value: 'aggregate', label: 'Aggregate' }, { value: 'order', label: 'By order' }]} onChange={setView} /></div>
            <div className="depth-scroll"><div className="depth-head"><span>BID SIZE / ORDER</span><span>BID PRICE</span><span>ASK PRICE</span><span>ASK SIZE / ORDER</span></div>
              {Array.from({ length: Math.max(bidRows.length, askRows.length, 1) }, (_, index) => { const bid = bidRows[index], ask = askRows[index]; return <div className="depth-row" key={index}>
                <span className="depth-size bid-size" style={{ ['--bar' as string]: `${Math.min(100, (bid?.quantity ?? 0) / 220 * 100)}%` }}>{bid ? <>{quantityFormat.format(bid.quantity)} {bid.order && <small>{bid.order.id}</small>}</> : '—'}</span>
                <button className="depth-price bid-price" disabled={!bid || market.session === 'closed'} onClick={() => bid && chooseDepth('sell', bid)}>{bid ? formatPrice(bid.priceCents) : '—'}</button>
                <button className="depth-price ask-price" disabled={!ask || market.session === 'closed'} onClick={() => ask && chooseDepth('buy', ask)}>{ask ? formatPrice(ask.priceCents) : '—'}</button>
                <span className="depth-size ask-size" style={{ ['--bar' as string]: `${Math.min(100, (ask?.quantity ?? 0) / 220 * 100)}%` }}>{ask ? <>{ask.order && <small>{ask.order.id}</small>} {quantityFormat.format(ask.quantity)}</> : '—'}</span>
              </div>; })}</div>
            <div className="panel-foot"><span><i className="legend buy" /> BID</span><span><i className="legend sell" /> ASK</span><span>Tick size $0.05</span><span>Price / time priority</span></div>
          </div>

          <div className="right-rail"><form className="ticket panel" onSubmit={submit}><div className="panel-header"><div><span className="panel-overline">ORDER ENTRY</span><h3>Limit ticket</h3></div><span className="ticket-icon">NOVA</span></div>
            <div className="side-picker" role="group" aria-label="Order side"><Button type="button" variant={side === 'buy' ? 'buy' : 'ghost'} aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy</Button><Button type="button" variant={side === 'sell' ? 'sell' : 'ghost'} aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</Button></div>
            <div className="ticket-static"><div><small>ORDER TYPE</small><b>Limit</b></div><div><small>TIME IN FORCE</small><b>DAY</b></div></div>
            <div className="ticket-inputs"><Field label="Limit price · USD"><Input aria-label="Limit price" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} /></Field><Field label="Quantity · shares"><Input aria-label="Quantity" inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} /></Field></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button className="submit-button" variant={side} disabled={market.session === 'closed'}>Submit {side} order</Button>
            <p className="ticket-note">Synthetic orders only. No market connection or real funds.</p></form>
            <div className="session-card panel"><div><span className="panel-overline">SESSION CONTROL</span><h3>DAY orders</h3><p>Closing expires every open remainder. Reset restores the scenario and all IDs.</p></div><Button variant="outlineAccent" onClick={() => setMarket(current => closeDay(current))} disabled={market.session === 'closed'}>Close simulated session</Button></div>
          </div>
        </div>

        <div className="activity-grid"><div className="panel activity-panel"><div className="activity-title"><div><span className="panel-overline">ORDER LIFECYCLE</span><h3>Ticket orders</h3></div><span>{ticketOrders.length} ORDERS</span></div>
          {ticketOrders.length ? <div className="order-table-wrap"><table><thead><tr><th>ORDER ID</th><th>SIDE</th><th>LIMIT</th><th>FILLED / TOTAL</th><th>LEAVES</th><th>STATUS</th></tr></thead><tbody>{ticketOrders.map(order => <tr key={order.id}><td data-label="Order ID" className="mono strong">{order.id}</td><td data-label="Side"><TradingNumber tone={order.side}>{order.side.toUpperCase()}</TradingNumber></td><td data-label="Limit" className="mono">${formatPrice(order.priceCents)}</td><td data-label="Filled / total" className="mono">{order.cumQty} / {order.quantity}</td><td data-label="Leaves" className="mono">{order.leaves}</td><td data-label="Status"><StatusBadge tone={statusTone(order.status)}>{order.status}</StatusBadge></td></tr>)}</tbody></table></div> : <div className="empty-state">Submit a limit order to follow its lifecycle here.</div>}
        </div><div className="panel activity-panel"><div className="activity-title"><div><span className="panel-overline">TRADE TAPE</span><h3>Executions</h3></div><span>{market.trades.length} TRADES</span></div>
          {market.trades.length ? <div className="trade-list">{[...market.trades].reverse().map(trade => <div key={trade.id}><b className="mono">{trade.id}</b><span>{trade.quantity} @ <strong>${formatPrice(trade.priceCents)}</strong></span><small>{trade.aggressorId} ↔ {trade.passiveId}</small></div>)}</div> : <div className="empty-state">Matched orders will appear in the trade tape.</div>}
        </div></div>
      </section>

      <section id="fix" className="fix-section"><div className="section-wrap"><div className="section-heading"><div><div className="section-kicker">02 / FIX WORKBENCH</div><h2>ExecutionReport inspector</h2><p>Each fill yields a report for both orders. Select one or paste a supported message.</p></div><div className="fix-version">FIXT.1.1 <span>→</span> FIX 5.0 SP2</div></div>
        <div className="fix-grid"><div className="panel fix-editor"><div className="activity-title"><div><span className="panel-overline">MESSAGE SOURCE</span><h3>Raw FIX</h3></div><span>{selectedNotice ? `SELECTED ${selectedNotice}` : 'PASTE OR SELECT'}</span></div>
          <div className="report-picker"><Field label="Generated reports"><Select aria-label="Generated report" value={selectedNotice} onChange={event => inspectNotice(event.target.value)}><option value="">Choose an execution report</option>{[...market.notices].reverse().map(notice => <option key={notice.id} value={notice.id}>{notice.id} · {notice.order.id} · {notice.lastQty} @ ${formatPrice(notice.lastPxCents)}</option>)}</Select></Field><Button variant="outlineAccent" onClick={copySoh} disabled={!selectedNotice} title="Copy selected generated report with real SOH bytes">{copied ? 'Copied SOH' : 'Copy SOH'}</Button></div>
          <div className="separator-row"><span>INPUT SEPARATOR</span><SegmentedControl label="Input separator" value={separator} options={[{ value: 'pipe', label: 'Pipe |' }, { value: 'symbol', label: 'Symbol ␁' }, { value: 'soh', label: 'SOH byte' }]} onChange={setSeparator} /></div>
          <Textarea aria-label="FIX message" spellCheck={false} value={input} onChange={event => { setInput(event.target.value); setSelectedNotice(''); setCopied(false); }} placeholder="Paste a FIX 5.0 SP2 ExecutionReport here, or select a generated report above." />
          <p className="editor-note">Choose the exact separator used in the input. BodyLength and CheckSum are checked over UTF-8 bytes.</p>
        </div><div className="panel fix-inspector"><div className="activity-title"><div><span className="panel-overline">PARSER OUTPUT</span><h3>Field inspector</h3></div><StatusBadge tone={parsed.valid ? 'success' : input ? 'error' : 'neutral'}>{parsed.valid ? '✓ VALID' : input ? '× INVALID' : 'AWAITING INPUT'}</StatusBadge></div>
          {input && !parsed.valid && <div className="validation-errors" role="alert">{parsed.errors.map((message, index) => <p key={index}>{message}</p>)}</div>}
          {parsed.fields.length ? <div className="field-table"><div className="field-head"><span>TAG</span><span>FIELD</span><span>VALUE</span></div>{parsed.fields.map((field, index) => <div className="field-row" key={`${field.tag}-${index}`}><span className="mono">{field.tag}</span><span>{field.name}</span><strong className="mono">{field.value}</strong></div>)}</div> : <div className="empty-state">Parsed fields and validation results appear here.</div>}
        </div></div>
        <div className="scope-note"><strong>SUPPORTED SCOPE</strong><span>ExecutionReport (35=8), trade (150=F), limit (40=2), DAY (59=0), no repeating groups. This is a stateless educational parser, not a FIX session engine.</span></div>
      </div></section>

      <section id="about" className="about-section section-wrap"><div><div className="section-kicker">SCOPE / LOCAL LAB</div><h2>Independent simulation</h2></div><p>Synthetic data and deterministic scenarios. The matching engine, FIX codec, and interface are separate modules. No exchange, broker, or employer system is connected.</p></section>
    </main><footer><span>MARKET DEPTH + FIX LAB</span><span>Independent portfolio project · Synthetic data · Browser only</span><a href="#top">Top ↑</a></footer>
  </div>;
}
