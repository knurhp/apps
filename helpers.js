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