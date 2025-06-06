import { MindMapNode } from '../types';

/**
 * 节点缓存管理器
 */
export class NodeCache {
  private cache: Map<string, any>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string) {
    return this.cache.get(key);
  }

  set(key: string, value: any) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  has(key: string) {
    return this.cache.has(key);
  }
}

/**
 * 节点度量信息缓存
 */
export class MetricsCache {
  private cache: Map<string, { width: number; height: number }>;

  constructor() {
    this.cache = new Map();
  }

  getMetrics(node: MindMapNode, fontSize: number) {
    const key = `${node.name}-${fontSize}`;
    return this.cache.get(key);
  }

  setMetrics(node: MindMapNode, fontSize: number, metrics: { width: number; height: number }) {
    const key = `${node.name}-${fontSize}`;
    this.cache.set(key, metrics);
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 100
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  ms: number = 16
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= ms) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}

/**
 * RAF 节流
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

/**
 * 计算文本尺寸的缓存函数
 */
export function createTextMetricsCache() {
  const cache = new Map<string, TextMetrics>();
  
  return function getTextMetrics(
    text: string,
    font: string,
    ctx: CanvasRenderingContext2D
  ): TextMetrics {
    const key = `${text}-${font}`;
    if (!cache.has(key)) {
      ctx.font = font;
      cache.set(key, ctx.measureText(text));
    }
    return cache.get(key)!;
  };
}

/**
 * 优化的动画函数
 */
export function animate({
  from,
  to,
  duration,
  easing = (t: number) => t,
  onUpdate,
  onComplete
}: {
  from: number;
  to: number;
  duration: number;
  easing?: (t: number) => number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}) {
  const startTime = performance.now();
  
  function update() {
    const currentTime = performance.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easedProgress = easing(progress);
    const currentValue = from + (to - from) * easedProgress;
    
    onUpdate(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else if (onComplete) {
      onComplete();
    }
  }
  
  requestAnimationFrame(update);
} 