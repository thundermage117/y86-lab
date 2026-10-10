import Segmented from './common/Segmented.jsx';
import TabBar from './common/TabBar.jsx';
import Chip from './common/Chip.jsx';
import { IconButton } from './common/Icon.jsx';

/** Brand, view tabs and the app-wide settings (CPU, number format, theme, run status). */
export default function AppHeader({
  tabs, tab, onTabChange, mode, onModeChange, numberFormat, onNumberFormatChange, theme, onThemeToggle, status,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <h1>Y86-64 <span className="brand-long">Pipeline Visualizer</span></h1>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={onTabChange} label="Views" idPrefix="view" className="main-tabs" />

      <div className="header-settings">
        <Segmented
          label="CPU"
          size="sm"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'pipelined', label: 'Pipelined', title: '5-stage PIPE processor' },
            { value: 'sequential', label: 'Sequential', title: 'Single-cycle SEQ processor' },
          ]}
        />
        <Segmented
          label="Number format"
          size="sm"
          value={numberFormat}
          onChange={onNumberFormatChange}
          options={[{ value: 'dec', label: 'Dec' }, { value: 'hex', label: 'Hex' }]}
        />
        <IconButton
          icon={theme === 'dark' ? 'sun' : 'moon'}
          size="sm"
          className="icon-btn-ghost"
          label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Toggle theme"
          onClick={onThemeToggle}
        />
        <Chip tone={status.tone} variant="quiet" className="status-chip" role="status" aria-live="polite">
          {status.label}
        </Chip>
      </div>
    </header>
  );
}
