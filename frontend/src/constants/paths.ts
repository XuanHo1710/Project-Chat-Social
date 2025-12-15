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

  // Roles
  ROLES: "/admin/roles",
  ROLE_ADD: "/admin/roles/add",
  ROLE_EDIT: (id: string) => `/admin/roles/edit/${id}`,
  ROLE_DETAIL: (id: string) => `/admin/roles/${id}`,

  // Permissions
  PERMISSIONS: "/admin/permissions",
  PERMISSION_ADD: "/admin/permissions/add",
  PERMISSION_EDIT: (id: string) => `/admin/permissions/edit/${id}`,
  PERMISSION_DETAIL: (id: string) => `/admin/permissions/${id}`,

  // Insurance Categories
  INSURANCE_CATEGORIES: "/admin/insurance-categories",
  INSURANCE_CATEGORY_ADD: "/admin/insurance-categories/add",
  INSURANCE_CATEGORY_EDIT: (id: string) =>
    `/admin/insurance-categories/edit/${id}`,
  INSURANCE_CATEGORY_DETAIL: (id: string) =>
    `/admin/insurance-categories/${id}`,

  // Benefits
  BENEFITS: "/admin/benefits",
  BENEFIT_ADD: "/admin/benefits/add",
  BENEFIT_EDIT: (id: string) => `/admin/benefits/edit/${id}`,
  BENEFIT_DETAIL: (id: string) => `/admin/benefits/${id}`,

  // Insurances
  INSURANCE: "/admin/insurances",
  INSURANCE_ADD: "/admin/insurance/add",
  INSURANCE_EDIT: (id: string) => `/admin/insurances/edit/${id}`,
  INSURANCE_DETAIL: (id: string) => `/admin/insurances/${id}`,

  // Users Staff
  USERS_STAFF: "/admin/users/staff",
  USER_STAFF_ADD: "/admin/users/staff/add",
  USER_STAFF_EDIT: (id: string) => `/admin/users/staff/edit/${id}`,
  USER_STAFF_DETAIL: (id: string) => `/admin/users/staff/${id}`,

  // Users Customers
  USERS_CUSTOMERS: "/admin/users/customers",
  USER_CUSTOMER_ADD: "/admin/users/customers/add",
  USER_CUSTOMER_EDIT: (id: string) => `/admin/users/customers/edit/${id}`,
  USER_CUSTOMER_DETAIL: (id: string) => `/admin/users/customers/${id}`,
  // Files
  FILES: "/admin/files",

  // Claims
  CLAIMS: "/admin/claims",
  CLAIM_DETAIL: (id: string) => `/admin/claims/${id}`,

  //Complaint
  COMPLAINTS: "/admin/complaints",

  // Promotions
  PROMOTIONS: "/admin/promotions",
  PROMOTION_ADD: "/admin/promotions/add",
  PROMOTION_EDIT: (id: string) => `/admin/promotions/edit/${id}`,
  PROMOTION_DETAIL: (id: string) => `/admin/promotions/${id}`,

  //Plan Tiers
  PLAN_TIERS: "/admin/plan-tiers",
  PLAN_TIER_ADD: "/admin/plan-tiers/add",
  PLAN_TIER_EDIT: (id: string) => `/admin/plan-tiers/edit/${id}`,
  PLAN_TIER_DETAIL: (id: string) => `/admin/plan-tiers/${id}`,

  // Units
  UNITS: "/admin/units",
  UNIT_ADD: "/admin/units/add",
  UNIT_EDIT: (id: string) => `/admin/units/edit/${id}`,
  UNIT_DETAIL: (id: string) => `/admin/units/${id}`,

  // Insurances
  INSURANCES: "/admin/insurances",
  INSURANCES_ADD: "/admin/insurances/add",
  INSURANCES_EDIT: (id: string) => `/admin/insurances/edit/${id}`,
  INSURANCES_DETAIL: (id: string) => `/admin/insurances/${id}`,

  // Customer Service - Spring AI & RAG
  DOCUMENT_INGESTION: "/admin/customer-service/document-ingestion",
  VECTOR_STORE: "/admin/customer-service/vector-store",

  // Contracts
  CONTRACTS: "/admin/contracts",
  CONTRACT_ADD: "/admin/contracts/add",
  CONTRACT_EDIT: (id: string) => `/admin/contracts/edit/${id}`,
  CONTRACT_DETAIL: (id: string) => `/admin/contracts/${id}`,
} as const;

export const CLIENT_PATH = {

  CHAT: "/chat",

  // Auth
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
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
  PROFILE_EDIT: "/profile/edit",

  // My Insurance
  MY_INSURANCES: "/my-insurances",
  MY_INSURANCE_DETAIL: (id: string) => `/my-insurances/${id}`,
} as const;
