# FenshiChart - 实时分时图表库

FenshiChart 是一个轻量级的 JavaScript 图表库，专为显示股票、加密货币等金融产品的实时行情数据而设计。它支持秒级别更新，提供流畅的数据可视化体验，适合构建专业的交易和金融数据分析应用。

![FenshiChart Demo](https://github.com/yourusername/fenshi/raw/main/screenshot.png)

## 特点

- 实时渲染，支持秒级数据更新
- 显示价格走势线和成交量柱状图
- 支持均价线显示（基于成交量加权平均）
- 专为黑暗主题设计，易于阅读
- 自动适应容器大小，支持响应式布局
- 轻量级，无第三方依赖
- 可定制的颜色、线条和显示选项
- 中国A股风格：采用同花顺配色方案（涨为红色、跌为绿色）
- 高级横向滚动：支持鼠标拖拽、触摸滑动和滚轮操作
- 精确十字线：显示虚线十字线和数据点高亮
- 数据提示框：鼠标悬停时显示详细数据信息
- 右侧价格标签：显示涨跌幅数据
- 移动端优化：自动适配移动设备体验

## 快速开始

### 基本用法

1. 在你的项目中引入 `fenshi.js`：

```html
<script src="fenshi.js"></script>
```

2. 创建一个用于图表的容器：

```html
<div id="chart-container" style="width: 100%; height: 400px;"></div>
```

3. 初始化图表并添加数据：

```javascript
// 初始化图表
const chart = new FenshiChart('chart-container', {
  height: 400,
  backgroundColor: '#0e1117',
  lineColor: '#36a2eb',
  averageColor: '#ffcd56',
  upBarColor: '#F44336',    // 涨为红色（同花顺风格）
  downBarColor: '#4CAF50',  // 跌为绿色（同花顺风格）
  showAverage: true,
  enableScroll: true,       // 启用横向滚动
  showRightPrice: true      // 显示右侧价格标签
});

// 添加初始数据
const initialData = [
  { time: new Date('2023-05-15T09:30:00'), price: 10.50, volume: 2500 },
  { time: new Date('2023-05-15T09:30:01'), price: 10.48, volume: 1200 },
  // 更多数据点...
];
chart.setInitialData(initialData);

// 添加实时数据点
function addNewDataPoint() {
  const newData = {
    time: new Date(),
    price: 10.52 + (Math.random() - 0.5) * 0.1,
    volume: Math.floor(Math.random() * 2000) + 500
  };
  chart.addData(newData);
}

// 模拟实时数据更新（每秒）
setInterval(addNewDataPoint, 1000);
```

### 从 WebSocket 获取实时数据

```javascript
const chart = new FenshiChart('chart-container');

// 连接WebSocket
const socket = new WebSocket('wss://your-data-source.com/ws');

// 处理初始数据
socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    action: 'subscribe',
    symbol: 'AAPL'
  }));
});

// 处理实时数据更新
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  // 如果是初始历史数据
  if (data.type === 'history') {
    const formattedData = data.data.map(item => ({
      time: new Date(item.timestamp),
      price: parseFloat(item.price),
      volume: parseInt(item.volume)
    }));
    chart.setInitialData(formattedData);
  } 
  // 如果是实时更新
  else if (data.type === 'update') {
    chart.addData({
      time: new Date(data.timestamp),
      price: parseFloat(data.price),
      volume: parseInt(data.volume)
    });
  }
});
```

## 配置选项

创建图表时可以传递以下配置选项：

```javascript
const options = {
  // 尺寸
  width: 800,                       // 图表宽度（可选，默认使用容器宽度）
  height: 400,                      // 图表高度

  // 内边距
  padding: {                        // 内边距设置
    top: 20,
    right: 50,
    bottom: 60,
    left: 50
  },

  // 颜色
  backgroundColor: '#0e1117',       // 背景色
  lineColor: '#36a2eb',             // 价格线颜色
  averageColor: '#ffcd56',          // 均价线颜色
  gridColor: '#333',                // 网格线颜色
  textColor: '#ccc',                // 文字颜色
  upBarColor: '#F44336',            // 上涨柱状图颜色（红色）
  downBarColor: '#4CAF50',          // 下跌柱状图颜色（绿色）
  crosshairColor: 'rgba(255,255,255,0.5)', // 十字线颜色

  // 功能设置
  showAverage: true,                // 是否显示均价线
  animation: true,                  // 是否启用动画
  timeFormat: 'HH:mm:ss',           // 时间格式
  maxDataPoints: 300,               // 最大数据点数量
  gridLines: 5,                     // 水平网格线数量
  barWidth: 2,                      // 柱子宽度（固定模式）
  barSpacing: 1,                    // 柱子间距（固定模式）
  
  // 新增功能设置
  enableScroll: true,               // 启用水平滚动
  showRightPrice: true,             // 显示右侧价格标签
  showCrosshair: true,              // 显示鼠标十字线 
  tooltipEnabled: true,             // 显示鼠标悬停提示
  coordinateType: 'auto',           // 坐标轴类型: 'auto'、'percent'、'limit'
  limitPercentage: 10,              // 涨跌幅限制（用于'limit'坐标系）
  initialPrice: 100,                // 初始参考价格，特别适用于'limit'坐标模式
  infoBarEnabled: true,             // 显示顶部价格信息面板
  autoHideCrosshairOnMobile: true   // 在移动设备上自动隐藏十字线
};

const chart = new FenshiChart('chart-container', options);
```

## API 参考

### 创建图表

```javascript
const chart = new FenshiChart(container, options);
```

- `container`：字符串（元素ID）或DOM元素引用
- `options`：配置选项对象（见上文）

### 设置初始数据

```javascript
chart.setInitialData(data);
```

- `data`：数据点数组，每个数据点包含 `time`、`price` 和 `volume` 属性

### 添加新数据点

```javascript
chart.addData(dataPoint);
```

- `dataPoint`：包含 `time`、`price` 和 `volume` 属性的对象

#### 指定买卖方向

您可以通过设置数据点的 `direction` 属性来指定成交量柱子的颜色：

```javascript
chart.addData({
  time: new Date(),
  price: 10.52,
  volume: 1500,
  direction: 'buy' // 'buy'、'sell' 或 'neutral'
});
```

买卖方向对应的颜色：
- `buy`: 红色（买入）
- `sell`: 绿色（卖出）
- `neutral`: 根据主题决定，暗色主题为白色，亮色主题为棕黄色
- 未指定时默认为 `neutral`

### 调整大小

```javascript
chart.resize(width, height);
```

- `width`：新宽度（可选，默认使用容器宽度）
- `height`：新高度（可选，默认为400）

### 更新配置

```javascript
chart.updateOptions(newOptions);
```

- `newOptions`：要更新的选项对象

### 设置滚动位置

```javascript
chart.setScrollPosition(position);
```

- `position`：滚动位置（0-1之间的小数）

### 设置初始参考价格

```javascript
chart.setInitialPrice(price);
```

- `price`：参考价格（数值类型）

这个方法特别适用于涨停板坐标类型（'limit'），允许设置用于计算涨跌停价格的参考价格。当图表数据尚未加载或需要使用特定的价格作为涨跌计算基准时非常有用。设置初始价格后，涨停和跌停价格将根据这个价格和limitPercentage参数计算。

### 生成模拟数据（用于测试）

```javascript
const mockData = FenshiChart.generateMockData(numPoints, startTime, startPrice);
```

- `numPoints`：要生成的数据点数量（默认100）
- `startTime`：起始时间（默认为当前时间）
- `startPrice`：起始价格（默认为100）

## 交互特性

### 横向滚动

支持多种方式浏览大量历史数据：
- 鼠标拖拽：在图表上按住鼠标左键并拖动
- 触摸滑动：在移动设备上左右滑动
- 滚轮滚动：使用鼠标滚轮横向滚动
- 滚动条控制：通过滑块控制精确定位

### 数据点高亮和十字线

当鼠标悬停在图表上时，会显示十字线帮助定位价格和时间点。十字线会跟随鼠标移动，对应的数据点会高亮显示，并在轴上显示当前价格和时间信息。

### 右侧价格标签

右侧显示以开盘价为基准的价格变化标签，上涨和下跌使用不同颜色区分，帮助快速识别价格波动幅度。

### 数据提示框

鼠标悬停时会显示一个提示框，包含当前数据点的详细信息：
- 时间：当前数据点的时间（时:分:秒）
- 价格：当前价格
- 均价：成交量加权平均价
- 涨跌：相对于开盘价的变化值和百分比
- 成交量：当前成交量
- 金额：交易金额（价格×成交量）

### 移动端优化

在移动设备上访问时：
- 自动禁用十字线和提示框（可通过配置更改）
- 优化触摸交互体验
- 响应式布局自动调整

## 演示

本库包含多个演示文件：

1. `index.html` - 基本演示，展示了如何使用 FenshiChart 及其基本功能
2. `real-time-demo.html` - 模拟真实交易平台的实时数据和 UI 界面
3. `fixed-bar-example.html` - 展示固定柱宽模式和新增功能的综合演示
4. `screenshot-match.html` - 使用固定数据生成与参考图像匹配的分时图
5. `stocks-grid.html` - 多股票分时图网格展示，类似于市场总览

## 浏览器兼容性

FenshiChart 适用于所有现代浏览器，包括：

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 16+

## 许可证

MIT 