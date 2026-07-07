
export class DataCacheService {
    constructor() {
        this.currentData = null;
        this.currentChartFilteredData = null;
        this.currentTableFilteredData = null;
    };

    passNewData(datasets) {
        //when we are passed new datasets we do the iteration for days weeks months and events
        this.currentData = this.validateDatasetsLengths(datasets)
        this.currentChartFilteredData = null;
        this.currentTableFilteredData = null;
    };

    passNewChartFilteredData(dataSets) {
        this.validateDatasetsLengths(dataSets);
        this.currentChartFilteredData = dataSets;
        this.currentTableFilteredData = null;
    };

    passNewTableFilteredData(dataSets) {
        this.currentTableFilteredData = dataSets;
    };

    validateDatasetsLengths(datasets) {
        console.log(`[DATA CACHE][validate] datasets:`);
        console.log(datasets);
        if (!datasets || !Array.isArray(datasets)) {
            console.warn("[DATA CACHE SERVICE][validateDatasetsLength] No valid datasets provided");
            return [];
        }
        
        datasets.forEach(dataset => {
            if (dataset.xValues.length !== dataset.yValues.length) {
                throw new Error(`[DATA CACHE SERVICE][validateDatasetsLength] X and Y values have different lengths for dataset: ${dataset.label}`);
            }
        });
        return datasets;
    };

    getCurrentData() {
        return this.currentData
    };

    getCurrentChartFilteredData() {
        if (this.currentChartFilteredData === null) throw new Error('[DATA CACHE SERVICE][get current chart data] chart data null');
        return this.currentChartFilteredData;
    };

    getCurrentTableFilteredData() {
        if (this.currentTableFilteredData === null) throw new Error('[DATA CACHE SERVICE][get current table data] table data null');
        return this.currentTableFilteredData;
    };
};