'use client';
import { useState, useRef, useEffect, Children, isValidElement, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface OptionData {
  value: string;
  label: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

interface CustomSelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
  className?: string;
  name?: string;
}

const DROPDOWN_MAX_HEIGHT = 280;
const GAP = 6;

export default function CustomSelect({
  value,
  onChange,
  children,
  placeholder,
  required,
  disabled,
  id,
  style,
  className,
  name,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const options: OptionData[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'option') {
      const p = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean; style?: React.CSSProperties };
      const label = Children.toArray(p.children).join('');
      options.push({
        value: p.value !== undefined ? String(p.value) : label,
        label,
        disabled: p.disabled,
        style: p.style,
      });
    }
  });

  const selected = options.find((o) => o.value === value);
  const menuOptions = options.filter((o) => !(o.disabled && o.value === ''));

  const computeDropdownStyle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const estimatedHeight = Math.min(DROPDOWN_MAX_HEIGHT, menuOptions.length * 40 + 12);
    const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    if (shouldOpenUp) {
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + GAP,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
        animation: 'fadeInDown 0.15s ease',
      });
    } else {
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + GAP,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
        animation: 'fadeInUp 0.15s ease',
      });
    }
  }, [menuOptions.length]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) computeDropdownStyle();
    setOpen((p) => !p);
  };

  // Reposition on scroll or resize while open
  useEffect(() => {
    if (!open) return;
    const update = () => computeDropdownStyle();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, computeDropdownStyle]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (optValue: string) => {
    onChange({ target: { value: optValue } });
    setOpen(false);
  };

  const isOpen = open && !disabled;

  const dropdown = (
    <ul
      ref={dropdownRef}
      role="listbox"
      style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-lg)',
        padding: '5px',
        margin: 0,
        listStyle: 'none',
        maxHeight: DROPDOWN_MAX_HEIGHT,
        overflowY: 'auto',
        ...dropdownStyle,
      }}
    >
      {menuOptions.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <li
            key={opt.value}
            role="option"
            aria-selected={isSelected}
            tabIndex={opt.disabled ? -1 : 0}
            onClick={() => !opt.disabled && handleSelect(opt.value)}
            onKeyDown={(e) => {
              if (!opt.disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSelect(opt.value);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 10,
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: isSelected ? 600 : 400,
              color: opt.disabled ? '#94a3b8' : isSelected ? 'var(--primary)' : 'var(--ink)',
              backgroundColor: isSelected ? 'var(--primary-soft)' : 'transparent',
              transition: 'background 0.12s, color 0.12s',
              userSelect: 'none',
              ...(opt.style ?? {}),
            }}
            onMouseEnter={(e) => {
              if (!isSelected && !opt.disabled)
                (e.currentTarget as HTMLLIElement).style.backgroundColor = 'rgba(20, 92, 158, 0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLLIElement).style.backgroundColor =
                  isSelected ? 'var(--primary-soft)' : 'transparent';
            }}
          >
            <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSelected && <Check size={13} style={{ color: 'var(--primary)' }} />}
            </span>
            {opt.label}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={undefined} style={{ position: 'relative', ...(style ?? {}) }} className={className}>
      <input type="hidden" name={name} value={value} required={required} />

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px 10px 14px',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: disabled ? '#f1f5f9' : 'rgba(251, 253, 255, 0.85)',
          color: disabled ? '#94a3b8' : selected ? 'var(--ink)' : '#94a3b8',
          fontSize: 13,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(20, 92, 158, 0.08)' : 'none',
          transition: 'all var(--transition)',
          textAlign: 'left',
          fontFamily: 'inherit',
          lineHeight: '1.4',
          minHeight: 42,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          size={15}
          style={{
            flexShrink: 0,
            color: isOpen ? 'var(--primary)' : '#667085',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease, color 0.2s ease',
          }}
        />
      </button>

      {mounted && isOpen && createPortal(dropdown, document.body)}
    </div>
  );
}
