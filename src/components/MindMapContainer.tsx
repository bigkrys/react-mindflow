import React, { useCallback, useState, useEffect } from 'react';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'react-flow-renderer';
import type {
  Node as NodeType,
  Edge as EdgeType,
  Connection as ConnectionType,
  ReactFlowJsonObject,
  OnNodesChange,
  OnEdgesChange,
} from 'react-flow-renderer';

import MindMap from './MindMap'; // 导入 MindMap 渲染组件

// 定义 JSON 数据结构类型
interface JsonNode {
  title: string;
  id: string;
  children?: JsonNode[];
}

// 定义节点数据类型 (需要与 MindMapNode 兼容)
interface NodeData {
  label: string;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand?: (id: string, isExpanded: boolean) => void;
}

// 转换 JSON 数据为 React Flow 节点和连线
const transformJsonToFlowData = (jsonData: JsonNode, initialExpansionLevel: number = 100) => {
  const nodes: NodeType<NodeData>[] = [];
  const edges: EdgeType[] = [];

  // 存储每个节点的子节点数量，用于布局计算
  const childrenCount: { [key: string]: number } = {};
  // 存储每个节点的层级
  const nodeLevels: { [key: string]: number } = {};

  // 预遍历，计算子节点数量和层级
  const preprocess = (node: JsonNode, level: number = 0) => {
    nodeLevels[node.id] = level;
    childrenCount[node.id] = node.children ? node.children.length : 0;
    if (node.children) {
      node.children.forEach(child => preprocess(child, level + 1));
    }
  };

  preprocess(jsonData);

  const traverse = (node: JsonNode, parentId: string | null = null, siblingIndex: number = 0, parentPosition = { x: 0, y: 0 }, parentDirection: 'left' | 'right' | null = null) => {
    const level = nodeLevels[node.id];
    let position = { x: 0, y: 0 };
    const nodeHeight = 50; // 预估节点高度
    const horizontalSpacing = 150; // 节点水平间距
    const verticalSpacing = 50; // 节点垂直间距

    if (level === 0) {
      // 根节点放在中心
      position = { x: 800, y: 400 }; // 调整这个值以适应你的视图中心
    } else {
      // 根据父节点位置和方向计算当前节点位置
      if (parentDirection === 'left') {
        position.x = parentPosition.x - horizontalSpacing; // 放在父节点左侧
      } else if (parentDirection === 'right') {
        position.x = parentPosition.x + horizontalSpacing; // 放在父节点右侧
      } else { // 根节点的子节点，交替左右放置
        if (siblingIndex % 2 === 0) {
          position.x = parentPosition.x + horizontalSpacing; // 偶数索引放右边
          parentDirection = 'right';
        } else {
          position.x = parentPosition.x - horizontalSpacing; // 奇数索引放左边
          parentDirection = 'left';
        }
      }

      // 简单的垂直偏移，需要更精细的计算避免重叠
      // 这里可以根据兄弟节点的数量和索引来计算垂直位置
      // 这是一个简化的方法，实际应用中可能需要更复杂的逻辑
      const totalSiblings = parentId ? childrenCount[parentId] : 1; // 如果是根节点，假设只有一个顶层节点
      const verticalOffset = (siblingIndex - (totalSiblings - 1) / 2) * (nodeHeight + verticalSpacing);
      position.y = parentPosition.y + verticalOffset;
    }

    const isNodeInitiallyExpanded = level < initialExpansionLevel;
    const isNodeInitiallyHidden = level > initialExpansionLevel;

    nodes.push({
      id: node.id,
      type: 'mindmap',
      data: {
        label: node.title,
        hasChildren: childrenCount[node.id] > 0,
        isExpanded: isNodeInitiallyExpanded,
      },
      position,
      hidden: isNodeInitiallyHidden,
    });

    if (parentId !== null) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'bezier',
        animated: false,
        style: { stroke: '#8a2be2', strokeWidth: 2 },
        hidden: isNodeInitiallyHidden,
      });
    }

    if (node.children) {
      node.children.forEach((child, index) => {
        // 只有当父节点初始展开时，才递归处理子节点并计算位置
        if (isNodeInitiallyExpanded) {
           traverse(child, node.id, index, position, parentDirection);
        } else {
           // 如果父节点初始收起，仍然添加子节点和边，但标记为 hidden
           // 这确保了展开时可以正确显示
           // 位置可以在展开时重新计算或使用默认值
           nodes.push({
              id: child.id,
              type: 'mindmap',
              data: {
                 label: child.title,
                 hasChildren: childrenCount[child.id] > 0,
                 isExpanded: false, // 子节点初始收起
              },
              position: { x: 0, y: 0 }, // 隐藏节点位置不重要
              hidden: true,
           });
           if (node.id !== null) {
              edges.push({
                 id: `e-${node.id}-${child.id}`,
                 source: node.id,
                 target: child.id,
                 type: 'bezier',
                 animated: false,
                 style: { stroke: '#8a2be2', strokeWidth: 2 },
                 hidden: true,
              });
           }
           if (child.children) {
               // 递归添加更深层的子节点和边，但标记为 hidden
               const addHiddenChildren = (parentNodeId: string, children: JsonNode[]) => {
                   children.forEach(grandchild => {
                       nodes.push({
                           id: grandchild.id,
                           type: 'mindmap',
                           data: {
                               label: grandchild.title,
                               hasChildren: childrenCount[grandchild.id] > 0,
                               isExpanded: false,
                           },
                           position: { x: 0, y: 0 },
                           hidden: true,
                       });
                       edges.push({
                           id: `e-${parentNodeId}-${grandchild.id}`,
                           source: parentNodeId,
                           target: grandchild.id,
                           type: 'bezier',
                           animated: false,
                           style: { stroke: '#8a2be2', strokeWidth: 2 },
                           hidden: true,
                       });
                       if (grandchild.children) {
                           addHiddenChildren(grandchild.id, grandchild.children);
                       }
                   });
               };
               addHiddenChildren(child.id, child.children);
           }
        }
      });
    }
  };

  traverse(jsonData);

  return { nodes, edges };
};

