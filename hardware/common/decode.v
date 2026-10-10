`include "defs.vh"

// Decode-stage control: which registers an instruction reads and writes.
// Cnd only matters for cmovXX; the pipeline passes 1 and cancels the write
// later in execute (e_dstE), the sequential CPU passes the real condition.
module decode_ctrl(icode, rA, rB, Cnd, srcA, srcB, dstE, dstM);
	input [3:0] icode, rA, rB;
	input Cnd;
	output reg [3:0] srcA, srcB, dstE, dstM;

	always @(*) begin
		srcA = `RNONE; srcB = `RNONE;
		dstE = `RNONE; dstM = `RNONE;
		case (icode)
			`IRRMOVQ: begin srcA = rA; dstE = Cnd ? rB : `RNONE; end
			`IIRMOVQ: begin dstE = rB; end
			`IRMMOVQ: begin srcA = rA; srcB = rB; end
			`IMRMOVQ: begin srcB = rB; dstM = rA; end
			`IOPQ:    begin srcA = rA; srcB = rB; dstE = rB; end
			`ICALL:   begin srcB = `RRSP; dstE = `RRSP; end
			`IRET:    begin srcA = `RRSP; srcB = `RRSP; dstE = `RRSP; end
			`IPUSHQ:  begin srcA = rA; srcB = `RRSP; dstE = `RRSP; end
			`IPOPQ:   begin srcA = `RRSP; srcB = `RRSP; dstE = `RRSP; dstM = rA; end
			default: ;
		endcase
	end
endmodule
