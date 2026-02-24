const REG_NAMES = [
  'rax', 'rcx', 'rdx', 'rbx',
  'rsp', 'rbp', 'rsi', 'rdi',
  'r8',  'r9',  'r10', 'r11',
  'r12', 'r13', 'r14',
];

export default function RegisterFile({ registers }) {
  if (!registers) {
    return <div className="register-file register-empty">No data.</div>;
  }

  return (
    <div className="register-file">
      <h2 className="section-title">Register File</h2>
      <div className="reg-grid">
        {REG_NAMES.map(name => {
          const val = registers[name] ?? 'x';
          const isNonZero = val !== 'x' && val !== '0x0000000000000000';
          return (
            <div key={name} className={`reg-entry${isNonZero ? ' reg-nonzero' : ''}`}>
              <span className="reg-name">%{name}</span>
              <span className="reg-val">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
