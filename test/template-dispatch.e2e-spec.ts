import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DISPATCH_QUEUE_PROVIDER } from '../src/modules/template-dispatch/providers/dispatch-queue.provider';
import { TEMPLATE_REPOSITORY } from '../src/modules/template-dispatch/repositories/template.repository';

describe('TemplateDispatchController (e2e)', () => {
  let app: INestApplication<App>;
  const templateRepository = { findById: jest.fn() };
  const dispatchQueueProvider = { enqueue: jest.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TEMPLATE_REPOSITORY)
      .useValue(templateRepository)
      .overrideProvider(DISPATCH_QUEUE_PROVIDER)
      .useValue(dispatchQueueProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await app.close();
  });

  it('POST /template-dispatches returns 202 with a dispatchId for an existing template (Cenário 1)', async () => {
    templateRepository.findById.mockResolvedValue({
      id: 'T1',
      text: 'Hello',
      whatsappPhoneNumber: '5511999990000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dispatchQueueProvider.enqueue.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/template-dispatches')
      .send({ templateId: 'T1', clientPhoneNumber: '5511988887777' })
      .expect(202);

    const body = response.body as { dispatchId: string };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any(String) is untyped by design
    expect(body).toEqual({ dispatchId: expect.any(String) });
    expect(dispatchQueueProvider.enqueue).toHaveBeenCalledWith({
      dispatchId: body.dispatchId,
      templateId: 'T1',
      clientPhoneNumber: '5511988887777',
      whatsappPhoneNumber: '5511999990000',
    });
  });
});
