document.addEventListener('DOMContentLoaded', () => {
const jsonDataElement = document.getElementById('jsonData');
const statusElement = document.getElementById('status');
const bearerTokenInput = document.getElementById('bearerTokenInput');
const useLocalFileCheckbox = document.getElementById('useLocalFileCheckbox');

const fetchLeavesButton = document.getElementById('fetchLeavesButton');
const fetchUsersButton = document.getElementById('fetchUsersButton');
const fetchUnallocatedButton = document.getElementById('fetchUnallocatedButton');
const generateUsersTableButton = document.getElementById('generateUsersTableButton');

const usersTableContainer = document.getElementById('usersTableContainer');
const roleFilterDropdown = document.getElementById('roleFilter');
const teamFilterDropdown = document.getElementById('teamFilter');
const rosterGroupFilterDropdown = document.getElementById('rosterGroupFilter'); // RESTORED

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');

let lastFetchedUsersData = null;
let lastFetchedLeavesData = null;
let lastFetchedUnallocatedData = null;

let rolesMap = new Map();
let teamsMap = new Map();
let leaveTypesMap = new Map();

// --- Configuration ---
const LEAVES_LOCAL_FILE_PATH = 'testleave.json';
const USERS_LOCAL_FILE_PATH = 'testusers.json';
const UNALLOCATED_LOCAL_FILE_PATH = 'testunalloc.json';

const LEAVES_API_ENDPOINT = "https://api.hosportal.com/get-leaves-and-leave-requests";
const USERS_API_ENDPOINT = "https://api.hosportal.com/get-site-users";
const UNALLOCATED_API_ENDPOINT = "https://api.hosportal.com/get-unallocated-available-role-instances";

const SITE_ID = "a14c0405-4fb0-432b-9ce3-a5c460dffdf5";
const ROSTER_GROUPS_CONFIG = [
    { id: "75d5cc8d-4b0a-4392-88e1-c3b6bb37056f", name: "RLH Allocations" },
    { id: "a40e918a-af4d-4cb9-bce6-99b5de1a0352", name: "PA Allocations" }
];
// ---------------------

function updateButtonTexts() {
    const useLocal = useLocalFileCheckbox.checked;
    if (fetchLeavesButton) {
        fetchLeavesButton.textContent = useLocal ? `Fetch Leaves from ${LEAVES_LOCAL_FILE_PATH} (JSON)` : 'Fetch Leaves from API (JSON)';
    }
    if (fetchUsersButton) {
        fetchUsersButton.textContent = useLocal ? `Fetch Users from ${USERS_LOCAL_FILE_PATH} (JSON)` : 'Fetch Users from API (JSON)';
    }
    if (fetchUnallocatedButton) {
        fetchUnallocatedButton.textContent = useLocal ? `Fetch Unallocated from ${UNALLOCATED_LOCAL_FILE_PATH} (JSON)` : 'Fetch Unallocated from API (Combined)';
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


async function fetchCombinedUnallocatedDataForApi(apiStart, apiEnd) {
    const token = bearerTokenInput.value.trim();
    if (!token) throw new Error('Bearer token is required for API calls when fetching unallocated data.');

    let combinedUnavailableUsers = [];
    let firstResponseStructure = null;

    statusElement.textContent = `Fetching unallocated data. Please wait...`;
    statusElement.className = '';

    for (const rosterGroup of ROSTER_GROUPS_CONFIG) {
        const rosterGroupId = rosterGroup.id;
        const rawBody = JSON.stringify({
            "siteId": SITE_ID,
            "start": apiStart,
            "end": apiEnd,
            "roleIds": [],
            "rosterGroupId": rosterGroupId
        });

        const headers = new Headers();
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("Content-Type", "application/json");

        const requestOptions = {
            method: 'POST', headers: headers, body: rawBody, redirect: 'follow'
        };
        
        statusElement.textContent = `Fetching unallocated data for ${rosterGroup.name}...`;

        try {
            const response = await fetch(UNALLOCATED_API_ENDPOINT, requestOptions);

            if (!response.ok) {
                let errorMsg = `HTTP error for unallocated data (${rosterGroup.name})! Status: ${response.status} ${response.statusText}`;
                let errorBodyText = 'Could not read error body.';
                try { errorBodyText = await response.text(); errorMsg += ` - Body: ${errorBodyText}`; } catch (e) { /* ignore */ }
                console.error(errorMsg);
                statusElement.textContent = `Error fetching for ${rosterGroup.name}. Trying next...`;
                statusElement.className = 'error'; 
                continue; 
            }
            const result = await response.json();

            console.log(`Data fetched for ${rosterGroup.name} (ID: ${rosterGroupId}):`, JSON.parse(JSON.stringify(result)));

            if (firstResponseStructure === null && result) {
                const { unavailableUsers, ...rest } = result;
                firstResponseStructure = rest;
            }

            if (result && result.unavailableUsers && Array.isArray(result.unavailableUsers)) {
                combinedUnavailableUsers.push(...result.unavailableUsers);
            }
        } catch (fetchError) {
            console.error(`Fetch error for ${rosterGroup.name}:`, fetchError);
            statusElement.textContent = `Network error fetching for ${rosterGroup.name}. Trying next...`;
            statusElement.className = 'error';
            continue;
        }
    }

    if (firstResponseStructure === null && combinedUnavailableUsers.length === 0) {
        throw new Error("Failed to fetch unallocated data for all roster groups or no data returned.");
    }
    
    const finalCombinedResult = {
        ...(firstResponseStructure || {}),
        unavailableUsers: combinedUnavailableUsers
    };
    return finalCombinedResult;
}

async function fetchUnallocatedDataAndDisplayJson() {
    const useLocal = useLocalFileCheckbox.checked;

    if (useLocal) {
        try {
            await performFetch(null, {}, true, UNALLOCATED_LOCAL_FILE_PATH, 'unallocated');
        } catch (e) { /* Handled by performFetch */ }
    } else {
        const fromDateStr = fromDateInput.value;
        const toDateStr = toDateInput.value;

        if (!fromDateStr || !toDateStr) {
            statusElement.textContent = 'Please select "From" and "To" dates for the Unallocated API call.';
            statusElement.className = 'error';
            jsonDataElement.textContent = '';
            lastFetchedUnallocatedData = null;
            return;
        }

        const apiStart = `${fromDateStr}T00:00:00.000Z`;
        const apiEnd = `${toDateStr}T23:59:59.999Z`;

        statusElement.textContent = `Fetching and combining unallocated data from API for ${ROSTER_GROUPS_CONFIG.length} roster groups...`;
        statusElement.className = '';
        jsonDataElement.textContent = 'Loading...';

        try {
            const combinedData = await fetchCombinedUnallocatedDataForApi(apiStart, apiEnd);
            lastFetchedUnallocatedData = combinedData;
            jsonDataElement.textContent = JSON.stringify(combinedData, null, 2);
            statusElement.textContent = `Unallocated data loaded and combined successfully from API!`;
            console.log(combinedData);
            statusElement.className = '';
        } catch (error) {
            console.error(`Error in fetchUnallocatedDataAndDisplayJson for API:`, error);
            jsonDataElement.textContent = `An error occurred fetching unallocated data:\n${error.message}`;
            statusElement.textContent = `Failed to load unallocated data from API.`;
            statusElement.className = 'error';
            lastFetchedUnallocatedData = null;
        }
    }
}

async function triggerGenerateUsersTable() {
    usersTableContainer.innerHTML = 'Generating table, fetching data if needed...';
    try {
        const dataFetchPromises = [];
        const isLocal = useLocalFileCheckbox.checked;
        const hasToken = bearerTokenInput.value.trim() !== '';

        if (!lastFetchedUsersData || isLocal || (!isLocal && hasToken)) {
            const myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/json");
            const raw = JSON.stringify({
                "siteId": SITE_ID,
                "associations": ["Role", "Skill", "Team", "SiteUserProfile", "RoleInstanceInformation", "RoleInstanceFte"]
            });
            const requestOptions = { method: 'POST', headers: myHeaders, body: raw, redirect: 'follow' };
            dataFetchPromises.push(
                performFetch(USERS_API_ENDPOINT, requestOptions, isLocal, USERS_LOCAL_FILE_PATH, 'users')
            );
        }

        if (!lastFetchedLeavesData || isLocal || (!isLocal && hasToken)) {
            dataFetchPromises.push(
                performFetch(LEAVES_API_ENDPOINT, {
                    method: 'POST',
                    body: JSON.stringify({ "siteId": SITE_ID, "statuses": ["waiting", "denied", "approved"], "associations": ["LeaveType", "RoleInstance"] }),
                    redirect: 'follow'
                }, isLocal, LEAVES_LOCAL_FILE_PATH, 'leaves')
            );
        }

        if (dataFetchPromises.length > 0) {
            await Promise.all(dataFetchPromises.map(p => p.catch(e => e)));
        }

        let unallocatedDataFetchError = null;
        if (!lastFetchedUnallocatedData || isLocal || (!isLocal && hasToken)) {
            const fromDateStr = fromDateInput.value;
            const toDateStr = toDateInput.value;

            if (isLocal) {
                try {
                    await performFetch(null, {}, true, UNALLOCATED_LOCAL_FILE_PATH, 'unallocated');
                } catch (e) {
                    unallocatedDataFetchError = e;
                    console.error("Error fetching local unallocated data for table:", e);
                }
            } else if (hasToken && fromDateStr && toDateStr) {
                const apiStart = `${fromDateStr}T00:00:00.000Z`;
                const apiEnd = `${toDateStr}T23:59:59.999Z`;
                try {
                    statusElement.textContent = `Fetching combined unallocated data for table...`;
                    const combinedData = await fetchCombinedUnallocatedDataForApi(apiStart, apiEnd);
                    lastFetchedUnallocatedData = combinedData;
                    statusElement.textContent = `Combined unallocated data fetched for table.`;
                } catch (e) {
                    unallocatedDataFetchError = e;
                    console.error("Error fetching API unallocated data for table:", e);
                    lastFetchedUnallocatedData = null;
                    throw e; 
                }
            } else if (!isLocal && !hasToken) {
                console.warn("Bearer token missing for Unallocated API data for table.");
            } else if (!isLocal && (!fromDateStr || !toDateStr)) {
                console.warn("Dates for Unallocated API data not set for table. Unavailability might not be accurate.");
            }
        }
        
        if (lastFetchedUsersData && lastFetchedLeavesData && lastFetchedUnallocatedData) {
            const selectedRoleIds = getSelectedValues(roleFilterDropdown);
            const selectedTeamIds = getSelectedValues(teamFilterDropdown);
            generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedUnallocatedData, selectedRoleIds, selectedTeamIds);
        } else {
            let missingData = [];
            if (!lastFetchedUsersData) missingData.push("user");
            if (!lastFetchedLeavesData) missingData.push("leave");
            
            const unallocatedExpected = isLocal || (hasToken && fromDateInput.value && toDateInput.value);
            if (!lastFetchedUnallocatedData && unallocatedExpected) {
                 missingData.push("unallocated availability");
            }

            if (!isLocal && !hasToken && (missingData.includes("user") || missingData.includes("leave") || (missingData.includes("unallocated availability") && unallocatedExpected))) {
                statusElement.textContent = `Cannot generate table: Bearer token missing for API call to fetch ${missingData.join(', ')} data.`;
            } else if (missingData.length > 0) {
                statusElement.textContent = `Cannot generate table: Missing ${missingData.join(', ')} data. Fetch relevant data first.`;
            } else if (!isLocal && unallocatedExpected && (!fromDateInput.value || !toDateInput.value) && !lastFetchedUnallocatedData) {
                 statusElement.textContent = `Cannot generate table: Dates not set for unallocated data.`;
            } else {
                 statusElement.textContent = `Cannot generate table: Ensure all required data is fetched.`;
            }
            statusElement.className = 'error';
            usersTableContainer.innerHTML = '';
        }
    } catch (error) {
        console.error("Could not generate table due to fetch error(s):", error);
        statusElement.textContent = 'Error fetching data or generating table. Check console.';
        statusElement.className = 'error';
        usersTableContainer.innerHTML = '<p class="error">Table generation failed due to data fetch errors.</p>';
    }
}


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

function generateUsersTable(usersData, leavesData, unallocatedData, selectedRoleIds, selectedTeamIds) {
    usersTableContainer.innerHTML = '';

    if (!usersData?.siteUsers?.length) { usersTableContainer.innerHTML = '<p class="error">No siteUsers data.</p>'; return; }
    if (!leavesData?.leaves) { usersTableContainer.innerHTML = '<p class="error">Leave data missing/invalid.</p>'; return; }
    
    const selectedRosterGroupId = rosterGroupFilterDropdown.value;

    let currentUnallocatedUsers = unallocatedData.unavailableUsers || [];
    if (selectedRosterGroupId && selectedRosterGroupId !== "All") {
        currentUnallocatedUsers = currentUnallocatedUsers.filter(unavail => unavail.rosterGroupId === selectedRosterGroupId);
    }
    const processedUnallocatedData = { ...unallocatedData, unavailableUsers: currentUnallocatedUsers };


    if (!processedUnallocatedData || typeof processedUnallocatedData.unavailableUsers === 'undefined') {
        usersTableContainer.innerHTML = `<p class="error">Unavailability data structure missing/invalid (or no unavailabilities for selected Roster Group '${selectedRosterGroupId === "All" ? "All" : ROSTER_GROUPS_CONFIG.find(rg => rg.id === selectedRosterGroupId)?.name || selectedRosterGroupId}').</p>`; return;
    }

    const fromDateStr = fromDateInput.value;
    const toDateStr = toDateInput.value;
    if (!fromDateStr || !toDateStr) {
        usersTableContainer.innerHTML = '<p class="error">Please select both "From" and "To" dates.</p>'; return;
    }
    const fromDate = new Date(fromDateStr + "T00:00:00Z");
    const toDate = new Date(toDateStr + "T23:59:59Z");
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
        usersTableContainer.innerHTML = '<p class="error">Invalid date range selected.</p>'; return;
    }

    const dateRange = [];
    let currentDateIter = new Date(fromDate.toISOString().slice(0,10) + "T00:00:00Z");
    const toDateLimit = new Date(toDate.toISOString().slice(0,10) + "T00:00:00Z");

    while (currentDateIter <= toDateLimit) {
        dateRange.push(new Date(currentDateIter));
        currentDateIter.setUTCDate(currentDateIter.getUTCDate() + 1);
    }

    const leavesByRoleInstanceAndDate = new Map();
    (leavesData.leaves || []).forEach(leave => {
        const leaveStart = new Date(leave.start);
        const leaveEnd = new Date(leave.end);
        let currentLeaveDate = new Date(Date.UTC(leaveStart.getUTCFullYear(), leaveStart.getUTCMonth(), leaveStart.getUTCDate()));

        while(currentLeaveDate <= leaveEnd) {
            const dateKey = normalizeDate(currentLeaveDate);
            if (!leavesByRoleInstanceAndDate.has(leave.roleInstanceId)) {
                leavesByRoleInstanceAndDate.set(leave.roleInstanceId, new Map());
            }
            const userDateLeaveMap = leavesByRoleInstanceAndDate.get(leave.roleInstanceId);
            if (!userDateLeaveMap.has(dateKey)) {
                userDateLeaveMap.set(dateKey, new Set());
            }
            userDateLeaveMap.get(dateKey).add(leaveTypesMap.get(leave.leaveTypeId) || 'Leave');
            currentLeaveDate.setUTCDate(currentLeaveDate.getUTCDate() + 1);
        }
    });

    const unavailabilityByRoleInstanceAndDate = new Map();
    (processedUnallocatedData.unavailableUsers || []).forEach(unavail => {
        const dateKey = unavail.calculatedDate;

        if (!unavailabilityByRoleInstanceAndDate.has(unavail.roleInstanceId)) {
            unavailabilityByRoleInstanceAndDate.set(unavail.roleInstanceId, new Map());
        }
        const userDateUnavailMap = unavailabilityByRoleInstanceAndDate.get(unavail.roleInstanceId);
        if (!userDateUnavailMap.has(dateKey)) {
            userDateUnavailMap.set(dateKey, { AM: false, PM: false, details: [] });
        }
        const dayUnavailInfo = userDateUnavailMap.get(dateKey);

        const itemLocalStartHour = unavail.startTime.hour;
        const itemLocalStartMinute = unavail.startTime.minute;
        const itemLocalEndHour = unavail.endTime.hour;
        const itemLocalEndMinute = unavail.endTime.minute;
        
        let itemStartTotalMinutes = itemLocalStartHour * 60 + itemLocalStartMinute;
        let itemEndTotalMinutes = itemLocalEndHour * 60 + itemLocalEndMinute;

        if (unavail.startTime.dayOffset && unavail.startTime.dayOffset < 0) {
             itemStartTotalMinutes = 0;
        }
        if (unavail.endTime.dayOffset && unavail.endTime.dayOffset > 0) {
            itemEndTotalMinutes = 24 * 60;
        } else if (itemLocalEndHour === 0 && itemLocalEndMinute === 0 && 
                   (itemLocalStartHour !== 0 || itemLocalStartMinute !== 0) &&
                   (!unavail.endTime.dayOffset || unavail.endTime.dayOffset === 0) ) {
             itemEndTotalMinutes = 24 * 60;
        }

        const amSlotStartMinutes = 7 * 60 + 30;
        const amSlotEndMinutes = 12 * 60 + 30;
        const pmSlotStartMinutes = 13 * 60;
        const pmSlotEndMinutes = 17 * 60 + 30;

        if (itemStartTotalMinutes < amSlotEndMinutes && itemEndTotalMinutes > amSlotStartMinutes) {
            dayUnavailInfo.AM = true;
        }
        if (itemStartTotalMinutes < pmSlotEndMinutes && itemEndTotalMinutes > pmSlotStartMinutes) {
            dayUnavailInfo.PM = true;
        }
        
        dayUnavailInfo.details.push(
            `Shift: ${String(unavail.startTime.hour).padStart(2,'0')}:${String(unavail.startTime.minute).padStart(2,'0')} - ${String(unavail.endTime.hour).padStart(2,'0')}:${String(unavail.endTime.minute).padStart(2,'0')}` +
            (unavail.startTime.dayOffset ? ` (Start DO:${unavail.startTime.dayOffset})` : '') +
            (unavail.endTime.dayOffset ? ` (End DO:${unavail.endTime.dayOffset})` : '') +
            (unavail.rosterGroupId ? ` (RG: ${ROSTER_GROUPS_CONFIG.find(rg => rg.id === unavail.rosterGroupId)?.name || unavail.rosterGroupId})` : '')
        );
    });

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

    if (filteredSiteUsers.length === 0) {
        usersTableContainer.innerHTML = '<p>No users match the current filter criteria.</p>';
        statusElement.textContent = `Users table generated with 0 matching entries.`;
        statusElement.className = '';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const baseHeaders = ['First Name', 'Last Name', 'Role Instances & Teams']; // Removed 'Site User ID'
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
        tr.appendChild(createCell(profile.firstName || 'N/A'));
        tr.appendChild(createCell(profile.lastName || 'N/A'));

        let roleInstancesHtmlContent = '';
        if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
            const visibleRoleInstances = siteUser.roleInstances.filter(ri =>
                filterByAllRoles || selectedRoleIds.includes(ri.roleId)
            );

            if (visibleRoleInstances.length > 0) {
                roleInstancesHtmlContent = '<ul>';
                visibleRoleInstances.forEach(ri => {
                    const roleName = rolesMap.get(ri.roleId) || `RoleID: ${ri.roleId}`;
                    let teamsDisplayHtml = 'No relevant teams';

                    if (ri.roleInstanceTeams && ri.roleInstanceTeams.length > 0) {
                        const relevantTeamsForThisRI = ri.roleInstanceTeams
                            .filter(rit => filterByAllTeams || selectedTeamIds.includes(rit.teamId))
                            .map(rit => {
                                const teamName = teamsMap.get(rit.teamId) || `TeamID: ${rit.teamId}`;
                                return `Team: ${teamName}`;
                            });

                        if (relevantTeamsForThisRI.length > 0) {
                            teamsDisplayHtml = relevantTeamsForThisRI.join('; ');
                        } else if (!filterByAllTeams) {
                            teamsDisplayHtml = 'No teams match filter for this instance.';
                        } else {
                            teamsDisplayHtml = 'No teams assigned to this instance.';
                        }
                    }
                    roleInstancesHtmlContent += `<li>
                        <b>Role:</b> ${roleName}<br>
                        <b>Teams:</b> ${teamsDisplayHtml}</li>`;
                });
                roleInstancesHtmlContent += '</ul>';
            } else {
                roleInstancesHtmlContent = 'No role instances match current role filter.';
            }
        } else {
            roleInstancesHtmlContent = 'No role instances';
        }
        tr.appendChild(createCell(roleInstancesHtmlContent, true));

        dateRange.forEach(tableDay => {
            const dateKeyForLookup = normalizeDate(tableDay);

            let amContent = '';
            let pmContent = '';
            let amClass = 'empty-slot-cell';
            let pmClass = 'empty-slot-cell';
            let amTitle = '';
            let pmTitle = '';

            let leaveForDayAM = new Set();
            let leaveForDayPM = new Set();
            let unavailableAM = false;
            let unavailablePM = false;
            let unavailabilityDetails = [];

            if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
                siteUser.roleInstances.forEach(ri => {
                    const roleMatches = filterByAllRoles || selectedRoleIds.includes(ri.roleId);
                    const teamMatches = filterByAllTeams || (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));

                    if (roleMatches && teamMatches) {
                        if (leavesByRoleInstanceAndDate.has(ri.id) && leavesByRoleInstanceAndDate.get(ri.id).has(dateKeyForLookup)) {
                            const leaveTypes = leavesByRoleInstanceAndDate.get(ri.id).get(dateKeyForLookup);
                            leaveTypes.forEach(lt => {
                                leaveForDayAM.add(lt);
                                leaveForDayPM.add(lt);
                            });
                        }

                        if (unavailabilityByRoleInstanceAndDate.has(ri.id) && unavailabilityByRoleInstanceAndDate.get(ri.id).has(dateKeyForLookup)) {
                            const unavailInfo = unavailabilityByRoleInstanceAndDate.get(ri.id).get(dateKeyForLookup);
                            if (unavailInfo.AM) unavailableAM = true;
                            if (unavailInfo.PM) unavailablePM = true;
                            if (unavailInfo.details && unavailInfo.details.length > 0) {
                                unavailabilityDetails.push(...unavailInfo.details);
                            }
                        }
                    }
                });
            }

            if (leaveForDayAM.size > 0) {
                amContent = Array.from(leaveForDayAM).join(', ');
                amClass = 'leave-cell';
                amTitle = amContent;
            } else if (unavailableAM) {
                amContent = 'Unavail.';
                amClass = 'unavailable-cell';
                amTitle = 'Unavailability details:\n' + [...new Set(unavailabilityDetails)].join('\n');
            }

            if (leaveForDayPM.size > 0) {
                pmContent = Array.from(leaveForDayPM).join(', ');
                pmClass = 'leave-cell';
                pmTitle = pmContent;
            } else if (unavailablePM) {
                pmContent = 'Unavail.';
                pmClass = 'unavailable-cell';
                pmTitle = 'Unavailability details:\n' + [...new Set(unavailabilityDetails)].join('\n');
            }

            const tdAM = createCell(amContent);
            tdAM.className = amClass;
            if (amTitle) tdAM.title = amTitle;
            tr.appendChild(tdAM);

            const tdPM = createCell(pmContent);
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
    if (lastFetchedUsersData && lastFetchedLeavesData && lastFetchedUnallocatedData) {
        const selectedRoleIds = getSelectedValues(roleFilterDropdown);
        const selectedTeamIds = getSelectedValues(teamFilterDropdown);
        generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedUnallocatedData, selectedRoleIds, selectedTeamIds);
    } else {
        statusElement.textContent = 'Please fetch/generate all required data first (Users, Leaves, Unallocated) to apply filters or change dates.';
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
    rosterGroupFilterDropdown.innerHTML = '<option value="All">All Roster Groups</option>';
    ROSTER_GROUPS_CONFIG.forEach(rg => {
        const option = document.createElement('option');
        option.value = rg.id;
        option.textContent = rg.name;
        rosterGroupFilterDropdown.appendChild(option);
    });
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
if (generateUsersTableButton) generateUsersTableButton.addEventListener('click', triggerGenerateUsersTable);

if (useLocalFileCheckbox) useLocalFileCheckbox.addEventListener('change', updateButtonTexts);
if (roleFilterDropdown) roleFilterDropdown.addEventListener('change', handleFilterChange);
if (teamFilterDropdown) teamFilterDropdown.addEventListener('change', handleFilterChange);
if (rosterGroupFilterDropdown) rosterGroupFilterDropdown.addEventListener('change', handleFilterChange);
if (fromDateInput) fromDateInput.addEventListener('change', handleFilterChange);
if (toDateInput) toDateInput.addEventListener('change', handleFilterChange);

const today = new Date();
const oneWeekFromToday = new Date();
oneWeekFromToday.setDate(today.getDate() + 7);
if (fromDateInput) fromDateInput.valueAsDate = today;
if (toDateInput) toDateInput.valueAsDate = oneWeekFromToday;

updateButtonTexts();
populateRosterGroupFilterDropdown();
});