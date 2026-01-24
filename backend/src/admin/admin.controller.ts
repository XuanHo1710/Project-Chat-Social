import {
    Controller,
    Get,
    Query,
    UseGuards,
    Param,
    Delete,
    Put,
    Body
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Admin, Employee } from '../common/decorators/roles.decorator';
import { AdminService } from 'src/admin/admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // ========== DASHBOARD STATISTICS (Admin & Employee) ==========

    @Get('stats')
    @Employee()
    async getDashboardStats() {
        return this.adminService.getDashboardStats();
    }

    @Get('stats/weekly-posts')
    @Employee()
    async getWeeklyPostsStats() {
        return this.adminService.getWeeklyPostsStats();
    }

    @Get('stats/top-pages')
    @Employee()
    async getTopPagesStats() {
        return this.adminService.getTopPagesStats();
    }

    @Get('stats/recent-comments')
    @Employee()
    async getRecentComments() {
        return this.adminService.getRecentComments();
    }

    @Get('stats/emotions')
    @Employee()
    async getEmotionStats() {
        return this.adminService.getEmotionStats();
    }

    @Get('stats/traffic')
    @Employee()
    async getTrafficData(@Query('days') days: number = 7) {
        return this.adminService.getTrafficData(Number(days));
    }

    // ========== USER MANAGEMENT (Admin only) ==========

    @Get('users')
    @Admin()
    async getUsers(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('status') status?: string,
        @Query('role') role?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
        @Query('search') search?: string
    ) {
        return this.adminService.getUsers({
            page: Number(page),
            limit: Number(limit),
            status,
            role,
            sortBy,
            sortOrder,
            search
        });
    }

    @Get('users/:id')
    @Admin()
    async getUserById(@Param('id') id: string) {
        return this.adminService.getUserById(id);
    }

    @Put('users/:id/block')
    @Admin()
    async blockUser(@Param('id') id: string, @Body() body: { reason?: string, expireAt?: Date }) {
        return this.adminService.blockUser(id, body.reason, body.expireAt);
    }

    @Put('users/:id/unblock')
    @Admin()
    async unblockUser(@Param('id') id: string) {
        return this.adminService.unblockUser(id);
    }

    @Put('users/:id/role')
    @Admin()
    async updateUserRole(@Param('id') id: string, @Body() body: { role: string }) {
        return this.adminService.updateUserRole(id, body.role);
    }

    // ========== POST MANAGEMENT (Admin & Employee) ==========

    @Get('posts')
    @Employee()
    async getPosts(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('status') status?: string,
        @Query('privacy') privacy?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
        @Query('search') search?: string
    ) {
        return this.adminService.getPosts({
            page: Number(page),
            limit: Number(limit),
            status,
            privacy,
            sortBy,
            sortOrder,
            search
        });
    }

    @Get('posts/:id')
    @Employee()
    async getPostById(@Param('id') id: string) {
        return this.adminService.getPostById(id);
    }

    @Delete('posts/:id')
    @Employee()
    async deletePost(@Param('id') id: string) {
        return this.adminService.deletePost(id);
    }

    @Put('posts/:id/hide')
    @Employee()
    async hidePost(@Param('id') id: string) {
        return this.adminService.hidePost(id);
    }

    @Put('posts/:id/show')
    @Employee()
    async showPost(@Param('id') id: string) {
        return this.adminService.showPost(id);
    }
}
