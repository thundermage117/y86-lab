// Clocked register with enable signal and synchronous reset
module cenrreg(out, in, enable, reset, resetval, clock);
parameter width = 8;
output [width-1:0] out;
reg [width-1:0] out;
input [width-1:0] in;
input enable;
input reset;
input [width-1:0] resetval;
input clock;
always @(posedge clock)
begin
    if (reset)
        out <= resetval;
    else if (enable)
        out <= in;
end
endmodule

// Pipeline register. Uses reset signal to inject bubble
module preg(out, in, stall, bubble, bubbleval, clock);
parameter width = 8;
output [width-1:0] out;
input [width-1:0] in;
input stall, bubble;
input [width-1:0] bubbleval;
input clock;

cenrreg #(width) r(out, in, ~stall, bubble, bubbleval, clock);
endmodule

module reg_data(dstE, valE, dstM, valM, srcA, valA, srcB, valB, clock, 
rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14);

input [3:0] dstE;
input [63:0] valE;
input [3:0] dstM;
input [63:0] valM;
input [3:0] srcA;
output [63:0] valA;
input [3:0] srcB;
output [63:0] valB;
input clock;


output [63:0] rax, rcx, rdx, rbx, rsp, rbp, rsi, rdi, r8, r9, r10, r11, r12, r13, r14;
  
wire [63:0] rax_dat, rcx_dat, rdx_dat, rbx_dat, rsp_dat, rbp_dat, rsi_dat, rdi_dat, r8_dat, 
r9_dat, r10_dat, r11_dat, r12_dat, r13_dat, r14_dat;


wire rax_wrt, rcx_wrt, rdx_wrt, rbx_wrt, rsp_wrt, rbp_wrt, rsi_wrt, rdi_wrt, r8_wrt, r9_wrt, 
r10_wrt, r11_wrt, r12_wrt, r13_wrt, r14_wrt;

cenrreg #(64) rax_reg(rax, rax_dat, rax_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rcx_reg(rcx, rcx_dat, rcx_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rdx_reg(rdx, rdx_dat, rdx_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rbx_reg(rbx, rbx_dat, rbx_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rsp_reg(rsp, rsp_dat, rsp_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rbp_reg(rbp, rbp_dat, rbp_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rsi_reg(rsi, rsi_dat, rsi_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) rdi_reg(rdi, rdi_dat, rdi_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r8_reg(r8, r8_dat, r8_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r9_reg(r9, r9_dat, r9_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r10_reg(r10, r10_dat, r10_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r11_reg(r11, r11_dat, r11_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r12_reg(r12, r12_dat, r12_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r13_reg(r13, r13_dat, r13_wrt, 1'b0, 64'b0, clock);
cenrreg #(64) r14_reg(r14, r14_dat, r14_wrt, 1'b0, 64'b0, clock);

assign valA =
srcA == 4'h0 ? rax :
srcA == 4'h1 ? rcx :
srcA == 4'h2 ? rdx :
srcA == 4'h3 ? rbx :
srcA == 4'h4 ? rsp :
srcA == 4'h5 ? rbp :
srcA == 4'h6 ? rsi :
srcA == 4'h7 ? rdi :
srcA == 4'h8 ? r8 :
srcA == 4'h9 ? r9 :
srcA == 4'hA ? r10 :
srcA == 4'hB ? r11 :
srcA == 4'hC ? r12 :
srcA == 4'hD ? r13 :
srcA == 4'hE ? r14 :
0;

assign valB =
srcB == 4'h0 ? rax :
srcB == 4'h1 ? rcx :
srcB == 4'h2 ? rdx :
srcB == 4'h3 ? rbx :
srcB == 4'h4 ? rsp :
srcB == 4'h5 ? rbp :
srcB == 4'h6 ? rsi :
srcB == 4'h7 ? rdi :
srcB == 4'h8 ? r8 :
srcB == 4'h9 ? r9 :
srcB == 4'hA ? r10 :
srcB == 4'hB ? r11 :
srcB == 4'hC ? r12 :
srcB == 4'hD ? r13 :
srcB == 4'hE ? r14 :
0;
assign rax_dat = dstM == 4'h0 ? valM : valE;
assign rcx_dat = dstM == 4'h1 ? valM : valE;
assign rdx_dat = dstM == 4'h2 ? valM : valE;
assign rbx_dat = dstM == 4'h3 ? valM : valE;
assign rsp_dat = dstM == 4'h4 ? valM : valE;
assign rbp_dat = dstM == 4'h5 ? valM : valE;
assign rsi_dat = dstM == 4'h6 ? valM : valE;
assign rdi_dat = dstM == 4'h7 ? valM : valE;
assign r8_dat = dstM == 4'h8 ? valM : valE;
assign r9_dat = dstM == 4'h9 ? valM : valE;
assign r10_dat = dstM == 4'hA ? valM : valE;
assign r11_dat = dstM == 4'hB ? valM : valE;
assign r12_dat = dstM == 4'hC ? valM : valE;
assign r13_dat = dstM == 4'hD ? valM : valE;
assign r14_dat = dstM == 4'hE ? valM : valE;

assign rax_wrt = dstM == 4'h0 | dstE == 4'h0;
assign rcx_wrt = dstM == 4'h1 | dstE == 4'h1;
assign rdx_wrt = dstM == 4'h2 | dstE == 4'h2;
assign rbx_wrt = dstM == 4'h3 | dstE == 4'h3;
assign rsp_wrt = dstM == 4'h4 | dstE == 4'h4;
assign rbp_wrt = dstM == 4'h5 | dstE == 4'h5;
assign rsi_wrt = dstM == 4'h6 | dstE == 4'h6;
assign rdi_wrt = dstM == 4'h7 | dstE == 4'h7;
assign r8_wrt = dstM == 4'h8 | dstE == 4'h8;
assign r9_wrt = dstM == 4'h9 | dstE == 4'h9;
assign r10_wrt = dstM == 4'hA | dstE == 4'hA;
assign r11_wrt = dstM == 4'hB | dstE == 4'hB;
assign r12_wrt = dstM == 4'hC | dstE == 4'hC;
assign r13_wrt = dstM == 4'hD | dstE == 4'hD;
assign r14_wrt = dstM == 4'hE | dstE == 4'hE;
endmodule

module cc(cc, new_cc, set_cc, clock);
output[2:0] cc;
input [2:0] new_cc;
input set_cc;
input clock;

cenrreg #(3) c(cc, new_cc, set_cc, 1'b0, 3'b100, clock);
endmodule