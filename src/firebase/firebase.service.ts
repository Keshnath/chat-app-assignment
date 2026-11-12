import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firestoreInstance: Firestore | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize(): void {
    const firebaseAdmin = admin as any;

    if (getApps().length > 0) {
      this.firestoreInstance = getFirestore(getApp());
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      const sanitizedKey = privateKey
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '');

      const app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: sanitizedKey,
        }),
      });
      this.firestoreInstance = getFirestore(app);
    } else {
      this.logger.error('Firebase Admin credentials are empty or incomplete.');
    }
  }

  get firestore(): Firestore {
    if (!this.firestoreInstance) {
      throw new InternalServerErrorException(
        'Firebase Firestore is not configured',
      );
    }
    return this.firestoreInstance;
  }

  getChatMessagesRef(chatId: string) {
    return this.firestore.collection(`chats/${chatId}/messages`);
  }

  getChatReadReceiptsRef(chatId: string) {
    return this.firestore.collection(`chats/${chatId}/readReceipts`);
  }

  getChatLastSeenRef(chatId: string, userId: string) {
    return this.firestore.collection(`chats/${chatId}/lastSeen`).doc(userId);
  }

  getChatMetadataCounterRef(chatId: string) {
    return this.firestore
      .collection(`chats/${chatId}/metadata`)
      .doc('messageCounter');
  }

  getChatMessageRef(chatId: string, messageId: string) {
    return this.firestore.collection(`chats/${chatId}/messages`).doc(messageId);
  }

  getReadReceiptRef(chatId: string, messageId: string, userId: string) {
    return this.firestore
      .collection(`chats/${chatId}/readReceipts`)
      .doc(`${messageId}_${userId}`);
  }

  normalizeTimestamp(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    ) {
      return value.toDate().toISOString();
    }

    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const seconds = Number((value as { seconds: number }).seconds);
      const nanoseconds = Number(
        (value as { nanoseconds?: number }).nanoseconds ?? 0,
      );
      return new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
    }

    return String(value);
  }
}
