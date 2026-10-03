import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('main workstation journey', () => {
  it('submits a sweep, inspects a parsed report, closes DAY and fully resets', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('SESSION OPEN')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /submit buy order/i }));
    expect(screen.getByText('3 TRADES')).toBeInTheDocument();
    expect(screen.getByText('U-001', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('✓ VALID')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Generated report'), 'E-005');
    const inspector = screen.getByText('Field inspector').closest('.fix-inspector') as HTMLElement;
    expect(within(inspector).getByText('LastQty').parentElement).toHaveTextContent('25');
    expect(within(inspector).getByText('CumQty').parentElement).toHaveTextContent('150');
    await user.click(screen.getByRole('button', { name: /close simulated session/i }));
    expect(screen.getByText('SESSION CLOSED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit buy order/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /reset all/i }));
    expect(screen.getByText('SESSION OPEN')).toBeInTheDocument();
    expect(screen.getByText('0 TRADES')).toBeInTheDocument();
    expect(screen.getByText('0 ORDERS')).toBeInTheDocument();
    expect(screen.getByLabelText('FIX message')).toHaveValue('');
  });

  it('validates ticket tick and shows order-level identities', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'By order' }));
    expect(screen.getByText('P-005')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Limit price'));
    await user.type(screen.getByLabelText('Limit price'), '100.03');
    await user.click(screen.getByRole('button', { name: /submit buy order/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('tick');
    expect(screen.getByText('0 TRADES')).toBeInTheDocument();
  });

  it('switches the workstation theme without changing market state', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('market-depth-fix-lab.theme')).toBe('light');
    expect(screen.getByText('0 TRADES')).toBeInTheDocument();
  });
});
