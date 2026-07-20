import { useLocalSearchParams, useRouter } from 'expo-router';
import { MatrixScreen } from '../src/screens/MatrixScreen';

export default function Matrix() {
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  return (
    <MatrixScreen
      subjectId={subjectId}
      subjectName={name}
      onEditProfile={() => router.push('/profile')}
    />
  );
}
