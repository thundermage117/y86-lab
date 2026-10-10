# Y86-64 hardware build and tests (Icarus Verilog).
#   make            build both CPUs into build/
#   make test       unit testbenches + sum_1_to_100 smoke test on both CPUs
#   make run CPU=proc PROGRAM=path/to/prog.hex

IVERILOG ?= iverilog
VVP      ?= vvp
FLAGS    := -g2012 -Wall -Wno-timescale -Icommon
BUILD    := build
COMMON   := $(wildcard common/*.v common/*.vh)
UNITS    := alu fetch execute ram
CPU      ?= proc
PROGRAM  ?= tb/sum_1_to_100.hex

.PHONY: all test unit smoke run clean

all: $(BUILD)/proc.vvp $(BUILD)/seq.vvp

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/proc.vvp: pipeline/proc.v $(COMMON) | $(BUILD)
	$(IVERILOG) $(FLAGS) -o $@ $<

$(BUILD)/seq.vvp: sequential/seq.v $(COMMON) | $(BUILD)
	$(IVERILOG) $(FLAGS) -o $@ $<

$(BUILD)/%_tb.vvp: tb/%_tb.v $(COMMON) | $(BUILD)
	$(IVERILOG) $(FLAGS) -o $@ $<

unit: $(UNITS:%=$(BUILD)/%_tb.vvp)
	@for t in $(UNITS); do $(VVP) -n $(BUILD)/$${t}_tb.vvp | grep -E 'PASS|FAIL' || exit 1; done

smoke: all
	@for cpu in proc seq; do \
		out=$$($(VVP) -n $(BUILD)/$$cpu.vvp +program=tb/sum_1_to_100.hex +vcd=$(BUILD)/$$cpu.vcd); \
		echo "$$out" | grep -q 'STATUS stat=1' && echo "$$out" | grep -q 'REGS 00000000000013ba' \
			&& echo "PASS smoke $$cpu (rax=0x13ba, halted)" \
			|| { echo "FAIL smoke $$cpu"; echo "$$out"; exit 1; }; \
	done

test: unit smoke

run: all
	$(VVP) -n $(BUILD)/$(CPU).vvp +program=$(PROGRAM) +vcd=$(BUILD)/$(CPU).vcd

clean:
	rm -rf $(BUILD)
