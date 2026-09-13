
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { Public } from 'decorators/customize';
import { Admin } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';


@Controller('themes')
export class ThemeController {
    constructor(private readonly themeService: ThemeService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Admin()
    create(@Body() createThemeDto: CreateThemeDto) {
        return this.themeService.create(createThemeDto);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Admin()
    findAll() {
        return this.themeService.findAll();
    }

    @Public()
    @Get('active')
    getActive() {
        return this.themeService.getActiveTheme();
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Admin()
    findOne(@Param('id') id: string) {
        return this.themeService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Admin()
    update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeDto) {
        return this.themeService.update(id, updateThemeDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Admin()
    remove(@Param('id') id: string) {
        return this.themeService.remove(id);
    }

    @Patch(':id/active')
    @UseGuards(RolesGuard)
    @Admin()
    setActive(@Param('id') id: string) {
        return this.themeService.setActive(id);
    }
}
