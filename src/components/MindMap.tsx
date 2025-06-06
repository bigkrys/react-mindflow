import React, { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import type { BaseType } from 'd3-selection';
import type { MindMapNode } from '../types';
import { ThemeConfig, defaultTheme } from '../types/styles';
import { deepMerge } from '../utils/theme';
import type { CSSProperties } from 'react';
import { SafeHierarchyNode, createHierarchy, createSafeHierarchy } from '../types/hierarchy';
import { drawAdvancedCurve } from '../utils/curveUtils';

interface ExtendedHierarchyNode extends d3.HierarchyNode<MindMapNode> {
  _children?: d3.HierarchyNode<MindMapNode>[] | null;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface NodeMetrics {
  width: number;
  height: number;
  x: number;
  y: number;
}

// 定义动画时间常量
const ANIMATION = {
  EXPAND: 200,    // 展开/折叠动画
  CENTER: 200,    // 居中动画
  FADE: 200,      // 渐入渐出动画
  CURVE: 300      // 连线动画
} as const;

interface MindMapProps {
  data: MindMapNode;
  width?: number;
  height?: number;
  theme?: Partial<ThemeConfig>;
  initialDepth?: number;
  onNodeClick?: (node: MindMapNode) => void;
  onNodeExpand?: (node: MindMapNode) => void;
  onNodeCollapse?: (node: MindMapNode) => void;
  enableDrag?: boolean;
  enableZoom?: boolean;
  zoomRange?: [number, number];
  className?: string;
  style?: CSSProperties;
  showExpandButtons?: boolean;
}

export const MindMap: React.FC<MindMapProps> = ({
  data,
  width: containerWidth,
  height: containerHeight,
  theme: customTheme,
  initialDepth = 2,
  onNodeClick,
  onNodeExpand,
  onNodeCollapse,
  enableDrag = true,
  enableZoom = true,
  zoomRange = [0.1, 3],
  className,
  style,
  showExpandButtons = true
}) => {
  // 合并自定义主题和默认主题
  const theme = useMemo(() => 
    deepMerge(defaultTheme, customTheme || {}) as ThemeConfig
  , [customTheme]);

  // 使用 useState 来存储实际尺寸
  const [dimensions, setDimensions] = useState(() => {
    const defaultWidth = containerWidth || 800; // 设置默认宽度
    const defaultHeight = containerHeight || 600; // 设置默认高度
    return {
      width: defaultWidth,
      height: defaultHeight
    };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dimensionsRef = useRef(dimensions);
  const transformRef = useRef<Transform>({ x: dimensions.width / 2, y: dimensions.height / 2, scale: 1 });
  const isInitializedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const nodesMetricsRef = useRef<Map<string, NodeMetrics>>(new Map());
  const hoveredNodeRef = useRef<d3.HierarchyNode<MindMapNode> | null>(null);
  const animationFrameRef = useRef<number>();

  const [expandedNodes, setExpandedNodes] = useState(() => new Set<string>());
  const [nodeToCenterAfterExpand, setNodeToCenterAfterExpand] = useState<d3.HierarchyNode<MindMapNode> | null>(null);

  // 添加布局缓存
  const layoutCache = useRef<Map<string, d3.HierarchyNode<MindMapNode>>>(new Map());

  // 添加函数引用
  const calculateLayoutRef = useRef<(root: d3.HierarchyNode<MindMapNode>) => d3.HierarchyNode<MindMapNode>>();

  // 修改布局计算函数
  const calculateLayout = useCallback((root: d3.HierarchyNode<MindMapNode>) => {
    // 首先计算基本布局
    const tree = d3.tree<MindMapNode>()
      .nodeSize([240, 400])
      .separation((a, b) => {
        // 检查节点是否展开
        const isAExpanded = expandedNodes.has(a.data.name);
        const isBExpanded = expandedNodes.has(b.data.name);
        
        // 计算展开状态下的子节点数量
        const getExpandedChildCount = (node: d3.HierarchyNode<MindMapNode>): number => {
          if (!node.children || !expandedNodes.has(node.data.name)) return 0;
          return node.children.length + node.children.reduce((sum, child) => 
            sum + getExpandedChildCount(child), 0
          );
        };
        
        // 获取展开的子节点数量
        const aChildCount = getExpandedChildCount(a);
        const bChildCount = getExpandedChildCount(b);
        
        // 根据层级和展开状态调整节点间距
        if (a.parent === b.parent) {
          if (!a.parent?.parent) {
            // 根节点的直接子节点
            const baseSpacing = 4.0;
            const childrenFactor = Math.max(
              1,
              Math.log2(Math.max(aChildCount, bChildCount) + 1) * 0.3
            );
            return baseSpacing * (isAExpanded || isBExpanded ? 1.6 * childrenFactor : 1);
          } else if (a.parent?.parent && !a.parent?.parent?.parent) {
            // 第二层节点
            const baseSpacing = 3.6;
            const childrenFactor = Math.max(
              1,
              Math.log2(Math.max(aChildCount, bChildCount) + 1) * 0.25
            );
            return baseSpacing * (isAExpanded || isBExpanded ? 1.5 * childrenFactor : 1);
          }
          // 更深层节点
          const baseSpacing = 3.2;
          const childrenFactor = Math.max(
            1,
            Math.log2(Math.max(aChildCount, bChildCount) + 1) * 0.2
          );
          return baseSpacing * (isAExpanded || isBExpanded ? 1.4 * childrenFactor : 1);
        }
        
        // 不同父节点之间的间距
        const baseSpacing = a.depth === 1 ? 5.0 : 4.2;
        const childrenFactor = Math.max(
          1,
          Math.log2(Math.max(aChildCount, bChildCount) + 1) * 0.15
        );
        return baseSpacing * (isAExpanded || isBExpanded ? 1.5 * childrenFactor : 1);
      });

    const layoutedRoot = tree(root);

    // 如果是根节点且有子节点，将子节点分为左右两部分
    if (layoutedRoot.depth === 0 && layoutedRoot.children) {
      // 将根节点放在原点
      layoutedRoot.x = 0;
      layoutedRoot.y = 0;

      // 将子节点分为两组
      const midIndex = Math.ceil(layoutedRoot.children.length / 2);
      const leftNodes = layoutedRoot.children.slice(0, midIndex);
      const rightNodes = layoutedRoot.children.slice(midIndex);

      // 调整分支展开角度的函数
      const adjustBranchAngles = (nodes: d3.HierarchyNode<MindMapNode>[], isLeft: boolean) => {
        // 计算总的展开子节点数量
        const getTotalExpandedChildCount = (node: d3.HierarchyNode<MindMapNode>): number => {
          if (!expandedNodes.has(node.data.name)) return 0;
          return (node.children?.length || 0) + 
            (node.children?.reduce((sum, child) => sum + getTotalExpandedChildCount(child), 0) || 0);
        };

        nodes.forEach((node, nodeIndex) => {
          const expandedChildCount = getTotalExpandedChildCount(node);
          
          // 调整基础角度，使其更加上扬
          const baseAngle = isLeft ? -0.4 : 0.4; // 增大基础角度到约23度
          const spreadFactor = isLeft ? 1 : -1;
          const relativeIndex = isLeft ? nodeIndex : nodes.length - 1 - nodeIndex;
          
          // 优化角度偏移的计算
          const baseOffset = (relativeIndex / Math.max(nodes.length - 1, 1)) * 0.2; // 增加角度偏移
          const childrenFactor = Math.max(1, Math.log2(expandedChildCount + 1) * 0.1);
          const angleOffset = baseOffset * childrenFactor;
          
          // 计算节点位置，增加垂直和水平间距
          const distance = Math.abs(node.y || 0) * 2.0; // 增加水平间距
          const verticalLift = distance * 0.4; // 增加垂直提升
          const angle = baseAngle + (angleOffset * spreadFactor);
          
          node.y = distance * Math.cos(angle) * (isLeft ? -1 : 1);
          node.x = distance * Math.sin(angle) - verticalLift;

          // 递归处理子节点，确保不重叠
          if (node.children && expandedNodes.has(node.data.name)) {
            const childAngle = angle * 1.3; // 增加子节点的角度差异
            node.children.forEach((child, i) => {
              const queue = [child];
              const depthMultiplier = 0.85; // 减小深度系数使布局更分散
              
              while (queue.length > 0) {
                const current = queue.shift()!;
                const depth = current.depth - node.depth;
                const currentDistance = Math.abs(current.y || 0) * Math.pow(depthMultiplier, depth);
                const childVerticalLift = currentDistance * (0.4 + depth * 0.15); // 增加深度相关的垂直提升
                
                // 添加水平偏移以避免重叠
                const horizontalOffset = (i - (node.children!.length - 1) / 2) * 50; // 子节点水平分散
                
                current.y = (currentDistance * Math.cos(childAngle) + horizontalOffset) * (isLeft ? -1 : 1);
                const nodeX = node.x || 0;
                const currentX = current.x || 0;
                // 确保子节点总是在父节点上方
                current.x = Math.min(
                  nodeX - Math.abs(horizontalOffset) * 0.3, // 上限：父节点位置减去水平偏移的影响
                  nodeX + (currentX - nodeX) * 0.7 - childVerticalLift // 下限：标准位置
                );
                
                if (current.children && expandedNodes.has(current.data.name)) {
                  queue.push(...current.children);
                }
              }
            });
          }
        });
      };

      // 分别处理左右两侧的分支
      adjustBranchAngles(leftNodes, true);
      adjustBranchAngles(rightNodes, false);

      // 调整垂直位置，使树更加向上发散
      const verticalSpacing = 160; // 增加垂直间距
      const adjustVerticalPosition = (nodes: d3.HierarchyNode<MindMapNode>[], startX: number = 0) => {
        if (!nodes || nodes.length === 0) return;
        
        nodes.forEach((node, index) => {
          const isExpanded = expandedNodes.has(node.data.name);
          
          // 根据深度和展开状态调整垂直间距
          let spacingMultiplier;
          if (node.depth === 1) {
            spacingMultiplier = 1.8 * (isExpanded ? 1.4 : 1);
          } else if (node.depth === 2) {
            spacingMultiplier = 1.6 * (isExpanded ? 1.3 : 1);
          } else {
            spacingMultiplier = 1.4 * (isExpanded ? 1.2 : 1);
          }
          
          const spacing = verticalSpacing * spacingMultiplier;
          let additionalSpacing = 0;
          
          if (index > 0) {
            const prevNode = nodes[index - 1];
            if (expandedNodes.has(prevNode.data.name)) {
              additionalSpacing = spacing * 0.3; // 增加节点间距
            }
          }
          
          // 添加向上的偏移，确保不重叠
          const upwardOffset = node.depth * 30; // 增加深度相关的向上偏移
          const siblingOffset = index * 20; // 添加兄弟节点间的额外偏移
          node.x = startX + (index * spacing) + additionalSpacing - upwardOffset - siblingOffset;
          
          if (node.children) {
            const childSpacing = spacing * (isExpanded ? 1.6 : 1.4);
            const childOffset = childSpacing * (isExpanded ? 0.4 : 0.3);
            // 子树向上偏移更多
            adjustVerticalPosition(
              node.children, 
              node.x + childOffset - (node.depth + 1) * 25 - (node.children.length * 10)
            );
          }
        });
      };

      const getInitialOffset = (nodes: d3.HierarchyNode<MindMapNode>[]) => {
        let totalSpacing = 0;
        let baseSpacing = verticalSpacing * 1.6;
        
        nodes.forEach((node, index) => {
          if (index > 0) {
            const isCurrentExpanded = expandedNodes.has(node.data.name);
            const isPrevExpanded = expandedNodes.has(nodes[index - 1].data.name);
            const spacing = baseSpacing * (isCurrentExpanded || isPrevExpanded ? 1.3 : 1);
            totalSpacing += spacing;
          }
        });
        
        return -(totalSpacing / 2);
      };

      const leftOffset = getInitialOffset(leftNodes);
      const rightOffset = getInitialOffset(rightNodes);
      
      adjustVerticalPosition(leftNodes, leftOffset);
      adjustVerticalPosition(rightNodes, rightOffset);
    }

    return layoutedRoot;
  }, [expandedNodes]);

  // 设置布局计算函数引用
  useEffect(() => {
    calculateLayoutRef.current = calculateLayout;
  }, [calculateLayout]);

  // 将防抖函数移到组件外部
  const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 100) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  // 优化数据处理
  const processData = useCallback((node: MindMapNode, depth: number = 0): MindMapNode => {
    const cacheKey = `${node.name}-${depth}`;
    const cached = layoutCache.current.get(cacheKey);
    if (cached) {
      return cached.data;
    }

    const processedNode = { ...node, depth };
    
    if (processedNode.children) {
      processedNode.children = processedNode.children.map(child => 
        processData(child, depth + 1)
      );
    }
    
    return processedNode;
  }, []);

  // 优化数据处理
  const processedData = useMemo(() => {
    if (!data) return null;
    try {
      const processed = processData({ ...data });
      if (!processed) return null;
      return processed;
    } catch (error) {
      console.error('数据处理失败:', error);
      return null;
    }
  }, [data, processData]);

  // 修改节点大小计算函数
  const calculateNodeSize = useCallback((node: d3.HierarchyNode<MindMapNode>) => {
    const { fontSize = 16, fontFamily, minWidth = 100, minHeight = 40 } = theme.node;
    const nodePadding = theme.layout.nodePadding || 30;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return { width: minWidth, height: minHeight };

    // 设置更大的字体
    ctx.font = `${fontSize}px ${fontFamily || 'Arial'}`;
    const textMetrics = ctx.measureText(node.data.name);
    
    // 增加节点的最小尺寸
    const width = Math.max(textMetrics.width + nodePadding * 2, minWidth);
    const height = Math.max(fontSize + nodePadding * 2, minHeight);
    
    // 如果是根节点，使用更大的尺寸
    if (node.depth === 0) {
      return {
        width: width * 1.5,
        height: height * 1.2
      };
    }
    
    return { width, height };
  }, [theme]);

  // 计算边界和尺寸
  const calculateBounds = useCallback((root: d3.HierarchyNode<MindMapNode>): Bounds => {
    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    };

    root.descendants().forEach(d => {
      bounds.minX = Math.min(bounds.minX, d.y || 0);
      bounds.maxX = Math.max(bounds.maxX, d.y || 0);
      bounds.minY = Math.min(bounds.minY, d.x || 0);
      bounds.maxY = Math.max(bounds.maxY, d.x || 0);
    });

    return bounds;
  }, []);

  // 修改连接线绘制函数
  const drawConnection = useCallback((
    ctx: CanvasRenderingContext2D,
    source: d3.HierarchyNode<MindMapNode>,
    target: d3.HierarchyNode<MindMapNode>,
    transform: Transform
  ) => {
    const sourcePoint = {
      x: (source.y ?? 0) * transform.scale + transform.x,
      y: (source.x ?? 0) * transform.scale + transform.y
    };
    
    const targetPoint = {
      x: (target.y ?? 0) * transform.scale + transform.x,
      y: (target.x ?? 0) * transform.scale + transform.y
    };

    // 获取父节点的角度（如果存在）
    const parentAngle = source.parent ? 
      Math.atan2(
        (source.x ?? 0) - (source.parent.x ?? 0),
        (source.y ?? 0) - (source.parent.y ?? 0)
      ) : undefined;

    // 使用高级曲线绘制
    drawAdvancedCurve(
      ctx,
      sourcePoint,
      targetPoint,
      target.depth,
      parentAngle,
      undefined, // 暂时不传递所有线条信息
      {
        alpha: 0.7,
        beta: 0.4,
        gamma: 150 * transform.scale,
        phi: Math.PI/6,
        kr: 0.3
      }
    );
  }, []);

  // 修改节点绘制函数
  const drawNode = useCallback((
    ctx: CanvasRenderingContext2D,
    node: d3.HierarchyNode<MindMapNode>,
    transform: Transform,
    isHovered: boolean
  ) => {
    const { width, height } = calculateNodeSize(node);
    const x = node.y ?? 0;
    const y = node.x ?? 0;
    
    // 保存节点度量信息（使用原始坐标）
    nodesMetricsRef.current.set(node.data.name, {
      width,
      height,
      x,
      y
    });

    // 应用变换绘制节点
    const screenX = x * transform.scale + transform.x;
    const screenY = y * transform.scale + transform.y;
    
    // 绘制节点背景
    ctx.save();
    
    // 设置阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'; // 减小阴影透明度
    ctx.shadowBlur = 3 * transform.scale; // 减小阴影模糊半径
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1 * transform.scale; // 减小阴影偏移

    // 绘制背景
    ctx.beginPath();
    const rectX = Math.round(screenX - (width * transform.scale) / 2); // 使用 Math.round 确保像素对齐
    const rectY = Math.round(screenY - (height * transform.scale) / 2);
    const rectWidth = Math.round(width * transform.scale);
    const rectHeight = Math.round(height * transform.scale);
    const radius = Math.round(6 * transform.scale);

    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius, radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.arcTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight, radius);
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.arcTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius, radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.arcTo(rectX, rectY, rectX + radius, rectY, radius);
    ctx.closePath();

    const isRoot = node.depth === 0;
    
    // 设置填充颜色
    if (isRoot) {
      ctx.fillStyle = theme.rootNode.backgroundColor || '#1890ff';
    } else {
      ctx.fillStyle = isHovered ? '#e6f7ff' : '#ffffff';
    }
    
    // 设置边框颜色和宽度
    ctx.strokeStyle = isHovered ? 
      '#40a9ff' : 
      (isRoot ? '#1890ff' : '#91d5ff');
    
    ctx.lineWidth = Math.max(1, (isRoot ? 1.5 : 1) * transform.scale); // 调整线条宽度
    
    // 使用 crisp edges 渲染
    ctx.imageSmoothingEnabled = false;
    
    // 填充和描边
    ctx.fill();
    ctx.stroke();

    // 绘制文本
    ctx.shadowColor = 'transparent';
    const fontSize = isRoot ? 16 : 14;
    ctx.font = `${Math.round(fontSize * transform.scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial`;
    ctx.fillStyle = isRoot ? '#ffffff' : '#595959';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = true; // 文本需要平滑
    ctx.fillText(node.data.name, Math.round(screenX), Math.round(screenY));

    ctx.restore();
  }, [theme, calculateNodeSize]);

  // 主渲染函数
  const render = useCallback(() => {
    console.log('开始渲染', {
      expandedNodes: Array.from(expandedNodes),
      processedData: processedData ? processedData.name : null
    });

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !processedData || !calculateLayoutRef.current) {
      console.log('渲染条件不满足', {
        hasCanvas: Boolean(canvas),
        hasContext: Boolean(ctx),
        hasProcessedData: Boolean(processedData),
        hasCalculateLayout: Boolean(calculateLayoutRef.current)
      });
      return;
    }

    const { width, height } = dimensionsRef.current;
    const transform = transformRef.current;

    // 设置画布尺寸
    canvas.width = width;
    canvas.height = height;
    
    // 清除画布
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    try {
      // 根据展开状态过滤节点
      const processDataWithExpanded = (node: MindMapNode): MindMapNode => {
        const result = { ...node };
        if (node.children && expandedNodes.has(node.name)) {
          result.children = node.children.map(child => processDataWithExpanded(child));
        } else {
          result.children = undefined;
        }
        return result;
      };

      const filteredData = processDataWithExpanded(processedData);
      console.log('过滤后的数据结构:', {
        name: filteredData.name,
        childrenCount: filteredData.children?.length || 0
      });

      const root = createHierarchy(filteredData);
      const layoutedRoot = calculateLayoutRef.current(root);

      // 批量绘制连接线
      layoutedRoot.links().forEach(link => {
        drawConnection(ctx, link.source, link.target, transform);
      });

      // 批量绘制节点
      const nodes = layoutedRoot.descendants();
      nodes.forEach(node => {
        drawNode(
          ctx,
          node,
          transform,
          hoveredNodeRef.current?.data.name === node.data.name
        );
      });

      console.log('渲染完成');
    } catch (error) {
      console.error('渲染失败:', error);
    }
  }, [processedData, drawConnection, drawNode, expandedNodes]);

  // 添加渲染节流
  const throttledRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // 修改 findHoveredNode 函数
  const findHoveredNode = useCallback((clientX: number, clientY: number): d3.HierarchyNode<MindMapNode> | null => {
    if (!processedData || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const transform = transformRef.current;
    
    // 转换为相对于 canvas 的坐标
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    // 转换为相对于画布内容的坐标（考虑变换）
    const contentX = (canvasX - transform.x) / transform.scale;
    const contentY = (canvasY - transform.y) / transform.scale;
    
    console.log('坐标转换:', {
      client: { x: clientX, y: clientY },
      canvas: { x: canvasX, y: canvasY },
      content: { x: contentX, y: contentY },
      transform: {
        x: transform.x,
        y: transform.y,
        scale: transform.scale
      }
    });
    
    // 使用四叉树或空间分区优化节点检测
    const nodeEntries = Array.from(nodesMetricsRef.current.entries());
    let foundNode = null;
    let minDistance = Infinity;

    for (const [nodeName, metrics] of nodeEntries) {
      const nodeX = metrics.x;
      const nodeY = metrics.y;
      const nodeWidth = metrics.width;
      const nodeHeight = metrics.height;
      
      // 计算节点边界
      const left = nodeX - nodeWidth / 2;
      const right = nodeX + nodeWidth / 2;
      const top = nodeY - nodeHeight / 2;
      const bottom = nodeY + nodeHeight / 2;

      console.log('检查节点:', {
        name: nodeName,
        bounds: { left, right, top, bottom },
        point: { x: contentX, y: contentY }
      });
      
      if (
        contentX >= left && contentX <= right &&
        contentY >= top && contentY <= bottom
      ) {
        // 计算到节点中心的距离
        const distance = Math.sqrt(
          Math.pow(contentX - nodeX, 2) + 
          Math.pow(contentY - nodeY, 2)
        );
        
        // 如果找到更近的节点，更新结果
        if (distance < minDistance) {
          try {
            const root = createHierarchy(processedData);
            const node = root.descendants().find(n => n.data.name === nodeName);
            if (node) {
              foundNode = node;
              minDistance = distance;
              console.log('找到更近的节点:', {
                name: nodeName,
                distance: distance
              });
            }
          } catch (error) {
            console.error('查找节点失败:', error);
          }
        }
      }
    }

    if (foundNode) {
      console.log('最终选中节点:', {
        name: foundNode.data.name,
        distance: minDistance
      });
    } else {
      console.log('未找到节点');
    }

    return foundNode;
  }, [processedData]);

  // 修改 handleMouseMove 函数
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !processedData) return;

    if (isDraggingRef.current) {
      const dx = event.movementX;
      const dy = event.movementY;
      
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      
      throttledRender();
      return;
    }

    // 优化节点检测
    const hoveredNode = findHoveredNode(event.clientX, event.clientY);
    
    if (hoveredNode?.data.name !== hoveredNodeRef.current?.data.name) {
      hoveredNodeRef.current = hoveredNode;
      canvas.style.cursor = hoveredNode ? 'pointer' : enableDrag ? 'grab' : 'default';
      throttledRender();
    }
  }, [throttledRender, processedData, enableDrag, findHoveredNode]);

  // 修改 handleNodeToggle 函数
  const handleNodeToggle = useCallback((node: SafeHierarchyNode) => {
    console.log('开始处理节点展开/折叠', {
      nodeName: node.data.name,
      hasChildren: Boolean(node.data.children?.length),
      currentExpandedNodes: Array.from(expandedNodes)
    });

    const hasAnyChildren = Boolean(node.data.children?.length);
    if (!hasAnyChildren) {
      console.log('节点没有子节点，忽略操作');
      return;
    }

    const isExpanding = !expandedNodes.has(node.data.name);
    console.log('节点展开状态将要改变', {
      nodeName: node.data.name,
      isExpanding,
      currentExpandedNodes: Array.from(expandedNodes)
    });

    const newExpandedNodes = new Set(expandedNodes);
    
    if (isExpanding) {
      // 展开节点
      newExpandedNodes.add(node.data.name);
      
      // 如果是根节点，同时展开所有一级子节点
      if (node.depth === 0) {
        node.data.children?.forEach(child => {
          newExpandedNodes.add(child.name);
        });
      }
      
      // 确保所有父节点都是展开的
      let parent = node.parent;
      while (parent) {
        newExpandedNodes.add(parent.data.name);
        parent = parent.parent;
      }
      
      if (onNodeExpand) {
        onNodeExpand(node.data);
      }
    } else {
      // 折叠节点及其所有子节点
      const collapseDescendants = (n: SafeHierarchyNode) => {
        newExpandedNodes.delete(n.data.name);
        if (n.data.children) {
          n.data.children.forEach(child => {
            newExpandedNodes.delete(child.name);
          });
        }
      };
      collapseDescendants(node);
      
      if (onNodeCollapse) {
        onNodeCollapse(node.data);
      }
    }

    console.log('准备更新展开状态', {
      nodeName: node.data.name,
      newExpandedNodes: Array.from(newExpandedNodes)
    });

    setExpandedNodes(newExpandedNodes);

    // 立即重新渲染
    requestAnimationFrame(() => {
      if (processedData && calculateLayoutRef.current) {
        try {
          console.log('开始重新计算布局');
          const root = createHierarchy(processedData);
          calculateLayoutRef.current(root);
          console.log('布局计算完成，开始重新渲染');
          render();
        } catch (error) {
          console.error('布局更新失败:', error);
        }
      }
    });
  }, [onNodeExpand, onNodeCollapse, processedData, render, expandedNodes]);

  // 修改 handleNodeClick 函数
  const handleNodeClick = useCallback((node: SafeHierarchyNode) => {
    console.log('节点被点击', {
      nodeName: node.data.name,
      hasChildren: Boolean(node.data.children?.length),
      expandedNodes: Array.from(expandedNodes)
    });

    const hasChildren = Boolean(node.data.children?.length);
    
    // 如果节点有子节点，则切换展开/折叠状态
    if (hasChildren) {
      console.log('节点有子节点，准备切换展开状态');
      handleNodeToggle(node);
    } else {
      console.log('节点没有子节点，忽略展开/折叠操作');
    }
    
    if (onNodeClick) {
      onNodeClick(node.data);
    }
  }, [handleNodeToggle, onNodeClick, expandedNodes]);

  // 修改 handleMouseDown 函数
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return; // 只响应左键

    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('鼠标按下', {
      position: { x: event.clientX, y: event.clientY },
      button: event.button
    });

    const hoveredNode = findHoveredNode(event.clientX, event.clientY);
    
    if (hoveredNode) {
      console.log('检测到节点点击', {
        nodeName: hoveredNode.data.name,
        hasChildren: Boolean(hoveredNode.data.children),
        childrenCount: hoveredNode.data.children?.length || 0
      });

      event.preventDefault();
      event.stopPropagation();
      handleNodeClick(hoveredNode);
    } else {
      console.log('未检测到节点，准备拖动画布');
      if (enableDrag) {
        isDraggingRef.current = true;
        canvas.style.cursor = 'grabbing';
      }
    }
  }, [enableDrag, findHoveredNode, handleNodeClick]);

  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDraggingRef.current = false;
    canvas.style.cursor = hoveredNodeRef.current ? 'pointer' : enableDrag ? 'grab' : 'default';
  }, [enableDrag]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enableZoom) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const delta = -event.deltaY * 0.001;
    const newScale = Math.min(
      Math.max(transformRef.current.scale * (1 + delta), zoomRange[0]),
      zoomRange[1]
    );
    
    const scaleRatio = newScale / transformRef.current.scale;
    
    transformRef.current = {
      scale: newScale,
      x: x - (x - transformRef.current.x) * scaleRatio,
      y: y - (y - transformRef.current.y) * scaleRatio
    };

    render();
  }, [enableZoom, zoomRange, render]);

  // 更新 dimensionsRef
  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  // 监听窗口大小变化
  useEffect(() => {
    if (containerWidth && containerHeight) return; // 如果提供了固定尺寸，不需要响应窗口变化

    const handleResize = debounce(() => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        // 使用窗口的实际大小，确保画布大小与屏幕大小1:1
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    }, 100);

    handleResize(); // 初始调用一次
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerWidth, containerHeight]);

  // 初始化 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 设置 Canvas 尺寸
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    const ctx = canvas.getContext('2d');
    
    // 设置 Canvas 的物理像素大小
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    
    // 设置 Canvas 的 CSS 显示大小
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 创建或更新离屏 Canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = offscreenCanvasRef.current;
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;

    // 设置上下文的变换以处理 DPR
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // 设置基本样式
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
    }

    // 同样设置离屏 Canvas 的上下文
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (offscreenCtx) {
      offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offscreenCtx.textBaseline = 'middle';
      offscreenCtx.textAlign = 'center';
    }

    // 更新 transformRef 以考虑 DPR
    if (!isInitializedRef.current) {
      transformRef.current = {
        x: width / 2,
        y: height / 2,
        scale: 1
      };
    }

    // 重新渲染
    requestAnimationFrame(render);
  }, [dimensions, render]);

  // 绑定事件监听器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp, handleWheel]);

  // 修改初始化视图的计算
  useEffect(() => {
    if (!processedData || !canvasRef.current || isInitializedRef.current) return;

    const initializeView = () => {
      try {
        // 确保根节点和一级子节点展开
        setExpandedNodes(prev => {
          const next = new Set(prev);
          next.add(processedData.name);
          if (processedData.children) {
            processedData.children.forEach(child => {
              next.add(child.name);
            });
          }
          return next;
        });

        const root = d3.hierarchy(processedData);
        if (calculateLayoutRef.current) {
          const layoutedRoot = calculateLayoutRef.current(root);
          
          // 计算布局边界
          const bounds = calculateBounds(layoutedRoot);
          const verticalCenter = (bounds.maxY + bounds.minY) / 2;
          
          // 设置初始变换参数，调整垂直位置使根节点居中
          const initialScale = 0.6;
          const verticalOffset = 100; // 添加一个向上的固定偏移量
          transformRef.current = {
            x: dimensions.width / 2,
            y: dimensions.height / 2 - (verticalCenter * initialScale) - verticalOffset, // 添加额外的向上偏移
            scale: initialScale
          };

          isInitializedRef.current = true;
          requestAnimationFrame(render);
        }
      } catch (error) {
        console.error('初始化视图失败:', error);
      }
    };

    initializeView();
  }, [processedData, dimensions, render, calculateBounds]);

  return (
    <div 
      className={className}
      style={{ 
        width: '100vw', 
        height: '100vh', 
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#fafafa',
        border: 'none',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: enableDrag ? 'grab' : 'default'
        }}
      />
      {/* <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: 12,
        color: '#666',
        userSelect: 'none',
        zIndex: 1
      }}>
        {Math.round(transformRef.current.scale * 100)}% | 拖拽移动 | 滚轮缩放
      </div> */}
    </div>
  );
}; 