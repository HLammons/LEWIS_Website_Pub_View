import { Chart_Builder } from "/static/javascript/builders/chart_builder.js";
import { EventBus } from "/static/javascript/core/event_bus.js";
import { DataFetchService } from "../services/data_fetch_service.js";
import { AppStateManager } from "/static/javascript/core/app_state_manager.js";
import { FilterService } from "../services/filter_service.js";
import { DataCacheService } from "../services/data_cache_service.js";
import { getSensorTimeGapUtil, getSensorTypeUtil } from "../misc/sensor_utils.js";
import { TableBuilder } from "/static/javascript/builders/table_builder.js"
import { AnalysisService } from "../services/analysis_service.js";
import { DisplayService } from "../services/display_service.js";

//NOTE: all services should be pure and stateless, meaning there should never be any branching logic inside of services.
//all branching should be in data director.
//services should not be called anywhere else in the codebase

export class DataDirector {
    constructor() {
        //core
        this.eventBus = new EventBus();
        this.appStateManager = new AppStateManager();
        //services
        this.fetchService = new DataFetchService();
        this.analysisService = new AnalysisService();
        this.filterService = new FilterService();
        this.dataCache = new DataCacheService();
        this.displayService = new DisplayService();
        //builders
        this.chartBuilder = new Chart_Builder(this);
        this.tableBuilder = new TableBuilder();

        this.eventBus.on('state_updated', this.rebuildFromStage.bind(this));
        this.eventBus.on('chart_clicked', this.handleChartClick.bind(this));
        this.eventBus.on('download_clicked', this.handleDownloadClicked.bind(this));
    };
 
    async rebuildFromStage(stage) {
        //the break in duration can cause this to go from one worker to another which can potentially cause multiple concurrent rebuilds at once.
        //the rebuild id prevents this
        this.rebuildId = (this.rebuildId || 0) + 1;
        const thisRebuildId = this.rebuildId;
        const state = this.appStateManager.getAppState();
        const sensorType = getSensorTypeUtil(state.sensorId);
        const sensorTimeGap = getSensorTimeGapUtil(sensorType);

        switch (stage) {
            case 'settings':
                //in case duration we can simply update the zoom bounds and then break;
                //this will trigger the rebuild from stage zoom
                const durationBounds = this.getBoundsFromDuration(state.duration);
                this.eventBus.emit('zoom_bounds_changed', durationBounds);
                break;

            case 'zoom':
                const zoomStart = performance.now();
                const dataSet = await this.fetchService.getSensorData(state.sensorId, state.zoom_bounds, state.upperbound, state.lowerbound, state.chart_filter_strat);
                if (thisRebuildId !== this.rebuildId) return;
                this.dataCache.passNewData(dataSet);
                const zoomStop = performance.now();
                console.log(`[TIMING] zoom query stage: ${(zoomStop - zoomStart).toFixed(3)}ms`);      

            case 'display':
                //BECAUSE WE DO NOT STORE SLICED DATA WE NEED TO MAKE SURE THAT CASE DOWNSAMPLE
                //IS NEVER CALLED BY ITSELF, this means app_state should NEVER emit downsample from state updated
                const displayStart = performance.now()              
                const currentData = this.dataCache.getCurrentData();
                const currentMetaData = this.analysisService.generateMetaData(currentData, sensorTimeGap);
                const duration = this.analysisService.getDurationOfDatasets(currentData);

                const displayStrategy = this.displayService.selectDisplayStrategy(duration, sensorType);
                const displayData = this.displayService.generateDisplayData(displayStrategy, currentMetaData, currentData);
                const annotationsMetaData = this.displayService.generateAnnotationMetaData(currentMetaData);
                const displayStop = performance.now();
                console.log(`[TIMING] display stage: ${(displayStop - displayStart).toFixed(3)}ms`);
                
                case 'build':
                const buildStart = performance.now()
                this.updateChartWithNewData(sensorType, state.chart_filter_strat, displayData, annotationsMetaData);
                this.updateTableWithNewData(sensorType, state.table_filter_strat, currentData);
                const buildStop = performance.now();
                console.log(`[TIMING] build stage: ${(buildStop - buildStart).toFixed(3)}ms`);    
                break;
            default:
                throw new Error(`[DATA DIRECTOR][rebuild from stage] passed invalid stage ${stage}`)
        }
    };

    handleChartClick(emitVal) {
        const state = this.appStateManager.getAppState();
        const sensorType = getSensorTypeUtil(state.sensorId);
        const sensorTimeGap = getSensorTimeGapUtil(sensorType);
        let currentData = this.dataCache.getCurrentData();
        
        const currentMetaData = this.analysisService.generateMetaData(currentData, sensorTimeGap);
        console.log(currentMetaData);
        const currentZoomLevel = this.analysisService.detectCurrentZoomLevel(currentMetaData);

        let bounds = null;
        switch (currentZoomLevel) {
            case null:
                bounds = this.analysisService.getDayDurationIndexes(emitVal, currentData, sensorTimeGap);
                break;
            case 'day':
                console.log(`emitVal: ${emitVal}, sensorTimeGap: ${sensorTimeGap}`);
                console.log(currentData);
                if (state.sensorType === 'accel') {
                    bounds = this.analysisService.getEventBoundsAccel(emitVal, currentData, sensorTimeGap);
                } else {
                    bounds = this.analysisService.getEventDurationIndexes(emitVal, currentData, sensorTimeGap);
                }
                break;
            case 'event':
                bounds = this.getBoundsFromDuration(state.duration);
                break;
            default:
                throw new Error('[DATA DIRECTOR][handle chart click] invalid zoom level from detectCurrentZoomLevel');
        }

        console.log(`[DATA DIRECTOR][handle chart click] zoom bounds to emit: ${bounds}`)
        this.eventBus.emit('zoom_bounds_changed', bounds);
    };

    updateChartWithNewData(sensorType, chartFilterString, chartData, annotationsMetaData) {
        const chartLabels = this.analysisService.getLabelsForChart(sensorType, chartFilterString);
        this.chartBuilder.buildChart('a-chart', chartLabels, annotationsMetaData, chartData);
    };

    updateTableWithNewData(sensorType, tableFilterString, chartData) {
        const tableLabels = this.analysisService.getLabelsForTable(sensorType, tableFilterString);
        this.dataCache.passNewTableFilteredData(this.filterService.filterData(tableFilterString, chartData));
        this.tableBuilder.buildTable(tableLabels, this.dataCache.getCurrentTableFilteredData());
    };

    handleDownloadClicked(emitVal) {
        const state = this.appStateManager.getAppState();
        const labels = this.analysisService.getLabelsForTable(state.sensorType, state.table_filter_strat);
        const csvString = this.tableBuilder.generateCSV(labels, this.dataCache.getCurrentTableFilteredData());
        this.eventBus.emit('table_csv_created', csvString);
    };

    getBoundsFromDuration(durationString) {
        const now = new Date();
        const end = now.toISOString();
        let startDate;

        switch(durationString) {
            case '-12m':
                startDate = new Date();
                startDate.setMinutes(startDate.getMinutes() - 12);
                break;
            case '-1h':
                startDate = new Date();
                startDate.setHours(startDate.getHours() - 1);
                break;
            case '-1d':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case '-1w':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
                break;
            case '-1mo':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                startDate.setHours(0, 0, 0, 0);
                break;
            case '-10y':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 10);
                startDate.setHours(0, 0, 0, 0);
                break;
        }

        return [startDate.toISOString(), end];
    };
};