import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from '../i18n/LocaleContext';
import {
  formatDisplayDate,
  formatIsoDate,
  formatTime,
  parseIsoDate,
  timeToDate,
} from './dateTimeFormat';

const MIN_DATE = new Date(1900, 0, 1);
const DEFAULT_DATE = new Date(2000, 0, 1);

interface DateTimeFieldProps {
  mode: 'date' | 'time';
  /** `YYYY-MM-DD` for `date`, `HH:mm` for `time`, or `''` when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Shown when `value` is empty. */
  placeholder: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * A tappable field that opens the native modal date/time picker instead of a
 * free-text input, so the value is always well-formed (#s1). Stores `YYYY-MM-DD`
 * / `HH:mm` — the formats the onboarding validation and backend expect. Reused
 * by onboarding, the profile screen, and (later) the subject form.
 *
 * Android renders the picker as its own dialog; iOS gets a spinner in a bottom
 * sheet with a Done/Cancel bar.
 */
export function DateTimeField({
  mode,
  value,
  onChange,
  placeholder,
  disabled,
  testID,
}: DateTimeFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const now = new Date();
  const pickerValue =
    mode === 'date' ? (parseIsoDate(value) ?? DEFAULT_DATE) : timeToDate(value, now);
  const isEmpty = value.trim() === '';
  const display = isEmpty ? placeholder : mode === 'date' ? formatDisplayDate(value) : value;

  const commit = (selected: Date) => {
    onChange(mode === 'date' ? formatIsoDate(selected) : formatTime(selected));
  };

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'set' && selected) commit(selected);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text style={isEmpty ? styles.placeholder : styles.value}>{display}</Text>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode={mode}
          is24Hour
          maximumDate={mode === 'date' ? now : undefined}
          minimumDate={mode === 'date' ? MIN_DATE : undefined}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={pickerValue}
                mode={mode}
                display="spinner"
                is24Hour
                maximumDate={mode === 'date' ? now : undefined}
                minimumDate={mode === 'date' ? MIN_DATE : undefined}
                onChange={(_event, selected) => selected && commit(selected)}
                textColor={TEXT}
              />
              <View style={styles.sheetActions}>
                <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
                  <Text style={styles.cancel}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
                  <Text style={styles.done}>{t('common.done')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const GOLD = '#E4B95B';
const TEXT = '#F4F1FA';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#181329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  fieldDisabled: { opacity: 0.4 },
  value: { color: TEXT, fontSize: 15 },
  placeholder: { color: MUTED, fontSize: 15 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#181329', paddingBottom: 24 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  cancel: { color: MUTED, fontSize: 16, fontWeight: '600' },
  done: { color: GOLD, fontSize: 16, fontWeight: '700' },
});
