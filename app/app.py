from flask import Flask, render_template, jsonify, request, redirect, Blueprint, g
# from flask_sqlalchemy import SQLAlchemy
# from flask_login import LoginManager, login_user, login_required, current_user
from werkzeug.security import check_password_hash
from flask_socketio import SocketIO
from flask_compress import Compress
import json
from location_map import Location_Map
import mimetypes
from accel import accel_query, accel_post
from rain import rain_query, rain_post
from sonar import sonar_query, sonar_post
from shared import names_query
import re
import urllib


app = Flask(__name__)
Compress(app)

mimetypes.add_type('application/javascript', '.js')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'
app.config['SECRET_KEY'] = 'test_key'
app.config['COMPRESS_MIMETYPES'] = [
    'text/html',
    'text/css',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/x-protobuf'
]
app.config['COMPRESS_MIN_SIZE'] = 500

socketio = SocketIO(app, async_mode='gevent')
location_map = Location_Map()

insert_bp = Blueprint('insert', __name__)

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    if username == 'Cochiti' and password == 'CARC_2026':
        return redirect('/dashboard')
    else:
        return redirect('/')
    
@app.route('/dashboard')
def dashboard():
    return render_template('index.html')
    
@app.route('/query')
def query():
    sensor_name = request.args.get('sensor', default=None)
    assert sensor_name is not None

    configs_from_args = {
        'sensor_name': sensor_name,
        'start_date': request.args.get('start', default="-12m"),
        'end_date': request.args.get('end', default='now()'),
        'lower_bound': request.args.get('lowerBound', default="0"),
        'upper_bound': request.args.get('upperBound', default="600"),
        'filter': request.args.get('filter', default=None),
    }

    bad_arg = validate_args(configs_from_args)
    if bad_arg:
        print('[APP][query] bad arg')
        return jsonify({"result": 'bad args'}), 500

    if sensor_name.startswith('s'):
        return sonar_query.query(configs_from_args)
    elif sensor_name.startswith('r'):
        return rain_query.query(configs_from_args)
    elif sensor_name.startswith('a'):
        return accel_query.query(configs_from_args)
    else:
        raise Exception('[APP][query] invalid sensor name')

'''
curl -X POST http://localhost:80/json_http_insert -H "Content-Type: application/json" -d "{\"coreid\": \"abc123\", \"event\": \"sensor_reading\", \"data\": \"{\\\"sensor_name\\\": \\\"sC.Arian6\\\", \\\"measurement\\\": 0.00, \\\"charge\\\": 100.0}\"}"
'''

#FOR ALL INSERTS WE NEED COREID, PARTICLE_NAME, AND NAME IN CODE
@insert_bp.route('/json_http_insert', methods=['POST'])
def json_http_insert():
    try:
        data_dict = request.get_json()
        monitor_map = {
            'coreid': data_dict['coreid']
        }
        
        if 'data' in data_dict and isinstance(data_dict['data'], str):
            data_dict = json.loads(data_dict['data'])
        if 'sensor_name' not in data_dict or 'measurement' not in data_dict:
            return jsonify({"error": "Data dictionary is missing required keys."}), 400
        
        sensor_name = data_dict['sensor_name']
        monitor_map['sensor_name'] = sensor_name
        g.insert_data = monitor_map

        if sensor_name.startswith('s'):
            return jsonify({"result": sonar_post.post(data_dict)}), 200
        elif sensor_name.startswith('r'):
            return jsonify({"result": rain_post.post(data_dict)}), 200

    except Exception as e:
        return jsonify({"error": f"Error while inserting data: {str(e)}"}), 500

@insert_bp.route('/binary_http_insert', methods=['POST'])
def binary_http_insert():
    try:
        data_dict = request.get_json()

        assert data_dict.get('coreid')
        assert data_dict.get('data')

        # data = json.loads(data_dict.get('data'))
        # monitor_map = {
        #     'coreid': data_dict.get('coreid'),
        #     'sensor_name': data.get('sensor_name')
        # }
        # g.insert_data = monitor_map

        accel_post.post(data_dict)
        return jsonify({"result": "success"}), 200

    except Exception as e:
        print(f"ERROR in binary_http_insert: {str(e)}")
        return jsonify({"error": f"Error while inserting data: {str(e)}"}), 500

@insert_bp.route('/insert', methods=['POST'])
def insert():
    data = request.get_json()
    g.insert_data = data

    if data['data'][0] == '{':
        parsed = json.loads(data['data'])
        if parsed['sensor_name'].startswith('s'):
            #call the handler for sonar
            #sonar_handler.insert()
            pass
        if parsed['sensor_name'].startswith('r'):
            #call the handler for rain
            #rain_handler.insert()
            pass
    else:
        #call handler for accel
        #accel_handler.insert()
        pass

@insert_bp.teardown_request
def teardown(exception):
    if exception:
        return
    
    data = g.pop('insert_data', None)
    if data is not None:
        try:
            req = urllib.request.Request(
                'http://monitor:80/insert',
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            urllib.request.urlopen(req)
        except Exception as e:
            print(f'[TEARDOWN] Failed to notify monitor: {e}')

@app.route('/get_active_sensors')
def get_active_sensors():
    sensor_type = request.args.get('sensor_type')
    assert sensor_type == 'l6' or sensor_type == 'l7'
    return jsonify(names_query.query('1w', sensor_type))

@app.route('/get_sensors_to_locate')
def get_sensors_to_locate():
    return jsonify(location_map.get_sensors_to_locate())

@app.route('/get_sensor_map')
def get_sensor_map():
    global location_map
    if location_map is not None:
        return location_map.get_map()
    
def validate_args(args):
    throw_error = False
    list_of_filters = ['Gs', 'MSSq', 'Displacement', 'raw']
    name_pattern = r'^[a-z]C[_.]\w{1,18}$'
    date_pattern = r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
    bounds_pattern = r'^(600|[1-5]?\d{1,2}|0)$'

    if args['filter'] is not None and args['filter'] not in list_of_filters:
        print(f'[APP][validate args] filter val {args["filter"]}')
        throw_error = True
    
    name_match = re.search(name_pattern, args["sensor_name"])
    if name_match is None:
        print(f'[APP][validate args] name val {args["sensor_name"]}')
        throw_error = True

    start_match = re.search(date_pattern, args["start_date"])
    if start_match is None:
        print(f'[APP][validate args] start val {args["start_date"]}')
        throw_error = True

    end_match = re.search(date_pattern, args['end_date'])
    if end_match is None:
        print(f'[APP][validate args] end val {args["end_date"]}')
        throw_error = True

    lower_match = re.search(bounds_pattern, args['lower_bound'])
    if lower_match is None:
        print(f'[APP][validate args] lower val {args["lower_bound"]}')
        throw_error = True

    upper_match = re.search(bounds_pattern, args['upper_bound'])
    if upper_match is None:
        print(f'[APP][validate args] upper val {args["upper_bound"]}')
        throw_error = True

    return throw_error

app.register_blueprint(insert_bp)
    


