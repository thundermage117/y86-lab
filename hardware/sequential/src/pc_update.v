module pc_update(PC,icode,Cnd,valC,valM,valP,clk);
input clk;
input [3:0]icode;
input Cnd;
input [63:0]valC;
input [63:0]valM;
input [63:0]valP;
output reg [63:0]PC;

reg [63:0]new_pc;
always @(*)
begin
	if(icode==4'h7 && Cnd==1'b1)	//jxx
        new_pc<=valC;
	else if(icode==4'h8)	//call
        new_pc<=valC;
	else if(icode==4'h9)	//ret
        new_pc<=valM;
	else
        new_pc<=valP;
    PC<=new_pc; //check timing
end

endmodule 