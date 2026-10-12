import { randomInt } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { templates } from '../notifications/templates.js';
import type {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';

/** Vida util del codigo enviado por correo. */
export const VERIFICATION_TTL_MINUTES = 15;
/** Intentos fallidos permitidos antes de exigir un codigo nuevo. */
export const VERIFICATION_MAX_ATTEMPTS = 5;
/** Espera minima entre reenvios, para no agotar la cuota diaria del SMTP. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

/** La recuperacion de clave usa las mismas politicas que la verificacion. */
export const PASSWORD_RESET_TTL_MINUTES = 15;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;

/** Login o verificacion completada: hay token. */
export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

/**
 * Resultado del registro. Sin verificacion llega accessToken; con verificacion
 * llega requiresVerification y el token queda pendiente hasta confirmar el codigo.
 */
export interface RegisterResult {
  user: PublicUser;
  accessToken?: string;
  requiresVerification?: boolean;
  verificationExpiresInMinutes?: number;
}

export interface ResendVerificationResult {
  reenviado: boolean;
  mensaje: string;
  verificationExpiresInMinutes?: number;
}

export interface ForgotPasswordResult {
  reenviado: boolean;
  mensaje: string;
  verificationExpiresInMinutes?: number;
}

export interface ResetPasswordResult {
  restablecida: boolean;
  mensaje: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * La verificacion solo se exige si hay forma de entregar el codigo.
   * Con el SMTP apagado exigirla dejaria a todo el mundo sin poder registrarse,
   * asi que se omite (y se avisa por log) en ese caso.
   */
  private get emailVerificationRequired(): boolean {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'false') return false;
    return this.notifications.smtpEnabled;
  }

  private appUrl(): string {
    return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private async signToken(user: User): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken };
  }

  // randomInt reparte de forma uniforme, sin el sesgo del modulo.
  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const user = await this.usersService.create(dto);

    if (!this.emailVerificationRequired) {
      await this.usersService.markEmailVerified(user);
      await this.sendWelcome(user);
      return { user: this.usersService.toPublic(user), ...(await this.signToken(user)) };
    }

    await this.issueVerificationCode(user);
    return {
      user: this.usersService.toPublic(user),
      requiresVerification: true,
      verificationExpiresInMinutes: VERIFICATION_TTL_MINUTES,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Mismo mensaje exista o no el correo, y aunque ya este verificado, para no
    // revelar si una direccion esta registrada.
    if (!user || user.emailVerifiedAt) {
      throw new UnauthorizedException('Verificacion invalida o ya completada');
    }
    if (!user.verificationCodeHash) {
      throw new UnauthorizedException('No hay un codigo pendiente; solicita uno nuevo');
    }
    if (user.verificationExpiresAt && user.verificationExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('El codigo expiro; solicita uno nuevo');
    }
    if ((user.verificationAttempts ?? 0) >= VERIFICATION_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Se supero el numero de intentos; solicita un codigo nuevo');
    }

    const ok = await bcrypt.compare(dto.code, user.verificationCodeHash);
    if (!ok) {
      await this.usersService.bumpVerificationAttempt(user);
      throw new UnauthorizedException('Codigo incorrecto');
    }

    await this.usersService.markEmailVerified(user);
    await this.sendWelcome(user);
    return { user: this.usersService.toPublic(user), ...(await this.signToken(user)) };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<ResendVerificationResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Respuesta neutra: no se revela si el correo existe o ya verifico.
    const neutro = {
      reenviado: false,
      mensaje: 'Si ese correo esta pendiente de verificar, recibiras un codigo en unos minutos.',
    };
    if (!user || user.emailVerifiedAt) return neutro;

    if (user.verificationSentAt) {
      const esperaMs = VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000;
      const transcurrido = Date.now() - user.verificationSentAt.getTime();
      if (transcurrido < esperaMs) {
        const faltan = Math.ceil((esperaMs - transcurrido) / 1000);
        return {
          reenviado: false,
          mensaje: `Espera ${faltan} segundos antes de pedir otro codigo.`,
        };
      }
    }

    await this.issueVerificationCode(user);
    return {
      reenviado: true,
      mensaje: 'Si ese correo esta pendiente de verificar, recibiras un codigo en unos minutos.',
      verificationExpiresInMinutes: VERIFICATION_TTL_MINUTES,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Respuesta neutra: no se revela si el correo existe. Es deliberadamente la
    // misma que reenviar verificacion, para no distinguirlos por la respuesta.
    const neutro: ForgotPasswordResult = {
      reenviado: false,
      mensaje: 'Si ese correo tiene una cuenta, recibiras un codigo para elegir una contrasena nueva.',
    };
    if (!user) return neutro;

    if (user.passwordResetSentAt) {
      const esperaMs = PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000;
      const transcurrido = Date.now() - user.passwordResetSentAt.getTime();
      if (transcurrido < esperaMs) {
        const faltan = Math.ceil((esperaMs - transcurrido) / 1000);
        return {
          reenviado: false,
          mensaje: `Espera ${faltan} segundos antes de pedir otro codigo.`,
        };
      }
    }

    await this.issuePasswordResetCode(user);
    return { ...neutro, reenviado: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResult> {
    const user = await this.usersService.findByEmail(dto.email);

    // Mismo mensaje exista o no el correo, para no filtrar registros.
    if (!user || !user.passwordResetCodeHash) {
      throw new UnauthorizedException('Restablecimiento invalido; solicita un codigo nuevo');
    }
    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('El codigo expiro; solicita uno nuevo');
    }
    if ((user.passwordResetAttempts ?? 0) >= PASSWORD_RESET_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Se supero el numero de intentos; solicita un codigo nuevo');
    }

    const ok = await bcrypt.compare(dto.code, user.passwordResetCodeHash);
    if (!ok) {
      await this.usersService.bumpPasswordResetAttempt(user);
      throw new UnauthorizedException('Codigo incorrecto');
    }

    await this.usersService.resetPassword(user, dto.password);
    // Aviso de cortesia: no bloquea el restablecimiento si el correo falla.
    await this.sendPasswordChanged(user);
    return {
      restablecida: true,
      mensaje: 'Contrasena actualizada. Inicia sesion con la nueva clave.',
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta esta desactivada; contacta al administrador');
    }
    // 403 y no 401: la contrasena era correcta, lo que falta es confirmar el
    // correo. Que el codigo de estado lo distinga permite redirigir al formulario
    // de verificacion sin tener que parsear el mensaje.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Tu correo aun no esta verificado; revisa tu bandeja de entrada');
    }
    return { user: this.usersService.toPublic(user), ...(await this.signToken(user)) };
  }

  private async issueVerificationCode(user: User): Promise<void> {
    const code = this.generateCode();
    try {
      await this.usersService.setVerificationCode(user, code, VERIFICATION_TTL_MINUTES);
      await this.notifications.notifyUser(
        user.id,
        NotificationType.VERIFICACION,
        templates.verificacionCodigo(user.name, code, VERIFICATION_TTL_MINUTES),
        { referenceType: 'user', referenceId: user.id },
      );
    } catch (err) {
      // El alta ya ocurrio: el usuario puede pedir un reenvio, asi que no se
      // revierte la cuenta ni se propaga el error.
      this.logger.error(
        `No se pudo enviar el codigo de verificacion a ${user.email}: ${(err as Error).message}`,
      );
    }
  }

  private async issuePasswordResetCode(user: User): Promise<void> {
    const code = this.generateCode();
    try {
      await this.usersService.setPasswordResetCode(user, code, PASSWORD_RESET_TTL_MINUTES);
      await this.notifications.notifyUser(
        user.id,
        NotificationType.SISTEMA,
        templates.recuperacionClave(user.name, code, PASSWORD_RESET_TTL_MINUTES),
        { referenceType: 'user', referenceId: user.id },
      );
    } catch (err) {
      // El codigo se guardo igual: el usuario puede pedir otro si no le llego.
      this.logger.error(
        `No se pudo enviar el codigo de recuperacion a ${user.email}: ${(err as Error).message}`,
      );
    }
  }

  private async sendPasswordChanged(user: User): Promise<void> {
    try {
      await this.notifications.notifyUser(
        user.id,
        NotificationType.SISTEMA,
        templates.claveCambiada(user.name, this.appUrl()),
        { referenceType: 'user', referenceId: user.id },
      );
    } catch (err) {
      this.logger.error(
        `No se pudo avisar el cambio de clave de ${user.email}: ${(err as Error).message}`,
      );
    }
  }

  private async sendWelcome(user: User): Promise<void> {
    try {
      await this.notifications.notifyUser(
        user.id,
        NotificationType.REGISTRO,
        templates.bienvenida(user.name, this.appUrl()),
      );
    } catch (err) {
      this.logger.error(`No se pudo registrar la bienvenida de ${user.email}: ${(err as Error).message}`);
    }
  }
}
