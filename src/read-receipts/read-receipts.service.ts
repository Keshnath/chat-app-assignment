import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class ReadReceiptsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async markRead(chatId: string, messageId: string, userId: string) {
    const readReceiptRef = this.firebaseService.getReadReceiptRef(chatId, messageId, userId);
    const existing = await readReceiptRef.get();

    if (existing.exists) {
      const data = existing.data() ?? {};
      return {
        messageId,
        userId,
        readAt: this.firebaseService.normalizeTimestamp(data.readAt),
      };
    }

    const firestoreAny = admin as any;
    await readReceiptRef.set(
      {
        messageId,
        userId,
        chatId,
        readAt: firestoreAny.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const saved = await readReceiptRef.get();
    const savedData = saved.data() ?? {};

    if (!saved.exists) {
      throw new InternalServerErrorException('Read receipt could not be saved');
    }

    return {
      messageId,
      userId,
      readAt: this.firebaseService.normalizeTimestamp(savedData.readAt),
    };
  }
}
