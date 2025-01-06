import { Buffer } from 'buffer';
import nextTick from 'next-tick';

// Polyfills for simple-peer
if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = {
    env: { DEBUG: undefined },
    version: '',
    nextTick: nextTick
  };
  (window as any).Buffer = Buffer;
} 