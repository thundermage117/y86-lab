// Shared Y86-64 constants (CS:APP encoding).
`ifndef Y86_DEFS_VH
`define Y86_DEFS_VH

`timescale 1ns/1ps

// Instruction codes
`define IHALT   4'h0
`define INOP    4'h1
`define IRRMOVQ 4'h2   // rrmovq and cmovXX
`define IIRMOVQ 4'h3
`define IRMMOVQ 4'h4
`define IMRMOVQ 4'h5
`define IOPQ    4'h6
`define IJXX    4'h7
`define ICALL   4'h8
`define IRET    4'h9
`define IPUSHQ  4'hA
`define IPOPQ   4'hB

// Register IDs
`define RRSP    4'h4
`define RNONE   4'hF

// ALU functions (match OPq ifun)
`define ALUADD  2'b00
`define ALUSUB  2'b01
`define ALUAND  2'b10
`define ALUXOR  2'b11

// Status codes
`define SAOK    2'b00
`define SHLT    2'b01
`define SADR    2'b10
`define SINS    2'b11

// Byte-addressed unified memory size
`define MEM_SIZE 8192

`endif
