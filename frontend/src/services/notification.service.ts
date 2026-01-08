import axios from "@/config/axios";
import { APIResponse } from "@/types/common";
import {
  Notification,
  NotificationResponse,
  UnreadCountResponse,
} from "@/types/notification";

class NotificationService {
  async getNotifications(page = 1, limit = 20): Promise<NotificationResponse> {
    const response = await axios.get<APIResponse<NotificationResponse>>(
      `/notification?page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await axios.get<APIResponse<UnreadCountResponse>>(
      "/notification/unread-count"
    );
    return response.data.data;
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await axios.put<APIResponse<Notification>>(
      `/notification/${notificationId}/read`
    );
    return response.data.data;
  }

  async markAllAsRead(): Promise<{ message: string }> {
    const response = await axios.put<APIResponse<{ message: string }>>(
      "/notification/read-all"
    );
    return response.data.data;
  }

  async deleteNotification(
    notificationId: string
  ): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/notification/${notificationId}`
    );
    return response.data.data;
  }

  async respondToGroupInvitation(
    notificationId: string,
    action: "ACCEPT" | "REJECT"
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      "/notification/group-invitation/respond",
      { notificationId, action }
    );
    return response.data.data;
  }
}

export const notificationService = new NotificationService();
