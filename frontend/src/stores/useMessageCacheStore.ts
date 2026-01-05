import { create } from "zustand";
import { MessageResponse } from "@/types/chat";

interface MessageCacheState {
  // Store pending messages for each conversation that haven't been synced to query cache
  pendingMessages: Record<string, MessageResponse[]>;

  // Add a message to pending for a conversation
  addPendingMessage: (conversationId: string, message: MessageResponse) => void;

  // Get and clear pending messages for a conversation (when opening it)
  consumePendingMessages: (conversationId: string) => MessageResponse[];

  // Update a message in pending (for edits, reactions, etc.)
  updatePendingMessage: (
    conversationId: string,
    message: MessageResponse
  ) => void;

  // Mark messages as read in pending
  markPendingMessagesAsRead: (
    conversationId: string,
    readBy: string,
    currentUserId: string
  ) => void;

  // Clear all pending for a conversation
  clearPending: (conversationId: string) => void;
}

export const useMessageCacheStore = create<MessageCacheState>((set, get) => ({
  pendingMessages: {},

  addPendingMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.pendingMessages[conversationId] || [];
      // Don't add duplicates
      if (existing.some((m) => m._id === message._id)) {
        return state;
      }
      return {
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: [...existing, message],
        },
      };
    });
  },

  consumePendingMessages: (conversationId) => {
    const messages = get().pendingMessages[conversationId] || [];
    set((state) => {
      const newPending = { ...state.pendingMessages };
      delete newPending[conversationId];
      return { pendingMessages: newPending };
    });
    return messages;
  },

  updatePendingMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.pendingMessages[conversationId] || [];
      const updated = existing.map((m) =>
        m._id === message._id ? message : m
      );
      return {
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: updated,
        },
      };
    });
  },

  markPendingMessagesAsRead: (conversationId, readBy, currentUserId) => {
    set((state) => {
      const existing = state.pendingMessages[conversationId] || [];
      const updated = existing.map((msg) => {
        const senderId =
          typeof msg.senderId === "object" ? msg.senderId._id : msg.senderId;
        const isMyMessage = senderId === currentUserId;

        if (isMyMessage && msg.status !== "READ" && readBy !== currentUserId) {
          return {
            ...msg,
            status: "READ" as const,
            readBy: [...(msg.readBy || []), readBy],
          };
        }
        return msg;
      });
      return {
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: updated,
        },
      };
    });
  },

  clearPending: (conversationId) => {
    set((state) => {
      const newPending = { ...state.pendingMessages };
      delete newPending[conversationId];
      return { pendingMessages: newPending };
    });
  },
}));
