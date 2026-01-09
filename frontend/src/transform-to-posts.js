/**
 * Transform ALL Pexels videos to MongoDB Post format
 * totalReacts, totalComments, totalShares = 0
 */

const fs = require('fs');

// Fixed userId from the image
const FIXED_USER_ID = '69241cbe006d259dc5ee4382';

// Starting ObjectId base (will increment)
const POST_ID_BASE = '69609394244418f69a05c';
const MEDIA_ID_BASE = '69609394244418f69a05d';

/**
 * Generate MongoDB ObjectId-like string (24 hex characters)
 */
function generateObjectId(base, index) {
    const indexHex = index.toString(16).padStart(3, '0');
    return base + indexHex;
}

/**
 * Generate captions based on video description or default
 */
const defaultCaptions = [
    "Khoảnh khắc tuyệt vời 🌟",
    "Thiên nhiên thật đẹp! 🌿",
    "Cuộc sống thật tuyệt vời ✨",
    "Một ngày mới bắt đầu 🌅",
    "Chill vibes only 🎵",
    "Nhìn thì đẹp phết 😍",
    "Video ngắn cuối tuần 🎬",
    "Chia sẻ khoảnh khắc đáng nhớ 📹",
    "Góc nhìn mới 👀",
    "Relax time ☕",
    "Explore the world 🌎",
    "Beautiful moments 💫",
    "Nature is healing 🍃",
    "Weekend vibes 🌴",
    "Good vibes only ✌️",
    "Sunset mood 🌅",
    "Adventure awaits 🏔️",
    "Making memories 📸",
    "Life is beautiful 🦋",
    "Just enjoying the view 🏞️",
    "Perfect day 🌤️",
    "Magic hour ✨",
    "Peaceful moment 🕊️",
    "Simply amazing 🤩",
    "Nature at its best 🌺",
    "Captured this beauty 📱",
    "Vibes 🎶",
    "Wanderlust 🗺️",
    "Serene 🌊",
    "Golden hour 🌇"
];

/**
 * Transform Pexels video to MongoDB Post format
 */
function transformToPost(video, postIndex, mediaIndex) {
    const now = new Date();
    // Random date within last 30 days for variety
    const randomDays = Math.floor(Math.random() * 30);
    const randomHours = Math.floor(Math.random() * 24);
    const randomMinutes = Math.floor(Math.random() * 60);
    const createdAt = new Date(now.getTime() - (randomDays * 24 * 60 + randomHours * 60 + randomMinutes) * 60 * 1000);

    // Use video title or default caption
    const content = video.title || defaultCaptions[postIndex % defaultCaptions.length];

    return {
        _id: { $oid: generateObjectId(POST_ID_BASE, postIndex) },
        privacy: "PUBLIC",
        content: content,
        userId: { $oid: FIXED_USER_ID },
        groupId: null,
        isAnonymous: false,
        sharedPostId: null,
        media: [
            {
                mediaType: "VIDEO",
                url: video.videoUrl || video.videoUrlSD,
                publicId: `pexels_video_${video.id}`,
                width: video.width || 1920,
                height: video.height || 1080,
                duration: video.duration || 10,
                _id: { $oid: generateObjectId(MEDIA_ID_BASE, mediaIndex) }
            }
        ],
        background: null,
        totalReacts: 0,
        totalComments: 0,
        totalShares: 0,
        isActive: true,
        isDeleted: false,
        allowComments: true,
        allowShares: true,
        allowReactions: true,
        createdAt: { $date: createdAt.toISOString() },
        updatedAt: { $date: createdAt.toISOString() },
        __v: 0
    };
}

/**
 * Main function
 */
function main() {
    console.log('🔄 Transforming ALL Pexels videos to MongoDB Post format...\n');

    // Read videos collection
    const videosData = JSON.parse(fs.readFileSync('./videos-collection.json', 'utf-8'));
    const videos = videosData.videos;

    console.log(`📹 Total videos available: ${videos.length}`);

    // Transform ALL videos
    const posts = videos.map((video, index) => {
        return transformToPost(video, index, index);
    });

    // Save to file (MongoDB Extended JSON format)
    const outputFile = './posts-collection.json';
    fs.writeFileSync(outputFile, JSON.stringify(posts, null, 2), 'utf-8');

    console.log(`✅ Created ${posts.length} posts`);
    console.log(`📁 Saved to: ${outputFile}`);

    // Show sample
    console.log('\n📋 Sample post structure:');
    console.log(JSON.stringify(posts[0], null, 2));

    // Also create a version for direct MongoDB insert (simpler format)
    const postsForMongo = videos.map((video, index) => {
        const now = new Date();
        const randomDays = Math.floor(Math.random() * 30);
        const randomHours = Math.floor(Math.random() * 24);
        const randomMinutes = Math.floor(Math.random() * 60);
        const createdAt = new Date(now.getTime() - (randomDays * 24 * 60 + randomHours * 60 + randomMinutes) * 60 * 1000);

        const content = video.title || defaultCaptions[index % defaultCaptions.length];

        return {
            privacy: "PUBLIC",
            content: content,
            userId: FIXED_USER_ID,
            groupId: null,
            isAnonymous: false,
            sharedPostId: null,
            media: [
                {
                    mediaType: "VIDEO",
                    url: video.videoUrl || video.videoUrlSD,
                    publicId: `pexels_video_${video.id}`,
                    width: video.width || 1920,
                    height: video.height || 1080,
                    duration: video.duration || 10
                }
            ],
            background: null,
            totalReacts: 0,
            totalComments: 0,
            totalShares: 0,
            isActive: true,
            isDeleted: false,
            allowComments: true,
            allowShares: true,
            allowReactions: true,
            createdAt: createdAt,
            updatedAt: createdAt
        };
    });

    const outputFileMongo = './posts-for-mongodb.json';
    fs.writeFileSync(outputFileMongo, JSON.stringify(postsForMongo, null, 2), 'utf-8');
    console.log(`\n📁 Also saved simpler version to: ${outputFileMongo}`);

    console.log('\n📊 Summary:');
    console.log(`   - Total posts: ${posts.length}`);
    console.log(`   - totalReacts: 0 (all)`);
    console.log(`   - totalComments: 0 (all)`);
    console.log(`   - totalShares: 0 (all)`);
}

main();
