//LTTB algo modified from:
//  Author: Svein Steinarsson
//  https://github.com/sveinn-steinarsson/flot-downsample/blob/master/jquery.flot.downsample.js

export class FilterService {

    filterData(selectedFilter, data) {
        return this.setFilterStrategy(selectedFilter).apply(data);
    };

    setFilterStrategy(filterStrat) {
        if (filterStrat === 'raw') filterStrat = new NoChartFilterStrategy();
        else if (filterStrat === 'lttb') filterStrat = new LTTBFilterStrategy();
        else if (filterStrat === 'aggregate') filterStrat = new AggregateFilterStrategy();
        else if (filterStrat === 'Gs') filterStrat = new AccelGsFilterStrategy();
        else if (filterStrat === 'MSSq') filterStrat = new AccelMSSqFilterStrategy();
        else if (filterStrat === 'Displacement') filterStrat = new AccelDisplacementFilterStrategy();
        else if (filterStrat === 'default') filterStrat = new NoTableFilterStrategy();
        else if (filterStrat === 'p2p') filterStrat = new AccelP2PTableFilterStrategy();
        else throw new Error('[FILTER SERVICE][set filter strategy] was not passed valid filter name');
        return filterStrat;
    };
};

class ChartFilterStrategy {

    static getStrategies() {
        return ['MinMax', 'LTTB'];
    };

    apply(data) {
        throw new Error("Cannot use base class to filter")
    }
};

export class NoChartFilterStrategy extends ChartFilterStrategy {
    apply(data) {
        return data;
    }
};


export class MinMaxFilterStrategy extends ChartFilterStrategy {
    apply(data) {
        const distanceSeries = data.find(series => series.label === "distance");
        
        if (!distanceSeries) {
            return data;
        }
        
        const validIndices = distanceSeries.yValues.map((value, index) => {
            return (value > 0 && value < 300) ? index : null;
        }).filter(index => index !== null);
        
        if (validIndices.length === 0) {
            return data.map(series => ({
                label: series.label,
                xValues: [],
                yValues: []
            }));
        }
        
        const filteredData = data.map(series => {
            return {
                label: series.label,
                xValues: validIndices.map(index => series.xValues[index]),
                yValues: validIndices.map(index => series.yValues[index])
            };
        });
        
        return filteredData;
    }
};

export class LTTBFilterStrategy extends ChartFilterStrategy {

