// Self-checking ALU test: compares the gate-level ALU against behavioural
// Verilog for edge cases and random operands, including signed overflow.
`include "defs.vh"
`include "alu.v"

module alu_tb;
	reg  [1:0]  control;
	reg  [63:0] a, b;
	wire [63:0] out;
	wire        ovf;
	reg  [63:0] exp_out;
	reg         exp_ovf;
	integer i, errors;

	alu DUT(control, a, b, out, ovf);

	task check;
		begin
			case (control)
				`ALUADD: begin exp_out = a + b; exp_ovf = (a[63] == b[63]) && (exp_out[63] != a[63]); end
				`ALUSUB: begin exp_out = b - a; exp_ovf = (a[63] != b[63]) && (exp_out[63] != b[63]); end
				`ALUAND: begin exp_out = a & b; exp_ovf = 1'b0; end
				default: begin exp_out = a ^ b; exp_ovf = 1'b0; end
			endcase
			#1;
			if (out !== exp_out || ovf !== exp_ovf) begin
				errors = errors + 1;
				$display("FAIL alu op=%0d a=%h b=%h got %h/%b want %h/%b", control, a, b, out, ovf, exp_out, exp_ovf);
			end
		end
	endtask

	initial begin
		errors = 0;
		for (control = 0; control < 3; control = control + 1) begin
			a = 64'h7fffffffffffffff; b = 64'd1;                  check;
			a = 64'h8000000000000000; b = 64'hffffffffffffffff;   check;
			a = 64'd0;                b = 64'd0;                  check;
			a = 64'd1;                b = 64'h8000000000000000;   check;
		end
		control = 2'b11;
		a = 64'hdeadbeefcafef00d; b = 64'h0123456789abcdef; check;
		for (i = 0; i < 4000; i = i + 1) begin
			control = $random;
			a = {$random, $random};
			b = {$random, $random};
			check;
		end
		if (errors == 0) $display("PASS alu_tb");
		else begin $display("FAILED alu_tb: %0d errors", errors); $fatal(1); end
		$finish;
	end
endmodule
