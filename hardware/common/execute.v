`include "defs.vh"
`include "alu.v"

// Execute stage: ALU operand selection, condition evaluation and new flags.
// cc / new_cc bit order: [0]=ZF, [1]=SF, [2]=OF.
module execute(icode, ifun, valA, valB, valC, cc, valE, Cnd, new_cc, set_cc);
	input [3:0] icode, ifun;
	input [63:0] valA, valB, valC;
	input [2:0] cc;
	output [63:0] valE;
	output reg Cnd;
	output [2:0] new_cc;
	output set_cc;           // instruction wants to update CC (OPq)

	reg [63:0] aluA, aluB;
	reg [1:0] alufun;
	wire overflow;

	alu ALU(alufun, aluA, aluB, valE, overflow);

	wire ZF = cc[0], SF = cc[1], OF = cc[2];
	reg cond;

	always @(*) begin
		case (icode)
			`IRRMOVQ, `IOPQ:            aluA = valA;
			`IIRMOVQ, `IRMMOVQ, `IMRMOVQ: aluA = valC;
			`ICALL, `IPUSHQ:            aluA = -64'd8;
			`IRET, `IPOPQ:              aluA = 64'd8;
			default:                    aluA = 64'd0;
		endcase
		case (icode)
			`IRMMOVQ, `IMRMOVQ, `IOPQ, `ICALL, `IPUSHQ, `IRET, `IPOPQ: aluB = valB;
			default: aluB = 64'd0;
		endcase
		alufun = (icode == `IOPQ) ? ifun[1:0] : `ALUADD;

		case (ifun)
			4'h0: cond = 1'b1;                 // always
			4'h1: cond = (SF ^ OF) | ZF;       // le
			4'h2: cond = SF ^ OF;              // l
			4'h3: cond = ZF;                   // e
			4'h4: cond = ~ZF;                  // ne
			4'h5: cond = ~(SF ^ OF);           // ge
			4'h6: cond = ~(SF ^ OF) & ~ZF;     // g
			default: cond = 1'b0;
		endcase
		Cnd = (icode == `IJXX || icode == `IRRMOVQ) ? cond : 1'b0;
	end

	assign set_cc = (icode == `IOPQ);
	assign new_cc = {overflow, valE[63], valE == 64'd0};
endmodule
