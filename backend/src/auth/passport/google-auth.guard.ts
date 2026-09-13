import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private static readonly STATE_COOKIE = 'google_oauth_state';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const isCallback = request.path.endsWith('/google/callback');

    if (isCallback) {
      const state = typeof request.query.state === 'string' ? request.query.state : '';
      const expected = request.cookies?.[GoogleAuthGuard.STATE_COOKIE] as string | undefined;
      response.clearCookie(GoogleAuthGuard.STATE_COOKIE, { path: '/' });

      const providedBuffer = Buffer.from(state);
      const expectedBuffer = Buffer.from(expected || '');
      if (
        !state ||
        !expected ||
        providedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(providedBuffer, expectedBuffer)
      ) {
        throw new UnauthorizedException('Google OAuth state is invalid');
      }
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.endsWith('/google/callback')) return undefined;

    const response = context.switchToHttp().getResponse<Response>();
    const state = randomBytes(32).toString('hex');
    response.cookie(GoogleAuthGuard.STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    return { state };
  }
}
