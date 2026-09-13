import axios, { unwrap } from "@/config/axios";
import { APIResponse } from "@/types/common";
import { ConversationResponseData } from "@/types/conversation";

class ConversationService {
  async unreadCountAllConversationByUserId(): Promise<{ unreadCount: number }> {
    const response = await axios.get<APIResponse<{ unreadCount: number }>>(
      "/conversation/total-unread-count",
    );
    return unwrap<{ unreadCount: number }>(response.data);
  }

  async getConversationByUserId(
    _userId: string,
  ): Promise<APIResponse<ConversationResponseData[]>> {
    const response = await axios.get<APIResponse<ConversationResponseData[]>>(
      "/conversation",
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
    return unwrap<ConversationResponseData>(response.data);
  }

  async getOrCreateDirectConversation(
    targetUserId: string,
  ): Promise<ConversationResponseData> {
    const response = await axios.post<APIResponse<ConversationResponseData>>(
      `/conversation/direct/${targetUserId}`,
    );
    return unwrap<ConversationResponseData>(response.data);
  }
}

export const conversationService = new ConversationService();
