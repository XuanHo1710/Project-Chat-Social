import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from 'src/account/entities/account.entity';
import { Conversation, ConversationSchema } from 'src/conversation/entities/conversation.entity';
import { RelationshipModule } from 'src/relationship/relationship.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Account.name, schema: AccountSchema }
    ]),
    forwardRef(() => RelationshipModule),
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule { }
