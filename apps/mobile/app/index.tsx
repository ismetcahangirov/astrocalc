import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAccessToken, clearTokens } from '../src/auth/tokenStorage';
import { classifyGateFailure } from '../src/auth/sessionGate';
import { getProfile } from '../src/api/profileApi';
import { LoginScreen } from '../src/screens/LoginScreen';
import { useTranslation } from '../src/i18n/LocaleContext';

type Phase = 'checking' | 'anonymous' | 'unreachable';

/**
 * Auth/onboarding gate. On launch (and again right after a successful sign-in)
 * checks for a stored session and routes to the right place:
 *   no token            -> LoginScreen (rendered here)
 *   token, onboarding incomplete -> /onboarding (#6)
 *   token, onboarding complete   -> /profile (#7) — this app's current
 *                                    post-auth landing point; no home/dashboard
 *                                    screen exists yet in any merged epic.
 *
 * A rejected session falls back to sign-in rather than getting stuck. A failure
 * that is *not* the session's fault — offline, backend outage — keeps the
 * tokens and offers a retry: an expired access token is refreshed in
 * `authedFetch` (#86), so reaching here with `unauthorized` means the refresh
 * token was rejected as well, and nothing else warrants a forced sign-in.
 */
export default function Index() {
  const router = useRouter();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('checking');

  const check = useCallback(async () => {
    setPhase('checking');
    const token = await getAccessToken();
    if (!token) {
      setPhase('anonymous');
      return;
    }

    try {
      const profile = await getProfile();
      router.replace(profile.onboardingCompletedAt ? '/profile' : '/onboarding');
    } catch (err) {
      if (classifyGateFailure(err) === 'retry') {
        setPhase('unreachable');
        return;
      }
      await clearTokens();
      setPhase('anonymous');
    }
  }, [router]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setPhase('anonymous');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (phase === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#E4B95B" />
      </View>
    );
  }

  if (phase === 'unreachable') {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{t('launch.unreachable')}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={check}>
          <Text style={styles.retryButtonText}>{t('launch.retry')}</Text>
        </Pressable>
        {/* An escape hatch, so a persistent failure can never trap the user. */}
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={signOut}>
          <Text style={styles.signOutText}>{t('launch.signIn')}</Text>
        </Pressable>
      </View>
    );
  }

  return <LoginScreen onSignedIn={check} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#0E0B14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  error: { color: '#F2A2A2', fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: '#E4B95B', fontSize: 15, fontWeight: '600' },
  signOutText: { color: '#B9B4C7', fontSize: 14 },
});
