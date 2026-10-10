`include "defs.vh"

// Memory-stage control: address, data and read/write enables.
// The pipeline passes M_valA as valP (call's return address travels in valA).
module mem_ctrl(icode, valE, valA, valP, read, write, addr, data);
	input [3:0] icode;
	input [63:0] valE, valA, valP;
	output reg read, write;
	output reg [63:0] addr, data;

	always @(*) begin
		read = 1'b0; write = 1'b0;
		addr = 64'd0; data = 64'd0;
		case (icode)
			`IRMMOVQ, `IPUSHQ: begin write = 1'b1; addr = valE; data = valA; end
			`ICALL:            begin write = 1'b1; addr = valE; data = valP; end
			`IMRMOVQ:          begin read = 1'b1;  addr = valE; end
			`IPOPQ, `IRET:     begin read = 1'b1;  addr = valA; end
			default: ;
		endcase
	end
endmodule
