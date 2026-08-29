<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Task } from '@pomodoro/shared'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

const tasksStore = useTasksStore()
const timer = useTimerStore()
const router = useRouter()

const dialogVisible = ref(false)
const saving = ref(false)
const form = reactive({ title: '', description: '', estimatedPomodoros: undefined as number | undefined })

function openCreate() {
  form.title = ''
  form.description = ''
  form.estimatedPomodoros = undefined
  dialogVisible.value = true
}

async function onSubmit() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入任务标题')
    return
  }
  saving.value = true
  try {
    await tasksStore.createTask({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      estimatedPomodoros: form.estimatedPomodoros,
    })
    dialogVisible.value = false
    ElMessage.success('任务已创建')
  } finally {
    saving.value = false
  }
}

async function onRemove(task: Task) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${task.title}」吗？相关统计不会删除。`, '删除任务', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await tasksStore.removeTask(task.id)
  if (timer.currentTaskId === task.id) {
    timer.currentTaskId = null
  }
  ElMessage.success('任务已删除')
}

async function onMarkDone(task: Task) {
  await tasksStore.markDone(task.id)
  ElMessage.success('任务已完成 🎉')
}

function onFocus(task: Task) {
  timer.currentTaskId = task.id
  if (timer.status === 'idle') timer.switchMode('work')
  router.push('/')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2 class="page-title">任务管理</h2>
      <el-button type="primary" @click="openCreate">+ 新建任务</el-button>
    </div>

    <el-empty v-if="tasksStore.tasks.length === 0" description="还没有任务，创建一个开始专注吧" />

    <div v-else class="task-list">
      <el-card v-for="task in tasksStore.tasks" :key="task.id" class="task-card" shadow="hover">
        <div class="task-row">
          <div class="task-main">
            <div class="task-title-line">
              <span class="task-title" :class="{ done: task.status === 'DONE' }">{{ task.title }}</span>
              <el-tag v-if="task.status === 'DOING'" type="warning" size="small">进行中</el-tag>
              <el-tag v-if="task.status === 'DONE'" type="success" size="small">已完成</el-tag>
              <el-tag v-if="timer.currentTaskId === task.id" type="danger" size="small" effect="dark">当前专注</el-tag>
            </div>
            <p v-if="task.description" class="task-desc">{{ task.description }}</p>
            <div class="task-meta">
              <span>
                🍅 {{ task.completedPomodoros }}
                <template v-if="task.estimatedPomodoros">/ {{ task.estimatedPomodoros }} 预估</template>
                <template v-else>个番茄</template>
              </span>
            </div>
          </div>
          <div class="task-actions">
            <el-button v-if="task.status !== 'DONE'" type="primary" size="small" @click="onFocus(task)">开始专注</el-button>
            <el-button v-if="task.status === 'TODO'" size="small" @click="tasksStore.updateTask(task.id, { status: 'DOING' })">设为进行中</el-button>
            <el-button v-if="task.status !== 'DONE'" type="success" size="small" plain @click="onMarkDone(task)">完成</el-button>
            <el-button type="danger" size="small" plain @click="onRemove(task)">删除</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="dialogVisible" title="新建任务" width="420px">
      <el-form label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="100" show-word-limit placeholder="例如：完成项目周报" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" placeholder="可选" />
        </el-form-item>
        <el-form-item label="预估番茄数">
          <el-input-number v-model="form.estimatedPomodoros" :min="1" :max="99" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.task-main {
  flex: 1;
  min-width: 0;
}

.task-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-title {
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.task-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  word-break: break-all;
}

.task-meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
