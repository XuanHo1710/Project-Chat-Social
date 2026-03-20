export interface FindAllResponse {
  items: {
    id: any;
    name: string;
    mutualFriends: number;
    avatar: string;
    username: string;
    time: string;
  }[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}
