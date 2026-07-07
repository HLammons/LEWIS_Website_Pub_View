
export class EventBus {
    constructor() {
        if (EventBus.instance) {
            return EventBus.instance;
        }

        EventBus.instance = this;

        this.events = {
            //UI selection events
            'sensor_id_selected' : [],
            'duration_selected' : [],
            'upper_bound_selected' : [],
            'lower_bound_selected': [],
            'chart_filter_selected': [],
            'table_filter_selected': [],
            'chart_clicked': [],
            'download_clicked': [],
            'zoom_bounds_changed': [],
            //Creation events
            'state_updated': [],
            'table_csv_created': []
        };
    }
    //TODO: need to create an off for if this obj gets destroyed
    //if we do not we will create a mem leak.
    //simply make a destructor that iterates through event handlers, gets the object
    //associated with them and calls their off methods
    on(eventName, handler) {
        if (this.events[eventName] === undefined) {
            throw new Error('[EVENT BUS][on] tried to listen for nonexistent event')
        }

        const isAppStateHandler = handler.name.startsWith('bound appState');
        if (isAppStateHandler) {
            this.events[eventName].unshift(handler);
        } else {
            this.events[eventName].push(handler);
        }
    };

    emit(eventName, data) {
        if (this.events[eventName] === undefined) {
            throw new Error('[EVENT BUS][emit] tried to emit to nonexistent event')
        }
        // console.log(`[EVENT BUS][emit] emiting ${eventName} with val ${data}`)

        this.events[eventName].forEach(handler => {
            handler(data);
        });
    };
};