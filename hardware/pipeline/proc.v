// Y86-64 five-stage pipelined processor (CS:APP PIPE) and its simulation harness.
//
// Plusargs:
//   +program=<file>   memory image for $readmemh (required)
//   +vcd=<file>       waveform output (default sim/proc.vcd)
//   +max_cycles=<n>   cycle cap (default 2000)
//   +memdump=<file>   write final memory with $writememh
`include "defs.vh"
`include "regfile.v"
`include "ram.v"
`include "fetch.v"
`include "decode.v"
`include "execute.v"
`include "mem_ctrl.v"

module proc;

reg clock;

// ---------------------------------------------------------------- Fetch
wire [63:0] F_predPC;
reg  [63:0] f_pc;
wire [79:0] f_ibytes;
wire [ 3:0] f_icode, f_ifun, f_rA, f_rB;
wire [63:0] f_valC, f_valP, f_predPC;
wire        instr_valid, imem_error;
wire [ 1:0] f_stat;

// ---------------------------------------------------------------- Decode
wire [ 1:0] D_stat;
wire [63:0] D_pc, D_valC, D_valP;
wire [ 3:0] D_icode, D_ifun, D_rA, D_rB;
wire [ 3:0] d_srcA, d_srcB, d_dstE, d_dstM;
wire [63:0] d_rvalA, d_rvalB;
reg  [63:0] d_valA, d_valB;
// Forwarding source selected for valA / valB:
// 0 regfile, 1 D_valP, 2 e_valE, 3 m_valM, 4 M_valE, 5 W_valM, 6 W_valE
reg  [ 2:0] d_fwdA, d_fwdB;

// ---------------------------------------------------------------- Execute
wire [ 1:0] E_stat;
wire [63:0] E_pc, E_valC, E_valA, E_valB;
wire [ 3:0] E_icode, E_ifun, E_dstE, E_dstM, E_srcA, E_srcB;
wire [63:0] e_valE;
wire        e_Cnd, e_wants_cc, set_cc;
wire [ 2:0] cc, new_cc;
wire [ 3:0] e_dstE;

// ---------------------------------------------------------------- Memory
wire [ 1:0] M_stat;
wire [63:0] M_pc, M_valE, M_valA;
wire [ 3:0] M_icode, M_ifun, M_dstE, M_dstM;
wire        M_Cnd;
wire        mem_read, mem_write, dmem_error;
wire [63:0] mem_addr, mem_data, m_valM;
wire [ 1:0] m_stat;

// ---------------------------------------------------------------- Write-back
wire [ 1:0] W_stat;
wire [63:0] W_pc, W_valE, W_valM;
wire [ 3:0] W_icode, W_dstE, W_dstM;
wire [ 3:0] w_dstE, w_dstM;

// Architectural registers (exposed for the waveform)
wire [63:0] rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14;

// ---------------------------------------------------------------- Pipeline control
wire F_stall, F_bubble, D_stall, D_bubble, E_stall, E_bubble, M_stall, M_bubble, W_stall, W_bubble;

wire load_use   = (E_icode == `IMRMOVQ || E_icode == `IPOPQ) && E_dstM != `RNONE &&
                  (E_dstM == d_srcA || E_dstM == d_srcB);
wire ret_hazard = (D_icode == `IRET || E_icode == `IRET || M_icode == `IRET);
wire mispredict = (E_icode == `IJXX) && !e_Cnd;
wire m_exc      = (m_stat != `SAOK);
wire w_exc      = (W_stat != `SAOK);

assign F_stall  = load_use || ret_hazard;
assign F_bubble = 1'b0;
assign D_stall  = load_use;
assign D_bubble = mispredict || (!load_use && ret_hazard);
assign E_stall  = 1'b0;
assign E_bubble = mispredict || load_use;
assign M_stall  = 1'b0;
assign M_bubble = m_exc || w_exc;
assign W_stall  = w_exc;
assign W_bubble = 1'b0;

// ---------------------------------------------------------------- Pipeline registers
preg #(64)                 F_predPC_reg(F_predPC, f_predPC, F_stall, F_bubble, clock);

