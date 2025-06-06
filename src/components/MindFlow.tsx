import React, {useCallback, useEffect, useRef, useState} from 'react';
import G6, {TreeGraph} from '@antv/g6';
import type {MindFlowNode, MindFlowProps} from '../types';

const DEFAULT_LABEL = "新节点";
const COLORS = {
  root: '#fd6721',
  text: {
    root: '#ffffff',
    node: '#333333',
    rootText: '#ffffff'
  },
  count: {
    bg: '#e6f7ff',
    text: '#1890ff',
    rootBg: 'rgba(255, 255, 255, 0.2)',
    rootText: '#ffffff'
  }
};

// 布局间距配置
const LAYOUT_CONFIG = {
  // 节点高度
  NODE_HEIGHT: {
    ROOT: 50,    // 根节点高度
    LEAF: 35,    // 叶子节点高度
    SUB: 40      // 其他节点高度
  },
  // 节点内边距
  NODE_PADDING: {
    ROOT: 80,    // 根节点内边距，从50改为80
    LEAF: 60,    // 叶子节点内边距
    SUB: 60      // 其他节点内边距
  },
  // 垂直间距
  VERTICAL_GAP: {
    ROOT: 10,    // 根节点垂直间距
    LEVEL_1: 10, // 一级节点垂直间距
    LEVEL_2: 20, // 二级节点垂直间距
    DEFAULT: 15  // 其他层级垂直间距
  },
  // 水平间距
  HORIZONTAL_GAP: {
    ROOT: 80,    // 根节点水平间距
    LEVEL_1: 60, // 一级节点水平间距
    LEVEL_2: 50, // 二级节点水平间距
    DEFAULT: 40  // 其他层级水平间距
  },
  // 最小间距
  MIN_GAP: {
    NODE: 20,    // 节点间最小间距
    RANK: 30     // 层级间最小间距
  },
  // 分布比例
  DISTRIBUTION: {
    RIGHT_RATIO: 0.45  // 右侧节点比例
  }
};

// 获取文本尺寸
const getTextSize = (text: string, fontSize: number): [number, number] => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = `${fontSize}px Arial`;
    const width = context.measureText(text).width;
    return [width, fontSize];
  }
  return [text.length * fontSize * 0.6, fontSize];
};

// 获取子节点计数文本
const getChildCountText = (node: any): string => {
  if (!node.children?.length) return '';
  const totalCount = countAllDescendants(node);
  return `${totalCount}`;
};

// 计算所有后代节点数量
const countAllDescendants = (node: any): number => {
  let count = 0;
  if (node.children) {
    count += node.children.length;
    node.children.forEach((child: any) => {
      count += countAllDescendants(child);
    });
  }
  return count;
};

// 计算节点总宽度
const calculateNodeWidth = (label: string, hasCount: boolean, fontSize: number, padding: number = 24): number => {
  const [labelWidth] = getTextSize(label, fontSize);
  // 如果有计数，添加计数器宽度（16px）和间距（8px）
  const countWidth = hasCount ? 24 : 0;
  return labelWidth + countWidth + padding;
};

type NodeData = {
  id: string;
  label: string;
  collapsed?: boolean;
  type?: string;
  depth: number;
  style?: any;
  side?: string;
  children?: NodeData[];
  index?: number;
};

// 处理数据，设置节点的折叠状态和类型
const processData = (node: any, depth: number = 0, expandDepth?: number, colors: string[] = [], parentColor?: string): NodeData => {
  // 创建一个新的节点对象，只复制必要的属性
  const processedNode: NodeData = {
    id: node.id,
    label: node.label || DEFAULT_LABEL,
    collapsed: node.collapsed,
    type: node.type,
    depth: depth,
    style: { ...node.style },
    side: node.side,
    children: []  // 初始化为空数组
  };
  
  // 设置折叠状态
  if (expandDepth !== undefined && depth >= expandDepth) {
    processedNode.collapsed = true;
  }

  // 设置节点类型
  if (depth === 0) {
    processedNode.type = 'mind-root-node';
    processedNode.style = {
      ...processedNode.style,
      lineColor: COLORS.root
    };
  } else if (!node.children || node.children.length === 0) {
    processedNode.type = 'mind-leaf-node';
    processedNode.style = {
      ...processedNode.style,
      lineColor: parentColor || colors[0]
    };
  } else {
    processedNode.type = 'mind-sub-node';
    // 如果是一级节点，分配新的颜色
    if (depth === 1) {
      const colorIndex = (node.index || 0) % colors.length;
      const lineColor = colors[colorIndex];
      processedNode.style = {
        ...processedNode.style,
        lineColor,
        textColor: lineColor
      };
    } else {
      // 非一级节点继承父节点颜色
      processedNode.style = {
        ...processedNode.style,
        lineColor: parentColor || colors[0],
        textColor: parentColor || colors[0],
      };
    }
  }

  // 处理子节点
  if (node.children && Array.isArray(node.children)) {
    processedNode.children = node.children.map((child: any, index: number) => {
      // 为一级节点添加索引
      if (depth === 0) {
        child.index = index;
      }
      return processData(child, depth + 1, expandDepth, colors, processedNode.style.lineColor);
    });
  }

  return processedNode;
};

