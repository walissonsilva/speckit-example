import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  DispatchQueueMessage,
  DispatchQueueProvider,
} from './dispatch-queue.provider';

@Injectable()
export class SqsDispatchQueueProvider implements DispatchQueueProvider {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new SQSClient({
      region: this.configService.get<string>('AWS_REGION'),
      endpoint: this.configService.get<string>('AWS_ENDPOINT_URL'),
    });
    this.queueUrl = this.configService.get<string>('SQS_QUEUE_URL') ?? '';
  }

  async enqueue(message: DispatchQueueMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
    });

    await this.client.send(command, { abortSignal: AbortSignal.timeout(1000) });
  }
}
