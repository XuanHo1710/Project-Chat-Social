import axios from "@/config/axios";
import { MessageResponse, SendMessagePayload } from "@/types/chat";
import { APIResponse } from "@/types/common";

export interface MessagesResponse {
  data: MessageResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface MediaMessagesResponse {
  data: MessageResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

class ChatService {
  async getMessagesByConversationId(
    conversationId: string,
    limit: number = 15,
    before?: string
  ): Promise<MessagesResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (before) params.append("before", before);

    const response = await axios.get(
      `/chat/messages/${conversationId}?${params.toString()}`
    );
    // Backend wraps response in { data: actualData }
    const result = response.data?.data || response.data;
    return result;
  }

  // Get media messages (images/videos) for a conversation
  async getMediaMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<MediaMessagesResponse> {
    const response = await axios.get(
      `/chat/messages/${conversationId}/media?page=${page}&limit=${limit}`
    );
    const result = response.data?.data || response.data;
    return result;
  }

  // Get file messages (documents) for a conversation
  async getFileMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<MediaMessagesResponse> {
    const response = await axios.get(
      `/chat/messages/${conversationId}/files?page=${page}&limit=${limit}`
    );
    const result = response.data?.data || response.data;
    return result;
  }

  async sendMessage(
    payload: SendMessagePayload
  ): Promise<APIResponse<MessageResponse[]>> {
    const response = await axios.post<APIResponse<MessageResponse[]>>(
      "/chat/messages",
      payload
    );
    return response.data;
  }

  async getMessageById(id: string): Promise<APIResponse<MessageResponse>> {
    const response = await axios.get<APIResponse<MessageResponse>>(
      "/chat/" + id
    );
    return response.data;
  }
}

export const chatService = new ChatService();
