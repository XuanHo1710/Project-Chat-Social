import { Notification } from "@/types/notification";
import { ReactionType } from "@/types/reaction";
import { getReactionLabel } from "@/constants/reactions";
import { getNotificationMessage } from "@/utils/notification";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export interface RenderableNotification
  extends Pick<Notification, "title" | "message"> {
  senderIds?: Notification["senderIds"];
  templateKey?: string;
  templateParams?: Record<string, string | number>;
}

export interface RenderedNotificationText {
  title: string;
  message?: string;
}

export function getSenderDisplayName(
  notification: RenderableNotification,
): string {
  const sender = notification.senderIds?.[0];
  return sender ? `${sender.firstName} ${sender.lastName}`.trim() : "";
}

function resolveReactionLabel(
  value: string | number | undefined,
  t: TFunction,
): string | number {
  if (typeof value !== "string") return value ?? "";
  return getReactionLabel(value as ReactionType, t) || value;
}

export function renderNotification(
  notification: RenderableNotification,
  t: TFunction,
): RenderedNotificationText {
  if (!notification.templateKey) {
    return { title: getNotificationMessage(notification as Notification, t) };
  }

  const senders = notification.senderIds || [];
  const isAggregated = senders.length > 1;
  const params: Record<string, string | number> = { ...notification.templateParams };
  if (isAggregated) {
    params.senderName =
      typeof notification.templateParams?.senderName === "string" &&
      notification.templateParams.senderName
        ? notification.templateParams.senderName
        : getSenderDisplayName(notification);
    params.otherCount = notification.templateParams?.otherCount ?? senders.length - 1;
  }
  if (params.reactionType !== undefined) {
    params.reactionType = resolveReactionLabel(params.reactionType, t);
  }
  if (params.groupName !== undefined && params.group === undefined) {
    params.group = params.groupName;
  }

  const title = t(notification.templateKey, { ...params, defaultValue: notification.title });
  const messageKey = isAggregated
    ? `${notification.templateKey}_message_multi`
    : `${notification.templateKey}_message`;
  const rawMessage = t(messageKey, {
    ...params,
    defaultValue: notification.message || "",
  });

  return {
    title,
    ...(rawMessage ? { message: rawMessage } : {}),
  };
}
