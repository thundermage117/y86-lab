module Register(icode,Cnd,rA,rB,valA,valB,valE,valM,clk);

input [3:0] icode;
input Cnd;
input [3:0] rA;
input [3:0] rB;
input [63:0] valE;
input [63:0] valM;
input clk;
output reg [63:0] valA;
output reg [63:0] valB;
  

reg [0:63]reg_store[14:0];

initial 
    begin
		$readmemh("REG_MEM.txt", reg_store, 0, 14);
	end

reg [3:0] srcA,srcB,destM,destE;
//update after execute completion for Cnd
always @(*)    
begin
    if(icode==4'h0)		//halt
	begin
		srcA<=4'hF;
        srcB<=4'hF;
	end
	else if(icode==4'h1)	//nop
	begin
		srcA<=4'hF;
        srcB<=4'hF;
	end
	else if(icode==4'h2)	//IRRMOVQ
	begin
		srcA<=rA;
        srcB<=4'hF;
	end
	else if(icode==4'h3)	//IIRMOVQ
	begin
		srcA<=4'hF;
        srcB<=4'hF;
	end
	else if(icode==4'h4)	//IRMMOVQ
	begin
		srcA<=rA;
        srcB<=rB;
	end	
	else if(icode==4'h5)	//IMRMOVQ
	begin
		srcA<=4'hF;
        srcB<=rB;
	end
	else if(icode==4'h6)	//IOPQ
	begin
		srcA<=rA;
        srcB<=rB;
	end
	else if(icode==4'h7)	//IJXX
	begin
		srcA<=4'hF;
        srcB<=4'hF;
	end
	else if(icode==4'h8)	//ICALL
	begin
		srcA<=4'hF;
        srcB<=4;
	end
	else if(icode==4'h9)	//IRET
	begin
		srcA<=4;
        srcB<=4;
	end
	else if(icode==4'hA)	//IPUSHQ
	begin
		srcA<=rA;
        srcB<=4;
	end
	else if(icode==4'hB)	//IPOPQ
	begin
		srcA<=4;
        srcB<=4;
	end
    if(srcA!=4'hF)
        valA<=reg_store[srcA];
    if(srcB!=4'hF)
        valB<=reg_store[srcB];
end

always @(*)  
begin
    if(icode==4'h0)		//halt
	begin
		destM<=4'hF;
        destE<=4'hF;
	end
	else if(icode==4'h1)	//nop
	begin
		destM<=4'hF;
        destE<=4'hF;
	end
	else if((icode==4'h2) && (Cnd==1'b1))	//IRRMOVQ
	begin
		destM<=4'hF;
        destE<=rB;
	end
	else if(icode==4'h3)	//IIRMOVQ
	begin
		destM<=4'hF;
        destE<=rB;
	end
	else if(icode==4'h4)	//IRMMOVQ
	begin
		destM<=4'hF;
        destE<=4'hF;
	end	
	else if(icode==4'h5)	//IMRMOVQ
	begin
		destM<=rA;
        destE<=4'hF;
	end
	else if(icode==4'h6)	//IOPQ
	begin
		destM<=4'hF;
        destE<=rB;
	end
	else if(icode==4'h7)	//IJXX
	begin
		destM<=4'hF;
        destE<=4'hF;
	end
	else if(icode==4'h8)	//ICALL
	begin
		destM<=4'hF;
        destE<=4;
	end
	else if(icode==4'h9)	//IRET
	begin
		destM<=4'hF;
        destE<=4;
	end
	else if(icode==4'hA)	//IPUSHQ
	begin
		destM<=4'hF;
        destE<=4;
	end
	else if(icode==4'hB)	//IPOPQ
	begin
		destM<=rA;
        destE<=4;
	end
end
always @(posedge clk)
begin
if(destE!=4'hF)
    begin
        reg_store[destE]<=valE;
        $writememh("REG_MEM.txt", reg_store, 0,14);
    end
if(destM!=4'hF)
    begin
        reg_store[destM]<=valM;
        $writememh("REG_MEM.txt", reg_store, 0,14);
    end
end
endmodule