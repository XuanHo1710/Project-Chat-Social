import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { model } from 'mongoose';
import { AccountSchema } from '../entities/account.entity';
import { UpdateAccountDto } from './update-account.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transformOptions: { enableImplicitConversion: false },
});

const validateProfile = (body: unknown): Promise<UpdateAccountDto> =>
  pipe.transform(body, { type: 'body', metatype: UpdateAccountDto }) as Promise<UpdateAccountDto>;

const address = {
  _id: '507f1f77bcf86cd799439011',
  label: 'Home',
  province: { code: 1, name: 'Province' },
  district: { code: 2, name: 'District' },
  ward: { code: 3, name: 'Ward' },
  detailAddress: '',
  isDefault: false,
};

describe('UpdateAccountDto', () => {
  it('accepts the full profile form with empty optional fields and an existing address', async () => {
    const dto = await validateProfile({
      firstName: ' An ',
      lastName: ' Nguyen ',
      email: '',
      phone: '',
      birthday: '',
      avatar: '',
      background: '',
      bio: '',
      gender: 'OTHER',
      addresses: [address],
    });

    expect(dto).toMatchObject({ firstName: 'An', lastName: 'Nguyen', birthday: null });
    expect(dto.addresses?.[0]._id).toBe(address._id);
    const AccountModel = model('ProfileValidationTestAccount', AccountSchema);
    expect(new AccountModel(dto).validateSync()).toBeUndefined();
  });

  it('normalizes contact details before validation', async () => {
    await expect(
      validateProfile({ email: ' TEST@Example.com ', phone: ' +84912345678 ' })
    ).resolves.toMatchObject({ email: 'test@example.com', phone: '+84912345678' });
  });

  it('accepts a partial update and omitted fields', async () => {
    await expect(validateProfile({ bio: ' Hello ' })).resolves.toMatchObject({ bio: 'Hello' });
    await expect(validateProfile({})).resolves.toEqual({});
  });

  it.each(['username', 'password', 'googleId', 'authProvider', 'role'])(
    'rejects the non-profile field %s',
    async (field) => {
      await expect(validateProfile({ [field]: 'unwanted-value' })).rejects.toBeInstanceOf(
        BadRequestException
      );
    }
  );

  it.each([
    'firstName',
    'lastName',
    'email',
    'phone',
    'avatar',
    'background',
    'bio',
    'gender',
    'addresses',
  ])('rejects null for %s instead of passing it to the service', async (field) => {
    await expect(validateProfile({ [field]: null })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { firstName: '   ' },
    { lastName: '' },
    { email: 'invalid' },
    { phone: 'invalid' },
    { birthday: '2024-02-30' },
    { birthday: 'not-a-date' },
    { birthday: 123 },
    { birthday: false },
    { addresses: [{ ...address, _id: 'invalid' }] },
    { addresses: [{ ...address, province: undefined }] },
    { addresses: [{ ...address, district: null }] },
    { addresses: [{ ...address, ward: [] }] },
    { addresses: [{ ...address, province: { code: null, name: 'Province' } }] },
    { addresses: [{ ...address, label: ' ' }] },
    { addresses: [[address]] },
    { addresses: Array.from({ length: 11 }, () => address) },
  ])('rejects invalid profile data: %j', async (body) => {
    await expect(validateProfile(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts valid birthdays and an explicit clear', async () => {
    await expect(validateProfile({ birthday: '2000-02-29' })).resolves.toMatchObject({
      birthday: new Date('2000-02-29'),
    });
    await expect(validateProfile({ birthday: null })).resolves.toMatchObject({ birthday: null });
  });
});
