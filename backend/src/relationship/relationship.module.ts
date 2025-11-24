import { Module } from '@nestjs/common';
import { RelationshipService } from './relationship.service';
import { RelationshipController } from './relationship.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Relationship, RelationshipSchema } from 'src/relationship/entities/relationship.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relationship.name, schema: RelationshipSchema }
    ])
  ],
  controllers: [RelationshipController],
  providers: [RelationshipService],
})
export class RelationshipModule { }
