import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { StoryService } from './story.service';
import { CreateStoryDto, ReactToStoryDto } from './dto/story.dto';
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
    const story = await this.storyService.create(userId, createStoryDto);
    return {
      success: true,
      data: story,
    };
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
    return {
      success: true,
    };
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
   * Get story viewers
   */
  @Get(':id/viewers')
  async getViewers(@Param('id') id: string, @Req() req: any) {
    const userId = req.user._id;
    return await this.storyService.getStoryViewers(id, userId);
  }
}
