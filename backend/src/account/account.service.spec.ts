import { BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Relationship } from '../relationship/entities/relationship.entity';
import { AccountService } from './account.service';
import { AccountDocument } from './entities/account.entity';

describe('AccountService.updateProfile', () => {
  const userId = '507f1f77bcf86cd799439011';
  const savedProfile = { _id: userId, firstName: 'An' };
  let findOneAndUpdate: jest.Mock;
  let service: AccountService;

  beforeEach(() => {
    findOneAndUpdate = jest.fn();
    service = new AccountService(
      { findOneAndUpdate } as unknown as Model<AccountDocument>,
      {} as Model<Relationship>
    );
  });

  const result = (value: unknown) => ({ select: jest.fn().mockResolvedValue(value) });

  it('updates profile-only fields without revoking sessions', async () => {
    findOneAndUpdate.mockReturnValueOnce(result(savedProfile));
    await expect(service.updateProfile(userId, { firstName: ' An ', bio: '' })).resolves.toEqual(
      savedProfile
    );
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(userId), isDeleted: false },
      { $set: { firstName: 'An', bio: '' } },
      { new: true, runValidators: true }
    );
  });

  it('atomically revokes sessions for changed contact details', async () => {
    findOneAndUpdate.mockReturnValueOnce(result(savedProfile));
    await service.updateProfile(userId, { email: ' NEW@Example.com ', phone: '+84912345678' });
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [{ email: { $ne: 'new@example.com' } }, { phone: { $ne: '+84912345678' } }],
      }),
      { $set: { email: 'new@example.com', phone: '+84912345678' }, $inc: { authVersion: 1 } },
      { new: true, runValidators: true }
    );
  });

  it('keeps sessions when the full form resends unchanged contacts', async () => {
    findOneAndUpdate.mockReturnValueOnce(result(null)).mockReturnValueOnce(result(savedProfile));
    await service.updateProfile(userId, { email: 'same@example.com', phone: '', bio: 'Updated' });
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: new Types.ObjectId(userId), isDeleted: false, email: 'same@example.com', phone: null },
      { $set: { email: 'same@example.com', bio: 'Updated' }, $unset: { phone: 1 } },
      { new: true, runValidators: true }
    );
  });

  it('unsets cleared contacts and birthday instead of persisting empty identities', async () => {
    findOneAndUpdate.mockReturnValueOnce(result(savedProfile));
    await service.updateProfile(userId, { email: '', phone: '', birthday: null });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ $or: [{ email: { $ne: null } }, { phone: { $ne: null } }] }),
      { $set: {}, $unset: { email: 1, phone: 1, birthday: 1 }, $inc: { authVersion: 1 } },
      { new: true, runValidators: true }
    );
  });

  it('returns a client error for a duplicate identity', async () => {
    findOneAndUpdate.mockReturnValueOnce({
      select: jest.fn().mockRejectedValue({ code: 11000, keyPattern: { email: 1 } }),
    });
    await expect(service.updateProfile(userId, { email: 'used@example.com' })).rejects.toThrow(
      'email is already in use'
    );
  });

  it('rejects an invalid account id without querying MongoDB', async () => {
    await expect(service.updateProfile('invalid', { bio: 'Updated' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing account', async () => {
    findOneAndUpdate.mockReturnValue(result(null));
    await expect(
      service.updateProfile(userId, { email: 'missing@example.com' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
