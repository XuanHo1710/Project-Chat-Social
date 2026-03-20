export interface FindAllResponse {
  items: {
    id: any;
    name: string;
    mutualFriends: number;
    mutualFriendPreview?: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
      username?: string;
    }[];
    avatar: string;
    username: string;
    time: string;
  }[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}
