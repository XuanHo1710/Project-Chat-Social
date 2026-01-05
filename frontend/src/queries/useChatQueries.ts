import { QUERY_KEYS } from "@/constants/query-keys";
import { chatService, MessagesResponse } from "@/services/chat.service";
import { MessageResponse, SendMessagePayload } from "@/types/chat";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export function useChatByConversationId(conversationId: string) {
  return useInfiniteQuery<MessagesResponse, Error>({
    queryKey: [QUERY_KEYS.CHATS, conversationId],
    queryFn: ({ pageParam }) =>
      chatService.getMessagesByConversationId(
        conversationId,
        15,
        pageParam as string | undefined
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined, // Không load thêm xuống
    getPreviousPageParam: (firstPage, allPages) => {
      // fetchPreviousPage prepends new pages, so:
      // allPages[0] = oldest page (first fetched older page or initial if no older loaded)
      // allPages[last] = initial page (newest messages)
      // We need cursor from the oldest page (firstPage = allPages[0])
      if (!firstPage.pagination.hasMore) return undefined;
      const messages = firstPage.data;
      if (messages.length === 0) return undefined;
      return messages[0]._id; // First message in oldest page = oldest message overall
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      chatService.sendMessage(payload),
    onSuccess: (data, variables) => {
      // Invalidate để refresh data mới
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.CHATS, variables.conversationId],
      });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error("Đã xảy ra lỗi khi gửi tin nhắn.");
    },
  });
}
