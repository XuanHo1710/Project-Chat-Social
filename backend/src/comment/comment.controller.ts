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
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentReactionDto } from './dto/create-comment-reaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserInfo } from 'decorators/customize';

@Controller('comment')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  create(@Body() createCommentDto: CreateCommentDto, @UserInfo() user: any) {
    return this.commentService.create(createCommentDto, user._id);
  }

  @Get('post/:postId')
  findByPostId(
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.commentService.findByPostId(
      postId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(':commentId/replies')
  findReplies(
    @Param('commentId') commentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.commentService.findReplies(
      commentId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 5
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @UserInfo() user: any
  ) {
    return this.commentService.update(id, updateCommentDto, user._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserInfo() user: any) {
    return this.commentService.remove(id, user._id);
  }

  // ==================== COMMENT REACTIONS ====================

  @Post('reaction')
  toggleReaction(@Body() createReactionDto: CreateCommentReactionDto, @UserInfo() user: any) {
    return this.commentService.toggleReaction(createReactionDto, user._id);
  }

  @Get(':commentId/reaction/me')
  getUserReaction(@Param('commentId') commentId: string, @UserInfo() user: any) {
    return this.commentService.getUserReaction(commentId, user._id);
  }

  @Get(':commentId/reactions')
  getCommentReactions(
    @Param('commentId') commentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.commentService.getCommentReactions(
      commentId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }
}
