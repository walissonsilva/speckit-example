import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { maskPhoneNumber } from '../../../common/utils/mask-phone-number';
import { DispatchTemplateDto } from '../dto/dispatch-template.dto';
import { DISPATCH_QUEUE_PROVIDER } from '../providers/dispatch-queue.provider';
import type { DispatchQueueProvider } from '../providers/dispatch-queue.provider';
import { TEMPLATE_REPOSITORY } from '../repositories/template.repository';
import type { TemplateRepository } from '../repositories/template.repository';

@Injectable()
export class TemplateDispatchService {
  private readonly logger = new Logger(TemplateDispatchService.name);

  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templateRepository: TemplateRepository,
    @Inject(DISPATCH_QUEUE_PROVIDER)
    private readonly dispatchQueueProvider: DispatchQueueProvider,
  ) {}

  async dispatch(dto: DispatchTemplateDto): Promise<string> {
    const dispatchId = randomUUID();

    this.logger.log(
      `dispatchId=${dispatchId} start templateId=${dto.templateId} clientPhoneNumber=${maskPhoneNumber(dto.clientPhoneNumber)}`,
    );

    const template = await this.templateRepository.findById(dto.templateId);

    if (template?.whatsappPhoneNumber) {
      await this.dispatchQueueProvider.enqueue({
        dispatchId,
        templateId: dto.templateId,
        clientPhoneNumber: dto.clientPhoneNumber,
        whatsappPhoneNumber: template.whatsappPhoneNumber,
      });
    }

    this.logger.log(`dispatchId=${dispatchId} end`);

    return dispatchId;
  }
}
