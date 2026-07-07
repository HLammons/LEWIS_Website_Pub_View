from flask import Response
from rain.rain_db import rain_db
from shared import sensor_data_pb2 as sensor_data_pb2
from shared import handler_functions

def query(rain_config):
    field_name = 'inches'
    sname = rain_config['sensor_name']
    start = rain_config['start_date']
    end = rain_config['end_date']
    lower_bound = rain_config['lower_bound']
    upper_bound = rain_config['upper_bound']
    filter = rain_config['filter']
    measurement_name = 'rain'


    try:
        result = rain_db.get_query(start, end, sname, measurement_name, field_name, lower_bound, upper_bound, filter)
        cols = ['_time', 'inches', 'charge']
        df = handler_functions.csv_string_to_df(result, cols)
        proto_bytes = handler_functions.filtered_df_to_protobuf(df)
        return Response(proto_bytes, mimetype='application/x-protobuf')
    except Exception as e:
        print(f'[RAIN QUERY][query] error during send: {e}')
        return Response(f"error: {str(e)}", status=500)        