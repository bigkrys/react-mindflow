import React from 'react';
import { MindMap } from '../src';
import data from '../src/data/fe.json';

console.log(data);

const App: React.FC = () => {
  const handleNodeClick = (node: any) => {
    console.log('点击节点:', node);
  };

  return (
    <div style={{ 
      background: '#061178', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ 
        background: 'transparent', 
        padding: 40,
        width: '100%',
        overflow: 'hidden'
      }}>
        <MindMap
          data={data}
          width={1600}
          height={900}
          initialDepth={2}
          theme={{
            node: {
              fontSize: 16,
              borderRadius: 24,
              backgroundColor: '#fff',
              color: '#333'
            },
            connection: {
              lineColor: '#40a9ff',
              lineWidth: 3,
              lineOpacity: 1,
              lineStyle: 'curved',
              lineType: 'solid',
              curveStrength: 25,
              animation: true,
              animationDuration: 500
            },
            expandButton: {
              backgroundColor: '#fff',
              borderColor: '#1890ff',
              iconColor: '#1890ff'
            },
            rootNode: {
              backgroundColor: '#1890ff',
              borderColor: '#1890ff',
              color: '#fff',
              borderWidth: 0
            }
          }}
          style={{
            background: '#061178',
          }}
          onNodeClick={handleNodeClick}
          showExpandButtons={false}
        />
      </div>
    </div>
  );
};

export default App; 