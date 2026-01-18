export type GroupPrivacy = "PUBLIC" | "PRIVATE";

export type GroupVisibility = "VISIBLE" | "HIDDEN";

export type GroupRole = "MEMBER" | "MODERATOR" | "ADMIN" | "OWNER";

export type MemberStatus = "PENDING" | "APPROVED" | "BANNED";

export interface GroupCreator {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username?: string;
}

export interface Group {
  _id: string;
  name: string;
  description: string;
  avatar: string | null;
  coverImage: string | null;
  privacy: GroupPrivacy;
  visibility: GroupVisibility;
  location: string | null;
  createdBy: GroupCreator;
  memberCount: number;
  postCount: number;
  rules: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Additional fields from API
  isMember?: boolean;
  isPending?: boolean;
  myRole?: GroupRole | null;
}

export interface GroupMember {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username?: string;
  status?: string;
  lastActive?: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupWithMembership extends Group {
  joinedAt?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  privacy?: GroupPrivacy;
  visibility?: GroupVisibility;
  location?: string;
  avatar?: string;
  coverImage?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  privacy?: GroupPrivacy;
  visibility?: GroupVisibility;
  location?: string;
  avatar?: string;
  coverImage?: string;
  rules?: string[];
}

export interface GroupMembersResponse {
  members: GroupMember[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PendingMember {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username?: string;
  requestedAt: string;
}

export interface PendingMembersResponse {
  members: PendingMember[];
  total: number;
  page: number;
  totalPages: number;
}
