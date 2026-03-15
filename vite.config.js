
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        host: '0.0.0.0',
        open: true,
        watch: {
            usePolling: true,
            interval: 1000,
        },
    },
});
