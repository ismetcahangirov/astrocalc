import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../src/screens/OnboardingScreen';

export default function Onboarding() {
  const router = useRouter();
  return <OnboardingScreen onComplete={() => router.replace('/profile')} />;
}