    apply(data) {
        const threshold = 50;
    
        // Extract the data series that we'll use for sampling (distance)
        const distanceSeries = data.find(series => series.label === "distance");
        
        if (!distanceSeries) {
            return data; // Return original data if distance series not found
        }
        
        const data_length = distanceSeries.xValues.length;
        
        if (threshold >= data_length || threshold === 0) {
            return data; // Nothing to do
        }
        
        // Create combined data points for LTTB algorithm
        const combinedData = distanceSeries.xValues.map((x, i) => {
            return [new Date(x).getTime(), distanceSeries.yValues[i]];
        });
        
        // Prepare result structure
        const sampled = [];
        let sampled_index = 0;
        
        // Bucket size. Leave room for start and end data points
        const every = (data_length - 2) / (threshold - 2);
        
        let a = 0;  // Initially a is the first point in the triangle
        let max_area_point, max_area, area, next_a;
        
        // Always add the first point
        const firstIndex = 0;
        sampled[sampled_index++] = firstIndex;
        
        for (let i = 0; i < threshold - 2; i++) {
            // Calculate point average for next bucket (containing c)
            let avg_x = 0,
                avg_y = 0,
                avg_range_start = Math.floor((i + 1) * every) + 1,
                avg_range_end = Math.floor((i + 2) * every) + 1;
            
            avg_range_end = avg_range_end < data_length ? avg_range_end : data_length;
            const avg_range_length = avg_range_end - avg_range_start;
            
            for (; avg_range_start < avg_range_end; avg_range_start++) {
                avg_x += combinedData[avg_range_start][0]; // timestamp
                avg_y += combinedData[avg_range_start][1]; // distance value
            }
            
            avg_x /= avg_range_length;
            avg_y /= avg_range_length;
            
            // Get the range for this bucket
            let range_offs = Math.floor((i + 0) * every) + 1,
                range_to = Math.floor((i + 1) * every) + 1;
            
            // Point a
            const point_a_x = combinedData[a][0], // timestamp
                point_a_y = combinedData[a][1]; // distance value
            
            max_area = area = -1;
            
            for (; range_offs < range_to; range_offs++) {
                // Calculate triangle area over three buckets
                area = Math.abs(
                    (point_a_x - avg_x) * (combinedData[range_offs][1] - point_a_y) -
                    (point_a_x - combinedData[range_offs][0]) * (avg_y - point_a_y)
                ) * 0.5;
                
                if (area > max_area) {
                    max_area = area;
                    max_area_point = range_offs; // Store the index instead of the point
                    next_a = range_offs; // Next a is this b
                }
            }
            
            sampled[sampled_index++] = max_area_point; // Pick this point index from the bucket
            a = next_a; // This a is the next a (chosen b)
        }
        
        // Always add last point
        const lastIndex = data_length - 1;
        sampled[sampled_index++] = lastIndex;
        
        // Now construct the result with all series using the sampled indices
        const result = data.map(series => {
            return {
                label: series.label,
                xValues: sampled.map(index => series.xValues[index]),
                yValues: sampled.map(index => series.yValues[index])
            };
        });
        
        return result;
    }
};

export class AggregateFilterStrategy extends ChartFilterStrategy {
    apply(data) {
        return data;
    }
};

export class AccelMSSqFilterStrategy extends ChartFilterStrategy {
    apply(data) {
        const scale = 0.0011964;
        return data.map(element => {
            if (element.label.split('_')[0] === 'accel') {
                return {
                    ...element,
                    yValues: element.yValues.map(y => (y * scale).toFixed(2))
                };
            }
            // return element;
        });
    }
};

export class AccelGsFilterStrategy extends ChartFilterStrategy {
    apply(data) {
        const scale = 0.000122;
        return data.map(element => {
            if (element.label.split('_')[0] === 'accel') {
                return {
                    ...element,
                    yValues: element.yValues.map(y => (y * scale).toFixed(2))
                };
            }
            // return element;
        });
    }
};

//I added buildFIlterKernel to precompute the cap2d.
//this might make the website load slow initially
export class AccelDisplacementFilterStrategy extends ChartFilterStrategy {
    constructor() {
        super();
        this.fs = 200;
        this.ts = 1 / this.fs;
        this.dt2 = this.ts;
        this.ft = 1.24;
        this.aRes = 4 / Math.pow(2, 15);
        this.offset = 0.032;
        this.gravity = 9.81;

        // precompute once
        this.Ca2drp2 = this._buildFilterKernel();
    }

    _buildFilterKernel() {
        const k = Math.ceil(this.fs * 3 / this.ft / 2);
        const Nd = 2 * k + 1;
        const Lc = this.buildLcMatrix(Nd);
        const La = this.buildLaMatrix(Nd);
        const L = this.matrixMultiply(La, Lc);
        const lambda = 46.81 * Math.pow(Nd, -1.95);
        const Ca2d = this.calculateCa2d(L, La, lambda, Nd);
        return Ca2d[k + 1];
    };

    apply(data) {
        return data
            .map(element => {
                const displacement = this.calculateDisplacement(element.yValues);
                return {
                    ...element,
                    label: element.label.replace(/accel_([xyz])/, 'displacement_$1'),
                    yValues: displacement
                };
            });
    };

