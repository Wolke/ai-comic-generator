import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
    base: command === 'build' ? '/ai-comic-generator/' : '/',
    plugins: [react()],
    server: {
        port: 3000,
    },
    define: {
        'process.env': {}
    }
}));
