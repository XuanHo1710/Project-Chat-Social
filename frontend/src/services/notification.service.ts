import axios, { unwrap } from "@/config/axios";
import { APIResponse } from "@/types/common";
import {
  Notification,
  NotificationResponse,
  UnreadCountResponse,
} from "@/types/notification";

class NotificationService {
  async getNotifications(
    page = 1,
    limit = 20,
    status?: 'UNREAD' | 'READ',
    type?: string
  ): Promise<NotificationResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await axios.get<APIResponse<NotificationResponse>>(
      `/notification?${params.toString()}`
    );
    return unwrap<NotificationResponse>(response.data);
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await axios.get<APIResponse<UnreadCountResponse>>(
      "/notification/unread-count"
    );
    return unwrap<UnreadCountResponse>(response.data);
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await axios.put<APIResponse<Notification>>(
      `/notification/${notificationId}/read`
    );
    return unwrap<Notification>(response.data);
  }

  async markAllAsRead(): Promise<{ message: string }> {
    const response = await axios.put<APIResponse<{ message: string }>>(
      "/notification/read-all"
    );
    return unwrap<{ message: string }>(response.data);
  }

  async deleteNotification(
    notificationId: string
  ): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/notification/${notificationId}`
    );
    return unwrap<{ message: string }>(response.data);
  }

  async respondToGroupInvitation(
    notificationId: string,
    action: "ACCEPT" | "REJECT"
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      "/notification/group-invitation/respond",
      { notificationId, action }
    );
    return unwrap<{ message: string }>(response.data);
  }
}

export const notificationService = new NotificationService();
