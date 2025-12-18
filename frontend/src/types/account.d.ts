export type RoleEnum = "USER" | "ADMIN";

export type GenderEnum = "MALE" | "FEMALE" | "OTHER";

export type StatusEnum = "ACTIVE" | "DEACTIVE";


export interface UserLoginType {
    id: string;
    username: string;
    email?: string;
    fullName?: string;
    avatar?: string;
    role?: string;
    gender?: string;
}


export interface AccountType {
    _id: string,
    firstName: string,
    lastName: string,
    avatar?: string,
    gender: GenderEnum,
    username: string,
    role: RoleEnum,
    authProvider: string,
    status: StatusEnum,
    isBlocked: boolean,
    isActive: boolean,
    isDeleted: boolean,
    loginCount: number,
    addresses: string[],
}