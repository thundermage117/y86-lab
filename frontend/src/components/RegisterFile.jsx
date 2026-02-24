const REG_NAMES = [
  'rax', 'rcx', 'rdx', 'rbx',
  'rsp', 'rbp', 'rsi', 'rdi',
  'r8',  'r9',  'r10', 'r11',
  'r12', 'r13', 'r14',
];

export default function RegisterFile({ registers, changedRegisters = new Set() }) {
  if (!registers) {
    return <div className="register-file register-empty">No data.</div>;
  }

  return (
    <div className="register-file">
      <h2 className="section-title">Register File</h2>
      <div className="register-summary">
        Highlighted rows changed in the current cycle. Blue rows are non-zero values.
      </div>
      <div className="reg-grid">
        {REG_NAMES.map(name => {
          const val = registers[name] ?? 'x';
          const isNonZero = val !== 'x' && val !== '0x0000000000000000';
          const isChanged = changedRegisters.has(name);
          return (
            <div key={name} className={`reg-entry${isNonZero ? ' reg-nonzero' : ''}${isChanged ? ' reg-changed' : ''}`}>
              <span className="reg-name">
                %{name}
                {isChanged && <span className="reg-badge">updated</span>}
              </span>
              <span className="reg-val">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
