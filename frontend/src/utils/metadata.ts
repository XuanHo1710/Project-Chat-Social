// Metadata utility for dynamic SEO - Social Media App

// App name constant
const APP_NAME = "Social Chat";

// Home page metadata
export const homeMetadata = {
  title: `${APP_NAME} - Mạng xã hội kết nối bạn bè`,
  description: `${APP_NAME} - Nền tảng mạng xã hội miễn phí giúp bạn kết nối với bạn bè, gia đình và cộng đồng. Chia sẻ khoảnh khắc, nhắn tin, video call và khám phá nội dung thú vị.`,
  keywords:
    "mạng xã hội, social media, kết nối bạn bè, chat, messenger, video call, chia sẻ ảnh, chia sẻ video, cộng đồng, social network, facebook clone",
  ogTitle: `${APP_NAME} - Kết nối mọi người`,
  ogDescription:
    "Tham gia cộng đồng hàng triệu người dùng. Chia sẻ, kết nối và khám phá thế giới xung quanh bạn.",
  ogImage: "/og-image.jpg",
};

// Search page metadata
export const searchMetadata = (query?: string) => ({
  title: query
    ? `"${query}" - Tìm kiếm | ${APP_NAME}`
    : `Tìm kiếm | ${APP_NAME}`,
  description: query
    ? `Kết quả tìm kiếm cho "${query}" trên ${APP_NAME}. Tìm bạn bè, bài viết, nhóm và nội dung liên quan.`
    : `Tìm kiếm bạn bè, bài viết, nhóm và nội dung trên ${APP_NAME}.`,
  keywords: `tìm kiếm, search, ${query || ""}, bài viết, bạn bè, nhóm, ${APP_NAME}`,
  ogTitle: query ? `Kết quả tìm kiếm: ${query}` : "Tìm kiếm",
  ogDescription: `Khám phá nội dung và kết nối với mọi người trên ${APP_NAME}`,
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
  title: `${user.fullName || user.username || "Người dùng"} | ${APP_NAME}`,
  description:
    user.bio ||
    `Xem trang cá nhân của ${user.fullName || user.username} trên ${APP_NAME}. ${user.friendCount || 0} bạn bè, ${user.postCount || 0} bài viết.`,
  keywords: `${user.fullName}, ${user.username}, profile, trang cá nhân, ${APP_NAME}`,
  ogTitle: `${user.fullName || user.username}`,
  ogDescription:
    user.bio ||
    `Kết nối với ${user.fullName || user.username} trên ${APP_NAME}`,
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
    post.author?.fullName || post.author?.username || "Người dùng";
  const shortContent = post.content?.substring(0, 150) || "";
  const firstImage = post.media?.find((m) => m.mediaType === "IMAGE")?.url;

  return {
    title: `${authorName}: "${shortContent}${(post.content?.length || 0) > 150 ? "..." : ""}" | ${APP_NAME}`,
    description: `${authorName} đã đăng: "${shortContent}${(post.content?.length || 0) > 150 ? "..." : ""}" - ${post.totalReactions || 0} lượt thích, ${post.totalComments || 0} bình luận`,
    keywords: `bài viết, post, ${authorName}, ${APP_NAME}`,
    ogTitle: `Bài viết của ${authorName}`,
    ogDescription: shortContent || "Xem bài viết này trên " + APP_NAME,
    ogImage: firstImage || post.author?.avatar || "/og-image.jpg",
  };
};

// Friends page metadata
export const friendsMetadata = {
  title: `Bạn bè | ${APP_NAME}`,
  description: `Quản lý bạn bè, xem lời mời kết bạn và tìm kiếm bạn bè mới trên ${APP_NAME}.`,
  keywords:
    "bạn bè, friends, kết bạn, lời mời kết bạn, gợi ý bạn bè, social network",
  ogTitle: "Bạn bè",
  ogDescription: `Kết nối với bạn bè trên ${APP_NAME}`,
};

// Groups page metadata
export const groupsMetadata = {
  title: `Nhóm | ${APP_NAME}`,
  description: `Khám phá và tham gia các nhóm cộng đồng trên ${APP_NAME}. Kết nối với những người có cùng sở thích.`,
  keywords: "nhóm, groups, cộng đồng, community, sở thích, social groups",
  ogTitle: "Nhóm cộng đồng",
  ogDescription: `Tham gia các nhóm trên ${APP_NAME}`,
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
  title: `${group.name} | Nhóm | ${APP_NAME}`,
  description:
    group.description ||
    `Nhóm ${group.name} trên ${APP_NAME}. ${group.memberCount || 0} thành viên, ${group.postCount || 0} bài viết. ${group.privacy === "PUBLIC" ? "Nhóm công khai" : "Nhóm riêng tư"}.`,
  keywords: `nhóm ${group.name}, group, cộng đồng, ${APP_NAME}`,
  ogTitle: group.name,
  ogDescription:
    group.description || `Tham gia nhóm ${group.name} trên ${APP_NAME}`,
  ogImage: group.avatar || "/default-group.jpg",
});

