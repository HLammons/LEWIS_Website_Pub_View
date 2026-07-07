from shared import sensor_data_pb2 as sensor_data_pb2
import pandas as pd
from io import StringIO
import os
from scipy.io import savemat, loadmat
import requests
import numpy as np
from shared import filter_container_selector

path_to_unfiltered = '/filter_staging/unfiltered/'
path_to_filtered = '/filter_staging/filtered/'

def csv_string_to_df(raw_query, cols):
    df = pd.read_csv(StringIO(raw_query), usecols=cols)
    return df

def write_mat_file_from_df(df, file_name):
    for col in ['accel_x', 'accel_y', 'accel_z']:
        df[col] = df[col].astype(float)
    
    np.save(f'{path_to_unfiltered}{file_name}_time.npy', df['_time'].to_numpy())
    
    mat_dict = {col: df[col].to_numpy().reshape(-1, 1) for col in ['accel_x', 'accel_y', 'accel_z']}
    savemat(f'{path_to_unfiltered}{file_name}.mat', mat_dict)

def read_mat_file_to_df(file_name):
    pd.set_option('display.float_format', '{:.6f}'.format)
    filtered = loadmat(f'{path_to_filtered}{file_name}.mat')
    clean = {k: v.flatten() for k, v in filtered.items() 
            if not k.startswith('_') and k != 'elapsed'}
    clean['_time'] = pd.to_datetime(np.load(f'{path_to_unfiltered}{file_name}_time.npy', allow_pickle=True), format='ISO8601')

    os.remove(f'{path_to_unfiltered}{file_name}.mat')
    os.remove(f'{path_to_unfiltered}{file_name}_time.npy')
    os.remove(f'{path_to_filtered}{file_name}.mat')
    return pd.DataFrame(clean)

def filtered_df_to_protobuf(df):
    response = sensor_data_pb2.SensorData()
    timestamps = df['_time'].tolist()
    
    for col in df.columns:
        if col == '_time':
            continue
        values = df[col].tolist()
        for i, value in enumerate(values):
            data_point = response.fields[col].data_points.add()
            data_point.timestamp = str(timestamps[i])
            #CONVERSION_TO_FLOAT
            data_point.value = float(value)
    
    return response.SerializeToString()

def downsample_dataframe(df, gap_threshold=5):
    cols = [c for c in df.columns if c != '_time']
    gaps = df['_time'].diff().dt.total_seconds()
    boundaries = [0] + list(gaps[gaps > gap_threshold].index) + [len(df)]

    result_rows = []
    for i in range(len(boundaries) - 1):
        l, r = boundaries[i], boundaries[i+1]
        chunk = df.iloc[l:r]

        result_rows.append(chunk.iloc[0])
        result_rows.append(chunk.iloc[-1])
        for col in cols:
            result_rows.append(chunk.loc[chunk[col].idxmin()])
            result_rows.append(chunk.loc[chunk[col].idxmax()])

    return pd.DataFrame(result_rows).sort_values('_time').reset_index(drop=True)

def call_matlab_filter(file_name, filter_type):
    filter_container_selection = filter_container_selector.get_filter_container_url()
    matlab_url = f"http://{filter_container_selection}:9910/filter_service/filter_service"
    
    payload = {
        "nargout": 1,
        "rhs": [file_name, filter_type]
    }
    
    response = requests.post(
        matlab_url,
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    response.raise_for_status()
    
    result = response.json()
    if 'error' in result:
        raise RuntimeError(f"[call_matlab_filter] MATLAB error: {result['error']}")
    
    print(f"[call_matlab_filter] success: {file_name} with filter {filter_type}")
    return True

def prepare_for_matlab(formatted_data):
    return {
        "accel_x": [entry["value"] for entry in formatted_data.get("accel_x", [])],
        "accel_y": [entry["value"] for entry in formatted_data.get("accel_y", [])],
        "accel_z": [entry["value"] for entry in formatted_data.get("accel_z", [])],
    }