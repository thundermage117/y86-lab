`include "defs.vh"

// Fetch-stage instruction decoder: splits the raw bytes at PC into fields,
// computes valP and the fetch status.
module fetch(pc, ibytes, icode, ifun, rA, rB, valC, valP, instr_valid, imem_error, stat);
	parameter SIZE = `MEM_SIZE;

	input [63:0] pc;
	input [79:0] ibytes;
	output reg [3:0] icode, ifun, rA, rB;
	output reg [63:0] valC, valP;
	output reg instr_valid, imem_error;
	output reg [1:0] stat;

	reg need_regids, need_valC;
	reg [63:0] len;

	always @(*) begin
		imem_error = (pc >= SIZE);
		icode = imem_error ? `INOP : ibytes[7:4];
		ifun  = imem_error ? 4'h0 : ibytes[3:0];

		need_regids = 1'b0;
		need_valC   = 1'b0;
		case (icode)
			`IHALT, `INOP, `IRET: instr_valid = (ifun == 4'h0);
			`IRRMOVQ: begin instr_valid = (ifun <= 4'h6); need_regids = 1'b1; end
			`IIRMOVQ, `IRMMOVQ, `IMRMOVQ:
				begin instr_valid = (ifun == 4'h0); need_regids = 1'b1; need_valC = 1'b1; end
			`IOPQ:  begin instr_valid = (ifun <= 4'h3); need_regids = 1'b1; end
			`IJXX:  begin instr_valid = (ifun <= 4'h6); need_valC = 1'b1; end
			`ICALL: begin instr_valid = (ifun == 4'h0); need_valC = 1'b1; end
			`IPUSHQ, `IPOPQ: begin instr_valid = (ifun == 4'h0); need_regids = 1'b1; end
			default: instr_valid = 1'b0;
		endcase

		len = 64'd1 + need_regids + (need_valC ? 64'd8 : 64'd0);
		if (!imem_error && pc > SIZE - len)
			imem_error = 1'b1;

		rA = need_regids ? ibytes[15:12] : `RNONE;
		rB = need_regids ? ibytes[11:8]  : `RNONE;
		if (!need_valC)
			valC = 64'h0;
		else if (need_regids)
			valC = ibytes[79:16];
		else
			valC = ibytes[71:8];
		valP = pc + len;

		if (imem_error)        stat = `SADR;
		else if (!instr_valid) stat = `SINS;
		else if (icode == `IHALT) stat = `SHLT;
		else                   stat = `SAOK;
	end
endmodule
