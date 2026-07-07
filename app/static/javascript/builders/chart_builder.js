import { SensorChart } from "/static/javascript/builders/sensor_chart.js";
import { EventBus } from "/static/javascript/core/event_bus.js"

export class Chart_Builder {
    constructor() {
        this.eventBus = new EventBus();
        this.chartInstance = null;
        this.colors = [
            'rgba(211, 47, 47, 0.6)',
            'rgba(30, 136, 229, 0.6)',
            'rgba(67, 160, 71, 0.6)',
            'rgba(255, 143, 0, 0.6)',
            'rgba(142, 36, 170, 0.6)',
            'rgba(0, 172, 193, 0.6)',
            'rgba(251, 192, 45, 0.6)',
            'rgba(216, 27, 96, 0.6)',
            'rgba(94, 53, 177, 0.6)',
            'rgba(0, 137, 123, 0.6)'
        ];

        this.eventBus = new EventBus();
    };

    createChartConfig(xAxisLabel, yAxisLabel, annotationsData, datasets) {
        if (!datasets || datasets.length === 0) {
            throw new Error("Datasets must be set before creating chart config");
        }

        const datasetsConfig = datasets.map((dataset, index) => {
            const startColor = this.colors[index % this.colors.length].replace('0.6', '1');

            return {
                label: dataset.label,
                borderColor: startColor,              
                pointBackgroundColor: startColor,    
                data: dataset.xValues.map((x, i) => ({ x, y: dataset.yValues[i] })),
                fill: 'start',
                hidden: dataset.hidden || false,
                pointRadius: dataset.pointRadius || 3,
                pointHoverRadius: dataset.pointHoverRadius || 4,
            };
        });

        let config = {
            type: 'line',
            data: {
                datasets: datasetsConfig
            },
            options: {
                interaction: {
                    mode: 'nearest'
                },
                onClick: (e, activeElements, chart) => {
                    if (activeElements.length > 0) {
                        const datasetIndex = activeElements[0].datasetIndex;
                        const index = activeElements[0].index;
                        
                        const clickedPoint = chart.data.datasets[datasetIndex].data[index];
                        const clickedTimestamp = clickedPoint.x;
                        
                        this.handleClick(clickedTimestamp);
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            usePointStyle: true,
                            color: this.colors.map(color => color.replace('0.6', '1'))
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                millisecond: 'HH:mm:ss:S',
                                hour: 'ddd HH:mm'
                            }
                        },
                        ticks: {
                            maxTicksLimit: 20
                        },
                        title: {
                            display: true,
                            text: xAxisLabel
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yAxisLabel
                        }
                    }
                },
                animation: false
            }
        };

        const annotations = this.generateAnnotationsFromMetadata(annotationsData.boxStartStops, annotationsData.labels);
        config.options.plugins.annotation = {
            annotations: annotations
        };

        return config;
    };

    generateAnnotationsFromMetadata(boxStartStops, labels) {
        const annotations = {};

        const numStartStops = boxStartStops.length;
        for (let i = 0; i < numStartStops; i++) {
            const isGrey = i % 2 === 0;
            
            annotations[`annotation${i}`] = {
                type: 'box',
                xMin: boxStartStops[i].start,
                xMax: boxStartStops[i].end,
                backgroundColor: isGrey ? 'rgba(128, 128, 128, 0.2)' : 'rgba(211, 47, 47, 0.2)',
                borderWidth: 0,
                label: {
                    display: true,
                    content: labels[i],
                    position: 'end',
                    xAdjust: 0,
                    font: {
                        size: 10
                    }
                }
            };
        }
        
        return annotations;
    };

    handleClick(timestamp) {
        console.log(`[CHART BUILDER][handle click] val emitted: ${timestamp}`)
        this.eventBus.emit('chart_clicked', timestamp);
    };

    buildChart(canvasId, labels, annotationsData, datasets) {
        if (!canvasId) {
            throw new Error('canvasId is required');
        }

        const chartConfig = this.createChartConfig(labels.xAxisLabel, labels.yAxisLabel, annotationsData, datasets);

        if (!this.chartInstance) {
            this.chartInstance = new SensorChart(
                canvasId, 
                chartConfig,
                this.colors
            );
        } else {
            this.chartInstance.updateChart(chartConfig);
        }

        const bounds = [
            datasets[0].xValues[0],
            datasets[0].xValues[datasets[0].xValues.length - 1]
        ];

        return bounds;
    };
};