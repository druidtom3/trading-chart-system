// 檔名：indicator_manager.js

/**
 * 前端指標管理器
 * 負責統一管理所有技術指標的顯示、隱藏、配置和渲染
 */
class FrontendIndicatorManager {
    constructor(chartApp) {
        this.chartApp = chartApp;
        this.chart = chartApp.chart;
        this.indicators = new Map(); // 指標實例集合
        this.renderers = new Map();  // 渲染器集合
        this.uiElements = new Map(); // UI 元素集合
        
        // 初始化渲染器
        this.initializeRenderers();
        
        // 指標配置
        this.configs = new Map();
    }
    
    /**
     * 初始化渲染器
     */
    initializeRenderers() {
        // 註冊各種類型的渲染器
        this.renderers.set('areas', new AreaRenderer(this.chart));
        this.renderers.set('lines', new LineRenderer(this.chart));
        this.renderers.set('markers', new MarkerRenderer(this.chart));
    }
    
    /**
     * 註冊指標
     */
    registerIndicator(config) {
        const indicator = new FrontendIndicator(config);
        this.indicators.set(config.name, indicator);
        this.configs.set(config.name, config);
        
        // 創建UI控制元素
        this.createIndicatorUI(config);
        
        console.log(`指標已註冊: ${config.name}`);
    }
    
    /**
     * 創建指標UI控制元素
     */
    createIndicatorUI(config) {
        const controlsContainer = document.querySelector('.indicator-controls') || 
                                this.createControlsContainer();
        
        // 創建指標按鈕
        const button = document.createElement('button');
        button.id = `${config.name.toLowerCase()}-toggle-btn`;
        button.className = `btn btn-indicator ${config.enabled ? 'active' : ''}`;
        button.textContent = `${config.name} ${config.enabled ? '開' : '關'}`;
        
        // 綁定事件
        button.addEventListener('click', () => {
            this.toggleIndicator(config.name);
        });
        
        controlsContainer.appendChild(button);
        this.uiElements.set(config.name, { button });
    }
    
    /**
     * 創建控制容器
     */
    createControlsContainer() {
        const existingContainer = document.querySelector('.action-buttons');
        
        // 在現有按鈕後添加指標控制區域
        const container = document.createElement('div');
        container.className = 'indicator-controls';
        container.style.marginLeft = '20px';
        
        existingContainer.parentNode.insertBefore(container, existingContainer.nextSibling);
        return container;
    }
    
    /**
     * 切換指標開關
     */
    async toggleIndicator(name) {
        const indicator = this.indicators.get(name);
        const uiElement = this.uiElements.get(name);
        
        if (!indicator || !uiElement) return;
        
        indicator.enabled = !indicator.enabled;
        
        // 更新UI
        const button = uiElement.button;
        if (indicator.enabled) {
            button.textContent = `${name} 開`;
            button.classList.add('active');
            
            // 載入並顯示指標
            await this.loadAndRenderIndicator(name);
        } else {
            button.textContent = `${name} 關`;
            button.classList.remove('active');
            
            // 隱藏指標
            this.hideIndicator(name);
        }
        
        console.log(`指標 ${name}: ${indicator.enabled ? '開啟' : '關閉'}`);
    }
    
    /**
     * 載入並渲染指標
     */
    async loadAndRenderIndicator(name) {
        try {
            // 從後端獲取指標數據
            const data = await this.fetchIndicatorData(name);
            
            if (data && data.length > 0) {
                // 渲染指標
                this.renderIndicator(name, data);
            }
        } catch (error) {
            console.error(`載入指標 ${name} 失敗:`, error);
        }
    }
    
    /**
     * 從後端獲取指標數據
     */
    async fetchIndicatorData(name) {
        const currentData = this.chartApp.currentData;
        if (!currentData) return [];
        
        const url = `/api/indicators/${name}/${currentData.date}/${this.chartApp.currentTimeframe}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    }
    
    /**
     * 渲染指標
     */
    renderIndicator(name, data) {
        const config = this.configs.get(name);
        if (!config || !config.renderConfig) return;
        
        const renderType = config.renderConfig.type;
        const renderer = this.renderers.get(renderType);
        
        if (renderer) {
            renderer.render(name, data, config.renderConfig);
        } else {
            console.error(`找不到渲染器: ${renderType}`);
        }
    }
    
    /**
     * 隱藏指標
     */
    hideIndicator(name) {
        const config = this.configs.get(name);
        if (!config || !config.renderConfig) return;
        
        const renderType = config.renderConfig.type;
        const renderer = this.renderers.get(renderType);
        
        if (renderer) {
            renderer.clear(name);
        }
    }
    
    /**
     * 更新所有啟用的指標
     */
    async updateAllIndicators() {
        const enabledIndicators = Array.from(this.indicators.entries())
            .filter(([name, indicator]) => indicator.enabled)
            .map(([name]) => name);
            
        for (const name of enabledIndicators) {
            await this.loadAndRenderIndicator(name);
        }
    }
    
    /**
     * 清除所有指標
     */
    clearAllIndicators() {
        for (const [name] of this.indicators) {
            this.hideIndicator(name);
        }
    }
    
    /**
     * 獲取指標列表
     */
    getIndicatorList() {
        return Array.from(this.indicators.entries()).map(([name, indicator]) => ({
            name,
            enabled: indicator.enabled,
            config: this.configs.get(name)
        }));
    }
}

/**
 * 前端指標基礎類別
 */
class FrontendIndicator {
    constructor(config) {
        this.name = config.name;
        this.enabled = config.enabled || false;
        this.visible = config.visible || true;
        this.config = config;
    }
}