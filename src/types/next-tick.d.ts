declare module 'next-tick' {
  const nextTick: (callback: (...args: any[]) => void, ...args: any[]) => void;
  export default nextTick;
} 