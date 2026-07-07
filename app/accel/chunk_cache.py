import sqlite3
import base64
import struct
from threading import Lock
from collections import defaultdict

BYTES_IN_U8 = 1
BYTES_IN_U16 = 2
BYTES_IN_U64 = 8

#SOME NOTES ABOUT PARSING OUR DATA:
#we get base 64 from particle which can be unpacked to the original bytes.
#a sequence will start with a run length which is a u16_t, then a signifier,
#which is a u8_t, then the data which for sensor data will be u64_t. The run length is the number
#of whatever type is in the sequence, which will most often be u64_t, but for metadata they can be different,
#sig 8 (sensorName) is a string for instance, and sig 9 (num chunks) is a u16_t



class ChunkCache:
    def __init__(self, handler):
        self._handler = handler
        self._locks = defaultdict(Lock)
        #WAL (write ahead logging) allows cursors to write changes to a log and collect changes to the Db before
        #they are all written, which helps when you have many cursors doing many writes.
        with sqlite3.connect('chunk_staging.db') as conn:
            conn.execute('PRAGMA journal_mode=WAL')
            conn.execute('PRAGMA busy_timeout=5000')

    def insert_chunk(self, json_dict):
        result = self.initial_parse(json_dict)
        print(f"[insert_chunk] Returning: {result}")
        return result

##################### HELPER METHODS ##################################
    def db_action_execute(self, sql_string, params=None):
        with sqlite3.connect('chunk_staging.db') as conn:
            c = conn.cursor()
            if params:
                return c.execute(sql_string, params)
            else:
                return c.execute(sql_string)

    def initial_parse(self, data):
        raw_data = data.get('data')
        raw_data = raw_data.split(',', 1)[1]
        data['data'] = raw_data
        
        binary_data = base64.b64decode(raw_data)
        #we can skip straight to the first signifier which will be after the run length which occupies 0, 1
        offset = 2
        sig = binary_data[offset]

        if 0 <= sig <= 5:
            result = self.data_insert(data)
            print(f"[initial_parse] data_insert returned: {result}")
            return result
        elif 6 <= sig <= 9:
            result = self.metadata_insert(data)
            print(f"[initial_parse] metadata_insert returned: {result}")
            return result

    def chunk_completion(self, coreid):
        result = self.db_action_execute(f"SELECT num_received = num_chunks FROM {coreid}")
        is_complete = result.fetchone()[0]
        print(f"[chunk_completion] {coreid} complete: {is_complete}")
        return is_complete

################# LOW LEVEL INSERTS ###################################

    def _db_data_insert(self, coreid, parsed_dict):
        with sqlite3.connect('chunk_staging.db') as conn:
            c = conn.cursor()
            
            for key, value in parsed_dict.items():
                if value:
                    c.execute(f"SELECT {key} FROM {coreid} WHERE id = 1")
                    existing = c.fetchone()[0]
                    c.execute(f"UPDATE {coreid} SET {key} = ? WHERE id = 1", ((existing or b'') + value,))
            
            c.execute(f"UPDATE {coreid} SET num_received = num_received + 1 WHERE id = 1")
        

    def _db_metadata_insert(self, coreid, parsed_dict):
        with sqlite3.connect('chunk_staging.db') as conn:
            c = conn.cursor()
            c.execute(
                f"""
                UPDATE {coreid} 
                SET timestamp = ?, original_size = ?, sensor_name = ?, num_chunks = ?
                WHERE id = 1
                """,
                (parsed_dict[6], parsed_dict[7], parsed_dict[8], parsed_dict[9])
            )
            c.execute(f"UPDATE {coreid} SET num_received = num_received + 1 WHERE id = 1")

