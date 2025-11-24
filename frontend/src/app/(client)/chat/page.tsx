import React, { useState } from 'react';
import {
    Search,
    MoreHorizontal,
    Edit,
    Video,
    Phone,
    Info,
    Image as ImageIcon,
    Smile,
    ThumbsUp,
    PlusCircle,
    FileText,
    Send,
    ChevronDown,
    Bell,
    Search as SearchIcon
} from 'lucide-react';

// --- MOCK DATA (Hardcode dữ liệu giả) ---
const USERS = [
    { id: 1, name: 'Công nương nemchuazabeth', avatar: 'https://i.pravatar.cc/150?u=1', status: 'online', lastMsg: 'bá tước Patrick Walker: ae trungky oc...', time: '31 phút' },
    { id: 2, name: 'To Ki', avatar: 'https://i.pravatar.cc/150?u=2', status: 'offline', lastMsg: 'Bạn: I love you too 🥰🥰🥰', time: '1 giờ' },
    { id: 3, name: 'Trường Giang', avatar: 'https://i.pravatar.cc/150?u=3', status: 'online', lastMsg: 'Bạn: Cảm giác tự tay làm nó đã', time: '1 giờ' },
    { id: 4, name: 'Nghiêm Chí Thiện', avatar: 'https://i.pravatar.cc/150?u=4', status: 'offline', lastMsg: 'Bạn: Wtf', time: '3 giờ' },
    { id: 5, name: 'Senseiiiii', avatar: 'https://i.pravatar.cc/150?u=5', status: 'online', lastMsg: 'Bạn đã gửi một nhãn dán', time: '4 giờ' },
    { id: 6, name: 'Mạnh Cường', avatar: 'https://i.pravatar.cc/150?u=6', status: 'offline', lastMsg: 'Bạn: Okii', time: '5 giờ' },
];

