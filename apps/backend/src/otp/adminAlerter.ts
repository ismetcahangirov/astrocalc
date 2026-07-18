/** A quota-exhaustion event worth surfacing to the admin panel / monitoring. */
export interface QuotaAlert {
  channel: 'whatsapp';
  at: Date;
  detail?: string;
}

/**
 * Abuse-protection signals worth surfacing to the admin panel (#10): a caller
 * tripped a rate limit or the account lockout. `identifier` is a masked phone
 * (see `maskPhone`) or a raw IP — never a full phone number or OTP code.
 */
export interface AnomalyAlert {
  kind: 'otp_phone_rate_limited' | 'otp_ip_rate_limited' | 'otp_account_locked';
  at: Date;
  identifier: string;
  detail?: string;
}

/**
 * Sink for operational alerts. The admin panel is a separate epic; this boundary
 * lets the OTP service raise the alert now and be wired to real infrastructure
 * (DB row, webhook, paging) later without changing call sites.
 */
export interface AdminAlerter {
  quotaExhausted(alert: QuotaAlert): Promise<void>;
  anomalousActivity(alert: AnomalyAlert): Promise<void>;
}

/**
 * Default alerter: emits a single structured, machine-parseable log line that an
 * admin dashboard or log-based monitor can pick up. Intentionally does not
 * include any OTP code or PII beyond a masked identifier.
 */
export function createLoggingAdminAlerter(): AdminAlerter {
  return {
    async quotaExhausted(alert: QuotaAlert): Promise<void> {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          type: 'admin_alert',
          kind: 'whatsapp_quota_exhausted',
          channel: alert.channel,
          at: alert.at.toISOString(),
          detail: alert.detail,
        }),
      );
    },

    async anomalousActivity(alert: AnomalyAlert): Promise<void> {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          type: 'admin_alert',
          kind: alert.kind,
          identifier: alert.identifier,
          at: alert.at.toISOString(),
          detail: alert.detail,
        }),
      );
    },
  };
}

/** Records alerts in memory for assertions in tests. */
export class RecordingAdminAlerter implements AdminAlerter {
  alerts: QuotaAlert[] = [];
  anomalies: AnomalyAlert[] = [];

  async quotaExhausted(alert: QuotaAlert): Promise<void> {
    this.alerts.push(alert);
  }

  async anomalousActivity(alert: AnomalyAlert): Promise<void> {
    this.anomalies.push(alert);
  }
}
