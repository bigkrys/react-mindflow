import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MindMapProps, MindMapNode } from '../types';

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

export const MindMap: React.FC<MindMapProps> = ({
  data,
  width: containerWidth = 800,
  height: containerHeight = 600,
  nodeRadius = 20,
  nodePadding = 24,
  fontSize = 14,
  initialDepth = 2,
  onNodeClick,
  colors = {
    node: '#fff',
    link: '#ccc',
    text: '#333',
    expandButton: '#91d5ff'
  }
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dimensions, setDimensions] = useState({ width: containerWidth, height: containerHeight });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });

  // 处理数据，添加深度和展开状态
  const processData = useCallback((node: MindMapNode, depth: number = 0) => {
    const processedNode = { ...node };
    processedNode.depth = depth;
    
    // 只在第一次渲染时设置初始展开状态
    if (expandedNodes.size === 0 && depth <= initialDepth) {
      expandedNodes.add(processedNode.name);
    }
    
    if (processedNode.children) {
      processedNode.children = processedNode.children.map(child => 
        processData(child, depth + 1)
      );
    }
    
    return processedNode;
  }, [initialDepth, expandedNodes]);

  // 切换节点展开状态
  const toggleNode = useCallback((node: d3.HierarchyNode<MindMapNode>) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(node.data.name)) {
        next.delete(node.data.name);
      } else {
        next.add(node.data.name);
      }
      return next;
    });
  }, []);

  // 计算节点大小
  const calculateNodeSize = useCallback((node: d3.HierarchyNode<MindMapNode>) => {
    const textLength = node.data.name.length * fontSize * 0.7;
    const width = Math.max(textLength + nodePadding * 2, 60);
    const height = Math.max(fontSize + nodePadding, 28);
    return { width, height };
  }, [fontSize, nodePadding]);

  // 类型守卫函数
  const hasChildren = (node: d3.HierarchyNode<MindMapNode>): node is d3.HierarchyNode<MindMapNode> & { children: d3.HierarchyNode<MindMapNode>[] } => {
    return Array.isArray((node as any).children) && (node as any).children.length > 0;
  };

  // 计算树的布局
  const calculateLayout = useCallback((root: d3.HierarchyNode<MindMapNode>) => {
    // 设置基础间距
    const baseVerticalSpacing = Math.max(40, fontSize * 2.5);
    const baseHorizontalSpacing = Math.max(120, fontSize * 5);
    
    // 动态计算垂直间距
    const getVerticalSpacing = (depth: number, nodesCount: number) => {
      // 确保有足够的间距避免重叠
      const minSpacing = Math.max(50, fontSize * 2);
      const depthFactor = Math.max(0.8, 1 - depth * 0.1);
      const countFactor = Math.max(1, 1 + Math.log(nodesCount) * 0.3);
      return minSpacing * depthFactor * countFactor;
    };

    // 计算节点所需的最小高度（包括其所有子节点）
    const calculateMinHeight = (node: d3.HierarchyNode<MindMapNode>): number => {
      const { height } = calculateNodeSize(node);
      
      // 使用类型断言来处理 d3.HierarchyNode 的类型问题
      const hierarchyNode = node as d3.HierarchyNode<MindMapNode> & {
        children?: d3.HierarchyNode<MindMapNode>[];
      };
      
      if (!hierarchyNode.children?.length) {
        return height;
      }
      
      let totalChildrenHeight = 0;
      let maxChildHeight = 0;
      
      for (const child of hierarchyNode.children) {
        const childHeight = calculateMinHeight(child);
        totalChildrenHeight += childHeight;
        maxChildHeight = Math.max(maxChildHeight, childHeight);
      }
      
      const spacing = getVerticalSpacing(node.depth || 0, hierarchyNode.children.length);
      const totalSpacing = (hierarchyNode.children.length - 1) * spacing;
      
      return Math.max(height, totalChildrenHeight + totalSpacing);
    };

    // 布局函数
    const layoutNode = (
      node: d3.HierarchyNode<MindMapNode>, 
      top: number = 0, 
      level: number = 1,
      isLeft: boolean = false,
      siblingIndex: number = 0,
      totalSiblings: number = 1
    ) => {
      const { width, height } = calculateNodeSize(node);
      
      // 基础间距设置
      const baseHorizontalGap = 150;  // 水平间距增加到150
      const verticalNodeGap = 120;     // 垂直间距增加到120
      const baseAngle = Math.PI / 6;  // 基础发散角度增加到30度
      
      // 计算节点的坐标
      let x, y;
      
      if (node === root) {
        // 根节点居中
        x = 0;
        y = 0;
      } else if (level === 1) {
        // 第一层节点左右分布
        x = top;
        // 第一层使用较大间距
        const firstLevelGap = baseHorizontalGap * 2.5; // 增加第一层的间距
        y = isLeft ? -firstLevelGap : firstLevelGap;
      } else {
        // 其他层级节点
        const parentNode = node.parent as d3.HierarchyNode<MindMapNode>;
        x = top;
        
        // 计算当前层级的角度
        const levelFactor = Math.max(0.6, 1 - (level - 2) * 0.1); // 调整衰减系数
        // 修改角度计算，完全依赖父节点的方向
        const angle = isLeft ? Math.PI + baseAngle * levelFactor : 0 - baseAngle * levelFactor;
        
        // 计算节点间的距离，减缓衰减速度
        const distance = baseHorizontalGap * Math.pow(0.95, level - 2);
        
        // 使用三角函数计算位置
        const deltaX = Math.sin(angle) * distance;
        const deltaY = Math.cos(angle) * distance;
        // 根据继承的方向决定子节点的展开方向
        y = (parentNode.y || 0) + (isLeft ? -Math.abs(deltaY) : Math.abs(deltaY));
      }
      
      // 使用类型断言处理 children
      const children = (node as any).children || [];
      
      if (children.length === 0) {
        node.x = x;
        node.y = y;
        return { height, totalHeight: height, width };
      }

      // 计算子节点布局
      let totalHeight = 0;
      let maxChildWidth = 0;
      const childrenLayouts: { height: number; totalHeight: number; width: number }[] = [];

      // 计算子节点的总高度和间距
      const totalChildrenHeight = children.reduce((sum: number, child: d3.HierarchyNode<MindMapNode>) => {
        const childSize = calculateNodeSize(child);
        return sum + childSize.height;
      }, 0);
      
      const totalSpacing = (children.length - 1) * verticalNodeGap;
      const childrenBlockHeight = totalChildrenHeight + totalSpacing;
      
      // 计算第一个子节点的起始位置
      let currentTop = x - (childrenBlockHeight / 2);

      children.forEach((child: d3.HierarchyNode<MindMapNode>, i: number) => {
        const childHeight = calculateNodeSize(child).height;
        
        // 根据当前节点的位置决定子节点的展开方向
        const nodeY = node.y || 0;
        const childIsLeft = nodeY < 0;
        
        const layout = layoutNode(
          child, 
          currentTop + childHeight / 2,
          level + 1, 
          childIsLeft,  // 根据当前节点位置决定子节点方向
          i,
          children.length
        );

        childrenLayouts.push(layout);
        
        currentTop += childHeight + verticalNodeGap;
        totalHeight = Math.max(totalHeight, layout.totalHeight);
        maxChildWidth = Math.max(maxChildWidth, layout.width);
      });

      // 更新节点位置
      node.x = x;
      node.y = y;

      return { 
        height: Math.max(height, childrenBlockHeight),
        totalHeight: Math.max(height, totalHeight),
        width: width + maxChildWidth + baseHorizontalGap
      };
    };

    const leftNodes: d3.HierarchyNode<MindMapNode>[] = [];
    const rightNodes: d3.HierarchyNode<MindMapNode>[] = [];
    
    if (root.children) {
      // 优化左右分布，考虑节点数量和文本长度
      const totalWeight = root.children.reduce((sum, child) => 
        sum + (child.data.name.length + (child.descendants().length * 2)), 0);
      let currentWeight = 0;
      let midIndex = 0;
      
      for (let i = 0; i < root.children.length; i++) {
        const node = root.children[i];
        currentWeight += node.data.name.length + (node.descendants().length * 2);
        if (currentWeight >= totalWeight / 2) {
          midIndex = i;
          break;
        }
      }
      
      leftNodes.push(...root.children.slice(0, midIndex + 1));
      rightNodes.push(...root.children.slice(midIndex + 1));
    }

    // 处理左侧节点
    let leftCurrentTop = 0;
    let maxLeftWidth = 0;
    
    // 预先计算左侧所需的总高度
    const leftTotalHeight = leftNodes.reduce((sum, node) => {
      const height = calculateMinHeight(node);
      return sum + height;
    }, 0) + (leftNodes.length - 1) * getVerticalSpacing(1, leftNodes.length) * 1.5;

    leftNodes.forEach((node, i) => {
      const layout = layoutNode(node, leftCurrentTop, 1, true, i, leftNodes.length);
      const extraSpacing = i < leftNodes.length - 1 ? getVerticalSpacing(1, leftNodes.length) * 0.5 : 0;
      leftCurrentTop += layout.totalHeight + getVerticalSpacing(1, leftNodes.length) + extraSpacing;
      maxLeftWidth = Math.max(maxLeftWidth, layout.width);
    });

    // 处理右侧节点
    let rightCurrentTop = 0;
    let maxRightWidth = 0;
    
    // 预先计算右侧所需的总高度
    const rightTotalHeight = rightNodes.reduce((sum, node) => {
      const height = calculateMinHeight(node);
      return sum + height;
    }, 0) + (rightNodes.length - 1) * getVerticalSpacing(1, rightNodes.length) * 1.5;

    rightNodes.forEach((node, i) => {
      const layout = layoutNode(node, rightCurrentTop, 1, false, i, rightNodes.length);
      const extraSpacing = i < rightNodes.length - 1 ? getVerticalSpacing(1, rightNodes.length) * 0.5 : 0;
      rightCurrentTop += layout.totalHeight + getVerticalSpacing(1, rightNodes.length) + extraSpacing;
      maxRightWidth = Math.max(maxRightWidth, layout.width);
    });

    // 设置根节点位置
    const totalHeight = Math.max(leftTotalHeight, rightTotalHeight);
    root.x = totalHeight / 2;
    root.y = 0;

    // 计算所需的画布大小，添加额外边距
    const requiredWidth = maxLeftWidth + maxRightWidth + baseHorizontalSpacing * 2;
    const requiredHeight = totalHeight + baseVerticalSpacing * 3;

    // 更新画布大小
    setDimensions(prev => {
      const newWidth = Math.max(containerWidth, requiredWidth);
      const newHeight = Math.max(containerHeight, requiredHeight);
      if (prev.width !== newWidth || prev.height !== newHeight) {
        return { width: newWidth, height: newHeight };
      }
      return prev;
    });

    return root;
  }, [calculateNodeSize, fontSize, containerWidth, containerHeight]);

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

  // 更新初始化拖拽行为，考虑新的尺寸
  const initializeDrag = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g.main-group');

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform;
        g.attr('transform', `translate(${x},${y}) scale(${k})`);
        setTransform({ x, y, scale: k });
      });

    // 计算初始变换以确保图表居中
    const initialTransform = d3.zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(Math.min(1, Math.min(
        dimensions.width / (containerWidth * 1.2),
        dimensions.height / (containerHeight * 1.2)
      )));

    // 应用缩放行为
    svg.call(zoom)
       .call(zoom.transform, initialTransform);

    // 禁用双击缩放
    svg.on('dblclick.zoom', null);

  }, [dimensions, containerWidth, containerHeight]);

  // 自动定位到节点（更新以配合拖拽功能）
  const centerNode = useCallback((node: d3.HierarchyNode<MindMapNode>) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select('g.main-group');
    
    const x = node.y || 0;
    const y = node.x || 0;
    
    const scale = transform.scale;
    const targetX = dimensions.width / 2 - x * scale;
    const targetY = dimensions.height / 2 - y * scale;

    // 使用 D3 的 zoom.transform 来设置新的变换
    const zoom = d3.zoom<SVGSVGElement, unknown>();
    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity
        .translate(targetX, targetY)
        .scale(scale));
  }, [dimensions, transform.scale]);

  // 处理数据和布局
  const { processedRoot, bounds } = useMemo(() => {
    if (!data) return { processedRoot: null, bounds: null };

    const processedData = processData({ ...data });
    const root = d3.hierarchy(processedData);
    
    const filteredRoot = root.copy() as ExtendedHierarchyNode;
    filteredRoot.descendants().forEach(d => {
      const node = d as ExtendedHierarchyNode;
      if (!expandedNodes.has(node.data.name) && node.children) {
        node._children = node.children;
        node.children = undefined;
      }
    });

    const layoutedRoot = calculateLayout(filteredRoot);
    const calculatedBounds = calculateBounds(layoutedRoot);

    return { processedRoot: layoutedRoot, bounds: calculatedBounds };
  }, [data, expandedNodes, processData, calculateLayout, calculateBounds]);

  // 更新尺寸
  useEffect(() => {
    if (!bounds) return;

    const width = Math.max(containerWidth, Math.abs(bounds.maxX - bounds.minX) + 400);
    const height = Math.max(containerHeight, Math.abs(bounds.maxY - bounds.minY) + 200);
    
    setDimensions(prev => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, [bounds, containerWidth, containerHeight]);

  // 渲染图表
  useEffect(() => {
    if (!processedRoot || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 创建主组
    const g = svg.append('g')
      .attr('class', 'main-group')
      .attr('transform', `translate(${dimensions.width / 2},${dimensions.height / 2}) scale(${transform.scale})`);

    // 修改连接线渲染部分，使用直线
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(processedRoot.links())
      .join('line')
      .attr('x1', d => d.source.y || 0)
      .attr('y1', d => d.source.x || 0)
      .attr('x2', d => d.target.y || 0)
      .attr('y2', d => d.target.x || 0)
      .attr('stroke', '#a8d8fd')
      .attr('stroke-width', 1.5);

    // 确保连接线在节点下方
    links.lower();

    // 添加渐入动画
    links.style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1);

    // 修改节点渲染部分
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(processedRoot.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y || 0},${d.x || 0})`);

    // 添加节点背景
    nodeGroups.append('rect')
      .attr('x', d => -(calculateNodeSize(d).width / 2))
      .attr('y', d => -(calculateNodeSize(d).height / 2))
      .attr('width', d => calculateNodeSize(d).width)
      .attr('height', d => calculateNodeSize(d).height)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#ffffff')
      .attr('stroke', '#a8d8fd')
      .attr('stroke-width', 1);

    // 添加文本
    nodeGroups.append('text')
      .attr('dy', '0.32em')
      .attr('text-anchor', 'middle')
      .text(d => d.data.name)
      .style('font-size', `${fontSize}px`)
      .style('fill', '#333333');

    // 添加展开/收起按钮
    const buttonGroups = nodeGroups.filter((d: d3.HierarchyNode<MindMapNode>) => {
      const node = d as ExtendedHierarchyNode;
      return Boolean(node.data.children?.length) || Boolean(node._children?.length);
    })
      .append('g')
      .attr('class', 'button-group')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        toggleNode(d);
      });

    buttonGroups.append('circle')
      .attr('class', 'expand-button')
      .attr('r', 6)
      .attr('cx', d => calculateNodeSize(d).width / 2 + 8)
      .attr('cy', 0)
      .attr('fill', '#a8d8fd');

    buttonGroups.append('text')
      .attr('class', 'expand-icon')
      .attr('x', d => calculateNodeSize(d).width / 2 + 8)
      .attr('y', d => expandedNodes.has(d.data.name) ? 3 : 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('user-select', 'none')
      .text(d => expandedNodes.has(d.data.name) ? '−' : '+');

    // 添加点击事件
    nodeGroups.on('click', (event, d: any) => {
      centerNode(d);
      if (onNodeClick) {
        onNodeClick(d.data);
      }
    });

    // 初始化拖拽
    initializeDrag();

  }, [
    processedRoot,
    dimensions,
    fontSize,
    expandedNodes,
    toggleNode,
    centerNode,
    onNodeClick,
    transform.scale,
    initializeDrag,
    calculateNodeSize
  ]);

  return (
    <div style={{ 
      width: dimensions.width, 
      height: dimensions.height, 
      overflow: 'hidden',
      cursor: 'grab',
      position: 'relative'
    }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ 
          overflow: 'visible',
          transition: 'width 0.3s, height 0.3s'
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: 12,
        color: '#666',
        userSelect: 'none'
      }}>
        {Math.round(transform.scale * 100)}% | 拖拽移动 | 滚轮缩放
      </div>
    </div>
  );
}; 