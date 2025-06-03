import React from 'react';
import { Handle, Position } from 'react-flow-renderer';

interface NodeData {
  label: string;
  hasChildren: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string, isExpanded: boolean) => void;
}

const MindMapNode: React.FC<{ data: NodeData; id: string }> = ({ data, id }) => {
  const handleClick = () => {
    if (data.hasChildren && data.onToggleExpand) {
      data.onToggleExpand(id, !data.isExpanded);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#fff',
        border: '2px solid #4299e1',
        cursor: data.hasChildren ? 'pointer' : 'default',
        minWidth: '120px',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ 
          background: '#4299e1',
          width: 8,
          height: 8,
          top: -4,
        }}
      />
      <div style={{ 
        fontSize: '14px',
        color: '#2d3748',
        fontWeight: 500,
      }}>
        {data.label}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ 
          background: '#4299e1',
          width: 8,
          height: 8,
          bottom: -4,
        }}
      />
    </div>
  );
};

export default MindMapNode; 