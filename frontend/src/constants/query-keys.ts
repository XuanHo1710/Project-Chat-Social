export const QUERY_KEYS = {
  // CONVERSATIONS
  CONVERSATIONS: "conversations",
  CONVERSATION_BY_USER: "conversation_by_user",
  CONVERSATION_DETAIL: "conversation_detail",

  ACCOUNTS_PAGINATED: "accounts-paginated",
  ACCOUNT_BY_ID: "account-by-id",

  // RELATIONSHIPS
  FRIENDS: "friends",
  ADD_FRIEND: "add-friend",
  RECEIVED_REQUEST_FRIENDS: "received-request-friends",
  SENT_REQUEST_FRIENDS: "sent-request-friends",

  // CHATS
  CHATS: "chats",
  CHATS_PAGINATED: "chats_paginated",
  CHAT_DETAIL: "chat_detail",

  // Files
  FILES: "files",
  FILES_PAGINATED: "files_paginated",
  FILE_DETAIL: "file_detail",

  // Users
  USERS: "users",
  USERS_PAGINATED: "users_paginated",
  USER_DETAIL: "user_detail",
  USER_PROFILE: "user_profile",

  // Auth
  AUTH_ME: "auth_me",
  AUTH_SESSION: "auth_session",
  AUTH_PERMISSIONS: "auth_permissions",

  // Posts
  POSTS: "posts",
  POSTS_PAGINATED: "posts_paginated",
  POST_DETAIL: "post_detail",
  NEWS_FEED: "news_feed",
  USER_POSTS: "user_posts",

  // Stories
  STORIES_FEED: "stories_feed",
  MY_STORIES: "my_stories",
  STORY_DETAIL: "story_detail",
} as const;
