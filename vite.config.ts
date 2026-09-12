import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({plugins:[react(),tailwindcss()],resolve:{alias:{'@':path.resolve(import.meta.dirname,'src')}},server:{proxy:{'/api':{target:process.env.VIPTV_PROXY_TARGET || 'http://127.0.0.1:8080',changeOrigin:true},'/media':{target:process.env.VIPTV_PROXY_TARGET || 'http://127.0.0.1:8080',changeOrigin:true}}}});
