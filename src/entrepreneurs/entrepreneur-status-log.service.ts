import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EntrepreneurStatusLog,
  type ActorLike,
} from './entities/entrepreneur-status-log.entity.js';
import { EntrepreneurStatus } from './entities/entrepreneur.entity.js';

@Injectable()
export class EntrepreneurStatusLogService {
  constructor(
    @InjectRepository(EntrepreneurStatusLog)
    private readonly repo: Repository<EntrepreneurStatusLog>,
  ) {}

  async record(
    entrepreneurId: string,
    toStatus: EntrepreneurStatus,
    actor: ActorLike,
    note?: string | null,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        entrepreneurId,
        toStatus,
        actorId: actor.id,
        actorRole: actor.role,
        note: note ?? null,
      }),
    );
  }

  async history(entrepreneurId: string) {
    return this.repo.find({
      where: { entrepreneurId },
      order: { createdAt: 'ASC' },
    });
  }
}
