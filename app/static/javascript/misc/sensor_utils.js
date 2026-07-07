 export function getSensorTypeUtil(value) {
    let sensorType = undefined;
    const firstIndexOfId = value.trim()[0].toLowerCase();
    switch (firstIndexOfId) {
        case 's':
            sensorType = 'sonar';
            break;
        case "r":
            sensorType = 'rain';
            break;
        case "a":
            sensorType = 'accel';
            break;
        default:
            console.log('no current sensor type detected from first char????')
            throw new Error('no sensor type detected from first char of sensor_id')
            break;
    }

    return sensorType;
};

export function getSensorTimeGapUtil(sensorType) {
    let sensorTimeGap = 0;
    switch (sensorType) {
        case 'accel':
            sensorTimeGap = 5000;
            break;
        case 'sonar':
            sensorTimeGap = 300000
            break;
        case 'rain':
            sensorTimeGap = 600000
            break;
        default:
            throw new Error('[SENSOR UTILS][get sensor time gap] hit default, bad sensor type');
            break;
    }

    return sensorTimeGap;
};
