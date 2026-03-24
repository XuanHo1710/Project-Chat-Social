import { create } from "zustand";

import { t } from "i18next";

export interface UserOnlineStatus {
  userId: string;
  isOnline: boolean;
  lastActive?: Date | string;
}

interface OnlineStatusStore {
  // Map userId -> status
  onlineUsers: Record<string, UserOnlineStatus>;

  // Set user online
  setUserOnline: (userId: string) => void;

  // Set user offline with lastActive time
  setUserOffline: (userId: string, lastActive?: Date | string) => void;

  // Batch update online users
  setOnlineUsers: (userIds: string[]) => void;

  // Update from socket event
  updateFromSocket: (data: {
    userId: string;
    status: string;
    lastActive?: Date | string;
  }) => void;

  // Get user status
  getUserStatus: (userId: string) => UserOnlineStatus | undefined;

  // Check if user is online
  isUserOnline: (userId: string) => boolean;
}

export const useOnlineStatusStore = create<OnlineStatusStore>((set, get) => ({
  onlineUsers: {},

  setUserOnline: (userId) => {
    set((prev) => ({
      onlineUsers: {
        ...prev.onlineUsers,
        [userId]: {
          userId,
          isOnline: true,
          lastActive: undefined,
        },
      },
    }));
  },

  setUserOffline: (userId, lastActive) => {
    set((prev) => ({
      onlineUsers: {
        ...prev.onlineUsers,
        [userId]: {
          userId,
          isOnline: false,
          lastActive: lastActive || new Date(),
        },
      },
    }));
  },

  setOnlineUsers: (userIds) => {
    set((prev) => {
      const newOnlineUsers = { ...prev.onlineUsers };
      const onlineSet = new Set(userIds);
      // Mark listed users as online
      userIds.forEach((userId) => {
        newOnlineUsers[userId] = {
          userId,
          isOnline: true,
          lastActive: undefined,
        };
      });
      // Mark any previously-online users NOT in the list as offline
      Object.keys(newOnlineUsers).forEach((userId) => {
        if (newOnlineUsers[userId].isOnline && !onlineSet.has(userId)) {
          newOnlineUsers[userId] = {
            ...newOnlineUsers[userId],
            isOnline: false,
            lastActive: new Date(),
          };
        }
      });
      return { onlineUsers: newOnlineUsers };
    });
  },

  updateFromSocket: (data) => {
    const { userId, status, lastActive } = data;
    if (status === "ACTIVE") {
      get().setUserOnline(userId);
    } else if (status === "HIDDEN") {
      // User has hidden their activity status - show as offline without lastActive
      get().setUserOffline(userId, undefined);
    } else {
      get().setUserOffline(userId, lastActive);
    }
  },

  getUserStatus: (userId) => {
    return get().onlineUsers[userId];
  },

  isUserOnline: (userId) => {
    return get().onlineUsers[userId]?.isOnline ?? false;
  },
}));

// Helper function to format "X phút" or "X giờ" (short format for sidebar)
export function formatLastActive(
  lastActive: Date | string | undefined,
): string | null {
  if (!lastActive) return null;

  const now = new Date();
  const activeTime = new Date(lastActive);
  const diffMs = now.getTime() - activeTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  // Không hiển thị nếu > 24 giờ
  if (diffHours > 24) return null;

  if (diffMinutes < 1) return `${t("time.minute_ago", { count: 1 })}`;
  if (diffMinutes < 60)
    return `${t("time.minute_ago", { count: diffMinutes })}`;
  return `${t("time.hour_ago", { count: diffHours })}`;
}

// Helper for chat: detailed format
export function formatLastActiveDetailed(
  lastActive: Date | string | undefined,
): string {
  if (!lastActive) return "Không rõ";

  const now = new Date();
  const activeTime = new Date(lastActive);
  const diffMs = now.getTime() - activeTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return `${t("time.minute_ago", { count: 1 })}`;
  if (diffMinutes < 60)
    return `${t("time.minute_ago", { count: diffMinutes })}`;
  if (diffHours < 24) return `${t("time.hour_ago", { count: diffHours })}`;
  if (diffDays === 1) return `${t("time.days_ago", { count: diffDays })}`;
  if (diffDays < 7) return `${t("time.days_ago", { count: diffDays })}`;

  // For user not active more than 7 days. Not show last active time
  return ``;
}
