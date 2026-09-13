import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkerEvent, WorkerEventDocument } from '../schemas/worker-event.schema';

export type WorkerStep = 'aiCompleted' | 'fcmCompleted' | 'notificationCompleted';

export type WorkerEventState = WorkerEvent & { claimed: boolean };

export class EventLeaseBusyError extends Error {
  constructor(eventId: string) {
    super(`Broker event ${eventId} is already being processed`);
    this.name = 'EventLeaseBusyError';
  }
}

@Injectable()
export class EventInboxService {
  private readonly completedRetentionMs = 7 * 24 * 60 * 60 * 1000;
  private readonly deadLetterRetentionMs = 30 * 24 * 60 * 60 * 1000;
  private readonly processingLeaseMs = 15 * 60 * 1000;

  constructor(
    @InjectModel(WorkerEvent.name)
    private readonly eventModel: Model<WorkerEventDocument>
  ) {}

  async begin(eventId: string, eventType: string): Promise<WorkerEventState> {
    try {
      await this.eventModel.updateOne(
        { eventId },
        { $setOnInsert: { eventId, eventType } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
    }

    const now = new Date();
    const event = await this.eventModel
      .findOneAndUpdate(
        {
          eventId,
          completed: { $ne: true },
          deadLettered: { $ne: true },
          $or: [
            { processing: { $ne: true } },
            { leaseUntil: { $lte: now } },
            { leaseUntil: { $exists: false } },
          ],
        },
        {
          $set: {
            processing: true,
            leaseUntil: new Date(now.getTime() + this.processingLeaseMs),
          },
          $inc: { attempts: 1 },
          $unset: { lastError: 1 },
        },
        { new: true }
      )
      .lean();
    if (event) return { ...event, claimed: true };

    const existing = await this.eventModel.findOne({ eventId }).lean();
    if (!existing) throw new Error(`Unable to load broker event ${eventId}`);
    return { ...existing, claimed: false };
  }

  async isStepCompleted(eventId: string, step: WorkerStep): Promise<boolean> {
    return Boolean(await this.eventModel.exists({ eventId, [step]: true }));
  }

  async completeStep(eventId: string, step: WorkerStep): Promise<void> {
    const result = await this.eventModel.updateOne({ eventId }, { $set: { [step]: true } });
    if (result.matchedCount !== 1) throw new Error(`Broker event ${eventId} no longer exists`);
  }

  async complete(eventId: string): Promise<void> {
    const result = await this.eventModel.updateOne(
      { eventId },
      {
        $set: {
          completed: true,
          processing: false,
          expireAt: new Date(Date.now() + this.completedRetentionMs),
        },
        $unset: { lastError: 1, leaseUntil: 1 },
      }
    );
    if (result.matchedCount !== 1) throw new Error(`Broker event ${eventId} no longer exists`);
  }

  async recordFailure(eventId: string, error: unknown, eventType?: string): Promise<void> {
    const message = this.errorMessage(error);
    await this.eventModel.updateOne(
      { eventId },
      {
        ...(eventType ? { $setOnInsert: { eventId, eventType, attempts: 1 } } : {}),
        $set: { lastError: message.slice(0, 2_000), processing: false },
        $unset: { leaseUntil: 1 },
      },
      { upsert: Boolean(eventType) }
    );
  }

  async markDeadLettered(eventId: string, error: unknown): Promise<void> {
    const message = this.errorMessage(error);
    await this.eventModel.updateOne(
      { eventId },
      {
        $set: {
          deadLettered: true,
          processing: false,
          lastError: message.slice(0, 2_000),
          expireAt: new Date(Date.now() + this.deadLetterRetentionMs),
        },
        $unset: { leaseUntil: 1 },
      }
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown error';
  }
}