    calculateDisplacement(ax_sk) {
        const N = ax_sk.length;
        
        // Convert raw sensor values to m/s² - matches MATLAB exactly
        // Ax_real_sk = (ax_sk*aRes+0.032)*9.81
        const Ax_real_sk = ax_sk.map(val => (val * this.aRes + this.offset) * this.gravity);
        
        // Calculate k and Nd
        const k = Math.ceil(this.fs * 3 / this.ft / 2);
        const Nd = 2 * k + 1;
        
        // Build the Lc matrix (Nd x Nd+2)
        const Lc = this.buildLcMatrix(Nd);
        
        // Build La matrix (Nd x Nd)
        const La = this.buildLaMatrix(Nd);
        
        // Calculate L = La * Lc
        const L = this.matrixMultiply(La, Lc);
        
        // Calculate lambda
        const lambda = 46.81 * Math.pow(Nd, -1.95);
        
        // Calculate Ca2d = (L'*L + lambda^2*I)^(-1) * L' * La
        const Ca2d = this.calculateCa2d(L, La, lambda, Nd);
        
        // Extract row r+2 (MATLAB: Ca2d(r+2,:) where r=k, so row k+2)
        // In 0-based indexing, this is index k+1
        const Ca2drp2 = Ca2d[k + 1];
        
        // Prepare cap_shk (negate the acceleration)
        const cap_shk1 = Ax_real_sk.map(val => -val);
        
        //if the values are consistently too large maybe add the mean back in
        const meanVal = this.calculateMean(cap_shk1);
        const cap_shk = cap_shk1.map(val => val - meanVal);
        // const cap_shk = cap_shk1;
        
        // Apply the filter using convolution
        const xtr1 = new Array(N).fill(0);
        for (let j = k; j < N - k; j++) {
            let sum = 0;
            for (let m = 0; m < Ca2drp2.length; m++) {
                sum += Ca2drp2[m] * cap_shk[j - k + m];
            }
            xtr1[j] = sum * this.dt2;
        }
        
        // Convert to mm (meters to millimeters)
        // return xtr1.map(val => val * 1000);
        return xtr1.map(val => (val * 10).toFixed(2));

    }

    buildLcMatrix(Nd) {
        const Lc = Array(Nd).fill(0).map(() => Array(Nd + 2).fill(0));
        
        for (let i = 0; i < Nd; i++) {
            Lc[i][i] = 1;
            Lc[i][i + 1] = -2;
            Lc[i][i + 2] = 1;
        }
        
        return Lc;
    }

    buildLaMatrix(Nd) {
        const La = Array(Nd).fill(0).map(() => Array(Nd).fill(0));
        
        for (let i = 0; i < Nd; i++) {
            La[i][i] = 1;
        }
        
        La[0][0] = 1 / Math.sqrt(2);
        La[Nd - 1][Nd - 1] = 1 / Math.sqrt(2);
        
        return La;
    }

    matrixMultiply(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        
        const result = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
        
        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        
        return result;
    }

    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = Array(cols).fill(0).map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                result[j][i] = matrix[i][j];
            }
        }
        
        return result;
    }

    calculateCa2d(L, La, lambda, Nd) {
        const LT = this.transpose(L);
        const LTL = this.matrixMultiply(LT, L);
        
        const lambda2 = lambda * lambda;
        for (let i = 0; i < Nd + 2; i++) {
            LTL[i][i] += lambda2;
        }
        
        const LTLa = this.matrixMultiply(LT, La);
        const Ca2d = this.solveLinearSystem(LTL, LTLa);
        
        return Ca2d;
    }

    solveLinearSystem(A, B) {
        const n = A.length;
        const m = B[0].length;
        
        const aug = A.map((row, i) => [...row, ...B[i]]);
        
        for (let i = 0; i < n; i++) {
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                    maxRow = k;
                }
            }
            
            [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
            
            for (let k = i + 1; k < n; k++) {
                const factor = aug[k][i] / aug[i][i];
                for (let j = i; j < n + m; j++) {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }
        
        const result = Array(n).fill(0).map(() => Array(m).fill(0));
        for (let col = 0; col < m; col++) {
            for (let i = n - 1; i >= 0; i--) {
                let sum = aug[i][n + col];
                for (let j = i + 1; j < n; j++) {
                    sum -= aug[i][j] * result[j][col];
                }
                result[i][col] = sum / aug[i][i];
            }
        }
        
        return result;
    }

    calculateMean(arr) {
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }
};

