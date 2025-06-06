import { CSSProperties } from 'react';

// 基础布局配置
export interface LayoutConfig {
  horizontalGap?: number;      // 水平间距
  verticalGap?: number;        // 垂直间距
  nodePadding?: number;        // 节点内边距
  levelRatio?: number;         // 层级缩放比例
  minSiblingGap?: number;      // 最小兄弟节点间距
  subtreeSep?: number;         // 子树间距
}

// 节点样式配置
export interface NodeStyle {
  backgroundColor?: string;    // 节点背景色
  borderColor?: string;        // 边框颜色
  borderWidth?: number;        // 边框宽度
  borderRadius?: number;       // 圆角大小
  boxShadow?: string;         // 阴影效果
  fontSize?: number;          // 字体大小
  fontFamily?: string;        // 字体
  fontWeight?: number | string; // 字重
  color?: string;             // 文字颜色
  minWidth?: number;          // 最小宽度
  minHeight?: number;         // 最小高度
  customStyle?: CSSProperties; // 自定义样式
}

// 连接线样式配置
export interface ConnectionStyle {
  lineColor?: string;         // 线条颜色
  lineWidth?: number;         // 线条宽度
  lineOpacity?: number;       // 线条透明度
  lineStyle?: 'straight' | 'curved' | 'orthogonal'; // 线条样式
  lineType?: 'solid' | 'dashed' | 'dotted';        // 线条类型
  curveStrength?: number;     // 曲线强度（仅用于 curved 样式）
  animation?: boolean;        // 是否启用动画
  animationDuration?: number; // 动画持续时间
  customStyle?: CSSProperties; // 自定义样式
}

// 展开/折叠按钮样式
export interface ExpandButtonStyle {
  size?: number;              // 按钮大小
  backgroundColor?: string;   // 背景色
  borderColor?: string;       // 边框颜色
  iconColor?: string;        // 图标颜色
  hoverColor?: string;       // 悬停颜色
  position?: 'right' | 'left' | 'auto'; // 按钮位置
  customStyle?: CSSProperties; // 自定义样式
}

// 根节点特殊样式
export interface RootNodeStyle extends NodeStyle {
  specialBorderColor?: string;    // 特殊边框颜色
  specialBackgroundColor?: string; // 特殊背景色
  specialShadow?: string;         // 特殊阴影效果
}

// 主题配置
export interface ThemeConfig {
  layout: LayoutConfig;
  node: NodeStyle;
  connection: ConnectionStyle;
  expandButton: ExpandButtonStyle;
  rootNode: RootNodeStyle;
}

// 默认主题
export const defaultTheme: ThemeConfig = {
  layout: {
    horizontalGap: 200,      // 减小水平间距
    verticalGap: 40,         // 减小垂直间距
    nodePadding: 30,         // 调整节点内边距
    levelRatio: 0.9,         // 提高层级缩放比例
    minSiblingGap: 25,       // 调整最小兄弟节点间距
    subtreeSep: 40,          // 减小子树间距
  },
  node: {
    backgroundColor: '#ffffff',
    borderColor: '#e6f7ff',
    borderWidth: 2,
    borderRadius: 6,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontSize: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#595959',
    minWidth: 80,            // 增加最小宽度
    minHeight: 32,           // 增加最小高度
  },
  connection: {
    lineColor: '#e6f7ff',
    lineWidth: 2,
    lineOpacity: 0.8,
    lineStyle: 'curved',
    lineType: 'solid',
    curveStrength: 50,
    animation: true,
    animationDuration: 400,
  },
  expandButton: {
    size: 16,
    backgroundColor: '#e6f7ff',
    borderColor: '#1890ff',
    iconColor: '#1890ff',
    hoverColor: '#40a9ff',
    position: 'auto',
  },
  rootNode: {
    backgroundColor: '#f0f5ff',
    borderColor: '#1890ff',
    borderWidth: 2.5,
    boxShadow: '0 4px 6px rgba(24,144,255,0.15)',
    fontWeight: 'bold',
    color: '#1890ff',
  },
};

// 点坐标类型
export interface Point {
  x: number;
  y: number;
}

// 曲线配置类型
export interface CurveConfig {
  alpha: number;    // 当前方向与父方向权重
  beta: number;     // 曲线张力系数
  gamma: number;    // 最大控制距离
  phi: number;      // 曲线张开角
  kr: number;       // 斥力系数
} 