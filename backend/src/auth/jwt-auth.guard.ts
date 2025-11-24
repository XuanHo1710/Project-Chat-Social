import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'decorators/customize';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector
    ) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // const request = context.switchToHttp().getRequest();
        // const targetPath = request?.route?.path;
        // const targetMethod = request?.method;



        // if (user?.role?.permission && user?.role?.permission.length > 0) {

        //     const isExist = user?.role?.permission?.find(p => (
        //         targetMethod === p?.method
        //         && targetPath === p?.path
        //     ))

        //     if (isExist === undefined &&
        //         targetPath !== "/api/v1/admin/account-employee" &&
        //         targetPath !== "/api/v1/admin/auth/decode-access" &&
        //         targetPath !== "/api/v1/admin/auth/refresh-token" &&
        //         targetPath !== "/api/v1/admin/auth/profile" &&
        //         targetPath !== "/api/v1/admin/auth/logout"
        //     ) {
        //         throw new ForbiddenException("You don't have permission to access this endpoint")
        //     }
        // }

        if (err || !user) {
            throw err || new UnauthorizedException("Token is not valid")
        }

        return user;
    }

    // private extractTokenFromHeader(request: any): string | undefined {
    //     const [type, token] = request.headers.authorization?.split(' ') ?? [];
    //     return type === 'Bearer' ? token : undefined;
    // }
}