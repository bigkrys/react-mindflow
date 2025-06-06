export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
  depth?: number;
  level?: number;
  isLeft?: boolean;
  x?: number;
  y?: number;
  _children?: MindMapNode[] | null;
} 