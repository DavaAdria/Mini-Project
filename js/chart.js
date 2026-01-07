class ChartManager {
    constructor() {
        this.charts = {};
        this.chartColors = {
            elevation: '#3498db',      // Blue
            temperature: '#e74c3c',    // Red
            salinity: '#9b59b6',       // Purple
            tds: '#f39c12',           // Orange
            conductivity: '#27ae60'    // Green
        };
        this.initializeCharts();
    }

    initializeCharts() {
        // Elevation Chart
        this.charts.elevation = new Chart(
            document.getElementById('elevationChart'),
            this.getChartConfig('line', 'Elevasi (m)', this.chartColors.elevation)
        );

        // Temperature Chart
        this.charts.temperature = new Chart(
            document.getElementById('temperatureChart'),
            this.getChartConfig('line', 'Temperatur (°C)', this.chartColors.temperature)
        );

        // Salinity Chart
        this.charts.salinity = new Chart(
            document.getElementById('salinityChart'),
            this.getChartConfig('line', 'Salinitas (ppt)', this.chartColors.salinity)
        );

        // TDS Chart
        this.charts.tds = new Chart(
            document.getElementById('tdsChart'),
            this.getChartConfig('line', 'TDS (ppm)', this.chartColors.tds)
        );

        // Conductivity Chart
        this.charts.conductivity = new Chart(
            document.getElementById('conductivityChart'),
            this.getChartConfig('line', 'EC (µS/cm)', this.chartColors.conductivity)
        );
    }

    getChartConfig(type, label, color) {
        return {
            type: type,
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: this.hexToRgba(color, 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    pointBackgroundColor: color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Waktu',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: label,
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        beginAtZero: false
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: color,
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                return new Date(context[0].label).toLocaleString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            },
                            label: function(context) {
                                let value = context.parsed.y;
                                if (value !== null && !isNaN(value)) {
                                    return `${context.dataset.label}: ${value.toFixed(2)}`;
                                }
                                return `${context.dataset.label}: No data`;
                            }
                        }
                    }
                }
            }
        };
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    updateChart(chartName, data, labelField = 'created_at', valueField = 'field1') {
        const chart = this.charts[chartName];
        if (!chart || !data || !data.feeds) {
            console.warn(`Cannot update chart ${chartName}:`, { chart: !!chart, data: !!data, feeds: data?.feeds });
            return;
        }

        try {
            const labels = [];
            const values = [];

            data.feeds.forEach(feed => {
                if (feed && feed[labelField]) {
                    const date = new Date(feed[labelField]);
                    const label = date.toLocaleString('id-ID', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let value = null;
                    if (feed[valueField] !== null && feed[valueField] !== undefined) {
                        const parsedValue = parseFloat(feed[valueField]);
                        if (!isNaN(parsedValue)) {
                            value = parsedValue;
                        }
                    }

                    labels.push(label);
                    values.push(value);
                }
            });

            chart.data.labels = labels;
            chart.data.datasets[0].data = values;
            chart.update('none'); // Update without animation for better performance
        } catch (error) {
            console.error(`Error updating chart ${chartName}:`, error);
        }
    }

    // Specific update methods for each chart
    updateElevation(data) {
        this.updateChart('elevation', data, 'created_at', 'field1');
    }

    updateTemperature(data) {
        this.updateChart('temperature', data, 'created_at', 'field1');
    }

    updateSalinity(data) {
        this.updateChart('salinity', data, 'created_at', 'field1');
    }

    updateTDS(data) {
        this.updateChart('tds', data, 'created_at', 'field2');
    }

    updateConductivity(data) {
        this.updateChart('conductivity', data, 'created_at', 'field3');
    }

    // Clear all charts
    clearAllCharts() {
        Object.keys(this.charts).forEach(chartName => {
            const chart = this.charts[chartName];
            if (chart) {
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
                chart.update('none');
            }
        });
    }

    // Destroy all charts (for cleanup)
    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartName => {
            const chart = this.charts[chartName];
            if (chart) {
                chart.destroy();
                delete this.charts[chartName];
            }
        });
    }

    // Get chart statistics
    getChartStats(chartName) {
        const chart = this.charts[chartName];
        if (!chart || !chart.data.datasets[0].data.length) {
            return null;
        }

        const data = chart.data.datasets[0].data.filter(val => val !== null);
        if (data.length === 0) return null;

        return {
            count: data.length,
            min: Math.min(...data),
            max: Math.max(...data),
            avg: data.reduce((sum, val) => sum + val, 0) / data.length,
            latest: data[data.length - 1]
        };
    }
}