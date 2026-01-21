import { Controller, Get, Post, UseGuards, Res, Req, Param, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, UserInfo } from 'decorators/customize';
import { Request, Response } from 'express';
import { LocalAuthGuard } from 'src/auth/passport/local-auth.guard';
import { Account } from 'src/account/entities/account.entity';
import { GoogleAuthGuard } from 'src/auth/passport/google-auth.guard';
import { AccountGoogleDto } from 'src/account/dto/account-google-dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(req.user as Account, response); // Default la user. Do thang lon Passport lam nhu vay djt con me :)))
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('/login/google')
  async loginWithGoogle() {
    // Guard se tu dong xu ly redirect sang Google va xu ly callback
  }

  @Get('/google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() request: Request, @Res() response: Response) {
    const user = request.user;
    if (!user) {
      return response.send(`
      <script>
        window.opener.postMessage(
          { type: 'GOOGLE_LOGIN_FAILED' },
          '${process.env.CLIENT_URL}'
        );
        window.close();
      </script>
    `);
    }

    try {
      const checkAccountGoogle = await this.authService.googleLogin(user as AccountGoogleDto);
      const result = await this.authService.login(checkAccountGoogle, response);
      return response.send(`
      <script>
        window.opener.postMessage(
          {
            type: 'GOOGLE_LOGIN_SUCCESS',
            payload: ${JSON.stringify(result)}
          },
          '${process.env.CLIENT_URL}'
        );
        window.close();
      </script>
    `);
    } catch (error) {
      return response.send(`
      <script>
        window.opener.postMessage(
          { type: 'GOOGLE_LOGIN_FAILED' },
          '${process.env.CLIENT_URL}'
        );
        window.close();
      </script>
    `);
    }
  }

  @Public()
  @Post('/signup')
  async signup(
    @Body() signupData: { username: string; password: string; firstName: string; lastName: string },
    @Res({ passthrough: true }) response: Response
  ) {
    return this.authService.signup(signupData, response);
  }

  @Post('/logout')
  handleLogout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }

  @Public()
  @Post('/refresh-token')
  refreshToken(
    @Res({ passthrough: true }) response: Response,
    @Body() body: { refreshToken: string }
  ) {
    return this.authService.processNewToken(body.refreshToken, response);
  }

  @Get('/profile')
  getProfile(@UserInfo() user: any) {
    return user;
  }

  @Public()
  @Get('/decode/:type')
  decodeToken(@Req() request: Request, @Param() { type }: { type: string }) {
    const token: string = request.cookies['token'] as string;
    return this.authService.decodeToken(token, type);
  }

  // @UseGuards(AuthGuard)
  // @Get('profile')
  // getProfile(@Request() req) {
  //   return req.employee;
  // }
}
