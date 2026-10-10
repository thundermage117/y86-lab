// Self-checking memory test: little-endian 8-byte writes/reads, instruction
// port view of written data, and bounds errors.
`include "defs.vh"
`include "ram.v"

module ram_tb;
	reg         clock;
	reg  [63:0] iaddr, daddr, wdata;
	reg         dread, dwrite;
	wire [79:0] ibytes;
	wire [63:0] rdata;
	wire        derror;
	integer errors;

	ram #(64) DUT(clock, iaddr, ibytes, daddr, dread, dwrite, wdata, rdata, derror);

	task tick; begin #5 clock = 1; #5 clock = 0; end endtask

	initial begin
		errors = 0; clock = 0;
		iaddr = 0; daddr = 0; dread = 0; dwrite = 0; wdata = 0;
		#1;
		// write 0x1122334455667788 at byte 8
		daddr = 8; wdata = 64'h1122334455667788; dwrite = 1; tick; dwrite = 0;
		dread = 1; #1;
		if (rdata !== 64'h1122334455667788 || derror) begin errors = errors + 1; $display("FAIL read back %h", rdata); end
		iaddr = 8; #1;
		if (ibytes[7:0] !== 8'h88 || ibytes[63:56] !== 8'h11) begin errors = errors + 1; $display("FAIL ifetch %h", ibytes); end
		// last valid word is at 56; 57 is out of bounds
		daddr = 56; #1;
		if (derror) begin errors = errors + 1; $display("FAIL derror at 56"); end
		daddr = 57; #1;
		if (!derror) begin errors = errors + 1; $display("FAIL no derror at 57"); end
		// out-of-bounds write must not change memory
		dread = 0; dwrite = 1; daddr = -64'd8; wdata = 64'hffff; tick; dwrite = 0;
		dread = 1; daddr = 0; #1;
		if (rdata !== 64'h0) begin errors = errors + 1; $display("FAIL oob write leaked %h", rdata); end

		if (errors == 0) $display("PASS ram_tb");
		else begin $display("FAILED ram_tb: %0d errors", errors); $fatal(1); end
		$finish;
	end
endmodule
