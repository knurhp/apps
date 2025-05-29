function processRoster() {
    const payrollRawData = document.getElementById('payrollData').value;
    const rosterRawData = document.getElementById('rosterData').value;
    const allOriginalRosterLines = rosterRawData.split('\n');

    const headerRowIndexInOriginal = 10;

    if (allOriginalRosterLines.length < headerRowIndexInOriginal + 1) {
        alert("Not enough roster data. Expected at least " + (headerRowIndexInOriginal + 1) + " lines for headers.");
        return;
    }

    // --- 1. Extract Date Range for Title (from Roster Data) ---
    let reportDateRange = "Unknown Date Range";
    if (allOriginalRosterLines.length > 1 && allOriginalRosterLines[1]) {
        const dateRangeLine = allOriginalRosterLines[1];
        const dateRangeMatch = dateRangeLine.match(/Date range (.+)/i);
        if (dateRangeMatch && dateRangeMatch[1]) {
            reportDateRange = dateRangeMatch[1].trim();
        } else {
            console.warn("Could not extract date range from roster data line: ", dateRangeLine);
        }
    } else {
        console.warn("Date range line (expected at row 2 of roster data) is missing.");
    }
    document.getElementById('rosterTitle').textContent = `Roster for: ${reportDateRange}`;

    // --- 2. Collect All Roster Short Names ---
    const collectedRosterShortNames = new Set();
    
    // First, try to extract from payroll data if available
    if (payrollRawData.trim() !== '') {
        const payrollLines = payrollRawData.split('\n');
        const usersLinePattern = /\[users:([^\]]+)\]/i;
        for (let i = 0; i < payrollLines.length; i++) {
            const match = payrollLines[i].match(usersLinePattern);
            if (match && match[1]) {
                match[1].split(',').forEach(u => {
                    const trimmedUser = u.trim();
                    if (trimmedUser) collectedRosterShortNames.add(trimmedUser);
                });
                break;
            }
        }
    }
    
    // Also collect from roster data as fallback
    const usersLinePattern = /\[users:([^\]]+)\]/i;
    for (let i = 0; i < Math.min(headerRowIndexInOriginal, allOriginalRosterLines.length); i++) {
        const match = allOriginalRosterLines[i].match(usersLinePattern);
        if (match && match[1]) {
            match[1].split(',').forEach(u => {
                const trimmedUser = u.trim();
                if (trimmedUser) collectedRosterShortNames.add(trimmedUser);
            });
            break;
        }
    }

    // --- 3. Identify Roster Headers and Column Indices ---
    const rosterHeaderLine = allOriginalRosterLines[headerRowIndexInOriginal];
    if (!rosterHeaderLine || rosterHeaderLine.trim() === '') {
        alert(`Roster header line is missing or empty at expected row ${headerRowIndexInOriginal + 1}.`);
        return;
    }
    const rosterHeaders = rosterHeaderLine.split('\t').map(h => h.trim());

    const dateColIdx = rosterHeaders.indexOf("Date");
    const startTimeColIdx = rosterHeaders.indexOf("Start time");
    const endTimeColIdx = rosterHeaders.indexOf("End time");
    const durationColIdx = rosterHeaders.indexOf("Duration in hours (all) (h)");
    const shiftColIdx = rosterHeaders.indexOf("Shift");
    const userColIdx = rosterHeaders.indexOf("User");

    const requiredCols = {};
     requiredCols["Date"] = dateColIdx;
     requiredCols["Start time"] = startTimeColIdx;
     requiredCols["End time"] = endTimeColIdx;
     requiredCols["Duration in hours (all) (h)"] = durationColIdx;
     requiredCols["Shift"] = shiftColIdx;
     requiredCols["User"] = userColIdx;

     for (const colName in requiredCols) {
        if (requiredCols[colName] === -1) {
            alert(`Required roster column "${colName}" not found in the headers.\nHeaders: ${rosterHeaders.join(' | ')}`);
            return;
        }
    }

    // --- 4. Parse Roster Data Rows & Collect More Users ---
    const parsedShiftEntries = [];
    const allRosterDates = new Set();
    const actualRosterDataLines = allOriginalRosterLines.slice(headerRowIndexInOriginal + 1)
        .filter(line => line.trim() !== '');

    if (actualRosterDataLines.length === 0) {
        alert("No data rows found in roster data after the header line.");
        document.getElementById('outputTableContainer').innerHTML = '<p>No roster data to display.</p>';
        return;
    }

    actualRosterDataLines.forEach((line, lineIndex) => {
        const values = line.split('\t').map(v => v.trim());
        if (values.length <= Math.max(dateColIdx, startTimeColIdx, endTimeColIdx, durationColIdx, shiftColIdx, userColIdx)) {
            console.warn(`Skipping roster data line ${headerRowIndexInOriginal + 2 + lineIndex} (insufficient columns).`);
            return;
        }
        const user = values[userColIdx];
        const date = values[dateColIdx];

        if (user) collectedRosterShortNames.add(user);
        if (!user || !date) {
            console.warn(`Skipping roster data line ${headerRowIndexInOriginal + 2 + lineIndex} (missing User or Date).`);
            return;
        }

        const durationStr = values[durationColIdx];
        let durationFormatted = "N/A";
        if (durationStr !== undefined && durationStr.trim() !== "") {
            const durationNum = parseFloat(durationStr);
            if (!isNaN(durationNum)) {
                durationFormatted = durationNum.toFixed(2);
            } else {
                console.warn(`Invalid duration '${durationStr}' for ${user} on ${date}.`);
            }
        } else {
             console.warn(`Empty duration for ${user} on ${date}.`);
        }

        parsedShiftEntries.push({
            date, user,
            startTime: values[startTimeColIdx] || 'N/A',
            endTime: values[endTimeColIdx] || 'N/A',
            duration: durationFormatted,
            shift: values[shiftColIdx] || 'Unknown Shift'
        });
        allRosterDates.add(date);
    });

    if (parsedShiftEntries.length === 0 && collectedRosterShortNames.size === 0) {
        alert("No valid roster data entries or users could be parsed.");
        document.getElementById('outputTableContainer').innerHTML = '<p>No data processed.</p>';
        return;
    }

    // --- 5. Create Payroll Info Mapping ---
    const finalRosterUserList = Array.from(collectedRosterShortNames);
    const userPayrollInfoMap = createShortNameToPayrollInfoMap(payrollRawData, finalRosterUserList);

    // --- 6. Sort Users and Dates for Table Display ---
    const sortedUsersToDisplay = finalRosterUserList.sort((a, b) => {
        // Optional: Sort by full name if available, then by short name
        const payrollA = userPayrollInfoMap.get(a);
        const payrollB = userPayrollInfoMap.get(b);
        const nameA = payrollA ? payrollA.fullName : a;
        const nameB = payrollB ? payrollB.fullName : b;
        return nameA.localeCompare(nameB);
    });
    const sortedDatesToDisplay = Array.from(allRosterDates).sort((a, b) => new Date(a) - new Date(b));

    // --- 7. Create Pivot Data for Table (keyed by roster short name) ---
    const pivotData = {};
    sortedUsersToDisplay.forEach(user => pivotData[user] = {});
    parsedShiftEntries.forEach(entry => {
        if (!pivotData[entry.user]) pivotData[entry.user] = {};
        pivotData[entry.user][entry.date] = {
            shift: entry.shift,
            startTime: entry.startTime,
            endTime: entry.endTime,
            duration: entry.duration
        };
    });

    // --- 8. Generate HTML Table ---
    const tableContainer = document.getElementById('outputTableContainer');
    tableContainer.innerHTML = '';
    const table = document.createElement('table');
    table.id = 'outputTable';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    const userTh = document.createElement('th');
    userTh.textContent = 'User';
    headerRow.appendChild(userTh);

    sortedDatesToDisplay.forEach(date => {
        const dateTh = document.createElement('th');
        dateTh.textContent = date;
        headerRow.appendChild(dateTh);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data Rows
    sortedUsersToDisplay.forEach(rosterUserShortName => {
        const tr = document.createElement('tr');
        const userTd = document.createElement('td');
        
        let displayUserName;
        const payrollInfo = userPayrollInfoMap.get(rosterUserShortName);

        if (payrollInfo) {
            const fullName = payrollInfo.fullName || "N/A Full Name"; 
            const pid = payrollInfo.payrollId; // This will be "" if it was empty in payroll data
            const idDisplay = (pid && pid.trim() !== '') ? `(${pid})` : "";
            displayUserName = `(${fullName}) ${idDisplay} (${rosterUserShortName})`.replace(/\s+/g, ' ').trim();
        } else {
            displayUserName = `(${rosterUserShortName}) (No Payroll Match)`;
        }
        
        userTd.textContent = displayUserName;
        tr.appendChild(userTd);

        sortedDatesToDisplay.forEach(date => {
            const cellTd = document.createElement('td');
            const shiftInfo = pivotData[rosterUserShortName] && pivotData[rosterUserShortName][date];
            const cellDiv = document.createElement('div');
            if (shiftInfo) {
                cellDiv.innerHTML = `${shiftInfo.startTime} - ${shiftInfo.endTime}<br> | (${shiftInfo.duration}h)<br> | ${shiftInfo.shift}`;
            } else {
                cellDiv.innerHTML = '\u00A0'; // Use non-breaking space for empty cells to maintain layout
            }
            cellTd.appendChild(cellDiv);
            tr.appendChild(cellTd);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);
}

// Helper function to create the mapping from Roster Short Name to Payroll Info
function createShortNameToPayrollInfoMap(payrollRawData, allRosterShortNames) {
    const shortNameToPayrollInfo = new Map();
    const parsedPayrollEntries = [];
    let payrollShortNames = [];

    // console.log("--- Starting Payroll Mapping ---"); // Uncomment for debugging
    // console.log("Roster Short Names to Match:", Array.from(allRosterShortNames)); // Uncomment for debugging

    if (payrollRawData.trim() !== '') {
        const payrollLines = payrollRawData.split('\n');
        
        // First, extract the short names from the [users: ...] line
        const usersLinePattern = /\[users:([^\]]+)\]/i;
        for (let i = 0; i < payrollLines.length; i++) {
            const match = payrollLines[i].match(usersLinePattern);
            if (match && match[1]) {
                payrollShortNames = match[1].split(',').map(u => u.trim()).filter(u => u);
                break;
            }
        }
        
        let payrollHeaderFound = false;
        const nameHeader = "Name".toLowerCase();
        const payrollIdHeader = "Payroll ID".toLowerCase();
        let nameColIdx = -1;
        let idColIdx = -1;

        for (let i = 0; i < payrollLines.length; i++) {
            const line = payrollLines[i].trim();
            if (line.toLowerCase().includes(nameHeader) && line.toLowerCase().includes(payrollIdHeader)) {
                const headers = line.split('\t').map(h => h.trim().toLowerCase());
                nameColIdx = headers.indexOf(nameHeader);
                idColIdx = headers.indexOf(payrollIdHeader);
                payrollHeaderFound = true;

                for (let j = i + 1; j < payrollLines.length; j++) {
                    const dataLine = payrollLines[j].trim();
                    if (dataLine === '') continue;
                    const values = dataLine.split('\t').map(v => v.trim());

                    if (nameColIdx !== -1 && values.length > nameColIdx) {
                        const fullName = values[nameColIdx];
                        const payrollId = (idColIdx !== -1 && values.length > idColIdx) ? values[idColIdx] : "";
                        if (fullName && fullName.includes(',')) {
                            parsedPayrollEntries.push({ fullName, payrollId: payrollId || "" });
                        } else if (fullName) {
                            console.warn(`Payroll entry "${fullName}" not 'Last, First' format. Skipping.`);
                        }
                    }
                }
                break;
            }
        }
        if (!payrollHeaderFound) {
            console.warn("Payroll Data: Could not find 'Name' and 'Payroll ID' headers.");
        }
    } else {
        console.info("Payroll data input is empty.");
    }

    // console.log("Parsed Payroll Entries:", parsedPayrollEntries); // Uncomment for debugging
    // console.log("Payroll Short Names:", payrollShortNames); // Uncomment for debugging

    if (parsedPayrollEntries.length === 0 && payrollRawData.trim() !== '') {
        console.warn("No valid payroll entries (expected 'Last, First' format) were parsed.");
    }

    // Match roster short names with payroll data
    allRosterShortNames.forEach(rosterShortName => {
        let matchFoundForThisRosterName = false;
        
        // First try to find matching short name in payroll short names list
        const matchingPayrollShortName = payrollShortNames.find(shortName => 
            shortName.toLowerCase() === rosterShortName.toLowerCase()
        );
        
        if (matchingPayrollShortName) {
            // Find the corresponding full name and payroll ID
            for (const payrollEntry of parsedPayrollEntries) {
                const nameParts = payrollEntry.fullName.split(',');
                if (nameParts.length !== 2) continue;

                const lastNameP = nameParts[0].trim();
                const firstNameP = nameParts[1].trim();

                // Create expected short name format (LastFirst)
                const expectedShortName = lastNameP + firstNameP.charAt(0);
                
                if (expectedShortName.toLowerCase() === rosterShortName.toLowerCase()) {
                    shortNameToPayrollInfo.set(rosterShortName, {
                        fullName: payrollEntry.fullName,
                        payrollId: payrollEntry.payrollId
                    });
                    matchFoundForThisRosterName = true;
                    break;
                }
            }
        }
        
        // If no match found, try the original matching logic as fallback
        if (!matchFoundForThisRosterName) {
            for (const payrollEntry of parsedPayrollEntries) {
                const nameParts = payrollEntry.fullName.split(',');
                if (nameParts.length !== 2) continue;

                const lastNameP = nameParts[0].trim();
                const firstNameP = nameParts[1].trim();

                if (rosterShortName.toLowerCase().startsWith(lastNameP.toLowerCase())) {
                    const expectedFirstNamePartInShort = rosterShortName.substring(lastNameP.length);
                    if (firstNameP.toLowerCase().startsWith(expectedFirstNamePartInShort.toLowerCase())) {
                        shortNameToPayrollInfo.set(rosterShortName, {
                            fullName: payrollEntry.fullName,
                            payrollId: payrollEntry.payrollId
                        });
                        matchFoundForThisRosterName = true;
                        break;
                    }
                }
            }
        }
        
        // Optional: More detailed logging during development
        /*
        if (!matchFoundForThisRosterName && parsedPayrollEntries.length > 0) {
            console.warn(`FINAL: No payroll match found for roster user: "${rosterShortName}"`);
        } else if (matchFoundForThisRosterName) {
            const matchedInfo = shortNameToPayrollInfo.get(rosterShortName);
            if (!matchedInfo.payrollId || matchedInfo.payrollId.trim() === "") {
                console.log(`FINAL: Payroll name match for "${rosterShortName}" (${matchedInfo.fullName}), Payroll ID is MISSING/EMPTY.`);
            } else {
                console.log(`FINAL: Payroll name match for "${rosterShortName}" (${matchedInfo.fullName}), ID: "${matchedInfo.payrollId}".`);
            }
        }
        */
    });
    // console.log("--- Finished Payroll Mapping ---"); // Uncomment for debugging
    return shortNameToPayrollInfo;
}

// Basic copyTableToClipboard function (ensure it works for your needs)
function copyTableToClipboard() {
    const table = document.getElementById('outputTable');
    if (!table) {
        alert('No table found to copy.');
        return;
    }
    let range, sel;
    if (document.createRange && window.getSelection) {
        range = document.createRange();
        sel = window.getSelection();
        sel.removeAllRanges();
        try {
            range.selectNodeContents(table);
            sel.addRange(range);
        } catch (e) {
            range.selectNode(table);
            sel.addRange(range);
        }
        document.execCommand('copy');
        sel.removeAllRanges();
        alert('Table copied to clipboard!');
    } else {
        alert('Could not copy the table.');
    }
}
