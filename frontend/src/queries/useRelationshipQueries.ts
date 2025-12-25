import { QUERY_KEYS } from "@/constants/query-keys";
import { relationshipService } from "@/services/relationship.service";
import { RelationshipEnum } from "@/types/relationship";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useReceivedRequestFriends(userId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.RECEIVED_REQUEST_FRIENDS, userId],
    queryFn: () => relationshipService.getReceivedFriendRequests(),
    enabled: !!userId,
  });
}

export function useSentRequestFriends(userId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SENT_REQUEST_FRIENDS, userId],
    queryFn: () => relationshipService.getSentFriendRequests(),
    enabled: !!userId,
  });
}

export function useDisplayListFriends(userId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.FRIENDS, userId],
    queryFn: () => relationshipService.getFriends(),
    enabled: !!userId,
  });
}

export function useAddFriendMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; friendId: string }) =>
      relationshipService.addFriend(data.userId, data.friendId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.RECEIVED_REQUEST_FRIENDS, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.SENT_REQUEST_FRIENDS, userId],
        }),
      ]);
    },
  });
}

// Gồm các trạng thái như hủy kết bạn, từ chối, hủy việc gửi lời mời kết bạn
export function useUpdateStatusRelationshipMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      userId: string;
      friendId: string;
      status: RelationshipEnum;
    }) =>
      relationshipService.updateStatusRelationship(
        data.userId,
        data.friendId,
        data.status
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.RECEIVED_REQUEST_FRIENDS, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.SENT_REQUEST_FRIENDS, userId],
        }),
      ]);
    },
  });
}

export function useAceeptFriendMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; friendId: string }) =>
      relationshipService.acceptFriendRequest(data.userId, data.friendId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.RECEIVED_REQUEST_FRIENDS, userId],
        }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.FRIENDS, userId],
        }),
      ]);
    },
  });
}
