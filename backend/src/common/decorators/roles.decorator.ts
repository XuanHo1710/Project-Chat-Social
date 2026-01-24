import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Admin decorator - chỉ ADMIN mới có quyền truy cập
export const Admin = () => Roles('ADMIN');

// Employee decorator - ADMIN và EMPLOYEE đều có quyền truy cập
export const Employee = () => Roles('ADMIN', 'EMPLOYEE');