################### HIGH LEVEL INSERTS #####################################
    #this method was changed so everything is contained within the lock
    #if there are errors just unindent the with and if
    def data_insert(self, data):
        assert(data.get('coreid'))
        assert(data.get('data'))
        coreid = data.get('coreid')

        with self._locks[coreid]:
            self._db_data_insert(coreid, self.parse_data(data.get('data')))
            
        with sqlite3.connect('chunk_staging.db') as conn:
            c = conn.cursor()
            c.execute(f'SELECT num_received, num_chunks FROM {coreid}')
            received, total = c.fetchone()
            print(f"[data_insert] {coreid}: {received}/{total} chunks received")

        if self.chunk_completion(coreid):
            print(f"[data_insert] ALL CHUNKS COMPLETE! Sending to InfluxDB...")
            result = self.send_chunk_to_database(coreid)
            print(f"[data_insert] send_chunk_to_database returned: {result}")
            return result
        return f"Data chunk received ({received}/{total})"
        
    def metadata_insert(self, data):
        assert data.get('coreid')
        assert(data.get('data'))
        coreid = data.get('coreid')

        with self._locks[coreid]:
            table_exists = self.db_action_execute(
                """SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?""",
                (coreid,)
            ).fetchone()

            if table_exists:
                result = self.db_action_execute(
                    f"""DROP TABLE IF EXISTS {coreid}"""
                )

            result = self.db_action_execute(
                f"""CREATE TABLE {coreid} (
                    id INTEGER PRIMARY KEY,
                    timestamp INTEGER,
                    original_size INTEGER,
                    sensor_name STRING,
                    num_chunks INTEGER,
                    num_received INTEGER DEFAULT 0,
                    accel_x BLOB,
                    accel_y BLOB,
                    accel_z BLOB,
                    gyro_x BLOB,
                    gyro_y BLOB,
                    gyro_z BLOB
                )"""
            )

            self.db_action_execute(
                f"INSERT INTO {coreid} (id, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z) VALUES (1, ?, ?, ?, ?, ?, ?)",
                (b'', b'', b'', b'', b'', b'')
            )

            self._db_metadata_insert(coreid, self.parse_metadata(data.get('data')))
        
        print(f"[metadata_insert] Metadata chunk received for {coreid}")
        return f"Metadata chunk received for {coreid}"
            
################## PARSE METHODS ###########################################
    def parse_metadata(self, data):
        parsed_dict = {}
        binary_data = base64.b64decode(data)
        offset = 0

        while offset < len(binary_data):
            run_length = struct.unpack_from('<H', binary_data, offset)[0]
            offset += BYTES_IN_U16
            sig = binary_data[offset]
            offset += BYTES_IN_U8

            if sig == 6:
                format = f'<{run_length}Q'
                timestamp = struct.unpack_from(format, binary_data, offset)
                parsed_dict[6] = timestamp[0]
                offset += run_length * BYTES_IN_U64

            if sig == 7:
                format = f'<{run_length}Q'
                original_size = struct.unpack_from(format, binary_data, offset)
                parsed_dict[7] = original_size[0]
                offset += run_length * BYTES_IN_U64

            if sig == 8:
                str_length = struct.unpack_from('<H', binary_data, offset)[0]
                offset += 2
                sensor_name = binary_data[offset:offset+str_length].decode('utf-8')
                parsed_dict[8] = sensor_name
                offset += str_length

            if sig == 9:
                format = f'<{run_length}H'
                num_chunks = struct.unpack_from(format, binary_data, offset)
                parsed_dict[9] = num_chunks[0]
                offset += run_length * BYTES_IN_U16

        return parsed_dict

    def parse_data(self, data):
        parsed_dict = dict.fromkeys(range(6), b'')
        binary_data = base64.b64decode(data)
        offset = 0

        while offset < len(binary_data):
            run_length = struct.unpack_from('<H', binary_data, offset)[0]
            offset += BYTES_IN_U16
            sig = binary_data[offset]
            offset += BYTES_IN_U8

            if sig == 0:
                end_of_data = run_length * BYTES_IN_U64
                accel_x = binary_data[offset:(offset + end_of_data)]
                parsed_dict['accel_x'] = accel_x
                offset += end_of_data

            if sig == 1:
                end_of_data = run_length * BYTES_IN_U64
                accel_y = binary_data[offset:(offset + end_of_data)]
                parsed_dict['accel_y'] = accel_y
                offset += end_of_data

            if sig == 2:
                end_of_data = run_length * BYTES_IN_U64
                accel_z = binary_data[offset:(offset + end_of_data)]
                parsed_dict['accel_z'] = accel_z
                offset += end_of_data

            # if sig == 3:
            #     end_of_data = run_length * BYTES_IN_U64
            #     gyro_x = binary_data[offset:(offset + end_of_data)]
            #     parsed_dict['gyro_x'] = gyro_x
            #     offset += end_of_data

            # if sig == 4:
            #     end_of_data = run_length * BYTES_IN_U64
            #     gyro_y = binary_data[offset:(offset + end_of_data)]
            #     parsed_dict['gyro_y'] = gyro_y
            #     offset += end_of_data

            # if sig == 5:
            #     end_of_data = run_length * BYTES_IN_U64
            #     gyro_z = binary_data[offset:(offset + end_of_data)]
            #     parsed_dict['gyro_z'] = gyro_z
            #     offset += end_of_data
                
        return parsed_dict

    def send_chunk_to_database(self, coreid):
        with self._locks[coreid]:
            with sqlite3.connect('chunk_staging.db') as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute(f"SELECT * FROM {coreid}")
                row = c.fetchone()
                data_dict = dict(row)
            self.db_action_execute(f"DROP TABLE {coreid}")
        
        print(f"[send_chunk_to_database] Calling handler.post_completed_chunks...")
        result = self._handler(data_dict)
        print(f"[send_chunk_to_database] InfluxDB returned: {result}")
        return result