// 计算节点及其子节点的总高度
const calculateNodeTotalHeight = (node: any): number => {
  if (!node.children || node.collapsed) {
    return LAYOUT_CONFIG.NODE_HEIGHT.LEAF;
  }
  
  let totalHeight = 0;
  node.children.forEach((child: any) => {
    totalHeight += calculateNodeTotalHeight(child);
  });
  
  // 考虑子节点之间的间距
  if (node.children.length > 1) {
    totalHeight += (node.children.length - 1) * LAYOUT_CONFIG.VERTICAL_GAP.DEFAULT;
  }
  
  return Math.max(totalHeight, LAYOUT_CONFIG.NODE_HEIGHT.SUB);
};

// 获取节点的兄弟节点
const getSiblings = (node: any): any[] => {
  if (!node.parent) return [];
  return (node.parent.children || []).filter((child: any) => child.id !== node.id);
};

// 计算两个节点之间需要的最小间距
const calculateRequiredGap = (node1: any, node2: any): number => {
  const height1 = calculateNodeTotalHeight(node1);
  const height2 = calculateNodeTotalHeight(node2);
  
  // 基础间距
  let baseGap = LAYOUT_CONFIG.VERTICAL_GAP.DEFAULT;
  
  // 根据节点深度增加间距
  if (node1.depth === 0 || node2.depth === 0) {
    baseGap = LAYOUT_CONFIG.VERTICAL_GAP.ROOT;
  } else if (node1.depth === 1 || node2.depth === 1) {
    baseGap = LAYOUT_CONFIG.VERTICAL_GAP.LEVEL_1;
  } else if (node1.depth === 2 || node2.depth === 2) {
    baseGap = LAYOUT_CONFIG.VERTICAL_GAP.LEVEL_2;
  }
  
  // 如果两个节点都有子节点，增加额外间距
  if (node1.children?.length && node2.children?.length) {
    baseGap *= 1.2;
  }
  
  // 计算所需的最小间距，确保不会重叠
  return Math.max(
      baseGap,
      (height1 + height2) * 0.5 // 使用节点总高度的一半作为最小间距
  );
};

// 计算节点所需的画布空间
const calculateRequiredSpace = (node: any): { width: number; height: number } => {
  const nodeWidth = calculateNodeWidth(
    node.label || DEFAULT_LABEL,
    node.children?.length > 0,
    node.depth === 0 ? 16 : node.children?.length > 0 ? 14 : 12,
    node.depth === 0 ? LAYOUT_CONFIG.NODE_PADDING.ROOT : LAYOUT_CONFIG.NODE_PADDING.SUB
  );
  
  let totalWidth = nodeWidth;
  let totalHeight = calculateNodeTotalHeight(node);
  
  if (node.children && !node.collapsed) {
    node.children.forEach((child: any) => {
      const childSpace = calculateRequiredSpace(child);
      totalWidth = Math.max(totalWidth, nodeWidth + LAYOUT_CONFIG.HORIZONTAL_GAP.ROOT + childSpace.width);
      totalHeight = Math.max(totalHeight, childSpace.height);
    });
  }
  
  return { width: totalWidth, height: totalHeight };
};

// 获取节点在画布中的绝对位置
const getNodeAbsolutePosition = (node: any, graph: any): { x: number; y: number } => {
  const nodeItem = graph.findById(node.id);
  if (!nodeItem) return { x: 0, y: 0 };
  
  const bbox = nodeItem.getBBox();
  const { x, y } = bbox;
  return { x, y };
};

