import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from 'mongoose';
export type AccountDocument = HydratedDocument<Account>;

@Schema({ timestamps: true })
export class Account {
    _id: mongoose.Schema.Types.ObjectId;
    // Thông tin cho profile của người dùng
    @Prop()
    firstName: string;

    @Prop()
    lastName: string;

    @Prop()
    email: string;

    @Prop()
    phone: string;

    // Địa chỉ mặc định
    @Prop([{
        label: { type: String, required: true }, // 'Nhà riêng', 'Văn phòng', 'Khác', ...
        province: {
            code: { type: Number, required: true },
            name: { type: String, required: true }
        },
        district: {
            code: { type: Number, required: true },
            name: { type: String, required: true }
        },
        ward: {
            code: { type: Number, required: true },
            name: { type: String, required: true }
        },
        detailAddress: { type: String, required: true },
        isDefault: { type: Boolean, default: false }
    }])
    addresses: Array<{
        _id?: string; // MongoDB sẽ tự tạo _id
        label: string;
        province: { code: number; name: string };
        district: { code: number; name: string };
        ward: { code: number; name: string };
        detailAddress: string;
        isDefault: boolean;
    }>;

    @Prop()
    avatar: string;

    @Prop({ enum: ['MALE', 'FEMALE', 'OTHER'], default: 'OTHER' })
    gender: string;

    @Prop()
    birthday?: Date;


    @Prop()
    resetPasswordToken?: string;

    @Prop()
    resetPasswordExpires?: Date;

    // Thông tin cơ bản cho account

    @Prop({ unique: true })
    username: string;

    @Prop()
    password: string;

    @Prop({ enum: ['USER', 'ADMIN'], default: 'USER' })
    role: string; //USER, ADMIN

    @Prop()
    accessToken: string;

    // Google OAuth fields
    @Prop()
    googleId?: string;

    @Prop({ enum: ['LOCAL', 'GOOGLE'], default: 'LOCAL' })
    authProvider: string;

    @Prop({ enum: ['ACTIVE', 'DEACTIVE'], default: "DEACTIVE" })
    status: string;  // ACTIVE, DEACTIVE // Để lưu trạng thái hoạt động của tài khoản => socket real time

    @Prop()
    lastLogin: Date;

    @Prop({ default: false })
    isBlocked: boolean;

    @Prop()
    expireBlockAt: Date;

    @Prop({ default: true })
    isActive: boolean; // Người dùng có thể deactive tài khoản nếu muốn

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Array<Date>;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop()
    deletedAt: Date;

    @Prop({ default: 0 })
    loginCount: number;  // Để thống kê bên dashboard ?
}

export const AccountSchema = SchemaFactory.createForClass(Account);
