/**
 * 深度合并两个对象，用于合并主题配置
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result: any = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * 检查值是否为对象
 */
function isObject(item: any): item is object {
  return item && typeof item === 'object' && !Array.isArray(item);
} 