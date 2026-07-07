if (window['chartjs-plugin-annotation']) {
    Chart.register(window['chartjs-plugin-annotation']);
};

export class SensorChart {
    constructor(canvasId, chartConfig, colors) {
        this.canvasId = canvasId;
        this.ctx = document.getElementById(this.canvasId).getContext('2d');
        this.chartConfig = chartConfig;
        this.colors = colors
        this.chartInstance = null;
        this.destroyChartFunctionObject = null;
        this.initializeGradient();
        this.createChart();
        this.zoomed = false;
    };
    
    initializeGradient() {
        this.gradients = this.chartConfig.data.datasets.map((_, index) => {
            const gradient = this.ctx.createLinearGradient(0, 0, 0, 400);
            const startColor = this.colors[index % this.colors.length];
            const endColor = startColor.replace('0.6', '0');
            gradient.addColorStop(0, startColor);
            gradient.addColorStop(1, endColor);
            return gradient;
        });
        
        this.chartConfig.data.datasets.forEach((dataset, index) => {
            dataset.backgroundColor = this.gradients[index];
        });
    };
    
    createChart() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
        
        this.chartInstance = new Chart(this.ctx, this.chartConfig);
        this.destroyChartFunctionObject = this.chartInstance.destroy.bind(this.chartInstance);
    };

    updateChart(chartConfig) {
        if (!this.chartInstance) {
            throw new Error("Tried to update a chart without chart instance existing");
        }

        this.chartConfig = chartConfig;
        this.initializeGradient();
        this.chartInstance.data = chartConfig.data;
        this.chartInstance.options = chartConfig.options;
        this.chartInstance.update();
    };
    
    destroy() {
        if (this.destroyChartFunctionObject === null) { 
            throw new Error(message || 'Destroy called without destroy function created');
        }

        console.log('Destroy called from chart object');
        this.destroyChartFunctionObject();
    };
};