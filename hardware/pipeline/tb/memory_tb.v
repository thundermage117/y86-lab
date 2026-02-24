`include"../src/memory.v"
`timescale 1ns / 1ns 
module testbench;
reg [3:0] icode;
reg [63:0] valE;
reg [63:0] valP;
reg clock;
reg imem_error=1'b0;
reg instr_valid=1'b1;
reg [63:0] valA;
wire [63:0] valM;
wire [1:0]stat;

//check testbench for read part
	integer i,k,j;
	Memory DUT(icode,valE,valA,valP,instr_valid,imem_error,valM,clock,stat);
	initial begin
	//$monitor ($time,"ns:  clock=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clock,PC,icode,ifun,valP); 
	$dumpfile("Memory.vcd");
    	$dumpvars(0,icode,valE,valA,valP,instr_valid,valM,clock,stat,imem_error);
	clock=0;
	icode=4'h4;
	valE='h6;
	valP='h312;
	//valA='h27359;
	//#10;
	for(j=0;j<4;j++) begin 
	valE=j+'h10; //non-blocking=> o/p next cycle
	valA=j+1;
	clock=1;
	#10;
	clock=0;
	#10;
	end
	//clock=1;
	//#10;
end
endmodule
/*
#10;
	clock=1;
	#10;
	PC=valP;
	clock=0;
	#10;	
	clock=1;
	#10;

*/