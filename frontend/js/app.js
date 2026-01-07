class KarimunJawaMonitor {
    constructor() {
        this.chartManager = new ChartManager();

        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this.apiBaseUrl = isLocal ? "http://localhost:3000/api" : "/api";

        this.refreshInterval = null;
        this.lastUpdateTime = null;
        this.isLoading = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
        this.showConnectionStatus('connecting');
    }

    async fetchWithTimeout(url, ms = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    async loadInitialData() {
        try {
            this.showConnectionStatus('connecting');
            await this.loadDashboardData(100);
            this.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showConnectionStatus('disconnected');
            this.showError('Gagal memuat data awal. Mencoba lagi...');
            this.scheduleRetry();
        }
    }

    async loadDashboardData(results = 100) {
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/dashboard/${results}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();

            if (result.success && result.data) {
                this.updateCurrentValues(result.data.latest);
                this.updateCharts(result.data.history);
                this.updateLastUpdateTime();
                this.lastUpdateTime = Date.now();
                return result.data;
            } else {
                throw new Error(result.error || 'Invalid response format');
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    async loadCurrentData() {
        try {
            const response = await this.fetchWithTimeout(`${this.apiBaseUrl}/latest`, 10000);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();

            if (result.success && result.data) {
                this.updateCurrentValues(result.data);
                this.updateLastUpdateTime();
                this.lastUpdateTime = Date.now();
                return result.data;
            } else {
                throw new Error(result.error || 'Invalid response format');
            }
        } catch (error) {
            console.error('Error loading current data:', error);
            throw error;
        }
    }

    async loadHistoricalData(results = 100) {
        try {
            this.showLoading(true);
            
            const [elevationResponse, temperatureResponse, ecResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/history/elevation/${results}`),
                fetch(`${this.apiBaseUrl}/history/temperature/${results}`),
                fetch(`${this.apiBaseUrl}/history/ec/${results}`)
            ]);

            const [elevationResult, temperatureResult, ecResult] = await Promise.all([
                elevationResponse.json(),
                temperatureResponse.json(),
                ecResponse.json()
            ]);

            if (elevationResult.success && elevationResult.data) {
                this.chartManager.updateElevation(elevationResult.data);
            }

            if (temperatureResult.success && temperatureResult.data) {
                this.chartManager.updateTemperature(temperatureResult.data);
            }

            if (ecResult.success && ecResult.data) {
                this.chartManager.updateSalinity(ecResult.data);
                this.chartManager.updateTDS(ecResult.data);
                this.chartManager.updateConductivity(ecResult.data);
            }

            this.showLoading(false);
        } catch (error) {
            this.showLoading(false);
            console.error('Error loading historical data:', error);
            this.showError('Gagal memuat data historis');
        }
    }

    updateCurrentValues(data) {
        // Update elevation
        if (data.elevation && data.elevation.field1 !== null) {
            const elevation = parseFloat(data.elevation.field1);
            document.getElementById('currentElevation').textContent = 
                isNaN(elevation) ? '-' : elevation.toFixed(2);
        } else {
            document.getElementById('currentElevation').textContent = '-';
        }

        // Update temperature
        if (data.temperature && data.temperature.field1 !== null) {
            const temperature = parseFloat(data.temperature.field1);
            document.getElementById('currentTemp').textContent = 
                isNaN(temperature) ? '-' : temperature.toFixed(1);
        } else {
            document.getElementById('currentTemp').textContent = '-';
        }

        // Update EC data (salinitas, TDS, conductivity)
        if (data.ec) {
            // Salinity (Field 1)
            if (data.ec.field1 !== null) {
                const salinity = parseFloat(data.ec.field1);
                document.getElementById('currentSalinity').textContent = 
                    isNaN(salinity) ? '-' : salinity.toFixed(1);
            } else {
                document.getElementById('currentSalinity').textContent = '-';
            }

            // TDS (Field 2)
            if (data.ec.field2 !== null) {
                const tds = parseFloat(data.ec.field2);
                document.getElementById('currentTDS').textContent = 
                    isNaN(tds) ? '-' : tds.toFixed(0);
            } else {
                document.getElementById('currentTDS').textContent = '-';
            }

            // Conductivity (Field 3)
            if (data.ec.field3 !== null) {
                const conductivity = parseFloat(data.ec.field3);
                document.getElementById('currentConductivity').textContent = 
                    isNaN(conductivity) ? '-' : conductivity.toFixed(1);
            } else {
                document.getElementById('currentConductivity').textContent = '-';
            }
        } else {
            document.getElementById('currentSalinity').textContent = '-';
            document.getElementById('currentTDS').textContent = '-';
            document.getElementById('currentConductivity').textContent = '-';
        }
    }

    updateCharts(historyData) {
        if (historyData.elevation) {
            this.chartManager.updateElevation(historyData.elevation);
        }
        
        if (historyData.temperature) {
            this.chartManager.updateTemperature(historyData.temperature);
        }
        
        if (historyData.ec) {
            this.chartManager.updateSalinity(historyData.ec);
            this.chartManager.updateTDS(historyData.ec);
            this.chartManager.updateConductivity(historyData.ec);
        }
    }

    updateLastUpdateTime() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            now.toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
    }

    async refreshAllData() {
        if (this.isLoading) return;
        
        const refreshBtn = document.getElementById('refreshBtn');
        const originalText = refreshBtn.textContent;
        
        refreshBtn.textContent = '🔄 Memuat...';
        refreshBtn.disabled = true;
        this.isLoading = true;

        try {
            const timeRange = parseInt(document.getElementById('timeRange').value);
            await this.loadDashboardData(timeRange);
            this.showConnectionStatus('connected');
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showConnectionStatus('disconnected');
            this.showError('Gagal memperbarui data: ' + error.message);
        } finally {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
            this.isLoading = false;
        }
    }

    startAutoRefresh() {
        // Clear existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh every 2 minutes for current data
        this.refreshInterval = setInterval(async () => {
            if (!this.isLoading && document.visibilityState === 'visible') {
                try {
                    await this.loadCurrentData();
                    this.showConnectionStatus('connected');
                    this.reconnectAttempts = 0;
                } catch (error) {
                    console.error('Auto refresh failed:', error);
                    this.showConnectionStatus('disconnected');
                    this.scheduleRetry();
                }
            }
        }, 2 * 60 * 1000); // 2 minutes

        // Refresh charts every 10 minutes
        setInterval(async () => {
            if (!this.isLoading && document.visibilityState === 'visible') {
                try {
                    const timeRange = parseInt(document.getElementById('timeRange').value);
                    await this.loadHistoricalData(timeRange);
                } catch (error) {
                    console.error('Chart refresh failed:', error);
                }
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    scheduleRetry() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const retryDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
            
            setTimeout(() => {
                this.loadCurrentData().catch(() => {
                    this.scheduleRetry();
                });
            }, retryDelay);
        }
    }

    showLoading(show = true) {
        const loadingElements = document.querySelectorAll('.loading-indicator');
        loadingElements.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    }

    showConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        const statusConfig = {
            connected: { text: '🟢 Terhubung', class: 'status-connected' },
            connecting: { text: '🟡 Menghubungkan...', class: 'status-connecting' },
            disconnected: { text: '🔴 Terputus', class: 'status-disconnected' }
        };

        const config = statusConfig[status] || statusConfig.disconnected;
        statusElement.textContent = config.text;
        statusElement.className = `connection-status ${config.class}`;
    }

    showError(message, duration = 5000) {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.error-message');
        existingErrors.forEach(el => el.remove());

        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <span class="error-text">⚠️ ${message}</span>
            <button class="error-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Insert after header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', errorDiv);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.remove();
                }
            }, duration);
        }
    }

    showSuccess(message, duration = 3000) {
        // Remove existing success messages
        const existingSuccess = document.querySelectorAll('.success-message');
        existingSuccess.forEach(el => el.remove());

        // Create success message element
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <span class="success-text">✅ ${message}</span>
            <button class="success-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Insert after header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', successDiv);
        
        // Auto remove after duration
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, duration);
    }

    // Get system health status
    async getSystemHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Health check failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Export data to CSV
    exportToCSV() {
        try {
            const stats = {
                elevation: this.chartManager.getChartStats('elevation'),
                temperature: this.chartManager.getChartStats('temperature'),
                salinity: this.chartManager.getChartStats('salinity'),
                tds: this.chartManager.getChartStats('tds'),
                conductivity: this.chartManager.getChartStats('conductivity')
            };

            let csvContent = "Parameter,Count,Min,Max,Average,Latest\n";
            
            Object.keys(stats).forEach(key => {
                const stat = stats[key];
                if (stat) {
                    csvContent += `${key},${stat.count},${stat.min.toFixed(2)},${stat.max.toFixed(2)},${stat.avg.toFixed(2)},${stat.latest.toFixed(2)}\n`;
                }
            });

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `karimun-jawa-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showSuccess('Data berhasil diekspor ke CSV');
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Gagal mengekspor data');
        }
    }

    // Clean up resources
    destroy() {
        this.stopAutoRefresh();
        this.chartManager.destroyAllCharts();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const loadingHTML = '<div class="loading-indicator" style="display: none;"><div class="spinner"></div><p>Memuat data...</p></div>';
    document.body.insertAdjacentHTML('beforeend', loadingHTML);

    window.monitor = new KarimunJawaMonitor();

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            window.monitor.exportToCSV();
        });
    }

    window.addEventListener('beforeunload', () => {
        if (window.monitor) {
            window.monitor.destroy();
        }
    });
});