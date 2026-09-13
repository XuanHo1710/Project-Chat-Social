import i18n from "@/lib/i18n";

export const formatDate = (isoString: Date | string | undefined) => {
  if (isoString === undefined) return "";
  const date = new Date(isoString);
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export const formatDateTime = (isoString: Date | string) => {
  const date = new Date(isoString);
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const formatTime = (isoString: Date | string) => {
  const date = new Date(isoString);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatChatTimestamp = (isoString: Date | string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  if (diffMs < oneDayMs) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (diffMs <= sevenDaysMs) {
    return date.toLocaleString("vi-VN", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const timeAgo = (input: Date | string) => {
  const date = new Date(input);
  const now = new Date();

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return i18n.t("time.just_now");
  if (seconds < 60) return i18n.t("time.seconds_ago", { count: seconds });

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return i18n.t("time.minutes_ago", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("time.hours_ago", { count: hours });

  const days = Math.floor(hours / 24);
  if (days === 1) return i18n.t("time.yesterday");
  if (days < 7) return i18n.t("time.days_ago", { count: days });

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return i18n.t("time.weeks_ago", { count: weeks });

  const months = Math.floor(days / 30);
  if (months < 12) return i18n.t("time.months_ago", { count: months });

  const years = Math.floor(days / 365);
  return i18n.t("time.years_ago", { count: years });
};
