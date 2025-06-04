import React from 'react';
import { MindMap } from '../src';
import data from '../src/data/fe.json';

const App: React.FC = () => {
  const handleNodeClick = (node: any) => {
    console.log('点击节点:', node);
  };

  return (
    <div style={{ 
      padding: '40px 20px',
      background: '#f0f2f5', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ 
        background: '#fff', 
        padding: 40,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        width: '100%',
        overflow: 'hidden'
      }}>
        <MindMap
          data={data}
          width={1600}
          height={900}
          nodeRadius={24}
          fontSize={16}
          initialDepth={1}
          colors={{
            node: '#fff',
            link: '#91d5ff',
            text: '#333',
            expandButton: '#1890ff'
          }}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};

export default App; 