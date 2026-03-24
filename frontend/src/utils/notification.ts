import { Notification } from "@/types/notification";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Generate notification display text from type + senderIds + i18n templates.
 * This replaces the hardcoded Vietnamese message stored in the database.
 */
export function getNotificationMessage(
  notification: Notification,
  t: TFunction,
): string {
  const senders = notification.senderIds || [];
  const firstName =
    senders.length > 0
      ? `${senders[0].firstName} ${senders[0].lastName}`.trim()
      : "";

  // Build sender text with aggregation
  let senderText = firstName;
  if (senders.length === 2) {
    const second = `${senders[1].firstName} ${senders[1].lastName}`.trim();
    senderText = `${firstName}, ${second}`;
  } else if (senders.length > 2) {
    const othersCount = senders.length - 1;
    const othersLabel =
      othersCount === 1
        ? t("notifications.and_one_other")
        : t("notifications.and_n_others", { count: othersCount });
    senderText = `${firstName} ${othersLabel}`;
  }

  const groupName = notification.groupId?.name || "";

  switch (notification.type) {
    case "POST_REACTED":
      return `${senderText} ${t("notifications.reacted_to_post")}`;
    case "POST_COMMENTED":
      return `${senderText} ${t("notifications.commented_on_post")}`;
    case "POST_SHARED":
      return `${senderText} ${t("notifications.shared_your_post")}`;
    case "COMMENT_REPLIED":
      return `${senderText} ${t("notifications.replied_to_comment")}`;
    case "COMMENT_REACTED":
      return `${senderText} ${t("notifications.reacted_to_comment")}`;
    case "FRIEND_REQUEST":
      return `${senderText} ${t("notifications.sent_friend_request")}`;
    case "FRIEND_ACCEPTED":
      return `${senderText} ${t("notifications.accepted_request")}`;
    case "GROUP_INVITATION":
      if (notification.actionStatus === "ACCEPTED")
        return t("notifications.accepted_invitation");
      if (notification.actionStatus === "REJECTED")
        return t("notifications.declined_invitation");
      return `${senderText} ${t("notifications.invited_to_group", { group: groupName })}`;
    case "GROUP_ROLE_CHANGED":
      return t("notifications.role_changed_in_group", { group: groupName });
    case "GROUP_OWNERSHIP_TRANSFERRED":
      return t("notifications.ownership_transferred", { group: groupName });
    case "GROUP_REQUEST_APPROVED":
      return t("notifications.group_request_approved", { group: groupName });
    case "GROUP_REQUEST_REJECTED":
      return t("notifications.group_request_rejected", { group: groupName });
    default:
      // Fallback to stored message for SYSTEM type or unknown types
      return notification.message || "";
  }
}
