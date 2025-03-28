function processData() {
  const rawData = document.getElementById("rawDataInput").value.trim();
  if (!rawData) return;

  const lines = rawData.split(/\r?\n/).filter(line => line.trim() !== "");
  const headerLine = lines[0];
  const headers = headerLine.split(/\t/);

  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[h.trim()] = i;
  });

  const dataRows = lines.slice(1);
  let casesMap = {};
  let orderedCases = [];
  let lastCaseNumber = null;

  dataRows.forEach(line => {
    const cols = line.split(/\t/);
    let caseNum = cols[colIndex["CASE_NUMBER"]] || "";
    caseNum = caseNum.trim();

    if (!caseNum) {
      caseNum = lastCaseNumber;
    } else {
      lastCaseNumber = caseNum;
    }
    if (!caseNum) return;

    if (!casesMap[caseNum]) {
      casesMap[caseNum] = [];
      orderedCases.push(caseNum);
    }
    casesMap[caseNum].push(cols);
  });

  const cleanedData = [];
  const sharedCols = [
    "CASE_NUMBER", "MRN", "SURNAME", "GIVEN NAME(S)", "SEX", "DOB", "TYPE", "WARD",
    "OPERATING THEATRE", "CONSULTANT", "CLASSIFICATION", "STARTED", "FINISHED",
    "SPECIALTY", "IN ANAESTHETIC", "IN OT", "SURGICAL START TIME", "SURGICAL END TIME",
    "OUT ANAES", "OUT THEATRE", "NUMBER OF SPECIMENS USED", "ANAESTHETICS USED",
    "PROSTHESIS USED", "DELAYS (MIN)"
  ];

  const procedureCols = [
    "PROCEDURE", "PROCEDURE START TIME", "PROCEDURE END TIME", "SURGICAL CONSULTANT",
    "SURGEON - PRINCIPAL", "SURGEON - ASSISTING", "ANAESTHETIST - PRINCIPAL",
    "ANAESTHETIST - ASSISTING", "NURSE - ANAESTHETIC", "NURSE - PRIMARY INSTRUMENT",
    "NURSE - CIRCULATING"
  ];

  let maxProcedureCount = 0;
  const caseProcedureCounts = {};
  orderedCases.forEach(caseNum => {
    const rowCount = casesMap[caseNum].length;
    caseProcedureCounts[caseNum] = rowCount;
    if (rowCount > maxProcedureCount) {
      maxProcedureCount = rowCount;
    }
  });

  orderedCases.forEach(caseNum => {
    const rows = casesMap[caseNum];
    const firstRow = rows[0];
    const record = {};

    sharedCols.forEach(col => {
      const idx = colIndex[col];
      record[col] = (idx !== undefined && firstRow[idx] !== undefined) 
                      ? firstRow[idx].trim() 
                      : "";
    });

    rows.forEach((cols, procIdx) => {
      const procedureNum = procIdx + 1;

      procedureCols.forEach(pCol => {
        const sourceVal = colIndex[pCol] !== undefined ? cols[colIndex[pCol]] : "";
        record[`${pCol}_${procedureNum}`] = sourceVal ? sourceVal.trim() : "";
      });
    });

    cleanedData.push(record);
  });

  let finalHeaders = [...sharedCols];
  for (let i = 1; i <= maxProcedureCount; i++) {
    procedureCols.forEach(pCol => {
      finalHeaders.push(`${pCol}_${i}`);
    });
  }

  const table = document.getElementById("outputTable");
  table.innerHTML = ""; // Clear existing content

  // Create table header
  const headerRow = document.createElement("tr");
  finalHeaders.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Create table rows
  cleanedData.forEach(rowObj => {
    const tr = document.createElement("tr");
    finalHeaders.forEach(h => {
      const td = document.createElement("td");
      td.textContent = rowObj[h] !== undefined ? rowObj[h] : "";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}
