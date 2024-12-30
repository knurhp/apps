function convertDate() {
    // Get the input data from the textarea
    let inputCSV = document.getElementById('dataInput').value;

    // Parse the input CSV into an array of strings
    let rows = inputCSV.trim().split('\n');

    // Function to convert a date to the desired format
    function convertDateStr(dateStr) {
        let dateObj = new Date(dateStr);
        let day = dateObj.getDate();
        let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let month = dateObj.getMonth() + 1;
        let year = dateObj.getFullYear(); // Adjust the year format
        return `${day}\/${month}\/${year}`;
    }

    // Convert each row into the desired format
    let cleanArray = rows.map(row => [convertDateStr(row)]);

    // Get the output table element
    let table = document.getElementById('outputTable');

    // Clear any existing rows in the table
    table.innerHTML = '';

    // Populate the table
    for (let subArr of cleanArray) {
        let tr = document.createElement('tr');
        for (let elem of subArr) {
            let td = document.createElement('td');
            td.textContent = elem;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}
