`include"../src/decode.v"
`timescale 1ns / 1ns 
module testbench;
reg [3:0] icode;
reg Cnd;
reg [3:0] rA;
reg [3:0] rB;
reg clock;
wire [3:0] srcA,srcB,destM,destE;


	integer i,k,j;
	decode DUT(icode,Cnd,rA,rB,clock,srcA,srcB,destM,destE);
	initial begin
	//$monitor ($time,"ns:  clock=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clock,PC,icode,ifun,valP); 
	$dumpfile("decode.vcd");
    	$dumpvars(0,icode,Cnd,rA,rB,clock,srcA,srcB,destM,destE);
	clock=0;
	icode=4'hB;
	rA=4'h2;
	rB=4'h7;
	Cnd=0;
	//valE='h2A382812;
	//#10;
	for(j=0;j<4;j++) begin 
	clock=1;
	#10;
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