// 创建节点内容
const createNodeContent = (cfg: any, options: {
  label: string,
  countText: string,
  width: number,
  fontSize: number,
  textColor: string,
  countBgColor: string,
  countTextColor: string,
  marginTop: number,
  lineColor: string,
  showLine?: boolean,
  lineHeight?: number,
}) => {
  const { 
    label, 
    countText, 
    width, 
    fontSize, 
    textColor, 
    countBgColor, 
    countTextColor, 
    marginTop,
    lineColor,
    showLine = true,
    lineHeight = 3
  } = options;
  
  const [labelWidth] = getTextSize(label, fontSize);
  const textX = 20;
  const textY = marginTop;
  const countX = textX + labelWidth + 8;

  return `
    <text font-size="${fontSize}" y="${textY}">
      <tspan x="${textX}" fill="${textColor}">${label}</tspan>
      ${countText ? `
        <tspan dx="8" fill="${countTextColor}">${countText}</tspan>
      ` : ''}
    </text>
    ${showLine ? `<rect fill="${lineColor}" width="${width}" height="${lineHeight}" x="0" y="${textY + fontSize / 2 + 4}" />` : ''}
  `;
};

const MindFlow: React.FC<MindFlowProps> = (props) => {
  const {
    data,
    width,
    height,
    direction = 'H',
    theme = 'light',
    expandDepth,
    defaultLineColors = ['#91d5ff', '#87e8de', '#b7eb8f', '#ffd591', '#ffadd2'],
    onNodeClick,
    onNodeDoubleClick,
    onNodeContextMenu,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<TreeGraph | null>(null);
  const [containerSize, setContainerSize] = useState({ 
    width: width || window.innerWidth, 
    height: height || window.innerHeight 
  });
  const [graphReady, setGraphReady] = useState(false);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = width || window.innerWidth;
      const newHeight = height || window.innerHeight;
      setContainerSize({ width: newWidth, height: newHeight });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [width, height]);

  // 监听容器大小变化，更新图实例大小
  useEffect(() => {
    if (!graphReady || !graphRef.current) return;

    try {
      const graph = graphRef.current;
      if (graph && !graph.destroyed) {
        graph.changeSize(containerSize.width, containerSize.height);
        graph.fitView();
      }
    } catch (error) {
      console.warn('Failed to update graph size:', error);
    }
  }, [containerSize, graphReady]);

  // 处理节点点击事件
  const handleNodeClick = useCallback((node: MindFlowNode) => {
    if (!node.children?.length || !graphRef.current || !graphReady) return;
    
    const graph = graphRef.current;
    const nodeItem = graph.findById(node.id);
    if (!nodeItem) return;

    try {
      const model = nodeItem.getModel();
      const collapsed = !model.collapsed;
      
      // 获取当前的缩放比例
      const currentZoom = graph.getZoom();
      
      // 获取节点当前位置
      const nodePosition = getNodeAbsolutePosition(node, graph);
      
      // 更新节点状态
      graph.updateItem(nodeItem, {
        collapsed,
        // 确保不会修改原始标签
        label: model.label
      });

      // 重新布局
      graph.layout();

      // 在布局完成后调整视图位置
      setTimeout(() => {
        if (!graph || graph.destroyed) return;

        // 获取节点新位置
        const newNodePosition = getNodeAbsolutePosition(node, graph);
        
        // 计算视图偏移，使展开的节点保持在原位置附近
        const dx = newNodePosition.x - nodePosition.x;
        const dy = newNodePosition.y - nodePosition.y;
        
        // 移动视图以补偿节点位置变化
        graph.translate(-dx, -dy);
        
        // 确保所有内容可见，同时保持当前缩放比例
        graph.fitCenter();
        graph.zoomTo(currentZoom);
        
      }, 300); // 等待布局动画完成
    } catch (error) {
      console.warn('Failed to handle node click:', error);
    }
    
    onNodeClick?.(node);
  }, [onNodeClick, graphReady, containerSize]);

  // 初始化图实例
  useEffect(() => {
    if (!containerRef.current || !containerSize.width || !containerSize.height || !data) {
      return;
    }

    // 如果已经有图实例，先销毁它
    if (graphRef.current) {
      graphRef.current.destroy();
      graphRef.current = null;
    }

    let newGraph: TreeGraph | null = null;

    try {
      // 注册节点
      G6.registerNode('mind-root-node', {
        style: {
          fill: COLORS.root,
          stroke: 'transparent',
          radius: 4
        },
        draw: (cfg: any, group: any) => {
          const countText = getChildCountText(cfg);
          const label = cfg.label || DEFAULT_LABEL;
          const width = calculateNodeWidth(label, !!countText, 16, LAYOUT_CONFIG.NODE_PADDING.ROOT);
          const keyShape = group.addShape('rect', {
            attrs: {
              width,
              height: 40,
              radius: 4,
              fill: COLORS.root,
              stroke: 'transparent',
              draggable: true
            },
            name: 'root-node-keyshape'
          });

          // 添加文本
          const textGroup = group.addShape('text', {
            attrs: {
              text: label,
              x: width / 2,
              y: 12,
              fontSize: 16,
              fill: COLORS.text.root,
              textBaseline: 'top',
              textAlign: 'center'
            },
            name: 'node-label'
          });
          return keyShape;
        },
        getAnchorPoints: () => [[0, 0.5], [1, 0.5]]
      });

      G6.registerNode('mind-sub-node', {
        style: {
          fill: 'transparent',
          stroke: 'transparent'
        },
        draw: (cfg: any, group: any) => {
          const countText = getChildCountText(cfg);
          const label = cfg.label || DEFAULT_LABEL;
          const width = calculateNodeWidth(label, !!countText, 14, 48);
          const style = cfg.style || {};
          
          const keyShape = group.addShape('rect', {
            attrs: {
              width,
              height: 30,
              fill: 'transparent',
              stroke: 'transparent',
              radius: 0,
              draggable: true
            },
            name: 'sub-node-keyshape'
          });

          // 添加文本
          const textGroup = group.addShape('text', {
            attrs: {
              text: label,
              x: 20,
              y: 8,
              fontSize: 14,
              fill: style.lineColor || defaultLineColors[0],
              textBaseline: 'top'
            },
            name: 'node-label'
          });

          if (countText) {
            const labelBBox = textGroup.getBBox();
            group.addShape('text', {
              attrs: {
                text: `(${countText})`,
                x: labelBBox.maxX + 8,
                y: 8,
                fontSize: 14,
                fill: style.lineColor || defaultLineColors[0],
                textBaseline: 'top'
              },
              name: 'count-text'
            });
          }

          // 添加下划线
          group.addShape('rect', {
            attrs: {
              width,
              height: 2,
              fill: style.lineColor || defaultLineColors[0],
              x: 0,
              y: 8 + 14 + 4
            },
            name: 'underline'
          });

          return keyShape;
        },
        getAnchorPoints: () => [[0, 0.5], [1, 0.5]]
      });

      G6.registerNode('mind-leaf-node', {
        style: {
          fill: 'transparent',
          stroke: 'transparent'
        },
        draw: (cfg: any, group: any) => {
          const label = cfg.label || DEFAULT_LABEL;
          const width = calculateNodeWidth(label, false, 12, 48);
          const style = cfg.style || {};

          const keyShape = group.addShape('rect', {
            attrs: {
              width,
              height: 24,
              fill: 'transparent',
              stroke: 'transparent',
              radius: 0,
              draggable: true
            },
            name: 'leaf-node-keyshape'
          });

          // 添加文本
          group.addShape('text', {
            attrs: {
              text: label,
              x: 20,
              y: 6,
              fontSize: 12,
              fill: style.lineColor || defaultLineColors[0],
              textBaseline: 'top'
            },
            name: 'node-label'
          });

          // 添加下划线
          group.addShape('rect', {
            attrs: {
              width,
              height: 1,
              fill: style.lineColor || defaultLineColors[0],
              x: 0,
              y: 6 + 12 + 4
            },
            name: 'underline'
          });

          return keyShape;
        },
        getAnchorPoints: () => [[0, 0.5], [1, 0.5]]
      });

      // 创建新的图实例
      newGraph = new G6.TreeGraph({
        container: containerRef.current,
        width: containerSize.width,
        height: containerSize.height,
        modes: {
          default: ['drag-canvas', 'zoom-canvas'],
        },
        defaultNode: {
          type: 'mind-sub-node',
          style: {
            fill: 'transparent',
            stroke: 'transparent'
          }
        },
        defaultEdge: {
          type: 'cubic-horizontal',
          style: {
            lineWidth: 1,
          }
        },
        layout: {
          type: 'mindmap',
          direction: direction === 'H' ? 'H' : 'V',
          getHeight: (node: any) => {
            if (node.depth === 0) return LAYOUT_CONFIG.NODE_HEIGHT.ROOT;
            if (!node.children || node.children.length === 0) return LAYOUT_CONFIG.NODE_HEIGHT.LEAF;
            return LAYOUT_CONFIG.NODE_HEIGHT.SUB;
          },
          getWidth: (node: any) => {
            const label = node.label || DEFAULT_LABEL;
            const countText = getChildCountText(node);
            if (node.depth === 0) {
              return calculateNodeWidth(label, !!countText, 16, LAYOUT_CONFIG.NODE_PADDING.ROOT);
            } else if (!node.children || node.children.length === 0) {
              return calculateNodeWidth(label, false, 12, LAYOUT_CONFIG.NODE_PADDING.LEAF);
            }
            return calculateNodeWidth(label, !!countText, 14, LAYOUT_CONFIG.NODE_PADDING.SUB);
          },
          getVGap: (node: any) => {
            // 获取基础间距
            let baseGap = LAYOUT_CONFIG.VERTICAL_GAP.DEFAULT;
            if (node.depth === 0) baseGap = LAYOUT_CONFIG.VERTICAL_GAP.ROOT;
            else if (node.depth === 1) baseGap = LAYOUT_CONFIG.VERTICAL_GAP.LEVEL_1;
            // 获取相邻节点
            const siblings = getSiblings(node);
            if (!siblings.length) return baseGap;

            // 计算与相邻节点所需的间距
            let maxRequiredGap = baseGap;
            siblings.forEach((sibling: any) => {
              const requiredGap = calculateRequiredGap(node, sibling);
              maxRequiredGap = Math.max(maxRequiredGap, requiredGap);
            });

            return maxRequiredGap;
          },
          getHGap: (node: any) => {
            if (node.depth === 0) return LAYOUT_CONFIG.HORIZONTAL_GAP.ROOT;
            if (node.depth === 1) return LAYOUT_CONFIG.HORIZONTAL_GAP.LEVEL_1;
            if (node.depth === 2) return LAYOUT_CONFIG.HORIZONTAL_GAP.LEVEL_2;
            return LAYOUT_CONFIG.HORIZONTAL_GAP.DEFAULT;
          },
          getSide: (node: any) => {
            if (node.side) return node.side;
            
            const rootNode = node.parent;
            if (!rootNode || rootNode.parent) return 'right';
            
            const siblings = rootNode.children || [];
            const index = siblings.findIndex((child: any) => child.id === node.id);
            const position = index / (siblings.length - 1);
            
            if (siblings.length <= 2) {
              return index === 0 ? 'right' : 'left';
            } else {
              return position < LAYOUT_CONFIG.DISTRIBUTION.RIGHT_RATIO ? 'right' : 'left';
            }
          },
          nodesepFunc: () => LAYOUT_CONFIG.MIN_GAP.NODE,
          ranksepFunc: () => LAYOUT_CONFIG.MIN_GAP.RANK,
        },
        animate: true,
        fitView: true,
        minZoom: 0.2,
        maxZoom: 2,
      });

      graphRef.current = newGraph;

      // 注册自定义边
      G6.registerEdge('mindflow-edge', {
        afterDraw(cfg: any, group: any) {
          const edge = group.get('children')[0];
          const target = cfg.target;
          const targetNode = newGraph?.findById(target)?.getModel();
          const style = targetNode?.style || {};
          
          edge.attr('stroke', style.lineColor || defaultLineColors[0]);
        },
      }, 'cubic-horizontal');

      // 设置默认边类型为自定义边
      newGraph.edge(() => ({
        type: 'mindflow-edge',
        style: {
          lineWidth: 1,
        },
      }));

      // 绑定事件
      newGraph.on('node:click', (e: any) => {
        const node = e.item.getModel();
        handleNodeClick(node);
      });

      if (onNodeDoubleClick) {
        newGraph.on('node:dblclick', (e: any) => {
          const node = e.item?.getModel() as MindFlowNode;
          onNodeDoubleClick(node);
        });
      }

      if (onNodeContextMenu) {
        newGraph.on('node:contextmenu', (e: any) => {
          const node = e.item?.getModel() as MindFlowNode;
          onNodeContextMenu(node, e.originalEvent as MouseEvent);
        });
      }

      // 初始化数据
      const processedData = processData(data, 0, expandDepth, defaultLineColors);
      newGraph.data(processedData);
      newGraph.render();
      newGraph.fitView();
      newGraph.zoomTo(1);

      setGraphReady(true);

      return () => {
        setGraphReady(false);
        if (newGraph && !newGraph.destroyed) {
          newGraph.destroy();
        }
        graphRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize graph:', error);
      if (newGraph && !newGraph.destroyed) {
        newGraph.destroy();
      }
      graphRef.current = null;
    }
  }, [data, containerSize, direction, theme, defaultLineColors, handleNodeClick, onNodeDoubleClick, onNodeContextMenu, expandDepth]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: containerSize.width, 
        height: containerSize.height,
        overflow: 'hidden',
        position: 'relative'
      }} 
    />
  );
};

export default MindFlow; 