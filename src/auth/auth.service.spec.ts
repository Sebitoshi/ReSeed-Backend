import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { UserRole } from '../users/entities/user.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    toPublic: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      toPublic: vi.fn((u: { email: string; role: UserRole }) => ({
        email: u.email,
        role: u.role,
      })),
    };
    jwt = { signAsync: vi.fn(async () => 'signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('registra delegando en UsersService y emite token', async () => {
    usersService.create.mockResolvedValue({
      id: 'u1',
      email: 'lucia@test.com',
      role: UserRole.ENTREPRENEUR,
      passwordHash: 'hash',
    });

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

  it('hace login con credenciales validas', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: UserRole.BUYER,
      passwordHash: await bcrypt.hash('secret123', 10),
    });

    const result = await service.login({ email: 'a@b.com', password: 'secret123' });
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.email).toBe('a@b.com');
  });

  it('rechaza login con contrasena incorrecta', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: UserRole.BUYER,
      passwordHash: await bcrypt.hash('secret123', 10),
    });

    await expect(
      service.login({ email: 'a@b.com', password: 'otra' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza login con usuario inexistente', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'no@existe.com', password: 'x12345678' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