const MindMapContainer: React.FC = () => {
  const [nodes, setNodes] = useState<NodeType<NodeData>[]>([]);
  const [edges, setEdges] = useState<EdgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const initialExpansionLevel = 2; // 配置初始化展开层级，例如只展开前两层

  useEffect(() => {
    const loadMindMapData = async () => {
      try {
        // TODO: 在这里实现实际读取 json 文件的逻辑
        // 例如使用 fetch 或 fs 模块
        // Placeholder data for now
        const response = await fetch('/XXX.json'); // 假设 json 在 public 目录下或可以通过相对路径访问
        const jsonData: JsonNode = await response.json();

        // 转换并设置初始数据
        const { nodes: initialNodes, edges: initialEdges } = transformJsonToFlowData(jsonData, initialExpansionLevel);
        setNodes(initialNodes);
        setEdges(initialEdges);
        setLoading(false);
      } catch (error) {
        console.error('加载思维导图数据失败:', error);
        setLoading(false);
        // 可以设置一些默认节点或显示错误信息
      }
    };

    loadMindMapData();
  }, [initialExpansionLevel]); // 当 initialExpansionLevel 变化时重新加载数据

  // 处理 React Flow 自身触发的节点变化 (例如拖拽)
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  // 处理 React Flow 自身触发的边变化
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  // 处理新的连接
  const onConnect = useCallback(
    (params: ConnectionType | EdgeType) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // 处理节点展开/收起逻辑
  const handleNodeToggleExpand = useCallback(
    (nodeId: string, isExpanded: boolean) => {
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                isExpanded: isExpanded,
              },
            };
          }
          return node;
        });

        // 递归更新子节点的 hidden 状态
        const updateChildrenVisibility = (parentNodeId: string, show: boolean) => {
            updatedNodes.forEach(node => {
                // 找到直接连接到父节点的边
                const incomingEdges = edges.filter(edge => edge.target === node.id && edge.source === parentNodeId);
                if (incomingEdges.length > 0) {
                    // 检查父节点是否展开 (使用当前的 updatedNodes 状态)
                    const parentNode = updatedNodes.find(n => n.id === parentNodeId);

                    // 只有当父节点展开且 show 为 true 时，才考虑显示当前节点
                    const shouldShow = show && parentNode?.data.isExpanded;

                    // 如果当前节点的 hidden 状态需要改变，则更新
                    if (node.hidden !== !shouldShow) {
                        node.hidden = !shouldShow;
                    }

                    // 如果当前节点被显示且有子节点，则递归处理子节点
                    if (!node.hidden && node.data.hasChildren) {
                       updateChildrenVisibility(node.id, show);
                    }
                }
            });
        };

        // 初始调用以更新从被点击节点开始的子节点可见性
        updateChildrenVisibility(nodeId, isExpanded);

        return [...updatedNodes]; // 返回新数组以触发状态更新
      });

      // 更新边的可见性
      setEdges((eds) => {
        const updatedEdges = eds.map(edge => {
            // 获取边的源节点和目标节点 (使用最新的节点状态)
            // 注意：这里需要使用 setNodes 完成后的最新状态，但 useCallback 的闭包捕获的是旧状态
            // 一个更好的方法是在 setNodes 的回调中同时处理边，或者在 handleNodeToggleExpand 外部使用 useReducer
            // 为了简化，这里假设节点状态会及时更新，但这可能导致边更新略滞后
            const sourceNode = nodes.find(n => n.id === edge.source); // 这里仍可能获取旧的 nodes
            const targetNode = nodes.find(n => n.id === edge.target); // 这里仍可能获取旧的 nodes

            // 只有当源节点和目标节点都可见时，边才可见
            const isEdgeVisible = sourceNode && !sourceNode.hidden && targetNode && !targetNode.hidden;

            return { ...edge, hidden: !isEdgeVisible };
        });
        return [...updatedEdges]; // 返回新数组以触发状态更新
      });

    },
    [nodes, edges, setNodes, setEdges], // 添加 nodes 和 edges 到依赖数组
  );

  // 处理保存功能
  const onSave = useCallback((flow: ReactFlowJsonObject) => {
    console.log('保存思维导图数据:', flow);
    // TODO: 在这里实现保存逻辑，例如发送到后端或下载文件
  }, []);

  if (loading) {
    return <div>Loading mind map...</div>;
  }

  return (
    <MindMap
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeToggleExpand={handleNodeToggleExpand} // 将处理函数传递给 MindMap
      onSave={onSave}
    />
  );
};

export default MindMapContainer; 