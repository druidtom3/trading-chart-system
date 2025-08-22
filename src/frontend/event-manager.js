// 檔名：event-manager.js - 事件管理器

class EventManager {
    constructor(chartManager, dataManager, playbackManager) {
        this.chartManager = chartManager;
        this.dataManager = dataManager;
        this.playbackManager = playbackManager;
        
        this.currentTimeframe = 'M15';
        this.showFVG = true;
        
        this.bindAllEvents();
    }

    /**
     * 綁定所有事件
     */
    bindAllEvents() {
        this.bindButtonEvents();
        this.bindTimeframeEvents();
        this.bindIndicatorEvents();
        this.bindCrosshairEvents();
    }

    /**
     * 綁定按鈕事件
     */
    bindButtonEvents() {
        // 隨機資料按鈕
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.playbackManager.stopPlayback();
                this.dataManager.clearCache();
                this.loadRandomData();
            });
        }

        // 重置縮放按鈕
        const resetBtn = document.getElementById('reset-zoom-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.chartManager.resetZoom();
            });
        }

        // FVG 開關按鈕已移除，改用左側面板控制

        // 畫線按鈕
        const drawLineBtn = document.getElementById('draw-line-btn');
        if (drawLineBtn) {
            drawLineBtn.addEventListener('click', () => {
                const isDrawing = this.chartManager.toggleDrawLineMode();
                drawLineBtn.textContent = isDrawing ? '✏️ 畫線中' : '畫線';
                drawLineBtn.classList.toggle('active', isDrawing);
            });
        }

        // 清除線按鈕
        const clearLinesBtn = document.getElementById('clear-lines-btn');
        if (clearLinesBtn) {
            clearLinesBtn.addEventListener('click', () => {
                if (this.chartManager.manualLines.length > 0) {
                    if (confirm(`確定要清除 ${this.chartManager.manualLines.length} 條手動線嗎？`)) {
                        this.chartManager.clearManualLines();
                    }
                } else {
                    alert('沒有手動線可以清除');
                }
            });
        }

        // 指標選單按鈕
        const indicatorsMenuBtn = document.getElementById('indicators-menu-btn');
        if (indicatorsMenuBtn) {
            indicatorsMenuBtn.addEventListener('click', () => {
                this.openIndicatorsSidebar();
            });
        }

        // 關閉側邊欄按鈕
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => {
                this.closeIndicatorsSidebar();
            });
        }

        // 背景遮罩點擊關閉
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeIndicatorsSidebar();
            });
        }
    }

    /**
     * 綁定時間框架切換事件
     */
    bindTimeframeEvents() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timeframe = e.target.dataset.timeframe;
                this.switchTimeframe(timeframe);
            });
        });
    }

    /**
     * 綁定指標相關事件
     */
    bindIndicatorEvents() {
        // FVG 勾選框
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            fvgCheckbox.checked = this.showFVG;
            this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
            
            fvgCheckbox.addEventListener('change', (e) => {
                this.showFVG = e.target.checked;
                this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
                
                const fvgRenderer = this.chartManager.getFVGRenderer();
                if (fvgRenderer) {
                    fvgRenderer.setVisible(this.showFVG);
                    
                    if (this.showFVG) {
                        this.drawFVGs();
                    }
                } else {
                    console.error('❌ FVG渲染器未初始化（checkbox事件）');
                }
            });
        }

        // 其他指標的勾選框
        const indicators = ['sr', 'sma', 'ema', 'rsi', 'macd'];
        indicators.forEach(indicator => {
            const checkbox = document.getElementById(`${indicator}-checkbox`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.updateIndicatorItemState(`${indicator}-checkbox`, e.target.checked);
                    // 這裡將來會調用對應的指標管理器方法
                });
            }
        });

        // 綁定設定按鈕事件
        const settingsBtns = document.querySelectorAll('.settings-btn');
        settingsBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const indicator = btn.dataset.indicator;
                this.openIndicatorSettings(indicator);
            });
        });
    }

    /**
     * 綁定十字線移動事件
     */
    bindCrosshairEvents() {
        this.chartManager.chart.subscribeCrosshairMove((param) => {
            this.handleCrosshairMove(param);
        });
    }

    /**
     * 載入隨機數據
     */
    async loadRandomData() {
        try {
            const data = await this.dataManager.loadRandomData(this.currentTimeframe);
            this.updateChart(data);
        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * 載入特定數據
     */
    async loadSpecificData(date, timeframe) {
        try {
            const data = await this.dataManager.loadSpecificData(date, timeframe);
            this.updateChart(data);
        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * 更新圖表
     */
    updateChart(data) {
        // 更新圖表數據
        const candleData = this.chartManager.updateData(data.data);
        
        // 更新UI顯示
        this.dataManager.updateUI(data);
        
        // 繪製FVG
        this.drawFVGs();
        
        // 重置縮放
        setTimeout(() => {
            this.chartManager.resetZoom();
        }, 100);
        
        // 更新分頁狀態
        this.updateTimeframeTabs(data.timeframe);
    }

    /**
     * 繪製FVG
     */
    drawFVGs() {
        const currentData = this.dataManager.getCurrentData();
        const fvgRenderer = this.chartManager.getFVGRenderer();
        
        console.log('繪製FVG - 當前數據:', currentData?.fvgs?.length || 0, '個FVG');
        console.log('FVG顯示狀態:', this.showFVG);
        console.log('FVG渲染器存在:', !!fvgRenderer);
        
        if (!fvgRenderer) {
            console.error('❌ FVG渲染器未初始化');
            return;
        }
        
        if (currentData && currentData.fvgs && this.showFVG) {
            console.log('開始繪製FVG...');
            fvgRenderer.render(currentData.fvgs, this.currentTimeframe);
        } else {
            console.log('清除FVG顯示');
            fvgRenderer.clearAll();
        }
    }

    /**
     * 切換時間框架
     */
    switchTimeframe(timeframe) {
        if (timeframe === this.currentTimeframe) {
            return;
        }

        this.updateTimeframeTabs(timeframe);
        this.currentTimeframe = timeframe;

        // 通知播放管理器
        this.playbackManager.switchTimeframe(timeframe);

        if (this.playbackManager.isPlaying) {
            this.playbackManager.redrawTimeframe(timeframe);
        } else {
            // 沒有播放時，載入該時間框架的資料
            const currentData = this.dataManager.getCurrentData();
            if (currentData) {
                this.loadSpecificData(currentData.date, timeframe);
            }
        }

        // 重新繪製手動線
        setTimeout(() => {
            this.chartManager.redrawManualLines();
        }, 100);
    }

    /**
     * 更新時間框架標籤狀態
     */
    updateTimeframeTabs(timeframe) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
        });
    }

    /**
     * 切換FVG顯示
     */
    toggleFVG() {
        this.showFVG = !this.showFVG;
        
        // 同步更新側邊欄的勾選框
        const fvgCheckbox = document.getElementById('fvg-checkbox');
        if (fvgCheckbox) {
            fvgCheckbox.checked = this.showFVG;
            this.updateIndicatorItemState('fvg-checkbox', this.showFVG);
        }
        
        // 按鈕已移除，只需同步側邊欄即可

        // 更新FVG顯示
        const fvgRenderer = this.chartManager.getFVGRenderer();
        if (fvgRenderer) {
            fvgRenderer.setVisible(this.showFVG);
            
            if (this.showFVG) {
                this.drawFVGs();
            }
        } else {
            console.error('❌ FVG渲染器未初始化（toggleFVG）');
        }
    }

    /**
     * 處理十字線移動
     */
    handleCrosshairMove(param) {
        const hoverInfo = document.getElementById('hover-data');
        if (!hoverInfo) return;
        
        if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
            hoverInfo.textContent = '將滑鼠移至圖表查看詳細資料';
            return;
        }
        
        const data = param.seriesData.get(this.chartManager.candlestickSeries);
        
        if (data) {
            const date = new Date(param.time * 1000);
            const timeStr = this.formatDateTime(date);
            
            hoverInfo.textContent = 
                `時間: ${timeStr} | O: ${data.open.toFixed(2)} | H: ${data.high.toFixed(2)} | ` +
                `L: ${data.low.toFixed(2)} | C: ${data.close.toFixed(2)}`;
        }
    }

    /**
     * 打開指標側邊欄
     */
    openIndicatorsSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        }
    }

    /**
     * 關閉指標側邊欄
     */
    closeIndicatorsSidebar() {
        const sidebar = document.getElementById('indicators-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    }

    /**
     * 更新指標項目的視覺狀態
     */
    updateIndicatorItemState(checkboxId, isChecked) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            const indicatorItem = checkbox.closest('.indicator-item');
            if (indicatorItem) {
                indicatorItem.classList.toggle('checked', isChecked);
            }
        }
    }

    /**
     * 打開指標設定面板
     */
    openIndicatorSettings(indicator) {
        switch(indicator) {
            case 'fvg':
                alert('FVG 設定功能開發中\n將來可以調整:\n- 最大存活期\n- 方向連續性要求');
                break;
            case 'sma':
                alert('SMA 設定功能開發中\n將來可以調整:\n- 週期長度\n- 線條顏色\n- 線條寬度');
                break;
            default:
                alert(`${indicator.toUpperCase()} 設定功能開發中`);
        }
    }

    /**
     * 格式化日期時間
     */
    formatDateTime(date) {
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    /**
     * 獲取當前狀態
     */
    getCurrentState() {
        return {
            currentTimeframe: this.currentTimeframe,
            showFVG: this.showFVG,
            playbackState: this.playbackManager.getPlaybackState()
        };
    }
}

// 暴露到全局範圍
window.EventManager = EventManager;