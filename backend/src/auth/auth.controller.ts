import { Controller, Get, Post, UseGuards, Res, Req, Param, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, UserInfo } from 'decorators/customize';
import { Request, Response } from 'express';
import { LocalAuthGuard } from 'src/auth/passport/local-auth.guard';
import { Account } from 'src/account/entities/account.entity';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @UseGuards(LocalAuthGuard)
    @Post('/login')
    async login(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
        return this.authService.login(req.user as Account, response); // Default la user. Do thang lon Passport lam nhu vay djt con me :)))
    }



    @Post('/logout')
    handleLogout(@Res({ passthrough: true }) response: Response) {
        return this.authService.logout(response);
    }

    @Public()
    @Post("/refresh-token")
    refreshToken(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
        const refreshToken: string = req.cookies['refresh_token'];
        return this.authService.processNewToken(refreshToken, response);
    }

    @Get('profile')
    getProfile(@UserInfo() user: any) {
        return user;
    }


    @Public()
    @Get('/decode/:type')
    decodeToken(@Req() request: Request, @Param() { type }: { type: string }) {
        const token: string = request.cookies["token"] as string;
        return this.authService.decodeToken(token, type);
    }

    // @UseGuards(AuthGuard)
    // @Get('profile')
    // getProfile(@Request() req) {
    //   return req.employee;
    // }

}