preg #(2)                  D_stat_reg (D_stat,  f_stat,  D_stall, D_bubble, clock);
preg #(64)                 D_pc_reg   (D_pc,    f_pc,    D_stall, D_bubble, clock);
preg #(4, `INOP)           D_icode_reg(D_icode, f_icode, D_stall, D_bubble, clock);
preg #(4)                  D_ifun_reg (D_ifun,  f_ifun,  D_stall, D_bubble, clock);
preg #(4, `RNONE)          D_rA_reg   (D_rA,    f_rA,    D_stall, D_bubble, clock);
preg #(4, `RNONE)          D_rB_reg   (D_rB,    f_rB,    D_stall, D_bubble, clock);
preg #(64)                 D_valC_reg (D_valC,  f_valC,  D_stall, D_bubble, clock);
preg #(64)                 D_valP_reg (D_valP,  f_valP,  D_stall, D_bubble, clock);

preg #(2)                  E_stat_reg (E_stat,  D_stat,  E_stall, E_bubble, clock);
preg #(64)                 E_pc_reg   (E_pc,    D_pc,    E_stall, E_bubble, clock);
preg #(4, `INOP)           E_icode_reg(E_icode, D_icode, E_stall, E_bubble, clock);
preg #(4)                  E_ifun_reg (E_ifun,  D_ifun,  E_stall, E_bubble, clock);
preg #(64)                 E_valC_reg (E_valC,  D_valC,  E_stall, E_bubble, clock);
preg #(64)                 E_valA_reg (E_valA,  d_valA,  E_stall, E_bubble, clock);
preg #(64)                 E_valB_reg (E_valB,  d_valB,  E_stall, E_bubble, clock);
preg #(4, `RNONE)          E_dstE_reg (E_dstE,  d_dstE,  E_stall, E_bubble, clock);
preg #(4, `RNONE)          E_dstM_reg (E_dstM,  d_dstM,  E_stall, E_bubble, clock);
preg #(4, `RNONE)          E_srcA_reg (E_srcA,  d_srcA,  E_stall, E_bubble, clock);
preg #(4, `RNONE)          E_srcB_reg (E_srcB,  d_srcB,  E_stall, E_bubble, clock);

preg #(2)                  M_stat_reg (M_stat,  E_stat,  M_stall, M_bubble, clock);
preg #(64)                 M_pc_reg   (M_pc,    E_pc,    M_stall, M_bubble, clock);
preg #(4, `INOP)           M_icode_reg(M_icode, E_icode, M_stall, M_bubble, clock);
preg #(4)                  M_ifun_reg (M_ifun,  E_ifun,  M_stall, M_bubble, clock);
preg #(1)                  M_Cnd_reg  (M_Cnd,   e_Cnd,   M_stall, M_bubble, clock);
preg #(64)                 M_valE_reg (M_valE,  e_valE,  M_stall, M_bubble, clock);
preg #(64)                 M_valA_reg (M_valA,  E_valA,  M_stall, M_bubble, clock);
preg #(4, `RNONE)          M_dstE_reg (M_dstE,  e_dstE,  M_stall, M_bubble, clock);
preg #(4, `RNONE)          M_dstM_reg (M_dstM,  E_dstM,  M_stall, M_bubble, clock);

preg #(2)                  W_stat_reg (W_stat,  m_stat,  W_stall, W_bubble, clock);
preg #(64)                 W_pc_reg   (W_pc,    M_pc,    W_stall, W_bubble, clock);
preg #(4, `INOP)           W_icode_reg(W_icode, M_icode, W_stall, W_bubble, clock);
preg #(64)                 W_valE_reg (W_valE,  M_valE,  W_stall, W_bubble, clock);
preg #(64)                 W_valM_reg (W_valM,  m_valM,  W_stall, W_bubble, clock);
preg #(4, `RNONE)          W_dstE_reg (W_dstE,  M_dstE,  W_stall, W_bubble, clock);
preg #(4, `RNONE)          W_dstM_reg (W_dstM,  M_dstM,  W_stall, W_bubble, clock);

// ---------------------------------------------------------------- Memory
ram RAM(clock, f_pc, f_ibytes, mem_addr, mem_read, mem_write, mem_data, m_valM, dmem_error);

// ---------------------------------------------------------------- Fetch stage
always @(*) begin
	if (M_icode == `IJXX && !M_Cnd)  f_pc = M_valA;     // mispredicted branch
	else if (W_icode == `IRET)       f_pc = W_valM;     // return address
	else                             f_pc = F_predPC;
end

fetch FETCH(f_pc, f_ibytes, f_icode, f_ifun, f_rA, f_rB, f_valC, f_valP,
            instr_valid, imem_error, f_stat);

