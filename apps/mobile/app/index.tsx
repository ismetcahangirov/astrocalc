import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAccessToken, clearTokens } from '../src/auth/tokenStorage';
import { getProfile } from '../src/api/profileApi';
import { LoginScreen } from '../src/screens/LoginScreen';

type Phase = 'checking' | 'anonymous';

/**
 * Auth/onboarding gate. On launch (and again right after a successful sign-in)
 * checks for a stored session and routes to the right place:
 *   no token            -> LoginScreen (rendered here)
 *   token, onboarding incomplete -> /onboarding (#6)
 *   token, onboarding complete   -> /profile (#7) — this app's current
 *                                    post-auth landing point; no home/dashboard
 *                                    screen exists yet in any merged epic.
 * An invalid/expired token falls back to sign-in rather than getting stuck.
 */
export default function Index() {
  const router = useRouter();
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
    } catch {
      await clearTokens();
      setPhase('anonymous');
    }
  }, [router]);

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

  return <LoginScreen onSignedIn={check} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#0E0B14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
