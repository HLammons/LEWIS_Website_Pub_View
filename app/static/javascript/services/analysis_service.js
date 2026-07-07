
export class AnalysisService {
    constructor() {}

    generateMetaData(datasets, sensorTimeGap) {
        //this is only here so the shape of metaData is obvious
        let metaData = {
            weekStartStopMillis: [],
            weekEventCounts: [],
            numDays: null,
            dayDatasetIndexes: [],
            dayStartStopIndexes: [],
            dayEventCounts: [],
            eventIndexes: []
        };

        let daysMetadata = this.calculateDayBoundaries(datasets[0].xValues, sensorTimeGap);
        let weeksMetaData = this.calculateWeekBoundaries(daysMetadata.dayStartStopMillis, daysMetadata.dayEventCounts);

        metaData = {
            ...metaData,
            weekStartStopMillis: weeksMetaData.weekStartStops,
            weekEventCounts: weeksMetaData.weekEventCounts,
            numDays: daysMetadata.numDays,
            dayDatasetIndexes: daysMetadata.dayDatasetIndexes,
            dayStartStopMillis: daysMetadata.dayStartStopMillis,
            dayEventCounts: daysMetadata.dayEventCounts,
            eventIndexes: daysMetadata.eventIndexes
        };

        return Object.freeze(metaData);
    };

    calculateDayBoundaries(timestamps, sensorTimeGap) {
        const dayDatasetIndexes = [];
        const dayStartStopMillis = [];
        const dayEventCounts = [];
        const eventIndexes = [];

        let dayStart = new Date(timestamps[0]);
        dayStart.setHours(0, 0, 0, 0);
        let dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        let dayStartIdx = 0;
        let eventStartIdx = 0;
        let eventsThisDay = 1;
        let dayCount = 0;

        const flushEvent = (endIdx) => {
            eventIndexes.push([timestamps[eventStartIdx], timestamps[endIdx]]);
        };

        const flushDay = (endIdx) => {
            flushEvent(endIdx);
            dayDatasetIndexes.push({ startIdx: dayStartIdx, endIdx });
            
            const clampedStart = dayCount === 0 
                ? Math.max(dayStart.getTime(), new Date(timestamps[0]).getTime())
                : dayStart.getTime();
            const clampedEnd = endIdx === timestamps.length - 1
                ? Math.min(dayEnd.getTime(), new Date(timestamps[timestamps.length - 1]).getTime())
                : dayEnd.getTime();
            
            dayStartStopMillis.push({ start: clampedStart, end: clampedEnd });
            dayEventCounts.push(eventsThisDay);
        };

        for (let i = 1; i < timestamps.length; i++) {
            const t = new Date(timestamps[i]).getTime();
            const isNewDay = t >= dayEnd.getTime();
            const isNewEvent = !isNewDay && 
                (new Date(timestamps[i]) - new Date(timestamps[i - 1]) > sensorTimeGap);

            if (isNewDay) {
                flushDay(i - 1);

                dayStart = new Date(dayEnd);
                dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                while (t >= dayEnd.getTime()) {
                    dayStartStopMillis.push({ start: dayStart.getTime(), end: dayEnd.getTime() });
                    dayDatasetIndexes.push({ startIdx: -1, endIdx: -1 });
                    dayEventCounts.push(0);
                    dayCount++;
                    dayStart = new Date(dayEnd);
                    dayEnd = new Date(dayStart);
                    dayEnd.setDate(dayEnd.getDate() + 1);
                }

                dayStartIdx = i;
                eventStartIdx = i;
                eventsThisDay = 1;
                dayCount++;
            } else if (isNewEvent) {
                flushEvent(i - 1);
                eventStartIdx = i;
                eventsThisDay++;
            }
        }

        flushDay(timestamps.length - 1);
        dayCount++;

        return { numDays: dayCount, dayDatasetIndexes, dayStartStopMillis, dayEventCounts, eventIndexes };
    };

    calculateWeekBoundaries(dayStartStops, dayEventCounts) {
        const weekStartStops = [];
        const weekEventCounts = [];
        let firstDate = dayStartStops[0].start;
        let weekEventTotal = 0;
        
        for (let i = 0; i < dayStartStops.length; i++) {
            const currentDate = dayStartStops[i].start;
            if (i > 0 && !this.sameISOWeek(new Date(firstDate), new Date(currentDate))) {
                weekStartStops.push({ start: firstDate, end: dayStartStops[i - 1].end });
                weekEventCounts.push(weekEventTotal);
                firstDate = currentDate;
                weekEventTotal = 0;
            }
            weekEventTotal += dayEventCounts[i];
        }
        weekStartStops.push({ start: firstDate, end: dayStartStops[dayStartStops.length - 1].end });
        weekEventCounts.push(weekEventTotal);
        
        return { weekStartStops, weekEventCounts };
    };

    getISOWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    sameISOWeek(d1, d2) {
        return this.getISOWeek(d1) === this.getISOWeek(d2)
            && d1.getFullYear() === d2.getFullYear();
    };

