
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { Public } from 'decorators/customize';


@Controller('themes')
export class ThemeController {
    constructor(private readonly themeService: ThemeService) { }

    @Post()
    create(@Body() createThemeDto: CreateThemeDto) {
        return this.themeService.create(createThemeDto);
    }

    @Get()
    findAll() {
        return this.themeService.findAll();
    }

    @Public()
    @Get('active')
    getActive() {
        return this.themeService.getActiveTheme();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.themeService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeDto) {
        return this.themeService.update(id, updateThemeDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.themeService.remove(id);
    }

    @Patch(':id/active')
    setActive(@Param('id') id: string) {
        return this.themeService.setActive(id);
    }
}
