import React, { useCallback, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  ConnectionMode,
} from 'react-flow-renderer';
import type {
  Node as NodeType,
  Edge as EdgeType,
  Connection as ConnectionType,
  ReactFlowInstance,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlowJsonObject,
} from 'react-flow-renderer';
import MindMapNode from './MindMapNode';

// 自定义 Panel 组件
interface PanelProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  children?: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ position, children }) => (
  <div style={{ 
    position: 'absolute', 
    top: position === 'top-right' ? 10 : 'auto',
    right: position === 'top-right' ? 10 : 'auto',
    bottom: position === 'bottom-right' ? 10 : 'auto',
    left: position === 'top-left' ? 10 : 'auto',
    zIndex: 5,
    display: 'flex',
    gap: '8px',
  }}>
    {children}
  </div>
);

const nodeTypes = { mindmap: MindMapNode };

interface NodeData {
  label: string;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand?: (id: string, isExpanded: boolean) => void;
}

// 定义 MindMap 组件的 Props 接口
interface MindMapProps {
  nodes: NodeType<NodeData>[];
  edges: EdgeType[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: ConnectionType | EdgeType) => void;
  onNodeToggleExpand: (nodeId: string, isExpanded: boolean) => void;
  onSave?: (flow: ReactFlowJsonObject) => void;
}

const MindMap: React.FC<MindMapProps> = ({
  nodes,
  edges,
  onNodesChange: handleNodesChange,
  onEdgesChange: handleEdgesChange,
  onConnect,
  onSave,
  onNodeToggleExpand,
}) => {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // 处理节点展开/收起 - 直接调用父组件传入的回调
  const handleNodeToggleExpandClick = useCallback(
    (nodeId: string, isExpanded: boolean) => {
      onNodeToggleExpand(nodeId, isExpanded);
    },
    [onNodeToggleExpand],
  );

  // 为每个节点添加展开/收起回调 (使用传入的 nodes prop)
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onToggleExpand: handleNodeToggleExpandClick,
      },
    }));
  }, [nodes, handleNodeToggleExpandClick]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      console.log(`Node ${node.id} dragged to:`, node.position);
      // 可以在这里调用父组件提供的拖拽结束回调，如果需要
    },
    []
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      console.log(`Node ${node.id} double clicked`);
      // 可以在这里调用父组件提供的双击回调，如果需要
    },
    []
  );

  const onSaveClick = useCallback(() => {
    if (rfInstance && onSave) {
      const flow = rfInstance.toObject();
      onSave(flow);
    }
  }, [rfInstance, onSave]);

  return (
    <div style={{ 
      width: '100%', 
      height: '800px', 
      background: '#1a1a2e', 
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onInit={setRfInstance}
        fitView
        defaultEdgeOptions={{
          type: 'bezier',
          animated: false,
          style: { stroke: '#8a2be2', strokeWidth: 2 },
        }}
        proOptions={{
          account: 'unlimitted',
          hideAttribution: true,
        }}
      >
        <MiniMap nodeColor="#4299e1" />
        <Controls />
        <Panel position="top-right">
          <button
            onClick={onSaveClick}
            style={{ 
              padding: '8px 16px',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            保存
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default MindMap; 