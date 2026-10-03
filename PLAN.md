# Market Depth + FIX Lab — implementation plan

## 1. Simulation
- [x] Deterministic synthetic scenarios; aggregate and order-level depth show the same book.
- [x] Limit orders match by price then arrival time, preserving IDs and fill history for both sides.
- [x] Partial fills, resting leaves, integer price units, tick validation, DAY close, and full reset work.
- [x] Engine tests pass before starting the FIX milestone.

## 2. FIX
- [x] Each trade creates an ExecutionReport for each participating order with distinct last and cumulative values.
- [x] FIXT.1.1 / FIX 5.0 SP2 messages use byte-correct BodyLength and CheckSum.
- [x] Pasted SOH and explicitly selected visible separators parse and validate; inspector reads parsed fields.
- [x] FIX tests pass before completing the interface.

## 3. Delivery
- [x] Responsive English UI covers ticket, depth, order ledger, session, FIX workbench, and reset.
- [x] Main user journey test, production build, and browser check pass (headless Edge at desktop and mobile widths).
- [x] README documents setup, architecture, demo, supported subset, and limitations.

## Design-system revision
- [x] Adapt personal Trading Workstation Obsidiana / Claro tokens into a portable local subset.
- [x] Use workstation primitives for buttons, fields, inputs, segmented controls, status badges, and numbers.
- [x] Keep brand blue separate from trading buy/sell colors; bundle IBM Plex fonts locally.
- [x] Check the main path and mobile layout in a browser after the redesign.

The original portfolio remains untouched. All market data and identifiers are synthetic.
