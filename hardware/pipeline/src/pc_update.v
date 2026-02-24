module pc_update(predPC,icode,valC,valP,clock);
input clock;
input [3:0]icode;
input Cnd;
input [63:0]valC;
input [63:0]valP;
output reg [63:0]predPC;

reg [63:0]new_pc;
always @(*)
begin
	if(icode==4'h7)	//jxx
        new_pc<=valC;
	else if(icode==4'h8)//call
        new_pc<=valC;
	else
        new_pc<=valP;
    predPC<=new_pc;
end

endmodule 