
function processData() {

    const inputData = document.getElementById('dataInput').value;
    let table = document.getElementById('outputTable');

    // split by new lines
    const inputArrayLines = inputData.split("\n");
    // console.log(inputArrayLines);

    // split again by tabs to turn in 2d array
    const arrayTabs = inputArrayLines.map(item => item.split('\t'));
    // console.log(arrayTabs);

    // flatten 2d array grouped by col 0 (encounter)
    const grouped = arrayTabs.reduce((acc, row) => {
        const key = row[0];
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(row);
        return acc;
    }, {});
    const groupedArray = Object.values(grouped).map(group => group.flat());

    console.log(groupedArray);

    const cleanArray = groupedArray.map(row => {

        const col1 = row[0]; //encounter identifier

        const col2 = row[4]; //name

        const col3 = row[5]; //DOB

        const col4 = row[8]; //sex

        var col6 = false; //CLV found? "Cormack-Lehane Video View"
        var col10 = ""; //CLV score
        var clvIndex = row.indexOf('Cormack-Lehane Video View');
        if (clvIndex != -1) {
            col6 = true;
            col10 = row[clvIndex + 1];
        }
        
        var col7 = false; //POGOV found? "POGO Video View"
        var col11 = ""; //POGOV score
        var pogvIndex = row.indexOf('POGO Video View');
        if (pogvIndex != -1) {
            col7 = true;
            col11 = row[pogvIndex + 1];
        }

        var col8 = false; //VL found? "Video Laryngoscope"
        var col9 = ""; //VL type
        var vidLIndex = row.indexOf('Video Laryngoscope');
        if (vidLIndex != -1) {
            col8 = true;
            col9 = row[vidLIndex + 1];
        }

        var col5 = false; // VL used?
        if (col6 || col7 || col8) {
            col5 = true;
        }

        if (col5 && vidLIndex == -1) { //IF VIDEO LARYNGOSCOPY NOT FOUND, BUT VL USED
            col9 = "VL Type Not Specified";
        }

        const dateOT = row[13]; // date and time
        
        const dateString = String(dateOT);
        console.log(dateString);
        var dateParts = dateString.split(" ")[0].split("/");
        var formattedDate = new Date(`${dateParts[1]}/${dateParts[0]}/${dateParts[2]} ${dateString.split(" ")[1]}`);
        var dayOfWeek = formattedDate.getDay();
        var hourOfDay = formattedDate.getHours();
        var isAfterHours = (dayOfWeek === 0 || dayOfWeek === 6) || (hourOfDay < 8 || hourOfDay >= 16);
        var month = formattedDate.getMonth() + 1;
        console.log(month)
        var year = formattedDate.getFullYear();
        console.log(year)

        const col121 = String(month);
        const col12 = String(year);

        const col131 = dateOT;
        const col13 = String(isAfterHours);

        var col14 = ""; // area
        const area = String(row[3]);
        if (area.includes('PAMOT')) {
            col14 = "Main OT";
        } else if (area.includes('PAEND')) {
            col14 = "Endoscopy";
        } else if (area.includes('PAHCL')) {
            col14 = "Cath Lab";
        } else if (area.includes('PADST')) {
            col14 = "Day Surgery";
        } else if (area.includes('PAOOT')) {
            col14 = "Radiology";
        } else {
            col14 = area;
        }
        
        const col16 = row[9]; // ASA

        var ASA = String(row[9]);
        var col17 = "";
        if (ASA.includes('E')) {
            col17 = "Emergency";
        }

        var operator = "";
        if (row.includes('Registrar')) {
            operator = "Registrar";
        } else if (row.includes('Fellow')) {
            operator = "Fellow";
        } else if (row.includes('Consultant')) {
            operator = "Consultant";
        } else if (row.includes('Resident')) {
            operator = "Resident";
        } else {
            operator = String(row[12]);
        }
        var col18 = operator;

        // return [col1, col2, col3, col4, col5, col6, col7, col8, col9, col10, col11];
        return [col4, col5, col9, col10, col11, col121, col12, col131, col13, col14, col17, col16, col18, col2, col3];
    });

    for (let subArr of cleanArray) {
        let tr = document.createElement('tr');
        
        for (let elem of subArr) {
            let td = document.createElement('td');
            td.textContent = elem;
            tr.appendChild(td);
        }
        
        table.appendChild(tr);
    }

    if (table && table.rows.length > 0) {
        // Remove the last row
        table.deleteRow(-1);
    }
}

async function copyTableToClipboard() {
    // Get the table element
    const table = document.getElementById('outputTable');
    
    // Get the button element (assuming it's the element that triggered the function)
    const button = event.target;
    
    // Check if table exists
    if (!table) {
        showTemporaryMessage(button, 'Table not found!', 'red');
        return;
    }

    // Convert table to text
    let tableText = '';
    
    // Iterate through rows
    for (let i = 0; i < table.rows.length; i++) {
        let rowText = '';
        
        // Iterate through cells in each row
        for (let j = 0; j < table.rows[i].cells.length; j++) {
            // Add cell text, separated by tabs
            rowText += table.rows[i].cells[j].textContent;
            
            // Add a tab between cells, but not after the last cell
            if (j < table.rows[i].cells.length - 1) {
                rowText += '\t';
            }
        }
        
        // Add row text with a newline
        tableText += rowText + '\n';
    }
    
    // Use Clipboard API to write the table text to the clipboard
    try {
        await navigator.clipboard.writeText(tableText);
        showTemporaryMessage(button, 'Copied!', 'green');
    } catch (err) {
        showTemporaryMessage(button, 'Copy failed', 'red');
        console.error('Failed to copy table text: ', err);
    }
}


function showTemporaryMessage(referenceElement, message, color) {
    // Create message element
    const messageElement = document.createElement('span');
    messageElement.textContent = message;
    messageElement.style.color = color;
    messageElement.style.marginLeft = '10px';
    messageElement.style.transition = 'opacity 0.5s';
    
    // Insert message next to the button
    referenceElement.parentNode.insertBefore(messageElement, referenceElement.nextSibling);
    
    // Remove message after 2 seconds
    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            messageElement.remove();
        }, 500);
    }, 2000);
}