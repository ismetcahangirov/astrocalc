import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChakraScreen } from '../src/screens/ChakraScreen';

export default function Chakra() {
  const router = useRouter();
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  return (
    <ChakraScreen
      subjectId={subjectId}
      subjectName={name}
      onEditProfile={() => router.push('/profile')}
    />
  );
}
