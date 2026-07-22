import { type ReactNode } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionRowProps {
  name: string;
  value: string;
  /** Small tag rendered after the name, e.g. a retrograde "R". */
  tag?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** The meaning content revealed when expanded. */
  children: ReactNode;
}

/**
 * One tappable, single-open detail row for the natal-chart details list. The
 * parent owns which row is open (so only one is), toggling via {@link onToggle};
 * this component just animates its body in and out and shows a caret.
 */
export function AccordionRow({
  name,
  value,
  tag,
  expanded,
  onToggle,
  children,
}: AccordionRowProps) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        style={styles.header}
      >
        <Text style={styles.name}>
          {name}
          {tag}
        </Text>
        <View style={styles.right}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.caret}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const GOLD = '#E4B95B';

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#221D33',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 10,
  },
  name: { color: '#F4F1FA', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  value: { color: '#B9B4C7', fontSize: 13, textAlign: 'right', flexShrink: 1 },
  caret: { color: GOLD, fontSize: 10 },
  body: { paddingBottom: 12, paddingTop: 2 },
});
