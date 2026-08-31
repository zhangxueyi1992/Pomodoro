import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        watch: {
            // 忽略编辑器/工具产生的临时文件，避免 Windows 下 watch 崩溃（EBUSY）。
            // 用函数形式判断：glob 的 `*` 不匹配以 `.` 开头的路径段（.TasksView.vue.xxx.tmpdir），
            // 且 Windows 反斜杠路径对 `/` 分隔的 glob 可能不匹配。
            ignored: [
                function (path) {
                    return /\.tmpdir[/\\]/.test(path) ||
                        /\.tmp$/.test(path) ||
                        /~$/.test(path) ||
                        /\.sw[px]$/.test(path);
                },
            ],
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
