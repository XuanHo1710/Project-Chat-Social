// Metadata utility for dynamic SEO - Social Media App

import i18n from "@/lib/i18n";

// App name constant
const APP_NAME = "Social Chat";

const mt = (key: string, params?: Record<string, unknown>) =>
  String(
    i18n.t(`metadata.${key}`, {
      ...params,
      app: params?.app ?? APP_NAME,
      defaultValue: key,
    })
  );

// Home page metadata
export const homeMetadata = {
  get title() {
    return mt("home_title");
  },
  get description() {
    return mt("home_description");
  },
  keywords:
    "mạng xã hội, social media, kết nối bạn bè, chat, messenger, video call, chia sẻ ảnh, chia sẻ video, cộng đồng, social network, facebook clone",
  get ogTitle() {
    return mt("home_og_title");
  },
  get ogDescription() {
    return mt("home_og_description");
  },
  ogImage: "/og-image.jpg",
};

// Search page metadata
export const searchMetadata = (query?: string) => ({
  title: query
    ? `${mt("search_title_query", { query })} | ${APP_NAME}`
    : `${mt("search_title")} | ${APP_NAME}`,
  description: query
    ? mt("search_description_query", { query })
    : mt("search_description"),
  keywords: `tìm kiếm, search, ${query || ""}, bài viết, bạn bè, nhóm, ${APP_NAME}`,
  ogTitle: query ? mt("search_og_title_query", { query }) : mt("search_title"),
  ogDescription: mt("search_og_description"),
});

// Profile page metadata
export const profileMetadata = (user: {
  fullName?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  friendCount?: number;
  postCount?: number;
}) => ({
  title: `${user.fullName || user.username || mt("default_user")} | ${APP_NAME}`,
  description:
    user.bio ||
    mt("profile_description", {
      name: user.fullName || user.username,
      friends: user.friendCount || 0,
      posts: user.postCount || 0,
    }),
  keywords: `${user.fullName}, ${user.username}, profile, trang cá nhân, ${APP_NAME}`,
  ogTitle: `${user.fullName || user.username}`,
  ogDescription:
    user.bio ||
    mt("profile_og_description", { name: user.fullName || user.username }),
  ogImage: user.avatar || "/default-avatar.jpg",
});

// Post detail metadata
export const postMetadata = (post: {
  content?: string;
  author?: { fullName?: string; username?: string; avatar?: string };
  media?: { url: string; mediaType: string }[];
  totalReactions?: number;
  totalComments?: number;
  createdAt?: string | Date;
}) => {
  const authorName =
    post.author?.fullName || post.author?.username || mt("default_user");
  const shortContent = post.content?.substring(0, 150) || "";
  const firstImage = post.media?.find((m) => m.mediaType === "IMAGE")?.url;

  return {
    title: `${authorName}: "${shortContent}${(post.content?.length || 0) > 150 ? "..." : ""}" | ${APP_NAME}`,
    description: mt("post_description", {
      name: authorName,
      preview: `${shortContent}${(post.content?.length || 0) > 150 ? "..." : ""}`,
      reactions: post.totalReactions || 0,
      comments: post.totalComments || 0,
    }),
    keywords: `bài viết, post, ${authorName}, ${APP_NAME}`,
    ogTitle: mt("post_og_title", { name: authorName }),
    ogDescription: shortContent || mt("post_og_description"),
    ogImage: firstImage || post.author?.avatar || "/og-image.jpg",
  };
};

