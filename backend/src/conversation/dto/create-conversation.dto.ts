import mongoose from "mongoose";

export class CreateConversationDto {
    type: string; // 'GROUP' | 'DIRECT' 


    participants: [{
        user: mongoose.Schema.Types.ObjectId;
        nickname?: string;
        joinedAt: Date;
        isAdmin: boolean;
    }]

}
