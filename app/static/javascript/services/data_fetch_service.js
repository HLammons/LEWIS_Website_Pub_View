export class DataFetchService {

        async getSensorData(appStateSensorId, appStateBounds, appStateUpperBound, appStateLowerBound, appStateFilter) {
        if (!appStateSensorId) {
            throw new Error("[DATA FETCH SERVICE][get sensor data] Cannot fetch data: sensor ID missing");
        }

        const apiUrl = `/query?sensor=${encodeURIComponent(appStateSensorId)}` +
            (appStateBounds[0] ? `&start=${appStateBounds[0]}` : "") +
            (appStateBounds[1] ? `&end=${appStateBounds[1]}` : "") +
            (appStateLowerBound !== undefined ? `&lowerBound=${appStateLowerBound}` : "") +
            (appStateUpperBound !== undefined ? `&upperBound=${appStateUpperBound}` : "") +
            (appStateFilter !== undefined ? `&filter=${appStateFilter}` : "");

        console.log(`[DATA FETCH SERVICE][get data] fetching: ${apiUrl}`)
        const fetchStart = performance.now();
        const response = await fetch(apiUrl);
        const fetchEnd = performance.now();
        console.log(`[TIMING] Network request: ${(fetchEnd - fetchStart).toFixed(3)}ms`);       

        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const sensorData = proto.SensorData.deserializeBinary(bytes);
         
        const mtTimeZone = 'America/Denver';
        const processedData = {};
        
        const fieldsMap = sensorData.getFieldsMap(); 
        fieldsMap.forEach((timeSeries, fieldName) => {
            const dataPoints = timeSeries.getDataPointsList();
            
            // const xValues = dataPoints.map(point =>
            //     moment(point.getTimestamp()).tz(mtTimeZone).format('YYYY-MM-DDTHH:mm:ss.SSS')
            // );
            // const yValues = dataPoints.map(point => point.getValue());

            const xValues = dataPoints.map(point => point.getTimestamp());
            const yValues = dataPoints.map(point => point.getValue());
            
            processedData[fieldName] = { xValues, yValues };
        });
        
        let formattedDatasets = Object.keys(processedData)
            .filter(field => field.split('_')[0] !== 'gyro')
            .map(field => ({
                label: field,
                xValues: processedData[field].xValues,
                yValues: processedData[field].yValues,
                ...(field === 'charge' && { hidden: true })
            }));
        
        formattedDatasets.forEach(dataset => {
            if (dataset.xValues.length !== dataset.yValues.length) {
                throw new Error(`X and Y vals must have same length`);
            }
        });
        
        return formattedDatasets;
    };
};