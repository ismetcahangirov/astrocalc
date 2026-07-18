import { WhatsAppQuotaExceededError, WhatsAppSendError } from './errors';

export interface WhatsAppSendInput {
  /** Recipient in E.164 (no leading `+` is required by Meta, but it accepts it). */
  to: string;
  code: string;
}

export interface WhatsAppSendResult {
  messageId: string;
}

/** Sends the pre-approved OTP template message via WhatsApp. */
export interface WhatsAppSender {
  sendOtp(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
}

/**
 * Meta error codes that mean "you've hit a messaging/conversation limit" rather
 * than a transient or template error. When we see one of these we treat the
 * WhatsApp channel as unavailable and steer the user to Google.
 * See https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
const QUOTA_ERROR_CODES = new Set([4, 80007, 130429, 131048, 131049, 131056]);

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  /** Pre-approved authentication template name. */
  templateName: string;
  /** Template language, e.g. `en_US`. */
  templateLocale: string;
  /** Graph API version, e.g. `v21.0`. */
  apiVersion: string;
  /** Overridable for tests; defaults to the public Graph host. */
  graphBaseUrl?: string;
  /** Overridable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/**
 * Production {@link WhatsAppSender} backed by the Meta WhatsApp Business Cloud
 * API. Sends an *authentication* template with the OTP as the body parameter and
 * as the copy-code button parameter (Meta's required shape for auth templates).
 * Classifies quota/rate-limit failures into {@link WhatsAppQuotaExceededError}
 * so the caller can alert the admin panel and offer the Google alternative.
 */
export function createMetaWhatsAppSender(config: MetaWhatsAppConfig): WhatsAppSender {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.graphBaseUrl ?? 'https://graph.facebook.com';

  return {
    async sendOtp({ to, code }: WhatsAppSendInput): Promise<WhatsAppSendResult> {
      const url = `${baseUrl}/${config.apiVersion}/${config.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: config.templateLocale },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      };

      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        // Deliberately does NOT include the code in the message.
        const detail = err instanceof Error ? err.message : 'network error';
        throw new WhatsAppSendError(`Could not reach WhatsApp: ${detail}`);
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as MetaErrorBody | null;
        const metaCode = body?.error?.code;
        if (metaCode !== undefined && QUOTA_ERROR_CODES.has(metaCode)) {
          throw new WhatsAppQuotaExceededError();
        }
        const detail = body?.error?.message ?? `HTTP ${res.status}`;
        throw new WhatsAppSendError(`WhatsApp send failed: ${detail}`);
      }

      const ok = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
      return { messageId: ok?.messages?.[0]?.id ?? 'unknown' };
    },
  };
}

/** In-memory sender for tests. `mode` drives success / quota / generic failure. */
export class FakeWhatsAppSender implements WhatsAppSender {
  sent: WhatsAppSendInput[] = [];
  mode: 'ok' | 'quota' | 'error' = 'ok';

  async sendOtp(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    if (this.mode === 'quota') throw new WhatsAppQuotaExceededError();
    if (this.mode === 'error') throw new WhatsAppSendError('simulated send failure');
    this.sent.push({ ...input });
    return { messageId: `fake-${this.sent.length}` };
  }
}
