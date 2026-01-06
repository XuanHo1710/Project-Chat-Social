import axios from "@/config/axios";
import { APIResponse } from "@/types/common";
import { ConversationResponseData } from "@/types/conversation";

class ConversationService {
  async getConversationByUserId(
    userId: string
  ): Promise<APIResponse<ConversationResponseData[]>> {
    const response = await axios.get<APIResponse<ConversationResponseData[]>>(
      "/conversation/" + userId
    );
    return response.data;
  }

  async getConversationDetail(
    id: string
  ): Promise<APIResponse<ConversationResponseData>> {
    const response = await axios.get<APIResponse<ConversationResponseData>>(
      `/conversation/detail/${id}`
    );
    return response.data;
  }

  async getAllConversations(): Promise<
    APIResponse<ConversationResponseData[]>
  > {
    const response = await axios.get<APIResponse<ConversationResponseData[]>>(
      "/conversation"
    );
    return response.data;
  }
}

export const conversationService = new ConversationService();
