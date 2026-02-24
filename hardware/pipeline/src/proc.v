`include "registers.v"
`include "fetch.v"
`include "decode.v"
`include "execute.v"
`include "memory.v"
`include "pc_update.v"

module proc();

wire [63:0] rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14;
wire [2:0]cc;
parameter NOP =4'h1;
reg clock;
integer j;
//fetch
wire reset=0;
wire [63:0] f_predPC, F_predPC;
reg [63:0]f_pc=64'b0;
reg F_stall, F_bubble;
wire [ 1:0] f_stat;
wire [ 3:0] f_icode;
wire [ 3:0] f_ifun;
wire [ 3:0] f_rA;
wire [ 3:0] f_rB;
wire [63:0] f_valC;
wire [63:0] f_valP;
wire instr_valid, imem_error;

//decode
wire [ 1:0] D_stat;
wire [63:0] D_pc;
wire [ 3:0] D_icode;
wire [ 3:0] D_ifun;
wire [ 3:0] D_rA;
wire [ 3:0] D_rB;
wire [63:0] D_valC;
wire [63:0] D_valP;
wire [63:0] d_valA;
wire [63:0] d_valB;
wire [63:0] d_rvalA;
wire [63:0] d_rvalB;
wire [ 3:0] d_dstE;
wire [ 3:0] d_dstM;
wire [ 3:0] d_srcA;
wire [ 3:0] d_srcB;
reg D_stall, D_bubble;

//execute
wire [ 1:0] E_stat;
wire [63:0] E_pc;
wire [ 3:0] E_icode;
wire [ 3:0] E_ifun;
wire [63:0] E_valC;
wire [63:0] E_valA;
wire [63:0] E_valB;
wire [ 3:0] E_dstE;
wire [ 3:0] E_dstM;
wire [ 3:0] E_srcA;
wire [ 3:0] E_srcB;
wire [63:0] aluA;
wire [63:0] aluB;
wire set_cc;
wire [ 2:0] new_cc;
wire [ 3:0] alufun;
wire e_Cnd;
wire [63:0] e_valE;
wire [ 3:0] e_dstE;
reg E_stall, E_bubble;

//memory
wire [ 1:0] M_stat;
wire [63:0] M_pc;
wire [ 3:0] M_icode;
wire [ 3:0] M_ifun;
wire M_Cnd;
wire [63:0] M_valE;
wire [63:0] M_valA;
wire [ 3:0] M_dstE;
wire [ 3:0] M_dstM;
wire [ 1:0] m_stat;
wire [63:0] mem_addr;
wire [63:0] mem_data;
wire mem_read;
wire mem_write;
wire [63:0] m_valM;
reg M_stall, M_bubble;

//write-back
wire [ 1:0] W_stat;
wire [63:0] W_pc;
wire [ 3:0] W_icode;
wire [63:0] W_valE;
wire [63:0] W_valM;
wire [ 3:0] W_dstE;
wire [ 3:0] W_dstM;
wire [63:0] w_valE;
wire [63:0] w_valM;
wire [ 3:0] w_dstE;
wire [ 3:0] w_dstM;
reg W_stall, W_bubble;


//preg(out, in, stall, bubble, bubbleval, clock)
//F 
preg #(64) F_predPC_reg(F_predPC, f_predPC, F_stall, F_bubble, 64'b0, clock);

//D
preg #(2) D_stat_reg(D_stat, f_stat, D_stall, D_bubble, 2'h0, clock);
preg #(64) D_pc_reg(D_pc, f_pc, D_stall, D_bubble, 64'b0, clock);
preg #(4) D_icode_reg(D_icode, f_icode, D_stall, D_bubble, NOP, clock);
preg #(4) D_ifun_reg(D_ifun, f_ifun, D_stall, D_bubble, 4'h0, clock);
preg #(4) D_rA_reg(D_rA, f_rA, D_stall, D_bubble, 4'hF, clock);
preg #(4) D_rB_reg(D_rB, f_rB, D_stall, D_bubble, 4'hF, clock);
preg #(64) D_valC_reg(D_valC, f_valC, D_stall, D_bubble, 64'b0, clock);
preg #(64) D_valP_reg(D_valP, f_valP, D_stall, D_bubble, 64'b0, clock);

