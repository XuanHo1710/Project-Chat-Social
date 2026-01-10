/**
 * Pexels Image & Video Scraper for 100,000+ Posts
 * - Video posts: ~5,000 (1/20 of total)
 * - Image posts: ~95,000 (1-4 images per post)
 * - 4 Fixed UserIDs
 * - Output: posts-collection-final.json
 */

const fs = require('fs');

// ========== CONFIGURATION ==========
const PEXELS_API_KEY = 'mUyNsBg9ndTlUzaA9WROzBzNxYavwXIY9UEV7pD4UOfmHz9fXNc4Yp9h';
const TOTAL_POSTS = 100000;
const VIDEO_RATIO = 20; // 1 video per 20 posts
const IMAGES_PER_TOPIC = 100; // Fetch 100 images per topic
const VIDEOS_PER_TOPIC = 20; // Fetch 20 videos per topic

const USER_IDS = [
    '69241cbe006d259dc5ee4382',
    '69241d0d006d259dc5ee4387',
    '6926c64fc8133a1f254b6a0f',
    '69437ae22bd45e4acf5fd509'
];

const POST_ID_PREFIX = '692d7b7589c43a94';
const MEDIA_ID_PREFIX = '692d7b7589c43a95';

// ========== TOPICS CONFIGURATION WITH 100+ TITLES EACH ==========
const TOPICS = {
    phim: {
        searchQueries: ['cinema', 'movie theater', 'film production', 'movie set', 'actor portrait'],
        videoQueries: ['cinema', 'movie', 'film'],
        hashtags: ['Phim', 'Dienanh', 'Xinema', 'Movie', 'Film', 'PhimHay', 'ReviewPhim'],
        titles: [
            'Cuối tuần đi xem phim thôi nào', 'Bộ phim hay nhất mình từng xem', 'Ai thích phim hành động không?',
            'Review phim cuối tuần', 'Phim mới ra rạp hay quá', 'Đam mê điện ảnh từ nhỏ', 'Thích xem phim một mình',
            'Phim kinh dị cho đêm Halloween', 'Top phim hay năm nay', 'Phim này đáng xem lắm',
            'Chiếu phim ngoài trời chill phết', 'Thưởng thức bộ phim bom tấn mới', 'Phim Việt ngày càng hay',
            'Đi rạp chiếu phim cuối tuần', 'Bộ phim làm thay đổi cuộc đời mình', 'Phim tình cảm lãng mạn quá',
            'Xem phim Marvel mới nhất', 'Phim hoạt hình cũng hay lắm', 'Trailer phim mới hấp dẫn quá',
            'Phim DC hay hơn Marvel à?', 'Review nhanh phim mới xem', 'Phim điện ảnh châu Á đỉnh cao',
            'Xem lại phim cũ vẫn hay', 'Phim kinh điển không bao giờ lỗi thời', 'Soundtrack phim hay quá',
            'Diễn viên trong phim diễn xuất sắc', 'Kịch bản phim quá bất ngờ', 'Phim này twist nhiều quá',
            'Xem phim cùng bạn bè vui ghê', 'Phim tài liệu cũng đáng xem', 'Phim hài làm cười cả ngày',
            'Phim anime mùa này hay quá', 'Đạo diễn phim quá tài năng', 'Phim sci-fi tương lai',
            'Xem phim ma một mình hơi sợ', 'Phim chiến tranh xúc động quá', 'Phim về tình bạn hay ghê',
            'Phim remake có khác gì bản gốc?', 'Phim Netflix mới lên hay lắm', 'Phim Oscar năm nay xứng đáng',
            'Xem phim 3D lần đầu tiên', 'Phim IMAX đỉnh thật sự', 'Review phim không spoil',
            'Phim này cần xem gấp', 'Marathon phim cả ngày', 'Phim về gia đình cảm động',
            'Xem phim rồi khóc như mưa', 'Phim hành động mãn nhãn', 'Phim siêu anh hùng mới nhất',
            'Diễn viên chính phim quá đẹp', 'Phim độc lập cũng hay lắm', 'Xem phim tại nhà tiết kiệm hơn',
            'Phim về âm nhạc hay quá', 'Bộ phim sequel này hay hơn phần 1', 'Phim rom-com cười nghiêng ngả',
            'Xem phim với người yêu', 'Phim về thể thao truyền cảm hứng', 'Review phim Hàn Quốc',
            'Phim Thái cũng hay lắm', 'Xem phim Nhật Bản cảm động', 'Phim Trung Quốc hoành tráng',
            'Phim Ấn Độ nhạc hay quá', 'Review phim Việt Nam mới', 'Phim về lịch sử thú vị',
            'Xem phim kinh dị Hàn', 'Phim zombie hay quá', 'Phim về virus đang hot',
            'Xem phim về AI tương lai', 'Phim về robot cảm động', 'Phim về vũ trụ hoành tráng',
            'Review phim về du hành thời gian', 'Phim về siêu năng lực', 'Xem phim về phép thuật',
            'Phim fantasy cực đỉnh', 'Phim về vampire mới ra', 'Review phim về werewolf',
            'Phim về thế giới ngầm', 'Xem phim mafia hấp dẫn', 'Phim võ thuật đỉnh cao',
            'Review phim kungfu cổ trang', 'Phim kiếm hiệp hay quá', 'Xem phim cổ trang Trung Quốc',
            'Phim lịch sử Việt Nam', 'Review phim về chiến tranh Việt Nam', 'Phim tài liệu về thiên nhiên',
            'Xem phim về động vật hoang dã', 'Phim về biển cả bao la', 'Review phim về núi rừng',
            'Phim về thám hiểm hang động', 'Xem phim phiêu lưu mạo hiểm', 'Phim về leo núi hấp dẫn',
            'Review phim về lặn biển', 'Phim về nhảy dù cực đỉnh', 'Xem phim về đua xe',
            'Phim về đua mô tô', 'Review phim về boxing', 'Phim về MMA võ tự do',
            'Xem phim về bóng đá', 'Phim về bóng rổ hay quá', 'Review phim về tennis',
            'Phim về golf thú vị', 'Xem phim về bơi lội', 'Phim về thể dục dụng cụ'
        ]
    },
    game: {
        searchQueries: ['gaming setup', 'video game', 'esports arena', 'gamer', 'gaming pc'],
        videoQueries: ['gaming', 'esports', 'video game'],
        hashtags: ['Game', 'Gaming', 'Esport', 'Gamer', 'PlayStation', 'Xbox', 'PC', 'Nintendo'],
        titles: [
            'Setup gaming mới tậu được', 'Ai chơi game online không?', 'Trận đấu hấp dẫn quá',
            'Game mới ra hay phết', 'Cuối tuần cày game thôi', 'Stream game đêm nay nhé',
            'Rank cao quá trời', 'Game này gây nghiện quá', 'Đội hình game thủ chuyên nghiệp',
            'Gaming setup đơn giản mà chất', 'Game mobile ngày càng đẹp', 'Thi đấu esport thắng rồi',
            'Chơi game cùng bạn bè', 'Game retro vẫn hay', 'Bàn phím cơ cho game thủ',
            'Chuột gaming mới mua', 'Tai nghe gaming đỉnh cao', 'Màn hình 144Hz mượt thật',
            'Card đồ họa RTX mới lên', 'RAM 32GB cho game nặng', 'SSD NVMe load game cực nhanh',
            'Case PC RGB đẹp quá', 'Ghế gaming thoải mái ghê', 'Bàn gaming rộng rãi',
            'Game indie hay không kém AAA', 'Game multiplayer vui lắm', 'Game single-player cốt truyện hay',
            'Boss game khó quá trời', 'Achievement unlock rồi', 'Trophy platinum có rồi',
            'Game MOBA rank thách đấu', 'Game FPS bắn súng đỉnh', 'Game RPG cốt truyện sâu',
            'Game open world rộng lớn', 'Game survival sống còn', 'Game horror kinh dị',
            'Game racing đua xe', 'Game sports thể thao', 'Game simulation mô phỏng',
            'Game strategy chiến thuật', 'Game puzzle giải đố', 'Game adventure phiêu lưu',
            'Game fighting đối kháng', 'Game platform nhảy nhót', 'Game sandbox tự do',
            'Game MMO đông người chơi', 'Game battle royale 100 người', 'Game co-op với bạn bè',
            'Game PvP đấu người', 'Game PvE đánh AI', 'Game roguelike thử thách',
            'Game metroidvania khám phá', 'Game souls-like khó nhằn', 'Game hack and slash chém chém',
            'Game turn-based chiến thuật', 'Game real-time strategy', 'Game tower defense',
            'Game card game bài', 'Game gacha may mắn', 'Game auto chess cờ nhân phẩm',
            'Stream game được donate', 'Làm content game vui lắm', 'Gaming channel đang phát triển',
            'Esport team mới thành lập', 'Giải đấu game sắp tới', 'Bootcamp tập luyện game',
            'Meta game mới thay đổi', 'Patch update game mới', 'DLC game hay quá',
            'Season pass đáng mua không?', 'Pre-order game mới', 'Early access game mới',
            'Game free to play hay', 'Game pay to win ghét thật', 'Game subscription đáng giá',
            'Controller PS5 mới', 'Xbox Series X đỉnh', 'Nintendo Switch portable',
            'Steam Deck chơi game PC', 'Game pass ultimate hay quá', 'PS Plus Premium có gì?',
            'Game on cloud gaming', 'GeForce NOW stream game', 'Xbox Cloud Gaming',
            'VR gaming thực tế ảo', 'AR gaming thực tế tăng cường', 'Motion gaming kinect',
            'Retro gaming máy cũ', 'Emulator game cổ', 'Mod game hay quá',
            'Cheat game bị ban', 'Speedrun game nhanh quá', 'World record gaming',
            'Pro gamer kiếm tiền', 'Gaming career tương lai', 'Game development học làm game',
            'Game engine Unity Unreal', 'Indie game developer', 'AAA game studio',
            'Game review đánh giá', 'Game walkthrough hướng dẫn', 'Game tips and tricks',
            'Game news tin tức', 'Game trailer mới ra', 'Game announcement thông báo',
            'E3 Summer Game Fest', 'TGA Game Awards', 'Gamescom sắp tới'
        ]
    },
    dongvat: {
        searchQueries: ['cute dog', 'cat pet', 'wildlife safari', 'bird nature', 'fish aquarium'],
        videoQueries: ['cute animals', 'pets', 'wildlife'],
        hashtags: ['Dongvat', 'Pet', 'Thucung', 'Cuocsonghoangda', 'Animals', 'Dog', 'Cat', 'Wildlife'],
        titles: [
            'Em cún nhà mình dễ thương quá', 'Mèo con ngủ ngon chưa', 'Động vật hoang dã tuyệt đẹp',
            'Nuôi thú cưng vui lắm', 'Chim muông trong vườn', 'Đi vườn thú cuối tuần',
            'Động vật trong tự nhiên', 'Em mèo tinh nghịch quá', 'Cún cưng đáng yêu ghê',
            'Thế giới động vật kỳ diệu', 'Nuôi cá cảnh thư giãn', 'Chim hót trong vườn',
            'Động vật biển đẹp quá', 'Thú cưng của mọi nhà', 'Mèo béo ú của nhà mình',
            'Cún con mới đón về', 'Mèo tam thể may mắn', 'Chó Corgi chân ngắn dễ thương',
            'Mèo Anh lông ngắn xinh', 'Chó Golden hiền lành', 'Mèo Scottish fold tai cụp',
            'Chó Husky mắt xanh', 'Mèo Maine Coon khổng lồ', 'Chó Poodle sang chảnh',
            'Mèo Ragdoll dịu dàng', 'Chó Shiba biểu cảm hài', 'Mèo Siamese thanh lịch',
            'Chó Bulldog mặt xệ', 'Mèo Persian lông dài', 'Chó Beagle nghịch ngợm',
            'Mèo Bengal hoang dã', 'Chó Dalmatian đốm đen', 'Mèo Sphynx không lông',
            'Chó Akita trung thành', 'Mèo Munchkin chân ngắn', 'Chó Border Collie thông minh',
            'Thỏ con lông trắng', 'Hamster chạy xà quay', 'Chuột lang dễ thương',
            'Chinchilla lông mềm', 'Nhím kiểng xinh xắn', 'Rùa cảnh sống lâu',
            'Cá vàng bơi lội', 'Cá Betta đuôi dài', 'Cá Koi màu sắc đẹp',
            'Cá Neon lấp lánh', 'Tôm cảnh trong bể', 'Ốc sên trong hồ thủy sinh',
            'Vẹt biết nói', 'Chim sẻ nhỏ xinh', 'Chim hoàng yến hót hay',
            'Chim cu gáy', 'Chim chào mào', 'Chim vành khuyên',
            'Sư tử chúa tể rừng xanh', 'Hổ Bengal oai vệ', 'Báo đốm nhanh nhẹn',
            'Voi khổng lồ hiền lành', 'Hươu cao cổ cao nhất', 'Ngựa vằn sọc đen trắng',
            'Tê giác một sừng', 'Hà mã sống dưới nước', 'Cá sấu hung dữ',
            'Rắn hổ mang nguy hiểm', 'Thằn lằn tắc kè', 'Rùa biển bơi lội',
            'Cá heo thông minh', 'Cá voi lớn nhất', 'Hải cẩu đáng yêu',
            'Chim cánh cụt Nam Cực', 'Gấu trắng Bắc Cực', 'Cáo tuyết lông trắng',
            'Sói xám hoang dã', 'Nai sừng tấm', 'Gấu nâu đi bắt cá',
            'Khỉ đầu chó hài hước', 'Tinh tinh thông minh', 'Đười ươi hiền lành',
            'Vượn cáo Madagascar', 'Koala ôm cây', 'Kangaroo nhảy xa',
            'Gấu túi Úc', 'Thú mỏ vịt kỳ lạ', 'Chim emu chạy nhanh',
            'Đà điểu lớn nhất', 'Chim công xòe đuôi', 'Thiên nga trắng thanh lịch',
            'Vịt bơi trong hồ', 'Ngỗng dễ thương', 'Gà con vàng ươm',
            'Dê núi leo trèo', 'Cừu lông mềm', 'Bò sữa cho sữa',
            'Ngựa phi nhanh', 'Lừa chở hàng', 'Lạc đà sa mạc',
            'Đà điểu chạy nhanh', 'Hải âu bay lượn', 'Bồ câu hòa bình',
            'Quạ đen thông minh', 'Diều hâu săn mồi', 'Đại bàng bay cao',
            'Cú mèo ban đêm', 'Chim ruồi nhỏ xíu', 'Chim sâu ăn sâu'
        ]
    },
    congnghe: {
        searchQueries: ['technology gadget', 'smartphone', 'computer setup', 'innovation tech', 'smart device'],
        videoQueries: ['technology', 'gadgets', 'smartphone'],
        hashtags: ['Congnghe', 'Tech', 'Innovation', 'Smartphone', 'Digital', 'Gadget', 'IoT', 'SmartHome'],
        titles: [
            'Công nghệ mới đỉnh cao', 'Điện thoại mới ra mắt', 'Review sản phẩm công nghệ',
            'Xu hướng công nghệ mới', 'Thiết bị thông minh cho nhà', 'Smartwatch mới tậu',
            'Công nghệ thay đổi cuộc sống', 'Đánh giá tai nghe không dây', 'Thiết bị IoT cho nhà thông minh',
            'Công nghệ 5G nhanh thật', 'Robot tương lai đây rồi', 'Xe điện công nghệ cao',
            'Sản phẩm công nghệ yêu thích', 'Smart home tiện lợi quá', 'Màn hình gaming mới',
            'iPhone mới ra có gì hot?', 'Samsung Galaxy flagship mới', 'Xiaomi giá rẻ ngon bổ',
            'Oppo camera đẹp', 'Vivo selfie xinh', 'Realme pin trâu',
            'OnePlus flagship killer', 'Google Pixel camera AI', 'Huawei vẫn còn ngon',
            'Nothing Phone đèn LED', 'Asus ROG Phone gaming', 'Sony Xperia camera pro',
            'iPad Pro mới ra', 'Samsung Tab S series', 'Xiaomi Pad giá tốt',
            'Apple Watch đỉnh cao', 'Samsung Galaxy Watch', 'Garmin theo dõi sức khỏe',
            'Fitbit fitness tracker', 'Xiaomi Mi Band giá rẻ', 'Huawei Watch GT',
            'AirPods Pro 2', 'Galaxy Buds Pro', 'Sony WF-1000XM5',
            'Bose QuietComfort', 'Jabra Elite', 'Sennheiser Momentum',
            'MacBook Pro M3', 'Dell XPS laptop', 'ThinkPad business',
            'Surface Pro tablet', 'Asus ZenBook', 'HP Spectre laptop',
            'RTX 4090 đỉnh cao', 'AMD RX 7900', 'Intel Arc GPU',
            'Ryzen 9 7950X3D', 'Intel Core i9', 'Apple M3 Max',
            'DDR5 RAM mới', 'PCIe 5.0 SSD', 'WiFi 7 router',
            'Smart TV 8K', 'OLED TV đẹp quá', 'Mini LED technology',
            'Soundbar Dolby Atmos', 'Home theater setup', 'Projector 4K',
            'Drone camera 4K', 'GoPro action cam', 'Insta360 camera',
            'Mirrorless camera Sony', 'Canon DSLR', 'Nikon full-frame',
            'Lens photography', 'Tripod chụp ảnh', 'Gimbal quay video',
            'VR headset Quest', 'AR glasses', 'Mixed reality',
            'Smart doorbell Ring', 'Security camera', 'Smart lock',
            'Robot vacuum cleaner', 'Air purifier smart', 'Humidifier IoT',
            'Smart lighting Philips', 'Smart plug ổ cắm', 'Smart thermostat',
            'Electric scooter', 'E-bike xe điện', 'Hoverboard cân bằng',
            'Power bank sạc dự phòng', 'Wireless charger', 'GaN charger nhỏ gọn',
            'USB-C hub đa năng', 'Thunderbolt dock', 'External SSD',
            'Mechanical keyboard', 'Gaming mouse', 'Ergonomic mouse',
            'Monitor stand', 'Desk mat', 'Cable management',
            'Standing desk', 'Ergonomic chair', 'Monitor light bar',
            'Webcam HD', 'Microphone podcast', 'Stream deck',
            'Capture card', 'Green screen', 'Ring light'
        ]
    },
    xeco: {
        searchQueries: ['sports car', 'motorcycle', 'luxury vehicle', 'car interior', 'automobile'],
        videoQueries: ['cars', 'motorcycle', 'driving'],
        hashtags: ['Xeco', 'Oto', 'Xemay', 'Car', 'Automotive', 'Supercar', 'Motorcycle', 'BMW', 'Mercedes'],
        titles: [
            'Xe mới đẹp quá chừng', 'Đam mê ô tô từ nhỏ', 'Xe motor phong cách',
            'Siêu xe trong mơ', 'Đi phượt bằng xe máy', 'Xe ô tô điện thân thiện môi trường',
            'Garage xe đẹp quá', 'Xe cổ vintage đẳng cấp', 'Đua xe đỉnh cao',
            'Xe hybrid tiết kiệm xăng', 'Xe hơi thể thao mạnh mẽ', 'Cuối tuần rửa xe thôi',
            'Xe tải đẹp phết', 'Xe được độ siêu chất', 'Lái xe đường trường thích quá',
            'Lamborghini Huracán đỉnh', 'Ferrari 488 Spider', 'Porsche 911 Turbo',
            'McLaren 720S supercar', 'Bugatti Chiron nhanh nhất', 'Koenigsegg cực hiếm',
            'Pagani Huayra nghệ thuật', 'Aston Martin DB11', 'Bentley Continental GT',
            'Rolls-Royce Phantom sang trọng', 'Mercedes-Maybach đẳng cấp', 'BMW 7 Series',
            'Audi A8 flagship', 'Lexus LS luxury', 'Genesis G90',
            'Tesla Model S Plaid', 'Lucid Air EV', 'Rivian R1T truck điện',
            'BMW M5 Competition', 'Mercedes-AMG GT', 'Audi RS e-tron GT',
            'Porsche Taycan điện', 'Ford Mustang Mach-E', 'Hyundai Ioniq 6',
            'Toyota Supra MK5', 'Nissan GT-R Nismo', 'Honda NSX hybrid',
            'Mazda MX-5 Miata', 'Subaru BRZ', 'Toyota GR86',
            'Ford Mustang cơ bắp', 'Chevrolet Camaro', 'Dodge Challenger Hellcat',
            'Jeep Wrangler off-road', 'Land Rover Defender', 'Toyota Land Cruiser',
            'Mercedes G-Class', 'Range Rover Sport', 'Porsche Cayenne',
            'BMW X5 M', 'Audi Q8', 'Lamborghini Urus',
            'Ford F-150 bán tải', 'Chevrolet Silverado', 'RAM 1500 TRX',
            'Toyota Hilux bền bỉ', 'Ford Ranger Raptor', 'Isuzu D-Max',
            'Honda CBR1000RR', 'Yamaha R1 superbike', 'Kawasaki Ninja ZX-10R',
            'Suzuki GSX-R1000', 'Ducati Panigale V4', 'BMW S1000RR',
            'Harley-Davidson cruiser', 'Indian Motorcycle', 'Triumph Bonneville',
            'Royal Enfield classic', 'Honda Africa Twin', 'BMW R1250GS adventure',
            'KTM 1290 Super Adventure', 'Ducati Multistrada', 'Yamaha Ténéré 700',
            'Vespa Primavera scooter', 'Honda SH sang trọng', 'Piaggio Medley',
            'Yamaha NVX thể thao', 'Honda Winner X', 'Yamaha Exciter',
            'Suzuki Raider R150', 'Honda Wave Alpha', 'Yamaha Sirius',
            'VinFast VF9 điện', 'VinFast VF8', 'VinFast VF e34',
            'Kia EV6 đẹp', 'Hyundai Ioniq 5', 'BYD Atto 3',
            'MG ZS EV', 'Peugeot e-2008', 'Mini Cooper SE',
            'Mercedes EQS sedan', 'BMW iX SUV', 'Audi e-tron GT',
            'Volvo XC40 Recharge', 'Polestar 2', 'Genesis GV60'
        ]
    },
    dulich: {
        searchQueries: ['travel destination', 'beach vacation', 'mountain landscape', 'city tourism', 'adventure trip'],
        videoQueries: ['travel', 'vacation', 'adventure'],
        hashtags: ['Dulich', 'Travel', 'Phuot', 'Vacation', 'Explore', 'Beach', 'Mountain', 'Adventure'],
        titles: [
            'Đi du lịch biển thôi nào', 'Phượt núi cuối tuần', 'Khám phá thành phố mới',
            'Chuyến đi đáng nhớ', 'Resort nghỉ dưỡng tuyệt vời', 'Du lịch nước ngoài lần đầu',
            'Cảnh đẹp thiên nhiên', 'Hoàng hôn trên biển', 'Đi phượt một mình',
            'Tour du lịch hấp dẫn', 'Khách sạn view đẹp quá', 'Đảo hoang thật yên bình',
            'Cắm trại giữa rừng', 'Sa Pa mùa này đẹp lắm', 'Đà Lạt se se lạnh',
            'Phú Quốc biển xanh', 'Nha Trang nắng đẹp', 'Đà Nẵng cầu Rồng',
            'Hội An phố cổ', 'Huế cố đô', 'Hà Nội 36 phố phường',
            'Sài Gòn nhộn nhịp', 'Vịnh Hạ Long kỳ quan', 'Ninh Bình Tràng An',
            'Mù Cang Chải mùa lúa', 'Hà Giang đèo Mã Pí Lèng', 'Cao Bằng thác Bản Giốc',
            'Tam Đảo sương mù', 'Ba Vì cuối tuần', 'Cát Bà đảo ngọc',
            'Côn Đảo hoang sơ', 'Lý Sơn đảo tỏi', 'Quy Nhơn biển đẹp',
            'Mũi Né cát bay', 'Vũng Tàu gần Sài Gòn', 'Long Hải biển vắng',
            'Cần Thơ miền Tây', 'Châu Đốc núi Sam', 'Phú Yên xứ Nẫu',
            'Bình Định võ Tây Sơn', 'Gia Lai cao nguyên', 'Đắk Lắk cà phê',
            'Buôn Ma Thuột thác đẹp', 'Kon Tum hoang sơ', 'Lâm Đồng hoa đẹp',
            'Bangkok mua sắm', 'Phuket biển Thái', 'Chiang Mai núi Thái',
            'Singapore du lịch', 'Malaysia Kuala Lumpur', 'Indonesia Bali',
            'Philippines Boracay', 'Cambodia Angkor Wat', 'Laos Luang Prabang',
            'Myanmar Bagan', 'Japan Tokyo', 'Korea Seoul',
            'Hong Kong shopping', 'Taiwan Đài Bắc', 'Maldives resort',
            'Dubai xa xỉ', 'Turkey Istanbul', 'Greece Santorini',
            'Italy Rome Venice', 'France Paris', 'Spain Barcelona',
            'UK London', 'Switzerland Alps', 'Norway fjords',
            'Iceland aurora', 'USA New York', 'USA Los Angeles',
            'USA Las Vegas', 'USA Hawaii', 'Canada Vancouver',
            'Australia Sydney', 'New Zealand Queenstown', 'Fiji islands',
            'Morocco Marrakech', 'Egypt pyramids', 'South Africa Cape Town',
            'Kenya safari', 'Tanzania Serengeti', 'Brazil Rio',
            'Argentina Buenos Aires', 'Peru Machu Picchu', 'Mexico Cancun',
            'Cuba Havana', 'Caribbean cruise', 'Antarctic expedition',
            'Arctic adventure', 'Nepal Himalayas', 'India Taj Mahal',
            'Bhutan happiness', 'Sri Lanka beaches', 'Russia Moscow'
        ]
    },
    thethao: {
        searchQueries: ['football soccer', 'basketball court', 'fitness gym', 'running marathon', 'swimming pool'],
        videoQueries: ['sports', 'fitness', 'football'],
        hashtags: ['Thethao', 'Sport', 'Fitness', 'Gym', 'Football', 'Basketball', 'Running', 'Swimming'],
        titles: [
            'Trận bóng đá hay quá', 'Tập gym mỗi ngày', 'Chạy bộ buổi sáng',
            'Đội bóng yêu thích thắng rồi', 'Yoga giúp thư giãn', 'Bơi lội cuối tuần',
            'Đá bóng cùng bạn bè', 'Cầu lông vui lắm', 'Tennis đỉnh cao',
            'Tập thể hình cho khỏe', 'Marathon lần đầu tham gia', 'Bóng rổ siêu hay',
            'Võ thuật rèn luyện bản thân', 'Leo núi thử thách', 'Đạp xe đường trường',
            'World Cup hay quá', 'Champions League đỉnh', 'Premier League hấp dẫn',
            'La Liga Barcelona Real', 'Serie A Italy', 'Bundesliga Germany',
            'V-League Việt Nam', 'AFF Cup Đông Nam Á', 'Asian Cup châu Á',
            'NBA Finals sôi động', 'EuroLeague basketball', 'FIBA World Cup',
            'VBA Vietnam basketball', 'NFL SuperBowl', 'MLB baseball',
            'NHL hockey băng', 'UFC MMA đối kháng', 'Boxing quyền Anh',
            'Wimbledon tennis', 'US Open grand slam', 'Australian Open',
            'French Open Roland Garros', 'Golf Masters Augusta', 'PGA Tour',
            'Tour de France đua xe đạp', 'Giro d\'Italia', 'Vuelta a España',
            'F1 Formula 1 đua xe', 'MotoGP mô tô', 'WRC rally',
            'Olympics Thế vận hội', 'Asian Games ASIAD', 'SEA Games Đông Nam Á',
            'World Athletics điền kinh', 'Swimming World Cup', 'Diving lặn',
            'Gymnastics thể dục dụng cụ', 'Wrestling đấu vật', 'Judo nhu đạo',
            'Taekwondo Việt Nam', 'Karate võ Nhật', 'Aikido hòa hợp',
            'Muay Thai võ Thái', 'Kickboxing đấm đá', 'Wushu võ Trung Quốc',
            'Vovinam Việt Nam', 'Cờ vua chess', 'Cờ tướng Trung Quốc',
            'Esports thể thao điện tử', 'Billiards bi-a', 'Bowling bowling',
            'Darts phi tiêu', 'Archery bắn cung', 'Shooting bắn súng',
            'Fencing đấu kiếm', 'Equestrian cưỡi ngựa', 'Rowing chèo thuyền',
            'Kayaking kayak', 'Surfing lướt sóng', 'Skateboarding trượt ván',
            'Snowboarding trượt tuyết', 'Skiing trượt tuyết', 'Ice skating trượt băng',
            'Rock climbing leo núi đá', 'Bouldering leo tường', 'Parkour vượt chướng ngại',
            'CrossFit đa năng', 'HIIT cardio', 'Pilates',
            'Zumba nhảy', 'Aerobics nhịp điệu', 'Bodybuilding thể hình',
            'Powerlifting nâng tạ', 'Olympic weightlifting', 'Strongman',
            'Triathlon ba môn phối hợp', 'Ironman triathlon', 'Spartan Race',
            'Trail running chạy địa hình', 'Ultra marathon 100km', 'Obstacle course race'
        ]
    },
    laptop: {
        searchQueries: ['laptop computer', 'macbook workspace', 'coding laptop', 'work from home', 'laptop setup'],
        videoQueries: ['laptop', 'macbook', 'computer'],
        hashtags: ['Laptop', 'Macbook', 'Computer', 'WFH', 'Productivity', 'Coding', 'Setup', 'Workspace'],
        titles: [
            'Laptop mới mua đẹp quá', 'Setup làm việc tại nhà', 'Macbook Pro đáng đồng tiền',
            'Laptop gaming mạnh mẽ', 'Review laptop cho sinh viên', 'Làm việc ở quán cafe',
            'Laptop mỏng nhẹ tiện lợi', 'Nâng cấp RAM cho laptop', 'Laptop cho dân thiết kế',
            'Code trên laptop thích quá', 'Laptop cho công việc văn phòng', 'Pin laptop trâu quá',
            'Màn hình laptop đẹp', 'Bàn phím laptop gõ sướng', 'Laptop 2 trong 1 tiện lợi',
            'MacBook Air M3 mới', 'MacBook Pro 14 inch', 'MacBook Pro 16 inch',
            'iMac 24 inch đẹp', 'Mac Mini M2 Pro', 'Mac Studio workstation',
            'Dell XPS 13 Plus', 'Dell XPS 15 OLED', 'Dell XPS 17 màn lớn',
            'Dell Inspiron giá tốt', 'Dell Latitude business', 'Dell Precision workstation',
            'HP Spectre x360', 'HP Envy laptop', 'HP EliteBook doanh nghiệp',
            'HP Pavilion sinh viên', 'HP Omen gaming', 'HP Victus gaming rẻ',
            'Lenovo ThinkPad X1 Carbon', 'ThinkPad T series', 'ThinkPad E series',
            'Lenovo Yoga 2 in 1', 'Lenovo Legion gaming', 'Lenovo IdeaPad',
            'Asus ZenBook Pro', 'Asus VivoBook', 'Asus ROG Zephyrus',
            'Asus ROG Strix gaming', 'Asus TUF Gaming', 'Asus ProArt creator',
            'Acer Swift mỏng nhẹ', 'Acer Aspire sinh viên', 'Acer Nitro gaming',
            'Acer Predator gaming cao cấp', 'Acer ConceptD creator', 'Acer Chromebook',
            'MSI Stealth gaming', 'MSI Raider gaming', 'MSI Creator laptop',
            'MSI Prestige business', 'Razer Blade gaming', 'Razer Book productivity',
            'LG Gram siêu nhẹ', 'Samsung Galaxy Book', 'Huawei MateBook',
            'Microsoft Surface Laptop', 'Surface Pro tablet', 'Surface Book',
            'Gigabyte Aero creator', 'Gigabyte Aorus gaming', 'Framework modular laptop',
            'System76 Linux laptop', 'Alienware gaming', 'Origin PC custom',
            'Laptop cho lập trình', 'Laptop cho video editing', 'Laptop cho 3D rendering',
            'Laptop cho machine learning', 'Laptop cho data science', 'Laptop cho music production',
            'Laptop cho photography', 'Laptop cho architecture', 'Laptop cho engineering',
            'Laptop cho học online', 'Laptop cho giáo viên', 'Laptop cho họp video',
            'Laptop cho presentation', 'Laptop cho sales', 'Laptop cho marketing',
            'Laptop cho accounting', 'Laptop cho trading', 'Laptop cho startup',
            'Laptop cho freelancer', 'Laptop cho digital nomad', 'Laptop cho travel',
            'Laptop pin 20 tiếng', 'Laptop Thunderbolt 4', 'Laptop WiFi 6E',
            'Laptop màn OLED', 'Laptop màn 4K', 'Laptop màn 120Hz',
            'Laptop fingerprint', 'Laptop face recognition', 'Laptop backlit keyboard'
        ]
    },
    ai: {
        searchQueries: ['artificial intelligence', 'robot technology', 'machine learning', 'futuristic technology', 'data science'],
        videoQueries: ['artificial intelligence', 'robot', 'future technology'],
        hashtags: ['AI', 'MachineLearning', 'Robot', 'DeepLearning', 'Future', 'ChatGPT', 'Technology', 'Innovation'],
        titles: [
            'AI đang thay đổi mọi thứ', 'Chatbot thông minh quá', 'Robot tương lai đã đến',
            'Machine Learning là gì', 'AI viết code được rồi', 'Tương lai của trí tuệ nhân tạo',
            'AI trong y tế', 'Deep Learning đáng học', 'AI tạo hình ảnh ấn tượng',
            'ChatGPT hay quá', 'Robot hỗ trợ con người', 'AI trong cuộc sống hàng ngày',
            'Xe tự lái thời đại mới', 'AI dự đoán thời tiết', 'Học AI từ đâu bắt đầu',
            'GPT-4 thông minh quá', 'Claude AI của Anthropic', 'Gemini AI của Google',
            'Copilot AI của Microsoft', 'Midjourney vẽ tranh đẹp', 'DALL-E 3 tạo hình',
            'Stable Diffusion miễn phí', 'Leonardo AI vẽ tranh', 'Runway Gen-2 video',
            'Sora AI video OpenAI', 'Pika Labs video AI', 'HeyGen avatar AI',
            'Synthesia video AI', 'ElevenLabs voice AI', 'Murf AI giọng nói',
            'Whisper speech to text', 'DeepL dịch thuật AI', 'Grammarly viết văn',
            'Jasper AI content', 'Copy.ai marketing', 'Writesonic copywriting',
            'Notion AI ghi chú', 'Otter.ai ghi âm', 'Fireflies meeting',
            'GitHub Copilot coding', 'Tabnine autocomplete', 'Amazon CodeWhisperer',
            'Cursor AI IDE', 'Replit AI coding', 'v0 by Vercel UI',
            'TensorFlow framework', 'PyTorch deep learning', 'Keras neural network',
            'Scikit-learn ML', 'Hugging Face models', 'LangChain LLM',
            'OpenAI API', 'Anthropic Claude API', 'Google AI Studio',
            'Azure OpenAI', 'AWS Bedrock', 'Vertex AI Google',
            'Computer Vision AI', 'Natural Language Processing', 'Reinforcement Learning',
            'Generative AI', 'Large Language Model', 'Neural Network',
            'Transformer architecture', 'Attention mechanism', 'Fine-tuning model',
            'Prompt engineering', 'RAG retrieval', 'Vector database',
            'Embedding AI', 'Semantic search', 'AI agents',
            'AutoGPT agent', 'BabyAGI agent', 'LangGraph agent',
            'AI trong giáo dục', 'AI trong tài chính', 'AI trong bán lẻ',
            'AI trong sản xuất', 'AI trong logistics', 'AI trong nông nghiệp',
            'AI trong bảo mật', 'AI trong game', 'AI trong âm nhạc',
            'AI trong thời trang', 'AI trong bất động sản', 'AI trong pháp luật',
            'AI trong tuyển dụng', 'AI trong marketing', 'AI trong customer service',
            'Boston Dynamics robot', 'Tesla Optimus robot', 'Figure AI robot',
            'Unitree robot dog', 'Spot robot Boston', 'Atlas humanoid',
            'Sophia robot Hanson', 'AI ethical concerns', 'AI safety research',
            'AI regulation policy', 'AI job displacement', 'AI augmentation human'
        ]
    },
    thoitrang: {
        searchQueries: ['fashion style', 'clothing outfit', 'street style', 'fashion model', 'trendy clothes'],
        videoQueries: ['fashion', 'style', 'outfit'],
        hashtags: ['Thoitrang', 'Fashion', 'Style', 'Outfit', 'OOTD', 'Streetstyle', 'Fashionista', 'Trendy'],
        titles: [
            'Outfit hôm nay đẹp không', 'Xu hướng thời trang mới', 'Phối đồ đơn giản mà chất',
            'Thời trang đường phố', 'Váy mới mua xinh quá', 'Áo khoác mùa đông',
            'Giày sneaker hot trend', 'Phụ kiện thời trang', 'Túi xách đẹp ghê',
            'Đồ công sở thanh lịch', 'Thời trang bền vững', 'Mix match theo phong cách',
            'Thời trang vintage', 'Áo hoodie thoải mái', 'Quần jeans basic không bao giờ lỗi mốt',
            'Gucci luxury fashion', 'Louis Vuitton LV', 'Chanel classic',
            'Dior elegant', 'Prada sophisticated', 'Hermès timeless',
            'Balenciaga streetwear', 'Versace bold', 'Fendi Italian',
            'Burberry British', 'Givenchy Paris', 'Saint Laurent YSL',
            'Bottega Veneta leather', 'Valentino romantic', 'Celine minimalist',
            'Loewe creative', 'Alexander McQueen dramatic', 'Off-White Virgil',
            'Nike Just Do It', 'Adidas 3 stripes', 'Puma sporty',
            'New Balance retro', 'Converse classic', 'Vans skate',
            'Jordan sneakers', 'Yeezy Kanye', 'Travis Scott collab',
            'Supreme streetwear', 'BAPE camo', 'Stüssy surf',
            'Palace skate', 'Kith lifestyle', 'Fear of God luxury',
            'Essentials casual', 'Stone Island techwear', 'CP Company',
            'Uniqlo basic', 'H&M fast fashion', 'Zara trendy',
            'Mango stylish', 'COS minimalist', 'ARKET Scandi',
            'Massimo Dutti elegant', 'Pull&Bear casual', 'Bershka young',
            'ASOS variety', 'Shein affordable', 'Fashion Nova curve',
            'Áo sơ mi trắng classic', 'Áo polo casual', 'Áo thun basic',
            'Áo len mùa đông', 'Áo khoác da biker', 'Áo blazer công sở',
            'Áo cardigan cozy', 'Áo vest formal', 'Áo denim casual',
            'Quần âu công sở', 'Quần kaki casual', 'Quần jogger sporty',
            'Quần short mùa hè', 'Quần culottes trendy', 'Quần ống rộng',
            'Váy midi elegant', 'Váy maxi boho', 'Váy mini party',
            'Đầm công sở chic', 'Đầm dự tiệc glamour', 'Đầm casual everyday',
            'Giày Oxford classic', 'Giày loafer preppy', 'Giày boots badass',
            'Giày cao gót elegant', 'Giày sandal summer', 'Giày thể thao sporty',
            'Túi tote practical', 'Túi crossbody handy', 'Túi clutch party',
            'Túi backpack casual', 'Ví cầm tay compact', 'Belt lưng accessory',
            'Kính mát sunglasses', 'Đồng hồ watch', 'Vòng tay bracelet',
            'Dây chuyền necklace', 'Hoa tai earrings', 'Nhẫn ring',
            'Mũ cap hat', 'Khăn quàng scarf', 'Găng tay gloves'
        ]
    }
};

