#define flask routes
from flask import Flask, request,jsonify
from core.monitor_queue import MonitorQueue
from core.task_puller import TaskPuller
from startup.location import update_location_on_startup

app = Flask(__name__)
m_q = MonitorQueue()
task_puller = TaskPuller(m_q)

update_location_on_startup()

@app.route('/insert', methods=['POST'])
def insert():
    try:
        data = request.get_json()
        coreid = data['coreid']
        sensor_name = data['sensor_name']
        monitor_task = [coreid, sensor_name, 'insert']
        m_q.put(monitor_task)
        return jsonify({"result": "success"}), 200
    except Exception as e:
        return jsonify({"error": f"Error while inserting to monitor: {str(e)}"}), 500
    
@app.route('/print_queue')
def print_queue():
    print(m_q)

if __name__ == "__main__":
    #run startup task
    app.run(host="0.0.0.0", port=80)

#at some point I want to run a startup task
#this task will use the API keys to query the current location of all sensors
#as well as the last heard of all sensors