// Friends page metadata
export const friendsMetadata = {
  get title() {
    return `${mt("friends_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("friends_description");
  },
  keywords:
    "bạn bè, friends, kết bạn, lời mời kết bạn, gợi ý bạn bè, social network",
  get ogTitle() {
    return mt("friends_title");
  },
  get ogDescription() {
    return mt("friends_og_description");
  },
};

// Groups page metadata
export const groupsMetadata = {
  get title() {
    return `${mt("groups_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("groups_description");
  },
  keywords: "nhóm, groups, cộng đồng, community, sở thích, social groups",
  get ogTitle() {
    return mt("groups_og_title");
  },
  get ogDescription() {
    return mt("groups_og_description");
  },
};

// Group detail metadata
export const groupDetailMetadata = (group: {
  name: string;
  description?: string;
  avatar?: string;
  memberCount?: number;
  postCount?: number;
  privacy?: "PUBLIC" | "PRIVATE";
}) => ({
  title: `${group.name} | ${mt("groups_title")} | ${APP_NAME}`,
  description:
    group.description ||
    `${mt("group_detail_description", {
      name: group.name,
      members: group.memberCount || 0,
      posts: group.postCount || 0,
    })} ${mt(group.privacy === "PRIVATE" ? "group_privacy_private" : "group_privacy_public")}.`,
  keywords: `nhóm ${group.name}, group, cộng đồng, ${APP_NAME}`,
  ogTitle: group.name,
  ogDescription:
    group.description || mt("group_detail_og_description", { name: group.name }),
  ogImage: group.avatar || "/default-group.jpg",
});

// Reels/Watch page metadata
export const reelsMetadata = {
  get title() {
    return `${mt("watch_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("watch_description");
  },
  keywords:
    "video, reels, watch, giải trí, video ngắn, short video, entertainment",
  get ogTitle() {
    return mt("watch_og_title");
  },
  get ogDescription() {
    return mt("watch_og_description");
  },
};

// Chat/Messenger metadata
export const chatMetadata = {
  get title() {
    return `${mt("messenger_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("messenger_description");
  },
  keywords:
    "messenger, chat, nhắn tin, video call, gọi điện, tin nhắn, messaging",
  get ogTitle() {
    return mt("messenger_title");
  },
  get ogDescription() {
    return mt("messenger_og_description");
  },
};

// Notifications metadata
export const notificationsMetadata = {
  get title() {
    return `${mt("notifications_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("notifications_description");
  },
  keywords: "thông báo, notifications, cập nhật, hoạt động",
  get ogTitle() {
    return mt("notifications_title");
  },
  get ogDescription() {
    return mt("notifications_og_description");
  },
};

// Saved posts metadata
export const savedMetadata = {
  get title() {
    return `${mt("saved_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("saved_description");
  },
  keywords: "đã lưu, saved, bookmark, lưu bài viết",
  get ogTitle() {
    return mt("saved_title");
  },
  get ogDescription() {
    return mt("saved_og_description");
  },
};

// Auth pages metadata
export const authMetadata = {
  login: {
    get title() {
      return `${mt("login_title")} | ${APP_NAME}`;
    },
    get description() {
      return mt("login_description");
    },
    keywords: "đăng nhập, login, tài khoản, account",
    get ogTitle() {
      return mt("login_title");
    },
    get ogDescription() {
      return mt("login_og_description");
    },
  },
  register: {
    get title() {
      return `${mt("register_title")} | ${APP_NAME}`;
    },
    get description() {
      return mt("register_description");
    },
    keywords: "đăng ký, register, tạo tài khoản, sign up",
    get ogTitle() {
      return mt("register_og_title");
    },
    get ogDescription() {
      return mt("register_og_description");
    },
  },
  forgotPassword: {
    get title() {
      return `${mt("forgot_password_title")} | ${APP_NAME}`;
    },
    get description() {
      return mt("forgot_password_description");
    },
    keywords: "quên mật khẩu, forgot password, khôi phục tài khoản",
    get ogTitle() {
      return mt("forgot_password_og_title");
    },
    get ogDescription() {
      return mt("forgot_password_og_description");
    },
  },
};

// Settings metadata
export const settingsMetadata = {
  get title() {
    return `${mt("settings_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("settings_description");
  },
  keywords: "cài đặt, settings, tài khoản, quyền riêng tư, bảo mật",
  get ogTitle() {
    return mt("settings_title");
  },
  get ogDescription() {
    return mt("settings_og_description");
  },
};

// Error pages metadata
export const errorMetadata = {
  notFound: {
    get title() {
      return `${mt("not_found_title")} | ${APP_NAME}`;
    },
    get description() {
      return mt("not_found_description");
    },
    keywords: "404, không tìm thấy, page not found",
    get ogTitle() {
      return mt("not_found_title");
    },
    get ogDescription() {
      return mt("not_found_og_description");
    },
  },
  serverError: {
    get title() {
      return `${mt("server_error_title")} | ${APP_NAME}`;
    },
    get description() {
      return mt("server_error_description");
    },
    keywords: "500, lỗi, error",
    get ogTitle() {
      return mt("server_error_title");
    },
    get ogDescription() {
      return mt("server_error_og_description");
    },
  },
};

// AI Chat metadata
export const aiChatMetadata = {
  get title() {
    return `${mt("ai_chat_title")} | ${APP_NAME}`;
  },
  get description() {
    return mt("ai_chat_description");
  },
  keywords: "AI chat, trợ lý AI, chatbot, hỏi đáp, assistant",
  get ogTitle() {
    return mt("ai_chat_title");
  },
  get ogDescription() {
    return mt("ai_chat_og_description");
  },
};

// Generate structured data for SEO (JSON-LD)
export const generateStructuredData = (
  type: "website" | "profile" | "article",
  data?: Record<string, unknown>
) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://socialchat.com";

  switch (type) {
    case "website":
      return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: APP_NAME,
        url: baseUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${baseUrl}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      };
    case "profile":
      return {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: {
          "@type": "Person",
          name: data?.fullName,
          url: `${baseUrl}/profile/${data?.username}`,
          image: data?.avatar,
        },
      };
    case "article":
      return {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        headline: data?.content,
        author: {
          "@type": "Person",
          name: data?.authorName,
        },
        datePublished: data?.createdAt,
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/LikeAction",
            userInteractionCount: data?.totalReactions || 0,
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/CommentAction",
            userInteractionCount: data?.totalComments || 0,
          },
        ],
      };
    default:
      return {};
  }
};
