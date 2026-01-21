import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordResetController } from './password-reset.controller';
import { PassportModule } from '@nestjs/passport';
import { AccountModule } from 'src/account/account.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OtpModule } from 'src/otp/otp.module';
const ms = require("ms")

@Module({
    imports: [
        AccountModule,
        PassportModule,
        OtpModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return {
                    secret: configService.get<string>("JWT_ACCESS_TOKEN_SECRET"),
                    signOptions: {
                        expiresIn: ms(configService.get<string>('JWT_ACCESS_EXPIRE'))
                    }
                }
            }
        }),
    ],
    controllers: [AuthController, PasswordResetController],
    providers: [AuthService, JwtService, ConfigService],
    exports: [AuthService, JwtService, ConfigService]
})
export class AuthModule { }
