
module Memory(icode,valE,valA,instr_valid,imem_error,valM,clock,stat); 

input [3:0] icode;
input [63:0] valE;
input [63:0] valA;
input instr_valid;
input imem_error;
input clock;
output reg [63:0] valM;
output reg [1:0] stat;

reg [63:0] mem_addr,mem_data;
reg mem_read=1'b0;
reg mem_write=1'b0; //control signals
reg [0:63]data_memory[127:0];

reg dmem_error=1'b0;

initial 
    begin
		$readmemh("DATA_MEM.txt", data_memory, 0, 127);
	end

always @(*)     
begin
	if(icode==4'h4)	//IRMMOVQ
	begin
		mem_write<=1'b1;
		mem_addr<=valE;
		mem_data<=valA;
	end	
	else if(icode==4'h5)	//IMRMOVQ
	begin
		mem_read<=1'b1;
		mem_addr<=valE;
	end
	else if(icode==4'h8)	//ICALL
	begin
		mem_write<=1'b1;
		mem_addr<=valE;
		mem_data<=valA;
	end
	else if(icode==4'h9)	//IRET
	begin
		mem_read<=1'b1;
		mem_addr<=valA;
	end
	else if(icode==4'hA)	//IPUSHQ
	begin
		mem_write<=1'b1;
		mem_addr<=valE;
		mem_data<=valA;
	end
	else if(icode==4'hB)	//IPOPQ
	begin
		mem_read<=1'b1;
		mem_addr<=valA;
	end
	if(mem_addr>127)
		dmem_error<=1'b1;
    else if(mem_read==1'b1)
        valM<=data_memory[mem_addr];
	if(icode==4'h0)
		stat<=2'b01;
	else if(imem_error==1'b1 || dmem_error==1'b1)
		stat<=2'b10;
	else if(instr_valid==0)
		stat<=2'b11;
	else
		stat<=2'b00;
end

always @(clock)//ensures write takes place after the next clock cycle
begin
    if((mem_write==1'b1)&& mem_addr<127)
    begin
        data_memory[mem_addr]<=mem_data;
        $writememh("DATA_MEM.txt", data_memory, 0,127);
    end
end

endmodule 
