import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ collection: 'groups' })
export class Group {
  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  avatar?: string;

  @Prop({ type: String })
  coverImage?: string;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
