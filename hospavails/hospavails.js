document.addEventListener('DOMContentLoaded', () => {
const jsonDataElement = document.getElementById('jsonData');
const statusElement = document.getElementById('status');
const bearerTokenInput = document.getElementById('bearerTokenInput');
const useLocalFileCheckbox = document.getElementById('useLocalFileCheckbox');

const fetchLeavesButton = document.getElementById('fetchLeavesButton');
const fetchUsersButton = document.getElementById('fetchUsersButton');
const fetchUnallocatedButton = document.getElementById('fetchUnallocatedButton');
const fetchShiftTemplatesButton = document.getElementById('fetchShiftTemplatesButton'); // Added this line
const generateUsersTableButton = document.getElementById('generateUsersTableButton');

const usersTableContainer = document.getElementById('usersTableContainer');
const roleFilterDropdown = document.getElementById('roleFilter');
const teamFilterDropdown = document.getElementById('teamFilter');
const rosterGroupFilterDropdown = document.getElementById('rosterGroupFilter'); // RESTORED
const showUnallocatedCheckbox = document.getElementById('showUnallocatedCheckbox'); // Added this line

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');

let lastFetchedUsersData = null;
let lastFetchedLeavesData = null;
let lastFetchedUnallocatedData = null;
let lastFetchedShiftTemplatesData = null; // Added this line

let rolesMap = new Map();
let teamsMap = new Map();
let leaveTypesMap = new Map();

// --- Configuration ---
const LEAVES_LOCAL_FILE_PATH = 'testleave.json';
const USERS_LOCAL_FILE_PATH = 'testusers.json';
const UNALLOCATED_LOCAL_FILE_PATH = 'testunalloc.json';
const SHIFT_TEMPLATES_LOCAL_FILE_PATH = 'testshifts.json'; // Added this line

const LEAVES_API_ENDPOINT = "https://api.hosportal.com/get-leaves-and-leave-requests";
const USERS_API_ENDPOINT = "https://api.hosportal.com/get-site-users";
const UNALLOCATED_API_ENDPOINT = "https://api.hosportal.com/get-unallocated-available-role-instances";
const SHIFT_TEMPLATES_API_ENDPOINT = "https://api.hosportal.com/get-user-shift-templates"; // Added this line

const SITE_ID = "a14c0405-4fb0-432b-9ce3-a5c460dffdf5";
const ROSTER_GROUPS_CONFIG = [
    { id: "75d5cc8d-4b0a-4392-88e1-c3b6bb37056f", name: "RLH Allocations" },
    { id: "a40e918a-af4d-4cb9-bce6-99b5de1a0352", name: "PA Allocations" }
];
// ---------------------

function updateButtonTexts() {
    const useLocal = useLocalFileCheckbox.checked;
    if (fetchLeavesButton) {
        fetchLeavesButton.textContent = useLocal ? `Leaves from ${LEAVES_LOCAL_FILE_PATH}` : 'Leaves from API';
    }
    if (fetchUsersButton) {
        fetchUsersButton.textContent = useLocal ? `Users from ${USERS_LOCAL_FILE_PATH}` : 'Users from API';
    }
    if (fetchUnallocatedButton) {
        fetchUnallocatedButton.textContent = useLocal ? `Unallocated from ${UNALLOCATED_LOCAL_FILE_PATH}` : 'Unallocated from API';
    }
    if (fetchShiftTemplatesButton) { // Added this block
        fetchShiftTemplatesButton.textContent = useLocal ? `Shift Templates from ${SHIFT_TEMPLATES_LOCAL_FILE_PATH}` : 'Shift Templates from API';
    }
    if (generateUsersTableButton) {
        generateUsersTableButton.textContent = useLocal ? `Table from Local Files` : 'Table from API Data';
    }
    statusElement.textContent = useLocal ?
        'Ready. Click a button to load from local file.' :
        'Enter token (if needed) and click a button to load from API.';
}

function getSelectedValues(selectElement) {
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
    if (selectedOptions.length === 0 || selectedOptions.includes("All")) {
        return ["All"];
    }
    return selectedOptions;
}

async function performFetch(url, requestOptions = {}, isLocalFile = false, localFilePath = '', dataType = 'other') {
    const dataSource = isLocalFile ? localFilePath : `API (${url ? url.substring(url.lastIndexOf('/') + 1) : 'N/A'})`;
    statusElement.textContent = `Fetching ${dataType} data from ${dataSource}...`;
    statusElement.className = '';

    try {
        let response;
        if (isLocalFile) {
            response = await fetch(localFilePath);
        } else {
            const token = bearerTokenInput.value.trim();
            if (!token) throw new Error('Bearer token is required for API calls.');
            const headers = new Headers(requestOptions.headers || {});
            if (!headers.has("Authorization")) {
                headers.set("Authorization", `Bearer ${token}`);
            }
            if (!headers.has("Content-Type") && requestOptions.method === 'POST' && requestOptions.body) {
                headers.set("Content-Type", "application/json");
            }
            requestOptions.headers = headers;
            response = await fetch(url, requestOptions);
        }

        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`;
            let errorBodyText = 'Could not read error body.';
            try { errorBodyText = await response.text(); errorMsg += ` - Body: ${errorBodyText}`; } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (dataType === 'users') {
            lastFetchedUsersData = result;
            rolesMap = new Map((lastFetchedUsersData.roles || []).map(role => [role.id, role.name]));
            teamsMap = new Map((lastFetchedUsersData.teams || []).map(team => [team.id, team.name]));
            populateFilterDropdowns(lastFetchedUsersData);
            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `Users data loaded successfully from ${dataSource}!`;
        } else if (dataType === 'leaves') {
            lastFetchedLeavesData = result;
            leaveTypesMap = new Map((lastFetchedLeavesData.leaveTypes || []).map(lt => [lt.id, lt.name]));
            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `Leaves data loaded successfully from ${dataSource}!`;
        } else if (dataType === 'unallocated' && isLocalFile) {
            lastFetchedUnallocatedData = result;
            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `Unallocated data loaded successfully from ${dataSource}!`;
        } else if (dataType === 'shift_templates') { // Added this block
            lastFetchedShiftTemplatesData = result;
            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `Shift Templates data loaded successfully from ${dataSource}!`;
        }
        return result;

    } catch (error) {
        console.error(`Error fetching ${dataType} data from ${dataSource}:`, error);
        jsonDataElement.textContent = `An error occurred fetching ${dataType} data:\n${error.message}`;
        statusElement.textContent = `Failed to load ${dataType} data from ${dataSource}.`;
        statusElement.className = 'error';
        if (dataType === 'users') lastFetchedUsersData = null;
        if (dataType === 'leaves') lastFetchedLeavesData = null;
        if (dataType === 'unallocated') lastFetchedUnallocatedData = null;
        if (dataType === 'shift_templates') lastFetchedShiftTemplatesData = null; // Added this line
        throw error;
    }
}

async function fetchLeavesDataAndDisplayJson() {
    try {
        await performFetch(LEAVES_API_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ "siteId": SITE_ID, "statuses": ["waiting", "denied", "approved"], "associations": ["LeaveType", "RoleInstance"] }),
            redirect: 'follow'
        }, useLocalFileCheckbox.checked, LEAVES_LOCAL_FILE_PATH, 'leaves');
    } catch (e) { /* Handled by performFetch */ }
}

async function fetchUsersDataAndDisplayJson() {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
        "siteId": SITE_ID,
        "associations": [
            "Role", "Skill", "Team", "SiteUserProfile",
            "RoleInstanceInformation", "RoleInstanceFte"
        ]
    });
    const requestOptions = {
        method: 'POST', headers: myHeaders, body: raw, redirect: 'follow'
    };
    try {
        await performFetch(
            USERS_API_ENDPOINT, requestOptions,
            useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, 'users'
        );
    } catch (e) { /* Handled by performFetch */ }
}

async function fetchShiftTemplatesDataAndDisplayJson() { // Added this function
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      "siteId": SITE_ID
    });
    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    try {
        await performFetch(
            SHIFT_TEMPLATES_API_ENDPOINT, requestOptions,
            useLocalFileCheckbox.checked, SHIFT_TEMPLATES_LOCAL_FILE_PATH, 'shift_templates'
        );
    } catch (e) { /* Handled by performFetch */ }
}

async function triggerGenerateUsersTable() {
    usersTableContainer.innerHTML = 'Generating table, fetching data if needed...';
    try {
        const isLocal = useLocalFileCheckbox.checked;
        // Fetch users, leaves, shift-templates if not already loaded
        if (!lastFetchedUsersData) await fetchUsersDataAndDisplayJson();
        if (!lastFetchedLeavesData) await fetchLeavesDataAndDisplayJson();
        if (!lastFetchedShiftTemplatesData) await fetchShiftTemplatesDataAndDisplayJson();

        // Now build the table using only these three sources
        generateUsersTableFromData(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedShiftTemplatesData);
    } catch (error) {
        usersTableContainer.innerHTML = `<span class='error'>Error generating table: ${error.message}</span>`;
    }
}

// Helper to build the table from users, leaves, and shift-templates
function generateUsersTableFromData(usersData, leavesData, shiftTemplatesData) {
    // 1. Get users
    const users = (usersData && usersData.users) ? usersData.users : [];
    if (!users.length) {
        usersTableContainer.innerHTML = '<span class="error">No users found.</span>';
        return;
    }
    // 2. Get leaves
    const leaves = (leavesData && leavesData.leaves) ? leavesData.leaves : [];
    // 3. Get shift templates
    const shiftTemplates = (shiftTemplatesData && shiftTemplatesData.userShiftTemplates) ? shiftTemplatesData.userShiftTemplates : [];

    // 4. Build date range from UI
    const fromDateStr = fromDateInput.value;
    const toDateStr = toDateInput.value;
    if (!fromDateStr || !toDateStr) {
        usersTableContainer.innerHTML = '<span class="error">Please select a date range.</span>';
        return;
    }
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);
    if (isNaN(fromDate) || isNaN(toDate)) {
        usersTableContainer.innerHTML = '<span class="error">Invalid date range.</span>';
        return;
    }
    // Build list of dates (no timezone conversion)
    const dateList = [];
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        dateList.push(d.toISOString().slice(0, 10));
    }

    // 5. Build leaves map: userId -> date -> AM/PM -> leaveType
    const leavesMap = new Map();
    for (const leave of leaves) {
        const userId = leave.siteUserId;
        const leaveDate = leave.date;
        const am = leave.am;
        const pm = leave.pm;
        if (!leavesMap.has(userId)) leavesMap.set(userId, {});
        if (!leavesMap.get(userId)[leaveDate]) leavesMap.get(userId)[leaveDate] = {};
        if (am) leavesMap.get(userId)[leaveDate]['AM'] = leave.leaveTypeId;
        if (pm) leavesMap.get(userId)[leaveDate]['PM'] = leave.leaveTypeId;
    }

    // 6. Build shift map: userId -> date -> AM/PM -> status (from shift templates)
    const shiftMap = new Map();
    // Helper: get AM/PM for a template
    function getAMPMForTemplate(st) {
        // AM: start hour < 13, PM: start hour >= 13
        if (!st.startTime || typeof st.startTime.hour !== 'number') return ['AM', 'PM'];
        if (st.startTime.hour < 13) return ['AM'];
        return ['PM'];
    }
    // Helper: does template apply to date?
    function templateAppliesToDate(st, dateStr) {
        // Only handle 'none' (one-off) and 'weekly' for now
        if (!st.interval || !st.startDate) return false;
        if (st.interval.type === 'none') {
            // One-off: applies if date matches startDate (or in range startDate-endDate)
            if (st.endDate) {
                return dateStr >= st.startDate && dateStr <= st.endDate;
            } else {
                return dateStr === st.startDate;
            }
        }
        if (st.interval.type === 'weekly') {
            // Weekly recurrence
            const start = new Date(st.startDate);
            const current = new Date(dateStr);
            if (current < start) return false;
            // Check day of week
            const jsDay = current.getDay(); // 0=Sun, 1=Mon, ...
            const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon, 7=Sun
            if (!st.interval.daysOfWeek || !st.interval.daysOfWeek.includes(isoDay)) return false;
            // Check spacing/offset
            const diffDays = Math.floor((current - start) / (1000*60*60*24));
            const weeksSinceStart = Math.floor(diffDays / 7);
            const spacing = st.interval.spacing || 1;
            const offset = st.interval.offset || 0;
            if ((weeksSinceStart - offset) % spacing !== 0) return false;
            return true;
        }
        // TODO: handle other interval types if needed
        return false;
    }
    // Build map
    for (const st of shiftTemplates) {
        const userId = st.roleInstanceId;
        if (!userId) continue;
        for (const date of dateList) {
            if (!templateAppliesToDate(st, date)) continue;
            const ampmList = getAMPMForTemplate(st);
            if (!shiftMap.has(userId)) shiftMap.set(userId, {});
            if (!shiftMap.get(userId)[date]) shiftMap.get(userId)[date] = {};
            for (const ampm of ampmList) {
                shiftMap.get(userId)[date][ampm] = { status: st.type, updatedAt: st.updatedAt };
            }
        }
    }

    // 7. Build table header
    let html = '<table><thead><tr><th>User</th>';
    for (const date of dateList) {
        html += `<th colspan='2'>${date}</th>`;
    }
    html += '</tr><tr><th></th>';
    for (const date of dateList) {
        html += '<th>AM</th><th>PM</th>';
    }
    html += '</tr></thead><tbody>';

    // 8. Build table rows
    for (const user of users) {
        html += `<tr><td>${user.displayName || user.name || user.email}</td>`;
        for (const date of dateList) {
            for (const ampm of ['AM', 'PM']) {
                // Priority: leave > shiftMap > blank
                let cell = '';
                if (leavesMap.has(user.id) && leavesMap.get(user.id)[date] && leavesMap.get(user.id)[date][ampm]) {
                    cell = `<span class='allocated-cell'>On Leave (${leavesMap.get(user.id)[date][ampm]})</span>`;
                } else if (shiftMap.has(user.id) && shiftMap.get(user.id)[date] && shiftMap.get(user.id)[date][ampm]) {
                    const s = shiftMap.get(user.id)[date][ampm];
                    let colorClass = s.status === 'unallocated' ? 'unallocated-cell' : 'allocated-cell';
                    cell = `<span class='${colorClass}'>${s.status.charAt(0).toUpperCase() + s.status.slice(1)}<br><small>${s.updatedAt}</small></span>`;
                } else {
                    cell = '';
                }
                html += `<td>${cell}</td>`;
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    usersTableContainer.innerHTML = html;
}

// Remove fetchUnallocatedDataAndDisplayJson, fetchCombinedUnallocatedDataForApi, and all unallocated logic
// ...existing code...

function getDayOfWeek(dateObj) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dateObj.getUTCDay()];
}

function normalizeDate(dateObj) {
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateUsersTable(usersData, leavesData, unallocatedApiData, shiftTemplatesData, selectedRoleIds, selectedTeamIds) { // Added shiftTemplatesData parameter
    usersTableContainer.innerHTML = '';

    if (!usersData?.siteUsers?.length) { usersTableContainer.innerHTML = '<p class="error">No siteUsers data.</p>'; return; }
    if (!leavesData?.leaves) { usersTableContainer.innerHTML = '<p class="error">Leave data missing/invalid.</p>'; return; }
    if (!shiftTemplatesData) { usersTableContainer.innerHTML = '<p class="error">Shift templates data missing/invalid.</p>'; return; } // Added this check

    const shouldShowUnallocated = showUnallocatedCheckbox.checked;

    const selectedRosterGroupId = rosterGroupFilterDropdown.value;

    // Filter unallocatedApiData arrays based on selectedRosterGroupId
    let currentUnallocatedShifts = (unallocatedApiData.unallocatedUsers || []).slice(); // Array for GREEN "Unalloc."
    let currentUnavailableShifts = (unallocatedApiData.unavailableUsers || []).slice(); // Array for RED "Unavail." (actual shifts)

    if (selectedRosterGroupId && selectedRosterGroupId !== "All") {
        currentUnallocatedShifts = currentUnallocatedShifts.filter(entry => entry.rosterGroupId === selectedRosterGroupId);
        currentUnavailableShifts = currentUnavailableShifts.filter(entry => entry.rosterGroupId === selectedRosterGroupId);
    }
    
    if (!unallocatedApiData || (typeof unallocatedApiData.unallocatedUsers === 'undefined' && typeof unallocatedApiData.unavailableUsers === 'undefined')) {
         usersTableContainer.innerHTML = `<p class="error">Unallocated/Unavailable data structure missing or invalid.</p>`;
         return;
    }

    const fromDateStr = fromDateInput.value;
    const toDateStr = toDateInput.value;
    if (!fromDateStr || !toDateStr) { usersTableContainer.innerHTML = '<p class="error">Please select both "From" and "To" dates.</p>'; return; }
    const fromDate = new Date(fromDateStr + "T00:00:00Z");
    const toDate = new Date(toDateStr + "T23:59:59Z");
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) { usersTableContainer.innerHTML = '<p class="error">Invalid date range selected.</p>'; return; }

    const dateRange = [];
    let currentDateIter = new Date(fromDate.toISOString().slice(0,10) + "T00:00:00Z");
    const toDateLimit = new Date(toDate.toISOString().slice(0,10) + "T00:00:00Z");
    while (currentDateIter <= toDateLimit) {
        dateRange.push(new Date(currentDateIter));
        currentDateIter.setUTCDate(currentDateIter.getUTCDate() + 1);
    }

    const userDailySlotInfo = new Map();

    function getOrCreateDailySlotEntry(roleInstanceId, dateKey) {
        if (!userDailySlotInfo.has(roleInstanceId)) {
            userDailySlotInfo.set(roleInstanceId, new Map());
        }
        const userDateMap = userDailySlotInfo.get(roleInstanceId);
        if (!userDateMap.has(dateKey)) {
            userDateMap.set(dateKey, {
                leaveTypes: new Set(),
                isUnavailableAM: false, unavailableDetailsAM: new Set(),
                isUnavailablePM: false, unavailableDetailsPM: new Set(),
                isUnallocatedAM: false, unallocatedDetailsAM: new Set(),
                isUnallocatedPM: false, unallocatedDetailsPM: new Set()
            });
        }
        return userDateMap.get(dateKey);
    }
    
    // Process Leaves
    (leavesData.leaves || []).forEach(leave => {
        const leaveStart = new Date(leave.start);
        const leaveEnd = new Date(leave.end);
        let currentLeaveDate = new Date(Date.UTC(leaveStart.getUTCFullYear(), leaveStart.getUTCMonth(), leaveStart.getUTCDate()));
        while(currentLeaveDate <= leaveEnd) {
            const dateKey = normalizeDate(currentLeaveDate);
            const entry = getOrCreateDailySlotEntry(leave.roleInstanceId, dateKey);
            entry.leaveTypes.add(leaveTypesMap.get(leave.leaveTypeId) || 'Leave');
            currentLeaveDate.setUTCDate(currentLeaveDate.getUTCDate() + 1);
        }
    });

    const amSlotStartMinutes = 7 * 60 + 30; // 7:30 AM
    const amSlotEndMinutes = 12 * 60 + 30; // 12:30 PM
    const pmSlotStartMinutes = 13 * 60;    // 1:00 PM
    const pmSlotEndMinutes = 17 * 60 + 30; // 5:30 PM

    function processShiftArray(shiftArray, isUnallocatedType) {
        (shiftArray || []).forEach(shift => {
            const dateKey = shift.calculatedDate;
            const entry = getOrCreateDailySlotEntry(shift.roleInstanceId, dateKey);
            
            const itemLocalStartHour = shift.startTime.hour;
            const itemLocalStartMinute = shift.startTime.minute;
            const itemLocalEndHour = shift.endTime.hour;
            const itemLocalEndMinute = shift.endTime.minute;
            
            let itemStartTotalMinutes = itemLocalStartHour * 60 + itemLocalStartMinute;
            let itemEndTotalMinutes = itemLocalEndHour * 60 + itemLocalEndMinute;

            if (shift.startTime.dayOffset && shift.startTime.dayOffset < 0) itemStartTotalMinutes = 0;
            if (shift.endTime.dayOffset && shift.endTime.dayOffset > 0) {
                itemEndTotalMinutes = 24 * 60;
            } else if (itemLocalEndHour === 0 && itemLocalEndMinute === 0 && 
                       (itemLocalStartHour !== 0 || itemLocalStartMinute !== 0) &&
                       (!shift.endTime.dayOffset || shift.endTime.dayOffset === 0) ) {
                 itemEndTotalMinutes = 24 * 60;
            }
            
            const detailString = `Shift: ${String(itemLocalStartHour).padStart(2,'0')}:${String(itemLocalStartMinute).padStart(2,'0')} - ${String(itemLocalEndHour).padStart(2,'0')}:${String(itemLocalEndMinute).padStart(2,'0')}` +
                                 (shift.startTime.dayOffset ? ` (Start DO:${shift.startTime.dayOffset})` : '') +
                                 (shift.endTime.dayOffset ? ` (End DO:${shift.endTime.dayOffset})` : '') +
                                 (shift.rosterGroupId ? ` (RG: ${ROSTER_GROUPS_CONFIG.find(rg => rg.id === shift.rosterGroupId)?.name || shift.rosterGroupId})` : '');

            if (itemStartTotalMinutes < amSlotEndMinutes && itemEndTotalMinutes > amSlotStartMinutes) { // Overlaps AM
                if (isUnallocatedType) {
                    entry.isUnallocatedAM = true;
                    entry.unallocatedDetailsAM.add(detailString);
                } else {
                    entry.isUnavailableAM = true;
                    entry.unavailableDetailsAM.add(detailString);
                }
            }
            if (itemStartTotalMinutes < pmSlotEndMinutes && itemEndTotalMinutes > pmSlotStartMinutes) { // Overlaps PM
                if (isUnallocatedType) {
                    entry.isUnallocatedPM = true;
                    entry.unallocatedDetailsPM.add(detailString);
                } else {
                    entry.isUnavailablePM = true;
                    entry.unavailableDetailsPM.add(detailString);
                }
            }
        });
    }

    // Process "unavailableUsers" (actual shifts, for red "Unavail.")
    processShiftArray(currentUnavailableShifts, false);
    
    // Process "unallocatedUsers" (potential shifts, for green "Unalloc.")
    processShiftArray(currentUnallocatedShifts, true);

    // --- NEW: Process Allocated Shifts from shiftTemplatesData ---
    if (shiftTemplatesData && Array.isArray(shiftTemplatesData.userShiftTemplates)) {
        shiftTemplatesData.userShiftTemplates.forEach(template => {
            if (template.type === 'allocated') {
                // Only process allocated templates
                const roleInstanceId = template.roleInstanceId;
                // Calculate all dates this template applies to in the dateRange
                dateRange.forEach(dateObj => {
                    const dateKey = normalizeDate(dateObj);
                    // Check if this template applies to this date
                    // (Assume allocated templates have startDate, endDate, startTime, endTime)
                    const templateStart = new Date(template.startDate + 'T00:00:00Z');
                    const templateEnd = template.endDate ? new Date(template.endDate + 'T23:59:59Z') : templateStart;
                    if (dateObj >= templateStart && dateObj <= templateEnd) {
                        // Check if day of week matches if interval is weekly
                        let applies = true;
                        if (template.interval && template.interval.type === 'weekly' && Array.isArray(template.interval.daysOfWeek)) {
                            const jsDay = dateObj.getUTCDay();
                            applies = template.interval.daysOfWeek.includes(jsDay);
                        }
                        if (applies) {
                            // Calculate slot times
                            const amSlotStartMinutes = 7 * 60 + 30;
                            const amSlotEndMinutes = 12 * 60 + 30;
                            const pmSlotStartMinutes = 13 * 60;
                            const pmSlotEndMinutes = 17 * 60 + 30;
                            const startHour = template.startTime.hour;
                            const startMinute = template.startTime.minute;
                            const endHour = template.endTime.hour;
                            const endMinute = template.endTime.minute;
                            const startTotalMinutes = startHour * 60 + startMinute;
                            const endTotalMinutes = endHour * 60 + endMinute;
                            const entry = getOrCreateDailySlotEntry(roleInstanceId, dateKey);
                            const detailString = `Allocated: ${String(startHour).padStart(2,'0')}:${String(startMinute).padStart(2,'0')} - ${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}`;
                            // Only set allocated if not already leave or unavailable
                            if (!entry.leaveTypes.size && !entry.isUnavailableAM && startTotalMinutes < amSlotEndMinutes && endTotalMinutes > amSlotStartMinutes) {
                                entry.isAllocatedAM = true;
                                if (!entry.allocatedDetailsAM) entry.allocatedDetailsAM = new Set();
                                entry.allocatedDetailsAM.add(detailString);
                            }
                            if (!entry.leaveTypes.size && !entry.isUnavailablePM && startTotalMinutes < pmSlotEndMinutes && endTotalMinutes > pmSlotStartMinutes) {
                                entry.isAllocatedPM = true;
                                if (!entry.allocatedDetailsPM) entry.allocatedDetailsPM = new Set();
                                entry.allocatedDetailsPM.add(detailString);
                            }
                        }
                    }
                });
            }
        });
    }

    const filterByAllRoles = selectedRoleIds.includes("All");
    const filterByAllTeams = selectedTeamIds.includes("All");
    const filteredSiteUsers = usersData.siteUsers.filter(siteUser => {
        const matchesRole = filterByAllRoles ||
            (siteUser.roleInstances && siteUser.roleInstances.some(ri => selectedRoleIds.includes(ri.roleId)));
        const matchesTeam = filterByAllTeams ||
            (siteUser.roleInstances && siteUser.roleInstances.some(ri =>
                ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId))
            ));
        return matchesRole && matchesTeam;
    });

    // Sort by Last Name
    filteredSiteUsers.sort((a, b) => {
        const lastNameA = (a.siteUserProfile?.lastName || '').toLowerCase();
        const lastNameB = (b.siteUserProfile?.lastName || '').toLowerCase();
        if (lastNameA < lastNameB) return -1;
        if (lastNameA > lastNameB) return 1;
        // If last names are the same, sort by first name
        const firstNameA = (a.siteUserProfile?.firstName || '').toLowerCase();
        const firstNameB = (b.siteUserProfile?.firstName || '').toLowerCase();
        if (firstNameA < firstNameB) return -1;
        if (firstNameA > firstNameB) return 1;
        return 0;
    });

    if (filteredSiteUsers.length === 0) {
        usersTableContainer.innerHTML = '<p>No users match the current filter criteria.</p>';
        statusElement.textContent = `Users table generated with 0 matching entries. Roster Group: ${selectedRosterGroupName}. Date range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
        statusElement.className = '';
        return;
    }

    // --- START: Calculate Daily Tallies ---
    const dailyTallies = {};
    dateRange.forEach(tableDay => {
        const dateKey = normalizeDate(tableDay);
        dailyTallies[dateKey] = {
            amLeave: new Set(), amUnavailable: new Set(),
            pmLeave: new Set(), pmUnavailable: new Set()
        };

        filteredSiteUsers.forEach(siteUser => {
            let userIsOnLeaveAM = false;
            let userIsOnLeavePM = false;
            let userIsUnavailableAM = false;
            let userIsUnavailablePM = false;

            (siteUser.roleInstances || []).forEach(ri => {
                // Ensure this RI itself matches the role/team filters for tallying
                const roleInstanceMatchesRoleFilter = filterByAllRoles || selectedRoleIds.includes(ri.roleId);
                const roleInstanceMatchesTeamFilter = filterByAllTeams || (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));

                if (roleInstanceMatchesRoleFilter && roleInstanceMatchesTeamFilter) {
                    if (userDailySlotInfo.has(ri.id) && userDailySlotInfo.get(ri.id).has(dateKey)) {
                        const dailyInfo = userDailySlotInfo.get(ri.id).get(dateKey);

                        if (dailyInfo.leaveTypes.size > 0) {
                            userIsOnLeaveAM = true;
                            userIsOnLeavePM = true; // Leave applies to whole day for tally
                        } else { // Only consider unavailability if not on leave via this RI
                            if (dailyInfo.isUnavailableAM) userIsUnavailableAM = true;
                            if (dailyInfo.isUnavailablePM) userIsUnavailablePM = true;
                        }
                    }
                }
            });

            if (userIsOnLeaveAM) dailyTallies[dateKey].amLeave.add(siteUser.id);
            else if (userIsUnavailableAM) dailyTallies[dateKey].amUnavailable.add(siteUser.id);

            if (userIsOnLeavePM) dailyTallies[dateKey].pmLeave.add(siteUser.id);
            else if (userIsUnavailablePM) dailyTallies[dateKey].pmUnavailable.add(siteUser.id);
        });
    });
    // --- END: Calculate Daily Tallies ---

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const baseHeaders = ['Last Name', 'First Name', 'Role & Teams'];

    // --- START: Create Tally Header Row ---
    const tallyHeaderRow = document.createElement('tr');
    tallyHeaderRow.className = 'tally-header-row';
    baseHeaders.forEach(() => { // Add spacer cells for base headers
        const th = document.createElement('th');
        th.className = 'tally-spacer-cell';
        tallyHeaderRow.appendChild(th);
    });
    dateRange.forEach(date => {
        const dateKey = normalizeDate(date);
        const talliesForDay = dailyTallies[dateKey];

        const thAM = document.createElement('th');
        thAM.className = 'tally-data-cell';
        thAM.textContent = `L:${talliesForDay.amLeave.size} U:${talliesForDay.amUnavailable.size}`;
        tallyHeaderRow.appendChild(thAM);

        const thPM = document.createElement('th');
        thPM.className = 'tally-data-cell';
        thPM.textContent = `L:${talliesForDay.pmLeave.size} U:${talliesForDay.pmUnavailable.size}`;
        tallyHeaderRow.appendChild(thPM);
    });
    thead.appendChild(tallyHeaderRow); // Add tally row first
    // --- END: Create Tally Header Row ---

    const headerRow1 = document.createElement('tr');
    baseHeaders.forEach(headerText => {
        const th = document.createElement('th');
        th.rowSpan = 2;
        th.textContent = headerText;
        headerRow1.appendChild(th);
    });
    dateRange.forEach(date => {
        const th = document.createElement('th');
        th.colSpan = 2;
        th.className = 'date-header';
        th.textContent = `${getDayOfWeek(date)} ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
        headerRow1.appendChild(th);
    });
    thead.appendChild(headerRow1);

    const headerRow2 = document.createElement('tr');
    dateRange.forEach(() => {
        const thAM = document.createElement('th');
        thAM.textContent = 'AM';
        thAM.className = 'sub-header';
        headerRow2.appendChild(thAM);

        const thPM = document.createElement('th');
        thPM.textContent = 'PM';
        thPM.className = 'sub-header';
        headerRow2.appendChild(thPM);
    });
    thead.appendChild(headerRow2);
    table.appendChild(thead);

    filteredSiteUsers.forEach(siteUser => {
        const tr = document.createElement('tr');
        const profile = siteUser.siteUserProfile || {};
        tr.appendChild(createCell(profile.lastName || 'N/A')); // Last Name first
        tr.appendChild(createCell(profile.firstName || 'N/A')); // First Name second
        // tr.appendChild(createCell(siteUser.id || 'N/A')); // HIDE Site User ID from table

        let roleInstancesHtmlContent = '';
        if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
            const visibleRoleInstances = siteUser.roleInstances.filter(ri =>
                filterByAllRoles || selectedRoleIds.includes(ri.roleId)
            );

            if (visibleRoleInstances.length > 0) {
                const roleInstanceDetails = []; // Array to hold "RoleName: TeamName" strings
                visibleRoleInstances.forEach(ri => {
                    const roleName = rolesMap.get(ri.roleId) || `RoleID: ${ri.roleId}`;

                    if (ri.roleInstanceTeams && ri.roleInstanceTeams.length > 0) {
                        const teamNames = ri.roleInstanceTeams
                            .filter(rit => filterByAllTeams || selectedTeamIds.includes(rit.teamId))
                            .map(rit => teamsMap.get(rit.teamId) || `TeamID: ${rit.teamId}`);

                        if (teamNames.length > 0) {
                            teamNames.forEach(teamName => {
                                roleInstanceDetails.push(`<span>${roleName}: ${teamName}</span>`);
                            });
                        } else {
                            // Original teams existed, but filter removed them all.
                            roleInstanceDetails.push(`<span>${roleName}: (No teams match filter)</span>`);
                        }
                    } else {
                        // No teams assigned to this role instance originally.
                        roleInstanceDetails.push(`<span>${roleName}: (No teams)</span>`);
                    }
                });
                roleInstancesHtmlContent = roleInstanceDetails.join('<br>'); // Join multiple role instances with <br> for new lines
            } else {
                roleInstancesHtmlContent = 'No role instances match current role filter.';
            }
        } else {
            roleInstancesHtmlContent = 'No role ID';
        }
        tr.appendChild(createCell(roleInstancesHtmlContent, true));

        dateRange.forEach(tableDay => {
            const dateKeyForLookup = normalizeDate(tableDay);
            let amContent = '', pmContent = '';
            let amClass = 'empty-slot-cell', pmClass = 'empty-slot-cell';
            let amTitle = '', pmTitle = '';

            let combinedAmDetails = new Set();
            let combinedPmDetails = new Set();

            // --- NEW: Collect all statuses for AM/PM, not just highest priority ---
            let amStatusLabels = [];
            let pmStatusLabels = [];
            let amStatusClasses = [];
            let pmStatusClasses = [];

            if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
                siteUser.roleInstances.forEach(ri => {
                    const roleMatches = filterByAllRoles || selectedRoleIds.includes(ri.roleId);
                    const teamMatches = filterByAllTeams || (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));

                    if (roleMatches && teamMatches && userDailySlotInfo.has(ri.id) && userDailySlotInfo.get(ri.id).has(dateKeyForLookup)) {
                        const dailyInfo = userDailySlotInfo.get(ri.id).get(dateKeyForLookup);
                        // AM Slot
                        // Collect all that apply
                        if (dailyInfo.leaveTypes.size > 0) {
                            amStatusLabels.push(Array.from(dailyInfo.leaveTypes).join(', '));
                            amStatusClasses.push('leave-cell');
                            dailyInfo.leaveTypes.forEach(d => combinedAmDetails.add(d));
                        }
                        if (dailyInfo.isUnavailableAM) {
                            amStatusLabels.push('Unavail.');
                            amStatusClasses.push('unavailable-cell');
                            dailyInfo.unavailableDetailsAM.forEach(d => combinedAmDetails.add(d));
                        }
                        if (dailyInfo.isAllocatedAM) {
                            amStatusLabels.push('Alloc.');
                            amStatusClasses.push('allocated-cell');
                            if (dailyInfo.allocatedDetailsAM) dailyInfo.allocatedDetailsAM.forEach(d => combinedAmDetails.add(d));
                        }
                        if (shouldShowUnallocated && dailyInfo.isUnallocatedAM) {
                            amStatusLabels.push('Unalloc.');
                            amStatusClasses.push('unallocated-cell');
                            dailyInfo.unallocatedDetailsAM.forEach(d => combinedAmDetails.add(d));
                        }
                        // PM Slot
                        if (dailyInfo.leaveTypes.size > 0) {
                            pmStatusLabels.push(Array.from(dailyInfo.leaveTypes).join(', '));
                            pmStatusClasses.push('leave-cell');
                            dailyInfo.leaveTypes.forEach(d => combinedPmDetails.add(d));
                        }
                        if (dailyInfo.isUnavailablePM) {
                            pmStatusLabels.push('Unavail.');
                            pmStatusClasses.push('unavailable-cell');
                            dailyInfo.unavailableDetailsPM.forEach(d => combinedPmDetails.add(d));
                        }
                        if (dailyInfo.isAllocatedPM) {
                            pmStatusLabels.push('Alloc.');
                            pmStatusClasses.push('allocated-cell');
                            if (dailyInfo.allocatedDetailsPM) dailyInfo.allocatedDetailsPM.forEach(d => combinedPmDetails.add(d));
                        }
                        if (shouldShowUnallocated && dailyInfo.isUnallocatedPM) {
                            pmStatusLabels.push('Unalloc.');
                            pmStatusClasses.push('unallocated-cell');
                            dailyInfo.unallocatedDetailsPM.forEach(d => combinedPmDetails.add(d));
                        }
                    }
                });
            }

            // Remove duplicates and preserve order for status labels and classes
            function uniqueLabelsAndClasses(labels, classes) {
                const seen = new Set();
                const resultLabels = [];
                const resultClasses = [];
                for (let i = 0; i < labels.length; ++i) {
                    const key = labels[i] + '|' + (classes[i] || '');
                    if (!seen.has(key)) {
                        seen.add(key);
                        resultLabels.push(labels[i]);
                        resultClasses.push(classes[i]);
                    }
                }
                return { resultLabels, resultClasses };
            }
            const amUnique = uniqueLabelsAndClasses(amStatusLabels, amStatusClasses);
            const pmUnique = uniqueLabelsAndClasses(pmStatusLabels, pmStatusClasses);

            // Compose HTML for AM/PM cell with spans for each status
            function composeStatusCellHtml(labels, classes) {
                if (!labels.length) return '';
                return labels.map((label, idx) => `<span class="${classes[idx]}">${label}</span>`).join(', ');
            }
            amContent = composeStatusCellHtml(amUnique.resultLabels, amUnique.resultClasses);
            pmContent = composeStatusCellHtml(pmUnique.resultLabels, pmUnique.resultClasses);

            // Set class for cell: if multiple, use 'multi-status-cell', else use the single status class or empty
            amClass = amUnique.resultClasses.length > 1 ? 'multi-status-cell' : (amUnique.resultClasses[0] || 'empty-slot-cell');
            pmClass = pmUnique.resultClasses.length > 1 ? 'multi-status-cell' : (pmUnique.resultClasses[0] || 'empty-slot-cell');

            amTitle = combinedAmDetails.size > 0 ? Array.from(combinedAmDetails).join('\n') : '';
            pmTitle = combinedPmDetails.size > 0 ? Array.from(combinedPmDetails).join('\n') : '';

            const tdAM = createCell(amContent, true);
            tdAM.className = amClass;
            if (amTitle) tdAM.title = amTitle;
            tr.appendChild(tdAM);

            const tdPM = createCell(pmContent, true);
            tdPM.className = pmClass;
            if (pmTitle) tdPM.title = pmTitle;
            tr.appendChild(tdPM);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    usersTableContainer.appendChild(table);
    const selectedRosterGroupName = selectedRosterGroupId === "All" ? "All" : ROSTER_GROUPS_CONFIG.find(rg => rg.id === selectedRosterGroupId)?.name || selectedRosterGroupId;
    statusElement.textContent = `Users table generated with ${filteredSiteUsers.length} entries. Roster Group: ${selectedRosterGroupName}. Date range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
    statusElement.className = '';
}

function handleFilterChange() {
    if (lastFetchedUsersData && lastFetchedLeavesData && lastFetchedShiftTemplatesData) { // Added lastFetchedShiftTemplatesData
        const selectedRoleIds = getSelectedValues(roleFilterDropdown);
        const selectedTeamIds = getSelectedValues(teamFilterDropdown);
        generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedShiftTemplatesData, selectedRoleIds, selectedTeamIds); // Added shiftTemplatesData
    } else {
        statusElement.textContent = 'Please fetch/generate all required data first (Users, Leaves, Unallocated, Shift Templates) to apply filters or change dates.'; // Updated message
         statusElement.className = 'error';
    }
}

function populateFilterDropdowns(data) {
    const currentRoleSelections = getSelectedValues(roleFilterDropdown);
    roleFilterDropdown.innerHTML = '<option value="All">All Roles</option>';
    if (data && data.roles) {
        const uniqueRoles = [...new Map(data.roles.map(role => [role.id, role])).values()];
        uniqueRoles.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name || 'Unnamed Role';
            if (currentRoleSelections.includes(role.id)) option.selected = true;
            roleFilterDropdown.appendChild(option);
        });
    }
    if (currentRoleSelections.includes("All") && Array.from(roleFilterDropdown.selectedOptions).length === 0) {
        roleFilterDropdown.querySelector('option[value="All"]').selected = true;
    }

    const currentTeamSelections = getSelectedValues(teamFilterDropdown);
    teamFilterDropdown.innerHTML = '<option value="All">All Teams</option>';
    if (data && data.teams) {
        const uniqueTeams = [...new Map(data.teams.map(team => [team.id, team])).values()];
        uniqueTeams.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name || 'Unnamed Team';
            if (currentTeamSelections.includes(team.id)) option.selected = true;
            teamFilterDropdown.appendChild(option);
        });
    }
    if (currentTeamSelections.includes("All") && Array.from(teamFilterDropdown.selectedOptions).length === 0) {
        teamFilterDropdown.querySelector('option[value="All"]').selected = true;
    }
}

