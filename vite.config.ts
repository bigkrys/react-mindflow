import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const BASE_PATH = '/react-mindflow/';

// 创建一个插件来修复资源路径
const fixAssetPaths = (): Plugin => {
  return {
    name: 'fix-asset-paths',
    transformIndexHtml(html) {
      // 修复所有资源路径
      return html
        .replace(
          /(src|href)="\/(assets\/[^"]*?)"/g,
          `$1="${BASE_PATH}$2"`
        )
        .replace(
          /(src|href)="\/([^"]*?)"/g,
          `$1="${BASE_PATH}$2"`
        )
        .replace(
          /(src|href)="\.\//g,
          `$1="${BASE_PATH}`
        );
    }
  };
};

export default defineConfig({
  plugins: [react(), fixAssetPaths()],
  root: 'example',
  publicDir: 'example/public',
  base: BASE_PATH,
  build: {
    outDir: resolve(__dirname, 'example/dist'),
    sourcemap: true,
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // 确保资源路径包含 BASE_PATH
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.name || '[name]-[hash]';
          const ext = fileName.split('.').pop() || '[ext]';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `${BASE_PATH.slice(1)}assets/images/[name]-[hash][extname]`;
          }
          return `${BASE_PATH.slice(1)}assets/[name]-[hash][extname]`;
        },
        chunkFileNames: `${BASE_PATH.slice(1)}assets/[name]-[hash].js`,
        entryFileNames: `${BASE_PATH.slice(1)}assets/[name]-[hash].js`
      }
    }
  }
}); 