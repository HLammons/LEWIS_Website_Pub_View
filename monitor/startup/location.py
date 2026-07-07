
import requests
from datetime import datetime
from core.db import monitor_db
import os

def update_location_on_startup():
    print('[MONITOR SERVICE][startup] starting location update service')
    location_responses = get_fleet_queries()
    coords_dict = filter_sensor_locations(location_responses)
    update_sensor_data(coords_dict)

def get_fleet_queries():
    responses = []
    raw = os.environ.get('LOCATION_KEYS', '')
    if not raw:
        print('[MONITOR SERVICE][startup] no location keys found')
        return responses
    print('[MONITOR SERVICE][startup] found location keys')
    keys = raw.split(',')
    os.environ.pop('LOCATION_KEYS')
    print('[MONITOR SERVICE][startup] cleared location keys from environment')

    for key in keys:
        url_components = key.split(':')
        base_url = f'https://api.particle.io/v1/products/{url_components[0]}/fleet_locations'
        headers = {
            'Authorization': f'Bearer {url_components[1]}'
        }


        response = requests.get(base_url, headers=headers)
        if response.status_code == 200:
            responses.append(response.json())
    return responses

def filter_sensor_locations(location_query_responses):
    sensor_coords = {}
    for dict in location_query_responses:
        for location in dict['locations']:
            longitude, latitude = location['geometry']['coordinates']
            last_heard = location['last_heard']
            last_heard = datetime.fromisoformat(last_heard.replace('Z', '+00:00')).strftime('%m/%d/%y')
            name = location['device_name']
            sensor_coords[location["device_id"]] = latitude, longitude, name, last_heard
    return sensor_coords

def update_sensor_data(sensor_coords):
    for key, value in sensor_coords.items():
        if not monitor_db.coreid_exists(key):
            monitor_db.add_coreid(key)

        lat, lon, name, last_heard = value
        stored_lat, stored_lon = monitor_db.get_location_by_coreid(key)
        if lat != stored_lat or lon != stored_lon:
            monitor_db.change_location_by_coreid(key, lat, lon)

        if not monitor_db.get_name_by_coreid(key):
            monitor_db.change_name_by_coreid(key, name)

        monitor_db.change_last_heard_by_core_id(key, last_heard)


#we need to decide if we want to add a coreid and location in the startup location task or
#just wait for all the sensors to slowly upload into the DB