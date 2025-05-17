document.addEventListener('DOMContentLoaded', () => {
    const jsonDataElement = document.getElementById('jsonData');
    const statusElement = document.getElementById('status');
    const bearerTokenInput = document.getElementById('bearerTokenInput');
    const useLocalFileCheckbox = document.getElementById('useLocalFileCheckbox');

    const fetchLeavesButton = document.getElementById('fetchLeavesButton');
    const fetchUsersButton = document.getElementById('fetchUsersButton');
    const fetchUnallocatedButton = document.getElementById('fetchUnallocatedButton'); // New button
    const generateUsersTableButton = document.getElementById('generateUsersTableButton');

    const usersTableContainer = document.getElementById('usersTableContainer');
    const roleFilterDropdown = document.getElementById('roleFilter');
    const teamFilterDropdown = document.getElementById('teamFilter');
    const rosterGroupFilterDropdown = document.getElementById('rosterGroupFilter'); // New dropdown

    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');

    let lastFetchedUsersData = null;
    let lastFetchedLeavesData = null;
    let lastFetchedUnallocatedData = null; // Cache for unallocated data if needed for other purposes

    let rolesMap = new Map();
    let teamsMap = new Map();
    let leaveTypesMap = new Map();

    // --- Configuration ---
    const LEAVES_LOCAL_FILE_PATH = 'testleave.json';
    const USERS_LOCAL_FILE_PATH = 'testusers.json';
    const UNALLOCATED_LOCAL_FILE_PATH = 'testunalloc.json'; // New local file path

    const LEAVES_API_ENDPOINT = "https://api.hosportal.com/get-leaves-and-leave-requests";
    const USERS_API_ENDPOINT = "https://api.hosportal.com/get-site-users";
    const UNALLOCATED_API_ENDPOINT = "https://api.hosportal.com/get-unallocated-available-role-instances"; // New API endpoint

    const SITE_ID = "a14c0405-4fb0-432b-9ce3-a5c460dffdf5";
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
            fetchUnallocatedButton.textContent = useLocal ? `Fetch Unallocated from ${UNALLOCATED_LOCAL_FILE_PATH} (JSON)` : 'Fetch Unallocated from API (JSON)';
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
                // Standardize header setting
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
            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data loaded successfully from ${dataSource}!`;

            if (dataType === 'users') {
                lastFetchedUsersData = result;
                rolesMap = new Map((lastFetchedUsersData.roles || []).map(role => [role.id, role.name]));
                teamsMap = new Map((lastFetchedUsersData.teams || []).map(team => [team.id, team.name]));
                populateFilterDropdowns(lastFetchedUsersData);
            } else if (dataType === 'leaves') {
                lastFetchedLeavesData = result;
                leaveTypesMap = new Map((lastFetchedLeavesData.leaveTypes || []).map(lt => [lt.id, lt.name]));
            } else if (dataType === 'unallocated') {
                lastFetchedUnallocatedData = result; // Cache if needed for other features
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
        try {
            await performFetch(USERS_API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify({ "siteId": SITE_ID, "associations": ["Role", "Team", "SiteUserProfile", "RoleInstanceFte", "RoleInstanceTeam", "RoleInstanceSkill"] }),
                redirect: 'follow'
            }, useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, 'users');
        } catch (e) { /* Handled by performFetch */ }
    }

    // New function for fetching unallocated data
    async function fetchUnallocatedDataAndDisplayJson() {
        const useLocal = useLocalFileCheckbox.checked;

        if (useLocal) {
            try {
                await performFetch(null, {}, true, UNALLOCATED_LOCAL_FILE_PATH, 'unallocated');
            } catch (e) { /* Handled */ }
        } else {
            const fromDateStr = fromDateInput.value;
            const toDateStr = toDateInput.value;
            const selectedRosterGroupId = rosterGroupFilterDropdown.value;

            if (!fromDateStr || !toDateStr) {
                statusElement.textContent = 'Please select "From" and "To" dates for the Unallocated API call.';
                statusElement.className = 'error';
                return;
            }
            if (!selectedRosterGroupId) {
                statusElement.textContent = 'Please select a Roster Group.';
                statusElement.className = 'error';
                return;
            }

            const apiStart = `${fromDateStr}T00:00:00.000Z`;
            const apiEnd = `${toDateStr}T23:59:59.999Z`;

            const rawBody = JSON.stringify({
                "siteId": SITE_ID,
                "start": apiStart,
                "end": apiEnd,
                "roleIds": [],
                "rosterGroupId": selectedRosterGroupId
            });

            const requestOptions = {
                method: 'POST',
                body: rawBody,
                redirect: 'follow'
            };
            try {
                await performFetch(UNALLOCATED_API_ENDPOINT, requestOptions, false, '', 'unallocated');
            } catch (e) { /* Handled */ }
        }
    }

    async function triggerGenerateUsersTable() {
        usersTableContainer.innerHTML = 'Generating table, fetching data if needed...';
        try {
            const dataFetchPromises = [];
            if (!lastFetchedUsersData || useLocalFileCheckbox.checked || (!useLocalFileCheckbox.checked && bearerTokenInput.value.trim())) {
                dataFetchPromises.push(
                    performFetch(USERS_API_ENDPOINT, {
                        method: 'POST',
                        body: JSON.stringify({ "siteId": SITE_ID, "associations": ["Role", "Team", "SiteUserProfile", "RoleInstanceFte", "RoleInstanceTeam"] }),
                        redirect: 'follow'
                    }, useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, 'users')
                );
            }
            if (!lastFetchedLeavesData || useLocalFileCheckbox.checked || (!useLocalFileCheckbox.checked && bearerTokenInput.value.trim())) {
                dataFetchPromises.push(
                    performFetch(LEAVES_API_ENDPOINT, {
                        method: 'POST',
                        body: JSON.stringify({ "siteId": SITE_ID, "statuses": ["waiting", "denied", "approved"], "associations": ["LeaveType", "RoleInstance"] }),
                        redirect: 'follow'
                    }, useLocalFileCheckbox.checked, LEAVES_LOCAL_FILE_PATH, 'leaves')
                );
            }

            if (dataFetchPromises.length > 0) {
                await Promise.all(dataFetchPromises);
            }

            if (lastFetchedUsersData && lastFetchedLeavesData) {
                const selectedRoleIds = getSelectedValues(roleFilterDropdown);
                const selectedTeamIds = getSelectedValues(teamFilterDropdown);
                generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, selectedRoleIds, selectedTeamIds);
            } else {
                let missingData = [];
                if (!lastFetchedUsersData) missingData.push("user data");
                if (!lastFetchedLeavesData) missingData.push("leave data");

                if (!useLocalFileCheckbox.checked && !bearerTokenInput.value.trim() && missingData.length > 0) {
                    statusElement.textContent = `Cannot generate table: Bearer token missing for API call to fetch ${missingData.join(' and ')}.`;
                } else if (missingData.length > 0) {
                    statusElement.textContent = `Cannot generate table: Missing ${missingData.join(' and ')}. Fetch data first.`;
                }
                statusElement.className = 'error';
                usersTableContainer.innerHTML = '';
            }
        } catch (error) {
            console.error("Could not generate table due to fetch error(s):", error);
            statusElement.textContent = 'Error fetching data for table. Check console.';
            statusElement.className = 'error';
            usersTableContainer.innerHTML = '<p class="error">Table generation failed due to data fetch errors.</p>';
        }
    }

    function populateFilterDropdowns(data) {
        // Populate Role Filter
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

        // Populate Team Filter
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

    function generateUsersTable(usersData, leavesData, selectedRoleIds, selectedTeamIds) {
        usersTableContainer.innerHTML = '';

        if (!usersData || !usersData.siteUsers || !Array.isArray(usersData.siteUsers)) {
            usersTableContainer.innerHTML = '<p class="error">User data is missing or not in expected format.</p>'; return;
        }
        if (!leavesData || !leavesData.leaves || !Array.isArray(leavesData.leaves)) {
            usersTableContainer.innerHTML = '<p class="error">Leave data is missing or not in expected format.</p>'; return;
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
        let currentDate = new Date(fromDate);
        while (currentDate <= toDate) {
            dateRange.push(new Date(currentDate));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        const leavesByRoleInstance = new Map();
        (leavesData.leaves || []).forEach(leave => {
            if (!leavesByRoleInstance.has(leave.roleInstanceId)) {
                leavesByRoleInstance.set(leave.roleInstanceId, []);
            }
            leavesByRoleInstance.get(leave.roleInstanceId).push({
                start: new Date(leave.start),
                end: new Date(leave.end),
                typeId: leave.leaveTypeId
            });
        });

        const filterByAllRoles = selectedRoleIds.includes("All");
        const filterByAllTeams = selectedTeamIds.includes("All");

        // Corrected Filtering Logic
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

        const headerRow = document.createElement('tr');
        const baseHeaders = ['First Name', 'Last Name', 'Site User ID', 'Role Instances & Teams'];
        baseHeaders.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        dateRange.forEach(date => {
            const th = document.createElement('th');
            th.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        filteredSiteUsers.forEach(siteUser => {
            const tr = document.createElement('tr');
            const profile = siteUser.siteUserProfile || {};
            tr.appendChild(createCell(profile.firstName || 'N/A'));
            tr.appendChild(createCell(profile.lastName || 'N/A'));
            tr.appendChild(createCell(siteUser.id || 'N/A'));

            // Re-added detailed role instance and team display logic
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
                        roleInstancesHtmlContent += `<li><b>Role Inst. ID:</b> ${ri.id}<br>
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

            // Date/Leave Cells
            dateRange.forEach(tableDay => {
                const td = document.createElement('td');
                let leaveTypesOnThisDay = new Set();

                if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
                    siteUser.roleInstances.forEach(ri => {
                        // Only consider leaves for role instances that are part of the current role filter
                        if (!filterByAllRoles && !selectedRoleIds.includes(ri.roleId)) {
                            return;
                        }
                        // Only consider leaves for role instances that are part of the current team filter
                        const partOfSelectedTeam = filterByAllTeams ||
                            (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));
                        if (!partOfSelectedTeam) {
                            return;
                        }

                        const userLeavesForRoleInstance = leavesByRoleInstance.get(ri.id) || [];
                        userLeavesForRoleInstance.forEach(leave => {
                            const normalizedTableDay = new Date(Date.UTC(tableDay.getUTCFullYear(), tableDay.getUTCMonth(), tableDay.getUTCDate()));
                            const normalizedLeaveStart = new Date(Date.UTC(leave.start.getUTCFullYear(), leave.start.getUTCMonth(), leave.start.getUTCDate()));
                            const normalizedLeaveEnd = new Date(Date.UTC(leave.end.getUTCFullYear(), leave.end.getUTCMonth(), leave.end.getUTCDate()));

                            if (normalizedTableDay >= normalizedLeaveStart && normalizedTableDay <= normalizedLeaveEnd) {
                                const leaveTypeName = leaveTypesMap.get(leave.typeId) || 'Leave';
                                leaveTypesOnThisDay.add(leaveTypeName);
                            }
                        });
                    });
                }
                td.textContent = Array.from(leaveTypesOnThisDay).join(', ');
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        usersTableContainer.appendChild(table);
        statusElement.textContent = `Users table generated with ${filteredSiteUsers.length} entries. Date range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
        statusElement.className = '';
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

    function handleFilterChange() {
        if (lastFetchedUsersData && lastFetchedLeavesData) {
            const selectedRoleIds = getSelectedValues(roleFilterDropdown);
            const selectedTeamIds = getSelectedValues(teamFilterDropdown);
            generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, selectedRoleIds, selectedTeamIds);
        } else {
            statusElement.textContent = 'Please fetch/generate user and leave data first to apply filters.';
            usersTableContainer.innerHTML = '';
        }
    }

    // Event Listeners
    if (fetchLeavesButton) fetchLeavesButton.addEventListener('click', fetchLeavesDataAndDisplayJson);
    if (fetchUsersButton) fetchUsersButton.addEventListener('click', fetchUsersDataAndDisplayJson);
    if (fetchUnallocatedButton) fetchUnallocatedButton.addEventListener('click', fetchUnallocatedDataAndDisplayJson); // New listener
    if (generateUsersTableButton) generateUsersTableButton.addEventListener('click', triggerGenerateUsersTable);

    if (useLocalFileCheckbox) useLocalFileCheckbox.addEventListener('change', updateButtonTexts);
    if (roleFilterDropdown) roleFilterDropdown.addEventListener('change', handleFilterChange);
    if (teamFilterDropdown) teamFilterDropdown.addEventListener('change', handleFilterChange);
    if (fromDateInput) fromDateInput.addEventListener('change', handleFilterChange);
    if (toDateInput) toDateInput.addEventListener('change', handleFilterChange);
    // No event listener needed for rosterGroupFilter to auto-update table, it's for a separate API call

    // Default dates
    const today = new Date();
    const oneWeekFromToday = new Date();
    oneWeekFromToday.setDate(today.getDate() + 7);
    if (fromDateInput) fromDateInput.valueAsDate = today;
    if (toDateInput) toDateInput.valueAsDate = oneWeekFromToday;

    updateButtonTexts(); // Initial call
});