    getEventDurationIndexes(timestamp, datasets, sensorTimeGap) {
        const clickedDataset = datasets[0];
        let index = clickedDataset.xValues.findIndex(x => x === timestamp);
        
        if (index === -1) {
            throw new Error('[ANALYSIS SERVICE][getEventDurationIndexes] timestamp not found in dataset');
        }
        
        let left = index;
        let right = index;
        
        while (left > 0) {
            const gap = new Date(clickedDataset.xValues[left]) - new Date(clickedDataset.xValues[left - 1]);
            if (gap < sensorTimeGap) {
                left--;
            } else {
                break;
            }
        }


        
        while (right < clickedDataset.xValues.length - 1) {
            const gap = new Date(clickedDataset.xValues[right + 1]) - new Date(clickedDataset.xValues[right]);
            if (gap < sensorTimeGap) {
                right++;
            } else {
                break;
            }
        }
        
        return [clickedDataset.xValues[left], clickedDataset.xValues[right]];
    };

    getDayDurationIndexes(timestamp, datasets, sensorTimeGap) {
        const date = new Date(timestamp);
        
        const startDate = new Date(timestamp);
        startDate.setHours(0, 0, 0, 0);
        const startISO = startDate.toISOString();
        
        const endDate = new Date(timestamp);
        endDate.setHours(23, 59, 59, 999);
        const endISO = endDate.toISOString();
        
        return [startISO, endISO];
    };

    detectCurrentZoomLevel(metaData) {
        const totalEvents = metaData.dayEventCounts.reduce((sum, count) => sum + count, 0);
        if (totalEvents < 2) {
            return 'event';
        } else if (metaData.numDays > 1) {
            return null;
        } else {
            return 'day';
        }
    };

    getLabelsForChart(sensorType, filterType) {
        let yAxisLabel;
        
        switch (sensorType) {
            case 'sonar':
                yAxisLabel = 'Sonar Reading in cm';
                break;
            case 'rain':
                yAxisLabel = 'Rain Depth in inches';
                break;
            case 'accel':
                if (filterType === 'Gs') yAxisLabel = 'Acceleration in Gs';
                else if (filterType === 'MSSq') yAxisLabel = 'Acceleration in m/s²';
                else if (filterType === 'Displacement') yAxisLabel = 'Displacement mm';
                else yAxisLabel = 'Raw acceleration values';
                break;
            default:
                console.warn(`Unknown sensor type: ${sensorType}, using default label`);
                yAxisLabel = 'Sensor Reading';
        }
        
        return {
            xAxisLabel: 'Time',
            yAxisLabel: yAxisLabel
        };
    };

    getLabelsForTable(sensorType, filterType) {
        let labels;
        
        switch (sensorType) {
            case 'sonar':
                labels = ['Timestamp', 'Charge (%)', 'Distance (cm)'];
                break;
            case 'rain':
                labels = ['Timestamp', 'Charge (%)', 'Accumulation (in)'];
                break;
            case 'accel':
                if (filterType === 'p2p') {
                    labels = ['Event Timestamp', 'Largest P2P X', 'Largest P2P Y', 'Largest P2P Z'];
                } else {
                    labels = ['Timestamp', 'accel_x', 'accel_y', 'accel_z'];
                }
                break;
            default:
                throw new Error('[DataDirector][GetLabelsForTable] somehow the sensortype was not detected');
                break;
        }
        
        return labels;
    };

    getDurationOfDatasets(datasets) {
        const start = datasets[0].xValues[0];
        const end = datasets[0].xValues[datasets[0].xValues.length - 1];
        const duration = new Date(end) - new Date(start);
        return duration;
    };

    getEventBoundsAccel(emitVal, currentData, sensorTimeGap) {
        console.log(`emitVal in getEventBoundsAccel: ${emitVal}`);
        const emitDate = new Date(emitVal);
        const startISO = new Date(new Date(emitDate).setSeconds(emitDate.getSeconds() - 10)).toISOString();
        const endISO = new Date(new Date(emitDate).setSeconds(emitDate.getSeconds() + 5)).toISOString();
        return [startISO, endISO];
    };
};

// {
//   "numWeeks": null,
//   "numDays": 5,
//   "weekStartStopMillis": [
//     { "start": 1699920000000, "end": 1700438400000 }
//   ],
//   "weekEventCounts": [7],
//   "dayStartStopMillis": [
//     { "start": 1699920000000, "end": 1700006400000 },
//     { "start": 1700006400000, "end": 1700092800000 },
//     { "start": 1700092800000, "end": 1700179200000 },
//     { "start": 1700179200000, "end": 1700265600000 },
//     { "start": 1700265600000, "end": 1700438400000 }
//   ],
//   "dayEventCounts": [3, 0, 2, 1, 1],
//   "dayDatasetIndexes": [
//     { "startIdx": 0,  "endIdx": 41  },
//     { "startIdx": -1, "endIdx": -1  },
//     { "startIdx": 42, "endIdx": 78  },
//     { "startIdx": 79, "endIdx": 95  },
//     { "startIdx": 96, "endIdx": 120 }
//   ],
//   "eventIndexes": [
//     [1699920000000, 1699935600000],
//     [1699941000000, 1699956000000],
//     [1699970000000, 1699985000000],
//     [1700100000000, 1700115000000],
//     [1700130000000, 1700145000000],
//     [1700185000000, 1700196000000],
//     [1700270000000, 1700290000000]
//   ]
// }