'use client';

import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
    window.global = window;
    window.process = process;
    window.Buffer = Buffer;
}
