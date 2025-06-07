import React, { useState, useEffect } from 'react';
import { MindFlow } from '../src';
import type { MindFlowNode } from '../src/types';

const customLineColors = [
  '#02CB9F', 
  '#F6D87B', 
  '#95de64', 
  '#CB6EF8',
  '#0056D2',
  '#D2B48C',
];

const App: React.FC = () => {
  const [data, setData] = useState<MindFlowNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch('./data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(jsonData => {
        if (!jsonData || typeof jsonData !== 'object') {
          throw new Error('Invalid data format');
        }
        setData(jsonData);
      })
      .catch(error => {
        console.error('加载数据失败:', error);
        setError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleNodeClick = (node: MindFlowNode) => {
    console.log('Node clicked:', node);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return <div>错误: {error}</div>;
  }

  if (!data) {
    return <div>没有数据</div>;
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      <MindFlow
        data={data}
        theme="light"
        direction="H"
        expandDepth={1}
        defaultLineColors={customLineColors}
        onNodeClick={handleNodeClick}
        width={size.width}
        height={size.height}
      />
    </div>
  );
};

export default App; 