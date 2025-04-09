/**
 * Fenshi.js - Real-time stock chart library
 * A lightweight library for rendering real-time stock data with second-level updates
 * 
 * @author Scott Ban
 */

class FenshiChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) {
      throw new Error('Container element not found');
    }
    
    // 默认主题颜色配置
    const themes = {
      dark: {
        line: '#36a2eb',
        average: '#ffcd56',
        grid: '#333',
        text: '#ccc',
        background: '#0e1117',
        upBar: '#F44336',
        downBar: '#4CAF50',
        crosshair: 'rgba(255, 255, 255, 0.5)'
      },
      light: {
        line: '#2196F3',
        average: '#FF9800',
        grid: '#e0e0e0',
        text: '#333',
        background: '#ffffff',
        upBar: '#F44336',
        downBar: '#4CAF50',
        crosshair: 'rgba(0, 0, 0, 0.3)'
      }
    };
    
    // 获取当前主题
    const currentTheme = options.theme || 'dark';
    const themeColors = themes[currentTheme] || themes.dark;
    
    // Default options
    this.options = {
      width: options.width || this.container.clientWidth || 800,
      height: options.height || 400,
      padding: options.padding || { top: 20, right: 50, bottom: 60, left: 50 },
      colors: {
        line: options.lineColor || themeColors.line,
        average: options.averageColor || themeColors.average, // 均价线颜色
        grid: options.gridColor || themeColors.grid,
        text: options.textColor || themeColors.text,
        background: options.backgroundColor || themeColors.background,
        upBar: options.upBarColor || themeColors.upBar,  // 涨为红色
        downBar: options.downBarColor || themeColors.downBar, // 跌为绿色
        crosshair: options.crosshairColor || themeColors.crosshair // 十字线颜色
      },
      theme: currentTheme, // 保存当前主题
      themes: themes, // 保存所有主题配置
      showAverage: options.showAverage !== undefined ? options.showAverage : true,
      averagePeriod: options.averagePeriod || 20, // 不再用于均价线计算
      animation: options.animation !== undefined ? options.animation : true,
      timeFormat: options.timeFormat || 'HH:mm:ss',
      maxDataPoints: options.maxDataPoints || 300,
      gridLines: options.gridLines || 5,
      barWidth: options.barWidth || 2,     // 固定柱子宽度为2px
      barSpacing: options.barSpacing || 1, // 柱子间距固定为1px
      rightOffset: options.rightOffset || 50, // 右侧留白，确保最新数据不会太靠边
      enableScroll: options.enableScroll !== undefined ? options.enableScroll : true,
      showRightPrice: options.showRightPrice !== undefined ? options.showRightPrice : true,
      scrollPosition: 1.0, // 滚动位置，1.0表示最新数据（右侧），0.0表示最早数据（左侧）
      showCrosshair: options.showCrosshair !== undefined ? options.showCrosshair : true, // 显示十字线
      tooltipEnabled: options.tooltipEnabled !== undefined ? options.tooltipEnabled : true, // 显示提示框
      coordinateType: options.coordinateType || 'normal', // 坐标类型：'normal', 'full', 'limit'
      limitPercentage: options.limitPercentage || 10, // 涨跌停板百分比，默认10%
      timeAxisHeight: options.timeAxisHeight || 30, // 时间轴高度
      maxTimeLabels: options.maxTimeLabels || 8, // 时间轴上最多显示的标签数量
      infoBarEnabled: options.infoBarEnabled !== undefined ? options.infoBarEnabled : true, // 控制信息面板显示
      initialPrice: options.initialPrice !== undefined ? parseFloat(options.initialPrice) : null, // 初始价格设置，方便涨停板模式参考
    };
    
    // Data
    this.data = [];
    this.averageData = []; // 均价线数据
    this.volumeData = [];
    
    // 用于计算均价线的累计数据
    this.cumulativeVolumeData = [];
    this.cumulativeAmountData = [];
    
    // State
    this.yRange = { min: 0, max: 0 };
    this.xRange = { min: 0, max: 0 };
    this.volumeRange = { min: 0, max: 0 };
    this.priceInfo = {
      current: 0,
      open: 0,
      high: 0,
      low: 0,
      change: 0,
      changePercent: 0,
      avgPrice: 0, // 当前均价
    };
    
    // 滚动相关变量
    this.isDragging = false;
    this.dragStartX = 0;
    this.scrollOffsetX = 0;
    this.prevTouchX = 0;
    this.touchIdentifier = null;
    
    // 鼠标悬停相关
    this.mousePosition = { x: 0, y: 0 };
    this.isMouseOver = false;
    this.hoveredDataIndex = -1;
    this.tooltip = null;
    
    this.init();
  }
  
  init() {
    // 创建主画布
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.maxWidth = '100%';
    this.ctx = this.canvas.getContext('2d');
    
    // 创建成交量画布
    this.volumeHeight = Math.floor(this.options.height * 0.2);
    this.volumeCanvas = document.createElement('canvas');
    this.volumeCanvas.width = this.options.width;
    this.volumeCanvas.height = this.volumeHeight;
    this.volumeCanvas.style.display = 'block';
    this.volumeCanvas.style.marginTop = '5px';
    this.volumeCanvas.style.width = '100%';
    this.volumeCanvas.style.maxWidth = '100%';
    this.volumeCtx = this.volumeCanvas.getContext('2d');
    
    // 创建时间轴画布
    this.timeAxisCanvas = document.createElement('canvas');
    this.timeAxisCanvas.width = this.options.width;
    this.timeAxisCanvas.height = this.options.timeAxisHeight;
    this.timeAxisCanvas.style.display = 'block';
    this.timeAxisCanvas.style.marginTop = '1px';
    this.timeAxisCanvas.style.width = '100%';
    this.timeAxisCanvas.style.maxWidth = '100%';
    this.timeAxisCtx = this.timeAxisCanvas.getContext('2d');
    
    // 创建信息面板
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.marginBottom = '10px'; // 改为底部边距
    this.infoPanel.style.fontSize = '12px';
    this.infoPanel.style.lineHeight = '1.4';
    this.infoPanel.style.color = this.options.colors.text;
    
    // 创建容器
    this.chartContainer = document.createElement('div');
    this.chartContainer.style.position = 'relative';
    this.chartContainer.style.width = '100%';
    this.chartContainer.style.boxSizing = 'border-box';
    this.chartContainer.style.overflow = 'hidden';
    this.chartContainer.appendChild(this.infoPanel);   // 信息面板放在顶部
    this.chartContainer.appendChild(this.canvas);
    this.chartContainer.appendChild(this.volumeCanvas);
    this.chartContainer.appendChild(this.timeAxisCanvas); // 时间轴放在最下方
    
    // 主题相关样式
    this.applyThemeStyles();
    
    // 创建工具提示元素
    this.createTooltip();
    
    this.container.appendChild(this.chartContainer);
    
    // 设置信息面板的可见性
    this.infoPanel.style.display = this.options.infoBarEnabled !== false ? 'block' : 'none';
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // 初始化尺寸
    this.handleResize();
    
    // 如果启用滚动，设置滚动事件监听
    if (this.options.enableScroll) {
      this.setupScrollEvents();
    }
    
    // 添加鼠标事件监听器
    this.setupMouseEvents();
  }
  
  // 处理窗口大小变化
  handleResize() {
    // 获取容器真实宽度
    const containerWidth = this.container.clientWidth;
    
    // 如果宽度变化了，需要更新canvas大小
    if (containerWidth !== this.options.width) {
      this.resize(containerWidth);
    }
  }
  
  // 修改resize方法以适应新的时间轴
  resize(width, height) {
    const newWidth = width || this.container.clientWidth;
    const newHeight = height || this.options.height;
    
    this.options.width = newWidth;
    this.options.height = newHeight;
    
    // 更新canvas尺寸
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    
    this.volumeHeight = Math.floor(newHeight * 0.2);
    this.volumeCanvas.width = newWidth;
    this.volumeCanvas.height = this.volumeHeight;
    
    this.timeAxisCanvas.width = newWidth;
    this.timeAxisCanvas.height = this.options.timeAxisHeight;
    
    // 重新计算滚动位置
    const chartWidth = newWidth - this.options.padding.left - this.options.padding.right;
    const totalWidth = this.getFixedWidthChartWidth();
    
    if (totalWidth > chartWidth) {
      const maxScroll = totalWidth - chartWidth;
      this.scrollOffsetX = maxScroll * (1 - this.options.scrollPosition);
    } else {
      this.scrollOffsetX = 0;
    }
    
    // 重新渲染
    this.render();
  }
  
  // 应用主题相关样式
  applyThemeStyles() {
    this.chartContainer.style.backgroundColor = this.options.colors.background;
    this.infoPanel.style.color = this.options.colors.text;
    this.timeAxisCanvas.style.backgroundColor = this.options.colors.background;
    
    if (this.tooltip) {
      // 亮色主题需要更深的背景色以确保可读性
      if (this.options.theme === 'light') {
        this.tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.tooltip.style.color = '#fff';
      } else {
        this.tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.tooltip.style.color = '#fff';
      }
    }
  }
  
  // 切换主题
  switchTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') {
      console.warn('Invalid theme. Using dark theme as default.');
      theme = 'dark';
    }
    
    // 更新主题
    this.options.theme = theme;
    
    // 获取主题颜色
    const themeColors = this.options.themes[theme];
    
    // 更新颜色配置
    this.options.colors = {
      ...this.options.colors,
      line: themeColors.line,
      average: themeColors.average,
      grid: themeColors.grid,
      text: themeColors.text,
      background: themeColors.background,
      crosshair: themeColors.crosshair
      // 不更新上涨/下跌颜色，保持红涨绿跌
    };
    
    // 应用主题样式
    this.applyThemeStyles();
    
    // 重新渲染
    this.render();
  }
  
  // 设置滚动事件
  setupScrollEvents() {
    // 鼠标拖动
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // 为时间轴也添加拖动事件
    this.timeAxisCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // 触摸事件
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.timeAxisCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    document.addEventListener('touchmove', this.handleTouchMove.bind(this));
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    document.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
    
    // 鼠标滚轮
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.volumeCanvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.timeAxisCanvas.addEventListener('wheel', this.handleWheel.bind(this));
  }
  
  // 鼠标事件处理
  handleMouseDown(e) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
  
  handleMouseMove(e) {
    // 保存鼠标位置
    const rect = this.canvas.getBoundingClientRect();
    this.mousePosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // 如果正在拖动，处理滚动逻辑
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      this.dragStartX = e.clientX;
      
      this.updateScroll(dx);
      e.preventDefault();
      return; // 拖动时不显示十字线
    }
    
    // 如果没有拖动，则处理十字线
    this.updateHoveredDataIndex();
    
    // 仅当悬停状态改变时才重新渲染
    if (this.options.showCrosshair && this.hoveredDataIndex >= 0) {
      this.render();
      
      // 更新并显示提示框
      if (this.options.tooltipEnabled) {
        this.updateTooltip();
      }
    } else if (this.tooltip) {
      // 如果鼠标不在数据点上，隐藏提示框
      this.hideTooltip();
      this.render(); // 重绘清除十字线
    }
  }
  
  handleMouseUp(e) {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }
  
  // 触摸事件处理
  handleTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.touchIdentifier = touch.identifier;
      this.prevTouchX = touch.clientX;
      e.preventDefault();
    }
  }
  
  handleTouchMove(e) {
    if (this.touchIdentifier === null) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchIdentifier) {
        const dx = touch.clientX - this.prevTouchX;
        this.prevTouchX = touch.clientX;
        this.updateScroll(dx);
        e.preventDefault();
        break;
      }
    }
  }
  
  handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchIdentifier) {
        this.touchIdentifier = null;
        break;
      }
    }
  }
  
  // 滚轮事件处理，确保时间轴也能被操作
  handleWheel(e) {
    // 只处理水平滚动或滚轮事件
    if (e.deltaX !== 0) {
      e.preventDefault();
      this.updateScroll(e.deltaX);
    } else if (e.deltaY !== 0 && (e.shiftKey || e.target === this.timeAxisCanvas)) {
      // 当按住Shift键时或直接在时间轴上滚动时，垂直滚动转为水平滚动
      e.preventDefault();
      this.updateScroll(e.deltaY);
    }
    // 其他情况不阻止默认行为，允许页面正常滚动
  }
  
  // 更新滚动位置
  updateScroll(dx) {
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    const totalWidth = this.getFixedWidthChartWidth();
    
    if (totalWidth <= chartWidth) return; // 如果数据很少，不需要滚动
    
    // 计算新的滚动偏移
    this.scrollOffsetX += dx;
    
    // 限制滚动范围
    const maxScroll = totalWidth - chartWidth;
    this.scrollOffsetX = Math.max(0, Math.min(this.scrollOffsetX, maxScroll));
    
    // 更新滚动位置百分比
    this.options.scrollPosition = 1 - (this.scrollOffsetX / maxScroll);
    
    // 重新渲染
    this.render();
  }
  
  // 设置滚动位置
  setScrollPosition(position) {
    // position: 0.0 - 1.0 (0 = 最左侧, 1 = 最右侧)
    position = Math.max(0, Math.min(1, position));
    this.options.scrollPosition = position;
    
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    const totalWidth = this.getFixedWidthChartWidth();
    
    if (totalWidth > chartWidth) {
      const maxScroll = totalWidth - chartWidth;
      this.scrollOffsetX = maxScroll * (1 - position);
      this.render();
    }
  }
  
  // Data handling methods
  setInitialData(data) {
    this.data = data.map(d => ({
      time: new Date(d.time),
      price: parseFloat(d.price),
      volume: parseInt(d.volume, 10),
      direction: d.direction || 'neutral' // 买卖方向，默认为neutral
    }));
    
    if (this.data.length > 0) {
      // Use initialPrice as open price if it's provided, otherwise use first data point price
      if (this.options.initialPrice !== null) {
        this.priceInfo.open = this.options.initialPrice;
      } else {
        this.priceInfo.open = this.data[0].price;
      }
      
      this.calculateStats();
      this.calculateAverages();
      
      // 重置滚动位置到最新数据
      this.scrollOffsetX = 0;
      this.options.scrollPosition = 1.0;
      
      this.render();
    }
  }
  
  addData(newData) {
    // Add new data point
    const dataPoint = {
      time: new Date(newData.time),
      price: parseFloat(newData.price),
      volume: parseInt(newData.volume, 10),
      direction: newData.direction || 'neutral' // 买卖方向，默认为neutral
    };
    
    this.data.push(dataPoint);
    
    // Limit data points
    if (this.data.length > this.options.maxDataPoints) {
      this.data.shift();
    }
    
    this.calculateStats();
    this.calculateAverages();
    
    // 如果滚动位置是最新的，则保持滚动位置在最右侧
    if (this.options.scrollPosition >= 0.99) {
      this.scrollOffsetX = 0;
      this.options.scrollPosition = 1.0;
    } else {
      // 否则维持当前的滚动偏移位置，但更新滚动位置百分比
      const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
      const totalWidth = this.getFixedWidthChartWidth();
      const maxScroll = totalWidth - chartWidth;
      
      if (maxScroll > 0) {
        this.options.scrollPosition = 1 - (this.scrollOffsetX / maxScroll);
      }
    }
    
    this.render();
  }
  
  calculateStats() {
    if (this.data.length === 0) return;
    
    // Find min/max values
    this.priceInfo.current = this.data[this.data.length - 1].price;
    this.priceInfo.high = Math.max(...this.data.map(d => d.price));
    this.priceInfo.low = Math.min(...this.data.map(d => d.price));
    this.priceInfo.change = this.priceInfo.current - this.priceInfo.open;
    this.priceInfo.changePercent = (this.priceInfo.change / this.priceInfo.open) * 100;
    
    // 根据坐标类型计算价格范围
    this.calculatePriceRange();
    
    // Volume range
    this.volumeData = this.data.map(d => d.volume);
    this.volumeRange.max = Math.max(...this.volumeData);
    this.volumeRange.min = 0;
    
    // Time range
    this.xRange.min = this.data[0].time.getTime();
    this.xRange.max = this.data[this.data.length - 1].time.getTime();
    
    // Update info panel
    this.updateInfoPanel();
  }
  
  // 根据坐标类型计算价格范围
  calculatePriceRange() {
    const coordinateType = this.options.coordinateType;
    
    switch (coordinateType) {
      case 'normal': // 普通坐标 - 根据数据动态调整，带有一定padding
        const priceRange = this.priceInfo.high - this.priceInfo.low;
        const padding = priceRange * 0.1;
        this.yRange.min = this.priceInfo.low - padding;
        this.yRange.max = this.priceInfo.high + padding;
        break;
        
      case 'full': // 满占坐标 - 使用最大和最小值，没有padding
        this.yRange.min = this.priceInfo.low;
        this.yRange.max = this.priceInfo.high;
        break;
        
      case 'limit': // 涨停板坐标 - 基于初始价格或开盘价和涨跌停百分比
        const limitPercent = this.options.limitPercentage / 100;
        // 优先使用initialPrice作为基准价格计算涨跌停，如果未设置则使用开盘价
        const referencePrice = this.options.initialPrice !== null ? this.options.initialPrice : this.priceInfo.open;
        this.yRange.min = referencePrice * (1 - limitPercent);
        this.yRange.max = referencePrice * (1 + limitPercent);
        break;
        
      default:
        // 默认使用普通坐标
        const defaultRange = this.priceInfo.high - this.priceInfo.low;
        const defaultPadding = defaultRange * 0.1;
        this.yRange.min = this.priceInfo.low - defaultPadding;
        this.yRange.max = this.priceInfo.high + defaultPadding;
    }
    
    // 确保最小价格不为负数
    if (this.yRange.min < 0) {
      this.yRange.min = 0;
    }
  }
  
  calculateAverages() {
    if (!this.options.showAverage || this.data.length === 0) {
      this.averageData = [];
      return;
    }
    
    // 重置累计数据
    this.cumulativeVolumeData = [];
    this.cumulativeAmountData = [];
    this.averageData = [];
    
    let totalVolume = 0;
    let totalAmount = 0;
    
    // 计算每个点的累计成交量和成交金额，以及对应的均价
    for (let i = 0; i < this.data.length; i++) {
      const dataPoint = this.data[i];
      const volume = dataPoint.volume;
      const amount = dataPoint.price * volume;
      
      totalVolume += volume;
      totalAmount += amount;
      
      this.cumulativeVolumeData.push(totalVolume);
      this.cumulativeAmountData.push(totalAmount);
      
      // 计算均价 = 累计成交金额 / 累计成交量
      const avgPrice = totalVolume > 0 ? totalAmount / totalVolume : dataPoint.price;
      this.averageData.push(avgPrice);
    }
    
    // 更新当前均价
    if (this.data.length > 0) {
      this.priceInfo.avgPrice = this.averageData[this.averageData.length - 1];
    }
  }
  
  updateInfoPanel() {
    const changeSign = this.priceInfo.change >= 0 ? '+' : '';
    const changeColor = this.priceInfo.change >= 0 ? this.options.colors.upBar : this.options.colors.downBar;
    
    this.infoPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <div>当前价: <span style="font-weight: bold;">${this.priceInfo.current.toFixed(2)}</span></div>
        <div>涨跌幅: <span style="color: ${changeColor}; font-weight: bold;">${changeSign}${this.priceInfo.change.toFixed(2)} (${changeSign}${this.priceInfo.changePercent.toFixed(2)}%)</span></div>
        <div>成交量: ${this.formatNumber(this.data[this.data.length - 1].volume)}</div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <div>开盘价: ${this.priceInfo.open.toFixed(2)}</div>
        <div>均价: <span style="color: ${this.options.colors.average}; font-weight: bold;">${this.priceInfo.avgPrice.toFixed(2)}</span></div>
        <div>最高价: ${this.priceInfo.high.toFixed(2)}</div>
        <div>最低价: ${this.priceInfo.low.toFixed(2)}</div>
      </div>
    `;
  }
  
  // Rendering methods
  render() {
    this.clear();
    this.drawGrid();
    this.drawTimeLabels(); // 绘制垂直网格线
    this.drawPriceChart();
    this.drawVolumeChart();
    this.drawTimeAxis(); // 绘制独立的时间轴
    
    if (this.options.showAverage && this.averageData.length > 0) {
      this.drawAverageLine();
    }
    
    // 绘制十字线
    if (this.options.showCrosshair && this.isMouseOver && this.hoveredDataIndex >= 0) {
      this.drawCrosshair();
    }
  }
  
  clear() {
    this.ctx.fillStyle = this.options.colors.background;
    this.ctx.fillRect(0, 0, this.options.width, this.options.height);
    
    this.volumeCtx.fillStyle = this.options.colors.background;
    this.volumeCtx.fillRect(0, 0, this.options.width, this.volumeHeight);
    
    this.timeAxisCtx.fillStyle = this.options.colors.background;
    this.timeAxisCtx.fillRect(0, 0, this.options.width, this.options.timeAxisHeight);
  }
  
  drawGrid() {
    const priceChartHeight = this.options.height - this.options.padding.top - this.options.padding.bottom;
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    
    // Draw horizontal grid lines for price chart
    this.ctx.strokeStyle = this.options.colors.grid;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([5, 5]);
    
    const priceStep = (this.yRange.max - this.yRange.min) / this.options.gridLines;
    
    for (let i = 0; i <= this.options.gridLines; i++) {
      const price = this.yRange.max - (i * priceStep);
      const y = this.mapPriceToY(price);
      
      this.ctx.beginPath();
      this.ctx.moveTo(this.options.padding.left, y);
      this.ctx.lineTo(this.options.width - this.options.padding.right, y);
      this.ctx.stroke();
      
      // 左侧价格标签
      this.ctx.fillStyle = this.options.colors.text;
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(price.toFixed(2), this.options.padding.left - 5, y);
      
      // 添加右侧价格标签
      if (this.options.showRightPrice) {
        // 计算涨跌幅
        const changePercent = ((price - this.priceInfo.open) / this.priceInfo.open) * 100;
        const changeSign = changePercent >= 0 ? '+' : '';
        const changeText = `${changeSign}${changePercent.toFixed(2)}%`;
        
        // 设置颜色 - 符合同花顺配色方案
        const isPositive = changePercent >= 0;
        this.ctx.fillStyle = isPositive ? this.options.colors.upBar : this.options.colors.downBar;
        
        // 绘制右侧涨跌幅
        this.ctx.textAlign = 'left';
        this.ctx.fillText(changeText, this.options.width - this.options.padding.right + 5, y);
      }
    }
    
    // 涨停板坐标系额外标记：开盘价、涨停价、跌停价
    if (this.options.coordinateType === 'limit') {
      const limitPercent = this.options.limitPercentage / 100;
      const openPrice = this.priceInfo.open;
      const upperLimit = openPrice * (1 + limitPercent);
      const lowerLimit = openPrice * (1 - limitPercent);
      
      // 标记开盘价/参考价 - 虚线
      const openY = this.mapPriceToY(openPrice);
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.colors.text;
      this.ctx.setLineDash([2, 2]);
      this.ctx.moveTo(this.options.padding.left, openY);
      this.ctx.lineTo(this.options.width - this.options.padding.right, openY);
      this.ctx.stroke();
      
      // 在左侧标记参考价文字
      this.ctx.fillStyle = this.options.colors.text;
      this.ctx.textAlign = 'right';
    //   this.ctx.fillText(`参考价 ${openPrice.toFixed(2)}`, this.options.padding.left - 5, openY - 5);
      
      // 标记涨停价 - 红色虚线
      const upperY = this.mapPriceToY(upperLimit);
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.colors.upBar;
      this.ctx.setLineDash([2, 2]);
      this.ctx.moveTo(this.options.padding.left, upperY);
      this.ctx.lineTo(this.options.width - this.options.padding.right, upperY);
      this.ctx.stroke();
      
      // 在左侧标记涨停文字
      this.ctx.fillStyle = this.options.colors.upBar;
      this.ctx.textAlign = 'right';
    //   this.ctx.fillText(`涨停 ${upperLimit.toFixed(2)}`, this.options.padding.left - 5, upperY - 5);
      
      // 标记跌停价 - 绿色虚线
      const lowerY = this.mapPriceToY(lowerLimit);
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.colors.downBar;
      this.ctx.setLineDash([2, 2]);
      this.ctx.moveTo(this.options.padding.left, lowerY);
      this.ctx.lineTo(this.options.width - this.options.padding.right, lowerY);
      this.ctx.stroke();
      
      // 在左侧标记跌停文字
      this.ctx.fillStyle = this.options.colors.downBar;
      this.ctx.textAlign = 'right';
    //   this.ctx.fillText(`跌停 ${lowerLimit.toFixed(2)}`, this.options.padding.left - 5, lowerY + 10);
    }
    
    // Reset line dash
    this.ctx.setLineDash([]);
  }
  
  drawPriceChart() {
    if (this.data.length < 2) return;
    
    // 获取可见的数据点
    const visibleIndices = this.getVisibleDataIndices();
    const firstVisibleIndex = visibleIndices.first;
    const lastVisibleIndex = visibleIndices.last;
    
    this.ctx.strokeStyle = this.options.colors.line;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    
    let started = false;
    
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
      const x = this.getDataPointScreenX(i);
      const y = this.mapPriceToY(this.data[i].price);
      
      if (!started) {
        this.ctx.moveTo(x, y);
        started = true;
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.stroke();
    
    // 绘制价格线下方的区域填充
    if (started) {
      const lastVisibleX = this.getDataPointScreenX(lastVisibleIndex);
      const firstVisibleX = this.getDataPointScreenX(firstVisibleIndex);
      
      this.ctx.lineTo(lastVisibleX, this.mapPriceToY(this.yRange.min));
      this.ctx.lineTo(firstVisibleX, this.mapPriceToY(this.yRange.min));
      this.ctx.closePath();
      
      const gradient = this.ctx.createLinearGradient(0, this.options.padding.top, 0, this.options.height - this.options.padding.bottom);
      gradient.addColorStop(0, 'rgba(54, 162, 235, 0.2)');
      gradient.addColorStop(1, 'rgba(54, 162, 235, 0)');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }
  }
  
  drawAverageLine() {
    if (this.data.length < 2) return;
    
    // 获取可见的数据点
    const visibleIndices = this.getVisibleDataIndices();
    const firstVisibleIndex = visibleIndices.first;
    const lastVisibleIndex = visibleIndices.last;
    
    this.ctx.strokeStyle = this.options.colors.average;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    
    let started = false;
    
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
      if (this.averageData[i] === null) continue;
      
      const x = this.getDataPointScreenX(i);
      const y = this.mapPriceToY(this.averageData[i]);
      
      if (!started) {
        this.ctx.moveTo(x, y);
        started = true;
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.stroke();
  }
  
  drawVolumeChart() {
    if (this.data.length === 0) return;
    
    // 获取可见的数据点
    const visibleIndices = this.getVisibleDataIndices();
    const firstVisibleIndex = visibleIndices.first;
    const lastVisibleIndex = visibleIndices.last;
    
    const barWidth = this.options.barWidth;
    
    // 定义中性柱子颜色（根据主题）
    const neutralColor = this.options.theme === 'dark' ? 'white' : '#D4A017'; // 棕黄色
    
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
      const dataPoint = this.data[i];
      
      // 获取屏幕X坐标
      const x = this.getDataPointScreenX(i) - (barWidth / 2);
      
      // 根据买卖方向确定柱子颜色
      if (dataPoint.direction === 'buy') {
        this.volumeCtx.fillStyle = this.options.colors.upBar; // 买入用红色
      } else if (dataPoint.direction === 'sell') {
        this.volumeCtx.fillStyle = this.options.colors.downBar; // 卖出用绿色
      } else {
        // neutral或未指定，根据主题设置
        this.volumeCtx.fillStyle = neutralColor;
      }
      
      // 计算柱子高度
      const barHeight = this.mapVolumeToHeight(dataPoint.volume);
      const y = this.volumeHeight - barHeight;
      
      // 绘制成交量柱状图
      this.volumeCtx.fillRect(x, y, barWidth, barHeight);
    }
    
    // 成交量刻度显示
    this.volumeCtx.fillStyle = this.options.colors.text;
    this.volumeCtx.font = '10px Arial';
    this.volumeCtx.textAlign = 'left';
    this.volumeCtx.textBaseline = 'middle';
    this.volumeCtx.fillText(
      this.formatNumber(this.volumeRange.max), 
      this.options.width - this.options.padding.right + 5, 
      5
    );
    this.volumeCtx.fillText(
      '0', 
      this.options.width - this.options.padding.right + 5, 
      this.volumeHeight - 5
    );
  }
  
  // 获取可见的数据点索引范围
  getVisibleDataIndices() {
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    const totalWidth = this.getFixedWidthChartWidth();
    
    // 计算可见区域对应的数据点索引
    let firstVisibleIndex = 0;
    let lastVisibleIndex = this.data.length - 1;
    
    if (totalWidth > chartWidth) {
      // 计算当前滚动位置下第一个可见的点
      const barWidthWithSpacing = this.options.barWidth + this.options.barSpacing;
      firstVisibleIndex = Math.floor(this.scrollOffsetX / barWidthWithSpacing);
      
      // 计算可见区域内可显示的数据点数量
      const visiblePointsCount = Math.ceil(chartWidth / barWidthWithSpacing);
      
      // 计算最后一个可见点
      lastVisibleIndex = Math.min(this.data.length - 1, firstVisibleIndex + visiblePointsCount);
      
      // 确保至少有一个点是可见的
      firstVisibleIndex = Math.max(0, firstVisibleIndex);
      lastVisibleIndex = Math.max(firstVisibleIndex, lastVisibleIndex);
    }
    
    return { first: firstVisibleIndex, last: lastVisibleIndex };
  }
  
  // 获取数据点在屏幕上的X坐标
  getDataPointScreenX(index) {
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    const totalWidth = this.getFixedWidthChartWidth();
    
    // 获取数据点的原始X坐标
    const x = this.getFixedWidthXPosition(index);
    
    // 应用滚动偏移
    let screenX = x;
    if (totalWidth > chartWidth) {
      screenX = x - this.scrollOffsetX;
    }
    
    // 加上左侧内边距
    return screenX + this.options.padding.left;
  }
  
  // 计算固定间距情况下的单个数据点X坐标
  getFixedWidthXPosition(index) {
    const barWidth = this.options.barWidth;
    const barSpacing = this.options.barSpacing;
    
    // 每个数据点占据固定宽度
    const pointWidth = barWidth + barSpacing;
    
    // 从左侧开始计算位置
    return index * pointWidth;
  }
  
  // 计算固定间距图表的总宽度
  getFixedWidthChartWidth() {
    const barWidth = this.options.barWidth;
    const barSpacing = this.options.barSpacing;
    const pointWidth = barWidth + barSpacing;
    
    // 添加右侧留白，确保最新数据点不会贴着边界
    return (this.data.length * pointWidth) + this.options.rightOffset;
  }
  
  drawText(text, x, y, options = {}) {
    const ctx = options.ctx || this.ctx;
    ctx.font = `${options.fontSize || 12}px ${options.fontFamily || 'Arial'}`;
    ctx.fillStyle = options.color || this.options.colors.text;
    ctx.textAlign = options.textAlign || 'left';
    ctx.textBaseline = options.textBaseline || 'top';
    ctx.fillText(text, x, y);
  }
  
  // Utility methods
  mapPriceToY(price) {
    const chartHeight = this.options.height - this.options.padding.top - this.options.padding.bottom;
    const priceRange = this.yRange.max - this.yRange.min;
    const ratio = (price - this.yRange.min) / priceRange;
    return this.options.height - this.options.padding.bottom - (ratio * chartHeight);
  }
  
  mapTimeToX(time) {
    const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
    const timeRange = this.xRange.max - this.xRange.min;
    const ratio = (time.getTime() - this.xRange.min) / timeRange;
    return this.options.padding.left + (ratio * chartWidth);
  }
  
  mapVolumeToHeight(volume) {
    const ratio = volume / this.volumeRange.max;
    return ratio * this.volumeHeight;
  }
  
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  formatNumber(num) {
    if (num >= 10000000) {
      return (num / 10000000).toFixed(2) + '千万';
    } else if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'k';
    }
    return num.toFixed(2);
  }
  
  // Public API
  updateOptions(newOptions) {
    // 处理主题切换
    if (newOptions.theme && newOptions.theme !== this.options.theme) {
      this.switchTheme(newOptions.theme);
      delete newOptions.theme; // 已处理主题切换，移除避免重复处理
    }
    
    // 处理特殊选项
    if (newOptions.enableScroll !== undefined && 
        newOptions.enableScroll !== this.options.enableScroll) {
      this.options.enableScroll = newOptions.enableScroll;
      
      // 根据滚动配置更新事件监听
      if (this.options.enableScroll) {
        this.setupScrollEvents();
      } else {
        // 禁用滚动，重置到最新数据
        this.scrollOffsetX = 0;
        this.options.scrollPosition = 1.0;
      }
    }
    
    // 处理信息面板显示设置
    if (newOptions.infoBarEnabled !== undefined &&
        newOptions.infoBarEnabled !== this.options.infoBarEnabled) {
      this.options.infoBarEnabled = newOptions.infoBarEnabled;
      // 更新信息面板显示状态
      this.infoPanel.style.display = this.options.infoBarEnabled ? 'block' : 'none';
    }
    
    // 处理初始价格更新
    if (newOptions.initialPrice !== undefined && 
        newOptions.initialPrice !== this.options.initialPrice) {
      // 使用setInitialPrice方法更新初始价格，它会处理价格范围计算和重绘
      this.setInitialPrice(newOptions.initialPrice);
      delete newOptions.initialPrice; // 已处理，避免重复处理
    }
    
    // 处理坐标类型变更
    if (newOptions.coordinateType !== undefined && 
        newOptions.coordinateType !== this.options.coordinateType) {
      this.options.coordinateType = newOptions.coordinateType;
      
      // 重新计算价格范围
      this.calculatePriceRange();
    }
    
    // 处理涨跌停百分比变更
    if (newOptions.limitPercentage !== undefined && 
        newOptions.limitPercentage !== this.options.limitPercentage) {
      this.options.limitPercentage = newOptions.limitPercentage;
      
      // 如果当前是涨停板坐标，需要重新计算价格范围
      if (this.options.coordinateType === 'limit') {
        this.calculatePriceRange();
      }
    }
    
    // 更新其他选项
    Object.assign(this.options, newOptions);
    this.render();
  }
  
  // Mock data generation for testing
  static generateMockData(numPoints = 100, startTime = new Date(), startPrice = 100) {
    const data = [];
    let price = startPrice;
    let time = new Date(startTime);
    
    for (let i = 0; i < numPoints; i++) {
      // Random price movement
      const change = (Math.random() - 0.5) * 2;
      price = Math.max(1, price + change);
      
      // Random volume
      const volume = Math.floor(Math.random() * 10000) + 1000;
      
      data.push({
        time: new Date(time),
        price,
        volume
      });
      
      // Add seconds
      time = new Date(time.getTime() + 1000);
    }
    
    return data;
  }
  
  // 添加鼠标事件监听
  setupMouseEvents() {
    this.chartContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.chartContainer.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.chartContainer.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    
    // 添加时间轴的点击事件处理
    this.timeAxisCanvas.addEventListener('click', this.handleTimeAxisClick.bind(this));
  }
  
  // 处理鼠标进入
  handleMouseEnter() {
    this.isMouseOver = true;
  }
  
  // 处理鼠标离开
  handleMouseLeave() {
    this.isMouseOver = false;
    this.hideTooltip();
    this.render(); // 重绘清除十字线
  }
  
  // 创建工具提示元素
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'fenshi-tooltip';
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.tooltip.style.color = '#fff';
    this.tooltip.style.padding = '8px 12px';
    this.tooltip.style.borderRadius = '4px';
    this.tooltip.style.fontSize = '12px';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.zIndex = '10';
    this.tooltip.style.display = 'none';
    this.tooltip.style.whiteSpace = 'nowrap';
    this.tooltip.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
    this.tooltip.style.transition = 'transform 0.1s ease-out';
    this.tooltip.style.transformOrigin = 'left center';
    
    this.chartContainer.appendChild(this.tooltip);
  }
  
  // 更新工具提示内容和位置
  updateTooltip() {
    if (this.hoveredDataIndex < 0 || this.hoveredDataIndex >= this.data.length) {
      this.hideTooltip();
      return;
    }
    
    const dataPoint = this.data[this.hoveredDataIndex];
    const avgPrice = this.averageData[this.hoveredDataIndex];
    
    if (!dataPoint) return;
    
    // 计算涨跌和涨跌幅
    const openPrice = this.priceInfo.open;
    const change = dataPoint.price - openPrice;
    const changePercent = (change / openPrice) * 100;
    const changeSign = change >= 0 ? '+' : '';
    
    // 计算总金额（价格 * 成交量）
    const amount = dataPoint.price * dataPoint.volume;
    
    // 更新提示框内容，添加均价信息
    this.tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">${this.formatTime(dataPoint.time)}</div>
      <div>价格: <span style="font-weight: bold;">${dataPoint.price.toFixed(2)}</span></div>
      ${avgPrice !== undefined ? `<div>均价: <span style="color: ${this.options.colors.average}; font-weight: bold;">${avgPrice.toFixed(2)}</span></div>` : ''}
      <div>涨跌: <span style="color: ${change >= 0 ? this.options.colors.upBar : this.options.colors.downBar}; font-weight: bold;">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)</span></div>
      <div>成交量: ${this.formatNumber(dataPoint.volume)}</div>
      <div>金额: ${this.formatNumber(amount)}</div>
    `;
    
    // 更新提示框位置 - 跟随鼠标
    const rect = this.chartContainer.getBoundingClientRect();
    const offsetX = 15; // 鼠标右侧偏移量
    const offsetY = 10; // 鼠标上方偏移量
    
    let tooltipX = this.mousePosition.x + offsetX;
    let tooltipY = this.mousePosition.y - offsetY;
    
    // 确保提示框不超出容器右侧
    const tooltipRect = this.tooltip.getBoundingClientRect();
    if (tooltipX + tooltipRect.width > rect.width) {
      tooltipX = this.mousePosition.x - tooltipRect.width - offsetX;
    }
    
    // 确保提示框不超出容器顶部
    if (tooltipY - tooltipRect.height < 0) {
      tooltipY = this.mousePosition.y + tooltipRect.height + offsetY;
    }
    
    this.tooltip.style.left = `${tooltipX}px`;
    this.tooltip.style.top = `${tooltipY}px`;
    this.tooltip.style.display = 'block';
  }
  
  // 隐藏工具提示
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
  
  // 更新当前悬停的数据点索引
  updateHoveredDataIndex() {
    if (!this.isMouseOver || this.data.length === 0) {
      this.hoveredDataIndex = -1;
      return;
    }
    
    // 鼠标在价格图内
    if (this.mousePosition.y >= 0 && this.mousePosition.y <= this.options.height) {
      const chartWidth = this.options.width - this.options.padding.left - this.options.padding.right;
      
      // 确定可见数据范围
      const visibleIndices = this.getVisibleDataIndices();
      const firstVisibleIndex = visibleIndices.first;
      const lastVisibleIndex = visibleIndices.last;
      
      // 如果鼠标在图表数据区域内
      if (this.mousePosition.x >= this.options.padding.left && 
          this.mousePosition.x <= this.options.width - this.options.padding.right) {
        
        // 获取鼠标相对于图表左边缘的位置
        const mouseX = this.mousePosition.x - this.options.padding.left;
        
        // 计算每个数据点在屏幕上的实际宽度
        const barWidthWithSpacing = this.options.barWidth + this.options.barSpacing;
        const visiblePointsCount = lastVisibleIndex - firstVisibleIndex + 1;
        
        let hoveredIndex = -1;
        
        if (visiblePointsCount <= 1) {
          // 如果只有一个可见数据点
          hoveredIndex = firstVisibleIndex;
        } else {
          // 对于固定宽度模式，直接计算鼠标位置对应的数据点
          const barPositions = [];
          
          // 计算每个可见数据点的屏幕X坐标
          for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
            const x = this.getDataPointScreenX(i) - this.options.padding.left;
            barPositions.push({ index: i, x: x });
          }
          
          // 找到最接近鼠标位置的数据点
          let closestBar = null;
          let minDistance = Number.MAX_VALUE;
          
          for (const bar of barPositions) {
            const distance = Math.abs(bar.x - mouseX);
            if (distance < minDistance) {
              minDistance = distance;
              closestBar = bar;
            }
          }
          
          if (closestBar) {
            hoveredIndex = closestBar.index;
          }
        }
        
        this.hoveredDataIndex = hoveredIndex;
      } else {
        this.hoveredDataIndex = -1;
      }
    } else {
      this.hoveredDataIndex = -1;
    }
  }
  
  // 绘制十字线
  drawCrosshair() {
    if (this.hoveredDataIndex < 0 || this.hoveredDataIndex >= this.data.length) return;
    
    const dataPoint = this.data[this.hoveredDataIndex];
    
    // 获取数据点对应的坐标
    const x = this.getDataPointScreenX(this.hoveredDataIndex);
    const y = this.mapPriceToY(dataPoint.price);
    
    // 绘制垂直线 - 通过价格图和成交量图
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.colors.crosshair;
    this.ctx.setLineDash([1.5, 1.5]);
    this.ctx.lineWidth = 1;
    this.ctx.moveTo(x, this.options.padding.top);
    this.ctx.lineTo(x, this.options.height - this.options.padding.bottom);
    this.ctx.stroke();
    
    this.volumeCtx.beginPath();
    this.volumeCtx.strokeStyle = this.options.colors.crosshair;
    this.volumeCtx.setLineDash([1.5, 1.5]);
    this.volumeCtx.lineWidth = 1;
    this.volumeCtx.moveTo(x, 0);
    this.volumeCtx.lineTo(x, this.volumeHeight);
    this.volumeCtx.stroke();
    
    // 也在时间轴上标记当前位置
    this.timeAxisCtx.beginPath();
    this.timeAxisCtx.strokeStyle = this.options.colors.crosshair;
    this.timeAxisCtx.setLineDash([]);
    this.timeAxisCtx.lineWidth = 1.5;
    this.timeAxisCtx.moveTo(x, 0);
    this.timeAxisCtx.lineTo(x, this.options.timeAxisHeight);
    this.timeAxisCtx.stroke();
    
    // 绘制水平线 - 仅在价格图
    this.ctx.beginPath();
    this.ctx.moveTo(this.options.padding.left, y);
    this.ctx.lineTo(this.options.width - this.options.padding.right, y);
    this.ctx.stroke();
    
    // 重置线条样式
    this.ctx.setLineDash([]);
    this.volumeCtx.setLineDash([]);
    
    // 计算涨跌幅百分比
    const percentChange = ((dataPoint.price - this.priceInfo.open) / this.priceInfo.open) * 100;
    const isUp = percentChange >= 0;
    
    // 根据涨跌确定显示颜色
    const textColor = isUp ? this.options.colors.upBar : this.options.colors.downBar;
    
    // 格式化显示文本
    const priceChangeText = (isUp ? "+" : "") + percentChange.toFixed(2) + "%";
    
    // 绘制价格标签
    this.drawCrosshairLabel(this.ctx, priceChangeText, this.options.width - this.options.padding.right, y, 'price', textColor);
    
    // 绘制时间标签（时间轴上）
    const timeText = this.formatTime(dataPoint.time);
    this.timeAxisCtx.fillStyle = this.options.colors.background;
    this.timeAxisCtx.fillRect(x - 40, 0, 80, this.options.timeAxisHeight);
    this.timeAxisCtx.fillStyle = this.options.colors.text;
    this.timeAxisCtx.font = 'bold 10px Arial';
    this.timeAxisCtx.textAlign = 'center';
    this.timeAxisCtx.textBaseline = 'middle';
    this.timeAxisCtx.fillText(timeText, x, this.options.timeAxisHeight / 2);
    
    // 突出显示当前悬停点
    this.highlightDataPoint(x, y);
  }
  
  // 绘制十字线标签（可复用的方法）
  drawCrosshairLabel(ctx, text, x, y, type, textColor) {
    const textWidth = ctx.measureText(text).width + 10;
    const textHeight = 20;
    
    // 根据标签类型调整位置
    let labelX = x;
    let labelY = y;
    
    if (type === 'price') {
      // 价格标签绘制在右侧
      labelX = x;
      labelY = y - textHeight / 2;
    } else if (type === 'time') {
      // 时间标签绘制在底部并水平居中
      labelX = x - textWidth / 2;
      labelY = y - textHeight / 2;
    }
    
    // 绘制标签背景
    ctx.fillStyle = this.options.colors.background;
    ctx.strokeStyle = this.options.colors.crosshair;
    ctx.fillRect(labelX, labelY, textWidth, textHeight);
    ctx.strokeRect(labelX, labelY, textWidth, textHeight);
    
    // 绘制文本（使用传入的颜色）
    ctx.fillStyle = textColor || this.options.colors.text;
    
    if (type === 'price') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, labelX + 5, y);
    } else if (type === 'time') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }
  }
  
  // 绘制当前悬停点
  highlightDataPoint(x, y) {
    // 绘制外圈
    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fill();
    
    // 绘制内圈
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = 'white';
    this.ctx.fill();
    this.ctx.strokeStyle = this.options.colors.crosshair;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }
  
  // 绘制独立的时间轴
  drawTimeAxis() {
    if (this.data.length === 0) return;
    
    this.timeAxisCtx.fillStyle = this.options.colors.background;
    this.timeAxisCtx.fillRect(0, 0, this.options.width, this.options.timeAxisHeight);
    
    // 计算水平网格线
    this.timeAxisCtx.beginPath();
    this.timeAxisCtx.strokeStyle = this.options.colors.grid;
    this.timeAxisCtx.lineWidth = 0.5;
    this.timeAxisCtx.moveTo(this.options.padding.left, 0);
    this.timeAxisCtx.lineTo(this.options.width - this.options.padding.right, 0);
    this.timeAxisCtx.stroke();
    
    // 获取可见的数据点
    const visibleIndices = this.getVisibleDataIndices();
    const firstVisibleIndex = visibleIndices.first;
    const lastVisibleIndex = visibleIndices.last;
    
    // 计算可见数据点数量
    const visibleDataPoints = lastVisibleIndex - firstVisibleIndex + 1;
    
    // 根据可见柱子数量确定要显示的时间标签数量
    let numLabels;
    
    if (visibleDataPoints <= 40) {
      // 当可见柱子数量小于等于40，只显示最新的一个时间点
      numLabels = 1;
      // 只画最新的时间点
      this.drawTimeLabel(lastVisibleIndex);
      
      // 绘制垂直网格线
      const x = this.getDataPointScreenX(lastVisibleIndex);
      this.timeAxisCtx.beginPath();
      this.timeAxisCtx.strokeStyle = this.options.colors.grid;
      this.timeAxisCtx.setLineDash([5, 5]);
      this.timeAxisCtx.moveTo(x, 0);
      this.timeAxisCtx.lineTo(x, 5);
      this.timeAxisCtx.stroke();
      this.timeAxisCtx.setLineDash([]);
      return;
    } else if (visibleDataPoints > 40 && visibleDataPoints <= 60) {
      // 40-60个柱子显示3个时间标签
      numLabels = 3;
    } else if (visibleDataPoints > 60 && visibleDataPoints <= 90) {
      // 60-90个柱子显示4个时间标签
      numLabels = 4;
    } else {
      // 90个以上柱子显示5个时间标签
      numLabels = 5;
    }
    
    // 计算时间点索引，确保均匀分布
    for (let i = 0; i < numLabels; i++) {
      // 计算均匀分布的索引，确保第一个点是firstVisibleIndex，最后一个点是lastVisibleIndex
      const ratio = i / (numLabels - 1);
      const dataIndex = Math.round(firstVisibleIndex + ratio * (lastVisibleIndex - firstVisibleIndex));
      
      // 绘制时间标签
      this.drawTimeLabel(dataIndex);
      
      // 绘制垂直网格线
      const x = this.getDataPointScreenX(dataIndex);
      this.timeAxisCtx.beginPath();
      this.timeAxisCtx.strokeStyle = this.options.colors.grid;
      this.timeAxisCtx.setLineDash([5, 5]);
      this.timeAxisCtx.moveTo(x, 0);
      this.timeAxisCtx.lineTo(x, 5);
      this.timeAxisCtx.stroke();
      this.timeAxisCtx.setLineDash([]);
    }
  }
  
  // 绘制单个时间标签
  drawTimeLabel(dataIndex) {
    if (dataIndex < 0 || dataIndex >= this.data.length) return;
    
    const time = this.data[dataIndex].time;
    const x = this.getDataPointScreenX(dataIndex);
    
    // 绘制时间标签
    this.timeAxisCtx.fillStyle = this.options.colors.text;
    this.timeAxisCtx.font = '10px Arial';
    this.timeAxisCtx.textAlign = 'center';
    this.timeAxisCtx.textBaseline = 'top';
    
    // 根据时间格式化（可以根据需要添加日期）
    const timeText = this.formatTime(time);
    
    // 检查当前时间是否跨天或是特殊时间点
    const hours = time.getHours();
    const minutes = time.getMinutes();
    
    // 对于特殊时间点（开盘、中午、收盘等），添加更详细的标签
    let additionalText = '';
    // if (hours === 9 && minutes === 30) {
    //   additionalText = '开盘';
    // } else if (hours === 11 && minutes === 30) {
    //   additionalText = '午休';
    // } else if (hours === 13 && minutes === 0) {
    //   additionalText = '开盘';
    // } else if (hours === 15 && minutes === 0) {
    //   additionalText = '收盘';
    // }
    
    if (additionalText) {
      // 绘制两行标签
      this.timeAxisCtx.fillText(timeText, x, 8);
      this.timeAxisCtx.fillText(additionalText, x, 22);
    } else {
      // 只绘制时间
      this.timeAxisCtx.fillText(timeText, x, 15);
    }
  }
  
  // 处理时间轴点击，可以用于跳转到特定时间点
  handleTimeAxisClick(e) {
    if (!this.options.enableScroll) return;
    
    const rect = this.timeAxisCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // 仅处理在有效区域内的点击
    if (x >= this.options.padding.left && x <= this.options.width - this.options.padding.right) {
      // 找到最接近点击位置的数据点
      const visibleIndices = this.getVisibleDataIndices();
      
      // 获取屏幕坐标到数据索引的映射
      let closestIndex = -1;
      let minDistance = Number.MAX_VALUE;
      
      for (let i = visibleIndices.first; i <= visibleIndices.last; i++) {
        const dataX = this.getDataPointScreenX(i);
        const distance = Math.abs(dataX - x);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      
      if (closestIndex >= 0) {
        // 设置十字线位置到点击的时间点
        this.hoveredDataIndex = closestIndex;
        this.render();
        
        if (this.options.tooltipEnabled) {
          this.updateTooltip();
        }
      }
    }
  }
  
  // 修改drawTimeLabels方法，与时间轴标签数量保持一致，只影响垂直网格线的绘制
  drawTimeLabels() {
    if (this.data.length === 0) return;
    
    // 获取可见的数据点
    const visibleIndices = this.getVisibleDataIndices();
    const firstVisibleIndex = visibleIndices.first;
    const lastVisibleIndex = visibleIndices.last;
    
    // 计算可见数据点数量
    const visibleDataPoints = lastVisibleIndex - firstVisibleIndex + 1;
    
    // 根据可见柱子数量确定要显示的垂直网格线数量
    let numGridLines;
    
    if (visibleDataPoints <= 40) {
      // 当可见柱子数量小于等于40，只显示最新的一个垂直线
      numGridLines = 1;
      // 只画最右侧的网格线
      const x = this.getDataPointScreenX(lastVisibleIndex);
      
      // 在价格图上画垂直网格线
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.colors.grid;
      this.ctx.setLineDash([5, 5]);
      this.ctx.moveTo(x, this.options.padding.top);
      this.ctx.lineTo(x, this.options.height - this.options.padding.bottom);
      this.ctx.stroke();
      
      // 在成交量图上画垂直网格线
      this.volumeCtx.beginPath();
      this.volumeCtx.strokeStyle = this.options.colors.grid;
      this.volumeCtx.setLineDash([5, 5]);
      this.volumeCtx.moveTo(x, 0);
      this.volumeCtx.lineTo(x, this.volumeHeight);
      this.volumeCtx.stroke();
      
      // 重置虚线样式，确保不会影响其他绘制
      this.ctx.setLineDash([]);
      this.volumeCtx.setLineDash([]);
      return;
    } 
    else if (visibleDataPoints > 40 && visibleDataPoints <= 60) {
      // 40-60个柱子显示3个网格线
      numGridLines = 3;
    } else if (visibleDataPoints > 60 && visibleDataPoints <= 90) {
      // 60-90个柱子显示4个网格线
      numGridLines = 4;
    } else {
      // 90个以上柱子显示5个网格线
      numGridLines = 5;
    }
    
    // 绘制垂直网格线
    for (let i = 0; i < numGridLines; i++) {
      // 计算均匀分布的索引，确保第一个点是firstVisibleIndex，最后一个点是lastVisibleIndex
      const ratio = i / (numGridLines - 1);
      const dataIndex = Math.round(firstVisibleIndex + ratio * (lastVisibleIndex - firstVisibleIndex));
      const x = this.getDataPointScreenX(dataIndex);
      
      // 在价格图上画垂直网格线
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.colors.grid;
      this.ctx.setLineDash([5, 5]);
      this.ctx.moveTo(x, this.options.padding.top);
      this.ctx.lineTo(x, this.options.height - this.options.padding.bottom);
      this.ctx.stroke();
      
      // 在成交量图上画垂直网格线
      this.volumeCtx.beginPath();
      this.volumeCtx.strokeStyle = this.options.colors.grid;
      this.volumeCtx.setLineDash([5, 5]);
      this.volumeCtx.moveTo(x, 0);
      this.volumeCtx.lineTo(x, this.volumeHeight);
      this.volumeCtx.stroke();
    }
    
    // 重置虚线样式
    this.ctx.setLineDash([]);
    this.volumeCtx.setLineDash([]);
  }
  
  // 设置初始参考价格
  setInitialPrice(price) {
    if (typeof price === 'number' && price > 0) {
      this.options.initialPrice = price;
      this.priceInfo.open = price;
      
      // 如果是涨停板坐标，重新计算价格范围
      if (this.options.coordinateType === 'limit') {
        this.calculatePriceRange();
        this.render();
      }
      
      // 更新信息面板
      this.updateInfoPanel();
      
      return true;
    }
    return false;
  }
}

// If using as ES module
if (typeof exports !== 'undefined') {
  exports.FenshiChart = FenshiChart;
}