from core.db import monitor_db

#task should always be [coreid, sensor_name]
def insert_data(task):
    coreid = task[0]
    sensor_name = task[1]
    #check if coreid exists
    coreid_check = monitor_db.coreid_exists(coreid)
    if not coreid_check:
        monitor_db.add_coreid(coreid)
        monitor_db.change_name_by_coreid(coreid, sensor_name)
        return
    
    if not sensor_name == monitor_db.get_name_by_coreid(coreid):
        monitor_db.change_name_by_coreid(coreid, sensor_name)
