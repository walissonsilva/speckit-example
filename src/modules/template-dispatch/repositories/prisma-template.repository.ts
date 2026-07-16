import { Injectable } from '@nestjs/common';
import { Template } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TemplateRepository } from './template.repository';

@Injectable()
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(templateId: string): Promise<Template | null> {
    return this.prisma.template.findUnique({ where: { id: templateId } });
  }
}
