import { useRouter } from 'expo-router';
import { ProfileScreen } from '../src/screens/ProfileScreen';

export default function Profile() {
  const router = useRouter();
  return (
    <ProfileScreen
      onManageAccount={() => router.push('/account')}
      onViewChart={() => router.push('/natal-chart')}
    />
  );
}
