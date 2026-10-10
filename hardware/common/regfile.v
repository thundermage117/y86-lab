`include "defs.vh"

// Clocked register with enable and synchronous reset. Powers up at INIT.
module cenrreg(out, in, enable, reset, resetval, clock);
	parameter WIDTH = 8;
	parameter [WIDTH-1:0] INIT = 0;
	output reg [WIDTH-1:0] out;
	input [WIDTH-1:0] in;
	input enable, reset;
	input [WIDTH-1:0] resetval;
	input clock;

	initial out = INIT;
	always @(posedge clock) begin
		if (reset)
			out <= resetval;
		else if (enable)
			out <= in;
	end
endmodule

// Pipeline register: stall holds the value, bubble loads BUBBLE.
module preg(out, in, stall, bubble, clock);
	parameter WIDTH = 8;
	parameter [WIDTH-1:0] BUBBLE = 0;
	output [WIDTH-1:0] out;
	input [WIDTH-1:0] in;
	input stall, bubble, clock;

	cenrreg #(WIDTH, BUBBLE) r(out, in, ~stall, bubble, BUBBLE, clock);
endmodule

// Condition codes, reset to ZF=1 SF=0 OF=0.
module cc(cc, new_cc, set_cc, clock);
	output [2:0] cc;
	input [2:0] new_cc;
	input set_cc, clock;

	cenrreg #(3, 3'b001) c(cc, new_cc, set_cc, 1'b0, 3'b001, clock);
endmodule

// 15-entry register file, two read ports and two write ports (M wins).
module regfile(dstE, valE, dstM, valM, srcA, valA, srcB, valB, clock,
	rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);

	input [3:0] dstE, dstM, srcA, srcB;
	input [63:0] valE, valM;
	input clock;
	output [63:0] valA, valB;
	output [63:0] rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14;

	wire [63:0] regs [0:14];
	assign rax = regs[0];  assign rcx = regs[1];  assign rdx = regs[2];
	assign rbx = regs[3];  assign rsp = regs[4];  assign rbp = regs[5];
	assign rsi = regs[6];  assign rdi = regs[7];  assign r8  = regs[8];
	assign r9  = regs[9];  assign r10 = regs[10]; assign r11 = regs[11];
	assign r12 = regs[12]; assign r13 = regs[13]; assign r14 = regs[14];

	genvar i;
	generate for (i = 0; i < 15; i = i + 1) begin : gpr
		cenrreg #(64, 64'd0) reg_cell(regs[i], (dstM == i) ? valM : valE,
			(dstM == i) || (dstE == i), 1'b0, 64'd0, clock);
	end
	endgenerate

	assign valA = (srcA == `RNONE) ? 64'd0 : regs[srcA];
	assign valB = (srcB == `RNONE) ? 64'd0 : regs[srcB];
endmodule
