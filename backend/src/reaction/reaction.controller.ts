import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReactionService } from './reaction.service';
import { CreateReactionDto, CreatePostReactionDto, CreateCommentReactionDto } from './dto/create-reaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserInfo } from 'decorators/customize';
import { TypeFactor } from './entities/reaction.entity';

@Controller('reaction')
@UseGuards(JwtAuthGuard)
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) { }

  // ==================== POST ENDPOINTS ====================

  /**
   * Generic toggle reaction for any factor type
   */
  @Post()
  toggleReaction(@Body() createReactionDto: CreateReactionDto, @UserInfo() user: any) {
    return this.reactionService.toggleReaction(createReactionDto, user._id);
  }

  /**
   * Legacy: Toggle reaction on a post
   */
  @Post('post')
  togglePostReaction(@Body() dto: CreatePostReactionDto, @UserInfo() user: any) {
    return this.reactionService.togglePostReaction(dto, user._id);
  }

  /**
   * Legacy: Toggle reaction on a comment
   */
  @Post('comment')
  toggleCommentReaction(@Body() dto: CreateCommentReactionDto, @UserInfo() user: any) {
    return this.reactionService.toggleCommentReaction(dto, user._id);
  }

  /**
   * Get reaction summary for multiple posts (for feed)
   */
  @Post('summary')
  getReactionsSummary(@Body() body: { postIds: string[] }, @UserInfo() user: any) {
    return this.reactionService.getPostsReactionsSummary(body.postIds, user._id);
  }

  /**
   * Generic reaction summary for any factor type
   */
  @Post('summary/:typeFactor')
  getFactorReactionsSummary(
    @Param('typeFactor') typeFactor: TypeFactor,
    @Body() body: { factorIds: string[] },
    @UserInfo() user: any
  ) {
    return this.reactionService.getReactionsSummary(body.factorIds, typeFactor, user._id);
  }

  // ==================== GET ENDPOINTS (SPECIFIC ROUTES FIRST) ====================

  /**
   * Legacy: Get user's reaction on a post
   * Must be BEFORE generic route to avoid matching :typeFactor
   */
  @Get('post/:postId/user')
  getPostUserReaction(@Param('postId') postId: string, @UserInfo() user: any) {
    return this.reactionService.getPostUserReaction(postId, user._id);
  }

  /**
   * Legacy: Get reactions for a post
   * Must be BEFORE generic route to avoid matching :typeFactor
   */
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

  /**
   * Legacy: Get user's reaction on a comment
   * Must be BEFORE generic route to avoid matching :typeFactor
   */
  @Get('comment/:commentId/user')
  getCommentUserReaction(@Param('commentId') commentId: string, @UserInfo() user: any) {
    return this.reactionService.getCommentUserReaction(commentId, user._id);
  }

  /**
   * Legacy: Get reactions for a comment
   * Must be BEFORE generic route to avoid matching :typeFactor
   */
  @Get('comment/:commentId')
  getCommentReactions(
    @Param('commentId') commentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.reactionService.getCommentReactions(
      commentId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  // ==================== GENERIC ROUTES (AFTER SPECIFIC ROUTES) ====================

  /**
   * Get user's reaction on a factor
   */
  @Get(':typeFactor/:factorId/user')
  getUserReaction(
    @Param('typeFactor') typeFactor: TypeFactor,
    @Param('factorId') factorId: string,
    @UserInfo() user: any
  ) {
    return this.reactionService.getUserReaction(factorId, typeFactor, user._id);
  }

  /**
   * Get reactions for a specific factor
   */
  @Get(':typeFactor/:factorId')
  getFactorReactions(
    @Param('typeFactor') typeFactor: TypeFactor,
    @Param('factorId') factorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.reactionService.getFactorReactions(
      factorId,
      typeFactor,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  /**
   * Admin endpoint to migrate old reactions to new schema
   */
  @Post('migrate')
  async migrateReactions() {
    return this.reactionService.migrateOldReactions();
  }
}

