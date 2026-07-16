import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TemplateDispatchController } from './controllers/template-dispatch.controller';
import { DISPATCH_QUEUE_PROVIDER } from './providers/dispatch-queue.provider';
import { SqsDispatchQueueProvider } from './providers/sqs-dispatch-queue.provider';
import { PrismaTemplateRepository } from './repositories/prisma-template.repository';
import { TEMPLATE_REPOSITORY } from './repositories/template.repository';
import { TemplateDispatchService } from './services/template-dispatch.service';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateDispatchController],
  providers: [
    TemplateDispatchService,
    { provide: TEMPLATE_REPOSITORY, useClass: PrismaTemplateRepository },
    { provide: DISPATCH_QUEUE_PROVIDER, useClass: SqsDispatchQueueProvider },
  ],
})
export class TemplateDispatchModule {}
