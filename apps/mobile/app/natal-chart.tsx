import { useLocalSearchParams } from 'expo-router';
import { NatalChartScreen } from '../src/screens/NatalChartScreen';

export default function NatalChart() {
  const { subjectId, name } = useLocalSearchParams<{ subjectId?: string; name?: string }>();
  return <NatalChartScreen subjectId={subjectId} subjectName={name} />;
}
