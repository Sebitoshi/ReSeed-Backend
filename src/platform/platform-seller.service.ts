import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  Entrepreneur,
  EntrepreneurStatus,
} from '../entrepreneurs/entities/entrepreneur.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';

const BCRYPT_ROUNDS = 10;

/**
 * Vendedor del sistema: la plataforma (Izeco) vendiendo materia prima.
 *
 * La materia recuperada en las jornadas no la transforma ni la vende un socio:
 * la vende la propia plataforma. En vez de inventar una ficha distinta por cada
 * despliegue, se crea una sola vez una ficha marcada isSystem y todos los
 * productos de materia prima cuelgan de ella.
 *
 * La cuenta duena de la ficha es tecnica: se crea con una contrasena aleatoria
 * (nadie puede iniciar sesion con ella) y sin verificar, solo para satisfacer la
 * relacion de propietario que exige la tabla de emprendimientos.
 */
@Injectable()
export class PlatformSellerService {
  constructor(
    @InjectRepository(Entrepreneur)
    private readonly entrepreneurs: Repository<Entrepreneur>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private get email(): string {
    return (process.env.PLATFORM_SELLER_EMAIL ?? 'tienda@izeco.app').toLowerCase();
  }

  private findSystem(): Promise<Entrepreneur | null> {
    return this.entrepreneurs.findOne({ where: { isSystem: true } });
  }

  private async ensureOwner(): Promise<User> {
    const existing = await this.users.findOne({ where: { email: this.email } });
    if (existing) {
      if (!existing.isSystem) {
        existing.isSystem = true;
        await this.users.save(existing);
      }
      return existing;
    }
    const passwordHash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
    return this.users.save(
      this.users.create({
        email: this.email,
        name: 'Izeco',
        passwordHash,
        role: UserRole.ENTREPRENEUR,
        isActive: false,
        isSystem: true,
        emailVerifiedAt: new Date(),
      }),
    );
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 1;
    while (await this.entrepreneurs.exists({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  /** Devuelve la ficha del sistema, creandola la primera vez que se necesita. */
  async getOrCreate(): Promise<Entrepreneur> {
    const found = await this.findSystem();
    if (found) return found;

    const owner = await this.ensureOwner();
    return this.entrepreneurs.save(
      this.entrepreneurs.create({
        name: 'Izeco',
        slug: await this.uniqueSlug('izeco'),
        description:
          'Vendedor de la plataforma. Publica la materia prima recuperada en las jornadas de limpieza para darle una segunda vida.',
        category: 'Materia prima',
        status: EntrepreneurStatus.APPROVED,
        ownerId: owner.id,
        isSystem: true,
      }),
    );
  }
}