//E
preg #(2) E_stat_reg(E_stat, D_stat, E_stall, E_bubble, 2'h0, clock);
preg #(64) E_pc_reg(E_pc, D_pc, E_stall, E_bubble, 64'b0, clock);
preg #(4) E_icode_reg(E_icode, D_icode, E_stall, E_bubble, NOP, clock);
preg #(4) E_ifun_reg(E_ifun, D_ifun, E_stall, E_bubble, 4'h0, clock);
preg #(64) E_valC_reg(E_valC, D_valC, E_stall, E_bubble, 64'b0, clock);
preg #(64) E_valA_reg(E_valA, d_valA, E_stall, E_bubble, 64'b0, clock);
preg #(64) E_valB_reg(E_valB, d_valB, E_stall, E_bubble, 64'b0, clock);
preg #(4) E_dstE_reg(E_dstE, d_dstE, E_stall, E_bubble, 4'hF, clock);
preg #(4) E_dstM_reg(E_dstM, d_dstM, E_stall, E_bubble, 4'hF, clock);
preg #(4) E_srcA_reg(E_srcA, d_srcA, E_stall, E_bubble, 4'hF, clock);
preg #(4) E_srcB_reg(E_srcB, d_srcB, E_stall, E_bubble, 4'hF, clock);

//M
preg #(2) M_stat_reg(M_stat, E_stat, M_stall, M_bubble, 2'h0, clock);
preg #(64) M_pc_reg(M_pc, E_pc, M_stall, M_bubble, 64'b0, clock);
preg #(4) M_icode_reg(M_icode, E_icode, M_stall, M_bubble, NOP, clock);
preg #(4) M_ifun_reg(M_ifun, E_ifun, M_stall, M_bubble, 4'h0, clock);
preg #(1) M_Cnd_reg(M_Cnd, e_Cnd, M_stall, M_bubble, 1'b0, clock);
preg #(64) M_valE_reg(M_valE, e_valE, M_stall, M_bubble, 64'b0, clock);
preg #(64) M_valA_reg(M_valA, E_valA, M_stall, M_bubble, 64'b0, clock);
preg #(4) M_dstE_reg(M_dstE, e_dstE, M_stall, M_bubble, 4'hF, clock);
preg #(4) M_dstM_reg(M_dstM, E_dstM, M_stall, M_bubble, 4'hF, clock);

//W
preg #(2) W_stat_reg(W_stat, m_stat, W_stall, W_bubble, 2'h0, clock);
preg #(64) W_pc_reg(W_pc, M_pc, W_stall, W_bubble, 64'b0, clock);
preg #(4) W_icode_reg(W_icode, M_icode, W_stall, W_bubble, NOP, clock);
preg #(64) W_valE_reg(W_valE, M_valE, W_stall, W_bubble, 64'b0, clock);
preg #(64) W_valM_reg(W_valM, m_valM, W_stall, W_bubble, 64'b0, clock);
preg #(4) W_dstE_reg(W_dstE, M_dstE, W_stall, W_bubble, 4'hF, clock);
preg #(4) W_dstM_reg(W_dstM, M_dstM, W_stall, W_bubble, 4'hF, clock);

initial begin
	//$monitor ($time,"ns:  clock=%b, PC=%h, icode=%h, ifun=%h, valP=%h\n",clock,PC,icode,ifun,valP); 
	$dumpfile("sim/proc.vcd");
    	$dumpvars(
		0,
		f_pc, f_predPC, F_predPC,
		f_stat, f_icode, f_ifun, instr_valid, imem_error,
		D_stat, D_pc, D_icode, D_ifun,
		d_srcA, d_srcB,
		E_stat, E_pc, E_icode, E_ifun, e_Cnd, E_dstM, e_dstE,
		M_stat, M_pc, M_icode, M_ifun, M_Cnd, m_stat, M_dstE, M_dstM,
		W_stat, W_pc, W_icode, W_dstE, W_dstM,
		cc, set_cc, new_cc,
		F_stall, F_bubble, D_stall, D_bubble, E_stall, E_bubble, M_stall, M_bubble, W_stall, W_bubble,
		clock,
		rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14
	);
	//valE='h2A382812;
	//#10;
	for(j=0;j<610;j++) begin 
	//valE=j+'h3424867AEC; //non-blocking=> o/p next cycle
	clock=1;
	#10;
	clock=0;
	#10;
	end
