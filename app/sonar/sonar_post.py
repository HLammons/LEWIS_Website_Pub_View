
from sonar.sonar_db import sonar_db

def post(post_dict):
    sname = post_dict['sensor_name']
    data = post_dict['measurement']
    charge = float(post_dict['charge'])

    #dont pass bare string, pass list of lines
    lines = [f'sonar,sensor_id={sname} distance={data},charge={charge}']
    try:
        sonar_db.post_sonar_data(lines)
        return 'success'
    except Exception as e:
        error_body = e.read().decode('utf-8')
        print(f"(Error during fetch: {e.code}, body: {error_body}")