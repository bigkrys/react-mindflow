# React MindFlow

基于 React 和 AntV G6 的思维导图组件。

## 特性

- 🎨 支持自定义节点样式
- 🌓 支持亮色/暗色主题
- 📐 支持水平/垂直布局
- 🖱️ 支持节点拖拽
- 🔍 支持画布缩放
- 📦 支持 TypeScript

## 安装

```bash
npm install react-mindflow
# 或
yarn add react-mindflow
# 或
pnpm add react-mindflow
```

## 使用

```tsx
import { MindFlow } from 'react-mindflow';

const data = {
  id: 'root',
  label: '思维导图',
  children: [
    {
      id: '1',
      label: '子节点1',
      children: [
        { id: '1-1', label: '子节点1.1' },
        { id: '1-2', label: '子节点1.2' },
      ],
    },
    {
      id: '2',
      label: '子节点2',
    },
  ],
};

function App() {
  return (
    <MindFlow
      data={data}
      width={800}
      height={600}
      theme="light"
      direction="H"
      onNodeClick={(node) => console.log('点击节点:', node)}
    />
  );
}
```

## API

### MindFlow Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| data | 思维导图数据 | `MindFlowNode` | - |
| width | 画布宽度 | `number` | 800 |
| height | 画布高度 | `number` | 600 |
| direction | 布局方向 | `'H'` \| `'V'` | 'H' |
| theme | 主题 | `'light'` \| `'dark'` | 'light' |
| nodePadding | 节点内边距 | `number` | 16 |
| nodeSpacing | 同级节点间距 | `number` | 50 |
| levelSpacing | 层级间距 | `number` | 100 |
| onNodeClick | 节点点击事件 | `(node: MindFlowNode) => void` | - |
| onNodeDoubleClick | 节点双击事件 | `(node: MindFlowNode) => void` | - |
| onNodeContextMenu | 节点右键菜单事件 | `(node: MindFlowNode, e: MouseEvent) => void` | - |

### MindFlowNode

```ts
interface MindFlowNode {
  id: string;
  label: string;
  children?: MindFlowNode[];
  style?: {
    fill?: string;
    stroke?: string;
    lineWidth?: number;
    [key: string]: any;
  };
}
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建库文件
pnpm build

# 构建示例
pnpm build:example
```

## License

MIT 