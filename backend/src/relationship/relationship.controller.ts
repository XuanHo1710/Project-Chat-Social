import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RelationshipService } from './relationship.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { RelationshipStatus } from 'src/relationship/entities/relationship.entity';

@Controller('relationship')
export class RelationshipController {
  constructor(
    private readonly relationshipService: RelationshipService,
  ) { }

  @Post()
  create(@Body() createRelationshipDto: CreateRelationshipDto) {
    createRelationshipDto.status = RelationshipStatus.ACCEPTED;
    return this.relationshipService.create(createRelationshipDto);
  }

  @Get()
  findAll() {
    return this.relationshipService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.relationshipService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRelationshipDto: UpdateRelationshipDto) {
    return this.relationshipService.update(id, updateRelationshipDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.relationshipService.remove(id);
  }
}
