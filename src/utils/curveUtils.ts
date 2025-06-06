import { Point, CurveConfig } from '../types';

// 默认曲线配置
const DEFAULT_CONFIG: CurveConfig = {
  alpha: 0.85,    // 增加方向继承权重，使子分支更倾向于保持父分支方向
  beta: 0.35,     // 减小曲线张力系数，使曲线更平滑
  gamma: 180,     // 增加最大控制距离，使曲线有更大的活动空间
  phi: Math.PI/8, // 减小曲线张开角到22.5度，使分支更自然
  kr: 0.25       // 减小斥力系数，避免线条过度分离
};

// 计算两点之间的角度
export function calculateAngle(p0: Point, p3: Point): number {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  return Math.atan2(dy, dx);
}

// 计算点之间的距离
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 根据深度调整曲线参数
export function getDepthAdjustedBeta(depth: number): number {
  // 使用 sigmoid 函数使深度适应更平滑
  return 0.5 - 0.15 * (2 / (1 + Math.exp(-0.4 * (depth - 2))) - 1);
}

// 计算控制点
export function calculateControlPoints(
  p0: Point,
  p3: Point,
  depth: number,
  parentAngle?: number,
  config: Partial<CurveConfig> = {}
): [Point, Point] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // 计算基础角度
  const currentAngle = calculateAngle(p0, p3);
  
  // 使用平滑过渡的角度继承
  const theta = cfg.alpha * currentAngle + (1 - cfg.alpha) * (parentAngle || currentAngle);
  
  // 根据深度调整距离，使用更平滑的深度适应
  const dist = distance(p0, p3);
  const depthFactor = getDepthAdjustedBeta(depth);
  const d = cfg.beta * Math.min(dist, cfg.gamma) * depthFactor;
  
  // 根据方向动态调整控制点角度
  const isLeft = p3.x < p0.x;
  const angleAdjustment = isLeft ? -0.1 : 0.1; // 添加轻微的方向偏移
  
  // 计算控制点，加入方向感
  const p1: Point = {
    x: p0.x + d * Math.cos(theta + cfg.phi + angleAdjustment),
    y: p0.y + d * Math.sin(theta + cfg.phi + angleAdjustment)
  };
  
  const p2: Point = {
    x: p3.x + d * Math.cos(theta - cfg.phi + angleAdjustment),
    y: p3.y + d * Math.sin(theta - cfg.phi + angleAdjustment)
  };
  
  return [p1, p2];
}

// 应用力导向优化
export function applyForceRepulsion(
  lines: Array<[Point, Point]>,
  p1: Point,
  p2: Point,
  config: Partial<CurveConfig> = {}
): [Point, Point] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const midPoint = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
  
  let forceX = 0;
  let forceY = 0;
  
  // 计算所有其他线段的斥力
  lines.forEach(([otherP1, otherP2]) => {
    const otherMid = {
      x: (otherP1.x + otherP2.x) / 2,
      y: (otherP1.y + otherP2.y) / 2
    };
    
    const dx = midPoint.x - otherMid.x;
    const dy = midPoint.y - otherMid.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    
    if (d > 0 && d < cfg.gamma) {
      const force = cfg.kr / (d * d);
      forceX += (dx / d) * force;
      forceY += (dy / d) * force;
    }
  });
  
  // 应用力的影响
  return [
    { x: p1.x + forceX, y: p1.y + forceY },
    { x: p2.x + forceX, y: p2.y + forceY }
  ];
}

// 动画缓动函数
export function easeOutExpo(t: number): number {
  return 1 - Math.exp(-5 * t);
}

// 绘制高级曲线
export function drawAdvancedCurve(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p3: Point,
  depth: number,
  parentAngle?: number,
  allLines?: Array<[Point, Point]>,
  config: Partial<CurveConfig> = {}
): void {
  // 计算控制点
  let [p1, p2] = calculateControlPoints(p0, p3, depth, parentAngle, config);
  
  // 应用力导向优化（如果提供了其他线条信息）
  if (allLines) {
    [p1, p2] = applyForceRepulsion(allLines, p1, p2, config);
  }
  
  // 开始绘制
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  
  // 根据深度设置线条样式，使用更优雅的渐变
  const baseOpacity = Math.max(0.5, 1 - depth * 0.12);
  const startColor = `rgba(64, 169, 255, ${baseOpacity})`;
  const endColor = `rgba(64, 169, 255, ${baseOpacity * 0.9})`;
  
  // 创建渐变
  const gradient = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(2, 3.5 - depth * 0.3);
  
  // 添加发光效果
  ctx.shadowColor = 'rgba(64, 169, 255, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // 使用圆形线帽使线条更圆滑
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.stroke();
  
  // 重置阴影
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
} 