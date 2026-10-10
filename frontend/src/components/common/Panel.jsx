import { useState } from 'react';
import { readStored, writeStored } from '../../hooks/storage.js';

/**
 * A titled card section. With `collapsible` (requires `id`) the body can be
 * hidden; the choice is remembered per panel.
 */
export default function Panel({ title, subtitle, actions, children, className = '', id, collapsible = false }) {
  const headingId = id ? `${id}-title` : undefined;
  const bodyId = id ? `${id}-body` : undefined;
  const storageKey = `y86-panel-${id}`;
  const [collapsed, setCollapsed] = useState(() => collapsible && readStored(storageKey) === 'collapsed');

  const toggle = () => {
    setCollapsed((c) => {
      writeStored(storageKey, c ? null : 'collapsed');
      return !c;
    });
  };

  return (
    <section className={`panel ${className}${collapsed ? ' is-collapsed' : ''}`} id={id} aria-labelledby={headingId}>
      {(title || actions) && (
        <header className="panel-header">
          <div>
            {title && <h2 className="panel-title" id={headingId}>{title}</h2>}
            {subtitle && !collapsed && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          <div className="panel-actions">
            {!collapsed && actions}
            {collapsible && (
              <button
                type="button"
                className="panel-toggle"
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                onClick={toggle}
                title={collapsed ? 'Expand' : 'Collapse'}
              >
                <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                <span className="sr-only">{collapsed ? `Expand ${title}` : `Collapse ${title}`}</span>
              </button>
            )}
          </div>
        </header>
      )}
      {!collapsed && <div id={bodyId} className="panel-body">{children}</div>}
    </section>
  );
}
