const PATHS = {
  first: 'M6 5h2v14H6zM20 5v14L9 12z',
  prev: 'M15 5v14L6 12z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M9 5v14l9-7z',
  last: 'M16 5h2v14h-2zM4 5v14l11-7z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5 1 3h-2zm0 20-1-3h2zM2 12l3-1v2zm20 0-3 1v-2zM4.9 4.9l2.8 1.4-1.4 1.4zm14.2 14.2-2.8-1.4 1.4-1.4zM4.9 19.1l1.4-2.8 1.4 1.4zM19.1 4.9l-1.4 2.8-1.4-1.4z',
  moon: 'M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z',
  chevronDown: 'M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z',
  chevronRight: 'M8.6 17.6 14.2 12 8.6 6.4 10 5l7 7-7 7z',
  eventPrev: 'M14 6 8 12l6 6-1.4 1.4L5.2 12l7.4-7.4z M19 5h-2v14h2z',
  eventNext: 'M10 6l6 6-6 6 1.4 1.4 7.4-7.4-7.4-7.4z M5 5h2v14H5z',
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/** Square icon-only button; `label` is its accessible name. */
export function IconButton({ icon, label, title = label, primary = false, size = 'md', className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-${size}${primary ? ' is-primary' : ''} ${className}`}
      aria-label={label}
      title={title}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}
