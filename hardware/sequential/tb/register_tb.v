`include"../src/register.v"
`timescale 1ns / 1ns 
module testbench;
reg [3:0] icode;
reg cnd;
reg [3:0] rA;
reg [3:0] rB;
reg [63:0] valE;
reg [63:0] valM;
reg clk;
wire [63:0] valA;
wire [63:0] valB;


	integer i,k,j;
	Register DUT(icode,cnd,rA,rB,valA,valB,valE,valM,clk);
	initial begin
	//$monitor ($time,"ns:  clk=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clk,PC,icode,ifun,valP); 
	$dumpfile("Register.vcd");
    	$dumpvars(0,clk,icode,cnd,rA,rB,valE,valM,valA,valB);
	clk=0;
	icode=4'hB;
	rA=4'h2;
	rB=4'h7;
	cnd=0;
	//valE='h2A382812;
	//#10;
	for(j=0;j<4;j++) begin 
	valE=j+'h3424867AEC; //non-blocking=> o/p next cycle
	valM='h6567;
	clk=1;
	#10;
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