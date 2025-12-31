import { create } from 'zustand';

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
    updateFromSocket: (data: { userId: string; status: string; lastActive?: Date | string }) => void;

    // Get user status
    getUserStatus: (userId: string) => UserOnlineStatus | undefined;

    // Check if user is online
    isUserOnline: (userId: string) => boolean;
}

export const useOnlineStatusStore = create<OnlineStatusStore>((set, get) => ({
    onlineUsers: {},

    setUserOnline: (userId) => {
        set(prev => ({
            onlineUsers: {
                ...prev.onlineUsers,
                [userId]: {
                    userId,
                    isOnline: true,
                    lastActive: undefined
                }
            }
        }));
    },

    setUserOffline: (userId, lastActive) => {
        set(prev => ({
            onlineUsers: {
                ...prev.onlineUsers,
                [userId]: {
                    userId,
                    isOnline: false,
                    lastActive: lastActive || new Date()
                }
            }
        }));
    },

    setOnlineUsers: (userIds) => {
        set(prev => {
            const newOnlineUsers = { ...prev.onlineUsers };
            userIds.forEach(userId => {
                newOnlineUsers[userId] = {
                    userId,
                    isOnline: true,
                    lastActive: undefined
                };
            });
            return { onlineUsers: newOnlineUsers };
        });
    },

    updateFromSocket: (data) => {
        const { userId, status, lastActive } = data;
        if (status === 'ACTIVE') {
            get().setUserOnline(userId);
        } else {
            get().setUserOffline(userId, lastActive);
        }
    },

    getUserStatus: (userId) => {
        return get().onlineUsers[userId];
    },

    isUserOnline: (userId) => {
        return get().onlineUsers[userId]?.isOnline ?? false;
    }
}));

// Helper function to format "X phút" or "X giờ" (short format for sidebar)
export function formatLastActive(lastActive: Date | string | undefined): string | null {
    if (!lastActive) return null;

    const now = new Date();
    const activeTime = new Date(lastActive);
    const diffMs = now.getTime() - activeTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    // Không hiển thị nếu > 24 giờ
    if (diffHours > 24) return null;

    if (diffMinutes < 1) return '1 phút';
    if (diffMinutes < 60) return `${diffMinutes} phút`;
    return `${diffHours} giờ`;
}

// Helper for chat: detailed format
export function formatLastActiveDetailed(lastActive: Date | string | undefined): string {
    if (!lastActive) return 'Không rõ';

    const now = new Date();
    const activeTime = new Date(lastActive);
    const diffMs = now.getTime() - activeTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Vừa mới hoạt động';
    if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`;
    if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hoạt động hôm qua';
    if (diffDays < 7) return `Hoạt động ${diffDays} ngày trước`;

    // Format date for older
    return `Hoạt động ${activeTime.toLocaleDateString('vi-VN')}`;
}
