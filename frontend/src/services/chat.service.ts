import axios from "@/config/axios";
import { MessageResponse, SendMessagePayload } from "@/types/chat";
import { APIResponse } from "@/types/common";

class ChatService {
    async getMessagesByConversationId(conversationId: string): Promise<APIResponse<MessageResponse[]>> {
        const response = await axios.get<APIResponse<MessageResponse[]>>("/chat/messages/" + conversationId);
        return response.data;
    }

    async sendMessage(payload: SendMessagePayload): Promise<APIResponse<MessageResponse[]>> {
        const response = await axios.post<APIResponse<MessageResponse[]>>("/chat/messages", payload);
        return response.data;
    }
}

export const chatService = new ChatService();