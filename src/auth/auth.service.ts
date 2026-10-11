import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { templates } from '../notifications/templates.js';
import type { RegisterDto, LoginDto } from './dto/auth.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  private async signToken(user: User): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken };
  }

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    // Confirmacion de registro: no bloquea el alta si el correo falla.
    await this.sendWelcome(user);
    return { user: this.usersService.toPublic(user), ...(await this.signToken(user)) };
  }

  private async sendWelcome(user: User): Promise<void> {
    try {
      await this.notifications.notifyUser(
        user.id,
        NotificationType.REGISTRO,
        templates.bienvenida(user.name, process.env.APP_URL ?? 'http://localhost:3000'),
      );
    } catch (err) {
      this.logger.error(`No se pudo registrar la bienvenida de ${user.email}: ${(err as Error).message}`);
    }
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta esta desactivada; contacta al administrador');
    }
    return { user: this.usersService.toPublic(user), ...(await this.signToken(user)) };
  }
}