function populateRosterGroupFilterDropdown() {
    if (!rosterGroupFilterDropdown) return;

    rosterGroupFilterDropdown.innerHTML = ''; // Clear existing options

    let paAllocationsId = null;
    ROSTER_GROUPS_CONFIG.forEach(rg => {
        if (rg.name === "PA Allocations") {
            paAllocationsId = rg.id;
        }
    });

    ROSTER_GROUPS_CONFIG.forEach(rg => {
        const option = document.createElement('option');
        option.value = rg.id;
        option.textContent = rg.name;
        if (rg.id === paAllocationsId) {
            option.selected = true;
        }
        rosterGroupFilterDropdown.appendChild(option);
    });

    // Since the default is now set, if a filter change needs to be triggered on load,
    // it should be handled after this function is called and data is potentially loaded.
    // For example, by calling handleFilterChange() if initial data is present.
}

function createCell(text, isHtml = false) {
    const td = document.createElement('td');
    if (isHtml) {
        td.innerHTML = text;
    } else {
        td.textContent = text;
    }
    return td;
}

if (fetchLeavesButton) fetchLeavesButton.addEventListener('click', fetchLeavesDataAndDisplayJson);
if (fetchUsersButton) fetchUsersButton.addEventListener('click', fetchUsersDataAndDisplayJson);
if (fetchUnallocatedButton) fetchUnallocatedButton.addEventListener('click', fetchUnallocatedDataAndDisplayJson);
if (fetchShiftTemplatesButton) fetchShiftTemplatesButton.addEventListener('click', fetchShiftTemplatesDataAndDisplayJson); // Added this line
if (generateUsersTableButton) generateUsersTableButton.addEventListener('click', triggerGenerateUsersTable);

