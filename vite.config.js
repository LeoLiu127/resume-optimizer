import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 如需在本地调试 CORS 问题，可开启 server.proxy，将 /minimax 转发到 https://api.minimaxi.com
// 然后在 .env 中设 VITE_MINIMAX_BASE_URL=/minimax/v1 即可走同源路径
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // proxy: {
    //   '/minimax': {
    //     target: 'https://api.minimaxi.com',
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/minimax/, ''),
    //   },
    // },
  },
});
