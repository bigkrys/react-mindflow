# React MindFlow

一个基于 React 和 D3.js 的思维导图组件。

## 特性

- 使用 TypeScript 开发
- 基于 D3.js 的树形布局
- 支持自定义样式和交互
- 支持节点点击事件
- 完全类型安全

## 安装

```bash
npm install react-mindflow
# 或
yarn add react-mindflow
```

## 使用方法

```tsx
import { MindMap } from 'react-mindflow';

const data = {
  name: "前端知识图谱",
  children: [
    {
      name: "初阶",
      children: [
        { name: "HTML" },
        { name: "CSS" },
        { name: "JavaScript" }
      ]
    }
  ]
};

function App() {
  return (
    <MindMap
      data={data}
      width={800}
      height={600}
      nodeRadius={20}
      fontSize={14}
      colors={{
        node: '#fff',
        link: '#ccc',
        text: '#333'
      }}
      onNodeClick={(node) => console.log('clicked:', node)}
    />
  );
}
```

## API

### MindMapProps

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| data | MindMapNode | - | 思维导图数据 |
| width | number | 800 | SVG 宽度 |
| height | number | 600 | SVG 高度 |
| nodeRadius | number | 20 | 节点半径 |
| nodePadding | number | 24 | 节点文本间距 |
| fontSize | number | 14 | 文本大小 |
| colors | object | - | 颜色配置 |
| onNodeClick | function | - | 节点点击回调 |

### MindMapNode

```ts
interface MindMapNode {
  name: string;
  children?: MindMapNode[];
}
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## License

MIT 