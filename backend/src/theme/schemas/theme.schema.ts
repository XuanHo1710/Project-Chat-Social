
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ThemeDocument = HydratedDocument<Theme>;

@Schema({ timestamps: true })
export class Theme {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    primaryColor: string;

    @Prop({ required: true })
    secondaryColor: string;

    @Prop({ required: true })
    bgDarkMode: string;

    @Prop({ required: true })
    bgLightMode: string;

    @Prop({ default: false })
    isActive: boolean;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);

ThemeSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
