export interface MindFlowNode {
  id: string;
  label: string;
  children?: MindFlowNode[];
  collapsed?: boolean;
  style?: {
    lineColor?: string;
    textColor?: string;
    [key: string]: any;
  };
}

export interface MindFlowEdge {
  source: string;
  target: string;
  style?: {
    stroke?: string;
    lineWidth?: number;
    [key: string]: any;
  };
}

export interface MindFlowProps {
  data: MindFlowNode;
  width?: number;
  height?: number;
  direction?: 'H' | 'V'; // H: horizontal, V: vertical
  theme?: 'light' | 'dark';
  expandDepth?: number; // 初始展开的深度，默认全部展开
  defaultLineColors?: string[]; // 默认的线条颜色数组
  onNodeClick?: (node: MindFlowNode) => void;
  onNodeDoubleClick?: (node: MindFlowNode) => void;
  onNodeContextMenu?: (node: MindFlowNode, e: MouseEvent) => void;
} 