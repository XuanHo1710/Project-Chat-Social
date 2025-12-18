export interface APIResponse<T> {
    data: T;
    message?: string;
    statusCode?: number;
}

export interface PageResponse<T> {
    items: T[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
}