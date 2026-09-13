import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Relationship, RelationshipStatus } from '../relationship/entities/relationship.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { FindAllResponse } from './dto/filter-account-dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account, AccountDocument } from './entities/account.entity';

const INTERNAL_ACCOUNT_FIELDS = [
  '_id',
  'firstName',
  'lastName',
  'email',
  'avatar',
  'background',
  'bio',
  'gender',
  'birthday',
  'username',
  'role',
  'authProvider',
  'status',
  'lastLogin',
  'lastActive',
  'isBlocked',
  'expireBlockAt',
  'isActive',
  'showActivityStatus',
  'selfBlockedAt',
  'selfBlockExpireAt',
  'isDeleted',
  'deletedAt',
].join(' ');

const DEFAULT_PAGE_SIZE = 5;

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Relationship.name) private readonly relationshipModel: Model<Relationship>
  ) {}

  private toObjectId(value: string, fieldName = 'accountId'): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }
    return new Types.ObjectId(value);
  }

  private objectIdString(value: unknown): string {
    if (value instanceof Types.ObjectId) return value.toHexString();
    if (typeof value === 'string' && Types.ObjectId.isValid(value)) return value;
    throw new BadRequestException('Stored account reference is invalid');
  }

  private publicProfileProjection(): string {
    return '_id firstName lastName avatar background gender birthday username status lastActive bio createdAt showActivityStatus';
  }

  private hidePrivateActivity<T extends Record<string, any>>(account: T): T {
    if (account.showActivityStatus !== false) return account;
    return { ...account, status: 'HIDDEN', lastActive: null };
  }

  private formatRemainingDuration(expiry?: Date | string | null): string {
    if (!expiry) return '';
    const remainingMs = new Date(expiry).getTime() - Date.now();
    if (remainingMs <= 0) return '';
    const totalMinutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days} ngày`;
    if (hours > 0) {
      return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
    }
    return `${minutes} phút`;
  }

  private throwDuplicateIdentity(error: unknown): never {
    const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
    if (mongoError?.code !== 11000) throw error;
    const field = Object.keys(mongoError.keyPattern ?? {})[0] ?? 'identity';
    throw new BadRequestException(`${field} is already in use`);
  }

  async saveFcmToken(userId: string, token: string) {
    const accountId = this.toObjectId(userId);
    const normalizedToken = token.trim();
    if (!normalizedToken || normalizedToken.length > 4096) {
      throw new BadRequestException('FCM token is invalid');
    }

    const result = await this.accountModel.updateOne({ _id: accountId, isDeleted: false }, [
      {
        $set: {
          fcmTokens: {
            $slice: [{ $setUnion: [{ $ifNull: ['$fcmTokens', []] }, [normalizedToken]] }, -20],
          },
        },
      },
    ]);
    if (result.matchedCount === 0) throw new BadRequestException('Account not found');
    return { success: true };
  }

  async removeFcmToken(userId: string, token: string) {
    const result = await this.accountModel.updateOne(
      { _id: this.toObjectId(userId), isDeleted: false },
      { $pull: { fcmTokens: token.trim() } }
    );
    if (result.matchedCount === 0) throw new BadRequestException('Account not found');
    return { success: true };
  }

  async findForAuthentication(identifier: string): Promise<any> {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || normalizedIdentifier.length > 254) return null;

    return this.accountModel
      .findOne({
        $or: [
          { username: normalizedIdentifier },
          { email: normalizedIdentifier.toLowerCase() },
          { phone: normalizedIdentifier },
        ],
      })
      .select(`${INTERNAL_ACCOUNT_FIELDS} phone +password +authVersion`)
      .lean();
  }

  async findAuthState(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.accountModel.findById(id).select(`${INTERNAL_ACCOUNT_FIELDS} +authVersion`).lean();
  }

  async findByEmail(email: string): Promise<any> {
    return this.accountModel
      .findOne({ email: email.toLowerCase().trim() })
      .select(`${INTERNAL_ACCOUNT_FIELDS} +googleId +authVersion`);
  }

  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    const username = createAccountDto.username.trim();
    const phone = createAccountDto.phone?.trim() || undefined;
    const email = createAccountDto.email?.toLowerCase().trim() || undefined;
    const identityFilters: Record<string, string>[] = [{ username }];
    if (phone) identityFilters.push({ phone });
    if (email) identityFilters.push({ email });

    const existingAccount = await this.accountModel
      .findOne({ $or: identityFilters })
      .select('username phone email')
      .lean();
    if (existingAccount) {
      if (existingAccount.username === username) {
        throw new BadRequestException('User name này đã tồn tại trong hệ thống');
      }
      if (phone && existingAccount.phone === phone) {
        throw new BadRequestException('Số điện thoại này đã được sử dụng');
      }
      throw new BadRequestException('Email này đã được sử dụng');
    }

    const hashedPassword = createAccountDto.password
      ? await bcrypt.hash(createAccountDto.password, 12)
      : '';
    try {
      const savedAccount = await this.accountModel.create({
        firstName: createAccountDto.firstName.trim(),
        lastName: createAccountDto.lastName.trim(),
        username,
        password: hashedPassword,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(createAccountDto.avatar ? { avatar: createAccountDto.avatar.trim() } : {}),
        ...(createAccountDto.googleId ? { googleId: createAccountDto.googleId } : {}),
        ...(createAccountDto.authProvider ? { authProvider: createAccountDto.authProvider } : {}),
      });
      const safeAccount = savedAccount.toObject() as unknown as Record<string, unknown>;
      delete safeAccount.password;
      delete safeAccount.googleId;
      delete safeAccount.authVersion;
      return safeAccount as unknown as Account;
    } catch (error) {
      this.throwDuplicateIdentity(error);
    }
  }

  async findAll(user: { _id: string }, currentPage = 1): Promise<FindAllResponse> {
    const limit = DEFAULT_PAGE_SIZE;
    const page = Number.isFinite(currentPage) ? Math.max(1, Math.floor(currentPage)) : 1;
    const skip = limit * (page - 1);
    const me = this.toObjectId(user._id, 'userId');
    const meString = me.toString();

    const relationships = await this.relationshipModel
      .find(
        {
          $or: [{ userId: me }, { friendId: me }],
          status: { $in: ['ACCEPTED', 'PENDING', 'BLOCKED'] },
        },
        { userId: 1, friendId: 1, status: 1 }
      )
      .lean();
    const excludedUserIds = new Set<string>([meString]);
    for (const relationship of relationships) {
      excludedUserIds.add(
        this.objectIdString(relationship.userId) === meString
          ? this.objectIdString(relationship.friendId)
          : this.objectIdString(relationship.userId)
      );
    }
    const excludedIds = [...excludedUserIds].map((id) => new Types.ObjectId(id));
    const accountFilter = {
      _id: { $nin: excludedIds },
      role: { $ne: UserRole.BOT },
      isDeleted: false,
      isActive: true,
    };
    const [items, totalItems] = await Promise.all([
      this.accountModel
        .find(accountFilter)
        .select('_id firstName lastName avatar username expireBlockAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.accountModel.countDocuments(accountFilter),
    ]);

    const myFriendIds = relationships
      .filter((relationship) => relationship.status === RelationshipStatus.ACCEPTED)
      .map((relationship) =>
        this.objectIdString(relationship.userId) === meString
          ? new Types.ObjectId(this.objectIdString(relationship.friendId))
          : new Types.ObjectId(this.objectIdString(relationship.userId))
      );
    const candidateIds = items.map((item) => new Types.ObjectId(item._id.toString()));
    const mutualFriendsMap = new Map<string, number>();
    const mutualFriendPreviewMap = new Map<
      string,
      { _id: string; firstName: string; lastName: string; avatar?: string; username?: string }[]
    >();

    if (candidateIds.length > 0 && myFriendIds.length > 0) {
      const mutualRows = await this.relationshipModel.aggregate<{
        _id: Types.ObjectId;
        count: number;
        mutualFriendIds: Types.ObjectId[];
      }>([
        {
          $match: {
            status: 'ACCEPTED',
            $or: [
              { userId: { $in: candidateIds }, friendId: { $in: myFriendIds } },
              { friendId: { $in: candidateIds }, userId: { $in: myFriendIds } },
            ],
          },
        },
        {
          $project: {
            candidateId: { $cond: [{ $in: ['$userId', candidateIds] }, '$userId', '$friendId'] },
            mutualFriendId: {
              $cond: [{ $in: ['$userId', candidateIds] }, '$friendId', '$userId'],
            },
          },
        },
        {
          $group: {
            _id: '$candidateId',
            count: { $sum: 1 },
            mutualFriendIds: { $addToSet: '$mutualFriendId' },
          },
        },
      ]);
      const previewIds = [
        ...new Set(mutualRows.flatMap((row) => row.mutualFriendIds).map((id) => id.toString())),
      ].map((id) => new Types.ObjectId(id));
      const previewUsers = previewIds.length
        ? await this.accountModel
            .find({ _id: { $in: previewIds }, isDeleted: false, isActive: true })
            .select('_id firstName lastName avatar username')
            .lean()
        : [];
      const previewById = new Map(
        previewUsers.map((preview) => [
          preview._id.toString(),
          {
            _id: preview._id.toString(),
            firstName: preview.firstName,
            lastName: preview.lastName,
            avatar: preview.avatar,
            username: preview.username,
          },
        ])
      );
      for (const row of mutualRows) {
        mutualFriendsMap.set(row._id.toString(), row.count);
        mutualFriendPreviewMap.set(
          row._id.toString(),
          row.mutualFriendIds
            .map((id) => previewById.get(id.toString()))
            .filter((preview): preview is NonNullable<typeof preview> => !!preview)
            .slice(0, 3)
        );
      }
    }

    return {
      items: items.map((item) => ({
        id: item._id.toString(),
        name: `${item.firstName} ${item.lastName}`,
        mutualFriends: mutualFriendsMap.get(item._id.toString()) ?? 0,
        mutualFriendPreview: mutualFriendPreviewMap.get(item._id.toString()) ?? [],
        avatar: item.avatar,
        username: item.username,
        time: this.formatRemainingDuration(item.expireBlockAt),
      })),
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.accountModel.findById(id).select(`${INTERNAL_ACCOUNT_FIELDS} +authVersion`);
  }

  async findByUsername(username: string): Promise<any> {
    return this.accountModel.findOne({ username: username.trim() }).select(INTERNAL_ACCOUNT_FIELDS);
  }

  async findByPhone(phone: string): Promise<any> {
    return this.accountModel.findOne({ phone: phone.trim() }).select(INTERNAL_ACCOUNT_FIELDS);
  }

  async getOwnProfile(id: string): Promise<any> {
    const account = await this.accountModel
      .findOne({ _id: this.toObjectId(id), isDeleted: false })
      .select(
        '_id firstName lastName email phone avatar background gender birthday username status lastActive addresses bio createdAt showActivityStatus'
      )
      .lean();
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return account;
  }

  async getProfile(id: string): Promise<any> {
    const account = await this.accountModel
      .findOne({ _id: this.toObjectId(id), isDeleted: false, isActive: true })
      .select(this.publicProfileProjection())
      .lean();
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return this.hidePrivateActivity(account);
  }

  async getProfileByUsername(username: string): Promise<any> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || normalizedUsername.length > 100) {
      throw new BadRequestException('Username is invalid');
    }
    const account = await this.accountModel
      .findOne({ username: normalizedUsername, isDeleted: false, isActive: true })
      .select(this.publicProfileProjection())
      .lean();
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return this.hidePrivateActivity(account);
  }

  async updateProfile(id: string, updateData: UpdateAccountDto): Promise<any> {
    const filteredData: Record<string, unknown> = {};
    const unsetData: Record<string, 1> = {};
    const contactFilter: Record<string, string | null> = {};
    if (updateData.firstName !== undefined) filteredData.firstName = updateData.firstName.trim();
    if (updateData.lastName !== undefined) filteredData.lastName = updateData.lastName.trim();
    for (const field of ['email', 'phone'] as const) {
      const value = updateData[field];
      if (value === undefined) continue;
      const normalized = field === 'email' ? value.toLowerCase().trim() : value.trim();
      contactFilter[field] = normalized || null;
      // Sparse unique indexes require absent fields, rather than empty strings.
      if (normalized) filteredData[field] = normalized;
      else unsetData[field] = 1;
    }
    if (updateData.avatar !== undefined) filteredData.avatar = updateData.avatar.trim();
    if (updateData.background !== undefined) filteredData.background = updateData.background.trim();
    if (updateData.gender !== undefined) filteredData.gender = updateData.gender;
    if (updateData.birthday === null) unsetData.birthday = 1;
    else if (updateData.birthday !== undefined) filteredData.birthday = updateData.birthday;
    if (updateData.addresses !== undefined) filteredData.addresses = updateData.addresses;
    if (updateData.bio !== undefined) filteredData.bio = updateData.bio.trim();

    try {
      const accountFilter = { _id: this.toObjectId(id), isDeleted: false };
      const updateOperation: UpdateQuery<AccountDocument> = { $set: filteredData };
      if (Object.keys(unsetData).length > 0) updateOperation.$unset = unsetData;
      const projection =
        '_id firstName lastName email phone avatar background gender birthday username status lastActive addresses bio createdAt showActivityStatus';
      const contactChanges = Object.entries(contactFilter).map(([field, value]) => ({
        [field]: { $ne: value },
      }));
      if (contactChanges.length > 0) {
        // Compare and revoke sessions atomically, only when an identity changes.
        const changedAccount = await this.accountModel
          .findOneAndUpdate(
            { ...accountFilter, $or: contactChanges },
            { ...updateOperation, $inc: { authVersion: 1 } },
            { new: true, runValidators: true }
          )
          .select(projection);
        if (changedAccount) return changedAccount;
      }
      const account = await this.accountModel
        .findOneAndUpdate({ ...accountFilter, ...contactFilter }, updateOperation, {
          new: true,
          runValidators: true,
        })
        .select(projection);
      if (!account) throw new BadRequestException('Không tìm thấy người dùng');
      return account;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.throwDuplicateIdentity(error);
    }
  }

  async toggleActivityStatus(userId: string, show: boolean) {
    if (typeof show !== 'boolean') throw new BadRequestException('Activity setting is invalid');
    const account = await this.accountModel
      .findOneAndUpdate(
        { _id: this.toObjectId(userId), isDeleted: false },
        { $set: { showActivityStatus: show } },
        { new: true, runValidators: true }
      )
      .select('showActivityStatus');
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return account;
  }

  async getSettings(userId: string) {
    const account = await this.accountModel
      .findOne({ _id: this.toObjectId(userId), isDeleted: false })
      .select('showActivityStatus isActive selfBlockedAt selfBlockExpireAt')
      .lean();
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return {
      showActivityStatus: account.showActivityStatus ?? true,
      isActive: account.isActive ?? true,
      isSelfBlocked:
        !!account.selfBlockedAt &&
        !!account.selfBlockExpireAt &&
        new Date() < account.selfBlockExpireAt,
      selfBlockExpireAt: account.selfBlockExpireAt,
    };
  }

  async selfBlockAccount(userId: string) {
    const now = new Date();
    const expireDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const account = await this.accountModel.findOneAndUpdate(
      { _id: this.toObjectId(userId), isDeleted: false, isActive: true },
      {
        $set: { selfBlockedAt: now, selfBlockExpireAt: expireDate },
        $inc: { authVersion: 1 },
      },
      { new: true }
    );
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return {
      message: 'Tài khoản đã được tạm khóa trong 30 ngày',
      selfBlockedAt: now,
      selfBlockExpireAt: expireDate,
    };
  }

  async unblockSelfAccount(userId: string) {
    const account = await this.accountModel.findOneAndUpdate(
      { _id: this.toObjectId(userId), isDeleted: false },
      {
        $set: { selfBlockedAt: null, selfBlockExpireAt: null, isActive: true },
        $inc: { authVersion: 1 },
      },
      { new: true }
    );
    if (!account) throw new BadRequestException('Không tìm thấy người dùng');
    return { message: 'Tài khoản đã được mở khóa' };
  }

  async updatePassword(email: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const result = await this.accountModel.updateOne(
      { email: email.toLowerCase().trim(), isDeleted: false },
      { $set: { password: hashedPassword }, $inc: { authVersion: 1 } }
    );
    return result.modifiedCount > 0;
  }

  async findByEmailForPasswordReset(email: string): Promise<any> {
    return this.accountModel
      .findOne({ email: email.toLowerCase().trim(), isDeleted: false })
      .select('_id email firstName lastName');
  }

  async recordLogin(userId: string, today: Date) {
    const accountId = this.toObjectId(userId);
    const day = new Date(today);
    day.setUTCHours(0, 0, 0, 0);
    const dayString = day.toISOString().slice(0, 10);
    const now = new Date();

    await this.accountModel.updateOne({ _id: accountId, isDeleted: false }, [
      {
        $set: {
          loginCount: { $add: [{ $ifNull: ['$loginCount', 0] }, 1] },
          lastLogin: now,
          loginHistory: {
            $let: {
              vars: { history: { $ifNull: ['$loginHistory', []] } },
              in: {
                $slice: [
                  {
                    $cond: [
                      {
                        $in: [
                          dayString,
                          {
                            $map: {
                              input: '$$history',
                              as: 'entry',
                              in: {
                                $dateToString: {
                                  format: '%Y-%m-%d',
                                  date: '$$entry.date',
                                  timezone: 'UTC',
                                },
                              },
                            },
                          },
                        ],
                      },
                      {
                        $map: {
                          input: '$$history',
                          as: 'entry',
                          in: {
                            $cond: [
                              {
                                $eq: [
                                  {
                                    $dateToString: {
                                      format: '%Y-%m-%d',
                                      date: '$$entry.date',
                                      timezone: 'UTC',
                                    },
                                  },
                                  dayString,
                                ],
                              },
                              {
                                $mergeObjects: [
                                  '$$entry',
                                  { count: { $add: [{ $ifNull: ['$$entry.count', 0] }, 1] } },
                                ],
                              },
                              '$$entry',
                            ],
                          },
                        },
                      },
                      { $concatArrays: ['$$history', [{ date: day, count: 1 }]] },
                    ],
                  },
                  -365,
                ],
              },
            },
          },
        },
      },
    ]);
  }

  async getTrafficData(
    days = 7
  ): Promise<Array<{ date: string; logins: number; activeUsers: number }>> {
    const normalizedDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.floor(days))) : 7;
    const endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (normalizedDays - 1));
    startDate.setUTCHours(0, 0, 0, 0);

    const rows = await this.accountModel.aggregate<{
      _id: string;
      logins: number;
      activeUsers: number;
    }>([
      { $unwind: '$loginHistory' },
      { $match: { 'loginHistory.date': { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$loginHistory.date',
              timezone: 'UTC',
            },
          },
          logins: { $sum: '$loginHistory.count' },
          userIds: { $addToSet: '$_id' },
        },
      },
      { $project: { _id: 1, logins: 1, activeUsers: { $size: '$userIds' } } },
    ]);
    const rowByDate = new Map(rows.map((row) => [row._id, row]));

    return Array.from({ length: normalizedDays }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const dateString = date.toISOString().slice(0, 10);
      const row = rowByDate.get(dateString);
      return {
        date: dateString,
        logins: row?.logins ?? 0,
        activeUsers: row?.activeUsers ?? 0,
      };
    });
  }
}
