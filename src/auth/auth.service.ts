import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private serializeUser(user: { id: string; name: string; email: string; createdAt: Date; updatedAt: Date; lastActiveAt: Date | null }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActiveAt: user.lastActiveAt,
    };
  }

  private signToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Duplicate email');
    }

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS') ?? 10;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.usersService.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    return {
      success: true,
      data: {
        user: this.serializeUser(user),
        accessToken: this.signToken(user),
      },
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      success: true,
      data: {
        user: this.serializeUser(user),
        accessToken: this.signToken(user),
      },
    };
  }

  async getCurrentUser(user: { id: string; email: string }) {
    const existingUser = await this.usersService.findById(user.id);

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        user: this.serializeUser(existingUser),
      },
    };
  }
}
