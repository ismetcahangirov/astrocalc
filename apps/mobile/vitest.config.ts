import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the mobile app's *pure* TypeScript modules — currently the
 * natal-chart wheel geometry (`src/chart/geometry.ts`). These modules import
 * nothing from React Native or Skia, so they run in a plain Node environment
 * with no native/Metro setup. `.tsx` component files are intentionally excluded
 * — rendering is verified in the app (dev client), not here.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
