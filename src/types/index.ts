import { ThemeConfig } from './styles';
import type { CSSProperties } from 'react';

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  depth?: number;
  data?: any;  // 用户自定义数据
}

export interface MindMapProps {
  data: MindMapNode;
  width?: number;
  height?: number;
  theme?: Partial<ThemeConfig>;  // 允许部分覆盖默认主题
  initialDepth?: number;
  onNodeClick?: (node: MindMapNode) => void;
  onNodeExpand?: (node: MindMapNode) => void;
  onNodeCollapse?: (node: MindMapNode) => void;
  enableSearch?: boolean;
  enableDrag?: boolean;
  enableZoom?: boolean;
  zoomRange?: [number, number];  // [最小缩放比例, 最大缩放比例]
  className?: string;
  style?: CSSProperties;
  showExpandButtons?: boolean;
} 