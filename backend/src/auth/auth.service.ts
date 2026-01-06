import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { AccountService } from 'src/account/account.service';
import { Account } from 'src/account/entities/account.entity';
// import ms from 'ms';

const bcrypt = require('bcrypt');
const ms = require('ms');

@Injectable()
export class AuthService {
  constructor(
    private accountService: AccountService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async verifyAccount(username: string, passPlainText: string): Promise<any | null> {
    const account = await this.accountService.findByUsername(username);
    const isCorrect = bcrypt.compareSync(passPlainText, account?.password || '');
    if (account && isCorrect) {
      return account;
    }
    return null;
  }

  async login(account: Account, response: Response) {
    if (!account) {
      throw new BadRequestException('Not found bla bla');
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

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE')),
    });

    account.accessToken = access_token;

    // await this.accountService.update(account._id.toString(), account);

    // Set refresh_token as cookies
    // HttpOnly only server can use this cookies. Javascript can't use this cookies
    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      maxAge: ms(this.configService.get<string>('JWT_REFRESH_EXPIRE') as string),
    });

    // response.cookie("access_token", access_token,
    //     {
    //         httpOnly: true,
    //         maxAge: ms(this.configService.get<string>('JWT_ACCESS_EXPIRE') as string),
    //     }
    // );

    return {
      access_token,
      refresh_token,
      payload,
    };
  }

  async signup(
    signupData: { username: string; password: string; firstName: string; lastName: string },
    response: Response
  ) {
    const newAccount = await this.accountService.create({
      username: signupData.username,
      password: signupData.password,
      firstName: signupData.firstName,
      lastName: signupData.lastName,
    });
    return this.login(newAccount, response);
  }

  processNewToken = async (refreshToken: string, response: Response) => {
    console.log('Refresh token nè kakakak');
    try {
      const detailPayload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

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

      return { access_token, payload: { ...payload } };
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

  async logout(response: Response) {
    console.log('Logout backend nè');
    response.clearCookie('refresh_token');
    // response.clearCookie("access_token");
    return { message: 'Success Logout' };
  }
}
