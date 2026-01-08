import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserInfo } from 'decorators/customize';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string
  ) {
    return this.postService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      userId
    );
  }

  @Get('news-feed')
  getNewsFeed(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('friendIds') friendIds?: string
  ) {
    const friends = friendIds ? friendIds.split(',') : [];
    return this.postService.findNewsFeed(
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      friends
    );
  }

  @Get('user/:userId')
  findByUserId(
    @UserInfo() user: any,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('friendIds') friendIds?: string
  ) {
    const friends = friendIds ? friendIds.split(',') : [];
    return this.postService.findByUserId(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      user?._id,
      friends
    );
  }

  @Get('group/:groupId')
  findByGroupId(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.postService.findByGroupId(
      groupId,
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto, @UserInfo() user: any) {
    return this.postService.update(id, updatePostDto, user._id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @UserInfo() user: any) {
    return this.postService.remove(id, user._id);
  }
}
