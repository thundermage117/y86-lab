`include "alu.v"
module execute(icode,ifun,valC,valA,valB,valE,Cnd,clk);
//alu (control,A,B,out,carry_overflow); +,-,and,xor

input [3:0] icode;
input [3:0] ifun;
input [63:0] valC;
input [63:0] valA;
input [63:0] valB;
input clk;
output reg [63:0] valE;
output reg Cnd=1'b0;

reg [63:0] aluA, aluB;
wire [63:0] alu_out;
reg [1:0] alufun;
wire overflow;

reg cc_memory[2:0];
reg ZF=1'b0;reg SF=1'b0;reg OF=1'b0;
reg set_cc=1'b0;

initial
    begin
		$readmemb("CC_MEM.txt", cc_memory, 0, 2);
		ZF<=cc_memory[0];
		SF<=cc_memory[1];
		OF<=cc_memory[2];
	end
alu ALU(alufun,aluA,aluB,alu_out,overflow);
always @(*)    
begin
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
end

always @(posedge clk) ////ensures write takes place after the clk cycle
begin
    if(set_cc==1'b1)
    begin
		if(valE==0)
			ZF<=1'b1;
		else
			ZF<=1'b0;
		SF<=valE[63];
		OF<=overflow;
		//if((valA[63]==valB[63])&(valA[63]!=valE[63]))
		//	OF<=1'b1;
		//else
		//	OF<=1'b0;
		cc_memory[0]<=ZF;
		cc_memory[1]<=SF;
		cc_memory[2]<=OF;
        $writememb("CC_MEM.txt",cc_memory, 0,2);
    end
end

endmodule