import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private logger = new Logger('FirebaseService');

    onModuleInit() {
        if (admin.apps.length === 0) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
            });
            this.logger.log('Firebase Admin SDK initialized');
        }
    }

    /**
     * Send FCM notification to multiple device tokens
     */
    async sendToDevice(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<void> {
        if (!tokens || tokens.length === 0) {
            this.logger.warn('No FCM tokens provided');
            return;
        }

        const message: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title,
                body,
            },
            data: data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            this.logger.log(
                `FCM sent: ${response.successCount} success, ${response.failureCount} failed`,
            );

            // Log failed tokens for debugging
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        this.logger.warn(
                            `Failed to send to token ${tokens[idx]}: ${resp.error?.message}`,
                        );
                    }
                });
            }
        } catch (error) {
            this.logger.error('FCM send error:', error);
            throw error;
        }
    }
}
