export type RoleEnum = "USER" | "ADMIN";

export type GenderEnum = "MALE" | "FEMALE" | "OTHER";

export type StatusEnum = "ACTIVE" | "DEACTIVE" | "HIDDEN";

export interface AddressType {
  _id?: string;
  label: string;
  province: { code: number; name: string };
  district: { code: number; name: string };
  ward: { code: number; name: string };
  detailAddress: string;
  isDefault: boolean;
}

export interface UserLoginType {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  avatar?: string;
  role?: string;
  gender?: string;
}

export interface AccountCardFriendType {
  id: string;
  name: string;
  mutualFriends: number;
  avatar?: string;
  username: string;
  time: string;
}

export interface FriendType {
  _id: string;
  firstName: string;
  lastName: string;
  gender: GenderEnum;
  username: string;
  role: RoleEnum;
  authProvider: string;
  status: StatusEnum;
  isBlocked: boolean;
  isActive: boolean;
  time: Date;
  avatar?: string;
  lastActive?: string;
  mutualFriends?: number;
}

export interface AccountType {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  gender: GenderEnum;
  username: string;
  role: RoleEnum;
  authProvider: string;
  status: StatusEnum;
  isBlocked: boolean;
  isActive: boolean;
  isDeleted: boolean;
  loginCount: number;
  addresses: string[];
}

export interface ProfileType {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  background?: string;
  bio?: string;
  gender: GenderEnum;
  birthday?: string;
  username: string;
  status: StatusEnum;
  lastActive?: string;
  addresses?: AddressType[];
  createdAt?: string;
}

export interface UpdateProfileType {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  background?: string;
  bio?: string;
  gender?: GenderEnum;
  birthday?: string;
  addresses?: AddressType[];
}
