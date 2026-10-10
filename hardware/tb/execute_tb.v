// Self-checking execute test: condition evaluation for every jXX/cmovXX
// against every flag combination, plus ALU operand selection.
`include "defs.vh"
`include "execute.v"

module execute_tb;
	reg  [3:0]  icode, ifun;
	reg  [63:0] valA, valB, valC;
	reg  [2:0]  cc;
	wire [63:0] valE;
	wire        Cnd, set_cc;
	wire [2:0]  new_cc;
	reg         ZF, SF, OF, want;
	integer f, c, errors;

	execute DUT(icode, ifun, valA, valB, valC, cc, valE, Cnd, new_cc, set_cc);

	initial begin
		errors = 0;
		valA = 0; valB = 0; valC = 0;
		for (f = 0; f <= 6; f = f + 1)
			for (c = 0; c < 8; c = c + 1) begin
				icode = (c % 2) ? `IJXX : `IRRMOVQ;
				ifun = f; cc = c;
				{OF, SF, ZF} = c;
				case (f)
					0: want = 1;
					1: want = (SF ^ OF) | ZF;
					2: want = SF ^ OF;
					3: want = ZF;
					4: want = !ZF;
					5: want = !(SF ^ OF);
					6: want = !(SF ^ OF) && !ZF;
				endcase
				#1;
				if (Cnd !== want) begin
					errors = errors + 1;
					$display("FAIL cond ifun=%0d cc=%b got %b want %b", f, cc, Cnd, want);
				end
			end

		// subq: 5 - 7 = -2, SF=1
		icode = `IOPQ; ifun = 1; valA = 7; valB = 5; #1;
		if (valE !== -64'd2 || new_cc !== 3'b010 || !set_cc) begin errors = errors + 1; $display("FAIL subq"); end
		// pushq: valB - 8
		icode = `IPUSHQ; ifun = 0; valB = 64'h100; #1;
		if (valE !== 64'hf8 || set_cc) begin errors = errors + 1; $display("FAIL pushq"); end
		// mrmovq: valC + valB
		icode = `IMRMOVQ; valC = 64'h18; valB = 64'h200; #1;
		if (valE !== 64'h218) begin errors = errors + 1; $display("FAIL mrmovq"); end

		if (errors == 0) $display("PASS execute_tb");
		else begin $display("FAILED execute_tb: %0d errors", errors); $fatal(1); end
		$finish;
	end
endmodule
