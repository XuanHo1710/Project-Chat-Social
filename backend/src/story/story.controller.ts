import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto, ReactToStoryDto, UpdateStoryDto } from './dto/story.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('story')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  /**
   * Create a new story
   */
  @Post()
  async create(@Body() createStoryDto: CreateStoryDto, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.create(userId, createStoryDto);
  }

  /**
   * Get friends' stories for feed
   */
  @Get('feed')
  async getFeed(@Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.getFriendsStories(userId);
  }

  /**
   * Get my own stories
   */
  @Get('my')
  async getMyStories(@Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.getMyStories(userId);
  }

  /**
   * Get a single story
   */
  @Get(':id')
  async getStory(@Param('id') id: string, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.getStoryById(id, userId);
  }

  /**
   * Mark story as viewed
   */
  @Post(':id/view')
  async viewStory(@Param('id') id: string, @Req() req: any) {
    const userId = req.user._id;
    await this.storyService.viewStory(id, userId);
  }

  /**
   * React to a story
   */
  @Post('react')
  async reactToStory(@Body() dto: ReactToStoryDto, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.reactToStory(dto.storyId, userId, dto.reaction);
  }

  /**
   * Update a story
   */
  @Patch(':id')
  async updateStory(@Param('id') id: string, @Body() updateDto: UpdateStoryDto, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.updateStory(id, userId, updateDto);
  }

  /**
   * Delete a story
   */
  @Delete(':id')
  async deleteStory(@Param('id') id: string, @Req() req: any) {
    const userId = req.user._id;
    await this.storyService.deleteStory(id, userId);
    return {
      success: true,
    };
  }

  /**
   * Get story viewers with reactions
   */
  @Get(':id/viewers')
  async getViewers(@Param('id') id: string, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.getStoryViewers(id, userId);
  }

  /**
   * Get story reactions
   */
  @Get(':id/reactions')
  async getReactions(@Param('id') id: string) {
    return await this.storyService.getStoryReactions(id);
  }
}
