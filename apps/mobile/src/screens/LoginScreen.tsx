import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGoogleAuth } from '../auth/useGoogleAuth';
import { useTranslation } from '../i18n/LocaleContext';
import { OtpLoginScreen } from './OtpLoginScreen';

interface LoginScreenProps {
  /** Called after a session is successfully established, so the caller can route onward. */
  onSignedIn?: () => void;
}

/**
 * Login screen — Section 2 design system (dark + gold). Renders the Google
 * Sign-In button, a loading state, and a clear inline error message when
 * sign-in or backend token verification fails. "Continue with WhatsApp"
 * switches to the OTP flow (#3) in place, so both providers share the same
 * `onSignedIn` handoff without a separate route.
 */
export function LoginScreen({ onSignedIn }: LoginScreenProps = {}) {
  const { loading, error, linkRequired, signIn } = useGoogleAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'google' | 'otp'>('google');

  if (mode === 'otp') {
    return (
      <OtpLoginScreen
        onSignedIn={onSignedIn}
        onCancel={() => setMode('google')}
        linkToken={linkRequired?.linkToken}
      />
    );
  }

  const handlePress = async () => {
    const session = await signIn();
    if (session) onSignedIn?.();
  };

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
        onPress={handlePress}
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

      <Pressable
        accessibilityRole="button"
        onPress={() => setMode('otp')}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>{t('login.continueWithWhatsApp')}</Text>
      </Pressable>

      {linkRequired ? (
        // Google matched an existing account's email (#4) — never linked
        // automatically. Surfacing this (rather than a generic error) is
        // #4's own acceptance criterion: the user must see this explanation
        // and be routed to sign in with their other method to confirm.
        <Text accessibilityRole="alert" style={styles.notice}>
          {t('login.accountExists')} {linkRequired.maskedEmail}
        </Text>
      ) : error ? (
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
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3A3550',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  secondaryButtonText: {
    color: '#F4F1FA',
    fontSize: 16,
    fontWeight: '600',
  },
  notice: {
    color: GOLD,
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  error: {
    color: '#F2A2A2',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});
