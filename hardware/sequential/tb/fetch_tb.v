`include"../src/fetch.v"
`timescale 1ns / 1ns 
module testbench;
	//reg[27:0]Instruction_Stream='h0102013;//0000000100000010000000010101
	reg[63:0]PC;
	reg clk;
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


	integer i,k,j;
	fetch DUT(PC, icode,ifun,rA,rB,valC, valP,clk,instr_valid,imem_error);
	initial begin
	
	$monitor ($time,"ns:  clk=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clk,PC,icode,ifun,valP); 
	$dumpfile("fetch.vcd");
    	$dumpvars(0,PC, icode,ifun,rA,rB,valC, valP,clk,instr_valid,imem_error);
	clk=0;
    PC=4;
	#10;
	for(j=0;j<4;j++) begin 
	clk=1;
	#10;
	PC=valP;
	clk=0;
	#10;
	end
end
endmodule
/*
#10;
	clk=1;
	#10;
	PC=valP;
	clk=0;
	#10;	
	clk=1;
	#10;

*/