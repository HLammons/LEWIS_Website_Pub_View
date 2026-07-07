from accel.simple8b import decompress_int16_array
import struct
from accel.chunk_cache import ChunkCache
from accel.accel_db import accel_db_client

def post(dict):
    chunk_cache.insert_chunk(dict)

def post_completed_chunks(compressed_dict):

    sensor_name = compressed_dict['sensor_name']
    start_timestamp = compressed_dict['timestamp']
    original_size = compressed_dict['original_size']
    
    print(f"[post_accel_data] sensor_name: {sensor_name}")
    print(f"[post_accel_data] start_timestamp: {start_timestamp}")
    print(f"[post_accel_data] original_size: {original_size}")
    
    compressed_accel_x = compressed_dict['accel_x']
    compressed_accel_y = compressed_dict['accel_y']
    compressed_accel_z = compressed_dict['accel_z']
    
    print(f"[post_accel_data] Compressed data lengths: accel_x={len(compressed_accel_x)}, accel_y={len(compressed_accel_y)}, accel_z={len(compressed_accel_z)}")
    
    u64_accel_x = struct.unpack(f'<{len(compressed_accel_x)//8}Q', compressed_accel_x)
    u64_accel_y = struct.unpack(f'<{len(compressed_accel_y)//8}Q', compressed_accel_y)
    u64_accel_z = struct.unpack(f'<{len(compressed_accel_z)//8}Q', compressed_accel_z)
    
    print(f"[post_accel_data] Decompressing arrays...")
    accel_x = decompress_int16_array(u64_accel_x, original_size)
    accel_y = decompress_int16_array(u64_accel_y, original_size)
    accel_z = decompress_int16_array(u64_accel_z, original_size)
    
    assert len(accel_x) == len(accel_y) == len(accel_z), '[DB Manager] accel x, y, z have different lengths'
    print(f"[post_accel_data] Decompressed array lengths: {len(accel_x)}, {len(accel_y)}, {len(accel_z)}")
    
    lines = [
        f"accel,sensor_id={sensor_name} accel_x={accel_x[i]},accel_y={accel_y[i]},accel_z={accel_z[i]} {start_timestamp + (i * 5)}"
        for i in range(len(accel_x))
    ]

    print(f"[post_accel_data] Created {len(lines)} points")
    print(f"[post_accel_data] First timestamp: {start_timestamp}, Last timestamp: {start_timestamp + ((len(accel_x)-1) * 5)}")
    print(f"[post_accel_data] FIRST POINT - timestamp: {start_timestamp}, accel_x: {accel_x[0]}, accel_y: {accel_y[0]}, accel_z: {accel_z[0]}")
    print(f"[post_accel_data] LAST POINT - timestamp: {start_timestamp + ((len(accel_x)-1) * 5)}, accel_x: {accel_x[-1]}, accel_y: {accel_y[-1]}, accel_z: {accel_z[-1]}")
    print(f"[post_accel_data] Writing to InfluxDB...")

    accel_db_client.post_accel_data(lines)

    print(f"[post_accel_data] Write complete!")
    return f"Successfully inserted {len(lines)} accelerometer points for sensor {sensor_name} to InfluxDB bucket"

chunk_cache = ChunkCache(post_completed_chunks)


