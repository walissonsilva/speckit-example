import { Test, TestingModule } from '@nestjs/testing';
import { DispatchQueueProvider } from '../providers/dispatch-queue.provider';
import { TemplateRepository } from '../repositories/template.repository';
import { TemplateDispatchService } from './template-dispatch.service';
import { TEMPLATE_REPOSITORY } from '../repositories/template.repository';
import { DISPATCH_QUEUE_PROVIDER } from '../providers/dispatch-queue.provider';

describe('TemplateDispatchService', () => {
  let service: TemplateDispatchService;
  let templateRepository: jest.Mocked<TemplateRepository>;
  let dispatchQueueProvider: jest.Mocked<DispatchQueueProvider>;

  beforeEach(async () => {
    templateRepository = { findById: jest.fn() };
    dispatchQueueProvider = { enqueue: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateDispatchService,
        { provide: TEMPLATE_REPOSITORY, useValue: templateRepository },
        { provide: DISPATCH_QUEUE_PROVIDER, useValue: dispatchQueueProvider },
      ],
    }).compile();

    service = module.get(TemplateDispatchService);
  });

  it('returns a dispatchId and enqueues the message when the template exists with a whatsappPhoneNumber', async () => {
    templateRepository.findById.mockResolvedValue({
      id: 'T1',
      text: 'Hello',
      whatsappPhoneNumber: '5511999990000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dispatchQueueProvider.enqueue.mockResolvedValue(undefined);

    const dispatchId = await service.dispatch({
      templateId: 'T1',
      clientPhoneNumber: '5511988887777',
    });

    expect(dispatchId).toEqual(expect.any(String));
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.Mocked property, not a bound method call
    expect(dispatchQueueProvider.enqueue).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.Mocked property, not a bound method call
    expect(dispatchQueueProvider.enqueue).toHaveBeenCalledWith({
      dispatchId,
      templateId: 'T1',
      clientPhoneNumber: '5511988887777',
      whatsappPhoneNumber: '5511999990000',
    });
  });
});
