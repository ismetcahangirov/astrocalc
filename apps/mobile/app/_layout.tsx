import { Stack } from 'expo-router';
import { LocaleProvider } from '../src/i18n/LocaleContext';

export default function RootLayout() {
  return (
    <LocaleProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LocaleProvider>
  );
}
