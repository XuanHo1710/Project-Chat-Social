/**
 * Script để index posts vào ChromaDB
 * Chạy lệnh: npx ts-node src/scripts/index-posts.ts
 * Hoặc: npm run index:posts (sau khi thêm vào package.json)
 */

import * as dotenv from 'dotenv';
import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { ChromaClient } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Constants
const CHROMA_URL = process.env.CHROMA_URL || 'https://chroma-latest-rov7.onrender.com/api/v2';
const CHROMA_COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'post_embeddings';
const MONGODB_URI = process.env.URL_MONGODB;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 50; // Process 50 posts at a time

// Gemini Embedding API
async function getGeminiEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    // Sử dụng REST API của Gemini để lấy embedding
    // Note: Gemini SDK có thể chưa support embedding trực tiếp
    // Nên tạm thời dùng REST API
    
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=' + GEMINI_API_KEY,
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
    console.error('Failed to get embedding from Gemini:', error.message);
    throw error;
  }
}

// Batch embedding
async function batchEmbedTexts(texts: string[]): Promise<number[][]> {
  // Process từng text một (có thể optimize sau nếu API support batch)
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await getGeminiEmbedding(texts[i]);
      embeddings.push(embedding);
      
      // Log progress mỗi 10 texts
      if ((i + 1) % 10 === 0) {
        console.log(`  Processed ${i + 1}/${texts.length} embeddings...`);
      }
      
      // Rate limiting: Delay 100ms giữa các requests
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to embed text ${i}:`, error);
      // Skip failed embedding, add empty array để giữ index
      embeddings.push([]);
    }
  }
  
  return embeddings;
}

// Prepare text for embedding (title + description)
function prepareTextForEmbedding(post: any): string {
  const title = (post.content || '').slice(0, 200).trim();
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : '';
  
  // Combine title + hashtags
  const text = `${title} ${hashtags}`.trim();
  
  // Ensure minimum length
  if (text.length < 10) {
    return 'Bài viết không có nội dung';
  }
  
  return text;
}

// Main indexing function
async function indexPosts() {
  console.log('🚀 Bắt đầu indexing posts vào ChromaDB...');
  console.log(`ChromaDB URL: ${CHROMA_URL}`);
  console.log(`Collection: ${CHROMA_COLLECTION_NAME}`);
  
  if (!MONGODB_URI) {
    throw new Error('URL_MONGODB is not configured');
  }
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // Connect to MongoDB
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  console.log('✅ Connected to MongoDB');
  
  const db = mongoClient.db();
  const postsCollection = db.collection('posts');
  
  // Parse ChromaDB URL
  const parseChromaUrl = (url: string): { host: string; ssl: boolean; port: number } => {
    const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const ssl = url.startsWith('https://');
    // Nếu là HTTPS, dùng port 443 (mặc định cho HTTPS)
    // Nếu là HTTP, dùng port 8000 (mặc định cho ChromaDB local)
    const port = ssl ? 443 : 8000;
    return { host, ssl, port };
  };

  const { host, ssl, port } = parseChromaUrl(CHROMA_URL);
  console.log(`🔗 Connecting to ChromaDB: ${host} (SSL: ${ssl}, Port: ${port})`);
  
  // Connect to ChromaDB
  const chromaClient = new ChromaClient({ host, ssl, port });
  const embeddingFunction = new DefaultEmbeddingFunction();
  
  let collection;
  try {
    collection = await chromaClient.getOrCreateCollection({
      name: CHROMA_COLLECTION_NAME,
      embeddingFunction: embeddingFunction, // Required by ChromaDB, but we provide our own embeddings
    });
    console.log('✅ Connected to ChromaDB');
  } catch (error: any) {
    console.error('❌ Failed to connect to ChromaDB:', error.message);
    throw error;
  }
  
  try {
    // Get all posts (not deleted, not archived)
    const totalPosts = await postsCollection.countDocuments({
      isDeleted: false,
      isArchived: false,
    });
    console.log(`📊 Tổng số posts cần index: ${totalPosts}`);
    
    if (totalPosts === 0) {
      console.log('⚠️  Không có posts nào để index');
      return;
    }
    
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let offset = 0;
    
    // Process posts in batches
    while (offset < totalPosts) {
      console.log(`\n📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}...`);
      
      // Get batch of posts
      const posts = await postsCollection
        .find({
          isDeleted: false,
          isArchived: false,
        })
        .skip(offset)
        .limit(BATCH_SIZE)
        .toArray();
      
      if (posts.length === 0) {
        break;
      }
      
      // Prepare texts for embedding
      const texts = posts.map(post => prepareTextForEmbedding(post));
      
      // Get embeddings
      console.log('  ⏳ Creating embeddings...');
      const embeddings = await batchEmbedTexts(texts);
      
      // Prepare data for ChromaDB
      const items = posts
        .map((post, index) => {
          const embedding = embeddings[index];
          
          // Skip if embedding failed
          if (!embedding || embedding.length === 0) {
            return null;
          }
          
          return {
            postId: post._id.toString(),
            embedding,
            metadata: {
              post_id: post._id.toString(),
              hashtags: Array.isArray(post.hashtags) ? post.hashtags.join(',') : '', // Convert array to string
              type: post.type || 'text',
              author_id: post.author?.toString() || '',
              created_at: post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString(),
            },
          };
        })
        .filter(item => item !== null);
      
      if (items.length > 0) {
        // Check if posts already exist in ChromaDB
        const existingIds = items.map(item => item!.postId);
        const existing = await collection.get({ ids: existingIds });
        const existingSet = new Set(existing.ids);
        
        // Separate new and update items
        const newItems = items.filter(item => !existingSet.has(item!.postId));
        const updateItems = items.filter(item => existingSet.has(item!.postId));
        
        // Add new items
        if (newItems.length > 0) {
          await collection.add({
            ids: newItems.map(item => item!.postId),
            embeddings: newItems.map(item => item!.embedding),
            metadatas: newItems.map(item => item!.metadata) as any, // ChromaDB API uses 'metadatas' (plural)
          });
          indexed += newItems.length;
        }
        
        // Update existing items (delete old, add new)
        if (updateItems.length > 0) {
          await collection.delete({ ids: updateItems.map(item => item!.postId) });
          await collection.add({
            ids: updateItems.map(item => item!.postId),
            embeddings: updateItems.map(item => item!.embedding),
            metadatas: updateItems.map(item => item!.metadata) as any, // ChromaDB API uses 'metadatas' (plural)
          });
          indexed += updateItems.length;
        }
        
        console.log(`  ✅ Indexed ${items.length} posts (${newItems.length} new, ${updateItems.length} updated)`);
      } else {
        console.log(`  ⚠️  No valid embeddings in this batch`);
        failed += posts.length;
      }
      
      offset += BATCH_SIZE;
      
      // Progress summary
      console.log(`Progress: ${Math.min(offset, totalPosts)}/${totalPosts} (${Math.round((Math.min(offset, totalPosts) / totalPosts) * 100)}%)`);
    }
    
    // Final summary
    console.log('\n📊 Kết quả indexing:');
    console.log(`  ✅ Indexed: ${indexed}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    
    // Get ChromaDB stats
    const stats = await collection.count();
    console.log(`\n📈 ChromaDB Collection Stats:`);
    console.log(`  Total embeddings: ${stats}`);
    
  } catch (error) {
    console.error('❌ Error during indexing:', error);
    throw error;
  } finally {
    await mongoClient.close();
    console.log('\n✅ Đã hoàn tất indexing!');
  }
}

// Run script
if (require.main === module) {
  indexPosts()
    .then(() => {
      console.log('\n✅ Script hoàn thành thành công!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { indexPosts };

