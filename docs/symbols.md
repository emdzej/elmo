# Symbol catalogue

Every built-in `kind`, rendered live by elmo. Use the keyword after `part <ref>`:
`part R1 res 10k`. Kinds not listed here (`ic`, `connector`, `mod`) render as
pin-labelled boxes whose pins you declare. Unknown kinds fall back to a box.

## Passives

```elmo
part res res
part cap cap
part cap_pol cap pol=yes
part ind ind
part ferrite ferrite
part fuse fuse
part crystal crystal
part rheostat rheostat
part thermistor thermistor
part varistor varistor
part pot pot
part transformer transformer
```

## Diodes

```elmo
part diode diode
part led led
part zener zener
part schottky schottky
part tvs tvs
part photodiode photodiode
part varactor varactor
part bridge bridge
```

## Transistors & FETs

```elmo
part npn npn
part pnp pnp
part darlington darlington
part phototransistor phototransistor
part igbt igbt
part nmos nmos
part pmos pmos
part nmos_dep nmos_dep
part pmos_dep pmos_dep
part njfet njfet
part pjfet pjfet
```

## Active & sources

```elmo
part opamp opamp
part vsource vsource
part isource isource
part acsource acsource
part battery battery
part lamp lamp
part motor motor
part speaker speaker
part buzzer buzzer
```

## Switches & electromechanical

```elmo
part switch_spst switch_spst
part pushbutton pushbutton
part switch_spdt switch_spdt
part relay relay
part antenna antenna
```

## Net symbols

`power` and `gnd` are net keywords, not part kinds — they draw a rail flag or a
ground symbol at each member pin and are never routed:

```elmo
part U1 ic "MCU" { left 1:IN top 2:VCC bottom 3:GND }
power VCC = U1.VCC
gnd GND = U1.GND
```

## Aliases

Several kinds accept alternate spellings: `mod`/`module` → `ic`,
`potentiometer` → `pot`, `xtal` → `crystal`, `spst`/`spdt` → `switch_*`,
`pushbtn` → `pushbutton`, `ntc`/`ptc` → `thermistor`, `mov` → `varistor`,
`jfet_n`/`jfet_p` → `njfet`/`pjfet`.
