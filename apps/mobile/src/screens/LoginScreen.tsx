import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGoogleAuth } from '../auth/useGoogleAuth';
import { useTranslation } from '../i18n/LocaleContext';

/**
 * Login screen — Section 2 design system (dark + gold). Renders the Google
 * Sign-In button, a loading state, and a clear inline error message when
 * sign-in or backend token verification fails.
 */
export function LoginScreen() {
  const { loading, error, signIn } = useGoogleAuth();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={signIn}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#1a1206" />
        ) : (
          <Text style={styles.buttonText}>{t('login.continueWithGoogle')}</Text>
        )}
      </Pressable>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const GOLD = '#E4B95B';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0B14',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    color: GOLD,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#B9B4C7',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#1a1206',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#F2A2A2',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});
