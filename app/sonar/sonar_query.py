from flask import Response
from sonar.sonar_db import sonar_db
from shared import sensor_data_pb2 as sensor_data_pb2
from shared import handler_functions

def query(sonar_config):
    field_name = 'distance'
    sname = sonar_config['sensor_name']
    start = sonar_config['start_date']
    end = sonar_config['end_date']
    lower_bound = sonar_config['lower_bound']
    upper_bound = sonar_config['upper_bound']
    filter = sonar_config['filter']
    measurement_name = 'sonar'

    try:
        result = sonar_db.get_query(start, end, sname, measurement_name, field_name, lower_bound, upper_bound, filter)
        cols = ['_time', 'distance', 'charge']
        df = handler_functions.csv_string_to_df(result, cols)
        proto_bytes = handler_functions.filtered_df_to_protobuf(df)
        return Response(proto_bytes, mimetype='application/x-protobuf')
    except Exception as e:
        print(f'SONAR QUERY][query] error during send: {e}')
        return Response(f"error: {str(e)}", status=500)