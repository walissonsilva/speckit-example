export interface DispatchQueueMessage {
  dispatchId: string;
  templateId: string;
  clientPhoneNumber: string;
  whatsappPhoneNumber: string;
}

export interface DispatchQueueProvider {
  enqueue(message: DispatchQueueMessage): Promise<void>;
}

export const DISPATCH_QUEUE_PROVIDER = 'DISPATCH_QUEUE_PROVIDER';
