document.addEventListener('DOMContentLoaded', () => {
    const jsonDataElement = document.getElementById('jsonData');
    const statusElement = document.getElementById('status');
    const bearerTokenInput = document.getElementById('bearerTokenInput');
    const useLocalFileCheckbox = document.getElementById('useLocalFileCheckbox');

    const fetchLeavesButton = document.getElementById('fetchLeavesButton');
    const fetchUsersButton = document.getElementById('fetchUsersButton');
    const fetchShiftTemplatesButton = document.getElementById('fetchShiftTemplatesButton');
    const generateUsersTableButton = document.getElementById('generateUsersTableButton');

    const usersTableContainer = document.getElementById('usersTableContainer');
    const roleFilterDropdown = document.getElementById('roleFilter');
    const teamFilterDropdown = document.getElementById('teamFilter');
    const rosterGroupFilterDropdown = document.getElementById('rosterGroupFilter');
    const showUnallocatedCheckbox = document.getElementById('showUnallocatedCheckbox');

    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');

    let lastFetchedUsersData = null;
    let lastFetchedLeavesData = null;
    let lastFetchedShiftTemplatesData = null;

    let rolesMap = new Map();
    let teamsMap = new Map();
    let leaveTypesMap = new Map();

    // --- Configuration ---
    const LEAVES_LOCAL_FILE_PATH = 'testleave.json';
    const USERS_LOCAL_FILE_PATH = 'testusers.json';
    const SHIFT_TEMPLATES_LOCAL_FILE_PATH = 'testshifts.json';

    const LEAVES_API_ENDPOINT = "https://api.hosportal.com/get-leaves-and-leave-requests";
    const USERS_API_ENDPOINT = "https://api.hosportal.com/get-site-users";
    const SHIFT_TEMPLATES_API_ENDPOINT = "https://api.hosportal.com/get-user-shift-templates";

    const SITE_ID = "a14c0405-4fb0-432b-9ce3-a5c460dffdf5";
    const ROSTER_GROUPS_CONFIG = [
        { id: "75d5cc8d-4b0a-4392-88e1-c3b6bb37056f", name: "RLH Allocations" },
        { id: "a40e918a-af4d-4cb9-bce6-99b5de1a0352", name: "PA Allocations" },
        { id: "b856d0ca-fc49-48f8-be65-b2418b804875", name: "Example RG 3 (from testshifts)"}
    ];
    const EXCLUDED_ROSTER_GROUP_IDS = ["b856d0ca-fc49-48f8-be65-b2418b804875"]; // ID for "Example RG 3"
    // ---------------------

    function updateButtonTexts() {
        const useLocal = useLocalFileCheckbox.checked;
        if (fetchLeavesButton) {
            fetchLeavesButton.textContent = useLocal ? `Leaves from ${LEAVES_LOCAL_FILE_PATH}` : 'Leaves from API';
        }
        if (fetchUsersButton) {
            fetchUsersButton.textContent = useLocal ? `Users from ${USERS_LOCAL_FILE_PATH}` : 'Users from API';
        }
        if (fetchShiftTemplatesButton) {
            fetchShiftTemplatesButton.textContent = useLocal ? `Shift Templates from ${SHIFT_TEMPLATES_LOCAL_FILE_PATH}` : 'Shift Templates from API';
        }
        if (generateUsersTableButton) {
            generateUsersTableButton.textContent = `Table from ${useLocal ? 'Local Files' : 'API Data'}`;
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
                if (!token && dataType !== 'local-only-type') { // Allow some types to not require token if local
                     throw new Error('Bearer token is required for API calls.');
                }
                const headers = new Headers(requestOptions.headers || {});
                if (token && !headers.has("Authorization")) { // Add token if provided and not already set
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
            } else if (dataType === 'leaves') {
                lastFetchedLeavesData = result;
                leaveTypesMap = new Map((lastFetchedLeavesData.leaveTypes || []).map(lt => [lt.id, lt.name]));
            } else if (dataType === 'shift_templates') {
                lastFetchedShiftTemplatesData = result;
            }

            jsonDataElement.textContent = JSON.stringify(result, null, 2);
            statusElement.textContent = `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data loaded successfully from ${dataSource}!`;
            return result;

        } catch (error) {
            console.error(`Error fetching ${dataType} data from ${dataSource}:`, error);
            jsonDataElement.textContent = `An error occurred fetching ${dataType} data:\n${error.message}`;
            statusElement.textContent = `Failed to load ${dataType} data from ${dataSource}.`;
            statusElement.className = 'error';
            if (dataType === 'users') lastFetchedUsersData = null;
            if (dataType === 'leaves') lastFetchedLeavesData = null;
            if (dataType === 'shift_templates') lastFetchedShiftTemplatesData = null;
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
        const raw = JSON.stringify({
            "siteId": SITE_ID,
            "associations": [
                "Role", "Skill", "Team", "SiteUserProfile",
                "RoleInstanceInformation", "RoleInstanceFte"
            ]
        });
        const requestOptions = {
            method: 'POST', body: raw, redirect: 'follow'
        };
        try {
            await performFetch(
                USERS_API_ENDPOINT, requestOptions,
                useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, 'users'
            );
        } catch (e) { /* Handled by performFetch */ }
    }

    async function fetchShiftTemplatesDataAndDisplayJson() {
        const raw = JSON.stringify({
          "siteId": SITE_ID
        });
        const requestOptions = {
          method: 'POST',
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
            if (!lastFetchedUsersData) await fetchUsersDataAndDisplayJson();
            if (!lastFetchedLeavesData) await fetchLeavesDataAndDisplayJson();
            if (!lastFetchedShiftTemplatesData) await fetchShiftTemplatesDataAndDisplayJson();

            // Ensure all data is actually loaded before proceeding
            if (!lastFetchedUsersData || !lastFetchedLeavesData || !lastFetchedShiftTemplatesData) {
                throw new Error("One or more required data sources failed to load. Cannot generate table.");
            }
            
            const selectedRoleIds = getSelectedValues(roleFilterDropdown);
            const selectedTeamIds = getSelectedValues(teamFilterDropdown);
            // The main generateUsersTable will now use these and shiftTemplatesData
            generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedShiftTemplatesData, selectedRoleIds, selectedTeamIds);
        } catch (error) {
            console.error("Error in triggerGenerateUsersTable:", error);
            usersTableContainer.innerHTML = `<span class='error'>Error generating table: ${error.message}</span>`;
            statusElement.textContent = `Error generating table: ${error.message}`;
            statusElement.className = 'error';
        }
    }

    // Helper function to determine if a shift template applies to a given date
    // Treats date strings as UTC dates for comparison.
    function templateAppliesToDate(template, dateStr, dateRange) {
        if (!template.interval || !template.startDate) return false;

        const currentDateObj = new Date(dateStr + 'T00:00:00Z'); // Treat dateStr as UTC
        const templateStartDateObj = new Date(template.startDate + 'T00:00:00Z'); // Treat template.startDate as UTC

        if (currentDateObj < templateStartDateObj) return false;

        if (template.endDate) {
            const templateEndDateObj = new Date(template.endDate + 'T00:00:00Z'); // Treat template.endDate as UTC
            if (currentDateObj > templateEndDateObj) return false;
        }

        // TODO: Implement "notIntervals" logic if needed.
        // For now, we assume no "notIntervals" block the application.

        if (template.interval.type === 'none') {
            // For 'none', if endDate is present, it's a range. Otherwise, it's just startDate.
            // The initial date range check (currentDateObj vs templateStart/EndDateObj) handles this.
            return true;
        }

        if (template.interval.type === 'weekly') {
            const currentDayOfWeek = currentDateObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const apiDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek; // Convert to 1=Mon, ..., 7=Sun

            if (!template.interval.daysOfWeek || !template.interval.daysOfWeek.includes(apiDayOfWeek)) {
                return false;
            }

            const spacing = template.interval.spacing || 1;
            const offset = template.interval.offset || 0; // offset is 0-indexed week offset

            // Calculate weeks since the start of the template's recurrence pattern.
            // This needs to be relative to a consistent "start of week" if the API implies one,
            // or more simply, the number of weeks passed since templateStartDateObj on the same day of week.

            // Difference in days between currentDateObj and templateStartDateObj
            const diffTime = currentDateObj.getTime() - templateStartDateObj.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            const weeksSinceStart = Math.floor(diffDays / 7);

            if ((weeksSinceStart - offset) % spacing !== 0) {
                 return false;
            }
            return true;
        }
        // TODO: Implement other interval types if necessary (daily, monthly, yearly, holidays)
        // console.warn(`Unhandled interval type: ${template.interval.type} for template ${template.id}`);
        return false; // Default to false for unhandled types
    }


    function getDayOfWeek(dateObj) { // Assumes dateObj is UTC
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[dateObj.getUTCDay()];
    }

    function normalizeDate(dateObj) { // Assumes dateObj is UTC
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Main table generation function, refactored for stricter filtering and slotting
    function generateUsersTable(usersData, leavesData, shiftTemplatesData, selectedRoleIds, selectedTeamIds) {
        usersTableContainer.innerHTML = '';

        if (!usersData?.siteUsers?.length) { usersTableContainer.innerHTML = '<p class="error">No siteUsers data.</p>'; return; }
        if (leavesData && !leavesData.leaves && !Array.isArray(leavesData.leaveTypes)) {
             usersTableContainer.innerHTML = '<p class="error">Leave data structure invalid.</p>'; return;
        }
        if (!shiftTemplatesData || !Array.isArray(shiftTemplatesData.userShiftTemplates)) {
            usersTableContainer.innerHTML = '<p class="error">Shift templates data missing or invalid.</p>'; return;
        }

        const shouldShowUnallocated = showUnallocatedCheckbox.checked;
        const selectedRosterGroupIdFromDropdown = rosterGroupFilterDropdown.value;

        const fromDateStr = fromDateInput.value;
        const toDateStr = toDateInput.value;
        if (!fromDateStr || !toDateStr) { usersTableContainer.innerHTML = '<p class="error">Please select both "From" and "To" dates.</p>'; return; }

        const fromDate = new Date(fromDateStr + "T00:00:00Z");
        const toDate = new Date(toDateStr + "T23:59:59Z");

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
            usersTableContainer.innerHTML = '<p class="error">Invalid date range selected.</p>'; return;
        }

        const dateRange = [];
        let currentDateIter = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
        const toDateLimit = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
        while (currentDateIter <= toDateLimit) {
            dateRange.push(new Date(currentDateIter));
            currentDateIter.setUTCDate(currentDateIter.getUTCDate() + 1);
        }
        if (dateRange.length === 0) {
            usersTableContainer.innerHTML = '<p>Date range is empty or invalid.</p>'; return;
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
                    amStatuses: [],
                    pmStatuses: []
                });
            }
            return userDateMap.get(dateKey);
        }

        // 1. Process Leaves
        (leavesData.leaves || []).forEach(leave => {
            const leaveStart = new Date(leave.start.includes('T') ? leave.start : leave.start + 'T00:00:00Z');
            const leaveEnd = new Date(leave.end.includes('T') ? leave.end : leave.end + 'T23:59:59Z');
            let currentLeaveDate = new Date(Date.UTC(leaveStart.getUTCFullYear(), leaveStart.getUTCMonth(), leaveStart.getUTCDate()));
            const leaveEndDateOnly = new Date(Date.UTC(leaveEnd.getUTCFullYear(), leaveEnd.getUTCMonth(), leaveEnd.getUTCDate()));

            while(currentLeaveDate <= leaveEndDateOnly) {
                const dateKey = normalizeDate(currentLeaveDate);
                if (dateRange.find(drDate => normalizeDate(drDate) === dateKey)) {
                    const entry = getOrCreateDailySlotEntry(leave.roleInstanceId, dateKey);
                    entry.leaveTypes.add(leaveTypesMap.get(leave.leaveTypeId) || 'Leave');
                }
                currentLeaveDate.setUTCDate(currentLeaveDate.getUTCDate() + 1);
            }
        });


        // 2. Process Shift Templates with stricter filtering
        const amSlotStartMinutes = 7 * 60 + 30;
        const amSlotEndMinutes = 12 * 60 + 30;
        const pmSlotStartMinutes = 13 * 60;
        const pmSlotEndMinutes = 17 * 60 + 30;

        (shiftTemplatesData.userShiftTemplates || []).forEach(template => {
            // STAGE 1 FILTERING: Hardcoded exclusion
            if (EXCLUDED_ROSTER_GROUP_IDS.includes(template.rosterGroupId)) {
                return;
            }
            // STAGE 2 FILTERING: Dropdown selection
            if (selectedRosterGroupIdFromDropdown !== "All" && template.rosterGroupId !== selectedRosterGroupIdFromDropdown) {
                return;
            }
            dateRange.forEach(currentDayInDateRange => {
                const dateKey = normalizeDate(currentDayInDateRange);
                if (templateAppliesToDate(template, dateKey, dateRange)) {
                    const entry = getOrCreateDailySlotEntry(template.roleInstanceId, dateKey);
                    let itemStartHour = template.startTime.hour;
                    let itemStartMinute = template.startTime.minute;
                    let itemEndHour = template.endTime.hour;
                    let itemEndMinute = template.endTime.minute;
                    let effectiveStartTotalMinutes = itemStartHour * 60 + itemStartMinute;
                    let effectiveEndTotalMinutes = itemEndHour * 60 + itemEndMinute;
                    if (template.startTime.dayOffset && template.startTime.dayOffset < 0) {
                        effectiveStartTotalMinutes = 0;
                    }
                    if (template.endTime.dayOffset && template.endTime.dayOffset > 0) {
                        effectiveEndTotalMinutes = 24 * 60;
                    } else if (itemEndHour === 0 && itemEndMinute === 0 &&
                               (!template.endTime.dayOffset || template.endTime.dayOffset === 0) &&
                               (itemStartHour !== 0 || itemStartMinute !== 0 || (template.startTime.dayOffset || 0) !== 0) ) {
                        effectiveEndTotalMinutes = 24 * 60;
                    }
                    const detailString = `${template.type.charAt(0).toUpperCase() + template.type.slice(1)}: ${String(itemStartHour).padStart(2,'0')}:${String(itemStartMinute).padStart(2,'0')} - ${String(itemEndHour).padStart(2,'0')}:${String(itemEndMinute).padStart(2,'0')}` +
                                         (template.startTime.dayOffset ? ` (Start DO:${template.startTime.dayOffset})` : '') +
                                         (template.endTime.dayOffset ? ` (End DO:${template.endTime.dayOffset})` : '') +
                                         (template.rosterGroupId ? ` (RG: ${ROSTER_GROUPS_CONFIG.find(rg => rg.id === template.rosterGroupId)?.name || template.rosterGroupId.slice(0,8)})` : '');
                    const statusObject = { type: template.type, details: detailString, updatedAt: template.updatedAt, rosterGroupId: template.rosterGroupId };
                    if (effectiveStartTotalMinutes < amSlotEndMinutes && effectiveEndTotalMinutes > amSlotStartMinutes) {
                        entry.amStatuses.push(statusObject);
                    }
                    if (effectiveStartTotalMinutes < pmSlotEndMinutes && effectiveEndTotalMinutes > pmSlotStartMinutes) {
                        entry.pmStatuses.push(statusObject);
                    }
                }
            });
        });


        // 3. Filter and Sort Users
        const filterByAllRoles = selectedRoleIds.includes("All");
        const filterByAllTeams = selectedTeamIds.includes("All");
        const filteredSiteUsers = (usersData.siteUsers || []).filter(siteUser => {
             const matchesRole = filterByAllRoles ||
                (siteUser.roleInstances && siteUser.roleInstances.some(ri => selectedRoleIds.includes(ri.roleId)));
            const matchesTeam = filterByAllTeams ||
                (siteUser.roleInstances && siteUser.roleInstances.some(ri =>
                    ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId))
                ));
            return matchesRole && matchesTeam;
        }).sort((a,b) => {
            const lastNameA = (a.siteUserProfile?.lastName || '').toLowerCase();
            const lastNameB = (b.siteUserProfile?.lastName || '').toLowerCase();
            if (lastNameA < lastNameB) return -1;
            if (lastNameA > lastNameB) return 1;
            const firstNameA = (a.siteUserProfile?.firstName || '').toLowerCase();
            const firstNameB = (b.siteUserProfile?.firstName || '').toLowerCase();
            if (firstNameA < firstNameB) return -1;
            if (firstNameA > firstNameB) return 1;
            return 0;
        });

        if (filteredSiteUsers.length === 0) {
            usersTableContainer.innerHTML = '<p>No users match the current filter criteria.</p>';
            const selectedRosterGroupName = selectedRosterGroupIdFromDropdown === "All" ? "All" : ROSTER_GROUPS_CONFIG.find(rg => rg.id === selectedRosterGroupIdFromDropdown)?.name || selectedRosterGroupIdFromDropdown;
            statusElement.textContent = `Users table generated with 0 matching entries. Roster Group: ${selectedRosterGroupName}. Date range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
            statusElement.className = '';
            return;
        }
        // 4. Calculate Daily Tallies
         const dailyTallies = {};
        dateRange.forEach(tableDay => {
            const dateKey = normalizeDate(tableDay);
            dailyTallies[dateKey] = {
                amLeave: new Set(), amUnavailable: new Set(),
                pmLeave: new Set(), pmUnavailable: new Set()
            };
            filteredSiteUsers.forEach(siteUser => {
                let userIsOnLeaveAMForTally = false;
                let userIsOnLeavePMForTally = false;
                let userIsUnavailableAMForTally = false;
                let userIsUnavailablePMForTally = false;
                (siteUser.roleInstances || []).forEach(ri => {
                    const roleInstanceMatchesRoleFilter = filterByAllRoles || selectedRoleIds.includes(ri.roleId);
                    const roleInstanceMatchesTeamFilter = filterByAllTeams || (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));
                    if (roleInstanceMatchesRoleFilter && roleInstanceMatchesTeamFilter) {
                        if (userDailySlotInfo.has(ri.id) && userDailySlotInfo.get(ri.id).has(dateKey)) {
                            const dailyInfo = userDailySlotInfo.get(ri.id).get(dateKey);
                            if (dailyInfo.leaveTypes.size > 0) {
                                userIsOnLeaveAMForTally = true;
                                userIsOnLeavePMForTally = true;
                            } else {
                                if (dailyInfo.amStatuses.some(s => s.type === 'unavailable')) userIsUnavailableAMForTally = true;
                                if (dailyInfo.pmStatuses.some(s => s.type === 'unavailable')) userIsUnavailablePMForTally = true;
                            }
                        }
                    }
                });
                if (userIsOnLeaveAMForTally) dailyTallies[dateKey].amLeave.add(siteUser.id);
                else if (userIsUnavailableAMForTally) dailyTallies[dateKey].amUnavailable.add(siteUser.id);

                if (userIsOnLeavePMForTally) dailyTallies[dateKey].pmLeave.add(siteUser.id);
                else if (userIsUnavailablePMForTally) dailyTallies[dateKey].pmUnavailable.add(siteUser.id);
            });
        });


        // 5. Build Table HTML
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const baseHeaders = ['Last Name', 'First Name', 'Role & Teams'];

        // Tally Header Row
        const tallyHeaderRow = document.createElement('tr');
        tallyHeaderRow.className = 'tally-header-row';
        baseHeaders.forEach(() => {
            const th = document.createElement('th');
            th.className = 'tally-spacer-cell'; // To align with main headers
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
        thead.appendChild(tallyHeaderRow);

        // Main Header Rows
        const headerRow1 = document.createElement('tr');
        baseHeaders.forEach(headerText => {
            const th = document.createElement('th');
            th.rowSpan = 2; th.textContent = headerText; headerRow1.appendChild(th);
        });
        dateRange.forEach(date => {
            const th = document.createElement('th');
            th.colSpan = 2; th.className = 'date-header';
            th.textContent = `${getDayOfWeek(date)} ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
            headerRow1.appendChild(th);
        });
        thead.appendChild(headerRow1);

        const headerRow2 = document.createElement('tr');
        dateRange.forEach(() => {
            const thAM = document.createElement('th'); thAM.textContent = 'AM'; thAM.className = 'sub-header'; headerRow2.appendChild(thAM);
            const thPM = document.createElement('th'); thPM.textContent = 'PM'; thPM.className = 'sub-header'; headerRow2.appendChild(thPM);
        });
        thead.appendChild(headerRow2);
        table.appendChild(thead);

        // Table Body Rows
        filteredSiteUsers.forEach(siteUser => {
            const tr = document.createElement('tr');
            const profile = siteUser.siteUserProfile || {};
            tr.appendChild(createCell(profile.lastName || 'N/A'));
            tr.appendChild(createCell(profile.firstName || 'N/A'));

            let roleInstancesHtmlContent = '';
            if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
                const roleInstanceDetails = siteUser.roleInstances
                    .filter(ri => filterByAllRoles || selectedRoleIds.includes(ri.roleId))
                    .map(ri => {
                        const roleName = rolesMap.get(ri.roleId) || `RoleID: ${ri.roleId.slice(0,6)}`;
                        const teamNames = (ri.roleInstanceTeams || [])
                            .filter(rit => filterByAllTeams || selectedTeamIds.includes(rit.teamId))
                            .map(rit => teamsMap.get(rit.teamId) || `TeamID: ${rit.teamId.slice(0,6)}`)
                            .join(', ');
                        if (!filterByAllTeams && teamNames.length === 0 && ri.roleInstanceTeams && ri.roleInstanceTeams.length > 0) return null; 
                        return `<span>${roleName}: ${teamNames || (filterByAllTeams && (!ri.roleInstanceTeams || ri.roleInstanceTeams.length ===0) ? '(No teams)' : '(No teams match filter)')}</span>`;
                    }).filter(detail => detail !== null);
                roleInstancesHtmlContent = roleInstanceDetails.join('<br>') || (filterByAllRoles ? 'No role instances' : 'No role instances match filter');
            } else {
                roleInstancesHtmlContent = 'No role assignments';
            }
            tr.appendChild(createCell(roleInstancesHtmlContent, true));


            dateRange.forEach(tableDay => {
                const dateKeyForLookup = normalizeDate(tableDay);
                let amCellData = { content: '', class: 'empty-slot-cell', title: '', sortKey: 4 };
                let pmCellData = { content: '', class: 'empty-slot-cell', title: '', sortKey: 4 };
                
                let combinedAmDetailsSet = new Set();
                let combinedPmDetailsSet = new Set();
                let amDisplayStatuses = [];
                let pmDisplayStatuses = [];


                (siteUser.roleInstances || []).forEach(ri => {
                    const roleMatches = filterByAllRoles || selectedRoleIds.includes(ri.roleId);
                    const teamMatches = filterByAllTeams || 
                                        (ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId)));

                    if (roleMatches && teamMatches && userDailySlotInfo.has(ri.id) && userDailySlotInfo.get(ri.id).has(dateKeyForLookup)) {
                        const dailyInfo = userDailySlotInfo.get(ri.id).get(dateKeyForLookup);

                        // AM Slot processing for this RoleInstance
                        if (dailyInfo.leaveTypes.size > 0) {
                            const leaveText = Array.from(dailyInfo.leaveTypes).join(', ');
                            amDisplayStatuses.push({ label: leaveText, class: 'leave-cell', sortKey: 0, details: leaveText });
                        } else {
                            dailyInfo.amStatuses.forEach(status => {
                                if (selectedRosterGroupIdFromDropdown === "All" || status.rosterGroupId === selectedRosterGroupIdFromDropdown) {
                                    if (status.type === 'unavailable') {
                                        amDisplayStatuses.push({ label: 'Unavail.', class: 'unavailable-cell', sortKey: 1, details: status.details, rosterGroupId: status.rosterGroupId });
                                    } else if (status.type === 'allocated') {
                                        amDisplayStatuses.push({ label: 'Alloc.', class: 'allocated-cell', sortKey: 2, details: status.details, rosterGroupId: status.rosterGroupId });
                                    } else if (status.type === 'unallocated' && shouldShowUnallocated) {
                                        amDisplayStatuses.push({ label: 'Unalloc.', class: 'unallocated-cell', sortKey: 3, details: status.details, rosterGroupId: status.rosterGroupId });
                                    }
                                }
                            });
                        }

                        // PM Slot processing for this RoleInstance
                        if (dailyInfo.leaveTypes.size > 0) {
                             const leaveText = Array.from(dailyInfo.leaveTypes).join(', ');
                            pmDisplayStatuses.push({ label: leaveText, class: 'leave-cell', sortKey: 0, details: leaveText });
                        } else {
                            dailyInfo.pmStatuses.forEach(status => {
                                if (selectedRosterGroupIdFromDropdown === "All" || status.rosterGroupId === selectedRosterGroupIdFromDropdown) {
                                    if (status.type === 'unavailable') {
                                        pmDisplayStatuses.push({ label: 'Unavail.', class: 'unavailable-cell', sortKey: 1, details: status.details, rosterGroupId: status.rosterGroupId });
                                    } else if (status.type === 'allocated') {
                                        pmDisplayStatuses.push({ label: 'Alloc.', class: 'allocated-cell', sortKey: 2, details: status.details, rosterGroupId: status.rosterGroupId });
                                    } else if (status.type === 'unallocated' && shouldShowUnallocated) {
                                        pmDisplayStatuses.push({ label: 'Unalloc.', class: 'unallocated-cell', sortKey: 3, details: status.details, rosterGroupId: status.rosterGroupId });
                                    }
                                }
                            });
                        }
                    }
                });

                function getUniqueDisplayStatuses(statuses) {
                    const unique = [];
                    const seen = new Set();
                    statuses.forEach(s => {
                        const key = `${s.label}|${s.class}|${s.rosterGroupId || ''}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            unique.push(s);
                        }
                    });
                    return unique;
                }
                amDisplayStatuses = getUniqueDisplayStatuses(amDisplayStatuses);
                pmDisplayStatuses = getUniqueDisplayStatuses(pmDisplayStatuses);
                if (amDisplayStatuses.length > 0) {
                    amDisplayStatuses.sort((a,b) => a.sortKey - b.sortKey);
                    amCellData.content = amDisplayStatuses.map(s => `<span class="${s.class}">${s.label}</span>`).join(', ');
                    amCellData.class = amDisplayStatuses.length > 1 ? 'multi-status-cell' : amDisplayStatuses[0].class;
                    amDisplayStatuses.forEach(s => combinedAmDetailsSet.add(s.details));
                    amCellData.title = Array.from(combinedAmDetailsSet).join('\n');
                }
                if (pmDisplayStatuses.length > 0) {
                    pmDisplayStatuses.sort((a,b) => a.sortKey - b.sortKey);
                    pmCellData.content = pmDisplayStatuses.map(s => `<span class="${s.class}">${s.label}</span>`).join(', ');
                    pmCellData.class = pmDisplayStatuses.length > 1 ? 'multi-status-cell' : pmDisplayStatuses[0].class;
                    pmDisplayStatuses.forEach(s => combinedPmDetailsSet.add(s.details));
                    pmCellData.title = Array.from(combinedPmDetailsSet).join('\n');
                }
                
                const tdAM = createCell(amCellData.content, true);
                tdAM.className = amCellData.class;
                if (amCellData.title) tdAM.title = amCellData.title;
                tr.appendChild(tdAM);

                const tdPM = createCell(pmCellData.content, true);
                tdPM.className = pmCellData.class;
                if (pmCellData.title) tdPM.title = pmCellData.title;
                tr.appendChild(tdPM);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        usersTableContainer.appendChild(table);
        const selectedRosterGroupName = selectedRosterGroupIdFromDropdown === "All" ? "All" : ROSTER_GROUPS_CONFIG.find(rg => rg.id === selectedRosterGroupIdFromDropdown)?.name || selectedRosterGroupIdFromDropdown;
        statusElement.textContent = `Users table generated with ${filteredSiteUsers.length} entries. Roster Group: ${selectedRosterGroupName}. Date range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
        statusElement.className = '';
    }


    function handleFilterChange() {
        // Only regenerate table if all necessary data is present
        if (lastFetchedUsersData && lastFetchedLeavesData && lastFetchedShiftTemplatesData) {
            const selectedRoleIds = getSelectedValues(roleFilterDropdown);
            const selectedTeamIds = getSelectedValues(teamFilterDropdown);
            // Call the main generateUsersTable function
            generateUsersTable(lastFetchedUsersData, lastFetchedLeavesData, lastFetchedShiftTemplatesData, selectedRoleIds, selectedTeamIds);
        } else {
            statusElement.textContent = 'Please fetch all required data (Users, Leaves, Shift Templates) before applying filters or changing dates.';
            statusElement.className = 'error';
            // Optionally, clear the table if data is missing
            // usersTableContainer.innerHTML = '<p class="error">Data missing, cannot apply filters.</p>';
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
           if(roleFilterDropdown.querySelector('option[value="All"]')) roleFilterDropdown.querySelector('option[value="All"]').selected = true;
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
            if(teamFilterDropdown.querySelector('option[value="All"]')) teamFilterDropdown.querySelector('option[value="All"]').selected = true;
        }
    }

    function populateRosterGroupFilterDropdown() {
        if (!rosterGroupFilterDropdown) return;
        rosterGroupFilterDropdown.innerHTML = ''; // Clear existing options

        // Add "All" option first
        const allOption = document.createElement('option');
        allOption.value = "All";
        allOption.textContent = "All Roster Groups";
        rosterGroupFilterDropdown.appendChild(allOption);

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
            if (rg.id === paAllocationsId) { // Default to PA Allocations if "All" is not desired as default
                // option.selected = true; // Comment out if "All" should be default
            }
            rosterGroupFilterDropdown.appendChild(option);
        });
        // Default to "All"
        allOption.selected = true;
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
    if (fetchShiftTemplatesButton) fetchShiftTemplatesButton.addEventListener('click', fetchShiftTemplatesDataAndDisplayJson);
    if (generateUsersTableButton) generateUsersTableButton.addEventListener('click', triggerGenerateUsersTable);

    if (useLocalFileCheckbox) useLocalFileCheckbox.addEventListener('change', updateButtonTexts);
    if (roleFilterDropdown) roleFilterDropdown.addEventListener('change', handleFilterChange);
    if (teamFilterDropdown) teamFilterDropdown.addEventListener('change', handleFilterChange);
    if (rosterGroupFilterDropdown) rosterGroupFilterDropdown.addEventListener('change', handleFilterChange);
    if (showUnallocatedCheckbox) showUnallocatedCheckbox.addEventListener('change', handleFilterChange); // Re-added listener
    if (fromDateInput) fromDateInput.addEventListener('change', handleFilterChange);
    if (toDateInput) toDateInput.addEventListener('change', handleFilterChange);

    // Set default date range (today for 7 days)
    const today = new Date();
    const oneWeekFromToday = new Date();
    oneWeekFromToday.setDate(today.getDate() + 7);

    // Format as YYYY-MM-DD for input type="date"
    const formatDateForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (fromDateInput) fromDateInput.value = formatDateForInput(today);
    if (toDateInput) toDateInput.value = formatDateForInput(oneWeekFromToday);


    updateButtonTexts();
    populateRosterGroupFilterDropdown();

    // Hide unneeded controls (already in your code, kept for consistency)
    const unallocatedButtonElement = document.getElementById('fetchUnallocatedButton');
    if (unallocatedButtonElement) unallocatedButtonElement.style.display = 'none';
    
    // The parent of showUnallocatedCheckbox might not be what you expect if it's just a label after it.
    // Assuming it's wrapped or its immediate previous sibling is the label.
    // if (showUnallocatedCheckbox && showUnallocatedCheckbox.parentElement.tagName === 'LABEL') {
    //     showUnallocatedCheckbox.parentElement.style.display = 'none'; // If checkbox is inside label
    // } else if (showUnallocatedCheckbox && showUnallocatedCheckbox.previousElementSibling && showUnallocatedCheckbox.previousElementSibling.tagName === 'LABEL') {
    //    // showUnallocatedCheckbox.previousElementSibling.style.display = 'none'; // Hides label
    //    // showUnallocatedCheckbox.style.display = 'none'; // Hides checkbox
    // }
    // The `showUnallocatedCheckbox` is kept as its state is used. The button was removed.
    // The UI elements for fetching "Unallocated" data directly are removed, but the concept
    // of "unallocated" shifts from Shift Templates is still valid and controlled by the checkbox.

});