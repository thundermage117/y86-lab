`include "defs.vh"

// Unified byte-addressed memory with one 10-byte instruction port and one
// 8-byte little-endian data port. Contents are loaded with $readmemh from the
// file given by the +program=<path> plusarg (one byte per word, @addr allowed).
module ram(clock, iaddr, ibytes, daddr, dread, dwrite, wdata, rdata, derror);
	parameter SIZE = `MEM_SIZE;

	input clock;
	input [63:0] iaddr;
	output [79:0] ibytes;          // byte k of the instruction at [8k+7:8k]
	input [63:0] daddr;
	input dread, dwrite;
	input [63:0] wdata;
	output [63:0] rdata;
	output derror;

	reg [7:0] mem [0:SIZE-1];

	genvar k;
	generate for (k = 0; k < 10; k = k + 1) begin : ifetch
		assign ibytes[8*k+7:8*k] = (iaddr + k < SIZE) ? mem[iaddr + k] : 8'h00;
	end
	endgenerate

	assign derror = (dread | dwrite) & (daddr > SIZE - 8);

	generate for (k = 0; k < 8; k = k + 1) begin : dfetch
		assign rdata[8*k+7:8*k] = (dread && !derror) ? mem[daddr + k] : 8'h00;
	end
	endgenerate

	integer i;
	always @(posedge clock) begin
		if (dwrite && !derror)
			for (i = 0; i < 8; i = i + 1)
				mem[daddr + i] <= wdata[8*i +: 8];
	end

	reg [8*512-1:0] program_file;
	initial begin
		for (i = 0; i < SIZE; i = i + 1)
			mem[i] = 8'h00;
		if ($value$plusargs("program=%s", program_file))
			$readmemh(program_file, mem);
		else
			$display("WARNING: no +program=<file> given; memory is all zeros");
	end
endmodule
