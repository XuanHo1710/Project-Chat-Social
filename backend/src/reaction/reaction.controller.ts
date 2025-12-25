import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReactionService } from './reaction.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserInfo } from 'decorators/customize';

@Controller('reaction')
@UseGuards(JwtAuthGuard)
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Post()
  toggleReaction(@Body() createReactionDto: CreateReactionDto, @UserInfo() user: any) {
    return this.reactionService.toggleReaction(createReactionDto, user._id);
  }

  @Get('post/:postId')
  getPostReactions(
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.reactionService.getPostReactions(
      postId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get('post/:postId/user')
  getUserReaction(@Param('postId') postId: string, @UserInfo() user: any) {
    return this.reactionService.getUserReaction(postId, user._id);
  }

  @Post('summary')
  getReactionsSummary(@Body() body: { postIds: string[] }, @UserInfo() user: any) {
    return this.reactionService.getReactionsSummary(body.postIds, user._id);
  }
}
