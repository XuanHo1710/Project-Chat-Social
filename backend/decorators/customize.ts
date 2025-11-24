import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";


export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const UserInfo = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const { user } = ctx.switchToHttp().getRequest();
        return user;
    }
);



export const RESPONSE_MESSAGE = 'response_message';
export const ResponseMessage = (message: string) =>
    SetMetadata(RESPONSE_MESSAGE, message);