<script setup lang="ts">
import { computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { TimerMode } from '@pomodoro/shared'
import TimerCircle from '@/components/TimerCircle.vue'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { formatSeconds } from '@/utils/format'

const timer = useTimerStore()
const settingsStore = useSettingsStore()
const tasksStore = useTasksStore()

const MODE_META: Record<TimerMode, { label: string; color: string; tip: string }> = {
  work: { label: '工作', color: '#e74c3c', tip: '保持专注' },
  shortBreak: { label: '短休息', color: '#27ae60', tip: '起身活动一下' },
  longBreak: { label: '长休息', color: '#2980b9', tip: '好好放松' },
}

const meta = computed(() => MODE_META[timer.mode])

const totalSeconds = computed(() => {
  const s = settingsStore.settings
  switch (timer.mode) {
    case 'work':
      return s.workMinutes * 60
    case 'shortBreak':
      return s.shortBreakMinutes * 60
    case 'longBreak':
      return s.longBreakMinutes * 60
  }
})

const progress = computed(() =>
  totalSeconds.value > 0 ? Math.min(1, Math.max(0, timer.remainingSeconds / totalSeconds.value)) : 1,
)

const currentTask = computed(() => tasksStore.tasks.find((t) => t.id === timer.currentTaskId))

/** 设置修改后，空闲状态下刷新剩余时长显示 */
watch(
  () => settingsStore.settings,
  () => {
    if (timer.status === 'idle') timer.reset()
  },
)

function switchMode(mode: TimerMode) {
  if (mode === timer.mode) return
  if (timer.status === 'running') {
    ElMessageBox.confirm('计时进行中，切换模式将放弃当前进度，确定继续吗？', '切换模式', {
      type: 'warning',
      confirmButtonText: '继续切换',
      cancelButtonText: '取消',
    })
      .then(() => timer.switchMode(mode))
      .catch(() => {})
  } else {
    timer.switchMode(mode)
  }
}

function onStartPause() {
  if (timer.isRunning) {
    timer.pause()
  } else {
    timer.start()
  }
}

/** 在计时器页切换「当前专注任务」→ 结束所有进行中标记 */
function onTaskSelect() {
  void timer.clearDoing()
}

function onSkip() {
  if (timer.status === 'idle') {
    timer.switchMode(timer.mode === 'work' ? 'shortBreak' : 'work')
    return
  }
  ElMessageBox.confirm('跳过将不计入统计，确定跳过当前阶段吗？', '跳过', {
    type: 'warning',
    confirmButtonText: '跳过',
    cancelButtonText: '取消',
  })
    .then(() => timer.skip())
    .catch(() => {})
}
</script>

<template>
  <div class="page timer-page">
    <div class="mode-tabs">
      <button
        v-for="(m, key) in MODE_META"
        :key="key"
        class="mode-tab"
        :class="{ active: timer.mode === key }"
        :style="timer.mode === key ? { color: m.color, borderColor: m.color } : {}"
        @click="switchMode(key)"
      >
        {{ m.label }}
      </button>
    </div>

    <TimerCircle :progress="progress" :color="meta.color">
      <div class="time-display" :style="{ color: meta.color }">{{ formatSeconds(timer.remainingSeconds) }}</div>
      <div class="mode-tip">{{ meta.tip }}</div>
    </TimerCircle>

    <div class="cycle-dots" :title="`本轮已完成 ${timer.completedInCycle}/${settingsStore.settings.longBreakInterval} 个番茄`">
      <span
        v-for="i in settingsStore.settings.longBreakInterval"
        :key="i"
        class="cycle-dot"
        :class="{ filled: i <= timer.completedInCycle }"
      />
    </div>

    <div class="controls">
      <el-button size="large" round :type="timer.isRunning ? 'warning' : 'primary'" class="control-main" @click="onStartPause">
        {{ timer.isRunning ? '暂停' : timer.status === 'paused' ? '继续' : '开始' }}
      </el-button>
      <el-button size="large" round @click="timer.reset()">重置</el-button>
      <el-button size="large" round type="danger" plain @click="onSkip">跳过</el-button>
    </div>

    <div v-if="timer.mode === 'work'" class="task-picker">
      <span class="task-label">当前专注任务：</span>
      <el-select
        v-model="timer.currentTaskId"
        placeholder="选择要专注的任务（可选）"
        clearable
        style="width: 280px"
        :disabled="timer.status !== 'idle'"
        :title="timer.status !== 'idle' ? '正在专注中，请先重置或跳过后再切换' : ''"
        @change="onTaskSelect"
      >
        <el-option
          v-for="t in tasksStore.tasks.filter((x) => x.status !== 'DONE')"
          :key="t.id"
          :label="t.title"
          :value="t.id"
        />
      </el-select>
      <span v-if="currentTask" class="task-progress">已完成 {{ currentTask.completedPomodoros }} 🍅</span>
    </div>
  </div>
</template>

<style scoped>
.timer-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding-top: 32px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  background: var(--surface);
  padding: 6px;
  border-radius: 999px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.mode-tab {
  border: 1px solid transparent;
  background: none;
  padding: 8px 22px;
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.mode-tab:hover {
  color: var(--text);
}

.time-display {
  font-size: 64px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1;
}

.mode-tip {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.cycle-dots {
  display: flex;
  gap: 10px;
}

.cycle-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--circle-track);
  border: 2px solid var(--border);
  transition: all 0.3s;
}

.cycle-dot.filled {
  background: var(--work-color);
  border-color: var(--work-color);
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.control-main {
  min-width: 110px;
}

.task-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  flex-wrap: wrap;
  justify-content: center;
}

.task-progress {
  color: var(--work-color);
  font-size: 13px;
}
</style>
