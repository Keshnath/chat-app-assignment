import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  senderId!: string;

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;
}
