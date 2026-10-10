import { useState } from 'react';
import { readStored, writeStored } from '../../hooks/storage.js';
import { IconButton } from './Icon.jsx';

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
              <IconButton
                icon={collapsed ? 'chevronRight' : 'chevronDown'}
                size="sm"
                className="icon-btn-ghost"
                label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
                title={collapsed ? 'Expand' : 'Collapse'}
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                onClick={toggle}
              />
            )}
          </div>
        </header>
      )}
      {!collapsed && <div id={bodyId} className="panel-body">{children}</div>}
    </section>
  );
}
