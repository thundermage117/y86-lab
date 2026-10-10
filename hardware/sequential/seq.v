// Y86-64 sequential processor (CS:APP SEQ) and its simulation harness.
// Same plusargs as pipeline/proc.v.
`include "defs.vh"
`include "regfile.v"
`include "ram.v"
`include "fetch.v"
`include "decode.v"
`include "execute.v"
`include "mem_ctrl.v"

module seq;

reg clock;

reg  [63:0] PC;
wire [79:0] ibytes;
wire [ 3:0] icode, ifun, rA, rB;
wire [63:0] valC, valP, valA, valB, valE, valM;
wire        instr_valid, imem_error, dmem_error;
wire [ 1:0] f_stat, stat;
wire [ 3:0] srcA, srcB, dstE, dstM, w_dstE, w_dstM;
wire        Cnd, wants_cc, set_cc;
wire [ 2:0] cc, new_cc;
wire        mem_read, mem_write;
wire [63:0] mem_addr, mem_data;
reg  [63:0] new_pc;

wire [63:0] rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14;

ram RAM(clock, PC, ibytes, mem_addr, mem_read, mem_write, mem_data, valM, dmem_error);

fetch FETCH(PC, ibytes, icode, ifun, rA, rB, valC, valP, instr_valid, imem_error, f_stat);

decode_ctrl DECODE(icode, rA, rB, Cnd, srcA, srcB, dstE, dstM);

regfile REGS(w_dstE, valE, w_dstM, valM, srcA, valA, srcB, valB, clock,
             rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);

execute EXECUTE(icode, ifun, valA, valB, valC, cc, valE, Cnd, new_cc, wants_cc);

mem_ctrl MEMCTRL(icode, valE, valA, valP, mem_read, mem_write, mem_addr, mem_data);

assign stat = dmem_error ? `SADR : f_stat;

// State only changes for instructions that complete normally.
assign set_cc = wants_cc && stat == `SAOK;
assign w_dstE = (stat == `SAOK) ? dstE : `RNONE;
assign w_dstM = (stat == `SAOK) ? dstM : `RNONE;

cc CC(cc, new_cc, set_cc, clock);

always @(*) begin
	if (icode == `ICALL)               new_pc = valC;
	else if (icode == `IJXX && Cnd)    new_pc = valC;
	else if (icode == `IRET)           new_pc = valM;
	else                               new_pc = valP;
end

initial PC = 64'd0;
always @(posedge clock)
	if (stat == `SAOK) PC <= new_pc;

// ---------------------------------------------------------------- Simulation harness
reg [8*512-1:0] vcd_file, memdump_file;
integer max_cycles, cycle;
reg halted;

task report;
	begin
		$display("STATUS stat=%0d cycles=%0d", stat, cycle);
		$display("REGS %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h %016h",
			rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);
		$display("CC %03b", cc);
		if ($value$plusargs("memdump=%s", memdump_file))
			$writememh(memdump_file, RAM.mem);
	end
endtask

initial begin
	if (!$value$plusargs("vcd=%s", vcd_file)) vcd_file = "sim/seq.vcd";
	if (!$value$plusargs("max_cycles=%d", max_cycles)) max_cycles = 2000;
	$dumpfile(vcd_file);
	$dumpvars(1, seq);

	clock = 1'b0;
	for (cycle = 1; cycle <= max_cycles; cycle = cycle + 1) begin
		#10;
		halted = (stat != `SAOK);
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
