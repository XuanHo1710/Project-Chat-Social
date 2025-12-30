import { IsOptional, IsString } from 'class-validator';

export class SearchHashtagDto {
    @IsString()
    query: string; // Search query for autocomplete

    @IsOptional()
    limit?: number; // Max results
}
