/**
 * Reads raw text from the textarea, parses and merges repeated rows
 * by CASE_NUMBER, and displays the result in a table.
 */
function cleanData() {
    // Read the multiline text from the textarea
    const rawText = document.getElementById('dataInput').value;
  
    // Split all lines (accounting for Windows or Unix line breaks)
    const lines = rawText.split(/\r?\n/);
  
    // We expect the first 35 lines to be the column headers:
    // (Adjust this if the number of columns changes.)
    
    // Detect header lines: assume headers are the lines before the first actual CASE_NUMBER
    let headerEndIndex = lines.findIndex(line => /^RLMOT/.test(line));
    const columnHeaders = lines.slice(0, headerEndIndex).map(h => h.trim());
    const numCols = columnHeaders.length;
    const dataLines = lines.slice(headerEndIndex);

    if (lines.length < numCols) {
      alert("Not enough lines to form headers plus data!");
      return;
    }
    
    // We will store each record by 'CASE_NUMBER' in a dictionary
    // Format: { [caseNumber]: {colName1: val1, colName2: val2, ...} }
    const records = {};
  
    // Keep track of the most recent CASE_NUMBER (for the blank case-number rule)
    let lastCaseNumber = "";
  
    // Process the data lines in chunks of 'numCols' (35) each
    // Each chunk corresponds to one "row" of data (which might be partial or repeated).
    for (let i = 0; i < dataLines.length; i += numCols) {
      // Slice out one chunk (35 lines). If we reach the end and it's incomplete, break or handle carefully.
      const rowChunk = dataLines.slice(i, i + numCols);
  
      // Build an object for these 35 columns
      const rowObj = {};
      for (let colIndex = 0; colIndex < numCols; colIndex++) {
        let colName = columnHeaders[colIndex];
        // If rowChunk[colIndex] is undefined (incomplete chunk at the end), treat as empty string
        let value = rowChunk[colIndex] ? rowChunk[colIndex].trim() : "";
        rowObj[colName] = value;
      }
  
      // Check the CASE_NUMBER for this row
      let currentCaseNumber = rowObj["CASE_NUMBER"];
      if (!currentCaseNumber) {
        // If blank, use the last known case number
        currentCaseNumber = lastCaseNumber;
      }
      // If there's still no case number, skip (or continue)
      if (!currentCaseNumber) {
        // Possibly skip or continue if truly no valid case number is known
        continue;
      }
      
      // Ensure a record object is created for this case number
      if (!records[currentCaseNumber]) {
        records[currentCaseNumber] = {};
      }
  
      // Merge data:
      // For each column, if we have new data that is not empty,
      // and it's different from what we already have, we can either
      // overwrite or combine with semicolons. Common approach is:
      //   - if the column can have multiple entries (e.g. 'PROCEDURE'), you might want to join them.
      //   - if the column is typically single-valued, you might prefer not to overwrite or to overwrite only if blank.
      // Below is a simple approach that appends new values with "; " if different.
  
      columnHeaders.forEach(colName => {
        const existingVal = records[currentCaseNumber][colName] || "";
        const newVal = rowObj[colName];
  
        // If there's no existing value, just take the new value
        if (!existingVal && newVal) {
          records[currentCaseNumber][colName] = newVal;
        }
        // If both exist and are different, combine them (to avoid losing any data)
        else if (existingVal && newVal && existingVal !== newVal) {
          // Only combine if not already present
          if (!existingVal.includes(newVal)) {
            records[currentCaseNumber][colName] = existingVal + "; " + newVal;
          }
        }
        // If existing is nonempty and newVal is empty, we do nothing (keep existing).
        // If they are the same, also do nothing.
      });
  
      // Update lastCaseNumber
      lastCaseNumber = currentCaseNumber;
    }
  
    // Now we have a dictionary of records keyed by CASE_NUMBER.
    // We want to display them in a table with one row per record.
    
    // Convert records object to an array of objects
    const recordArray = Object.keys(records).map(caseNo => {
      return records[caseNo];
    });
  
    // Generate an HTML table
    const table = document.createElement("table");
    table.border = "1";
    table.style.borderCollapse = "collapse";
  
    // Create the header row
    const headerRow = document.createElement("tr");
    columnHeaders.forEach(col => {
      const th = document.createElement("th");
      th.appendChild(document.createTextNode(col));
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
  
    // Create data rows
    for (let recordObj of recordArray) {
      const tr = document.createElement("tr");
      columnHeaders.forEach(col => {
        const td = document.createElement("td");
        const textVal = recordObj[col] ? recordObj[col] : "";
        td.appendChild(document.createTextNode(textVal));
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }
  
    // Clear previous results and append the new table
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";
    resultsDiv.appendChild(table);
  }
  