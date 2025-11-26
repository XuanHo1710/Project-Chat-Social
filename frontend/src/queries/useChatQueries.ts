import { QUERY_KEYS } from "@/constants/query-keys";
import { chatService } from "@/services/chat.service";
import { SendMessagePayload } from "@/types/chat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useChatByConversationId(conversationId: string) {
    return useQuery({
        queryKey: [QUERY_KEYS.CHATS, conversationId],
        queryFn: () => chatService.getMessagesByConversationId(conversationId),
        enabled: !!conversationId,
        staleTime: Infinity,
        gcTime: Infinity,
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: SendMessagePayload) =>
            chatService.sendMessage(payload),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.CHATS, variables.conversationId],
            });
        },
        onError: (error) => {
            console.error("Error sending message:", error);
            toast.error("Đã xảy ra lỗi khi gửi tin nhắn.");
        }
    });
}
