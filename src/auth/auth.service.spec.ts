import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService, VERIFICATION_MAX_ATTEMPTS, PASSWORD_RESET_MAX_ATTEMPTS } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UserRole } from '../users/entities/user.entity.js';

type UsersMock = {
  create: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
  toPublic: ReturnType<typeof vi.fn>;
  setVerificationCode: ReturnType<typeof vi.fn>;
  markEmailVerified: ReturnType<typeof vi.fn>;
  bumpVerificationAttempt: ReturnType<typeof vi.fn>;
  setPasswordResetCode: ReturnType<typeof vi.fn>;
  bumpPasswordResetAttempt: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersMock;
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let notifications: {
    notifyUser: ReturnType<typeof vi.fn>;
    smtpEnabled: boolean;
  };

  const baseUser = (extra: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'lucia@test.com',
    role: UserRole.ENTREPRENEUR,
    passwordHash: 'hash',
    isActive: true,
    emailVerifiedAt: new Date(),
    verificationAttempts: 0,
    ...extra,
  });

  beforeEach(async () => {
    // Por defecto el SMTP esta apagado: la verificacion se omite.
    notifications = { notifyUser: vi.fn(async () => null), smtpEnabled: false };
    usersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      toPublic: vi.fn((u: { email: string; role: UserRole }) => ({
        email: u.email,
        role: u.role,
      })),
      setVerificationCode: vi.fn(async () => undefined),
      markEmailVerified: vi.fn(async () => undefined),
      bumpVerificationAttempt: vi.fn(async () => undefined),
      setPasswordResetCode: vi.fn(async () => undefined),
      bumpPasswordResetAttempt: vi.fn(async () => undefined),
      resetPassword: vi.fn(async () => undefined),
    };
    jwt = { signAsync: vi.fn(async () => 'signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwt },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('registro', () => {
    it('registra delegando en UsersService y emite token', async () => {
      usersService.create.mockResolvedValue(baseUser());

      const result = await service.register({
        email: 'lucia@test.com',
        password: 'secret123',
        name: 'Lucia',
        role: UserRole.ENTREPRENEUR,
      });

      expect(result.user).toEqual({ email: 'lucia@test.com', role: UserRole.ENTREPRENEUR });
      expect(result.accessToken).toBe('signed-token');
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'lucia@test.com',
        password: 'secret123',
        name: 'Lucia',
        role: UserRole.ENTREPRENEUR,
      });
    });

    it('sin SMTP no exige verificacion y da token de inmediato', async () => {
      usersService.create.mockResolvedValue(baseUser({ emailVerifiedAt: null }));

      const result = await service.register({
        email: 'lucia@test.com',
        password: 'secret123',
        name: 'Lucia',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result).not.toHaveProperty('requiresVerification');
      expect(usersService.markEmailVerified).toHaveBeenCalled();
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });

    it('con SMTP activo guarda codigo y no entrega token', async () => {
      notifications.smtpEnabled = true;
      usersService.create.mockResolvedValue(baseUser({ emailVerifiedAt: null }));

      const result = await service.register({
        email: 'lucia@test.com',
        password: 'secret123',
        name: 'Lucia',
      });

      expect(result.requiresVerification).toBe(true);
      expect(result).not.toHaveProperty('accessToken');
      expect(usersService.setVerificationCode).toHaveBeenCalledTimes(1);

      // El codigo enviado es de 6 digitos y viaja hasheado, no en claro.
      const [user, code] = usersService.setVerificationCode.mock.calls[0];
      expect(code).toMatch(/^\d{6}$/);
      expect(user.verificationCodeHash).not.toBe(code);
      expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    });

    it('con REQUIRE_EMAIL_VERIFICATION=false se salta la verificacion aunque haya SMTP', async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
      notifications.smtpEnabled = true;
      usersService.create.mockResolvedValue(baseUser({ emailVerifiedAt: null }));

      const result = await service.register({
        email: 'lucia@test.com',
        password: 'secret123',
        name: 'Lucia',
      });

      expect(result.accessToken).toBe('signed-token');
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    });
  });

  describe('verificacion de correo', () => {
    const pendingUser = (extra: Record<string, unknown> = {}) =>
      baseUser({
        emailVerifiedAt: null,
        verificationCodeHash: 'x',
        verificationExpiresAt: new Date(Date.now() + 10 * 60_000),
        verificationAttempts: 0,
        ...extra,
      });

    it('acepta el codigo correcto y entrega token', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(pendingUser({ verificationCodeHash: hash }));

      const result = await service.verifyEmail({ email: 'lucia@test.com', code: '482913' });

      expect(result.accessToken).toBe('signed-token');
      expect(usersService.markEmailVerified).toHaveBeenCalled();
      expect(usersService.bumpVerificationAttempt).not.toHaveBeenCalled();
    });

    it('rechaza un codigo incorrecto y contabiliza el intento', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(pendingUser({ verificationCodeHash: hash }));

      await expect(
        service.verifyEmail({ email: 'lucia@test.com', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.bumpVerificationAttempt).toHaveBeenCalled();
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });

    it('rechaza un codigo expirado', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(
        pendingUser({
          verificationCodeHash: hash,
          verificationExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.verifyEmail({ email: 'lucia@test.com', code: '482913' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('corta la fuerza bruta al agotar los intentos', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(
        pendingUser({
          verificationCodeHash: hash,
          verificationAttempts: VERIFICATION_MAX_ATTEMPTS,
        }),
      );

      await expect(
        service.verifyEmail({ email: 'lucia@test.com', code: '482913' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });

    it('no revela si el correo ya estaba verificado o no existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ email: 'nadien@existe.com', code: '482913' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('respeta la espera entre reenvios', async () => {
      usersService.findByEmail.mockResolvedValue(
        pendingUser({ verificationSentAt: new Date(Date.now() - 5_000) }),
      );

      const result = await service.resendVerification({ email: 'lucia@test.com' });

      expect(result.reenviado).toBe(false);
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });

    it('genera un codigo nuevo cuando ya paso la espera', async () => {
      usersService.findByEmail.mockResolvedValue(
        pendingUser({ verificationSentAt: new Date(Date.now() - 5 * 60_000) }),
      );

      const result = await service.resendVerification({ email: 'lucia@test.com' });

      expect(result.reenviado).toBe(true);
      expect(usersService.setVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('responde de forma neutra si el correo no existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({ email: 'nadien@existe.com' });

      expect(result.reenviado).toBe(false);
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('recuperacion de contrasena', () => {
    const pendingReset = (extra: Record<string, unknown> = {}) =>
      baseUser({
        passwordResetCodeHash: 'x',
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60_000),
        passwordResetSentAt: new Date(Date.now() - 5 * 60_000),
        passwordResetAttempts: 0,
        ...extra,
      });

    it('pide codigo sin revelar si el correo existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nadie@noexiste.com' });

      expect(result.reenviado).toBe(false);
      expect(usersService.setPasswordResetCode).not.toHaveBeenCalled();
    });

    it('genera un codigo para una cuenta existente', async () => {
      usersService.findByEmail.mockResolvedValue(pendingReset());

      const result = await service.forgotPassword({ email: 'lucia@test.com' });

      expect(result.reenviado).toBe(true);
      expect(usersService.setPasswordResetCode).toHaveBeenCalledTimes(1);

      const [user, code] = usersService.setPasswordResetCode.mock.calls[0];
      expect(code).toMatch(/^\d{6}$/);
      expect(user.passwordResetCodeHash).not.toBe(code);
    });

    it('respeta la espera entre solicitudes', async () => {
      usersService.findByEmail.mockResolvedValue(
        pendingReset({ passwordResetSentAt: new Date(Date.now() - 3_000) }),
      );

      const result = await service.forgotPassword({ email: 'lucia@test.com' });

      expect(result.reenviado).toBe(false);
      expect(usersService.setPasswordResetCode).not.toHaveBeenCalled();
    });

    it('no invalida un codigo de verificacion pendiente', async () => {
      usersService.findByEmail.mockResolvedValue(pendingReset());

      await service.forgotPassword({ email: 'lucia@test.com' });

      // Cada flujo guarda en su propio campo.
      expect(usersService.setVerificationCode).not.toHaveBeenCalled();
      expect(usersService.setPasswordResetCode).toHaveBeenCalled();
    });

    it('cambia la clave con el codigo correcto', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(pendingReset({ passwordResetCodeHash: hash }));

      const result = await service.resetPassword({
        email: 'lucia@test.com',
        code: '482913',
        password: 'NuevaClave123',
      });

      expect(result.restablecida).toBe(true);
      expect(usersService.resetPassword).toHaveBeenCalledWith(expect.anything(), 'NuevaClave123');
    });

    it('rechaza un codigo incorrecto y contabiliza el intento', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(pendingReset({ passwordResetCodeHash: hash }));

      await expect(
        service.resetPassword({ email: 'lucia@test.com', code: '000000', password: 'NuevaClave123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.bumpPasswordResetAttempt).toHaveBeenCalled();
      expect(usersService.resetPassword).not.toHaveBeenCalled();
    });

    it('rechaza un codigo expirado', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(
        pendingReset({
          passwordResetCodeHash: hash,
          passwordResetExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.resetPassword({ email: 'lucia@test.com', code: '482913', password: 'NuevaClave123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('corta la fuerza bruta al agotar los intentos', async () => {
      const hash = await bcrypt.hash('482913', 10);
      usersService.findByEmail.mockResolvedValue(
        pendingReset({
          passwordResetCodeHash: hash,
          passwordResetAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
        }),
      );

      await expect(
        service.resetPassword({ email: 'lucia@test.com', code: '482913', password: 'NuevaClave123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('hace login con credenciales validas', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser(),
        email: 'a@b.com',
        passwordHash: await bcrypt.hash('secret123', 10),
      });

      const result = await service.login({ email: 'a@b.com', password: 'secret123' });
      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe('a@b.com');
    });

    it('rechaza login de una cuenta desactivada por el admin', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser(),
        isActive: false,
        passwordHash: await bcrypt.hash('secret123', 10),
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'secret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza el login si el correo aun no esta verificado', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser(),
        emailVerifiedAt: null,
        passwordHash: await bcrypt.hash('secret123', 10),
      });

      // 403 y no 401: la contrasena era correcta.
      await expect(
        service.login({ email: 'a@b.com', password: 'secret123' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza login con contrasena incorrecta', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser(),
        passwordHash: await bcrypt.hash('secret123', 10),
      });

      await expect(service.login({ email: 'a@b.com', password: 'otra' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza login con usuario inexistente', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'no@existe.com', password: 'x12345678' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
