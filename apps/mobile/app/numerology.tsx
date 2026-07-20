import { useLocalSearchParams, useRouter } from 'expo-router';
import { NumerologyScreen } from '../src/screens/NumerologyScreen';

export default function Numerology() {
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  return (
    <NumerologyScreen
      subjectId={subjectId}
      subjectName={name}
      onEditProfile={() => router.push('/profile')}
    />
  );
}
