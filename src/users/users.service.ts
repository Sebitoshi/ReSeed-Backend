import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity.js';

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  bio: string | null;
  phone: string | null;
  createdAt: Date;
}

// Datos con los que un modulo puede crear un usuario sin conocer el hashing.
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio ?? null,
      phone: user.phone ?? null,
      createdAt: user.createdAt,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async create(dto: CreateUserInput): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.users.exists({ where: { email } });
    if (exists) {
      throw new ConflictException('El email ya esta registrado');
    }
    return this.users.save(
      this.users.create({
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role ?? UserRole.BUYER,
      }),
    );
  }

  async updateProfile(user: User, patch: { name?: string; bio?: string; phone?: string }) {
    if (patch.name !== undefined) user.name = patch.name.trim();
    if (patch.bio !== undefined) user.bio = patch.bio;
    if (patch.phone !== undefined) user.phone = patch.phone;
    return this.users.save(user);
  }

  async changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new ConflictException('La contrasena actual no coincide');
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.users.save(user);
  }
}
