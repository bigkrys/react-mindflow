export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  depth?: number;
  isExpanded?: boolean;
}

export interface MindMapProps {
  data: MindMapNode;
  width?: number;
  height?: number;
  nodeRadius?: number;
  nodePadding?: number;
  fontSize?: number;
  initialDepth?: number;
  onNodeClick?: (node: MindMapNode) => void;
  colors?: {
    node?: string;
    link?: string;
    text?: string;
    expandButton?: string;
  };
} 