const MESSAGES = [
    { id: 1, senderId: 1, text: 'Chào mọi người, tôi là IVYmoda...', type: 'text', time: '16:20' },
    { id: 2, senderId: 1, text: '', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80', time: '16:25' },
    { id: 3, senderId: 'me', text: 'ae trungky oc oc', type: 'text', time: '16:27' },
];

// Component con: Accordion cho Sidebar phải
const AccordionItem = ({ title = "", children = "", isOpen = false }: { title?: string, children?: React.ReactNode, isOpen?: boolean }) => {
    const [open, setOpen] = useState(isOpen);
    return (
        <div className="border-b border-transparent">
            <button
                className="w-full flex justify-between items-center p-4 hover:bg-[#3A3B3C] transition-colors"
                onClick={() => setOpen(!open)}
            >
                <span className="font-semibold text-[14px] text-[#E4E6EB]">{title}</span>
                <ChevronDown size={18} className={`transform transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-2 pb-2 text-[#B0B3B8]">{children}</div>}
        </div>
    )
}

export default function ChatPage() {
    return (
        <div className="flex h-screen w-full bg-[#18191A] text-[#E4E6EB] overflow-hidden font-sans">
            {/* --- LEFT SIDEBAR (Chat List) --- */}
            <div className="w-[360px] flex flex-col border-r border-[#2F3031]">
                <div className="p-4 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Đoạn chat</h2>
                    <div className="flex gap-2">
                        <button className="p-2 bg-[#3A3B3C] rounded-full hover:bg-[#4E4F50]"><MoreHorizontal size={20} /></button>
                        <button className="p-2 bg-[#3A3B3C] rounded-full hover:bg-[#4E4F50]"><Edit size={20} /></button>
                    </div>
                </div>

                <div className="px-4 pb-2">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-2.5 text-[#B0B3B8]" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm trên Messenger"
                            className="w-full bg-[#3A3B3C] rounded-full py-2 pl-10 pr-4 outline-none text-sm placeholder-[#B0B3B8]"
                        />
                    </div>
                </div>

                <div className="flex gap-2 px-4 py-2">
                    <button className="px-3 py-1 bg-[#252F3C] text-[#2E89FF] rounded-full text-sm font-semibold">Tất cả</button>
                    <button className="px-3 py-1 hover:bg-[#3A3B3C] rounded-full text-sm font-semibold text-[#B0B3B8]">Chưa đọc</button>
                    <button className="px-3 py-1 hover:bg-[#3A3B3C] rounded-full text-sm font-semibold text-[#B0B3B8]">Nhóm</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {USERS.map((user) => (
                        <div key={user.id} className={`flex items-center p-3 gap-3 cursor-pointer hover:bg-[#252F3C] ${user.id === 1 ? 'bg-[#252F3C]' : ''}`}>
                            <div className="relative">
                                <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full object-cover" />
                                {user.status === 'online' && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#18191A]"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-[15px] truncate">{user.name}</h4>
                                <div className="flex items-center text-[13px] text-[#B0B3B8] gap-1">
                                    <p className="truncate">{user.lastMsg}</p>
                                    <span>·</span>
                                    <span>{user.time}</span>
                                </div>
                            </div>
                            {user.id === 1 && <div className="w-3 h-3 bg-[#2E89FF] rounded-full"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- MAIN CHAT AREA --- */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-16 px-4 flex items-center justify-between border-b border-[#2F3031] shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={USERS[0].avatar} alt="" className="w-10 h-10 rounded-full" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#18191A]"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-[17px]">Công nương nemchuazabeth của vương quốc raumania</h3>
                            <p className="text-[13px] text-[#B0B3B8]">Đang hoạt động</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[#A8ABDF]">
                        <Phone size={24} className="cursor-pointer hover:opacity-80" />
                        <Video size={24} className="cursor-pointer hover:opacity-80" />
                        <Info size={24} className="cursor-pointer hover:opacity-80" />
                    </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="text-center text-[#B0B3B8] text-xs my-4">16 Tháng 4 lúc 16:15</div>

                    {/* Pinned Message Mock */}
                    <div className="bg-[#242526] p-3 rounded-lg mb-4 flex items-start gap-3 border border-[#2F3031]">
                        <div className="text-xs text-[#B0B3B8]">
                            <span className="font-bold text-[#E4E6EB]">Princesse de Raumania</span> đã ghim tin nhắn này.
                            <div className="mt-1 text-[#E4E6EB] italic">"大家好, 我是 IVYmoda..."</div>
                        </div>
                    </div>

                    {MESSAGES.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}>
                            {msg.senderId !== 'me' && (
                                <img src={USERS[0].avatar} className="w-8 h-8 rounded-full self-end mb-1" />
                            )}
                            <div className={`max-w-[70%] ${msg.type === 'image' ? '' : 'px-3 py-2 rounded-2xl'} ${msg.senderId === 'me'
                                ? 'bg-[#3E4042] text-white'
                                : msg.type === 'image' ? '' : 'bg-[#3E4042] text-white'
                                }`}>
                                {msg.type === 'image' ? (
                                    <div className="relative group">
                                        <img src={msg.imageUrl} className="rounded-xl border border-[#2F3031] max-h-80 w-auto object-cover" />
                                    </div>
                                ) : (
                                    <p>{msg.text}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator mock */}
                    <div className="flex justify-end text-[11px] text-[#B0B3B8] mt-1 mr-2">Đã xem</div>
                </div>

                {/* Input Area */}
                <div className="p-3 flex items-center gap-3">
                    <PlusCircle size={24} className="text-[#A8ABDF] cursor-pointer" />
                    <ImageIcon size={24} className="text-[#A8ABDF] cursor-pointer" />
                    <FileText size={24} className="text-[#A8ABDF] cursor-pointer" />
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Aa"
                            className="w-full bg-[#3A3B3C] rounded-full py-2 pl-4 pr-10 outline-none text-[#E4E6EB]"
                        />
                        <Smile className="absolute right-3 top-2 text-[#A8ABDF] cursor-pointer" size={20} />
                    </div>
                    <ThumbsUp size={24} className="text-[#A8ABDF] cursor-pointer" />
                </div>
            </div>

            {/* --- RIGHT SIDEBAR (Details) --- */}
            <div className="w-[300px] border-l border-[#2F3031] flex flex-col hidden lg:flex">
                <div className="p-4 flex flex-col items-center border-b border-[#2F3031]">
                    <div className="relative mb-3">
                        <img src={USERS[0].avatar} className="w-24 h-24 rounded-full object-cover" />
                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-[#18191A]"></div>
                    </div>
                    <h3 className="font-bold text-center text-lg mb-1">Công nương nemchuazabeth của vương quốc raumania</h3>
                    <p className="text-sm text-[#B0B3B8]">Đang hoạt động</p>

                    <div className="flex gap-6 mt-4">
                        <div className="flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center hover:bg-[#4E4F50]"><Bell size={18} /></div>
                            <span className="text-xs text-[#B0B3B8]">Bật lại</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center hover:bg-[#4E4F50]"><SearchIcon size={18} /></div>
                            <span className="text-xs text-[#B0B3B8]">Tìm kiếm</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <AccordionItem title="Thông tin về đoạn chat" />
                    <AccordionItem title="Tùy chỉnh đoạn chat" />
                    <AccordionItem title="Thành viên trong đoạn chat" />
                    <AccordionItem title="File phương tiện, file và liên kết" isOpen={true}>
                        <div className="flex flex-col gap-2 pl-2">
                            <div className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded cursor-pointer">
                                <ImageIcon size={18} className="text-[#B0B3B8]" />
                                <span className="font-medium text-sm">File phương tiện</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded cursor-pointer">
                                <FileText size={18} className="text-[#B0B3B8]" />
                                <span className="font-medium text-sm">File</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 hover:bg-[#3A3B3C] rounded cursor-pointer">
                                <div className="rotate-45"><PlusCircle size={18} className="text-[#B0B3B8]" /></div>
                                <span className="font-medium text-sm">Liên kết</span>
                            </div>
                        </div>
                    </AccordionItem>
                    <AccordionItem title="Quyền riêng tư và hỗ trợ" />
                </div>
            </div>
        </div>
    );
};