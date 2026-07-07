from sonar.sonar_db import sonar_db
import csv
import io

def query(duration, sensor_type):
    assert sensor_type != '', '[InfluxDB Manager] no sensortype provided'
    
    if sensor_type == 'l6':
        regex_pattern = '^[rs]'
    elif sensor_type == 'l7':
        regex_pattern = '^a'
    else:
        raise ValueError(f'Unknown sensor_type: {sensor_type}')
    
    result = sonar_db.names_query(regex_pattern)
    reader = csv.reader(io.StringIO(result))
    next(reader)
    names = [row[-1] for row in reader if row and row[-1] != '_value']

    result_list = sorted(names)
    return result_list
