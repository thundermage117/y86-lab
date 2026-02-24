`include "alu.v"
module execute(icode,ifun,valC,valA,valB,valE,Cnd,clock,new_cc,set_cc,cc);
//alu (control,A,B,out,carry_overflow); +,-,and,xor

input [3:0] icode;
input [3:0] ifun;
input [63:0] valC;
input [63:0] valA;
input [63:0] valB;
input clock;
output reg [63:0] valE;
output reg Cnd=1'b0;
input [2:0]cc;

reg [63:0] aluA, aluB;
wire [63:0] alu_out;
reg [1:0] alufun;
wire overflow;

output reg [2:0]new_cc=3'b0;
reg ZF,SF,OF;
output reg set_cc=1'b0;

alu ALU(alufun,aluA,aluB,alu_out,overflow);
always @(*)    
begin
	ZF<=cc[0];
	SF<=cc[1];
	OF<=cc[2];
    if(icode==4'h2)	//IRRMOVQ
	begin
        alufun<=2'b00;
		aluA<=valA;
        aluB<=64'b0;
	end
	else if(icode==4'h3)	//IIRMOVQ
	begin
        alufun<=2'b00;
		aluA<=valC;
        aluB<=64'b0;
	end
	else if(icode==4'h4)	//IRMMOVQ
	begin
        alufun<=2'b00;
		aluA<=valC;
        aluB<=valB;
	end	
	else if(icode==4'h5)	//IMRMOVQ
	begin
        alufun<=2'b00;
		aluA<=valC;
        aluB<=valB;
	end
	else if(icode==4'h6)	//IOPQ
	begin
        alufun<=ifun[1:0];
		aluA<=valA;
        aluB<=valB;
		set_cc<=1'b1;
	end
	else if(icode==4'h8)	//ICALL
	begin
        alufun<=2'b00;
		aluA<=-64'h8;
        aluB<=valB;
	end
	else if(icode==4'h9)	//IRET
	begin
        alufun<=2'b00;
		aluA<=64'h8;
        aluB<=valB;
	end
	else if(icode==4'hA)	//IPUSHQ
	begin
        alufun<=2'b00;
		aluA<=-64'h8;
        aluB<=valB;
	end
	else if(icode==4'hB)	//IPOPQ
	begin
        alufun<=2'b00;
		aluA<=64'h8;
        aluB<=valB;
	end
	valE<=alu_out;
	if(icode==4'h2 || icode==4'h7)
	begin
		if(ifun==4'h0)
			Cnd=1'b1;
		else if(ifun==4'h1)//le
			Cnd=((SF^OF)|ZF);
		else if(ifun==4'h2)//l
			Cnd=SF^OF;
		else if(ifun==4'h3)//e
			Cnd<=ZF;
		else if(ifun==4'h4)//ne
			Cnd=~ZF;
		else if(ifun==4'h5)//ge
			Cnd=(~SF^OF);
		else if(ifun==4'h6)//g	
			Cnd=((~SF^OF)&~ZF);
	end
	if(set_cc==1'b1)
    begin
		if(valE==0)
			new_cc[0]<=1'b1;
		else
			new_cc[0]<=1'b0;
		new_cc[1]<=valE[63];
		new_cc[2]<=overflow;
    end
end

endmodule