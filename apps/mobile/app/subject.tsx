import { useLocalSearchParams, useRouter } from 'expo-router';
import { SubjectFormScreen } from '../src/screens/SubjectFormScreen';

export default function Subject() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <SubjectFormScreen subjectId={id} onDone={() => router.back()} onCancel={() => router.back()} />
  );
}
