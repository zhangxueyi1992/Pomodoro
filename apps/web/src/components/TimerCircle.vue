<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 剩余比例 0~1 */
    progress: number
    color: string
  }>(),
  { progress: 1, color: '#e74c3c' },
)

const R = 130
const circumference = 2 * Math.PI * R
const offset = computed(() => circumference * (1 - Math.min(1, Math.max(0, props.progress))))
</script>

<template>
  <div class="timer-circle">
    <svg viewBox="0 0 300 300" class="circle-svg">
      <circle class="track" cx="150" cy="150" :r="R" />
      <circle
        class="bar"
        cx="150"
        cy="150"
        :r="R"
        :stroke="color"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div class="circle-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.timer-circle {
  position: relative;
  width: min(320px, 78vw);
  aspect-ratio: 1;
}

.circle-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: var(--circle-track);
  stroke-width: 10;
}

.bar {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s linear, stroke 0.3s;
}

.circle-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
