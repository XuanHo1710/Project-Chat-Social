import { create } from "zustand";
import { MessageResponse } from "@/types/chat";

// ReadBy user info type
interface ReadByUser {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

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
    readBy: ReadByUser,
    currentUserId: string
  ) => void;

  // Clear all pending for a conversation
  clearPending: (conversationId: string) => void;

  // Restore initial state
  reset: () => void;
}

const MAX_PENDING_PER_CONVERSATION = 200;
const MAX_PENDING_CONVERSATIONS = 100;

export const useMessageCacheStore = create<MessageCacheState>((set, get) => ({
  pendingMessages: {},

  reset: () => set({ pendingMessages: {} }),

  addPendingMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.pendingMessages[conversationId] || [];
      // Don't add duplicates
      if (existing.some((m) => m._id === message._id)) {
        return state;
      }
      const nextPending = {
        ...state.pendingMessages,
        [conversationId]: [...existing, message].slice(-MAX_PENDING_PER_CONVERSATION),
      };
      const conversationIds = Object.keys(nextPending);
      while (conversationIds.length > MAX_PENDING_CONVERSATIONS) {
        const oldestConversationId = conversationIds.shift();
        if (oldestConversationId) delete nextPending[oldestConversationId];
      }
      return {
        pendingMessages: nextPending,
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
      if (!existing.some((item) => item._id === message._id)) {
        return state;
      }
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

        // Only update if this is my message and reader is not me
        if (
          isMyMessage &&
          msg.status !== "READ" &&
          readBy._id !== currentUserId
        ) {
          // Check if this user already exists in readBy array
          const alreadyRead = msg.readBy?.some(
            (r) =>
              (typeof r === "object" && r._id === readBy._id) ||
              r._id === readBy._id
          );
          if (alreadyRead) {
            return msg;
          }
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
