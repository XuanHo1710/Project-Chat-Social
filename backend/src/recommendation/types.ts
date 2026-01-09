export interface AIRecommendationPost {
  post_id: string;
  content: string;
  score: number;
  user_id: string;
  group_id: string;
}

export interface AIResponse {
  query?: string;
  user_id?: string;
  post_id?: string;
  page: number;
  limit: number;
  hasMore: boolean;
  posts: AIRecommendationPost[];
  message?: string;
}

export interface AIStatusResponse {
  ready: boolean;
  total_posts?: number;
  message?: string;
}
