# Examples

Live diagrams, each rendered from the elmo source shown.

## RC low-pass + buffer

```elmo
title "RC low-pass + buffer"
part J1 connector "IN" { 1:SIG 2:GND }
part R1 res 10k
part C1 cap 100n
part U1 opamp "LM358"
part J2 connector "OUT" { 1:SIG 2:GND }
wire J1.SIG -- R1.1
wire R1.2 -- U1.+
wire C1.1 -- R1.2
wire U1.out -- J2.SIG
power VCC = U1.V+
gnd GND = J1.GND C1.2 U1.V- J2.GND
```

## Pi Pico blink

```elmo
title "Pi Pico blink"
part U1 mod "Raspberry Pi Pico" pkg=module {
  left  1:GP0 2:GP1 3:GND 4:GP2 5:GP3
  right 40:VBUS 39:VSYS 38:GND 36:3V3 34:GP28
}
part R1 res 330
part D1 led green
wire U1.GP2 -- R1.1
wire R1.2 -- D1.anode
power VBUS = U1.VBUS
gnd GND = U1.3 D1.cathode
```

## Transistor switch

```elmo
title "NPN low-side switch"
part U1 connector "CTRL" { 1:GPIO 2:GND }
part R1 res 1k
part Q1 npn 2N3904
part K1 relay G5V
part D1 diode 1N4148
wire U1.GPIO -- R1.1
wire R1.2 -- Q1.B
wire Q1.C -- K1.A
power VCC = K1.B
gnd GND = U1.GND Q1.E
```

## Symbol sampler

```elmo
title "symbols"
part R1 res 10k
part C1 cap 10u pol=yes
part L1 ind 4u7
part D1 zener 5V1
part Q1 pnp 2N3906
part M1 nmos 2N7000
part U1 opamp LM358
net a = R1.2 C1.+
net b = L1.1 D1.anode
net c = Q1.C M1.D
```

## Routable rails & a signal terminal

`routable` draws one power/ground symbol wired to every member (instead of one
per pin); `signal` is a labelled hollow-circle terminal.

```elmo
title "routable VCC + single GND"
part U1 ic "MCU" { left 1:GP0 right 8:VCC top 9:AVCC bottom 10:GND }
part R1 res 10k
signal VCC = U1.VCC U1.AVCC R1.1 routable
gnd GND = U1.GND R1.2 routable
signal TP1 = U1.GP0
```
