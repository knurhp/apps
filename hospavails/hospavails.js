document.addEventListener('DOMContentLoaded', () => {
    const jsonDataElement = document.getElementById('jsonData');
    const statusElement = document.getElementById('status');
    const bearerTokenInput = document.getElementById('bearerTokenInput');
    const useLocalFileCheckbox = document.getElementById('useLocalFileCheckbox');
    const fetchLeavesButton = document.getElementById('fetchLeavesButton');
    const fetchUsersButton = document.getElementById('fetchUsersButton');
    const generateUsersTableButton = document.getElementById('generateUsersTableButton');
    const usersTableContainer = document.getElementById('usersTableContainer');
    const roleFilterDropdown = document.getElementById('roleFilter');
    const teamFilterDropdown = document.getElementById('teamFilter');

    let lastFetchedUsersData = null;
    let rolesMap = new Map();
    let teamsMap = new Map();

    // --- Configuration ---
    const LEAVES_LOCAL_FILE_PATH = 'testleave.json';
    const USERS_LOCAL_FILE_PATH = 'testusers.json';
    const LEAVES_API_ENDPOINT = "https://api.hosportal.com/get-leaves-and-leave-requests";
    const USERS_API_ENDPOINT = "https://api.hosportal.com/get-site-users";
    const SITE_ID = "a14c0405-4fb0-432b-9ce3-a5c460dffdf5";
    // ---------------------

    function updateButtonTexts() {
        const useLocal = useLocalFileCheckbox.checked;
        if (fetchLeavesButton) {
            fetchLeavesButton.textContent = useLocal ? `Fetch Leaves from ${LEAVES_LOCAL_FILE_PATH}` : 'Fetch Leaves from API';
        }
        if (fetchUsersButton) {
            fetchUsersButton.textContent = useLocal ? `Fetch Users from ${USERS_LOCAL_FILE_PATH} (JSON)` : 'Fetch Users from API (JSON)';
        }
        if (generateUsersTableButton) {
            generateUsersTableButton.textContent = useLocal ? `Table from ${USERS_LOCAL_FILE_PATH}` : 'Table from API Users';
        }
        statusElement.textContent = useLocal ?
            'Ready. Click a button to load from local file.' :
            'Enter token (if needed) and click a button to load from API.';
    }

    // Helper function to get selected values from a multi-select dropdown
    function getSelectedValues(selectElement) {
        const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
        // If "All" is selected, it effectively means no specific filtering for this category.
        // If nothing is selected in a multi-select, it usually means the user wants to see all.
        if (selectedOptions.length === 0 || selectedOptions.includes("All")) {
            return ["All"]; 
        }
        return selectedOptions;
    }

    async function performFetch(url, requestOptions = {}, isLocalFile = false, localFilePath = '', isUsersData = false) {
        jsonDataElement.textContent = ''; 
        
        const dataSource = isLocalFile ? localFilePath : 'API';
        statusElement.textContent = `Fetching data from ${dataSource}...`;
        statusElement.className = ''; 

        try {
            let response;
            if (isLocalFile) {
                response = await fetch(localFilePath);
            } else {
                // ... (API token handling same as before) ...
                const token = bearerTokenInput.value.trim();
                if (!token) {
                    throw new Error('Bearer token is required for API calls.');
                }
                if (requestOptions.headers && !requestOptions.headers.has("Authorization")) {
                    requestOptions.headers.append("Authorization", `Bearer ${token}`);
                } else if (!requestOptions.headers) {
                    requestOptions.headers = new Headers({ "Authorization": `Bearer ${token}` });
                }
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
            statusElement.textContent = `Data loaded successfully from ${dataSource}!`;

            if (isUsersData) {
                lastFetchedUsersData = result; 
                rolesMap = new Map((lastFetchedUsersData.roles || []).map(role => [role.id, role.name]));
                teamsMap = new Map((lastFetchedUsersData.teams || []).map(team => [team.id, team.name]));
                populateFilterDropdowns(lastFetchedUsersData);
            }
            return result;

        } catch (error) {
            console.error(`Error fetching data from ${dataSource}:`, error);
            jsonDataElement.textContent = `An error occurred:\n${error.message}`;
            statusElement.textContent = `Failed to load data from ${dataSource}.`;
            statusElement.className = 'error';
            if (isUsersData) lastFetchedUsersData = null;
            throw error;
        }
    }

    async function fetchLeavesData() {
        try {
            await performFetch(LEAVES_API_ENDPOINT, {
                method: 'POST',
                headers: new Headers({"Content-Type": "application/json"}),
                body: JSON.stringify({ "siteId": SITE_ID, "statuses": ["waiting", "denied"], "associations": ["Role", "RoleInstance", "LeaveType", "Team", "Skill"] }),
                redirect: 'follow'
            }, useLocalFileCheckbox.checked, LEAVES_LOCAL_FILE_PATH, false);
        } catch(e) { /* Handled by performFetch */ }
    }

    async function fetchUsersDataAndDisplayJson() {
        try {
            await performFetch(USERS_API_ENDPOINT, {
                method: 'POST',
                headers: new Headers({"Content-Type": "application/json"}),
                body: JSON.stringify({ "siteId": SITE_ID, "associations": ["Role", "Skill", "Team", "SiteUserProfile", "RoleInstanceInformation", "RoleInstanceFte"] }),
                redirect: 'follow'
            }, useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, true);
        } catch(e) { /* Handled by performFetch */ }
    }
    
async function triggerGenerateUsersTable() {
        try {
            // Fetch if no data, or if local files are used (to reload local file),
            // or if token is present but API data might be stale.
            if (!lastFetchedUsersData || useLocalFileCheckbox.checked || (bearerTokenInput.value.trim() && !isLocalFileCheckbox.checked)) {
                await performFetch(USERS_API_ENDPOINT, {
                    method: 'POST',
                    headers: new Headers({"Content-Type": "application/json"}),
                    body: JSON.stringify({ "siteId": SITE_ID, "associations": ["Role", "Skill", "Team", "SiteUserProfile", "RoleInstanceInformation", "RoleInstanceFte"] }),
                    redirect: 'follow'
                }, useLocalFileCheckbox.checked, USERS_LOCAL_FILE_PATH, true);
            }
            
            if (lastFetchedUsersData) {
                const selectedRoleIds = getSelectedValues(roleFilterDropdown);
                const selectedTeamIds = getSelectedValues(teamFilterDropdown);
                generateUsersTable(lastFetchedUsersData, selectedRoleIds, selectedTeamIds);
            } else if (!useLocalFileCheckbox.checked && !bearerTokenInput.value.trim()) {
                 statusElement.textContent = 'Cannot generate table: Bearer token missing for API call.';
                 statusElement.className = 'error';
                 usersTableContainer.innerHTML = ''; // Clear table
            } else {
                statusElement.textContent = 'No user data available. Fetch users data first (JSON or for table).';
                statusElement.className = 'error';
                usersTableContainer.innerHTML = ''; // Clear table
            }
        } catch (error) {
            console.error("Could not generate table due to fetch error:", error);
            usersTableContainer.innerHTML = ''; // Clear table on error
        }
    }

    function populateFilterDropdowns(data) {
        // Populate Role Filter
        const currentRoleSelections = getSelectedValues(roleFilterDropdown);
        roleFilterDropdown.innerHTML = '<option value="All">All Roles</option>'; 
        if (data && data.roles) {
            const uniqueRoles = [...new Map(data.roles.map(role => [role.id, role])).values()]; 
            uniqueRoles.sort((a,b) => (a.name || '').localeCompare(b.name || '')).forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.name || 'Unnamed Role';
                if (currentRoleSelections.includes(role.id)) option.selected = true;
                roleFilterDropdown.appendChild(option);
            });
        }
         // Re-apply "All" selection if it was the case and no specific items are now selected
        if (currentRoleSelections.includes("All") && Array.from(roleFilterDropdown.selectedOptions).length === 0) {
            roleFilterDropdown.querySelector('option[value="All"]').selected = true;
        }


        // Populate Team Filter
        const currentTeamSelections = getSelectedValues(teamFilterDropdown);
        teamFilterDropdown.innerHTML = '<option value="All">All Teams</option>'; 
        if (data && data.teams) {
            const uniqueTeams = [...new Map(data.teams.map(team => [team.id, team])).values()]; 
            uniqueTeams.sort((a,b) => (a.name || '').localeCompare(b.name || '')).forEach(team => {
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

    function generateUsersTable(data, selectedRoleIds, selectedTeamIds) {
        usersTableContainer.innerHTML = ''; 

        if (!data || !data.siteUsers || !Array.isArray(data.siteUsers)) {
            usersTableContainer.innerHTML = '<p class="error">No siteUsers data found or data is not in expected format.</p>';
            return;
        }

        const filterByAllRoles = selectedRoleIds.includes("All");
        const filterByAllTeams = selectedTeamIds.includes("All");

        const filteredSiteUsers = data.siteUsers.filter(siteUser => {
            const hasMatchingRole = filterByAllRoles || 
                                (siteUser.roleInstances && siteUser.roleInstances.some(ri => selectedRoleIds.includes(ri.roleId)));
            
            const hasMatchingTeam = filterByAllTeams ||
                                (siteUser.roleInstances && siteUser.roleInstances.some(ri => 
                                    ri.roleInstanceTeams && ri.roleInstanceTeams.some(rit => selectedTeamIds.includes(rit.teamId))
                                ));
            return hasMatchingRole && hasMatchingTeam;
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
        const headers = ['First Name', 'Last Name', 'Site User ID', 'Role Instances & Teams'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
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

            let roleInstancesHtml = '';
            if (siteUser.roleInstances && siteUser.roleInstances.length > 0) {
                const visibleRoleInstances = siteUser.roleInstances.filter(ri => 
                    filterByAllRoles || selectedRoleIds.includes(ri.roleId)
                );

                if (visibleRoleInstances.length > 0) {
                    roleInstancesHtml = '<ul>';
                    visibleRoleInstances.forEach(ri => {
                        const roleName = rolesMap.get(ri.roleId) || 'Unknown Role';
                        let teamsHtml = 'No relevant teams'; // Default if no teams or none match filter
                        
                        if (ri.roleInstanceTeams && ri.roleInstanceTeams.length > 0) {
                            const relevantTeamsForThisRI = ri.roleInstanceTeams
                                .filter(rit => filterByAllTeams || selectedTeamIds.includes(rit.teamId))
                                .map(rit => {
                                    const teamName = teamsMap.get(rit.teamId) || 'Unknown Team';
                                    return `Team: ${teamName} (ID: ${rit.teamId})`;
                                });

                            if (relevantTeamsForThisRI.length > 0) {
                                teamsHtml = relevantTeamsForThisRI.join('; ');
                            } else if (!filterByAllTeams) { // Specific team(s) selected but none matched for THIS RI
                                teamsHtml = 'No teams match filter for this role instance.';
                            } else { // "All Teams" selected, but this RI has no teams
                                 teamsHtml = 'No teams assigned to this role instance.';
                            }
                        }
                         roleInstancesHtml += `<li><b>Role Inst. ID:</b> ${ri.id}<br>
                                                  <b>Role:</b> ${roleName} (ID: ${ri.roleId})<br>
                                                  <b>Teams:</b> ${teamsHtml}</li>`;
                    });
                    roleInstancesHtml += '</ul>';
                } else {
                     roleInstancesHtml = 'Role instances present but do not match current role filter.';
                }
            } else {
                roleInstancesHtml = 'No role instances';
            }
            tr.appendChild(createCell(roleInstancesHtml, true));
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        usersTableContainer.appendChild(table);
        statusElement.textContent = `Users table generated with ${filteredSiteUsers.length} entries matching filters.`;
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
        if (lastFetchedUsersData) {
            const selectedRoleIds = getSelectedValues(roleFilterDropdown);
            const selectedTeamIds = getSelectedValues(teamFilterDropdown);
            generateUsersTable(lastFetchedUsersData, selectedRoleIds, selectedTeamIds);
        } else {
            statusElement.textContent = 'Please fetch/generate user data first to apply filters.';
            usersTableContainer.innerHTML = ''; 
        }
    }
    
    if (fetchLeavesButton) fetchLeavesButton.addEventListener('click', fetchLeavesData);
    if (fetchUsersButton) fetchUsersButton.addEventListener('click', fetchUsersDataAndDisplayJson);
    if (generateUsersTableButton) generateUsersTableButton.addEventListener('click', triggerGenerateUsersTable);
    if (useLocalFileCheckbox) useLocalFileCheckbox.addEventListener('change', updateButtonTexts);
    if (roleFilterDropdown) roleFilterDropdown.addEventListener('change', handleFilterChange);
    if (teamFilterDropdown) teamFilterDropdown.addEventListener('change', handleFilterChange);

    updateButtonTexts(); // Initial call
});