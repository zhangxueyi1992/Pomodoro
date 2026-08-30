<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  data: { date: string; pomodoros: number; focusMinutes: number }[]
}>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function render() {
  if (!chart || !el.value) return
  const dark = document.documentElement.classList.contains('dark')
  const textColor = dark ? '#9aa3af' : '#7f8c9b'
  const axisLine = dark ? '#2f3540' : '#e4e7ed'
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, left: 'center', textStyle: { color: textColor } },
    grid: { left: 12, right: 14, top: 48, bottom: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.data.map((d) => d.date.slice(5)),
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: textColor, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: textColor },
      splitLine: { lineStyle: { color: axisLine } },
    },
    series: [
      {
        name: '番茄数',
        type: 'bar',
        barMaxWidth: 28,
        data: props.data.map((d) => d.pomodoros),
        itemStyle: { color: '#e74c3c', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '专注分钟',
        type: 'line',
        smooth: true,
        data: props.data.map((d) => d.focusMinutes),
        itemStyle: { color: '#409eff' },
        areaStyle: { color: 'rgba(64, 158, 255, 0.08)' },
      },
    ],
  })
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  if (el.value) {
    chart = echarts.init(el.value)
    render()
    window.addEventListener('resize', resize)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

watch(() => props.data, render, { deep: true })
</script>

<template>
  <div ref="el" class="stat-chart" />
</template>

<style scoped>
.stat-chart {
  width: 100%;
  height: 360px;
}
</style>
