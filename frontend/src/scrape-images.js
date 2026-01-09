/**
 * Pexels Image Scraper for Multiple Topics
 * Topics: Phim, Game, Động vật, Công nghệ, Xe cộ, Du lịch, Thể thao, Laptop, AI, Thời trang
 * 
 * Output:
 * - posts-collection.json: 500 posts with images
 * - hashtags-collection.json: Hashtags data
 * - hashtagmappings-collection.json: Post-Hashtag mappings
 */

const fs = require('fs');

// ========== CONFIGURATION ==========
const PEXELS_API_KEY = 'mUyNsBg9ndTlUzaA9WROzBzNxYavwXIY9UEV7pD4UOfmHz9fXNc4Yp9h'; // Replace with your API key
const FIXED_USER_ID = '69241cbe006d259dc5ee4382';
const TOTAL_POSTS = 500;
const POSTS_PER_TOPIC = 50; // 10 topics x 50 = 500 posts

// Base ObjectId prefixes (must be 24 hex characters total)
// Format: prefix (16 chars) + index (8 chars) = 24 chars
const POST_ID_PREFIX = '692d7b7589c43a94';      // 16 chars, index adds 8 more
const MEDIA_ID_PREFIX = '692d7b7589c43a95';     // 16 chars
const HASHTAG_ID_PREFIX = '692d7b7589c43a96';   // 16 chars
const MAPPING_ID_PREFIX = '692d7b7589c43a97';   // 16 chars

