
        // 1. YOUR APPS SCRIPT URL
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6YoLahuA2UEON2r7RqT_Tym2soKTSfDXC2dzORSI36Oxc4igQ_cRf_d-Yj5fH2RaSVQ/exec";

        // --- UI & Routing Functions ---
        function toggleMenu() {
            document.getElementById('main-nav').classList.toggle('active');
        }

        function showPage(pageId) {
            document.getElementById('page-home').style.display = 'none';
            document.getElementById('page-login').style.display = 'none';
            document.getElementById('page-settings').style.display = 'none';
            
            document.getElementById('page-' + pageId).style.display = 'block';
            document.getElementById('main-nav').classList.remove('active'); // Close mobile menu
        }

        function updateMenuForLoggedInUser(user) {
            document.getElementById('nav-login').style.display = 'none';
            document.getElementById('nav-settings').style.display = 'block';
            document.getElementById('nav-logout').style.display = 'block';
            document.getElementById('welcome-user').innerText = `Welcome, ${user.names || user.email}`;
            
            populateForm(user);
        }

        // Fills the form with data from Google Sheets
        function populateForm(user) {
            document.getElementById('set-names').value = user.names || "";
            document.getElementById('set-lastnames').value = user.lastnames || "";
            document.getElementById('set-phone').value = user.phone || "";
            document.getElementById('set-birthday').value = user.birthday || "";
            
            // Match the exact sheet headers!
            document.getElementById('set-david_list').checked = (user.david_list === true || user.david_list === "TRUE");
            document.getElementById('set-david_connection').checked = (user.david_connection === true || user.david_connection === "TRUE");
            document.getElementById('set-david_outreach').checked = (user.david_outreach === true || user.david_outreach === "TRUE");
            document.getElementById('set-host_meeting').checked = (user.host_monthly_meeting === true || user.host_monthly_meeting === "TRUE");
            document.getElementById('set-birthday_list').checked = (user.birthday_list === true || user.birthday_list === "TRUE");
        }

        // --- Authentication & Data Functions ---

        // Request a link (Sends POST to Apps Script)
        async function requestMagicLink() {
            const emailInput = document.getElementById('user-email').value;
            const messageEl = document.getElementById('login-message');

            if (!emailInput) {
                messageEl.innerText = "Please enter a valid email address.";
                messageEl.style.color = "red";
                return;
            }

            messageEl.innerText = "Generating secure link... please wait.";
            messageEl.style.color = "blue";

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: "requestMagicLink", email: emailInput })
                });

                const result = await response.json();

                if (result.status === "success") {
                    messageEl.innerText = "Success! Please check your email for the login link.";
                    messageEl.style.color = "green";
                    document.getElementById('user-email').value = ""; 
                } else {
                    messageEl.innerText = "Error: " + result.message;
                    messageEl.style.color = "red";
                }
            } catch (error) {
                messageEl.innerText = "Network error. Please try again.";
                messageEl.style.color = "red";
            }
        }

        // Check for token on page load (Sends GET to Apps Script)
        async function checkUrlForToken() {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            if (token) {
                showPage('login');
                document.getElementById('login-message').innerText = "Verifying your secure link... please wait.";
                document.getElementById('login-message').style.color = "blue";

                try {
                    const response = await fetch(`${SCRIPT_URL}?token=${token}`);
                    const result = await response.json();

                    if (result.status === "success") {
                        localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                        window.history.replaceState({}, document.title, window.location.pathname);
                        updateMenuForLoggedInUser(result.user);
                        showPage('settings');
                    } else {
                        document.getElementById('login-message').innerText = "Link expired or invalid. Please request a new one.";
                        document.getElementById('login-message').style.color = "red";
                    }
                } catch (error) {
                    document.getElementById('login-message').innerText = "Verification failed. Please try again.";
                    document.getElementById('login-message').style.color = "red";
                }
            } else {
                const savedUser = localStorage.getItem('rey_david_user');
                if (savedUser) {
                    updateMenuForLoggedInUser(JSON.parse(savedUser));
                }
            }
        }

        // Saves the form data back to Google Sheets
async function saveSettings(event) {
            event.preventDefault(); 
            
            const messageEl = document.getElementById('save-message');
            messageEl.innerText = "Saving...";
            messageEl.style.color = "blue";
            
            const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
            if (!savedUser) return;

            // Build the payload with your exact sheet headers!
            const payload = {
                action: "updateSettings",
                email: savedUser.email,
                names: document.getElementById('set-names').value,
                lastnames: document.getElementById('set-lastnames').value,
                phone: document.getElementById('set-phone').value,
                birthday: document.getElementById('set-birthday').value,
                david_list: document.getElementById('set-david_list').checked,
                david_connection: document.getElementById('set-david_connection').checked,
                david_outreach: document.getElementById('set-david_outreach').checked,
                host_monthly_meeting: document.getElementById('set-host_meeting').checked,
                birthday_list: document.getElementById('set-birthday_list').checked
            };

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.status === "success") {
                    messageEl.innerText = "Settings saved successfully!";
                    messageEl.style.color = "green";
                    localStorage.setItem('rey_david_user', JSON.stringify({...savedUser, ...payload}));
                } else {
                    messageEl.innerText = "Error: " + result.message;
                    messageEl.style.color = "red";
                }
            } catch (error) {
                messageEl.innerText = "Network error. Could not save.";
                messageEl.style.color = "red";
            }
        }
        
        function logout() {
            localStorage.removeItem('rey_david_user');
            
            document.getElementById('nav-login').style.display = 'block';
            document.getElementById('nav-settings').style.display = 'none';
            document.getElementById('nav-logout').style.display = 'none';
            
            showPage('home');
            alert("Logged out successfully.");
        }

        // Run this function the moment the page finishes loading
        window.onload = checkUrlForToken;

