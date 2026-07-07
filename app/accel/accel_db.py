import urllib.request
import time
import network_secrets
import os
import gzip
import requests

class AccelDB:
    def __init__(self, url, org, bucket, retries=5, delay=5):
        self.url = url
        self.org = org
        self.bucket = bucket
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Token {os.getenv("INFLUXDB_TOKEN")}',
            'Content-Type': 'text/plain; charset=utf-8'
        })
        self._verify_connection(retries, delay)

    def _verify_connection(self, retries, delay):
        for attempt in range(retries):
            try:
                response = self.session.get(f"{self.url}/health")
                response.raise_for_status()
                return
            except Exception as e:
                print(f"Attempt {attempt + 1}/{retries} to connect to InfluxDB failed: {e}")
                if attempt < retries - 1:
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    raise e
    
    def get_query(self, start_date, end_date, sensor_id, measurement_name, filter_type=None):
        assert filter_type is not None

        query = f'''
            import "influxdata/influxdb/schema"
            from(bucket: "{network_secrets.DB_BUCKET}")
            |> range(start: {start_date}, stop: {end_date})
            |> filter(fn: (r) => r._measurement == "{measurement_name}")
            |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")
            |> schema.fieldsAsCols()
            '''

        result = self.run_query(query)
        return result
    
    def post_accel_data(self, lines):
        response = self.session.post(
            f"{self.url}/api/v2/write?org={self.org}&bucket={self.bucket}&precision=ms",
            data='\n'.join(lines).encode('utf-8')
        )
        response.raise_for_status()
        return 'success'

    #we need to have 3 filter services.
    #then we round robin to each of the filter services
    #this means we need a threadsafe tracker of which was the last filter service used.
    
    def run_query(self, query):
        url = "http://influxdb:8086/api/v2/query?org=SMILab"
        auth_token = os.environ.get('INFLUXDB_TOKEN')
        headers = {
            'Authorization': f'Token {auth_token}',
            'Accept': 'application/csv',
            'Content-type': 'application/vnd.flux',
            'Accept-Encoding': 'gzip'
        }
        data = query.encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')

        result = None
        try:
            with urllib.request.urlopen(req) as response:
                data = response.read()
                if data[:2] == b'\x1f\x8b':
                    result = gzip.decompress(data).decode('utf-8')
                else:
                    result = data.decode('utf-8')
            return result
        
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"HTTP Error during fetch: {e.code}, body: {error_body}")
            raise e

    def close(self):
        self.client.close()

accel_db_client = AccelDB(network_secrets.DB_URL, network_secrets.ORG, network_secrets.DB_BUCKET)

