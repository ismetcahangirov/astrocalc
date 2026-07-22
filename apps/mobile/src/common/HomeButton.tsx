import { Pressable, StyleSheet, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n/LocaleContext';

/**
 * Routes with no "back to home" button: the home screen itself, and the
 * pre-auth / onboarding flow, which never has a home to go back to yet.
 */
const HIDDEN_ON = new Set(['/', '/onboarding', '/profile']);

/**
 * Floating top-left button, shown on every screen except home/pre-auth, that
 * returns to the profile (home) screen. Rendered once in the root layout
 * rather than per-screen — every screen, including loading/error states,
 * should offer a way back without relying on the hardware back key, and a
 * single rendering site covers all of them without touching each screen.
 */
export function HomeButton() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (HIDDEN_ON.has(pathname)) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.backToHome')}
      onPress={() => router.replace('/profile')}
      hitSlop={12}
      style={[styles.button, { top: insets.top + 8 }]}
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const GOLD = '#E4B95B';

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(24, 19, 41, 0.85)',
    borderWidth: 1,
    borderColor: '#2C273F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: GOLD, fontSize: 18, fontWeight: '700' },
});
