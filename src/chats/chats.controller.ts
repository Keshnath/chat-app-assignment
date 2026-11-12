import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { LastSeenDto } from './dto/last-seen.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatsService } from './chats.service';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create or get a direct chat between two users' })
  @ApiBody({ type: CreateDirectChatDto })
  @ApiResponse({ status: 201, description: 'Direct chat created or returned' })
  async createChat(@Body() dto: CreateDirectChatDto, @CurrentUser() user: any) {
    return this.chatsService.createOrGetDirectChat(dto, user.id);
  }

  @Post(':chatId/message/send')
  @ApiOperation({ summary: 'Send a message in a chat' })
  @ApiBody({ type: SendMessageDto })
  @ApiParam({ name: 'chatId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Message stored in Firestore and returned' })
  async sendMessage(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.sendMessage(chatId, dto, user.id);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Retrieve ordered messages for a chat' })
  @ApiParam({ name: 'chatId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Ordered messages returned' })
  async getMessages(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.getMessages(chatId, user.id, query.limit ?? 50);
  }

  @Post(':chatId/message/:messageId/read')
  @ApiOperation({ summary: 'Mark a message as read for the authenticated user' })
  @ApiParam({ name: 'chatId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'messageId', type: 'string' })
  @ApiBody({ type: ReadMessageDto })
  @ApiResponse({ status: 200, description: 'Read receipt stored' })
  async markMessageRead(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReadMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.markMessageRead(chatId, messageId, dto, user.id);
  }

  @Post(':chatId/lastseen')
  @ApiOperation({ summary: 'Update the authenticated user last-seen value for the chat' })
  @ApiParam({ name: 'chatId', type: 'string', format: 'uuid' })
  @ApiBody({ type: LastSeenDto })
  @ApiResponse({ status: 200, description: 'Last seen updated' })
  async updateLastSeen(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: LastSeenDto,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.updateLastSeen(chatId, dto, user.id);
  }
}

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get(':userId/chats')
  @ApiOperation({ summary: 'List all chats for an authenticated user' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User chat list returned' })
  async listChats(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: any) {
    return this.chatsService.listUserChats(userId, user.id);
  }
}
