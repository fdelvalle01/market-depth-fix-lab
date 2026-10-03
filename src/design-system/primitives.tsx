import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import './tokens.css';

type ButtonVariant = 'accent' | 'ghost' | 'outlineAccent' | 'buy' | 'sell';
export function Button({ variant = 'ghost', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`tws-btn tws-btn--${variant} ${className}`} {...props} />;
}

export function Field({ label, htmlFor, children, className = '' }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return <div className={`tws-field ${className}`}><label className="tws-label" htmlFor={htmlFor}>{label}</label>{children}</div>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`tws-input tws-number ${props.className ?? ''}`} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`tws-input ${props.className ?? ''}`} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`tws-input tws-number ${props.className ?? ''}`} />; }

export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="tws-segment" role="group" aria-label={label}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral'; children: ReactNode }) {
  return <span className={`tws-status tws-status--${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function TradingNumber({ tone, children }: { tone?: 'buy' | 'sell'; children: ReactNode }) {
  return <span className={`tws-number ${tone ? `tws-number--${tone}` : ''}`}>{children}</span>;
}
