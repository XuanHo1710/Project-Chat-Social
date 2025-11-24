import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from "src/account/entities/account.entity";
export type RelationshipDocument = HydratedDocument<Relationship>;

@Schema({ timestamps: true })
export class Relationship {
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
    userId: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
    friendId: mongoose.Schema.Types.ObjectId;

    @Prop({ type: { isBlocked: Boolean, blockedAt: Date, userBlockedId: mongoose.Schema.Types.ObjectId }, default: { isBlocked: false, blockedAt: null, userBlockedId: null } })
    block: {
        isBlocked: boolean;
        blockedAt: Date;
        userBlockedId: mongoose.Schema.Types.ObjectId;
    }; // Block thằng bạn

    @Prop()
    createdAt: Date;


    @Prop()
    deletedAt: Date;
}

export const RelationshipSchema = SchemaFactory.createForClass(Relationship);