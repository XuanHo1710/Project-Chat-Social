import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account, AccountDocument, AccountSchema } from 'src/account/entities/account.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import * as bcrypt from 'bcrypt';


@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) { }



  async create(createAccountDto: CreateAccountDto) {
    const usernameExist = await this.accountModel.findOne({ username: createAccountDto.username });
    if (usernameExist) {
      throw new BadRequestException("User name này đã tồn tại trong hệ thống");
    }


    let hashedPassword: string = "";
    if (createAccountDto.password) {
      hashedPassword = await bcrypt.hash(createAccountDto.password, 10);
    }

    createAccountDto.password = hashedPassword;

    const account = new this.accountModel(createAccountDto);
    return account.save();
  }

  async findAll() {
    return await this.accountModel.find({});
  }

  async findOne(id: string) {
    return await this.accountModel.findById(id);
  }

  async findByUsername(username: string) {
    return await this.accountModel.findOne({ username: username });
  }

  update(id: string, updateAccountDto: UpdateAccountDto) {
    return `This action updates a #${id} account`;
  }

  remove(id: string) {
    return `This action removes a #${id} account`;
  }
}