assign f_predPC = (f_icode == `IJXX || f_icode == `ICALL) ? f_valC : f_valP;

// ---------------------------------------------------------------- Decode stage
decode_ctrl DECODE(D_icode, D_rA, D_rB, 1'b1, d_srcA, d_srcB, d_dstE, d_dstM);

regfile REGS(w_dstE, W_valE, w_dstM, W_valM, d_srcA, d_rvalA, d_srcB, d_rvalB, clock,
             rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);

always @(*) begin
	if (D_icode == `ICALL || D_icode == `IJXX)      begin d_valA = D_valP; d_fwdA = 3'd1; end
	else if (d_srcA == `RNONE)                      begin d_valA = d_rvalA; d_fwdA = 3'd0; end
	else if (d_srcA == e_dstE)                      begin d_valA = e_valE; d_fwdA = 3'd2; end
	else if (d_srcA == M_dstM)                      begin d_valA = m_valM; d_fwdA = 3'd3; end
	else if (d_srcA == M_dstE)                      begin d_valA = M_valE; d_fwdA = 3'd4; end
	else if (d_srcA == W_dstM)                      begin d_valA = W_valM; d_fwdA = 3'd5; end
	else if (d_srcA == W_dstE)                      begin d_valA = W_valE; d_fwdA = 3'd6; end
	else                                            begin d_valA = d_rvalA; d_fwdA = 3'd0; end

	if (d_srcB == `RNONE)                           begin d_valB = d_rvalB; d_fwdB = 3'd0; end
	else if (d_srcB == e_dstE)                      begin d_valB = e_valE; d_fwdB = 3'd2; end
	else if (d_srcB == M_dstM)                      begin d_valB = m_valM; d_fwdB = 3'd3; end
	else if (d_srcB == M_dstE)                      begin d_valB = M_valE; d_fwdB = 3'd4; end
	else if (d_srcB == W_dstM)                      begin d_valB = W_valM; d_fwdB = 3'd5; end
	else if (d_srcB == W_dstE)                      begin d_valB = W_valE; d_fwdB = 3'd6; end
	else                                            begin d_valB = d_rvalB; d_fwdB = 3'd0; end
end

// ---------------------------------------------------------------- Execute stage
execute EXECUTE(E_icode, E_ifun, E_valA, E_valB, E_valC, cc, e_valE, e_Cnd, new_cc, e_wants_cc);

// Don't update CC while a later instruction is excepting.
assign set_cc = e_wants_cc && !m_exc && !w_exc;
cc CC(cc, new_cc, set_cc, clock);

// cmovXX that fails its condition writes nothing.
assign e_dstE = (E_icode == `IRRMOVQ && !e_Cnd) ? `RNONE : E_dstE;

// ---------------------------------------------------------------- Memory stage
mem_ctrl MEMCTRL(M_icode, M_valE, M_valA, M_valA, mem_read, mem_write, mem_addr, mem_data);
assign m_stat = dmem_error ? `SADR : M_stat;

// ---------------------------------------------------------------- Write-back stage
// An excepting instruction does not update the register file.
assign w_dstE = (W_stat == `SAOK) ? W_dstE : `RNONE;
assign w_dstM = (W_stat == `SAOK) ? W_dstM : `RNONE;

// ---------------------------------------------------------------- Simulation harness
reg [8*512-1:0] vcd_file, memdump_file;
integer max_cycles, cycle;
reg halted;

task report;
	begin
		$display("STATUS stat=%0d cycles=%0d", W_stat, cycle);
		$display("REGS %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h",
			rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);
		$display("CC %03b", cc);
		if ($value$plusargs("memdump=%s", memdump_file))
			$writememh(memdump_file, RAM.mem);
	end
endtask

initial begin
	if (!$value$plusargs("vcd=%s", vcd_file)) vcd_file = "sim/proc.vcd";
	if (!$value$plusargs("max_cycles=%d", max_cycles)) max_cycles = 2000;
	$dumpfile(vcd_file);
	$dumpvars(1, proc);

	clock = 1'b0;
	for (cycle = 1; cycle <= max_cycles; cycle = cycle + 1) begin
		#10;
		halted = w_exc;
		clock = 1'b1;           // rising edge: the waveform sample point
		if (halted) begin
			#1 report;
			$finish;
		end
		#10 clock = 1'b0;
	end
	$display("TIMEOUT after %0d cycles", max_cycles);
	report;
	$finish;
end

endmodule
