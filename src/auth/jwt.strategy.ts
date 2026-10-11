import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  /**
   * Se consulta la base en cada request para que los cambios hechos desde el
   * panel admin (rol nuevo, cuenta desactivada) apliquen de inmediato, sin
   * esperar a que el token expire.
   */
  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token invalido');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('La cuenta del token ya no existe');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta esta desactivada; contacta al administrador');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
