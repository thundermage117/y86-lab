/**
 * Small pill label, the one chip style in the app.
 * variant: 'outline' (default) | 'solid' | 'quiet'. `tone` (stall, bubble,
 * forward, error, info, ok, warn, busy, idle, accent) or `stage` sets the color.
 */
export default function Chip({ as: Tag = 'span', tone, stage, variant = 'outline', className = '', children, ...rest }) {
  const classes = ['chip', `chip-${variant}`, tone && `tone-${tone}`, stage && `stage-${stage}`, className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes} {...rest}>{children}</Tag>;
}
