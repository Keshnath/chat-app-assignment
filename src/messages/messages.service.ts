import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firebase/firebase.service';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService,
  ) {}

  private serializeMessage(data: Record<string, any>) {
    const createdAt = this.firebaseService.normalizeTimestamp(data.createdAt);
    const updatedAt = this.firebaseService.normalizeTimestamp(data.updatedAt);

    return {
      id: data.id ?? data.messageId,
      chatId: data.chatId,
      senderId: data.senderId,
      text: data.text,
      createdAt,
      updatedAt,
      edited: !!data.edited,
      deleted: !!data.deleted,
      sequence: Number(data.sequence ?? 0),
    };
  }

  async allocateSequence(chatId: string): Promise<number> {
    const counterRef = this.firebaseService.getChatMetadataCounterRef(chatId);
    let nextValue = 1;

    await this.firebaseService.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      const currentValue = snapshot.exists
        ? Number(snapshot.data()?.value ?? 0)
        : 0;
      nextValue = currentValue + 1;

      transaction.set(
        counterRef,
        {
          value: nextValue,
          updatedAt: FieldValue.serverTimestamp(), // Fixed
        },
        { merge: true },
      );
    });

    return nextValue;
  }

  async createMessage(chatId: string, senderId: string, text: string) {
    const messageId = randomUUID();
    const sequence = await this.allocateSequence(chatId);
    const messageRef = this.firebaseService.getChatMessageRef(
      chatId,
      messageId,
    );
    const firestoreAny = admin as any;
    const payload = {
      id: messageId,
      chatId,
      senderId,
      text,
      createdAt: FieldValue.serverTimestamp(), // Fixed
      updatedAt: FieldValue.serverTimestamp(), // Fixed
      edited: false,
      deleted: false,
      sequence,
    };

    await messageRef.set(payload, { merge: true });

    const snapshot = await messageRef.get();
    if (!snapshot.exists) {
      throw new InternalServerErrorException('Message could not be saved');
    }

    return this.serializeMessage({
      id: snapshot.id,
      ...snapshot.data(),
    });
  }

  async getMessage(chatId: string, messageId: string) {
    const snapshot = await this.firebaseService
      .getChatMessageRef(chatId, messageId)
      .get();

    if (!snapshot.exists) {
      throw new NotFoundException('Message not found');
    }

    return this.serializeMessage({
      id: snapshot.id,
      ...snapshot.data(),
    });
  }

  async getMessages(chatId: string, limit: number) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);
    const query = this.firebaseService
      .getChatMessagesRef(chatId)
      .orderBy('createdAt')
      .orderBy('sequence')
      .limit(normalizedLimit);

    const snapshot = await query.get();
    const messages = snapshot.docs.map((doc) =>
      this.serializeMessage({ id: doc.id, ...doc.data() }),
    );

    return {
      messages,
      nextCursor:
        snapshot.docs.length === normalizedLimit
          ? snapshot.docs[snapshot.docs.length - 1].id
          : null,
      hasMore: snapshot.docs.length === normalizedLimit,
    };
  }

  async updateLastSeen(chatId: string, userId: string, messageId: string) {
    const existingMessage = await this.getMessage(chatId, messageId);
    const lastSeenRef = this.firebaseService.getChatLastSeenRef(chatId, userId);

    const result = await this.firebaseService.firestore.runTransaction(
      async (transaction) => {
        const lastSeenSnapshot = await transaction.get(lastSeenRef);
        const currentData = lastSeenSnapshot.data();
        const currentSequence = currentData?.sequence ?? 0;

        if (currentData && currentSequence > existingMessage.sequence) {
          throw new BadRequestException('Last seen cannot move backwards');
        }

        const firestoreAny = admin as any;

        transaction.set(
          lastSeenRef,
          {
            chatId,
            userId,
            messageId,
            sequence: existingMessage.sequence,
            lastSeenAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        return {
          chatId,
          userId,
          messageId,
          sequence: existingMessage.sequence,
        };
      },
    );

    const snapshot = await lastSeenRef.get();
    const data = snapshot.data() ?? {};

    return {
      ...result,
      lastSeenAt: this.firebaseService.normalizeTimestamp(data.lastSeenAt),
    };
  }
}
