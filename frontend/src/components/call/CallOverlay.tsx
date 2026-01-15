'use client';

import React from 'react';
import IncomingCall from './IncomingCall';
import VideoCall from './VideoCall';

export default function CallOverlay() {
    return (
        <>
            <IncomingCall />
            <VideoCall />
        </>
    );
}
