import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    base: '/lyamun.github.io/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html')
            },
            output: {
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'Resume_LyaM.pdf') {
                        return 'assets/[name][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js'
            }
        }
    },
    publicDir: 'static',
    server: {
        port: 3000,
        open: true
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './')
        }
    }
}); 