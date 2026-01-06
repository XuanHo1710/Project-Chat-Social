import { QUERY_KEYS } from "@/constants/query-keys";
import { conversationService } from "@/services/conversation.service";
import { useQuery } from "@tanstack/react-query";

export function useConversationByUserId(userId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, userId],
    queryFn: () => conversationService.getConversationByUserId(userId),
    enabled: !!userId,
  });
}

export function useConversationDetail(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, "detail", id],
    queryFn: () => conversationService.getConversationDetail(id),
    enabled: !!id,
  });
}

export function useGetAllConversations() {
  return useQuery({
    queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, "all"],
    queryFn: () => conversationService.getAllConversations(),
  });
}
