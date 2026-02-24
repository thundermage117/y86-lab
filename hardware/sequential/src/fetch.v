module fetch(PC, icode,ifun,rA,rB,valC, valP,clk,instr_valid,imem_error);
input [63:0]PC;
input clk;
//output reg [1:0]status=2'b00; //AOK - 0, default
output reg [3:0] icode;
output reg [3:0] ifun;
output reg [3:0] rA=4'b0;
output reg [3:0] rB=4'b0; 
output reg [63:0] valC=64'b0;
output reg [63:0] valP=64'b0;
output reg imem_error=1'b0;

integer a,file;

//reg [0:123]Instruction_Mem='h01527131030B8121212121212121200; //Instruction mem for TB
reg [0:519]Instruction_Mem='h30f0000000000000000030f10100000000000000601030f20100000000000000602130f26400000000000000611275A00000000000000000000000000000000000;//Summation till 100(64 in hex)
reg [0:79]ins;

output reg instr_valid;
reg need_regids,need_valC;

always @(*)
begin 
	ins<=Instruction_Mem[PC+:80];
	icode<=ins[0:3];
	ifun<=ins[4:7];

	if(PC>'h519)
		imem_error=1'b1;


	if(icode==4'h0)		//halt
	begin
		instr_valid<=1;
		need_regids<=0;
		need_valC<=0;
	end
	else if(icode==4'h1)	//nop
	begin
		instr_valid<=1;
		need_regids<=0;
		need_valC<=0;
	end
	else if(icode==4'h2)	//cmovxx
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=0;
	end
	else if(icode==4'h3)	//irmovq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=1;
	end
	else if(icode==4'h4)	//rmmovq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=1;
	end	
	else if(icode==4'h5)	//mrmovq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=1;
	end
	else if(icode==4'h6)	//OPq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=0;
	end
	else if(icode==4'h7)	//jxx
	begin
		instr_valid<=1;
		need_regids<=0;
		need_valC<=1;
	end
	else if(icode==4'h8)	//call
	begin
		instr_valid<=1;
		need_regids<=0;
		need_valC<=1;
	end
	else if(icode==4'h9)	//ret
	begin
		instr_valid<=1;
		need_regids<=0;
		need_valC<=0;
	end
	else if(icode==4'hA)	//pushq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=0;
	end
	else if(icode==4'hB)	//popq
	begin
		instr_valid<=1;
		need_regids<=1;
		need_valC<=0;
	end
	else if(icode==4'hC || icode==4'hD || icode==4'hE||icode==4'hF)
	begin
		instr_valid<=0;
		need_regids<=0;
		need_valC<=0;
	end

	if(need_regids==0)
	begin
		rA<=4'hF;
		rB<=4'hF;
	end
	else
	begin
		rA<=ins[8:11];
		rB<=ins[12:15];
	end

	if(need_valC==1 && need_regids==1)
	begin
		//valC<=ins[16:79];//6483==8364
		valC[7:0]<=  ins[16:23];
		valC[15:8]<= ins[24:31];
		valC[23:16]<=ins[32:39];
		valC[31:24]<=ins[40:47];
		valC[39:32]<=ins[48:55];
		valC[47:40]<=ins[56:63];
		valC[55:48]<=ins[64:71];
		valC[63:56]<=ins[72:79];
	end
	else if(need_valC==1 && need_regids==0)//sub 8
	begin
		//valC<=ins[8:71];
		valC[7:0]<=  ins[8:15];
		valC[15:8]<= ins[16:23];
		valC[23:16]<=ins[24:31];
		valC[31:24]<=ins[32:39];
		valC[39:32]<=ins[40:47];
		valC[47:40]<=ins[48:55];
		valC[55:48]<=ins[56:63];
		valC[63:56]<=ins[64:71];
	end
	valP<=PC+8*(1+need_regids+(8*need_valC));
end



endmodule 
