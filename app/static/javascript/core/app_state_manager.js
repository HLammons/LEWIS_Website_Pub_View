import { EventBus } from "/static/javascript/core/event_bus.js";
import { getSensorTypeUtil } from "/static/javascript/misc/sensor_utils.js";

//THIS CLASS SHOULD NEVER CONTAIN DERIVED STATE!
//derived state means a state property that is derived from another state property.
//sensorType is okay since it is derived directly in appState, but generally never store derived state.
//this leads to too much branching
export class AppStateManager {
    constructor() {
        if (AppStateManager.instance) {
            return AppStateManager.instance;
        }

        AppStateManager.instance = this;
        this.state_history = [];

        const init_state = {
            sensorId: null,
            sensorType: null,
            duration: null,
            upperbound: null,
            lowerbound: null,
            chart_filter_strat: null,
            table_filter_strat: null,
            zoom_bounds: null
        }

        this.defaults = {
            sonar: {
                duration: '-12m',
                upperbound: '600',
                lowerbound: '0',
                chart_filter_strat: 'raw',
                table_filter_strat: 'default'
            },

            rain: {
                 duration: '-12m',
                upperbound: '600',
                lowerbound: '0',
                chart_filter_strat: 'raw',
                table_filter_strat: 'default'               
            },

            accel: {
                duration: '-12m',
                upperbound: '600',
                lowerbound: '0',
                chart_filter_strat: 'MSSq',
                table_filter_strat: 'default'                
            }
        }

        this.app_state = init_state;

        this.eventBus = new EventBus();
        this.eventBus.on('sensor_id_selected', this.appStateHandleIdChange.bind(this));
        this.eventBus.on('duration_selected', this.appStateHandleDurationChange.bind(this));
        this.eventBus.on('upper_bound_selected', this.appStateHandleUpperBoundChange.bind(this));
        this.eventBus.on('lower_bound_selected', this.appStateHandleLowerBoundChange.bind(this));
        this.eventBus.on('chart_filter_selected', this.appStateHandleChartFilterChange.bind(this));
        this.eventBus.on('table_filter_selected', this.appStateHandleTableFilterChange.bind(this));
        this.eventBus.on('zoom_bounds_changed', this.appStateHandleZoomBoundsChange.bind(this));
    };

    createAppState(data) {
        //need to enforce that the state obj has all these props
        const state = {
            sensorId: data.sensorId,
            sensorType: data.sensorId ? getSensorTypeUtil(data.sensorId) : null,
            duration: data.duration,
            upperbound: data.upperbound,
            lowerbound: data.lowerbound,
            chart_filter_strat: data.chart_filter_strat,
            table_filter_strat: data.table_filter_strat,
            zoom_bounds: data.zoom_bounds
        }

        // console.log('[EVENT BUS][createAppState] state created:', state);
        return Object.freeze(state)
    };

    getAppState() {
        return this.app_state;
    }

    appStateHandleIdChange(data) {
        this.state_history.push(this.app_state);
        const sensorType = data ? getSensorTypeUtil(data) : null;

        if (sensorType === null) {
            throw new Error('[APP STATE MANAGER][handleIdChange] sensor type was null');
        }

        const prevState = this.getAppState();
        const new_state = {
            sensorId: data,
            sensorType: sensorType,
            duration: this.defaults[sensorType]['duration'],
            upperbound: this.defaults[sensorType]['upperbound'],
            lowerbound: this.defaults[sensorType]['lowerbound'],
            chart_filter_strat: this.defaults[sensorType]['chart_filter_strat'],
            table_filter_strat: this.defaults[sensorType]['table_filter_strat'],
            zoom_bounds: null
        };
        
        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'settings');
    };

    appStateHandleDurationChange(data) {
        this.state_history.push(this.app_state);
        const new_state = {
            ...this.app_state,        
            duration: data,
            zoom_bounds: null
        };

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'settings');
    };

    appStateHandleUpperBoundChange(data) {
        this.state_history.push(this.app_state);
        const new_state = {
            ...this.app_state,        
            upperbound: data
        };

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'settings');
    };

    appStateHandleLowerBoundChange(data) {
        this.state_history.push(this.app_state);
        const new_state = {
            ...this.app_state,        
            lowerbound: data
        };

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'settings');
    };
    
    appStateHandleChartFilterChange(data) {
        this.state_history.push(this.app_state);
        const new_state = {
            ...this.app_state,
            chart_filter_strat: data
        }

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'settings');
    };

    appStateHandleTableFilterChange(data) {
        this.state_history.push(this.app_state);
        const new_state = {
            ...this.app_state,
            table_filter_strat: data
        }

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'build');
    };

    appStateHandleZoomBoundsChange(data) {
        if (data !== null && (!Array.isArray(data) || typeof data[0] !== 'string' || typeof data[1] !== 'string')) {
            throw new Error('[APP STATE MANAGER][handle new bounds] bounds was the wrong format');
        }

        this.state_history.push(this.app_state);

        const new_state = {
            ...this.app_state,
            zoom_bounds: data
        }

        this.app_state = this.createAppState(new_state);
        this.eventBus.emit('state_updated', 'zoom');
    };
};