import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAccountLink } from '../api/authApi';
import { useOtpAuth } from '../auth/useOtpAuth';
import { saveTokens } from '../auth/tokenStorage';
import { useTranslation } from '../i18n/LocaleContext';
import { formatCountdown, isValidCode, isValidPhone, normalizePhoneInput } from '../otp/validation';

const CODE_LENGTH = 6;

interface OtpLoginScreenProps {
  /** Called after a session is successfully established, so the caller can route onward. */
  onSignedIn?: () => void;
  /** Called when the user backs out to the Google sign-in flow instead. */
  onCancel: () => void;
  /**
   * A pending account-link token (#4) — set when the user got here after a
   * Google sign-in matched an existing account's email. Once WhatsApp
   * verification succeeds (proving ownership of *this* account), it's
   * exchanged for the actual link via `POST /auth/link/confirm` before
   * `onSignedIn` fires, so the Google identity ends up attached to this
   * account rather than left as a dangling offer.
   */
  linkToken?: string;
}

/**
 * WhatsApp OTP login (#3): a two-step phone -> code flow over the backend's
 * already-complete `/otp/request` + `/otp/verify` endpoints (#10's abuse
 * protection lives entirely server-side; this screen just surfaces it —
 * cooldown/expiry countdowns, remaining attempts, and a lockout message).
 * On a WhatsApp quota exhaustion the backend flags `alternative: 'google'`,
 * which this screen turns into a direct prompt back to `onCancel`.
 */
export function OtpLoginScreen({ onSignedIn, onCancel, linkToken }: OtpLoginScreenProps) {
  const { t } = useTranslation();
  const {
    step,
    phone,
    loading,
    error,
    expiresInSeconds,
    resendAvailableInSeconds,
    attemptsRemaining,
    alternative,
    requestCode,
    verifyCode,
    reset,
  } = useOtpAuth();

  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  // Seed the live countdowns whenever a request/resend succeeds.
  useEffect(() => {
    if (step !== 'code') return;
    setSecondsLeft(expiresInSeconds);
    setResendSecondsLeft(resendAvailableInSeconds);
  }, [step, expiresInSeconds, resendAvailableInSeconds]);

  useEffect(() => {
    if (step !== 'code') return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setResendSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const handleSendCode = async () => {
    setValidationError(null);
    const normalized = normalizePhoneInput(phoneInput);
    if (!isValidPhone(normalized)) {
      setValidationError(t('otp.phone.invalid'));
      return;
    }
    await requestCode(normalized);
  };

  const handleResend = async () => {
    if (resendSecondsLeft > 0 || loading) return;
    setValidationError(null);
    setCodeInput('');
    await requestCode(phone);
  };

  const handleVerify = async () => {
    setValidationError(null);
    setLinkError(null);
    if (!isValidCode(codeInput, CODE_LENGTH)) {
      setValidationError(t('otp.code.invalid'));
      return;
    }
    const result = await verifyCode(codeInput);
    if (!result) return;

    if (linkToken) {
      // Prove-then-link: this WhatsApp sign-in just proved ownership of the
      // existing account, so exchange the pending offer for the real link
      // instead of leaving the Google identity unattached (#4).
      setLinking(true);
      try {
        const linked = await confirmAccountLink(result.accessToken, linkToken);
        await saveTokens(linked.accessToken, linked.refreshToken);
      } catch {
        setLinkError(t('login.linkFailed'));
        setLinking(false);
        return;
      }
      setLinking(false);
    }

    onSignedIn?.();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const displayError = validationError ?? linkError ?? error;
  const busy = loading || linking;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {step === 'phone' ? t('otp.phone.title') : t('otp.code.title')}
        </Text>
        {step === 'code' ? <Text style={styles.subtitle}>{phone}</Text> : null}
        {linkToken ? <Text style={styles.subtitle}>{t('login.linkHint')}</Text> : null}
      </View>

      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder={t('otp.phone.placeholder')}
            placeholderTextColor={MUTED}
            keyboardType="phone-pad"
            autoFocus
          />
          {displayError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {displayError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={handleSendCode}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#1a1206" />
            ) : (
              <Text style={styles.buttonText}>{t('otp.phone.send')}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder={t('otp.code.placeholder')}
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
          />

          <Text style={styles.countdown}>
            {t('otp.code.expiresIn')} {formatCountdown(secondsLeft)}
          </Text>

          {attemptsRemaining != null ? (
            <Text style={styles.warning}>
              {attemptsRemaining} {t('otp.attemptsRemaining')}
            </Text>
          ) : null}

          {displayError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {displayError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={handleVerify}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#1a1206" />
            ) : (
              <Text style={styles.buttonText}>{t('otp.code.verify')}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: resendSecondsLeft > 0 || busy }}
            disabled={resendSecondsLeft > 0 || busy}
            onPress={handleResend}
            style={styles.linkButton}
          >
            <Text
              style={[
                styles.linkButtonText,
                resendSecondsLeft > 0 && styles.linkButtonTextDisabled,
              ]}
            >
              {resendSecondsLeft > 0
                ? `${t('otp.code.resendIn')} ${formatCountdown(resendSecondsLeft)}`
                : t('otp.code.resend')}
            </Text>
          </Pressable>
        </>
      )}

      {alternative === 'google' ? (
        // WhatsApp delivery is unavailable (quota exhausted) — promote this to
        // the primary action instead of a de-emphasized link.
        <Pressable
          accessibilityRole="button"
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.button,
            styles.fallbackButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{t('otp.useGoogleInstead')}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={handleCancel} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>{t('otp.useGoogleInstead')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const GOLD = '#E4B95B';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0B14',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    color: GOLD,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#B9B4C7',
    fontSize: 15,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#181329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    color: '#F4F1FA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  button: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#1a1206', fontSize: 16, fontWeight: '600' },
  fallbackButton: { marginTop: 16 },
  countdown: { color: '#B9B4C7', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  warning: { color: GOLD, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  linkButton: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  linkButtonText: { color: GOLD, fontSize: 14, fontWeight: '600' },
  linkButtonTextDisabled: { color: MUTED },
});
