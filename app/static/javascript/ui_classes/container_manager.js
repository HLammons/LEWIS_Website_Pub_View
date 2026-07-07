import { EventBus } from "/static/javascript/core/event_bus.js";
import { getSensorTypeUtil } from "/static/javascript/misc/sensor_utils.js";
import { AppStateManager } from "/static/javascript/core/app_state_manager.js";

export class Container_Manager {
    constructor() {
        this.eventBus = new EventBus();
        this.app_state_manager = new AppStateManager();

        this.elements = {
            chartTitle: document.getElementById('chartTitle'),
            table: document.getElementById('sensorDataTable'),
            chart: document.getElementById('a-chart'),
            tableBody: document.querySelector('#sensorDataTable tbody'),
            chartFilterMenu: document.getElementById('filterMenuButton'),
            chartFilterButtons: document.getElementById('filter-buttons'),
            tableFilterMenu: document.getElementById('tableFilterMenuButton'),
            tableFilterButtons: document.getElementById('table-filter-buttons'),
            downloadButton: document.getElementById('downloadButton'),
            durationButtons: document.querySelectorAll('#duration-buttons .dropdown-item')
        };

        //startup tasks
        this.addDropdownListener();
        this.addDownloadListener();
        this.eventBus.on('sensor_id_selected', this.handleIdSelected.bind(this));
        this.eventBus.on('duration_selected', this.handleDurationSelected.bind(this));
        this.eventBus.on('table_csv_created', this.handleCSVDownload.bind(this));
        this.displayWelcomeMessage();
    };

    handleIdSelected(data) {
        this.setChartFilterMenu(data);
        this.setTableFilterMenu(data);
        this.updateChartTitle();
        this.showChart();
    };

    handleDurationSelected(data) {
        this.updateChartTitle();
    };

    setChartFilterMenu(sensorId) {
        this.elements.chartFilterMenu.disabled = false;
        const sensorType = getSensorTypeUtil(sensorId)
        const { chartFilterMenu: chartFilterMenu, chartFilterButtons: chartFilterButtons } = this.elements;
        
        chartFilterButtons.innerHTML = '';
        chartFilterMenu.disabled = false;
        
        const filterOptions = {
            sonar: [
                { text: 'LTTB', value: 'lttb' },
                { text: 'Raw', value: 'raw' }
            ],
            rain: [
                { text: 'Aggregate', value: 'aggregate' },
                { text: 'Raw', value: 'raw' }
            ],
            accel: [
                { text: 'Gs', value: 'Gs' },
                { text: 'M/Ssq', value: 'MSSq' },
                { text: 'Displacement', value: 'Displacement' }
            ]
        };
        const options = filterOptions[sensorType];
        
        if (!options) {
            chartFilterMenu.disabled = true;
            return;
        }
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'dropdown-item';
            button.textContent = option.text;
            button.addEventListener('click', () => {
                this.eventBus.emit('chart_filter_selected', option.value);
            });
            chartFilterButtons.appendChild(button);
        });
    };

    setTableFilterMenu(sensorId) {
        const sensorType = getSensorTypeUtil(sensorId);

        const { tableFilterMenu: tableFilterMenu, tableFilterButtons: tableFilterButtons } = this.elements;
        
        tableFilterButtons.innerHTML = '';
        tableFilterMenu.disabled = false;
        
        const filterOptions = {
            sonar: [
                { text: 'Default', value: 'default' }
            ],
            rain: [
                { text: 'Default', value: 'default' }
            ],
            accel: [
                { text: 'Default', value: 'default' },
                { text: 'Peak-to-peak', value: 'p2p' }
            ]
        };
        const options = filterOptions[sensorType];
        
        if (!options) {
            tableFilterMenu.disabled = true;
            return;
        }

        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'dropdown-item';
            button.textContent = option.text;
            button.addEventListener('click', () => {
                this.eventBus.emit('table_filter_selected', option.value);
            });
            tableFilterButtons.appendChild(button);
        });
    };
                
    displayWelcomeMessage() {
        const { chartTitle, table, chart, tableBody, chartFilterMenu, tableFilterMenu, downloadButton } = this.elements;
        
        chartTitle.textContent = "Welcome\nSelect a sensor to get started";
        table.style.display = "none";
        chart.style.display = "none";
        tableBody.innerHTML = '';
        chartFilterMenu.enabled = false;
        tableFilterMenu.style.display = 'none';
        downloadButton.style.display = 'none';
    };

    showChart() {
        const { chart, table, chartFilterMenu, tableFilterMenu } = this.elements;
        chart.style.display = "block";
        table.style.display = "table";
        chartFilterMenu.style.display = 'block';
        tableFilterMenu.style.display = 'block';
        downloadButton.style.display = 'block';
    };

    addDownloadListener() {
        this.elements.downloadButton.addEventListener('click', () => {
            this.eventBus.emit('download_clicked', null);
        });
    };

    handleCSVDownload(emitVal) {
        const state = this.app_state_manager.getAppState();
        const csvString = emitVal;
            
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const filename = `${state.sensorId}_${state.duration}.csv`;
        
        this.downloadFile(url, filename);
        URL.revokeObjectURL(url);        
    }

    downloadFile(url, filename) {
        const anchor = document.createElement('a');
        anchor.style.display = 'none';
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    };

    addDropdownListener() {
        const dropdownItems = document.querySelectorAll('#duration-buttons .dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (event) => {
                const selectedText = event.target.textContent;
                switch (selectedText) {
                    case "Last 12 Minutes":
                        this.eventBus.emit('duration_selected', '-12m');
                        break;
                    case "Last Hour":
                        this.eventBus.emit('duration_selected', '-1h');
                        break;
                    case "Last Day":
                        this.eventBus.emit('duration_selected', '-1d');
                        break;
                    case "Last Week":
                        this.eventBus.emit('duration_selected', '-1w');
                        break;
                    case "Last Month":
                        this.eventBus.emit('duration_selected', '-1mo');
                        break;
                    case "Lifetime":
                        this.eventBus.emit('duration_selected', '-10y');
                        break;
                    default:
                        this.eventBus.emit('duration_selected', '');
                        break;
                }
            });
        });
    };

    updateChartTitle() {
        const currentAppState = this.app_state_manager.getAppState();
        let sensorName = currentAppState.sensorId;
        let duration = currentAppState.duration;
        if (currentAppState.sensorId === null) sensorName = '(select a sensor)';
        if (currentAppState.duration === null) duration = '(select a duration)';
        this.elements.chartTitle.textContent = `${sensorName} readings ${duration}`;
    };
};