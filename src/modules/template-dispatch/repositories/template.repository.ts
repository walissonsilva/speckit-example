import { Template } from '@prisma/client';

export interface TemplateRepository {
  findById(templateId: string): Promise<Template | null>;
}

export const TEMPLATE_REPOSITORY = 'TEMPLATE_REPOSITORY';
