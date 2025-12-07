import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist', // 打包后输出到 dist 目录
  },
  server: {
    host: '0.0.0.0', // 允许外部 IP 访问开发服务器
    port: 5173
  }
});