module add(sum,carry_overflow,A,B,cin);
	input signed [63:0] A,B;
	input cin;
	output signed [63:0] sum;
	output signed carry_overflow;
	wire [18:0] carry;
	wire [2:0] t1,t2,t3;
	genvar i;
	CLA_FULL c1(sum[3:0],carry[0],A[3:0],B[3:0],cin);
	generate for(i=0;i<14;i=i+1)
		CLA_FULL c2(sum[7+4*i:4+4*i],carry[1+i],A[7+4*i:4+4*i],B[7+4*i:4+4*i],carry[0+i]);
	endgenerate
	CLA_FULL c16(sum[63:60],carry[18],A[63:60],B[63:60],carry[14]);
	generate for(i=0;i<3;i=i+1)
	begin
    		and gate2(t1[i],A[i+60],B[i+60]);
    		and gate3(t2[i],B[i+60],carry[i+14]);
    		and gate4(t3[i],A[i+60],carry[i+14]);
    		or gate5(carry[i+1+14],t1[i],t2[i],t3[i]);
	end
	endgenerate
       	xor(carry_overflow,carry[17],carry[18]);
endmodule 

module PG(p, g, a, b);
	input a, b;
	output p, g;
	and G1 (g, a, b);
	xor G2 (p, a, b);
endmodule

module CLA(g0, p0, g1, p1, g2, p2, g3, p3, c0, c1, c2, c3, c4);
	input g0, p0, g1, p1, g2, p2, g3, p3, c0;
	output c1, c2, c3, c4;
	wire t1, t2, t3, t4, t5, t6, t7, t8, t9, t10;
	and G1(t1, p0, c0);
	or G2(c1, t1, g0);
	
	and G3(t2, c0, p0, p1);
	and G4(t3, g0, p1);
	or G5(c2, g1, t2, t3);

	and G6(t4, c0, p0, p1, p2);
	and G7(t5, g0, p1, p2);
	and G8(t6, g1, p2);
	or G9(c3, g2, t4, t5, t6);
	
	and G10(t7, c0, p0, p1, p2, p3);
	and G11(t8, g0, p1, p2, p3);
	and G12(t9, g1, p2, p3);
	and G13(t10, g2, p3);
	or G14(c4, g3, t7, t8, t9, t10);
endmodule

module SUM(p0, c0, p1, c1, p2, c2, p3, c3, sum0, sum1, sum2, sum3);
	input p0, c0, p1, c1, p2, c2, p3, c3;
	output sum0, sum1, sum2, sum3;
	xor G1(sum0, p0, c0);
	xor G2(sum1, p1, c1);
	xor G3(sum2, p2, c2);
	xor G4(sum3, p3, c3);
endmodule

module CLA_FINAL(a3, b3, a2, b2, a1, b1, a0, b0, c0, c4, sum3, sum2, sum1, sum0);
	input a3, b3, a2, b2, a1, b1, a0, b0, c0;
	output c4, sum3, sum2, sum1, sum0;
	wire g0, p0, g1, p1, g2, p2, g3, p3, c1, c2, c3;
	PG B1(p0, g0, a0, b0);
	PG B2(p1, g1, a1, b1);
	PG B3(p2, g2, a2, b2);
	PG B4(p3, g3, a3, b3);
	CLA B5(g0, p0, g1, p1, g2, p2, g3, p3, c0, c1, c2, c3, c4);
	SUM B6(p0, c0, p1, c1, p2, c2, p3, c3, sum0, sum1, sum2, sum3);
endmodule

module CLA_FULL(sum,cout,a,b,cin);
	input [3:0] a,b;
	input cin;
	output [3:0] sum;
	output cout;
	CLA_FINAL F1(a[3], b[3], a[2], b[2], a[1], b[1], a[0], b[0], cin, cout, sum[3], sum[2], sum[1], sum[0]);
endmodule

module sub(sum,carry_overflow,A,B);
input signed [63:0] A,B;
output signed [63:0] sum;
output signed carry_overflow;
genvar i;
wire [63:0] Y;
generate for(i=0;i<64;i=i+1)
    not gate0(Y[i],B[i]);
endgenerate
add s1(sum, carry_overflow,A,Y,1'b1);

endmodule 

module and64(out,A,B);
input [63:0] A,B;
output [63:0] out;


genvar i;

generate for (i = 0; i <64;i=i+1)
 begin
   and g1(out[i],A[i],B[i]);
 end
endgenerate

endmodule

module xor64(out,A,B);
input [63:0] A,B;
output [63:0] out;


genvar i;

generate for (i = 0; i <64;i=i+1)
 begin
   xor g1(out[i],A[i],B[i]);
 end
endgenerate

endmodule

module alu (control,A,B,out,carry_overflow);
input [1:0] control;
input signed [63:0] A,B;
output reg[63:0] out ;
reg [1:0] x;
output reg carry_overflow;
wire [63:0] sum_out,and_out,xor_out,sub_out;
wire carry_sum,carry_sub;
   add module1(sum_out,carry_sum,A,B,1'b0);
   and64 module2(and_out,A,B);
   xor64 module3(xor_out,A,B);
   sub module4(sub_out,carry_sub,B,A);

   always@(*)
   begin
	assign x=control;
       if(x==2'b00)
	begin
       	assign out=sum_out;
	    assign carry_overflow=carry_sum;
	end
	
       else if(x==2'b01)
       begin
            assign out=sub_out;
            assign carry_overflow=carry_sub;
       end
       else if(x==2'b10)
       begin
           assign out=and_out;
           assign carry_overflow=1'b0;
       end
       else if(x==2'b11)
        begin
            assign out=xor_out;
            assign carry_overflow=1'b0;
	end
   end

    
endmodule