<script setup lang="ts">
import { ref, shallowRef, watch, onMounted } from "vue";
import { render } from "@emdzej/elmo-core";

const EXAMPLES: Record<string, string> = {
  "555 astable": `title "555 astable"

part U1 ic "NE555" pkg=DIP-8 {
  left  2:TRIG  6:THRES  7:DISCH
  right 3:OUT   4:~RESET
  top   8:VCC
  bottom 1:GND
}
part R1 res 10k
part R2 res 47k
part C1 cap 10n

power VCC = U1.VCC U1.~RESET R1.1
gnd   GND = U1.GND C1.2

net disch  = U1.DISCH R1.2 R2.1        as=wire
net timing = U1.THRES U1.TRIG R2.2 C1.1 as=wire`,
  "LED blink": `title "LED blink"

part U1 ic "MCU" { left 1:GP0 top 2:VCC bottom 3:GND }
part R1 res 330
part D1 led green

wire U1.GP0 -- R1.1
wire R1.2 -- D1.anode
power VCC = U1.VCC
gnd GND = U1.GND D1.cathode`,
  "Divider": `title "voltage divider"

part J1 connector "IN"  { 1:VIN 2:GND }
part R1 res 10k
part R2 res 10k
part J2 connector "OUT" { 1:VOUT 2:GND }

net top = J1.VIN R1.1
net mid = R1.2 R2.1 J2.VOUT
gnd GND = J1.GND R2.2 J2.GND`,
};

const source = ref(EXAMPLES["555 astable"]);
const svg = shallowRef("");
const error = ref("");
const names = Object.keys(EXAMPLES);
let timer: ReturnType<typeof setTimeout> | undefined;

async function run() {
  try {
    const res = await render(source.value);
    svg.value = res.svg;
    error.value = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

watch(source, () => {
  clearTimeout(timer);
  timer = setTimeout(run, 220);
});

onMounted(run);
</script>

<template>
  <div class="elmo-play">
    <div class="elmo-play-bar">
      <span class="elmo-play-label">examples:</span>
      <button v-for="n in names" :key="n" type="button" @click="source = EXAMPLES[n]">{{ n }}</button>
    </div>
    <div class="elmo-play-grid">
      <textarea
        v-model="source"
        class="elmo-play-src"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        aria-label="elmo source"
      ></textarea>
      <div class="elmo-play-out">
        <pre v-if="error" class="elmo-play-err">{{ error }}</pre>
        <div v-else class="elmo-play-svg" v-html="svg"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.elmo-play {
  margin: 1.2rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}
.elmo-play-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}
.elmo-play-label {
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  margin-right: 0.2rem;
}
.elmo-play-bar button {
  font-size: 0.8rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  transition: border-color 0.2s, color 0.2s;
}
.elmo-play-bar button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.elmo-play-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 340px;
}
.elmo-play-src {
  resize: vertical;
  border: none;
  outline: none;
  padding: 1rem;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.55;
  tab-size: 2;
  color: var(--vp-c-text-1);
  background: var(--vp-code-block-bg, var(--vp-c-bg-soft));
  border-right: 1px solid var(--vp-c-divider);
  white-space: pre;
  overflow: auto;
}
.elmo-play-out {
  padding: 1rem;
  overflow: auto;
  background: var(--vp-c-bg-soft);
}
.elmo-play-svg :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
.elmo-play-err {
  margin: 0;
  color: var(--vp-c-danger-1);
  font-size: 0.82rem;
  white-space: pre-wrap;
}
@media (max-width: 720px) {
  .elmo-play-grid {
    grid-template-columns: 1fr;
  }
  .elmo-play-src {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
    min-height: 200px;
  }
}
</style>
