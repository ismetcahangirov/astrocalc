/** What the user is told when their export finishes. */
export interface ExportReadyNotification {
  userId: string;
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * Boundary for telling the user their export is ready (email / push / WhatsApp).
 * Kept minimal here; wiring it to a real channel is a follow-up once the export
 * flow lands — see the "Remaining work" note on #9.
 */
export interface ExportNotifier {
  notifyReady(notification: ExportReadyNotification): Promise<void>;
}

/** Logs the notification. The link itself is never logged (it is a capability). */
export class LogExportNotifier implements ExportNotifier {
  async notifyReady(notification: ExportReadyNotification): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(
      `[export] bundle ready for user ${notification.userId}; link valid until ` +
        `${notification.expiresAt.toISOString()}`,
    );
  }
}

/** In-memory notifier for tests — records every notification. */
export class InMemoryExportNotifier implements ExportNotifier {
  notifications: ExportReadyNotification[] = [];

  async notifyReady(notification: ExportReadyNotification): Promise<void> {
    this.notifications.push({ ...notification });
  }
}
