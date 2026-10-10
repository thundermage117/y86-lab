import { useRef } from 'react';

/**
 * Accessible tab list (WAI-ARIA tabs pattern): roving tabindex, arrow keys,
 * Home/End. Panels should use id `${idPrefix}-panel-${key}`.
 */
export default function TabBar({ tabs, active, onChange, label, idPrefix, className = '' }) {
  const refs = useRef({});

  const focusTab = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.key);
    refs.current[tab.key]?.focus();
  };

  const onKeyDown = (event, index) => {
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      focusTab(moves[event.key]);
    }
  };

  return (
    <div className={`tab-bar ${className}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => { refs.current[tab.key] = el; }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            className={`tab${selected ? ' is-active' : ''}`}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
            {tab.badge ? <span className="tab-badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, tabKey, children, className = '' }) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-tab-${tabKey}`}
      className={className}
    >
      {children}
    </div>
  );
}
