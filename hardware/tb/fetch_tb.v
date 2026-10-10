// Self-checking fetch test: instruction field extraction, valP, status codes.
`include "defs.vh"
`include "fetch.v"

module fetch_tb;
	reg  [63:0] pc;
	reg  [79:0] ibytes;
	wire [3:0]  icode, ifun, rA, rB;
	wire [63:0] valC, valP;
	wire        instr_valid, imem_error;
	wire [1:0]  stat;
	integer errors;

	fetch #(64) DUT(pc, ibytes, icode, ifun, rA, rB, valC, valP, instr_valid, imem_error, stat);

	task expect_fields(input [3:0] e_icode, input [3:0] e_ifun, input [3:0] e_rA, input [3:0] e_rB,
	                   input [63:0] e_valC, input [63:0] e_valP, input [1:0] e_stat);
		begin
			#1;
			if (icode !== e_icode || ifun !== e_ifun || rA !== e_rA || rB !== e_rB ||
			    valC !== e_valC || valP !== e_valP || stat !== e_stat) begin
				errors = errors + 1;
				$display("FAIL fetch pc=%0d bytes=%h: got %h %h %h %h %h %h st=%0d", pc, ibytes,
					icode, ifun, rA, rB, valC, valP, stat);
			end
		end
	endtask

	initial begin
		errors = 0;
		pc = 0;
		// irmovq $0x0123456789abcdef, %rdx  -> 30 f2 ef cd ab 89 67 45 23 01
		ibytes = 80'h0123456789abcdef_f2_30;
		expect_fields(`IIRMOVQ, 0, `RNONE, 4'h2, 64'h0123456789abcdef, 10, `SAOK);
		// addq %rcx, %rax -> 60 10
		pc = 8; ibytes = 80'h10_60;
		expect_fields(`IOPQ, 0, 4'h1, 4'h0, 0, 10, `SAOK);
		// jge 0x14 -> 75 14 00..
		pc = 4; ibytes = 80'h0000000000000014_75;
		expect_fields(`IJXX, 5, `RNONE, `RNONE, 64'h14, 13, `SAOK);
		// halt
		pc = 0; ibytes = 80'h00;
		expect_fields(`IHALT, 0, `RNONE, `RNONE, 0, 1, `SHLT);
		// invalid icode 0xC
		ibytes = 80'hc0;
		expect_fields(4'hC, 0, `RNONE, `RNONE, 0, 1, `SINS);
		// invalid ifun for OPq (opq ifun 7)
		ibytes = 80'h10_67;
		expect_fields(`IOPQ, 7, 4'h1, 4'h0, 0, 2, `SINS);
		// instruction runs past the end of a 64-byte memory
		pc = 60; ibytes = 80'h0000000000000014_70;
		expect_fields(`IJXX, 0, `RNONE, `RNONE, 64'h14, 69, `SADR);
		// PC outside memory -> nop with ADR
		pc = 100;
		expect_fields(`INOP, 0, `RNONE, `RNONE, 0, 101, `SADR);

		if (errors == 0) $display("PASS fetch_tb");
		else begin $display("FAILED fetch_tb: %0d errors", errors); $fatal(1); end
		$finish;
	end
endmodule
