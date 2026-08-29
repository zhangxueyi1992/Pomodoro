import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Task, TaskStatus } from '@pomodoro/shared'
import { createTaskApi, deleteTaskApi, fetchTasks, updateTaskApi, type TaskInput } from '@/api'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loaded = ref(false)

  async function loadTasks() {
    tasks.value = await fetchTasks()
    loaded.value = true
  }

  async function createTask(input: TaskInput) {
    const task = await createTaskApi(input)
    tasks.value.unshift(task)
    return task
  }

  async function updateTask(id: number, input: Partial<TaskInput> & { status?: TaskStatus }) {
    const updated = await updateTaskApi(id, input)
    const index = tasks.value.findIndex((t) => t.id === id)
    if (index >= 0) tasks.value[index] = updated
    return updated
  }

  async function removeTask(id: number) {
    await deleteTaskApi(id)
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  async function markDone(id: number) {
    await updateTask(id, { status: 'DONE' })
  }

  return { tasks, loaded, loadTasks, createTask, updateTask, removeTask, markDone }
})