// ========== HELPER FUNCTIONS ==========
function generateObjectId(prefix, index) {
    return prefix + index.toString(16).padStart(8, '0');
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems(arr, min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function getRandomDate() {
    const now = new Date();
    const randomDays = Math.floor(Math.random() * 90);
    const randomHours = Math.floor(Math.random() * 24);
    const randomMinutes = Math.floor(Math.random() * 60);
    return new Date(now.getTime() - (randomDays * 24 * 60 + randomHours * 60 + randomMinutes) * 60 * 1000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPexelsImages(query, perPage = 80, page = 1) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`;
    try {
        const response = await fetch(url, { headers: { 'Authorization': PEXELS_API_KEY } });
        if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);
        const data = await response.json();
        return data.photos || [];
    } catch (error) {
        console.error(`Error fetching images for "${query}":`, error.message);
        return [];
    }
}

async function fetchPexelsVideos(query, perPage = 20) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
    try {
        const response = await fetch(url, { headers: { 'Authorization': PEXELS_API_KEY } });
        if (!response.ok) throw new Error(`Pexels Video API error: ${response.status}`);
        const data = await response.json();
        return data.videos || [];
    } catch (error) {
        console.error(`Error fetching videos for "${query}":`, error.message);
        return [];
    }
}

// ========== MAIN FUNCTION ==========
async function main() {
    console.log('🚀 Starting Pexels Scraper for 100,000 Posts...\n');
    console.log(`📊 Target: ${TOTAL_POSTS} posts`);
    console.log(`🎬 Video posts: ~${Math.floor(TOTAL_POSTS / VIDEO_RATIO)} (1/${VIDEO_RATIO})`);
    console.log(`🖼️ Image posts: ~${TOTAL_POSTS - Math.floor(TOTAL_POSTS / VIDEO_RATIO)}\n`);

    const topicKeys = Object.keys(TOPICS);
    const topicImages = {};
    const topicVideos = {};

    // Step 1: Fetch images and videos for each topic
    console.log('📥 Fetching images and videos from Pexels API...\n');

    for (const topicKey of topicKeys) {
        const topicData = TOPICS[topicKey];
        topicImages[topicKey] = [];
        topicVideos[topicKey] = [];

        console.log(`📌 Topic: ${topicKey.toUpperCase()}`);

        // Fetch images
        for (const query of topicData.searchQueries) {
            console.log(`   🖼️ Fetching images: "${query}"...`);
            const images = await fetchPexelsImages(query, 80);
            topicImages[topicKey].push(...images);
            await sleep(300);
        }
        console.log(`   ✅ Total images: ${topicImages[topicKey].length}`);

        // Fetch videos
        for (const query of topicData.videoQueries) {
            console.log(`   🎬 Fetching videos: "${query}"...`);
            const videos = await fetchPexelsVideos(query, 15);
            topicVideos[topicKey].push(...videos);
            await sleep(300);
        }
        console.log(`   ✅ Total videos: ${topicVideos[topicKey].length}\n`);
    }

    // Step 2: Generate posts
    console.log('\n📝 Generating posts...\n');

    const allPosts = [];
    let mediaIndex = 0;

    for (let i = 0; i < TOTAL_POSTS; i++) {
        const topicKey = topicKeys[i % topicKeys.length];
        const topicData = TOPICS[topicKey];
        const isVideo = (i % VIDEO_RATIO === 0);

        const userId = getRandomItem(USER_IDS);
        const title = getRandomItem(topicData.titles);
        const hashtags = getRandomItems(topicData.hashtags, 1, 3);
        const hashtagText = hashtags.map(h => `#${h}`).join(' ');
        const content = `${title}\n\n${hashtagText}`;

        let media = [];

        if (isVideo && topicVideos[topicKey].length > 0) {
            const video = getRandomItem(topicVideos[topicKey]);
            const videoFile = video.video_files?.find(f => f.quality === 'sd' || f.quality === 'hd') || video.video_files?.[0];
            if (videoFile) {
                media = [{
                    mediaType: 'VIDEO',
                    url: videoFile.link,
                    publicId: `pexels_video_${topicKey}_${video.id}`,
                    width: videoFile.width || 1920,
                    height: videoFile.height || 1080,
                    _id: { $oid: generateObjectId(MEDIA_ID_PREFIX, mediaIndex++) }
                }];
            }
        }

        // If no video or not video post, add images
        if (media.length === 0 && topicImages[topicKey].length > 0) {
            const imageCount = Math.floor(Math.random() * 4) + 1; // 1-4 images
            const selectedImages = getRandomItems(topicImages[topicKey], 1, imageCount);

            for (const img of selectedImages) {
                media.push({
                    mediaType: 'IMAGE',
                    url: img.src?.large2x || img.src?.large || img.src?.original,
                    publicId: `pexels_image_${topicKey}_${img.id}`,
                    width: img.width || 1920,
                    height: img.height || 1280,
                    _id: { $oid: generateObjectId(MEDIA_ID_PREFIX, mediaIndex++) }
                });
            }
        }

        if (media.length === 0) continue; // Skip if no media

        const createdAt = getRandomDate();

        const post = {
            _id: { $oid: generateObjectId(POST_ID_PREFIX, i) },
            privacy: 'PUBLIC',
            content: content,
            userId: { $oid: userId },
            groupId: null,
            isAnonymous: false,
            sharedPostId: null,
            media: media,
            background: null,
            totalReacts: Math.floor(Math.random() * 500),
            totalComments: Math.floor(Math.random() * 100),
            totalShares: Math.floor(Math.random() * 50),
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

        if ((i + 1) % 10000 === 0) {
            console.log(`✅ Generated ${i + 1}/${TOTAL_POSTS} posts...`);
        }
    }

    // Step 3: Save to file
    console.log(`\n📊 Total posts generated: ${allPosts.length}`);

    const videoPosts = allPosts.filter(p => p.media[0]?.mediaType === 'VIDEO').length;
    console.log(`🎬 Video posts: ${videoPosts}`);
    console.log(`🖼️ Image posts: ${allPosts.length - videoPosts}`);

    console.log('\n💾 Saving to posts-collection-final.json...');
    fs.writeFileSync('./posts-collection-final.json', JSON.stringify(allPosts, null, 2), 'utf-8');
    console.log('✅ Done! File saved: posts-collection-final.json');
}

main().catch(console.error);