// Reels/Watch page metadata
export const reelsMetadata = {
  title: `Watch | ${APP_NAME}`,
  description: `Xem video ngắn, reels và nội dung giải trí trên ${APP_NAME}. Khám phá video từ bạn bè và cộng đồng.`,
  keywords:
    "video, reels, watch, giải trí, video ngắn, short video, entertainment",
  ogTitle: "Watch - Video & Reels",
  ogDescription: `Khám phá video trên ${APP_NAME}`,
};

// Chat/Messenger metadata
export const chatMetadata = {
  title: `Messenger | ${APP_NAME}`,
  description: `Nhắn tin, gọi video và chia sẻ với bạn bè trên ${APP_NAME} Messenger. Kết nối mọi lúc mọi nơi.`,
  keywords:
    "messenger, chat, nhắn tin, video call, gọi điện, tin nhắn, messaging",
  ogTitle: "Messenger",
  ogDescription: `Nhắn tin với bạn bè trên ${APP_NAME}`,
};

// Notifications metadata
export const notificationsMetadata = {
  title: `Thông báo | ${APP_NAME}`,
  description: `Xem thông báo mới nhất từ bạn bè và hoạt động trên ${APP_NAME}.`,
  keywords: "thông báo, notifications, cập nhật, hoạt động",
  ogTitle: "Thông báo",
  ogDescription: `Cập nhật từ ${APP_NAME}`,
};

// Saved posts metadata
export const savedMetadata = {
  title: `Đã lưu | ${APP_NAME}`,
  description: `Xem các bài viết, video và nội dung bạn đã lưu trên ${APP_NAME}.`,
  keywords: "đã lưu, saved, bookmark, lưu bài viết",
  ogTitle: "Đã lưu",
  ogDescription: `Nội dung bạn đã lưu trên ${APP_NAME}`,
};

// Auth pages metadata
export const authMetadata = {
  login: {
    title: `Đăng nhập | ${APP_NAME}`,
    description: `Đăng nhập vào ${APP_NAME} để kết nối với bạn bè và gia đình.`,
    keywords: "đăng nhập, login, tài khoản, account",
    ogTitle: "Đăng nhập",
    ogDescription: `Đăng nhập vào ${APP_NAME}`,
  },
  register: {
    title: `Đăng ký | ${APP_NAME}`,
    description: `Tạo tài khoản ${APP_NAME} miễn phí. Kết nối với bạn bè, chia sẻ khoảnh khắc và khám phá cộng đồng.`,
    keywords: "đăng ký, register, tạo tài khoản, sign up",
    ogTitle: "Tạo tài khoản mới",
    ogDescription: `Tham gia ${APP_NAME} ngay hôm nay`,
  },
  forgotPassword: {
    title: `Quên mật khẩu | ${APP_NAME}`,
    description: `Khôi phục mật khẩu tài khoản ${APP_NAME} của bạn.`,
    keywords: "quên mật khẩu, forgot password, khôi phục tài khoản",
    ogTitle: "Khôi phục mật khẩu",
    ogDescription: `Đặt lại mật khẩu ${APP_NAME}`,
  },
};

// Settings metadata
export const settingsMetadata = {
  title: `Cài đặt | ${APP_NAME}`,
  description: `Quản lý tài khoản, quyền riêng tư và cài đặt ${APP_NAME} của bạn.`,
  keywords: "cài đặt, settings, tài khoản, quyền riêng tư, bảo mật",
  ogTitle: "Cài đặt",
  ogDescription: `Cài đặt tài khoản ${APP_NAME}`,
};

// Error pages metadata
export const errorMetadata = {
  notFound: {
    title: `Không tìm thấy trang | ${APP_NAME}`,
    description: "Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.",
    keywords: "404, không tìm thấy, page not found",
    ogTitle: "Không tìm thấy trang",
    ogDescription: "Trang không tồn tại",
  },
  serverError: {
    title: `Lỗi hệ thống | ${APP_NAME}`,
    description: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
    keywords: "500, lỗi, error",
    ogTitle: "Lỗi hệ thống",
    ogDescription: "Vui lòng thử lại sau",
  },
};

// AI Chat metadata
export const aiChatMetadata = {
  title: `Chat với AI | ${APP_NAME}`,
  description: `Trò chuyện với trợ lý AI thông minh trên ${APP_NAME}. Hỏi đáp, tìm kiếm thông tin và nhận hỗ trợ.`,
  keywords: "AI chat, trợ lý AI, chatbot, hỏi đáp, assistant",
  ogTitle: "Chat với AI",
  ogDescription: `Trợ lý AI của ${APP_NAME}`,
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
