import time
from flask import Response
import uuid
import requests
from shared import handler_functions
from accel.accel_db import accel_db_client

path_to_unfiltered = '/filter_staging/unfiltered/'
path_to_filtered = '/filter_staging/filtered/'


def query(accel_config):
    sname = accel_config['sensor_name']
    start = accel_config['start_date']
    end = accel_config['end_date']
    filter = accel_config['filter']
    measurement_name = 'accel'
    result = accel_db_client.get_query(start, end, sname, measurement_name, filter)

    return post_process_accel_query(sname, filter, result)

def post_process_accel_query(sname, filter, result):
    cols = ['_time', 'accel_x', 'accel_y', 'accel_z']
    unfiltered_df = handler_functions.csv_string_to_df(result, cols)
    
    t_mat = time.time()
    unique_id = uuid.uuid4()
    file_name = f'{sname}_{unique_id}'
    handler_functions.write_mat_file_from_df(unfiltered_df, file_name)
    print(f"[timing] write_mat: {time.time()-t_mat:.3f}s")

    try:
        if handler_functions.call_matlab_filter(file_name, filter):
            t4 = time.time()
            print(f"[timing] matlab filter: {t4-t_mat:.3f}s")
            filtered_df = handler_functions.read_mat_file_to_df(file_name)

            duration = filtered_df['_time'].iloc[-1] - filtered_df['_time'].iloc[0]
            if duration.total_seconds() > 11:
                filtered_df = handler_functions.downsample_dataframe(filtered_df)

            proto_bytes = handler_functions.filtered_df_to_protobuf(filtered_df)
            t5 = time.time()
            print(f"[timing] read mat + protobuf: {t5-t4:.3f}s")
            return Response(proto_bytes, mimetype='application/x-protobuf')
    except (requests.exceptions.HTTPError, requests.exceptions.ConnectionError) as e:
        print(f"[call_matlab_filter] error: {e}")
        return Response(f"error: {str(e)}", status=500)