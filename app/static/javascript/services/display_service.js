export class DisplayService {

    selectDisplayStrategy(duration, sensorType) {
        //temp placeholder for querying other sensor types
        if (sensorType !== 'accel') return null;

        const rainThreshold = 1000 * 60 * 60 * 24 * 30;
        const sonarThreshold = 1000 * 60 * 60 * 24 * 7;
        const accelThreshold = 1000 * 12;
        const eightDays = 1000 * 60 * 60 * 24 * 8;
        let threshold = null;
        if (sensorType === 'rain') threshold = rainThreshold;
        if (sensorType === 'sonar') threshold = sonarThreshold;
        if (sensorType === 'accel') threshold = accelThreshold;
        if (duration <= threshold) return null;
        if (duration <= eightDays) return 'day';
        return 'multiday';
    };

    generateDisplayData(displayStrategy, metaData, datasets) {
        if (!displayStrategy) return datasets;

        let strategy;
        // if (displayStrategy === 'day') strategy = new DisplayStrategy();
        if (displayStrategy === 'day') return datasets;
        else if (displayStrategy === 'multiday') strategy = new DisplayMultiDayStrategy();
        else throw new Error(`[DISPLAY SERVICE][generate display data] invalid strategy: ${displayStrategy}`);

        return strategy.apply(metaData, datasets);
    };

    generateAnnotationMetaData(metaData) {
        let annotationMetaData = {
            boxStartStops: null,
            labels: null
        }

        if (metaData.dayStartStopMillis.length > 14) {
            annotationMetaData.boxStartStops = metaData.weekStartStopMillis;
            annotationMetaData.labels = this.generateWeekLabels(metaData);
        } else {
            annotationMetaData.boxStartStops = metaData.dayStartStopMillis;
            annotationMetaData.labels = this.generateDayLabels(metaData);
        }

        return annotationMetaData;
    };

    generateDayLabels(metaData) {
        let labels = [];
        for (let i = 0; i < metaData.dayEventCounts.length; i++) {
            labels.push(`events: ${metaData.dayEventCounts[i]}`)
        }
        return labels;
    };

    generateWeekLabels(metaData) {
        let labels = [];
        for (let i = 0; i < metaData.weekEventCounts.length; i++) {
            labels.push(`events: ${metaData.weekEventCounts[i]}`)
        }
        return labels;    
    };
};

class DisplayStrategy {
    apply(metaData, datasets) {
        throw new Error('Cannot use base class to generate display');
    };
};

class DisplayDayStrategy extends DisplayStrategy {
    apply(metaData, datasets) {
        return datasets
    //     const { eventIndexes } = metaData;
    //     return datasets.map((dataset) => {
    //         const { xValues, yValues, ...rest } = dataset;
    //         const sampledX = [];
    //         const sampledY = [];
    //         for (const [eventStart, eventEnd] of eventIndexes) {
    //             const startIdx = xValues.findIndex((x) => x >= eventStart);
    //             if (startIdx === -1) continue;
    //             let endIdx = startIdx;
    //             while (endIdx + 1 < xValues.length && xValues[endIdx + 1] <= eventEnd) {
    //                 endIdx++;
    //             }
    //             if (startIdx === endIdx) {
    //                 sampledX.push(xValues[startIdx]);
    //                 sampledY.push(yValues[startIdx]);
    //                 continue;
    //             }
    //             let minIdx = startIdx;
    //             let maxIdx = startIdx;
    //             for (let i = startIdx + 1; i <= endIdx; i++) {
    //                 if (yValues[i] < yValues[minIdx]) minIdx = i;
    //                 if (yValues[i] > yValues[maxIdx]) maxIdx = i;
    //             }
    //             sampledX.push(xValues[startIdx], xValues[minIdx], xValues[maxIdx], xValues[endIdx]);
    //             sampledY.push(yValues[startIdx], yValues[minIdx], yValues[maxIdx], yValues[endIdx]);
    //         }
    //         return { ...rest, xValues: sampledX, yValues: sampledY };
    //     });
    };
};

class DisplayMultiDayStrategy extends DisplayStrategy {
    oldApply(metaData, datasets) {
        const { dayEventCounts, dayStartStopMillis } = metaData;

        const sampledX = [];
        const sampledY = [];

        for (let i = 0; i < dayEventCounts.length; i++) {
            const midpoint = (dayStartStopMillis[i].start + dayStartStopMillis[i].end) / 2;
            sampledX.push(new Date(midpoint).toISOString());
            sampledY.push(dayEventCounts[i]);
        }

        return [{
            ...datasets[0],
            label: datasets[0].label,
            xValues: sampledX,
            yValues: sampledY,
            pointRadius: 8,
            pointHoverRadius: 12
        }];
    };

    apply(metaData, datasets) {
        const sampledX = [];
        const sampledY = [];
        const outOfPlane = datasets[2];
        for (let i = 0; i < metaData.numDays; i++) {
            const { startIdx, endIdx } = metaData.dayDatasetIndexes[i];
            
            if (startIdx === -1) continue;
            const dayYValues = outOfPlane.yValues.slice(startIdx, endIdx + 1);
            const midpoint = (metaData.dayStartStopMillis[i].start + metaData.dayStartStopMillis[i].end) / 2;
            const max = Math.max(...dayYValues);
            const min = Math.min(...dayYValues);
            sampledX.push(new Date(midpoint).toISOString());
            sampledY.push(Math.abs(max - min));
        }
        return [{
            ...datasets[2],
            label: datasets[2].label,
            xValues: sampledX,
            yValues: sampledY,
            pointRadius: 8,
            pointHoverRadius: 12
        }];
    };
};

