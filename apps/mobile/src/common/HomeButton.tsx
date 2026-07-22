import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../i18n/LocaleContext';

/**
 * Plain "back to home" arrow, meant to sit inline to the left of a screen's
 * title (in a `flexDirection: 'row', alignItems: 'center'` row) rather than
 * float over the content — every screen that has one places it itself, right
 * next to its own title `Text`.
 */
export function HomeButton() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.backToHome')}
      onPress={() => router.replace('/profile')}
      hitSlop={12}
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const GOLD = '#E4B95B';

const styles = StyleSheet.create({
  arrow: { color: GOLD, fontSize: 22, fontWeight: '700' },
});
