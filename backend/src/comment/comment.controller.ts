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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserInfo } from 'decorators/customize';

@Controller('comment')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  create(@Body() createCommentDto: CreateCommentDto, @UserInfo() user: any) {
    return this.commentService.create(createCommentDto, user);
  }

  @Get('post/:postId')
  findByPostId(
    @Param('postId') postId: string,
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.commentService.findByPostId(
      postId,
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(':commentId/replies')
  findReplies(
    @Param('commentId') commentId: string,
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.commentService.findReplies(
      commentId,
      user._id,
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
  // Note: Comment reactions are now handled via ReactionController
  // Use POST /reaction/comment with { commentId, type } body
  // Use GET /reaction/comment/:commentId/user to get user's reaction
  // Use GET /reaction/comment/:commentId to get all reactions
}
