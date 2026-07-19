import type { ExpoConfig } from 'expo/config';

/**
 * Expo app config. Google client IDs are read from environment variables at
 * build time and surfaced to the app via `extra` (read back in `src/config.ts`).
 *
 * A custom dev client is required — the Google Sign-In native module does not
 * run in Expo Go. Build with `expo run:android` / `expo run:ios` or EAS.
 */
const config: ExpoConfig = {
  name: 'AstroCalc',
  slug: 'astrocalc',
  scheme: 'astrocalc',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.astrocalc.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.astrocalc.app',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    [
      '@react-native-google-signin/google-signin',
      {
        // iOS URL scheme (the reversed iOS client ID), required by the native SDK.
        iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.PLACEHOLDER',
      },
    ],
    [
      'expo-build-properties',
      {
        // @react-native/gradle-plugin pins its own Kotlin Gradle Plugin to 1.9.24;
        // this must match so expo-modules-core picks a compatible Compose Compiler
        // version (see its versionsMap of kotlinVersion -> composeCompilerVersion).
        android: {
          kotlinVersion: '1.9.24',
        },
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
    googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
    eas: {
      projectId: '085786d1-040e-4695-8302-cfff8b98eb2b',
    },
  },
  owner: 'rockdrago',
};

export default config;
