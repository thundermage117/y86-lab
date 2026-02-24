`include"../src/alu.v"
`timescale 1ps / 1ps 
module testbench;
	reg [63:0] a,b;
	reg [1:0] control;
	wire [63:0] out;
	wire c;
	integer i,k,j;
	alu DUT(control,a,b,out,c);
	initial begin
	$monitor ($time,"ns:  control =  %b,\n\t\t        a = %b,\n\t\t        b = %b,\n\t\t   result = %b, overflow=%b \n",control,a, b, out,c); 
	$dumpfile("alu.vcd");
    	$dumpvars(0,control,a,b,c,out);
	b=2**6-1;
	a=2**6-1;
	control=0;
	#10;
	for(j=0;j<4;j++) begin
	control=j;
	b=2**6-1;
	a=2**6-1;
	for(i=0; i<=2**3-1; i++) begin
		a=2**6-1;
		for(k=0;k<=2**3-1;k++) begin
		a--;
		#10;
		end
		b--;
	end
	end
	end
endmodule