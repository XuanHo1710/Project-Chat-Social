import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public, UserInfo } from 'decorators/customize';
import { AccountGoogleDto } from 'src/account/dto/account-google-dto';
import { Account } from 'src/account/entities/account.entity';
import { AuthService } from './auth.service';
import { GoogleExchangeDto, LoginDto, LogoutDto, RefreshTokenDto, SignupDto } from './dto/auth.dto';
import { GoogleAuthGuard } from './passport/google-auth.guard';
import { LocalAuthGuard } from './passport/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getClientCallbackUrl(params: Record<string, string>): string {
    const configuredClientUrl = this.configService.get<string>('CLIENT_URL');
    if (!configuredClientUrl) throw new Error('CLIENT_URL is not configured');
    const callbackUrl = new URL('/auth/google/callback', configuredClientUrl);
    if (!['http:', 'https:'].includes(callbackUrl.protocol)) {
      throw new Error('CLIENT_URL must use HTTP or HTTPS');
    }
    Object.entries(params).forEach(([key, value]) => callbackUrl.searchParams.set(key, value));
    return callbackUrl.toString();
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user as Account);
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('/login/google')
  loginWithGoogle(): void {
    // Passport performs the redirect.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('/google/callback')
  async googleAuthRedirect(@Req() request: Request, @Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    if (!request.user) {
      return response.redirect(this.getClientCallbackUrl({ error: 'login_failed' }));
    }

    try {
      const account = await this.authService.googleLogin(request.user as AccountGoogleDto);
      const result = await this.authService.login(account);
      const code = await this.authService.createGoogleExchange(result);
      return response.redirect(this.getClientCallbackUrl({ code }));
    } catch {
      return response.redirect(this.getClientCallbackUrl({ error: 'login_failed' }));
    }
  }

  @Public()
  @Post('/google/exchange')
  @HttpCode(HttpStatus.OK)
  exchangeGoogleCode(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }

  @Public()
  @Post('/signup')
  signup(@Body() signupData: SignupDto) {
    return this.authService.signup(signupData);
  }

  @Public()
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async handleLogout(@Req() request: Request, @Body() body: LogoutDto) {
    const authorization = request.headers['authorization'];
    const principalUserId = await this.authService.resolveOptionalPrincipalUserId(
      Array.isArray(authorization) ? authorization[0] : authorization,
    );
    return this.authService.logout(body.sessionId, principalUserId);
  }

  @Public()
  @Post('/refresh-token')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.processNewToken(body.sessionId);
  }

  @Get('/profile')
  getProfile(@UserInfo() user: unknown) {
    return user;
  }
}
