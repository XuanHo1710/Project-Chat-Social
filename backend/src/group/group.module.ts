import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupGateway } from './group.gateway';
import { Group, GroupSchema } from './entities/group.entity';
import { GroupMember, GroupMemberSchema } from './entities/group-member.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { Account, AccountSchema } from 'src/account/entities/account.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: Account.name, schema: AccountSchema },
    ]),
    forwardRef(() => NotificationModule),
    AuthModule,
  ],
  controllers: [GroupController],
  providers: [GroupService, GroupGateway],
  exports: [GroupService, GroupGateway],
})
export class GroupModule {}
