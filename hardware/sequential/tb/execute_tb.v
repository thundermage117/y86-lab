`include "../src/execute.v"
`timescale 1ns / 1ns 
module testbench;
reg [3:0] icode;
reg [3:0] ifun;
reg [63:0] valC;
reg [63:0] valA;
reg [63:0] valB;
reg clk;
wire Cnd;
wire [63:0] valE;
integer i,j,k;
execute DUT(icode,ifun,valC,valA,valB,valE,Cnd,clk);

//write tb with consecutive opq and jump 
initial begin
	//$monitor ($time,"ns:  clk=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clk,PC,icode,ifun,valP); 
	$dumpfile("execute.vcd");
    	$dumpvars(0,icode,ifun,valC,valA,valB,valE,Cnd,clk);
	clk=0;
	icode=4'h6;
	valA='hFFFFFFFFFFFFFFFF;
    ifun=4'h0;
	valC='h4;
    //valA=2**63-1; //overflow test
    //valB=2**63-1;
	for(j=0;j<3;j++) begin 
	//valE=j+'h10; //non-blocking=> o/p next cycle
    valB=j+1;
    //valA=j-1; //Cnd check
	clk=1;
	#10;
	clk=0;
	#10;
	end
	//clk=1;
	//#10;
end
endmodule
