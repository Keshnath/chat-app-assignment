import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LastSeenDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: 'message-uuid' })
  @IsString()
  @IsNotEmpty()
  messageId!: string;
}
