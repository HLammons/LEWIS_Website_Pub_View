export class TableBuilder {

    buildTable(labels, filteredTableData) {
        const tableId = 'sensorDataTable';
        const tableBody = $(`#${tableId} tbody`);
        tableBody.empty();        

        let tHeaderLabels = labels;
        let tBodyEntries = filteredTableData;
        this.populateTable(tableId, tHeaderLabels, tBodyEntries);

        const csvString = this.generateCSV(tHeaderLabels, tBodyEntries);
        return csvString;
    };

    populateTable(tableId, headers, entries) {
        const table = $(`#${tableId}`);
        const tableHead = table.find('thead');
        const tableBody = table.find('tbody');
        
        tableHead.empty();
        tableBody.empty();
        
        const headerRow = '<tr>' + headers.map(header => `<th>${header}</th>`).join('') + '</tr>';
        tableHead.append(headerRow);
        
        entries.forEach(entry => {
            const row = '<tr>' + entry.map(value => {
                if (value instanceof Date) {
                    return `<td>${moment(value).format('YYYY-MM-DD HH:mm:ss:SS')}</td>`;
                }
                return `<td>${value}</td>`;
            }).join('') + '</tr>';
            tableBody.append(row);
        });
    };

    generateCSV(headers, entries) {
        const headerRow = headers.join(',');

        const dataRows = entries.map(entry => {
            return entry.map(value => {
                if (value instanceof Date) {
                    return moment(value).format('YYYY-MM-DD HH:mm:ss:SS');
                }

                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }

                return stringValue;
            }).join(',');
        }).join('\n');
        
        return `${headerRow}\n${dataRows}`;
    };
};

// Array(3) [ {…}, {…}, {…} ]

// 0: Object { label: "accel_x", xValues: (1996) […], yValues: (1996) […] }

// 1: Object { label: "accel_y", xValues: (1996) […], yValues: (1996) […] }

// 2: Object { label: "accel_z", xValues: (1996) […], yValues: (1996) […] }

// <prototype>: Array []