import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { Story, StorySchema } from './entities/story.entity';
import { Relationship, RelationshipSchema } from 'src/relationship/entities/relationship.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: Relationship.name, schema: RelationshipSchema },
    ]),
  ],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
