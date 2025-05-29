function processData() {
    const inputText = document.getElementById('dataInput').value.trim();
    const outputTable = document.getElementById('outputTable');
    outputTable.innerHTML = ''; // Clear previous results

    if (!inputText) {
        alert("Please paste data into the textarea.");
        return;
    }

    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
        alert("Data needs at least a header row and one data row.");
        return;
    }

    const originalHeaders = lines[0].split('\t');
    const dataRows = lines.slice(1).map(line => line.split('\t'));

    const numKeyCols = 17; // Columns A-Q

    const actionPromptIndex = originalHeaders.indexOf('ACTION_PROMPT');
    const actionItemIndex = originalHeaders.indexOf('ACTION_ITEM');
    const actionValueIndex = originalHeaders.indexOf('ACTION_VALUE');

    if (actionPromptIndex === -1 || actionItemIndex === -1 || actionValueIndex === -1) {
        alert("Error: Could not find required columns: 'ACTION_PROMPT', 'ACTION_ITEM', or 'ACTION_VALUE' in the headers.");
        return;
    }

    if (originalHeaders.length < numKeyCols || originalHeaders.length <= Math.max(actionPromptIndex, actionItemIndex, actionValueIndex)) {
        alert(`Data must have at least ${numKeyCols} key columns and the action columns. Check header names and column count.`);
        return;
    }

    const staticKeyHeaders = originalHeaders.slice(0, numKeyCols);
    const dynamicColumnHeaders = new Set();

    const groupedData = new Map();

    dataRows.forEach(row => {
        if (row.length < numKeyCols) {
            console.warn("Skipping malformed row (not enough key columns):", row);
            return;
        }
        const keyParts = row.slice(0, numKeyCols);
        const groupKey = keyParts.join('|||');

        const actionPromptForHeader = row[actionPromptIndex]?.trim(); // This will be the column header
        const currentActionItem = row[actionItemIndex]?.trim();
        const currentActionValue = row[actionValueIndex]?.trim();

        if (!actionPromptForHeader) {
            // If there's no prompt, this specific action row is not useful for dynamic columns
            // but it might belong to a group that has other valid prompts.
            // We'll simply not add a dynamic field from this specific row part.
            return;
        }

        dynamicColumnHeaders.add(actionPromptForHeader);

        if (!groupedData.has(groupKey)) {
            groupedData.set(groupKey, {
                keyData: keyParts,
                dynamicFields: new Map()
            });
        }

        const entry = groupedData.get(groupKey);

        // --- Determine the effective value to store for this prompt ---
        let effectiveValue = '';
        const itemIsPresent = currentActionItem && currentActionItem !== '';
        const valueIsPresent = currentActionValue && currentActionValue !== '';

        if (itemIsPresent && valueIsPresent) {
            // If both are present
            if (currentActionItem.toLowerCase() === currentActionValue.toLowerCase()) {
                // If they are effectively the same (e.g., "Yes" and "yes"), just use one.
                effectiveValue = currentActionItem;
            } else {
                // If different, combine them.
                effectiveValue = `${currentActionItem}: ${currentActionValue}`;
            }
        } else if (valueIsPresent) {
            // Only ACTION_VALUE is present
            effectiveValue = currentActionValue;
        } else if (itemIsPresent) {
            // Only ACTION_ITEM is present
            effectiveValue = currentActionItem;
        }
        // If neither is present, effectiveValue remains an empty string.

        if (!entry.dynamicFields.has(actionPromptForHeader)) {
            entry.dynamicFields.set(actionPromptForHeader, []);
        }
        entry.dynamicFields.get(actionPromptForHeader).push(effectiveValue);
    });

    if (groupedData.size === 0 && dataRows.length > 0) {
        alert("No valid data groups found. Check data format, key columns, and ACTION_PROMPT values.");
        return;
    }
     if (groupedData.size === 0 && dataRows.length === 0) { // Only header was present or input was empty
        alert("No data rows to process after header.");
        return;
    }


    const sortedDynamicHeaders = Array.from(dynamicColumnHeaders).sort();

    const thead = outputTable.createTHead();
    const headerRow = thead.insertRow();

    staticKeyHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    sortedDynamicHeaders.forEach(promptHeader => {
        const th = document.createElement('th');
        th.textContent = promptHeader;
        headerRow.appendChild(th);
    });

    const tbody = outputTable.createTBody();
    groupedData.forEach(group => {
        const dataRow = tbody.insertRow();

        group.keyData.forEach(cellData => {
            const cell = dataRow.insertCell();
            cell.textContent = cellData;
        });

        sortedDynamicHeaders.forEach(promptHeader => {
            const cell = dataRow.insertCell();
            const values = group.dynamicFields.get(promptHeader);
            if (values && values.length > 0) {
                cell.textContent = values.filter(v => v && v !== '').join(' | '); // Join multiple values, filter out empty ones from array
            } else {
                cell.textContent = '';
            }
        });
    });

    console.log("Data processed dynamically with combined item/value.");
}
