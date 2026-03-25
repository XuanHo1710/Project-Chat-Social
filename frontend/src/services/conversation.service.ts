import axios from "@/config/axios";
import { APIResponse } from "@/types/common";
import { ConversationResponseData } from "@/types/conversation";

class ConversationService {
  async unreadCountAllConversationByUserId(): Promise<{ unreadCount: number }> {
    const response = await axios.get<APIResponse<{ unreadCount: number }>>(
      "/conversation/total-unread-count",
    );
    return response.data.data;
  }

  async getConversationByUserId(
    userId: string,
  ): Promise<APIResponse<ConversationResponseData[]>> {
    const response = await axios.get<APIResponse<ConversationResponseData[]>>(
      "/conversation/" + userId,
    );
    return response.data;
  }

  async getConversationDetail(
    id: string,
  ): Promise<APIResponse<ConversationResponseData>> {
    const response = await axios.get<APIResponse<ConversationResponseData>>(
      `/conversation/detail/${id}`,
    );
    return response.data;
  }

  async getAllConversations(): Promise<
    APIResponse<ConversationResponseData[]>
  > {
    const response =
      await axios.get<APIResponse<ConversationResponseData[]>>("/conversation");
    return response.data;
  }
  async createChatbotConversation(): Promise<ConversationResponseData> {
    const response = await axios.post<APIResponse<ConversationResponseData>>(
      "/conversation/chatbot",
    );
    return response.data.data;
  }

  async getOrCreateDirectConversation(
    targetUserId: string,
  ): Promise<ConversationResponseData> {
    const response = await axios.post<APIResponse<ConversationResponseData>>(
      `/conversation/direct/${targetUserId}`,
    );
    return response.data.data;
  }
}

export const conversationService = new ConversationService();
