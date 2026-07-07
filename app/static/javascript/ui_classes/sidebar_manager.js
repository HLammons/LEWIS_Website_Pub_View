import { EventBus } from "/static/javascript/core/event_bus.js";

export class Sidebar_Manager {
    constructor(sidebarId) {
        this.eventBus = new EventBus();
        
        this.sidebarElement = document.getElementById(sidebarId);
        this.lewis6buttoncontainer = document.getElementById('lewis-6-sidebar-buttons'); 
        this.lewis7buttoncontainer = document.getElementById('lewis-7-sidebar-buttons');
        this.lewis6dropdownButton = document.getElementById('lewis6dropdownButton');
        this.lewis7dropdownButton = document.getElementById('lewis7dropdownButton');
        this.lowerBoundSlider = document.getElementById('lowerBound');
        this.upperBoundSlider = document.getElementById('upperBound');
        this.lowerOutput = document.getElementById('lowerBoundVal');
        this.upperOutput = document.getElementById('upperBoundVal');
        this.lowerOutput.innerHTML = this.lowerBoundSlider.value;
        this.upperOutput.innerHTML = this.upperBoundSlider.value;
        
        this.createMapModal();
        this.addMapButton();
        this.addDropdownListeners();
        this.addSliderListeners();
    };

    createMapModal() {
        const modalHTML = `
            <div class="modal fade sensor-map-modal" id="sensorMapModal" tabindex="-1" role="dialog" aria-labelledby="sensorMapModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="sensorMapModalLabel">Sensor Location Map</h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body p-0" id="mapModalBody">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    
        this.sensorMapModal = $('#sensorMapModal');
    };

    addMapButton() {
        const mapButton = document.createElement('button');
        mapButton.textContent = 'Map';
        mapButton.className = 'btn btn-secondary btn-block mt-2';
        mapButton.style.marginTop = '10px';
        mapButton.onclick = () => {
            this.showSensorMap();
        };
        
        const dropdowns = this.sidebarElement.querySelectorAll('.dropdown');
        const lastDropdown = dropdowns[dropdowns.length - 1];
        lastDropdown.insertAdjacentElement('afterend', mapButton);
    };

    showSensorMap() {
        this.sensorMapModal.modal('show');
        
        fetch('/get_sensor_map')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load sensor map');
                }
                return response.text();
            })
            .then(mapHtml => {
                const modalBody = document.getElementById('mapModalBody');
                modalBody.innerHTML = mapHtml;
            })
            .catch(error => {
                console.error('Error loading sensor map:', error);
                const modalBody = document.getElementById('mapModalBody');
                modalBody.innerHTML = `
                    <div class="alert alert-danger m-3" role="alert">
                        <strong>Error:</strong> Failed to load sensor map. Please try again later.
                    </div>
                `;
            });
    };

    addSliderListeners() {
        this.lowerBoundSlider.oninput = () => {
            let val = this.lowerBoundSlider.value;
            this.lowerOutput.innerHTML = val;
        }
       
        this.lowerBoundSlider.onchange = () => {
            let val = this.lowerBoundSlider.value;
            this.eventBus.emit('lower_bound_selected', val);
        }
       
        this.upperBoundSlider.oninput = () => {
            let val = this.upperBoundSlider.value;
            this.upperOutput.innerHTML = val;
        }
       
        this.upperBoundSlider.onchange = () => {
            let val = this.upperBoundSlider.value;
            this.eventBus.emit('upper_bound_selected', val);
        }
    };
    
    addDropdownListeners() {
        this.lewis6dropdownButton.addEventListener('click', () => {
            this.loadActiveSensors({sensor_type: 'l6'});
        });
        this.lewis7dropdownButton.addEventListener('click', () => {
            this.loadActiveSensors({sensor_type: 'l7'});
        });
    };
    
    loadActiveSensors({sensor_type}) {
        console.assert(sensor_type === 'l6' || sensor_type === 'l7', 'did not provide sensor type');
        
        let dropdown = null;
        let otherDropdown = null;
        
        if (sensor_type === 'l6') {
            dropdown = this.lewis6buttoncontainer;
            otherDropdown = this.lewis7buttoncontainer;
        } else {
            dropdown = this.lewis7buttoncontainer;
            otherDropdown = this.lewis6buttoncontainer;
        }
        
        $(otherDropdown).children().remove();

        fetch(`/get_active_sensors?sensor_type=${sensor_type}`)
            .then(response => response.json())
            .then(data => {
                this.updateSidebarButtons(data, dropdown);
            })
            .catch(error => console.error('Error loading active sensors:', error));
    };

    updateSidebarButtons(sensors, dropdown) {
        $(dropdown).children().remove();
        
        let header = document.createElement('h6');
        header.className = 'dropdown-header';
        header.textContent = dropdown.id === 'lewis-6-sidebar-buttons' ? 'Lewis 6 Sensors' : 'Lewis 7 Sensors';
        dropdown.appendChild(header);
        
        if (!sensors || sensors.length === 0) {
            let noDataItem = document.createElement('a');
            noDataItem.textContent = 'No active sensors';
            noDataItem.className = 'dropdown-item disabled';
            noDataItem.href = '#';
            dropdown.appendChild(noDataItem);
            return;
        }
        
        sensors.forEach(sensor => {
            let button = document.createElement('button');
            button.textContent = `${sensor}`;
            button.className = 'dropdown-item';
            button.onclick = () => {
                this.eventBus.emit('sensor_id_selected', sensor);
            };
            dropdown.appendChild(button);
        });
    };
};