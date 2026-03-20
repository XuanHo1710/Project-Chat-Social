export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponseData {
  access_token: string;
  session_id?: string;
  payload: {
    fullname: string;
    gender?: string;
    role?: string;
    username: string;
    _id: string;
    avatar?: string;
    email?: string;
  };
}
