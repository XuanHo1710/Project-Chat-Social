import { PostPrivacy, PostType } from "@/types/post";
import { timeAgo } from "@/utils/formatDate";

import {
  Public as PublicIcon,
  Lock as LockIcon,
  People as PeopleIcon,
} from "@mui/icons-material";

// Helper function to format time
export const formatPostTime = (dateString: string) => {
  try {
    return timeAgo(dateString);
  } catch {
    return "vài giây";
  }
};

// Helper to get privacy icon
export const getPrivacyIcon = (privacy: PostPrivacy) => {
  switch (privacy) {
    case "PUBLIC":
      return PublicIcon;
    case "FRIEND":
      return PeopleIcon;
    case "PRIVATE":
      return LockIcon;
    default:
      return PublicIcon;
  }
};

// Helper to get author display name
export const getAuthorName = (post: PostType) => {
  if (post.userId?.firstName && post.userId?.lastName) {
    return `${post.userId.firstName} ${post.userId.lastName}`;
  }
  return post.userId?.username || "Người dùng";
};
