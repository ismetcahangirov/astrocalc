import { useRouter } from 'expo-router';
import { PeopleScreen } from '../src/screens/PeopleScreen';

export default function People() {
  const router = useRouter();
  return (
    <PeopleScreen
      onOpenSelfChart={() => router.push('/natal-chart')}
      onOpenSubjectChart={(id, name) =>
        router.push({ pathname: '/natal-chart', params: { subjectId: id, name } })
      }
      onAddSubject={() => router.push('/subject')}
      onEditSubject={(id) => router.push({ pathname: '/subject', params: { id } })}
    />
  );
}
