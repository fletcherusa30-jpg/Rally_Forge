import { useState, useRef, useEffect } from 'react';

/**
 * Small "?" button that reveals an info overlay on click.
 * Used throughout the app to explain features without cluttering the layout.
 */
export function InfoPopup({ children, label = 'More info', width = 320 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.15rem',
          height: '1.15rem',
          borderRadius: '50%',
          border: '1px solid rgba(148,163,184,0.45)',
          background: 'rgba(15,23,42,0.7)',
          color: '#94a3b8',
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            width,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(131,169,194,0.3)',
            backgroundColor: 'rgba(14,38,58,0.97)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            lineHeight: 1.55,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
