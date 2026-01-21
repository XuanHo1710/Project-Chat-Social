import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account, AccountDocument, AccountSchema } from 'src/account/entities/account.entity';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import * as bcrypt from 'bcrypt';
import { Relationship } from 'src/relationship/entities/relationship.entity';
import { FindAllResponse } from 'src/account/dto/filter-account-dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Relationship.name) private relationshipModel: Model<Relationship>
  ) { }

  async saveFcmToken(userId: string, token: string) {
    await this.accountModel.updateOne(
      { _id: userId },
      { $addToSet: { fcmTokens: token } } // tránh trùng
    );
    return { success: true };
  }

  async findByEmail(email: string) {
    return await this.accountModel
      .findOne({ email: email })
      .select('-accessToken -resetPasswordToken -resetPasswordExpires');
  }

  async create(createAccountDto: CreateAccountDto) {
    const usernameExist = await this.accountModel.findOne({ username: createAccountDto.username });
    if (usernameExist) {
      throw new BadRequestException('User name này đã tồn tại trong hệ thống');
    }

    let hashedPassword: string = '';
    if (createAccountDto.password) {
      hashedPassword = await bcrypt.hash(createAccountDto.password, 10);
    }

    createAccountDto.password = hashedPassword;

    const account = new this.accountModel(createAccountDto);
    return account.save();
  }

  // Get all accounts to test add friends
  async findAll(user, currentPage: number = 1): Promise<FindAllResponse> {
    const limit = 5;
    const skip = limit * (currentPage - 1);

    const me = new Types.ObjectId(user._id);
    // 1. Lấy tất cả relationship liên quan đến mình
    const relationships = await this.relationshipModel
      .find(
        {
          $or: [
            {
              $and: [
                { userId: me },
                { $or: [{ status: 'ACCEPTED' }, { status: 'PENDING' }, { status: 'BLOCKED' }] },
              ],
            },
            {
              $and: [
                { friendId: me },
                { $or: [{ status: 'ACCEPTED' }, { status: 'PENDING' }, { status: 'BLOCKED' }] },
              ],
            },
          ],
        },
        { userId: 1, friendId: 1 } // chỉ lấy field cần
      )
      .lean();

    // 2. Loại bỏ những userId, friendId đã có trong mối quan hệ với mình
    const excludedUserIds = new Set<string>();

    excludedUserIds.add(me.toString()); // loại chính mình

    relationships.forEach((r) => {
      if (r.userId.toString() === me.toString()) {
        excludedUserIds.add(r.friendId.toString());
      } else {
        excludedUserIds.add(r.userId.toString());
      }
    });

    const excludedIdsArray = Array.from(excludedUserIds).map((id) => new Types.ObjectId(id));

    const [items, totalItems] = await Promise.all([
      this.accountModel
        .find({
          _id: { $nin: excludedIdsArray },
          isDeleted: false,
          isActive: true,
        })
        .select('_id firstName lastName avatar')
        .skip(skip)
        .limit(limit)
        .lean(),

      this.accountModel.countDocuments({
        _id: { $nin: excludedIdsArray },
        isDeleted: false,
        isActive: true,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((item) => ({
        id: item._id,
        name: item.firstName + ' ' + item.lastName,
        mutualFriends: 0,
        avatar: item.avatar,
        time: '1 ngày',
      })),
      totalItems,
      totalPages,
      currentPage,
    };
  }

  async findOne(id: string) {
    return await this.accountModel
      .findById(id)
      .select('-password -accessToken -resetPasswordToken -resetPasswordExpires');
  }

  async findByUsername(username: string) {
    return await this.accountModel
      .findOne({ username: username })
      .select('-accessToken -resetPasswordToken -resetPasswordExpires');
  }

  // Get profile by ID (for viewing other users)
  async getProfile(id: string) {
    const account = await this.accountModel
      .findById(id)
      .select(
        'firstName lastName email phone avatar background gender birthday username status lastActive addresses bio createdAt'
      );
    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    return account;
  }

  // Get profile by username
  async getProfileByUsername(username: string) {
    const account = await this.accountModel
      .findOne({ username })
      .select(
        'firstName lastName email phone avatar background gender birthday username status lastActive addresses bio createdAt'
      );
    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }
    return account;
  }

  // Update profile
  async updateProfile(id: string, updateData: UpdateAccountDto) {
    // Prevent updating sensitive fields
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'avatar',
      'background',
      'gender',
      'birthday',
      'addresses',
      'bio',
    ];

    const filteredData: any = {};
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    }

    const account = await this.accountModel
      .findByIdAndUpdate(id, { $set: filteredData }, { new: true })
      .select('-password -accessToken -resetPasswordToken -resetPasswordExpires');

    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return account;
  }

  // Toggle activity status visibility
  async toggleActivityStatus(userId: string, show: boolean) {
    const account = await this.accountModel
      .findByIdAndUpdate(userId, { showActivityStatus: show }, { new: true })
      .select('-password -accessToken -resetPasswordToken -resetPasswordExpires');

    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return account;
  }

  // Get user settings
  async getSettings(userId: string) {
    const account = await this.accountModel
      .findById(userId)
      .select('showActivityStatus isActive selfBlockedAt selfBlockExpireAt');

    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return {
      showActivityStatus: account.showActivityStatus ?? true,
      isActive: account.isActive ?? true,
      isSelfBlocked:
        account.selfBlockedAt &&
        account.selfBlockExpireAt &&
        new Date() < account.selfBlockExpireAt,
      selfBlockExpireAt: account.selfBlockExpireAt,
    };
  }

  // Self-block account for 30 days
  async selfBlockAccount(userId: string) {
    const now = new Date();
    const expireDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const account = await this.accountModel
      .findByIdAndUpdate(
        userId,
        {
          selfBlockedAt: now,
          selfBlockExpireAt: expireDate,
          isActive: false,
        },
        { new: true }
      )
      .select('-password -accessToken -resetPasswordToken -resetPasswordExpires');

    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return {
      message: 'Tài khoản đã được tạm khóa trong 30 ngày',
      selfBlockedAt: now,
      selfBlockExpireAt: expireDate,
    };
  }

  // Unblock self (cancel self-block early)
  async unblockSelfAccount(userId: string) {
    const account = await this.accountModel
      .findByIdAndUpdate(
        userId,
        {
          selfBlockedAt: null,
          selfBlockExpireAt: null,
          isActive: true,
        },
        { new: true }
      )
      .select('-password -accessToken -resetPasswordToken -resetPasswordExpires');

    if (!account) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    return {
      message: 'Tài khoản đã được mở khóa',
    };
  }

  /**
   * Update user password
   */
  async updatePassword(email: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await this.accountModel.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { password: hashedPassword } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Find account by email (full details for password reset)
   */
  async findByEmailForPasswordReset(email: string) {
    return await this.accountModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('_id email firstName lastName');
  }
}
