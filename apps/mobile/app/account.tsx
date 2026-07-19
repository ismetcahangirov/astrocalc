import { useRouter } from 'expo-router';
import { AccountScreen } from '../src/screens/AccountScreen';

export default function Account() {
  const router = useRouter();
  return <AccountScreen onDeleted={() => router.replace('/')} />;
}
