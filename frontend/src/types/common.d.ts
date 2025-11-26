export interface APIResponse<T> {
    data: T;
    message?: string;
    statusCode?: number;
}