end





fetch FETCH(f_pc,f_icode, f_ifun, f_rA, f_rB, f_valC, f_valP, clock,instr_valid,imem_error,f_stat);
pc_update PC_UP(f_predPC,f_icode,f_valC,f_valP,clock);

reg_data REG_DATA(w_dstE, w_valE, w_dstM, w_valM, d_srcA, d_rvalA, d_srcB, d_rvalB, clock, rax, 
rcx, rdx, rbx, rsp, rbp, rsi, rdi,r8, r9, r10, r11, r12, r13, r14);
decode DECODE(D_icode,Cnd,D_rA,D_rB,clock,d_srcA,d_srcB,d_dstM,d_dstE);

execute EXECUTE(E_icode,E_ifun,E_valC,E_valA,E_valB,e_valE,e_Cnd,clock,new_cc,set_cc,cc);
cc CC(cc, new_cc, set_cc, clock);

Memory MEMORY(M_icode,M_valE,M_valA,instr_valid,imem_error,m_valM,clock,m_stat);






assign m_stat=M_stat;
assign w_dstE=W_dstE;
assign w_valE=W_valE;
assign w_dstM=W_dstM;
assign w_valM=W_valM;
always @(*) 
begin
    if((E_icode == 4'h5 | E_icode == 4'hB) & (E_dstM == d_srcA | E_dstM== d_srcB))//5-MRMOVQ, B-POPQ
        F_stall<=1;
    else if((D_icode==4'h9)|(E_icode==4'h9)|(M_icode==4'h9))//RET
        F_stall<=1;
    else 
        F_stall<=0;
    F_bubble<=0;

    if((E_icode == 4'h5 | E_icode == 4'hB) & (E_dstM == d_srcA | E_dstM == d_srcB))//5-MRMOVQ, B-POPQ, 7-JXX, 9-RET
         D_stall=1;
    else
         D_stall=0;
    if((E_icode == 4'h7) & (e_Cnd==0))//Mispredicted Branch
         D_bubble=1;
    else if(~((E_icode == 4'h5 | E_icode ==4'hB) & (E_dstM == d_srcA | E_dstM == d_srcB)) & ( D_icode ==4'h9  | E_icode==4'h9  | M_icode==4'h9 ))
         D_bubble=1;
    else 
        D_bubble=0;

    
    E_stall=0;
    if((E_icode == 4'h7)&(e_Cnd==0))//Mispredicted branch
        E_bubble=1;
    else if((E_icode == 4'h5 | E_icode == 4'hB) & (E_dstM == d_srcA | E_dstM == d_srcB))//5-MRMOVQ, B-POPQ
        E_bubble=1;
    else
        E_bubble=0;

    M_stall=0;
    M_bubble=0;

    W_stall=0;
    W_bubble=0;
end

reg [63:0]temp11,temp12;
assign d_valA=temp11;
assign d_valB=temp12;

always @(*) //Select and forward for A and B
begin
    if((D_icode == 4'h7 | D_icode == 4'h8))//jmp or call
        temp11= D_valP;
    else if(d_srcA == e_dstE)
        temp11=e_valE;
    else if(d_srcA == M_dstM)
        temp11=m_valM;
    else if(d_srcA == M_dstE)
        temp11=M_valE;
    else if(d_srcA == W_dstM)
        temp11=W_valM;
    else if(d_srcA == W_dstE)
        temp11=W_valE;
    else
        temp11=d_rvalA;

    
    if(d_srcB == e_dstE)
        temp12=e_valE;
    else if(d_srcB == M_dstM)
        temp12=m_valM; 
    else if(d_srcB== M_dstE) 
        temp12=M_valE;
    else if(d_srcB == W_dstM)
        temp12=W_valM;
    else if(d_srcB ==W_dstE) 
        temp12=W_valE;
    else
        temp12=d_rvalB;
end

reg [63:0]temp14;
assign e_dstE=temp14;
always @(*)  
begin
    if((M_icode == 4'h7) & M_Cnd==0)//jmp
        f_pc<= M_valA;
    else if(W_icode==4'h9)//ret
        f_pc<=W_valM;
    else if(F_predPC)
        f_pc<= F_predPC;
    if((E_icode==4'h2)& e_Cnd==0)
        temp14=4'hF;
    else
        temp14=E_dstE;
end
endmodule
