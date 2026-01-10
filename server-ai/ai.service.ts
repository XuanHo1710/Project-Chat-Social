import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

interface ViewedArticleInput {
  title: string;
  tags: string[];
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Legacy method: Tạo recommendations dựa trên title matching (regex)
   * Giữ lại để backward compatibility
   */
  async getArticleRecommendations(viewedArticles: ViewedArticleInput[]): Promise<string[]> {
    // Fail-fast để tránh gọi API khi thiếu key
    if (!this.genAI) {
      return [];
    }

    const history = viewedArticles
      .map((article) => `Tiêu đề: "${article.title}", Tags: [${article.tags.join(', ')}]`)
      .join('; ');

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Một người dùng đã xem các bài viết sau:
      ${history}

      Dựa trên lịch sử này, hãy gợi ý 5 tiêu đề bài viết khác có nội dung tương tự hoặc liên quan mà người dùng có thể sẽ thích.
      Chỉ trả về danh sách 5 tiêu đề, mỗi tiêu đề trên một dòng, không có đánh số hay ký tự gạch đầu dòng.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 5);
    } catch (_e) {
      return [];
    }
  }

  /**
   * Tạo embedding từ text sử dụng Gemini embedding model
   * @param text Text để embedding (title + description)
   * @returns Vector embedding (array of numbers)
   */
  async getEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      // Sử dụng REST API của Gemini để lấy embedding
      // Note: Gemini SDK có thể chưa support embedding trực tiếp
      // Nên dùng REST API
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text }],
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const embedding = response.data.embedding?.values;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from Gemini API');
      }

      return embedding;
    } catch (error: any) {
      this.logger.error(
        `Failed to get embedding: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Tạo embedding từ lịch sử user (để tìm similar posts)
   * @param history Array of {title, tags} từ user history
   * @returns Vector embedding
   */
  async getUserPreferenceEmbedding(history: ViewedArticleInput[]): Promise<number[]> {
    if (history.length === 0) {
      throw new Error('History cannot be empty');
    }

    this.logger.log(`[UserPreferenceEmbedding] 📊 Creating embedding from ${history.length} articles`);
    
    // ✅ Ghép history thành text - format phải match với indexing format
    // ✅ Strategy: Match format indexing (content.slice(0, 200) + hashtags)
    // ✅ Nhưng repeat tags/content để tăng weight cho similarity search chính xác hơn
    
    // Collect tất cả content và tags từ history
    const allContents: string[] = [];
    const allTags: string[] = [];
    
    history.forEach((article) => {
      const tags = article.tags && article.tags.length > 0 ? article.tags : [];
      const title = article.title || '';
      
      // ✅ Collect content (title) - slice 200 giống indexing
      if (title.trim().length >= 3) {
        const contentSlice = title.slice(0, 200).trim();
        if (contentSlice.length > 0) {
          allContents.push(contentSlice);
        }
      }
      
      // ✅ Collect tags (normalize và bỏ duplicate)
      tags.forEach(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        if (normalizedTag && !allTags.includes(normalizedTag)) {
          allTags.push(normalizedTag);
        }
      });
    });
    
    // ✅ Build text: Format giống indexing (content + hashtags)
    // ✅ Nhưng repeat tags để tăng weight cho embedding chính xác hơn
    const contentsText = allContents.join(' ');
    const tagsText = allTags.length > 0 ? `${allTags.join(' ')} ${allTags.join(' ')}` : ''; // Repeat tags
    
    // ✅ Combine: Contents + Tags (repeated)
    // ✅ Format: content1 content2 ... tag1 tag2 tag1 tag2 (match indexing format)
    let text = tagsText 
      ? `${contentsText} ${tagsText}`.trim()
      : contentsText || 'Bài viết';
    
    // ✅ Nếu text quá ngắn, lặp lại để tăng weight
    if (text.trim().length < 20 && text.trim().length > 0) {
      text = `${text} ${text} ${text}`.trim();
    }

    this.logger.log(`[UserPreferenceEmbedding] 📄 Prepared text (${text.length} chars):`, text.substring(0, 300) + (text.length > 300 ? '...' : ''));

    // Ensure minimum length
    if (text.trim().length < 10) {
      this.logger.warn(`[UserPreferenceEmbedding] ⚠️ Text quá ngắn, có thể không tạo được embedding tốt`);
    }

    return this.getEmbedding(text);
  }

  /**
   * Batch embedding cho nhiều texts cùng lúc (dùng khi indexing)
   * @param texts Array of texts để embedding
   * @returns Array of embeddings
   */
  async batchEmbedContents(texts: string[]): Promise<number[][]> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      // Process từng text một (có thể optimize sau nếu API support batch)
      const embeddings = await Promise.all(
        texts.map((text) => this.getEmbedding(text)),
      );

      return embeddings;
    } catch (error) {
      this.logger.error(
        `Failed to batch embed contents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Kiểm tra xem service có available không
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }
}


