import { Module } from '@nestjs/common';
import { RelationshipService } from './relationship.service';
import { RelationshipController } from './relationship.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Relationship, RelationshipSchema } from 'src/relationship/entities/relationship.entity';
import { Account, AccountSchema } from 'src/account/entities/account.entity';
import { Conversation, ConversationSchema } from 'src/conversation/entities/conversation.entity';
import { RelationshipGateway } from 'src/relationship/relationship.gateway';
import { AccountModule } from 'src/account/account.module';
import { NotificationModule } from 'src/notification/notification.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserBlock, UserBlockSchema } from './entities/user-block.entity';
import {
  UserRestriction,
  UserRestrictionSchema,
} from './entities/user-restriction.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relationship.name, schema: RelationshipSchema },
      { name: Account.name, schema: AccountSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
      { name: UserRestriction.name, schema: UserRestrictionSchema },
    ]),
    AccountModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [RelationshipController],
  providers: [RelationshipGateway, RelationshipService],
  exports: [RelationshipService],
})
export class RelationshipModule { }
