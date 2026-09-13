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
  create(@Body() createPostDto: CreatePostDto, @UserInfo() user: any) {
    return this.postService.create(createPostDto, user);
  }

  @Post('livestream/start')
  @UseGuards(JwtAuthGuard)
  startLivestream(@Body() body: { description: string; privacy: string }, @UserInfo() user: any) {
    // Cast privacy string to enum if needed, or service handles it if type matches
    return this.postService.startLivestream(user._id, body.description, body.privacy as any);
  }

  @Post('livestream/end')
  @UseGuards(JwtAuthGuard)
  endLivestream(@Body() body: { postId: string }, @UserInfo() user: any) {
    return this.postService.endLivestream(body.postId, user._id);
  }

  @Post('hide/:id')
  @UseGuards(JwtAuthGuard)
  hidePost(@Param('id') id: string, @UserInfo() user: any) {
    return this.postService.hidePost(id, user._id);
  }

  @Get()
  findAll(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string
  ) {
    return this.postService.findAll(
      user._id.toString(),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      userId
    );
  }

  @Get('search')
  searchPostWithModelAIServer(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string
  ) {
    return this.postService.searchWithModelAIServer(
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      keyword
    );
  }

  @Get('news-feed')
  getNewsFeed(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.postService.findNewsFeed(
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get('user/:userId')
  findByUserId(
    @UserInfo() user: any,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.postService.findByUserId(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      user?._id
    );
  }

  @Get('reels')
  getReels(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.postService.findVideoReels(
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
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
  findOne(@Param('id') id: string, @UserInfo() user: any) {
    return this.postService.findOne(id, user._id.toString());
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
