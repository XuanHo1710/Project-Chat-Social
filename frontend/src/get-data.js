/**
 * Pexels API - Free Video Scraper
 * 
 * 🔑 GET FREE API KEY: https://www.pexels.com/api/
 * 📚 Documentation: https://www.pexels.com/api/documentation/#videos
 * 
 * Pexels provides FREE high-quality videos that you can use for any purpose!
 */

const fs = require('fs');

// ============================================
// 🔑 GET YOUR FREE API KEY AT: https://www.pexels.com/api/
// ============================================
const PEXELS_API_KEY = 'mUyNsBg9ndTlUzaA9WROzBzNxYavwXIY9UEV7pD4UOfmHz9fXNc4Yp9h'; // Replace this!

const BASE_URL = 'https://api.pexels.com/videos';

const options = {
    method: 'GET',
    headers: {
        'Authorization': PEXELS_API_KEY
    }
};

/**
 * Get popular videos from Pexels
 */
async function getPopularVideos(page = 1, perPage = 20) {
    const url = `${BASE_URL}/popular?page=${page}&per_page=${perPage}`;

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`   ❌ Error: ${response.status} - ${errorText}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        return null;
    }
}

/**
 * Search videos by query
 */
async function searchVideos(query, page = 1, perPage = 20) {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`Error searching:`, error.message);
        return null;
    }
}

/**
 * Extract video data from Pexels response
 * 
 * Pexels video structure:
 * - id: video ID
 * - url: Pexels page URL
 * - image: thumbnail image
 * - duration: video duration in seconds
 * - user: uploader info
 * - video_files: array of video files with different qualities
 * - video_pictures: array of preview images
 */
function extractVideoData(video) {
    // Get the best quality video file (usually the first HD one)
    const hdVideo = video.video_files?.find(f => f.quality === 'hd') || video.video_files?.[0];
    const sdVideo = video.video_files?.find(f => f.quality === 'sd');

    return {
        id: video.id,
        title: `Video by ${video.user?.name || 'Unknown'}`, // Pexels doesn't have titles, use author
        description: video.url, // Original Pexels URL
        duration: video.duration, // in seconds
        width: video.width,
        height: video.height,

        // Author info
        author: {
            name: video.user?.name || 'Unknown',
            url: video.user?.url || null
        },

        // Thumbnail/Image
        thumbnail: video.image,

        // Video URLs
        videoUrl: hdVideo?.link || null,
        videoUrlSD: sdVideo?.link || null,

        // All available video files
        videoFiles: video.video_files?.map(f => ({
            quality: f.quality,
            width: f.width,
            height: f.height,
            url: f.link,
            fileType: f.file_type
        })) || [],

        // Preview images
        previewImages: video.video_pictures?.map(p => p.picture) || []
    };
}

/**
 * Scrape videos from pages 1-15
 */
async function scrapeAllVideos(startPage = 1, endPage = 15, perPage = 20) {
    console.log('🎬 Starting video scraping from Pexels...');
    console.log(`📄 Pages: ${startPage} to ${endPage} (${perPage} videos per page)`);
    console.log('='.repeat(50));

    const allVideos = [];

    for (let page = startPage; page <= endPage; page++) {
        console.log(`\n📥 Fetching page ${page}/${endPage}...`);

        const result = await getPopularVideos(page, perPage);

        if (!result || !result.videos) {
            console.log(`   ⚠️ No data on page ${page}`);
            continue;
        }

        const videos = result.videos.map(extractVideoData);
        allVideos.push(...videos);

        console.log(`   ✅ Found ${videos.length} videos (Total: ${allVideos.length})`);

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Total videos scraped: ${allVideos.length}`);

    return allVideos;
}

/**
 * Export to JSON
 */
function exportToJson(data, filename) {
    const outputPath = `./${filename}`;

    const exportData = {
        source: 'Pexels API (https://www.pexels.com/api/)',
        license: 'Free to use - No attribution required',
        scrapedAt: new Date().toISOString(),
        totalVideos: data.length,
        videos: data
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`\n📁 Data exported to: ${outputPath}`);

    return outputPath;
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Pexels Video Scraper');
    console.log('='.repeat(50));

    if (PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY_HERE') {
        console.log('\n⚠️  API KEY NOT SET!');
        console.log('');
        console.log('📝 How to get FREE Pexels API key:');
        console.log('   1. Go to: https://www.pexels.com/api/');
        console.log('   2. Click "Get Started" or "Your API Key"');
        console.log('   3. Create a free account');
        console.log('   4. Copy your API key');
        console.log('   5. Replace "YOUR_PEXELS_API_KEY_HERE" in this file');
        console.log('');
        console.log('💡 Pexels provides FREE videos that you can use for any purpose!');
        return;
    }

    try {
        // Scrape videos from pages 1-15 (20 videos per page = 300 videos max)
        const videos = await scrapeAllVideos(1, 15, 20);

        if (videos.length === 0) {
            console.log('\n⚠️ No videos found! Check your API key.');
            return;
        }

        // Export to JSON
        exportToJson(videos, 'videos-collection.json');

        // Show sample
        console.log('\n📋 Sample videos:');
        console.log('-'.repeat(50));

        videos.slice(0, 5).forEach((video, i) => {
            console.log(`\n${i + 1}. ${video.title}`);
            console.log(`   Duration: ${video.duration}s`);
            console.log(`   Thumbnail: ${video.thumbnail}`);
            console.log(`   Video HD: ${video.videoUrl}`);
        });

        console.log('\n✅ Done! Check videos-collection.json');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run
main();