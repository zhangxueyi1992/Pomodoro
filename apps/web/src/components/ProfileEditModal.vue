<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { PASSWORD_HINT, PASSWORD_PATTERN, PASSWORD_PLACEHOLDER } from '@pomodoro/shared'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const submitting = ref(false)

function reset() {
  form.username = auth.user?.username ?? ''
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) reset()
  },
)

function close() {
  emit('update:modelValue', false)
}

function onDialogValue(v: boolean) {
  emit('update:modelValue', v)
}

async function onSubmit() {
  const newUsername = form.username.trim()
  const changingName = !!newUsername && newUsername !== auth.user?.username
  const changingPass = !!(form.currentPassword || form.newPassword || form.confirmPassword)

  if (!changingName && !changingPass) {
    ElMessage.warning('请至少修改一项')
    return
  }
  if (changingName && newUsername.length < 2) {
    ElMessage.warning('昵称至少 2 个字符')
    return
  }
  if (changingPass) {
    if (!PASSWORD_PATTERN.test(form.newPassword)) {
      ElMessage.warning(PASSWORD_HINT)
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      ElMessage.warning('两次输入的新密码不一致')
      return
    }
    if (!form.currentPassword) {
      ElMessage.warning('请输入原密码')
      return
    }
  }

  const payload: { username?: string; currentPassword?: string; newPassword?: string } = {}
  if (changingName) payload.username = newUsername
  if (changingPass) {
    payload.currentPassword = form.currentPassword
    payload.newPassword = form.newPassword
  }

  submitting.value = true
  try {
    await auth.updateProfile(payload)
    if (changingPass) {
      close()
      ElMessage.success('修改成功，请重新登录')
      auth.logout()
      router.push({ name: 'login' })
    } else {
      close()
      ElMessage.success('昵称已更新')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="修改资料"
    width="420px"
    @update:model-value="onDialogValue"
  >
    <el-form label-position="top">
      <el-form-item label="昵称">
        <el-input v-model="form.username" maxlength="30" placeholder="修改昵称（可选）" />
      </el-form-item>
      <el-form-item label="原密码">
        <el-input v-model="form.currentPassword" type="password" show-password placeholder="修改密码时必填" />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="form.newPassword" type="password" show-password :placeholder="`${PASSWORD_PLACEHOLDER}（可选）`" />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped></style>
