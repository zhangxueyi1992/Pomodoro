<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { StatsRange, StatsSummary } from '@pomodoro/shared'
import StatChart from '@/components/StatChart.vue'
import { fetchStatsApi } from '@/api'
import { formatMinutes } from '@/utils/format'

const range = ref<StatsRange>('week')
const loading = ref(false)
const stats = ref<StatsSummary | null>(null)

async function load() {
  loading.value = true
  try {
    stats.value = await fetchStatsApi(range.value)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(range, load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2 class="page-title">统计</h2>
      <el-radio-group v-model="range" size="large">
        <el-radio-button value="day">今日</el-radio-button>
        <el-radio-button value="week">本周</el-radio-button>
        <el-radio-button value="month">本月</el-radio-button>
      </el-radio-group>
    </div>

    <div v-loading="loading" class="stats-body">
      <div class="stat-cards">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value">{{ stats?.totalPomodoros ?? 0 }}</div>
          <div class="stat-label">完成的番茄 🍅</div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value">{{ formatMinutes(stats?.totalFocusMinutes ?? 0) }}</div>
          <div class="stat-label">专注总时长</div>
        </el-card>
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value">{{ stats?.daily.length ?? 0 }}</div>
          <div class="stat-label">有记录的天数</div>
        </el-card>
      </div>

      <el-card shadow="never" class="chart-card">
        <template #header>每日趋势</template>
        <el-empty v-if="stats && stats.daily.length === 0" description="当前区间暂无记录，去完成一个番茄吧" />
        <StatChart v-else :data="stats?.daily ?? []" />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.stats-body {
  min-height: 200px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--work-color);
}

.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.chart-card {
  margin-top: 4px;
}
</style>