if (useLocalFileCheckbox) useLocalFileCheckbox.addEventListener('change', updateButtonTexts);
if (roleFilterDropdown) roleFilterDropdown.addEventListener('change', handleFilterChange);
if (teamFilterDropdown) teamFilterDropdown.addEventListener('change', handleFilterChange);
if (rosterGroupFilterDropdown) rosterGroupFilterDropdown.addEventListener('change', handleFilterChange);
// if (showUnallocatedCheckbox) showUnallocatedCheckbox.addEventListener('change', handleFilterChange); // Removed this line
if (fromDateInput) fromDateInput.addEventListener('change', handleFilterChange);
if (toDateInput) toDateInput.addEventListener('change', handleFilterChange);

const today = new Date();
const oneWeekFromToday = new Date();
oneWeekFromToday.setDate(today.getDate() + 7);
if (fromDateInput) fromDateInput.valueAsDate = today;
if (toDateInput) toDateInput.valueAsDate = oneWeekFromToday;

updateButtonTexts();
populateRosterGroupFilterDropdown();

// Remove/hide unallocated controls from UI
if (fetchUnallocatedButton) fetchUnallocatedButton.style.display = 'none';
if (showUnallocatedCheckbox) showUnallocatedCheckbox.parentElement.style.display = 'none';
// Also hide the button in the controls group in the HTML if present
const unallocatedButtonControlGroup = document.getElementById('unallocatedButtonControlGroup');
if (unallocatedButtonControlGroup) unallocatedButtonControlGroup.style.display = 'none';

});