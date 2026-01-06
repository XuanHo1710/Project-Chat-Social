export const ADMIN_PATH = {
  // Auth
  LOGIN: "/admin/login",

  // ProfileAccountADMIN
  PROFILE: "/admin/profile",
  CHANGE_PASSWORD: "/admin/change-password",

  // Dashboard
  DASHBOARD: "/admin/dashboard",

  // Users
  USERS: "/admin/users",
  USER_ADD: "/admin/users/add",
  USER_EDIT: (id: string) => `/admin/users/edit/${id}`,

  // Accounts
  ACCOUNTS: "/admin/accounts",
  ACCOUNT_ADD: "/admin/accounts/add",
  ACCOUNT_EDIT: (id: string) => `/admin/accounts/edit/${id}`,
  ACCOUNT_DETAIL: (id: string) => `/admin/accounts/${id}`,
} as const;

export const CLIENT_PATH = {
  CHAT: "/chat",

  // Auth
  LOGIN: "/auth/login",
  REGISTER: "/auth/signin",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",

  // Main
  HOME: "/",
  ABOUT: "/about",
  CONTACT: "/contact",
  NETWORK: "/network",
  CUSTOMER_SERVICE: "/customer-service",
  CLAIMS: "/claims",
  CAREERS: "/careers",

  // Insurance
  INSURANCES: "/insurances",
  INSURANCE_DETAIL: (id: string) => `/insurances/${id}`,
  INSURANCE_CATEGORY: (slug: string) => `/insurances/category/${slug}`,

  // Profile
  PROFILE: "/profile",
  PROFILE_BY_USERNAME: (username: string) => `/profile/${username}`,
  PROFILE_EDIT: "/profile/edit",

  // My Insurance
  MY_INSURANCES: "/my-insurances",
  MY_INSURANCE_DETAIL: (id: string) => `/my-insurances/${id}`,
} as const;