// ========== TOPICS CONFIGURATION ==========
const TOPICS = {
    phim: {
        searchQueries: ['cinema', 'movie theater', 'film production', 'movie set', 'actor'],
        hashtags: ['Phim', 'Dienanh', 'Xinema', 'Movie', 'Film'],
        titles: [
            'Cuối tuần đi xem phim thôi nào',
            'Bộ phim hay nhất mình từng xem',
            'Ai thích phim hành động không?',
            'Review phim cuối tuần',
            'Phim mới ra rạp hay quá',
            'Đam mê điện ảnh từ nhỏ',
            'Thích xem phim một mình',
            'Phim kinh dị cho đêm Halloween',
            'Top phim hay năm nay',
            'Phim này đáng xem lắm',
            'Chiếu phim ngoài trời chill phết',
            'Thưởng thức bộ phim bom tấn mới',
            'Phim Việt ngày càng hay',
            'Đi rạp chiếu phim cuối tuần',
            'Bộ phim làm thay đổi cuộc đời mình'
        ]
    },
    game: {
        searchQueries: ['gaming', 'video game', 'esports', 'gamer setup', 'gaming computer'],
        hashtags: ['Game', 'Gaming', 'Esport', 'Gamer', 'PlayStation'],
        titles: [
            'Setup gaming mới tậu được',
            'Ai chơi game online không?',
            'Trận đấu hấp dẫn quá',
            'Game mới ra hay phết',
            'Cuối tuần cày game thôi',
            'Stream game đêm nay nhé',
            'Rank cao quá trời',
            'Game này gây nghiện quá',
            'Đội hình game thủ chuyên nghiệp',
            'Gaming setup đơn giản mà chất',
            'Game mobile ngày càng đẹp',
            'Thi đấu esport thắng rồi',
            'Chơi game cùng bạn bè',
            'Game retro vẫn hay',
            'Bàn phím cơ cho game thủ'
        ]
    },
    dongvat: {
        searchQueries: ['cute dog', 'cat', 'wildlife', 'pet', 'animals nature'],
        hashtags: ['Dongvat', 'Pet', 'Thucung', 'Cuocsonghoangda', 'Animals'],
        titles: [
            'Em cún nhà mình dễ thương quá',
            'Mèo con ngủ ngon chưa',
            'Động vật hoang dã tuyệt đẹp',
            'Nuôi thú cưng vui lắm',
            'Chim muông trong vườn',
            'Đi vườn thú cuối tuần',
            'Động vật trong tự nhiên',
            'Em mèo tinh nghịch quá',
            'Cún cưng đáng yêu ghê',
            'Thế giới động vật kỳ diệu',
            'Nuôi cá cảnh thư giãn',
            'Chim hót trong vườn',
            'Động vật biển đẹp quá',
            'Thú cưng của mọi nhà',
            'Mèo béo ú của nhà mình'
        ]
    },
    congnghe: {
        searchQueries: ['technology', 'smartphone', 'computer', 'innovation', 'tech gadget'],
        hashtags: ['Congnghe', 'Tech', 'Innovation', 'Smartphone', 'Digital'],
        titles: [
            'Công nghệ mới đỉnh cao',
            'Điện thoại mới ra mắt',
            'Review sản phẩm công nghệ',
            'Xu hướng công nghệ mới',
            'Thiết bị thông minh cho nhà',
            'Smartwatch mới tậu',
            'Công nghệ thay đổi cuộc sống',
            'Đánh giá tai nghe không dây',
            'Thiết bị IoT cho nhà thông minh',
            'Công nghệ 5G nhanh thật',
            'Robot tương lai đây rồi',
            'Xe điện công nghệ cao',
            'Sản phẩm công nghệ yêu thích',
            'Smart home tiện lợi quá',
            'Màn hình gaming mới'
        ]
    },
    xeco: {
        searchQueries: ['car', 'motorcycle', 'sports car', 'vehicle', 'automobile'],
        hashtags: ['Xeco', 'Oto', 'Xemay', 'Car', 'Automotive'],
        titles: [
            'Xe mới đẹp quá chừng',
            'Đam mê ô tô từ nhỏ',
            'Xe motor phong cách',
            'Siêu xe trong mơ',
            'Đi phượt bằng xe máy',
            'Xe ô tô điện thân thiện môi trường',
            'Garage xe đẹp quá',
            'Xe cổ vintage đẳng cấp',
            'Đua xe đỉnh cao',
            'Xe hybrid tiết kiệm xăng',
            'Xe hơi thể thao mạnh mẽ',
            'Cuối tuần rửa xe thôi',
            'Xe tải đẹp phết',
            'Xe được độ siêu chất',
            'Lái xe đường trường thích quá'
        ]
    },
    dulich: {
        searchQueries: ['travel', 'beach vacation', 'mountain landscape', 'tourism', 'adventure trip'],
        hashtags: ['Dulich', 'Travel', 'Phuot', 'Vacation', 'Explore'],
        titles: [
            'Đi du lịch biển thôi nào',
            'Phượt núi cuối tuần',
            'Khám phá thành phố mới',
            'Chuyến đi đáng nhớ',
            'Resort nghỉ dưỡng tuyệt vời',
            'Du lịch nước ngoài lần đầu',
            'Cảnh đẹp thiên nhiên',
            'Hoàng hôn trên biển',
            'Đi phượt một mình',
            'Tour du lịch hấp dẫn',
            'Khách sạn view đẹp quá',
            'Đảo hoang thật yên bình',
            'Cắm trại giữa rừng',
            'Sa Pa mùa này đẹp lắm',
            'Đà Lạt se se lạnh'
        ]
    },
    thethao: {
        searchQueries: ['sports', 'football soccer', 'basketball', 'fitness gym', 'running athlete'],
        hashtags: ['Thethao', 'Sport', 'Fitness', 'Gym', 'Football'],
        titles: [
            'Trận bóng đá hay quá',
            'Tập gym mỗi ngày',
            'Chạy bộ buổi sáng',
            'Đội bóng yêu thích thắng rồi',
            'Yoga giúp thư giãn',
            'Bơi lội cuối tuần',
            'Đá bóng cùng bạn bè',
            'Cầu lông vui lắm',
            'Tennis đỉnh cao',
            'Tập thể hình cho khỏe',
            'Marathon lần đầu tham gia',
            'Bóng rổ siêu hay',
            'Võ thuật rèn luyện bản thân',
            'Leo núi thử thách',
            'Đạp xe đường trường'
        ]
    },
    laptop: {
        searchQueries: ['laptop computer', 'macbook pro', 'coding laptop', 'work from home laptop', 'gaming laptop'],
        hashtags: ['Laptop', 'Macbook', 'Computer', 'WFH', 'Productivity'],
        titles: [
            'Laptop mới mua đẹp quá',
            'Setup làm việc tại nhà',
            'Macbook Pro đáng đồng tiền',
            'Laptop gaming mạnh mẽ',
            'Review laptop cho sinh viên',
            'Làm việc ở quán cafe',
            'Laptop mỏng nhẹ tiện lợi',
            'Nâng cấp RAM cho laptop',
            'Laptop cho dân thiết kế',
            'Code trên laptop thích quá',
            'Laptop cho công việc văn phòng',
            'Pin laptop trâu quá',
            'Màn hình laptop đẹp',
            'Bàn phím laptop gõ sướng',
            'Laptop 2 trong 1 tiện lợi'
        ]
    },
    ai: {
        searchQueries: ['artificial intelligence', 'robot technology', 'machine learning', 'futuristic technology', 'data science'],
        hashtags: ['AI', 'MachineLearning', 'Robot', 'DeepLearning', 'Future'],
        titles: [
            'AI đang thay đổi mọi thứ',
            'Chatbot thông minh quá',
            'Robot tương lai đã đến',
            'Machine Learning là gì',
            'AI viết code được rồi',
            'Tương lai của trí tuệ nhân tạo',
            'AI trong y tế',
            'Deep Learning đáng học',
            'AI tạo hình ảnh ấn tượng',
            'ChatGPT hay quá',
            'Robot hỗ trợ con người',
            'AI trong cuộc sống hàng ngày',
            'Xe tự lái thời đại mới',
            'AI dự đoán thời tiết',
            'Học AI từ đâu bắt đầu'
        ]
    },
    thoitrang: {
        searchQueries: ['fashion style', 'clothing outfit', 'street style', 'fashion model', 'trendy clothes'],
        hashtags: ['Thoitrang', 'Fashion', 'Style', 'Outfit', 'OOTD'],
        titles: [
            'Outfit hôm nay đẹp không',
            'Xu hướng thời trang mới',
            'Phối đồ đơn giản mà chất',
            'Thời trang đường phố',
            'Váy mới mua xinh quá',
            'Áo khoác mùa đông',
            'Giày sneaker hot trend',
            'Phụ kiện thời trang',
            'Túi xách đẹp ghê',
            'Đồ công sở thanh lịch',
            'Thời trang bền vững',
            'Mix match theo phong cách',
            'Thời trang vintage',
            'Áo hoodie thoải mái',
            'Quần jeans basic không bao giờ lỗi mốt'
        ]
    }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Generate ObjectId-like string (24 hex characters)
 * prefix: 16 chars, index: 8 chars = 24 total
 */
function generateObjectId(prefix, index) {
    const indexHex = index.toString(16).padStart(8, '0');
    return prefix + indexHex;
}

/**
 * Get random items from array
 */
function getRandomItems(arr, min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/**
 * Get random item from array
 */
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate random date within last 30 days
 */
function getRandomDate() {
    const now = new Date();
    const randomDays = Math.floor(Math.random() * 30);
    const randomHours = Math.floor(Math.random() * 24);
    const randomMinutes = Math.floor(Math.random() * 60);
    return new Date(now.getTime() - (randomDays * 24 * 60 + randomHours * 60 + randomMinutes) * 60 * 1000);
}

/**
 * Fetch images from Pexels API
 */
async function fetchPexelsImages(query, perPage = 80) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Pexels API error: ${response.status}`);
        }

        const data = await response.json();
        return data.photos || [];
    } catch (error) {
        console.error(`Error fetching images for "${query}":`, error.message);
        return [];
    }
}

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== MAIN SCRAPING FUNCTION ==========

async function main() {
    console.log('🚀 Starting Pexels Image Scraper for 10 Topics...\n');

    // Check API key
    if (PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY_HERE') {
        console.error('❌ Please set your PEXELS_API_KEY first!');
        console.log('   Get free API key at: https://www.pexels.com/api/');
        return;
    }

    const allPosts = [];
    const allHashtags = {};
    const allMappings = [];

    let postIndex = 0;
    let mappingIndex = 0;

    // Process each topic
    for (const [topicKey, topicData] of Object.entries(TOPICS)) {
        console.log(`\n📌 Processing topic: ${topicKey.toUpperCase()}`);

        // Fetch images for all search queries in this topic
        let topicImages = [];

        for (const query of topicData.searchQueries) {
            console.log(`   Fetching images for "${query}"...`);
            const images = await fetchPexelsImages(query, 50);
            topicImages.push(...images);
            await sleep(500); // Rate limiting
        }

        console.log(`   Total images found: ${topicImages.length}`);

        // Create posts for this topic
        for (let i = 0; i < POSTS_PER_TOPIC && postIndex < TOTAL_POSTS; i++) {
            // Get 1-3 random images for this post
            const postImages = getRandomItems(topicImages, 1, 3);

            if (postImages.length === 0) {
                console.log(`   ⚠️ No images available for post ${i + 1}`);
                continue;
            }

            // Select random title and hashtags
            const title = getRandomItem(topicData.titles);
            const selectedHashtags = getRandomItems(topicData.hashtags, 1, 2);

            // Build content with hashtags
            const hashtagText = selectedHashtags.map(h => `#${h}`).join(' ');
            const content = `${title}\n\n${hashtagText}`;

            // Create media items
            const media = postImages.map((img, idx) => ({
                mediaType: 'IMAGE',
                url: img.src?.large2x || img.src?.large || img.src?.original,
                publicId: `pexels_${topicKey}_${img.id}`,
                width: img.width || 1920,
                height: img.height || 1280,
                _id: { $oid: generateObjectId(MEDIA_ID_PREFIX, postIndex * 3 + idx) }
            }));

            const createdAt = getRandomDate();

            // Create post
            const post = {
                _id: { $oid: generateObjectId(POST_ID_PREFIX, postIndex) },
                privacy: 'PUBLIC',
                content: content,
                userId: { $oid: FIXED_USER_ID },
                groupId: null,
                isAnonymous: false,
                sharedPostId: null,
                media: media,
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

            allPosts.push(post);

            // Track hashtags and create mappings
            for (const hashtag of selectedHashtags) {
                const hashtagLower = hashtag.toLowerCase();

                // Add to hashtags collection if not exists
                if (!allHashtags[hashtagLower]) {
                    allHashtags[hashtagLower] = {
                        displayText: hashtag,
                        usageCount: 0
                    };
                }
                allHashtags[hashtagLower].usageCount++;

                // Create mapping
                allMappings.push({
                    postId: post._id.$oid,
                    hashtagLower: hashtagLower
                });
            }

            postIndex++;
        }

        console.log(`   ✅ Created ${Math.min(POSTS_PER_TOPIC, postIndex)} posts for ${topicKey}`);
    }

    console.log(`\n\n📊 Total posts created: ${allPosts.length}`);

    // Create hashtags collection
    const hashtagsCollection = [];
    let hashtagIndex = 0;
    const hashtagIdMap = {};

    for (const [tagLower, tagData] of Object.entries(allHashtags)) {
        const hashtagId = generateObjectId(HASHTAG_ID_PREFIX, hashtagIndex);
        hashtagIdMap[tagLower] = hashtagId;

        const createdAt = new Date();
        hashtagsCollection.push({
            _id: { $oid: hashtagId },
            tagTextLowercase: tagLower,
            displayText: tagData.displayText,
            usageCount: tagData.usageCount,
            createdAt: { $date: createdAt.toISOString() },
            updatedAt: { $date: createdAt.toISOString() },
            __v: 0
        });

        hashtagIndex++;
    }

    console.log(`📊 Total hashtags created: ${hashtagsCollection.length}`);

    // Create hashtagmappings collection
    const mappingsCollection = [];

    for (const mapping of allMappings) {
        const hashtagId = hashtagIdMap[mapping.hashtagLower];
        const createdAt = new Date();

        mappingsCollection.push({
            _id: { $oid: generateObjectId(MAPPING_ID_PREFIX, mappingIndex) },
            hashtagId: { $oid: hashtagId },
            entityId: { $oid: mapping.postId },
            entityType: 'POST',
            createdAt: { $date: createdAt.toISOString() },
            updatedAt: { $date: createdAt.toISOString() },
            __v: 0
        });

        mappingIndex++;
    }

    console.log(`📊 Total hashtag mappings created: ${mappingsCollection.length}`);

    // Save to files
    fs.writeFileSync('./posts-images-collection.json', JSON.stringify(allPosts, null, 2), 'utf-8');
    fs.writeFileSync('./hashtags-collection.json', JSON.stringify(hashtagsCollection, null, 2), 'utf-8');
    fs.writeFileSync('./hashtagmappings-collection.json', JSON.stringify(mappingsCollection, null, 2), 'utf-8');

    console.log('\n✅ Files saved:');
    console.log('   📁 posts-images-collection.json');
    console.log('   📁 hashtags-collection.json');
    console.log('   📁 hashtagmappings-collection.json');

    // Summary by topic
    console.log('\n📋 Summary by Topic:');
    console.log('   Topic           | Posts');
    console.log('   ----------------|-------');
    let topicNum = 0;
    for (const topicKey of Object.keys(TOPICS)) {
        console.log(`   ${topicKey.padEnd(15)} | ${POSTS_PER_TOPIC}`);
        topicNum++;
    }
    console.log(`   Total          | ${allPosts.length}`);
}

main().catch(console.error);
