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


    @Public()
    @Post('/signup')
    async signup(@Body() signupData: { username: string; password: string; firstName: string; lastName: string }, @Res({ passthrough: true }) response: Response) {
        return this.authService.signup(signupData, response);
    }



    @Post('/logout')
    handleLogout(@Res({ passthrough: true }) response: Response) {
        console.log("Logout called in controller");
        return this.authService.logout(response);
    }

    @Public()
    @Post("/refresh-token")
    refreshToken(@Res({ passthrough: true }) response: Response, @Body() body: { refreshToken: string }) {
        console.log("Refresh token called in controller:", body.refreshToken);
        return this.authService.processNewToken(body.refreshToken, response);
    }

    @Get('/profile')
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
