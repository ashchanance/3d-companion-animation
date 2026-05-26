import { defineConfig, UserConfig, ConfigEnv } from 'vite';
import path from 'path';

export default defineConfig((env: ConfigEnv): UserConfig => {
  let common: UserConfig = {
    server: {
      port: 5000,
    },
    root: './',
    base: '/',
    publicDir: './public',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@framework': path.resolve(__dirname, '../../../Framework/src'),
      }
    },
    build: {
      target: 'baseline-widely-available',
      assetsDir: 'assets',
      outDir: './dist',
      sourcemap: env.mode == 'development' ? true : false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          lore: path.resolve(__dirname, 'lore.html'),
          'about-us': path.resolve(__dirname, 'about-us.html'),
          roadmap: path.resolve(__dirname, 'roadmap.html'),
          docs: path.resolve(__dirname, 'docs.html'),
          features: path.resolve(__dirname, 'features.html'),
        },
      },
    },
  };
  return common;
});
