import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WorkerEventDocument = HydratedDocument<WorkerEvent>;

@Schema({ timestamps: true, collection: 'rabbit_worker_events' })
export class WorkerEvent {
  @Prop({ type: String, required: true })
  eventId: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Boolean, default: false })
  processing: boolean;

  @Prop({ type: Date })
  leaseUntil?: Date;

  @Prop({ type: Boolean, default: false })
  aiCompleted: boolean;

  @Prop({ type: Boolean, default: false })
  fcmCompleted: boolean;

  @Prop({ type: Boolean, default: false })
  notificationCompleted: boolean;

  @Prop({ type: Boolean, default: false })
  completed: boolean;

  @Prop({ type: Boolean, default: false })
  deadLettered: boolean;

  @Prop({ type: String, maxlength: 2_000 })
  lastError?: string;

  @Prop({ type: Date })
  expireAt?: Date;
}

export const WorkerEventSchema = SchemaFactory.createForClass(WorkerEvent);
WorkerEventSchema.index({ eventId: 1 }, { unique: true });
WorkerEventSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
WorkerEventSchema.index({ completed: 1, deadLettered: 1, updatedAt: -1 });
