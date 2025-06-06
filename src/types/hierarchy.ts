import { MindMapNode } from './index';
import { HierarchyNode } from 'd3-hierarchy';
import * as d3 from 'd3';

export type SafeHierarchyNode = HierarchyNode<MindMapNode>;

export interface HierarchyNodeWithCache extends HierarchyNode<MindMapNode> {
  _children?: HierarchyNode<MindMapNode>[] | null;
}

export function createHierarchy(data: MindMapNode | null): SafeHierarchyNode {
  if (!data) {
    // 如果没有数据，返回一个空的根节点
    return d3.hierarchy<MindMapNode>({
      name: '',
      children: []
    });
  }
  return d3.hierarchy(data);
}

export function createSafeHierarchy(data: MindMapNode | null): SafeHierarchyNode | null {
  if (!data) return null;
  try {
    return d3.hierarchy(data);
  } catch (error) {
    console.error('创建层次结构失败:', error);
    return null;
  }
} 