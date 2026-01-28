import axios from "@/config/axios";
import { APIResponse } from "@/types/common";

export interface Theme {
    _id: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
    bgDarkMode: string;
    bgLightMode: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateThemeDto {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    bgDarkMode: string;
    bgLightMode: string;
    isActive?: boolean;
}

export interface UpdateThemeDto extends Partial<CreateThemeDto> { }

export const getAllThemes = async (): Promise<APIResponse<Theme[]>> => {
    const response = await axios.get<APIResponse<Theme[]>>("/themes");
    return response.data;
};

export const getActiveTheme = async (): Promise<APIResponse<Theme>> => {
    const response = await axios.get<APIResponse<Theme>>("/themes/active");
    return response.data;
};

export const createTheme = async (data: CreateThemeDto): Promise<APIResponse<Theme>> => {
    const response = await axios.post<APIResponse<Theme>>("/themes", data);
    return response.data;
};

export const updateTheme = async (id: string, data: UpdateThemeDto): Promise<APIResponse<Theme>> => {
    const response = await axios.patch<APIResponse<Theme>>(`/themes/${id}`, data);
    return response.data;
};

export const deleteTheme = async (id: string): Promise<APIResponse<Theme>> => {
    const response = await axios.delete<APIResponse<Theme>>(`/themes/${id}`);
    return response.data;
};

export const setActiveTheme = async (id: string): Promise<APIResponse<Theme>> => {
    const response = await axios.patch<APIResponse<Theme>>(`/themes/${id}/active`);
    return response.data;
};

export const themeService = {
    getAllThemes,
    getActiveTheme,
    createTheme,
    updateTheme,
    deleteTheme,
    setActiveTheme
};
