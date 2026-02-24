`include "../src/execute.v"

module tb();

reg [3:0]icode,ifun;
reg [63:0]valC,valA,valB;
wire [63:0]valE;
wire Cnd;
reg clock;
wire [2:0]new_cc;
wire set_cc;
reg [2:0]cc;
integer j;

execute DUT(icode,ifun,valC,valA,valB,valE,Cnd,clock,new_cc,set_cc,cc);
initial begin
	//$monitor ($time,"ns:  clock=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clock,PC,icode,ifun,valP); 
	$dumpfile("execute.vcd");
    $dumpvars(0,icode,ifun,valC,valA,valB,valE,Cnd,clock,new_cc,set_cc,cc);
	icode<=4'h6;
	ifun<=4'h1;
	valA<='h123;
	valB<='h122;
	valC<='h1;
	cc<=3'b010;
	for(j=0;j<4;j++) begin 
	clock=1;
	#10;
	clock=0;
	#10;
	end
end



endmodule