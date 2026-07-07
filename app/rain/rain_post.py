from rain.rain_db import rain_db

def post(post_dict):
    sname = post_dict['sensor_name']
    data = post_dict['measurement']
    charge = float(post_dict['charge'])

    #dont pass bare string, pass list of lines
    lines = [f'rain,sensor_id={sname} inches={data},charge={charge}']
    try:
        rain_db.post_rain_data(lines)
        return 'success'
    except Exception as e:  
        error_body = e.read().decode('utf-8')
        print(f"(Error during fetch: {e.code}, body: {error_body}")