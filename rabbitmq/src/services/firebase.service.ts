import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readBoolean } from '../common/configuration';
import { PermanentEventError } from '../common/event-validation';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-recipient',
  'messaging/mismatched-credential',
  'messaging/invalid-argument',
]);

const PERMANENT_CONFIGURATION_CODES = new Set([
  'messaging/authentication-error',
  'messaging/invalid-apns-credentials',
  'messaging/third-party-auth-error',
]);

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = readBoolean(this.config.get('FIREBASE_ENABLED'), true, 'FIREBASE_ENABLED');
  }

  onModuleInit(): void {
    if (!this.enabled || getApps().length > 0) return;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase credentials are required when FIREBASE_ENABLED is not false');
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    this.logger.log('Firebase Admin SDK initialized');
  }

  async sendToDevice(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<string[]> {
    const validTokens = [
      ...new Set(
        tokens.filter(
          (token) => typeof token === 'string' && token.length > 0 && token.length <= 4_096
        )
      ),
    ];
    if (validTokens.length === 0) return [];
    if (!this.enabled) return [];
    if (getApps().length === 0) throw new Error('Firebase Admin SDK is not initialized');

    const invalidTokens: string[] = [];
    let successCount = 0;
    let pendingTokens = validTokens;

    for (let attempt = 1; attempt <= 3 && pendingTokens.length > 0; attempt += 1) {
      const transientFailures: string[] = [];
      let permanentConfigurationError: string | undefined;
      for (let start = 0; start < pendingTokens.length; start += 500) {
        const tokenBatch = pendingTokens.slice(start, start + 500);
        const response = await getMessaging()
          .sendEachForMulticast({
            tokens: tokenBatch,
            notification: { title: title.slice(0, 160), body: body.slice(0, 1_000) },
            data: Object.fromEntries(
              Object.entries(data).map(([key, value]) => [
                key.slice(0, 128),
                String(value).slice(0, 2_048),
              ])
            ),
            android: {
              priority: 'high',
              notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
            },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          })
          .catch((error: unknown) => {
            const errorCode = this.firebaseErrorCode(error);
            if (PERMANENT_CONFIGURATION_CODES.has(errorCode)) {
              throw new PermanentEventError(`FCM configuration rejected delivery (${errorCode})`);
            }
            throw error;
          });

        successCount += response.successCount;
        response.responses.forEach((result, index) => {
          if (result.success) return;
          const token = tokenBatch[index];
          const errorCode = result.error?.code || '';
          if (INVALID_TOKEN_CODES.has(errorCode)) invalidTokens.push(token);
          else if (PERMANENT_CONFIGURATION_CODES.has(errorCode)) {
            permanentConfigurationError = errorCode;
          } else transientFailures.push(token);
        });
      }
      if (permanentConfigurationError) {
        throw new PermanentEventError(
          `FCM configuration rejected delivery (${permanentConfigurationError})`
        );
      }
      pendingTokens = transientFailures;
      if (pendingTokens.length > 0 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }

    this.logger.log(
      `FCM batch completed: ${successCount} success, ${invalidTokens.length} invalid, ${pendingTokens.length} transient failures`
    );
    if (invalidTokens.length > 0) {
      this.logger.warn(`Detected ${invalidTokens.length} invalid FCM token(s)`);
    }
    if (pendingTokens.length > 0) {
      throw new Error(`FCM delivery failed transiently for ${pendingTokens.length} token(s)`);
    }
    return invalidTokens;
  }

  private firebaseErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error)) return '';
    return typeof error.code === 'string' ? error.code : '';
  }
}
