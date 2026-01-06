'use client';

import ProfilePage from '@/components/profile/ProfilePage';
import { useParams } from 'next/navigation';

export default function Profile() {
    const params = useParams();
    const userName = params.username as string;

    return <ProfilePage userName={userName} />;
}
