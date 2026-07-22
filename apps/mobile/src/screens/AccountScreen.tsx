import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiError,
  deleteAccount,
  getExportStatus,
  requestExport,
  type ExportJob,
} from '../api/accountApi';
import { clearTokens } from '../auth/tokenStorage';
import { describeExportStatus, isExportTerminal } from '../account/exportStatus';
import { HomeButton } from '../common/HomeButton';
import { useTranslation } from '../i18n/LocaleContext';

interface AccountScreenProps {
  /** Called once the account is actually deleted and local tokens are cleared, so the caller can route to sign-in. */
  onDeleted: () => void;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Account deletion & GDPR data export (#9) over the backend's already-complete
 * `/account` endpoints. The export's download link is delivered out-of-band
 * (see `apps/backend/src/account/exportNotifier.ts`, not yet wired to a real
 * channel) — this screen only requests the job and polls its status, since the
 * token itself is never returned by the status API (it's a single-use
 * capability, not a value to hand to every authenticated caller).
 */
export function AccountScreen({ onDeleted }: AccountScreenProps) {
  const { t } = useTranslation();

  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Stop any in-flight poll on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  const pollStatus = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const job = await getExportStatus(jobId);
          setExportJob(job);
          if (isExportTerminal(job.status)) stopPolling();
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  const onRequestExport = async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      const job = await requestExport();
      setExportJob(job);
      if (!isExportTerminal(job.status)) pollStatus(job.jobId);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : t('account.export.error'));
    } finally {
      setExportLoading(false);
    }
  };

  const onDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(confirmation.trim());
      await clearTokens();
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('account.delete.error'));
    } finally {
      setDeleting(false);
    }
  };

  const exportInFlight = exportJob !== null && !isExportTerminal(exportJob.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <HomeButton />
        <Text style={styles.title}>{t('account.title')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('account.export.title')}</Text>
        <Text style={styles.sectionBody}>{t('account.export.description')}</Text>

        {exportJob ? (
          <Text style={styles.status}>{t(describeExportStatus(exportJob.status))}</Text>
        ) : null}
        {exportError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {exportError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: exportLoading || exportInFlight }}
          disabled={exportLoading || exportInFlight}
          onPress={onRequestExport}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            (exportLoading || exportInFlight) && styles.buttonDisabled,
          ]}
        >
          {exportLoading ? (
            <ActivityIndicator color={GOLD} />
          ) : (
            <Text style={styles.secondaryButtonText}>{t('account.export.request')}</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t('account.delete.title')}</Text>
        <Text style={styles.sectionBody}>{t('account.delete.description')}</Text>

        <TextInput
          style={styles.input}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={t('account.delete.placeholder')}
          placeholderTextColor={MUTED}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {deleteError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {deleteError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting || confirmation.trim() === '' }}
          disabled={deleting || confirmation.trim() === ''}
          onPress={onDeleteAccount}
          style={({ pressed }) => [
            styles.dangerButton,
            pressed && styles.buttonPressed,
            (deleting || confirmation.trim() === '') && styles.buttonDisabled,
          ]}
        >
          {deleting ? (
            <ActivityIndicator color="#1a1206" />
          ) : (
            <Text style={styles.dangerButtonText}>{t('account.delete.confirm')}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const GOLD = '#E4B95B';
const DANGER = '#F2A2A2';
const BG = '#0E0B14';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 24, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  title: { color: GOLD, fontSize: 28, fontWeight: '700', letterSpacing: 0.5 },
  section: {
    backgroundColor: '#181329',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C273F',
    padding: 18,
    marginBottom: 20,
  },
  dangerSection: { borderColor: 'rgba(242, 162, 162, 0.35)' },
  sectionTitle: { color: '#F4F1FA', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  dangerTitle: { color: DANGER },
  sectionBody: { color: '#B9B4C7', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  status: { color: GOLD, fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: '#0E0B14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    color: '#F4F1FA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
  dangerButton: {
    backgroundColor: DANGER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  dangerButtonText: { color: '#3A0E0E', fontSize: 15, fontWeight: '700' },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  error: { color: DANGER, fontSize: 13, marginBottom: 12 },
});
