export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponseData {
    access_token: string;
    refresh_token?: string;
    payload: {
        fullname: string;
        gender?: string;
        role?: string;
        username: string;
        _id: string;
    };
}