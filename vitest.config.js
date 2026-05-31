import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['resources/js/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**'],
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.js'],
    },
});
