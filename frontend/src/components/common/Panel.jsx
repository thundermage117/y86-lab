/** A titled card section. */
export default function Panel({ title, subtitle, actions, children, className = '', id }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`panel ${className}`} id={id} aria-labelledby={headingId}>
      {(title || actions) && (
        <header className="panel-header">
          <div>
            {title && <h2 className="panel-title" id={headingId}>{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
