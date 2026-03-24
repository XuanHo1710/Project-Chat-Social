import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountService } from 'src/account/account.service';
import { AccountGoogleDto } from 'src/account/dto/account-google-dto';
import { Account } from 'src/account/entities/account.entity';
import { AuthSessionService } from './auth-session.service';
import { randomUUID } from 'crypto';
// import ms from 'ms';

const bcrypt = require('bcrypt');
const ms = require('ms');

@Injectable()
export class AuthService {
  constructor(
    private accountService: AccountService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private authSessionService: AuthSessionService
  ) {}

  async googleLogin(accountGoogle: AccountGoogleDto) {
    if (!accountGoogle) throw new BadRequestException('Account google không tồn tại');
    // Check account exist
    const existingAccount = await this.accountService.findByEmail(accountGoogle.email);
    if (existingAccount) {
      return existingAccount;
    }
    // Create new account
    const newAccount = await this.accountService.create({
      username: accountGoogle.googleId,
      password: accountGoogle.googleId, // Use Google ID as password for simplicity
      firstName: accountGoogle.firstName,
      lastName: accountGoogle.lastName,
      email: accountGoogle.email,
      avatar: accountGoogle.picture,
      googleId: accountGoogle.googleId,
      authProvider: 'GOOGLE',
    });
    return newAccount;
  }

  async verifyAccount(username: string, passPlainText: string): Promise<any | null> {
    let account = await this.accountService.findByUsername(username);
    if (!account) {
      account = await this.accountService.findByEmail(username);
    }
    const isCorrect = bcrypt.compareSync(passPlainText, account?.password || '');
    if (account && isCorrect) {
      return account;
    }
    return null;
  }

  async login(account: Account) {
    if (!account) {
      throw new BadRequestException('Not found bla bla');
    }

    // Tăng loginCount và ghi lịch sử đăng nhập
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.accountService.recordLogin(account._id.toString(), today);

    const sessionId = randomUUID();

    const payload = {
      fullname: account.firstName + ' ' + account.lastName,
      gender: account.gender,
      role: account.role,
      username: account.username,
      avatar: account.avatar,
      email: account.email,
      _id: account._id.toString(),
    };

    const access_token = this.createAccessToken(payload);

    const refresh_token = this.jwtService.sign(
      {
        ...payload,
        sid: sessionId,
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE')),
      }
    );

    await this.authSessionService.setRefreshToken(
      sessionId,
      refresh_token,
      ms(this.configService.get<string>('JWT_REFRESH_EXPIRE'))
    );

    account.accessToken = access_token;

    return {
      access_token,
      session_id: sessionId,
      payload,
    };
  }

  async signup(signupData: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const newAccount = await this.accountService.create({
      username: signupData.username,
      password: signupData.password,
      firstName: signupData.firstName,
      lastName: signupData.lastName,
    });
    return this.login(newAccount);
  }

  processNewToken = async (sessionId: string) => {
    try {
      const storedRefreshToken = await this.authSessionService.getRefreshToken(sessionId);
      if (!storedRefreshToken) {
        throw new BadRequestException('Session không tồn tại hoặc đã hết hạn');
      }

      const detailPayload = this.jwtService.verify(storedRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

      if (detailPayload?.sid && detailPayload.sid !== sessionId) {
        throw new BadRequestException('Session không hợp lệ');
      }

      const account = (await this.accountService.findByUsername(detailPayload.username)) as Account;
      if (!account) {
        throw new BadRequestException('Tài khoản không tồn tại');
      }

      const payload = {
        fullname: account.firstName + ' ' + account.lastName,
        gender: account.gender,
        role: account.role,
        username: account.username,
        avatar: account.avatar,
        email: account.email,
        _id: account._id.toString(),
      };

      const access_token = this.createAccessToken(payload);

      // await this.accountService.update(
      //     access_token,
      //     ms(this.configService.get<string>('JWT_ACCESS_EXPIRE') as string),
      //     account._id.toString()
      // );

      // response.cookie("access_token", access_token, {
      //     httpOnly: true,
      //     maxAge: ms(this.configService.get<string>('JWT_ACCESS_EXPIRE') as string),
      // });

      return { access_token, session_id: sessionId, payload: { ...payload } };
    } catch (err) {
      throw new BadRequestException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  };

  createAccessToken = (payload: any) => {
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: ms(this.configService.get<string>('JWT_ACCESS_EXPIRE')),
    });
    return access_token;
  };

  decodeToken = (token: string, type: string) => {
    if (type === 'access') {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      });
    }
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
    });
  };

  async logout(sessionId?: string) {
    if (sessionId) {
      await this.authSessionService.removeRefreshToken(sessionId);
    }
    return { message: 'Success Logout' };
  }
}
