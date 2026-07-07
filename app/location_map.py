import folium
import json
import os

class Location_Map:
    def __init__(self):
        self.sensor_coordinates = []
        self.sensors_to_locate = []

        if os.environ.get('SENSOR_COORDINATES'):
            self.sensor_coordinates = json.loads(os.environ.get('SENSOR_COORDINATES'))
            self.sensors_to_locate = json.loads(os.environ.get('SENSORS_TO_LOCATE'))
        else:
            print('sensor coords hardcoded')
            self.sensor_coordinates = [['rC_02', 35.156799, -106.533319, '02/27/26'], ['sC_Milicija', 37.503281, -122.474089, '02/28/26'], ['sC_Arian7', 36.178624, -106.213028, '03/02/26'], 
                                       ['sC_Arian11', 34.95901, -106.660625, '03/04/26'], ['sC_Arian19', 35.156799, -106.533319, '03/03/26'], ['sC_Arian16', 35.083076, -106.631756, '02/21/26'], 
                                       ['sC_Arian15', 18.244856, -66.008813, '03/01/26'], ['rC_Arian7', 18.244856, -66.008813, '02/28/26'], ['rC_Arian4', 34.055137, -118.253529, '02/08/26'], 
                                       ['rC_Arian3', 35.156799, -106.533319, '02/22/26'], ['rC_Arian8', 36.178624, -106.213028, '03/06/26'], ['rC_Arian10', 35.083076, -106.631756, '02/27/26'], 
                                       ['aC_Hussein1', 35.083076, -106.631756, '02/23/26'], ['aC_Hussein3', 34.731194, -106.77766, '03/02/26'], ['aC_Hussein4', 34.673088, -106.770071, '02/20/26'], 
                                       ['aC_Hussein3Replacement', 35.249656, -106.566533, '03/06/26'], ['aC_Hussein4Replacement', 35.249656, -106.566533, '03/05/26']]
            

            self.sensors_to_locate = [['sC_Milicija3', 35.078446, -106.626753, '08/31/25'], ['sC_Moreu', 35.078446, -106.626753, '08/21/25'], ['sC_10', 35.954969, -83.917019, '01/19/26'], 
                                      ['sanfran.03', 35.060138, -106.617082, '09/22/25'], ['rC_05', 35.084558, -106.627259, '12/05/25'], ['sC_Carl', 35.156281, -106.530472, '11/10/25'], 
                                      ['sC_01', 35.078319, -106.626263, '08/21/25'], ['sC_Arian2', 35.161744, -106.35605, '11/28/25'], ['sC_Arian6', 35.09844, -106.626835, '10/02/25'], 
                                      ['sC_Arian5', 35.16547, -106.36849, '07/31/25'], ['sC_Arian1', 35.161525, -106.355846, '01/03/26'], ['sC_Arian4', 35.161525, -106.355846, '01/02/26'], 
                                      ['sC_Arian3', 35.161525, -106.355846, '01/02/26'], ['sC_Arian13', 35.155715, -106.53015, '10/26/25'], ['sC_DeBerry3', 35.161554, -106.356658, '10/06/25'], 
                                      ['sC_Arian14', 35.17383, -106.563401, '10/02/25'], ['sC_DeBerry5', 35.082331, -106.633466, '08/21/25'], ['sC_DeBerry2', 37.541289, -122.509458, '10/27/25'], 
                                      ['sC_Arian20', 35.082656, -106.631219, '11/08/25'], ['sC_Arian21', 35.078144, -106.62585, '11/08/25'], ['sC_Arian18', 35.078144, -106.62585, '11/08/25'], 
                                      ['sC_Arian17', 35.077981, -106.624696, '11/16/25'], ['rC_Arian6', 35.081887, -106.631198, '06/23/25'], ['rC_Arian2', 35.156265, -106.358132, '01/25/26'], 
                                      ['rC_Arian1', 35.161525, -106.355846, '01/14/26'], ['rC_Arian5', 35.102222, -106.609643, '11/16/25'], ['rC_Arian13', 35.102967, -106.292374, '01/22/26'], 
                                      ['rC_Arian12', 35.082331, -106.633466, '08/21/25'], ['rC_Arian11', 35.078412, -106.626927, '05/23/25'], ['rC_Arian9', 35.081438, -106.625743, '06/03/25'], 
                                      ['aC_Hussein2', 35.082145, -106.631001, '01/13/26']]
            
        self.sensor_map = self.create_map()
    
    def create_map(self):
        m = folium.Map(
            location=[37, -95],
            zoom_start=4
        )
        
        coords = {}
        for sensor_info in self.sensor_coordinates:
            sensor_name = sensor_info[0]
            sensor_location = (sensor_info[1], sensor_info[2])
            last_heard = sensor_info[3]
            coords.setdefault(sensor_location, []).append(f"{sensor_name}\n{last_heard}\n")

        for item in coords.items():
            popup_text = '\n'.join(item[1])
            lat = item[0][0]
            lon = item[0][1]
            folium.Marker(
                location=[lat, lon],
                tooltip=f"click to view sensors at {lat}, {lon}",
                popup=popup_text,
                icon=folium.Icon(icon='cloud')
            ).add_to(m)
        return m._repr_html_()
    
    def get_map(self):
        if self.sensor_map:
            return self.sensor_map
    
    def get_sensors_to_locate(self):
        return self.sensors_to_locate
    
    # def get_sensor_coordinates():
    #     location_query_responses = []
    #     sensor_coordinates = []

    #     with open('LOCATION_CONFIG.txt', 'r') as f:
    #         keys = f.read().splitlines()

    #     for key in keys:
    #         url_components = key.split(':')
    #         base_url = f'https://api.particle.io/v1/products/{url_components[0]}/fleet_locations'
    #         headers = {
    #             'Authorization': f'Bearer {url_components[1]}'
    #         }
    #         response = requests.get(base_url, headers=headers)
    #         if response.status_code == 200:
    #             location_query_responses.append(response.json())
        
    #     for dict in location_query_responses:
    #         for location in dict['locations']:
    #             longitude, latitude = location['geometry']['coordinates']
    #             sensor_coordinates.append([location["device_name"], latitude, longitude])
        
    #     return sensor_coordinates