class TableFilterStrategy {
    apply(data) {
        throw new Error("Cannot use base class to filter")
    };
};

export class NoTableFilterStrategy extends TableFilterStrategy {
    apply(data) {
        let entries = [];
        
        let xData = data.find(d => d.label.includes('_x'));
        let yData = data.find(d => d.label.includes('_y'));
        let zData = data.find(d => d.label.includes('_z'));
        
        if (!xData) {
            xData = data[0];
            yData = data[1];
            zData = data[2] || null;
        }
        
        console.assert(xData, 'No x-axis data found in dataset');
        console.assert(yData, 'No y-axis data found in dataset');
        
        for (let i = 0; i < xData['xValues'].length; i++) {
            let entry = [
                new Date(xData['xValues'][i]),
                xData['yValues'][i],
                yData['yValues'][i]
            ];
            if (zData) entry.push(zData['yValues'][i]);
            entries.push(entry);
        }
        return entries;
    };
};

export class AccelP2PTableFilterStrategy extends TableFilterStrategy {
    apply(data) {
        let timeGapMS = 1000;
        let entries = [];
        
        console.assert(data[0]['xValues'].length > 2, 'not enough timestamps');
        let testTS = new Date(data[0]['xValues'][0]);
        console.assert(!isNaN(testTS.getTime()), 'xValues does not contain valid dates');
        
        let leftPointer = 0;
        let rightPointer = 1;
        
        while (rightPointer < data[0]['xValues'].length) {
            let leftDate = new Date(data[0]['xValues'][rightPointer - 1]);
            let rightDate = new Date(data[0]['xValues'][rightPointer]);
            
            if (rightDate - leftDate > timeGapMS) {
                //found a gap - process the event from leftPointer to rightPointer - 1
                let eventPeakX = this.findPeak(data[0], leftPointer, rightPointer - 1);
                let eventPeakY = this.findPeak(data[1], leftPointer, rightPointer - 1);
                let eventPeakZ = this.findPeak(data[2], leftPointer, rightPointer - 1);
                
                entries.push([
                    new Date(data[0]['xValues'][leftPointer]),
                    eventPeakX[1],
                    eventPeakY[1],
                    eventPeakZ[1]
                ]);
                
                leftPointer = rightPointer;
            }
            rightPointer++;
        }
        
        //process the final event (from leftPointer to end)
        if (leftPointer < data[0]['xValues'].length) {
            let eventPeakX = this.findPeak(data[0], leftPointer, data[0]['xValues'].length - 1);
            let eventPeakY = this.findPeak(data[1], leftPointer, data[0]['xValues'].length - 1);
            let eventPeakZ = this.findPeak(data[2], leftPointer, data[0]['xValues'].length - 1);
            
            entries.push([
                new Date(data[0]['xValues'][leftPointer]),
                eventPeakX[1],
                eventPeakY[1],
                eventPeakZ[1]
            ]);
        }
        
        return entries;
    }

    findPeak(dataset, l, r) {
        let yValues = dataset['yValues'];
        let xValues = dataset['xValues'];
        let max = yValues[l];
        let min = yValues[l];
        let maxIndex = l;
        let minIndex = l;
        
        for (let i = l; i <= r; i++) {
            if (yValues[i] > max) {
                max = yValues[i];
                maxIndex = i;
            }
            if (yValues[i] < min) {
                min = yValues[i];
                minIndex = i;
            }
        }
        
        let startIndex = Math.min(maxIndex, minIndex);
        return [xValues[startIndex], max - min];
    };
};