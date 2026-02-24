`include"../src/fetch.v"
`timescale 1ns / 1ns 
module testbench;
	//reg[27:0]Instruction_Stream='h0102013;//0000000100000010000000010101
	reg[63:0]PC;
	reg clock;
	wire [1:0]status; //AOK - 0
wire [3:0] icode;
wire [3:0] ifun;
wire [3:0] rA;
wire [3:0] rB; 
wire [63:0] valC;
wire [63:0] valP;
wire [79:0] test;
wire instr_valid;
wire imem_error;
wire [1:0]f_stat;


	integer i,k,j;
	fetch DUT(PC, icode,ifun,rA,rB,valC, valP,clock,instr_valid,imem_error,f_stat);
	initial begin
	
	$monitor ($time,"ns:  clock=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clock,PC,icode,ifun,valP); 
	$dumpfile("fetch.vcd");
    	$dumpvars(0,PC, icode,ifun,rA,rB,valC, valP,clock,instr_valid,imem_error);
	clock=0;
    PC=4;
	#10;
	for(j=0;j<4;j++) begin 
	clock=1;
	#10;
	PC=valP;
	clock=0;
	#10;
	end
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