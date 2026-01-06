import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { Account } from 'src/account/entities/account.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'username',
      passwordField: 'password',
    });
  }

  async validate(username: string, password: string): Promise<Account> {
    const account = await this.authService.verifyAccount(username, password);
    if (!account) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return account;
  }
}
