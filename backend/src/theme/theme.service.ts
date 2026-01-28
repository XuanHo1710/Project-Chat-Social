import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Theme, ThemeDocument } from './schemas/theme.schema';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@Injectable()
export class ThemeService {
    constructor(@InjectModel(Theme.name) private themeModel: Model<ThemeDocument>) { }

    async create(createThemeDto: CreateThemeDto): Promise<Theme> {
        if (createThemeDto.isActive) {
            await this.themeModel.updateMany({}, { isActive: false });
        }
        const createdTheme = new this.themeModel(createThemeDto);
        return createdTheme.save();
    }

    async findAll(): Promise<Theme[]> {
        return this.themeModel.find().exec();
    }

    async findOne(id: string): Promise<Theme> {
        const theme = await this.themeModel.findById(id).exec();
        if (!theme) {
            throw new NotFoundException(`Theme with ID ${id} not found`);
        }
        return theme;
    }

    async getActiveTheme(): Promise<Theme | null> {
        return this.themeModel.findOne({ isActive: true }).exec();
    }

    async update(id: string, updateThemeDto: UpdateThemeDto): Promise<Theme> {
        if (updateThemeDto.isActive) {
            await this.themeModel.updateMany({ _id: { $ne: id } }, { isActive: false });
        }
        const updatedTheme = await this.themeModel.findByIdAndUpdate(id, updateThemeDto, { new: true }).exec();
        if (!updatedTheme) {
            throw new NotFoundException(`Theme with ID ${id} not found`);
        }
        return updatedTheme;
    }

    async remove(id: string): Promise<Theme> {
        const deletedTheme = await this.themeModel.findByIdAndDelete(id).exec();
        if (!deletedTheme) {
            throw new NotFoundException(`Theme with ID ${id} not found`);
        }
        return deletedTheme;
    }

    async setActive(id: string): Promise<Theme> {
        const theme = await this.themeModel.findById(id);
        if (!theme) {
            throw new NotFoundException(`Theme with ID ${id} not found`);
        }

        await this.themeModel.updateMany({}, { isActive: false });
        const updatedTheme = await this.themeModel.findByIdAndUpdate(id, { isActive: true }, { new: true }).exec();
        if (!updatedTheme) {
            throw new NotFoundException(`Theme with ID ${id} not found`);
        }
        return updatedTheme;
    }
}
