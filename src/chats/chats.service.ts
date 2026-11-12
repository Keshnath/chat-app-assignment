import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MessagesService } from '../messages/messages.service';
import { ReadReceiptsService } from '../read-receipts/read-receipts.service';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly readReceiptsService: ReadReceiptsService,
    private readonly configService: ConfigService,
  ) {}

  async ensureChatExists(chatId: string): Promise<any> {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  async ensureUserIsMember(chatId: string, userId: string) {
    const member = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
    });

    if (!member) {
      throw new ForbiddenException('User is not a chat member');
    }

    return member;
  }

  async createOrGetDirectChat(dto: { userAId: string; userBId: string }, currentUserId: string) {
    if (dto.userAId !== currentUserId) {
      throw new ForbiddenException('userAId must match the authenticated user');
    }

    if (dto.userAId === dto.userBId) {
      throw new BadRequestException('Users cannot chat with themselves');
    }

    await this.usersService.ensureExists(dto.userAId);
    await this.usersService.ensureExists(dto.userBId);

    const sortedIds = [dto.userAId, dto.userBId].sort();
    const directKey = `${sortedIds[0]}_${sortedIds[1]}`;

    try {
      const existingChat = await this.prisma.chat.findUnique({ where: { directKey } });
      if (existingChat) {
        return { success: true, data: { chatId: existingChat.id } };
      }

      const createdChat = await this.prisma.$transaction(async (transaction: any) => {
        const chat = await transaction.chat.findUnique({ where: { directKey } });

        if (chat) {
          return chat;
        }

        return transaction.chat.create({
          data: {
            type: 'DIRECT',
            directKey,
            members: {
              create: [{ userId: dto.userAId }, { userId: dto.userBId }],
            },
          },
        });
      });

      return { success: true, data: { chatId: createdChat.id } };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingChat = await this.prisma.chat.findUnique({ where: { directKey } });
        if (existingChat) {
          return { success: true, data: { chatId: existingChat.id } };
        }
      }

      throw error;
    }
  }

  async sendMessage(chatId: string, dto: { senderId: string; text: string }, currentUserId: string) {
    const chat = await this.ensureChatExists(chatId);

    if (dto.senderId !== currentUserId) {
      throw new ForbiddenException('senderId must match the authenticated user');
    }

    await this.ensureUserIsMember(chat.id, dto.senderId);

    const trimmedText = dto.text.trim();
    if (!trimmedText) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const maxMessageLength = this.configService.get<number>('MAX_MESSAGE_LENGTH') ?? 5000;
    if (trimmedText.length > maxMessageLength) {
      throw new BadRequestException(`Message exceeds the maximum length of ${maxMessageLength} characters`);
    }

    const message = await this.messagesService.createMessage(chat.id, dto.senderId, trimmedText);

    try {
      await this.prisma.chat.update({
        where: { id: chat.id },
        data: { lastMessageAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`PostgreSQL synchronization failed after Firestore message save for chat ${chat.id}: ${String(error)}`);
    }

    return { success: true, data: message };
  }

  async getMessages(chatId: string, currentUserId: string, limit: number) {
    await this.ensureChatExists(chatId);
    await this.ensureUserIsMember(chatId, currentUserId);

    const nextLimit = Math.min(Math.max(limit ?? 50, 1), 100);
    const messages = await this.messagesService.getMessages(chatId, nextLimit);

    return {
      success: true,
      data: {
        messages: messages.messages,
        nextCursor: messages.nextCursor,
        hasMore: messages.hasMore,
      },
    };
  }

  async markMessageRead(chatId: string, messageId: string, dto: { userId: string }, currentUserId: string) {
    await this.ensureChatExists(chatId);

    if (dto.userId !== currentUserId) {
      throw new ForbiddenException('userId must match the authenticated user');
    }

    await this.ensureUserIsMember(chatId, dto.userId);
    const message = await this.messagesService.getMessage(chatId, messageId);

    if (message.chatId !== chatId) {
      throw new NotFoundException('Message not found in the specified chat');
    }

    const readReceipt = await this.readReceiptsService.markRead(chatId, messageId, dto.userId);

    return {
      success: true,
      data: readReceipt,
    };
  }

  async updateLastSeen(chatId: string, dto: { userId: string; messageId: string }, currentUserId: string) {
    await this.ensureChatExists(chatId);

    if (dto.userId !== currentUserId) {
      throw new ForbiddenException('userId must match the authenticated user');
    }

    await this.ensureUserIsMember(chatId, dto.userId);
    await this.messagesService.getMessage(chatId, dto.messageId);

    const lastSeen = await this.messagesService.updateLastSeen(chatId, dto.userId, dto.messageId);

    return {
      success: true,
      data: lastSeen,
    };
  }

  async listUserChats(userId: string, currentUserId: string) {
    if (userId !== currentUserId) {
      throw new ForbiddenException('userId must match the authenticated user');
    }

    await this.usersService.ensureExists(userId);

    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        type: true,
        lastMessageAt: true,
        members: {
          select: { userId: true },
        },
      },
    });

    return {
      success: true,
      data: {
        chats: chats.map((chat: any) => ({
          chatId: chat.id,
          type: chat.type,
          memberIds: chat.members.map((member: any) => member.userId),
          lastMessageAt: chat.lastMessageAt,
        })),
      },
    };
  }
}
