import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '../src/i18n/LocaleContext';
import { HomeButton } from '../src/common/HomeButton';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
          <HomeButton />
        </View>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
