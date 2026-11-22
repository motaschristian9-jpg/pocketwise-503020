import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg'],manifest:{name:'Pocketwise — 50/30/20',short_name:'Pocketwise',description:'A student-friendly offline allowance planner',start_url:'/',scope:'/',display:'standalone',background_color:'#f6f8fb',theme_color:'#142f2c',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,svg,png}'],navigateFallback:'/index.html'}})]});
