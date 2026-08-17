function doPost(e) {
  try {



    // 1. Parse the incoming request from your app.js
    const request = JSON.parse(e.postData.contents);
    
    //temporal
    if (request.action === "registerConference") {
      return handleConferenceRegistration(request);
    }

    // 2. THE ROUTER: Send the request to the correct handler function based on the 'action'
    if (request.action === "getHomeData") {
      return handleGetHomeData(request);
    }

    if (request.action === "getEvents") {
      return handleGetEvents(request);
    }

    if (request.action === "getAnnouncements") {
      return handleGetAnnouncements(request);
    }

    if (request.action === "addAnnouncement") {
      return handleAddAnnouncement(request);
    }

    if (request.action === "editAnnouncement") {
      return handleEditAnnouncement(request);
    }

    if (request.action === "deleteAnnouncement") {
      return handleDeleteAnnouncement(request);
    }
        
    if (request.action === "updateSettings") {
      return handleUpdateSettings(request);
    }
    
    if (request.action === "requestMagicLink") {
      return handleRequestMagicLink(request);
    }

    if (request.action === "getLibrary") {
      return handleGetLibrary(request);
    }

    if (request.action === "getHome") {
      return createJsonResponse(handleGetHome(request));
   }
    
    // ✨ THIS IS THE MISSING LINK FOR YOUR MEMBERS DIRECTORY ✨
    if (request.action === "getDirectory") {
      return handleGetDirectory(request);
    }

    if (request.action === "getAttendance") {
      return handleGetAttendance(request);
    }

    if (request.action === "getAttendeesDetails") {
      return handleGetAttendeesDetails(request);
    }
    
    if (request.action === "updateAttendance") {
      return handleUpdateAttendance(request);
    }

    if (request.action === "getAdminAttendance") {
      return handleGetAdminAttendance(request);
    }

    if (request.action === "updateWent") {
      return handleUpdateWent(request);
    }

    if (request.action === "submitFeedback") {
      return handleSubmitFeedback(request);
    }

    if (request.action === "getApps") {
      return handleGetApps(request);
    }

    if (request.action === "registerUser") {
      return handleRegisterUser(request);
    }

    if (request.action === "checkEmail") {
      return handleCheckEmail(request);
    }

    // 3. Fallback: If app.js asks for an action that doesn't exist
    return createJsonResponse({ 
      status: "error", 
      message: "Unknown action requested: " + request.action 
    });

    

  } catch (error) {
    // 4. Catch-all to prevent CORS errors if the code above completely fails
    return createJsonResponse({ 
      status: "error", 
      message: "Backend Router Error: " + error.toString() 
    });
  }
}

// ---------------------------------------------------------
// Helper Function required for doPost to avoid CORS errors!)
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- MAGIC LINK GENERATOR ---
function handleRequestMagicLink(request) {
  // Extract the email and destination from the incoming request payload
  const userEmail = request.email; 
  const dest = request.dest || ""; // ✨ Capturamos si viene la orden de ir a settings
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName("_USERS");
  const tokensSheet = ss.getSheetByName("_TOKENS");
  
  const usersData = usersSheet.getDataRange().getValues();
  const headers = usersData[0]; 
  let userExists = false;
  let isDenied = false;
  
  // 1. Check if they exist and are banned
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][headers.indexOf("email")]).toLowerCase() === String(userEmail).toLowerCase()) {
      userExists = true;
      const denyVal = usersData[i][headers.indexOf("_DENY_ACCESS")];
      if (denyVal === true || denyVal === "TRUE") {
        isDenied = true;
      }
      break;
    }
  }
  
  // 🚪 SIDE DOOR 1 LOCKED: Block the email from sending!
  if (isDenied) {
    return createJsonResponse({ status: "error", message: "Account access restricted." });
  }
  
  // 2. If it's a new user, add them dynamically
  if (!userExists) {
    let newRow = new Array(headers.length).fill(""); // Create an empty row
    if (headers.indexOf("timestamp") !== -1) newRow[headers.indexOf("timestamp")] = new Date();
    newRow[headers.indexOf("email")] = userEmail;
    usersSheet.appendRow(newRow);
  }
  
  // 3. Generate token
  const token = Utilities.getUuid();
  const expiration = new Date(new Date().getTime() + 15 * 60000); 
  tokensSheet.appendRow([userEmail, token, expiration]);
  
  // 🚨 IMPORTANT: Make sure this is your correct GitHub Pages URL!
  const myWebsiteUrl = "https://jleviaguirre.github.io/ReyDavid/"; 
  
  // ✨ CONSTRUCCIÓN DEL LINK CON EL HASH DESTINO
  const hashPart = dest ? "#" + dest : "";
  const loginUrl = myWebsiteUrl + "?token=" + token + "&email=" + encodeURIComponent(userEmail) + hashPart;
  
  // 4. Enviar el correo con formato
  const htmlBody = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 500px; margin: auto;">
      <h2 style="color: #003366; margin-top: 0;">Acceso a la App Rey David</h2>
      <p style="color: #444; font-size: 16px; line-height: 1.5;">Haz clic en el siguiente botón para ingresar a tu cuenta de forma segura. Este enlace expira en 15 minutos.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 14px 30px; background-color: #0087cb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Ingresar a la App</a>
      </div>
      
      <p style="color: #888; font-size: 0.85em; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">Si no solicitaste este acceso, puedes ignorar este correo.</p>
    </div>
  `;

  MailApp.sendEmail({
    to: userEmail,
    subject: "Tu enlace de acceso - App Rey David",
    htmlBody: htmlBody
  });
  
  return createJsonResponse({ status: "success", message: "Link sent!" });
}

//Reads exactly your headers
function doGet(e) {
  // Manejo del token mágico a través de la petición en segundo plano de app.js
  if (e.parameter.token) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const tokensSheet = ss.getSheetByName("_TOKENS");
      const tokensData = tokensSheet.getDataRange().getValues();
      
      let emailFound = null;
      let rowIndex = -1;
      
      const now = new Date();
      
      // Buscar el token
      for (let i = 1; i < tokensData.length; i++) {
        if (tokensData[i][1] === e.parameter.token) {
          let expirationDate = new Date(tokensData[i][2]);
          if (now <= expirationDate) {
            emailFound = tokensData[i][0];
            rowIndex = i + 1; // Fila real en la hoja
          }
          break;
        }
      }
      
      if (emailFound) {
        // Token válido -> Borrarlo por seguridad (un solo uso)
        tokensSheet.deleteRow(rowIndex);
        
        // Obtener el perfil del usuario desde _USERS
        const usersSheet = ss.getSheetByName("_USERS");
        const usersData = usersSheet.getDataRange().getValues();
        const headers = usersData[0].map(h => String(h).toLowerCase().trim());
        
        let userProfile = { email: emailFound };
        
        for (let i = 1; i < usersData.length; i++) {
          if (String(usersData[i][headers.indexOf("email")]).toLowerCase().trim() === String(emailFound).toLowerCase().trim()) {
            // Mapear todos los datos disponibles
            headers.forEach((header, colIndex) => {
              if (header !== "_deny_access") { // No enviar banderas de seguridad al frontend
                userProfile[header] = usersData[i][colIndex];
              }
            });
            break;
          }
        }
        
        // ✨ IMPORTANTE: Devolver la respuesta en formato JSON!
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "success", 
          user: userProfile 
        })).setMimeType(ContentService.MimeType.JSON);
        
      } else {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "error", 
          message: "Token inválido o expirado." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: error.toString() 
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // (Opcional) Si entran a la URL del script directamente sin token
  return ContentService.createTextOutput("Endpoint activo.");
}

// --- 4. GET HOME TILES ---
function handleGetHomeData(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 1. DYNAMIC PROFILE & SECURITY CHECK ---
    let isDenied = false;
    let fieldDescriptions = {}; 
    let fieldTypes = {};
    let publicHeaders = [];
    let userProfile = null;

    if (params && params.email) {
      const usersSheet = ss.getSheetByName("_USERS");
      const usersData = usersSheet.getDataRange().getValues();
      const userHeaders = usersData[0]; 
      
      const lastCol = usersSheet.getLastColumn();
      const userNotes = usersSheet.getRange(1, 1, 1, lastCol).getNotes()[0];
      const validations = usersSheet.getDataRange().getDataValidations();
      
      for (let c = 0; c < userHeaders.length; c++) {
        let header = userHeaders[c];
        if (header && !header.toString().startsWith('_') && header !== 'timestamp' && header !== 'email') {
            publicHeaders.push(header);
            fieldDescriptions[header] = userNotes[c] || "";
            
            let isCheckbox = false;
            if (validations.length > 1 && validations[1][c] && validations[1][c].getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
                isCheckbox = true;
            }
            if (!isCheckbox && usersData.length > 1 && (usersData[1][c] === true || usersData[1][c] === false)) {
                isCheckbox = true;
            }
            fieldTypes[header] = isCheckbox ? "checkbox" : "text";
        }
      }
      
      for (let i = 1; i < usersData.length; i++) {
        if (String(usersData[i][userHeaders.indexOf("email")]).toLowerCase() === String(params.email).toLowerCase()) {
            const denyVal = usersData[i][userHeaders.indexOf("_DENY_ACCESS")];
          if (denyVal === true || denyVal === "TRUE") {
            isDenied = true;
          } else {
            userProfile = { email: params.email };
            for (let h of publicHeaders) {
                userProfile[h] = usersData[i][userHeaders.indexOf(h)];
            }
          }
          break;
        }
      }
    }

    // --- 2. GET TABS (Legacy module list) ---
    const allSheets = ss.getSheets();
    const tabTiles = [];
    allSheets.forEach(sheet => {
      const name = sheet.getName();
      if (!name.startsWith('_')) {
        tabTiles.push({ title: name, type: 'tab', color: sheet.getTabColor() });
      }
    });

    // --- 3. GET GLOBAL SETTINGS ---
    const settingsSheet = ss.getSheetByName("_SETTINGS");
    const settingsData = settingsSheet.getDataRange().getValues();
    const settingsHeaders = settingsData[0];
    const siteSettings = {};

    const catIdx = settingsHeaders.indexOf("category");
    const nameIdx = settingsHeaders.indexOf("name");
    const valIdx = settingsHeaders.indexOf("value");

    if (catIdx !== -1 && nameIdx !== -1 && valIdx !== -1) {
      for (let i = 1; i < settingsData.length; i++) {
        const cat = settingsData[i][catIdx];
        const name = settingsData[i][nameIdx];
        const val = settingsData[i][valIdx];

        if (cat && name) {
          const publicIdx = settingsHeaders.indexOf("public");
          if (!siteSettings[cat]) siteSettings[cat] = {};
          
          if (cat === "page") {
            siteSettings[cat][name] = {
              value: val, 
              public: (publicIdx !== -1) ? settingsData[i][publicIdx] : false 
            };
          } else {
            siteSettings[cat][name] = val;
          }
        }
      }
    }

    // --- 4. GET HOME DATA ---
    const homeSheet = ss.getSheetByName("_HOME");
    let homeTiles = [];
    if (homeSheet) {
      const dataRange = homeSheet.getDataRange();
      const values = dataRange.getValues();
      const richTextValues = dataRange.getRichTextValues(); 
      const backgrounds = dataRange.getBackgrounds();
      const fontColors = dataRange.getFontColors();
      const fontWeights = dataRange.getFontWeights();
      const fontStyles = dataRange.getFontStyles();
      const fontSizes = dataRange.getFontSizes(); 
      
      const homeHeaders = values[0]; 
      const now = new Date().getTime();

      for (let i = 1; i < values.length; i++) {
        const hiddenIdx = homeHeaders.indexOf("hidden");
        const isHidden = (hiddenIdx !== -1) ? values[i][hiddenIdx] : false;
        if (isHidden === true || String(isHidden).toUpperCase() === "TRUE") continue; 

        const expVal = values[i][homeHeaders.indexOf("expiration")];
        if (expVal && now > new Date(expVal).getTime()) continue; 

        const contentsIdx = homeHeaders.indexOf("contents");
        const iconIdx = homeHeaders.indexOf("icon");
        const reqAuthIdx = homeHeaders.indexOf("requires_auth");
        
        const tile = {
          title: values[i][homeHeaders.indexOf("title")] || "",
          subtitle: values[i][homeHeaders.indexOf("subtitle")] || "",
          html: values[i][homeHeaders.indexOf("html")] || "", 
          icon: (iconIdx !== -1) ? values[i][iconIdx] : "",
          requires_auth: (reqAuthIdx !== -1) ? values[i][reqAuthIdx] : false,
          contents: convertRichTextToHtml(richTextValues[i][contentsIdx]),
          format: {
            bg: backgrounds[i][contentsIdx],
            color: fontColors[i][contentsIdx],
            weight: fontWeights[i][contentsIdx],
            style: fontStyles[i][contentsIdx],
            size: fontSizes[i][contentsIdx] 
          }
        };
        homeTiles.push(tile);
      }
    }

    const menuSheet = ss.getSheetByName("_MENU");
    let siteMenu = [];
    
    if (menuSheet) {
      const menuData = menuSheet.getDataRange().getValues();
      if (menuData.length > 1) { // Ensure there are actual rows beneath the headers
        const menuHeaders = menuData[0].map(h => h.toString().toLowerCase().trim());
        
        for (let i = 1; i < menuData.length; i++) {
          let rowObj = {};
          menuHeaders.forEach((header, index) => {
            if (header) rowObj[header] = menuData[i][index];
          });
          // Only push the row if it has at least a name or an icon
          if (rowObj.name || rowObj.icon) {
            siteMenu.push(rowObj);
          }
        }
      }
    }

    // --- 6. RETURN PAYLOAD ---
    return createJsonResponse({ 
      status: isDenied ? "denied" : "success", 
      tabs: tabTiles, 
      homeTiles: homeTiles, 
      settings: siteSettings, 
      menu: siteMenu, // ✨ NEW: Send the menu structure to the frontend app!
      blueprint: { headers: publicHeaders, types: fieldTypes, descriptions: fieldDescriptions },
      userProfile: userProfile
    });
    
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// DYNAMIC SAVING
function handleUpdateSettings(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName("_USERS");
  const data = usersSheet.getDataRange().getValues();
  const headers = data[0]; 
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][headers.indexOf("email")]).toLowerCase() === String(params.email).toLowerCase()) {
      const rowIndex = i + 1; 
      
      // Loop through whatever the frontend sent us and save it!
      for (const [key, value] of Object.entries(params.updates)) {
         if (key !== "email" && key !== "timestamp" && !key.startsWith('_')) {
             const colIndex = headers.indexOf(key);
             if (colIndex !== -1) {
                 usersSheet.getRange(rowIndex, colIndex + 1).setValue(value);
             }
         }
      }
      return createJsonResponse({ status: "success", message: "Profile saved!" });
    }
  }
  return createJsonResponse({ status: "error", message: "User not found." });
}

// Helper to convert Google Sheets Rich Text into HTML
// --- RICH TEXT HTML CONVERTER ---
function convertRichTextToHtml(richTextValue) {
  if (!richTextValue) return "";
  
  // If it's just a plain string/number, return it as is
  if (typeof richTextValue === 'string' || typeof richTextValue === 'number') {
    return String(richTextValue).replace(/\n/g, '<br>');
  }

  try {
    const runs = richTextValue.getRuns();
    let html = "";
    
    runs.forEach(run => {
      const text = run.getText();
      if (!text) return;
      
      // Preserve line breaks from the Google Sheet
      let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      
      const style = run.getTextStyle();
      let css = "";
      
      if (style.isBold()) css += "font-weight: bold; ";
      if (style.isItalic()) css += "font-style: italic; ";
      if (style.isUnderline()) css += "text-decoration: underline; ";
      
      const color = style.getForegroundColor();
      // Only apply color if it's not the default black, so it respects dark modes/custom backgrounds
      if (color && color !== "#000000") {
        css += `color: ${color}; `;
      }
      
      const fontSize = style.getFontSize();
      if (fontSize) {
        css += `font-size: ${fontSize}pt; `;
      }
      
      if (css !== "") {
        html += `<span style="${css}">${safeText}</span>`;
      } else {
        html += safeText;
      }
    });
    
    return html;
  } catch (e) {
    // Fallback if something goes wrong
    return String(richTextValue).replace(/\n/g, '<br>');
  }
}

// --- MEMBERS DIRECTORY DATA FETCHING ---
function handleGetDirectory(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Directory"); 
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Directory sheet not found." });
    }

    const dataRange = sheet.getDataRange();
    const data = dataRange.getDisplayValues(); // Gets nicely formatted text/dates
    const headers = data[0];
    
    // ✨ Grab the notes from the very first row (the headers)
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
        return createJsonResponse({ status: "success", headers: [], popupFields: [], data: [] });
    }
    const notes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
    const popupFields = [];
    
    // Check which columns have the magic word "popup"
    for (let j = 0; j < headers.length; j++) {
        if (headers[j] && notes[j]) {
            // Read the first line of the note, make it lowercase to avoid case-sensitivity issues
            const firstLine = notes[j].split('\n')[0].trim().toLowerCase();
            if (firstLine.includes("popup")) {
                popupFields.push(headers[j]);
            }
        }
    }

    const rows = [];
    // Skip the header row and build the data objects
    for (let i = 1; i < data.length; i++) {
      let rowObj = {};
      let isEmptyRow = true;
      
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
            rowObj[headers[j]] = data[i][j];
            if (data[i][j]) isEmptyRow = false; // Check if the row actually has data
        }
      }
      if (!isEmptyRow) rows.push(rowObj);
    }

    return createJsonResponse({ 
        status: "success", 
        headers: headers, 
        popupFields: popupFields, // ✨ Send the popup configuration to the app!
        data: rows 
    });
    
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- LIBRARY DATA FETCHING ---
function handleGetLibrary(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Library"); 
    
    if (!sheet) return createJsonResponse({ status: "error", message: "Library sheet not found." });

    const data = sheet.getDataRange().getDisplayValues(); 
    const headers = data[0];
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      let rowObj = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) rowObj[headers[j]] = data[i][j];
      }
      
      // ✨ NEW RULE: Only send rows that have BOTH a category AND a url
      if (rowObj.category && rowObj.url) {
          rows.push(rowObj);
      }
    }

    return createJsonResponse({ status: "success", data: rows });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- GET ANNOUNCEMENTS (Upgraded with Lookups & Row Tracking) ---
function handleGetAnnouncements(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Announcements");
    if (!sheet) return createJsonResponse({ status: "error", message: "Announcements sheet not found." });

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      let rowObj = {};
      let isEmpty = true;
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
          rowObj[headers[j]] = data[i][j];
          if (data[i][j]) isEmpty = false;
        }
      }
      // ✨ CRITICAL: Store the exact row number so we can target it for edits!
      rowObj._rowIndex = i + 1; 
      if (!isEmpty) rows.push(rowObj);
    }

    // ✨ NEW: Fetch visual templates from _lookups
    const lookupsSheet = ss.getSheetByName("_lookups");
    const templates = [];
    if (lookupsSheet) {
        const lData = lookupsSheet.getDataRange().getDisplayValues();
        const lHeaders = lData[0].map(h => String(h).toLowerCase().trim());
        const catIdx = lHeaders.indexOf("category");
        const nameIdx = lHeaders.indexOf("name");
        const valIdx = lHeaders.indexOf("value");
        
        if (catIdx > -1 && nameIdx > -1 && valIdx > -1) {
            for (let i = 1; i < lData.length; i++) {
                if (lData[i][catIdx] && lData[i][catIdx].toLowerCase() === "announcement") {
                    templates.push({ name: lData[i][nameIdx], value: lData[i][valIdx] });
                }
            }
        }
    }

    return createJsonResponse({ status: "success", data: rows, templates: templates });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- ADD ANNOUNCEMENT ---
function handleAddAnnouncement(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Announcements");
    if (!sheet) return createJsonResponse({ status: "error", message: "Announcements sheet not found." });

    const headers = sheet.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
    const newRow = new Array(headers.length).fill("");

    const dataMap = {
      title: params.title,
      category: params.category,
      subtitle: params.subtitle,
      contents: params.contents,
      html: params.template, 
      template: params.template,
      icon: params.icon,
      expiration: params.expiration,
      url: params.url,
      link: params.url,
      requires_auth: params.requires_auth, 
      hidden: params.hidden,               
      user: params.email,
      author_name: params.author_name,         // ✨ NEW
      author_lastname: params.author_lastname, // ✨ NEW
      date: new Date()
    };

    for (const [key, value] of Object.entries(dataMap)) {
      const colIndex = headers.indexOf(key);
      if (colIndex > -1) newRow[colIndex] = value;
    }

    sheet.appendRow(newRow);
    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- EDIT ANNOUNCEMENT ---
function handleEditAnnouncement(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Announcements");
    if (!sheet) return createJsonResponse({ status: "error", message: "Sheet not found." });

    const headers = sheet.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
    const rowIndex = params._rowIndex;
    
    if (!rowIndex) return createJsonResponse({ status: "error", message: "Missing row reference." });

    const dataMap = {
      title: params.title,
      category: params.category,
      subtitle: params.subtitle,
      contents: params.contents,
      html: params.template,
      template: params.template,
      icon: params.icon,
      expiration: params.expiration,
      url: params.url,
      link: params.url,
      requires_auth: params.requires_auth, 
      hidden: params.hidden,
      author_name: params.author_name,         // ✨ NEW
      author_lastname: params.author_lastname  // ✨ NEW
    };

    for (const [key, value] of Object.entries(dataMap)) {
      const colIndex = headers.indexOf(key);
      if (colIndex > -1) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(value);
      }
    }

    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}


// --- DELETE ANNOUNCEMENT (SOFT DELETE) ---
function handleDeleteAnnouncement(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Announcements");
    if (!sheet) return createJsonResponse({ status: "error", message: "Sheet not found." });

    const headers = sheet.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
    const rowIndex = params._rowIndex;
    
    if (!rowIndex) return createJsonResponse({ status: "error", message: "Missing row reference." });

    const deletedColIndex = headers.indexOf("deleted");
    
    // Check if the column exists
    if (deletedColIndex > -1) {
      // Set the "deleted" cell to TRUE
      sheet.getRange(rowIndex, deletedColIndex + 1).setValue(true);
      return createJsonResponse({ status: "success" });
    } else {
      return createJsonResponse({ status: "error", message: "Please add a 'deleted' column header to your Announcements sheet." });
    }

  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- GET HOME PAGE BLOCKS ---
function handleGetHome(request) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('_HOME');
    
    // If the sheet doesn't exist yet, gracefully return empty data so the app doesn't crash
    if (!sheet) {
      return { status: "success", data: [] };
    }

    const data = sheet.getDataRange().getValues();
    
    // If it's empty or only has headers, return empty data
    if (data.length <= 1) {
      return { status: "success", data: [] };
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    // Map the rows to the headers
    const formattedData = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        // Skip empty headers
        if (header && header.toString().trim() !== "") {
          obj[header] = row[index];
        }
      });
      return obj;
    });

    return { status: "success", data: formattedData };
    
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

// --- 1. GET ATTENDANCE DATA (CON DATOS DE _USERS INTEGRADOS) ---
function handleGetAttendance(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // A. Leer _USERS y mapear datos
    const usersSheet = ss.getSheetByName("_USERS");
    const usersData = usersSheet.getDataRange().getDisplayValues();
    const userHeaders = usersData[0].map(h => String(h).toLowerCase().trim());
    
    const denyIdx = userHeaders.indexOf("_deny_access");
    const uEmailIdx = userHeaders.indexOf("email");
    const uNameIdx = userHeaders.indexOf("name") > -1 ? userHeaders.indexOf("name") : userHeaders.indexOf("nombre");
    const uLastNameIdx = userHeaders.indexOf("lastname") > -1 ? userHeaders.indexOf("lastname") : userHeaders.indexOf("apellido");
    const uPhoneIdx = userHeaders.indexOf("telefono") > -1 ? userHeaders.indexOf("telefono") : userHeaders.indexOf("phone");
    const uParishIdx = userHeaders.indexOf("parroquia");
    const uAddressIdx = userHeaders.indexOf("direccion") > -1 ? userHeaders.indexOf("direccion") : userHeaders.indexOf("address");
    const uPhotoIdx = userHeaders.indexOf("foto") > -1 ? userHeaders.indexOf("foto") : userHeaders.indexOf("photo");

    let totalMembers = 0;
    let userMap = {}; // Diccionario rápido de usuarios
    
    for (let i = 1; i < usersData.length; i++) {
      const isDenied = denyIdx !== -1 && (usersData[i][denyIdx] === true || String(usersData[i][denyIdx]).toUpperCase() === "TRUE");
      
      if (!isDenied) {
        totalMembers++;
        if (uEmailIdx > -1 && usersData[i][uEmailIdx]) {
            const cleanEmail = String(usersData[i][uEmailIdx]).toLowerCase().trim();
            userMap[cleanEmail] = {
                name: uNameIdx > -1 ? usersData[i][uNameIdx] : "",
                lastname: uLastNameIdx > -1 ? usersData[i][uLastNameIdx] : "",
                telefono: uPhoneIdx > -1 ? usersData[i][uPhoneIdx] : "",
                parroquia: uParishIdx > -1 ? usersData[i][uParishIdx] : "",
                direccion: uAddressIdx > -1 ? usersData[i][uAddressIdx] : "",
                foto: uPhotoIdx > -1 ? usersData[i][uPhotoIdx] : ""
            };
        }
      }
    }

    // B. Buscar Detalles del Evento
    const eventsSheet = ss.getSheetByName("monthly_meetings");
    if (!eventsSheet) return createJsonResponse({ status: "error", message: "monthly_meetings sheet not found." });
    
    const eventsData = eventsSheet.getDataRange().getDisplayValues();
    const eventHeaders = eventsData[0].map(h => String(h).toLowerCase().trim());
    const eventIdIdx = eventHeaders.indexOf("event_id");
    
    let currentEvent = null;
    for (let i = 1; i < eventsData.length; i++) {
      const sheetEventId = String(eventsData[i][eventIdIdx]).trim().toUpperCase();
      const searchEventId = String(params.event_id).trim().toUpperCase();
      
      if (sheetEventId === searchEventId) {
        currentEvent = {
          id: eventsData[i][eventIdIdx],
          title: eventsData[i][eventHeaders.indexOf("title")],
          date: eventsData[i][eventHeaders.indexOf("date")],
          time: eventsData[i][eventHeaders.indexOf("time")],
          host: eventsData[i][eventHeaders.indexOf("host")],
          address: eventsData[i][eventHeaders.indexOf("address")]
        };
        break;
      }
    }

    if (!currentEvent) {
      return createJsonResponse({ status: "error", message: "Event not found in monthly_meetings." });
    }

    // C. Leer la Asistencia
    const attendanceSheet = ss.getSheetByName("Attendance");
    if (!attendanceSheet) return createJsonResponse({ status: "error", message: "Attendance sheet not found." });
    
    const data = attendanceSheet.getDataRange().getDisplayValues();
    
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i].map(h => String(h).toLowerCase().trim()).indexOf("event_id") > -1) {
            headerRowIndex = i;
            break;
        }
    }

    const headers = data[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const idIdx = headers.indexOf("event_id");
    const emailIdx = headers.indexOf("email");
    const guestIdx = headers.indexOf("guests") > -1 ? headers.indexOf("guests") : headers.indexOf("guest");
    const goingIdx = headers.indexOf("going");
    const commentIdx = headers.indexOf("comments") > -1 ? headers.indexOf("comments") : headers.indexOf("comment");
    const attNameIdx = headers.indexOf("name");
    
    let yesCount = 0;
    let noCount = 0;
    let guestCount = 0; 
    let currentUserStatus = { going: false, guests: 0, comments: "", responded: false };
    let attendeesList = []; 
    
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      if (data[i][idIdx] === currentEvent.id) {
        
        const isGoingStr = String(data[i][goingIdx]).toUpperCase();
        const isGoing = (isGoingStr === "TRUE" || isGoingStr === "SÍ" || isGoingStr === "SI");
        const isNotGoing = (isGoingStr === "FALSE" || isGoingStr === "NO");
        
        if (isGoing || isNotGoing) {
            if (isGoing) {
              yesCount++;
              guestCount += parseInt(data[i][guestIdx]) || 0;
            } else {
              noCount++;
            }
            
            const attendeeEmail = String(data[i][emailIdx]).toLowerCase().trim();
            const profile = userMap[attendeeEmail] || {}; 
            
            // Buscar si hay nombre en la hoja de asistencia, si no, usar el de _USERS
            const sheetName = (attNameIdx > -1 && data[i][attNameIdx]) ? data[i][attNameIdx] : "";
            
            attendeesList.push({
               email: data[i][emailIdx],
               name: profile.name || sheetName || "", // ✨ FIX APLICADO
               lastname: profile.lastname || "",
               telefono: profile.telefono || "",
               parroquia: profile.parroquia || "",
               direccion: profile.direccion || "",
               foto: profile.foto || "",
               guests: parseInt(data[i][guestIdx]) || 0,
               comments: (commentIdx > -1 && data[i][commentIdx]) ? data[i][commentIdx] : "",
               going: isGoing
            });
        }
        
        if (params.email && String(data[i][emailIdx]).toLowerCase() === String(params.email).toLowerCase()) {
          currentUserStatus = { 
              going: isGoing, 
              guests: parseInt(data[i][guestIdx]) || 0,
              comments: (commentIdx > -1 && data[i][commentIdx]) ? data[i][commentIdx] : "",
              responded: true 
          };
        }
      }
    }

    return createJsonResponse({ 
      status: "success", 
      event: currentEvent,
      stats: { members: totalMembers, yes: yesCount, no: noCount, guests: guestCount },
      userStatus: currentUserStatus,
      attendees: attendeesList
    });
    
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- UPDATE ATTENDANCE (RSVP) ---
function handleUpdateAttendance(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Attendance");
    const data = sheet.getDataRange().getValues();
    
    // ✨ SMART HEADER DETECTION
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i].map(h => String(h).toLowerCase().trim()).indexOf("event_id") > -1) {
            headerRowIndex = i;
            break;
        }
    }
    
    const headers = data[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const idIdx = headers.indexOf("event_id");
    const emailIdx = headers.indexOf("email");
    
    let rowFound = false;
    
    // Loop starting directly after the headers
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      if (data[i][idIdx] === params.event_id && String(data[i][emailIdx]).toLowerCase() === String(params.email).toLowerCase()) {
        if (headers.indexOf("guests") > -1) sheet.getRange(i + 1, headers.indexOf("guests") + 1).setValue(params.guests);
        if (headers.indexOf("going") > -1) sheet.getRange(i + 1, headers.indexOf("going") + 1).setValue(params.going);
        if (headers.indexOf("registration_date") > -1) sheet.getRange(i + 1, headers.indexOf("registration_date") + 1).setValue(new Date());
        if (headers.indexOf("name") > -1) sheet.getRange(i + 1, headers.indexOf("name") + 1).setValue(params.name);
        if (headers.indexOf("comments") > -1) sheet.getRange(i + 1, headers.indexOf("comments") + 1).setValue(params.comments || "");
        
        rowFound = true;
        break;
      }
    }
    
    if (!rowFound) {
      const newRow = new Array(headers.length).fill("");
      if (headers.indexOf("event_id") > -1) newRow[headers.indexOf("event_id")] = params.event_id;
      if (headers.indexOf("email") > -1) newRow[headers.indexOf("email")] = params.email;
      if (headers.indexOf("name") > -1) newRow[headers.indexOf("name")] = params.name;
      if (headers.indexOf("guests") > -1) newRow[headers.indexOf("guests")] = params.guests;
      if (headers.indexOf("going") > -1) newRow[headers.indexOf("going")] = params.going;
      if (headers.indexOf("comments") > -1) newRow[headers.indexOf("comments")] = params.comments || "";
      if (headers.indexOf("registration_date") > -1) newRow[headers.indexOf("registration_date")] = new Date();
      
      sheet.appendRow(newRow);
    }

    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- ADMIN: FULL ROSTER + CONFIRMATION + "WENT" STATUS FOR AN EVENT ---
function handleGetAdminAttendance(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // A. Full member roster from _USERS
    const usersSheet = ss.getSheetByName("_USERS");
    const usersData = usersSheet.getDataRange().getDisplayValues();
    const uHeaders = usersData[0].map(h => String(h).toLowerCase().trim());
    const denyIdx = uHeaders.indexOf("_deny_access");
    const uEmailIdx = uHeaders.indexOf("email");
    const uNameIdx = uHeaders.indexOf("name") > -1 ? uHeaders.indexOf("name") : uHeaders.indexOf("nombre");
    const uLastNameIdx = uHeaders.indexOf("lastname") > -1 ? uHeaders.indexOf("lastname") : uHeaders.indexOf("apellido");

    const members = [];
    for (let i = 1; i < usersData.length; i++) {
      const isDenied = denyIdx !== -1 && (usersData[i][denyIdx] === true || String(usersData[i][denyIdx]).toUpperCase() === "TRUE");
      if (isDenied) continue;
      const email = uEmailIdx > -1 ? String(usersData[i][uEmailIdx]).trim() : "";
      if (!email) continue;
      const name = [uNameIdx > -1 ? usersData[i][uNameIdx] : "", uLastNameIdx > -1 ? usersData[i][uLastNameIdx] : ""]
        .filter(Boolean).join(" ").trim();
      members.push({ email: email.toLowerCase(), name: name || email });
    }

    // B. Attendance rows for the requested event
    const attSheet = ss.getSheetByName("Attendance");
    if (!attSheet) return createJsonResponse({ status: "error", message: "Attendance sheet not found." });
    const data = attSheet.getDataRange().getValues();

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      if (data[i].map(h => String(h).toLowerCase().trim()).indexOf("event_id") > -1) {
        headerRowIndex = i;
        break;
      }
    }
    const headers = data[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const idIdx = headers.indexOf("event_id");
    const emailIdx = headers.indexOf("email");
    const goingIdx = headers.indexOf("going");
    const guestIdx = headers.indexOf("guests") > -1 ? headers.indexOf("guests") : headers.indexOf("guest");
    const nameIdx = headers.indexOf("name");
    // "went" defaults to column F (index 5) if the header isn't found by name
    const wentIdx = headers.indexOf("went") > -1 ? headers.indexOf("went") : 5;

    const attMap = {};
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() !== String(params.event_id).trim()) continue;
      const email = String(data[i][emailIdx]).toLowerCase().trim();
      if (!email) continue;
      const isGoingStr = String(data[i][goingIdx]).toUpperCase();
      attMap[email] = {
        confirmed: (isGoingStr === "TRUE" || isGoingStr === "SÍ" || isGoingStr === "SI"),
        went: (data[i][wentIdx] === true || String(data[i][wentIdx]).toUpperCase() === "TRUE"),
        guests: parseInt(data[i][guestIdx]) || 0,
        name: nameIdx > -1 ? data[i][nameIdx] : ""
      };
    }

    // C. Merge roster + attendance
    const roster = members.map(function (m) {
      const att = attMap[m.email];
      return {
        email: m.email,
        name: (att && att.name) || m.name,
        confirmed: !!(att && att.confirmed),
        went: !!(att && att.went),
        guests: att ? att.guests : 0
      };
    });

    return createJsonResponse({ status: "success", data: roster });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- ADMIN: MARK/UNMARK "WENT" FOR A MEMBER ON A GIVEN EVENT ---
function handleUpdateWent(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Attendance");
    const data = sheet.getDataRange().getValues();

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      if (data[i].map(h => String(h).toLowerCase().trim()).indexOf("event_id") > -1) {
        headerRowIndex = i;
        break;
      }
    }
    const headers = data[headerRowIndex].map(h => String(h).toLowerCase().trim());
    const idIdx = headers.indexOf("event_id");
    const emailIdx = headers.indexOf("email");
    const wentIdx = headers.indexOf("went") > -1 ? headers.indexOf("went") : 5;

    const targetEmail = String(params.member_email).toLowerCase().trim();
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(params.event_id).trim() &&
          String(data[i][emailIdx]).toLowerCase().trim() === targetEmail) {
        sheet.getRange(i + 1, wentIdx + 1).setValue(!!params.went);
        return createJsonResponse({ status: "success" });
      }
    }

    // No RSVP row yet (walk-in): create one so the "went" flag has somewhere to live
    const newRow = new Array(headers.length).fill("");
    if (idIdx > -1) newRow[idIdx] = params.event_id;
    if (emailIdx > -1) newRow[emailIdx] = params.member_email;
    const nameIdx = headers.indexOf("name");
    if (nameIdx > -1) newRow[nameIdx] = params.member_name || "";
    newRow[wentIdx] = !!params.went;
    const regIdx = headers.indexOf("registration_date");
    if (regIdx > -1) newRow[regIdx] = new Date();
    sheet.appendRow(newRow);

    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- GET ATTENDEES DIRECTORY DETAILS ---
function handleGetAttendeesDetails(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const eventId = params.event_id;

    // A. Build a Map of everyone who interacted with the invite
    const attSheet = ss.getSheetByName("Attendance");
    const attData = attSheet.getDataRange().getValues();
    const attHeaders = attData[2].map(h => String(h).toLowerCase().trim());
    const attIdIdx = attHeaders.indexOf("event_id");
    const attEmailIdx = attHeaders.indexOf("email");
    const attGoingIdx = attHeaders.indexOf("going");
    const attGuestIdx = attHeaders.indexOf("guest") > -1 ? attHeaders.indexOf("guest") : attHeaders.indexOf("guests");

    const attendanceMap = {};
    for (let i = 3; i < attData.length; i++) {
        if (attData[i][attIdIdx] === eventId) {
            const email = String(attData[i][attEmailIdx]).toLowerCase().trim();
            attendanceMap[email] = {
                going: (attData[i][attGoingIdx] === true || String(attData[i][attGoingIdx]).toUpperCase() === "TRUE"),
                guests: parseInt(attData[i][attGuestIdx]) || 0
            };
        }
    }

    // B. Get Directory Data & Notes
    const dirSheet = ss.getSheetByName("Directory");
    const dirData = dirSheet.getDataRange().getDisplayValues();
    const dirHeaders = dirData[0];
    
    const lastCol = dirSheet.getLastColumn();
    const notes = lastCol > 0 ? dirSheet.getRange(1, 1, 1, lastCol).getNotes()[0] : [];
    const popupFields = [];
    for (let j = 0; j < dirHeaders.length; j++) {
        if (dirHeaders[j] && notes[j] && notes[j].split('\n')[0].trim().toLowerCase().includes("popup")) {
            popupFields.push(dirHeaders[j]);
        }
    }

    const emailColIdx = dirHeaders.findIndex(h => String(h).toLowerCase().trim() === 'email');
    if (emailColIdx === -1) return createJsonResponse({ status: "error", message: "No Email column found in Directory." });

    // C. Merge them! Only keep Directory rows that exist in our Attendance Map
    const rows = [];
    for (let i = 1; i < dirData.length; i++) {
        const rowEmail = String(dirData[i][emailColIdx]).toLowerCase().trim();
        if (rowEmail && attendanceMap[rowEmail]) {
            let rowObj = {};
            for (let j = 0; j < dirHeaders.length; j++) {
                if (dirHeaders[j]) rowObj[dirHeaders[j]] = dirData[i][j];
            }
            // Inject the attendance data invisibly into the row object
            rowObj["_going"] = attendanceMap[rowEmail].going;
            rowObj["_guests"] = attendanceMap[rowEmail].guests;
            rows.push(rowObj);
        }
    }

    return createJsonResponse({ status: "success", headers: dirHeaders, popupFields: popupFields, data: rows });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- SUBMIT FEEDBACK LOG ---
function handleSubmitFeedback(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Feedback");
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Feedback sheet not found." });
    }
    
    // Append a new row instantly!
    sheet.appendRow([
      new Date(), 
      params.email || "Anonymous", 
      params.module || "General", 
      params.feedback
    ]);

    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- GET APPS DASHBOARD ---
function handleGetApps(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("APPS");
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "APPS sheet not found." });
    }

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) {
      return createJsonResponse({ status: "success", data: [] });
    }

    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const rows = [];

    // Map the rows to objects
    for (let i = 1; i < data.length; i++) {
      let rowObj = {};
      let isEmptyRow = true;
      
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
            rowObj[headers[j]] = data[i][j];
            if (data[i][j]) isEmptyRow = false; 
        }
      }
      if (!isEmptyRow) rows.push(rowObj);
    }

    return createJsonResponse({ status: "success", data: rows });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- GET EVENTS (MONTHLY MEETINGS) ---
function handleGetEvents(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("monthly_meetings"); 
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "monthly_meetings sheet not found." });
    }

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) {
      return createJsonResponse({ status: "success", data: [] });
    }

    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const rows = [];
    
    for (let i = 1; i < data.length; i++) {
      let rowObj = {};
      let isEmptyRow = true;
      
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
            rowObj[headers[j]] = data[i][j];
            if (data[i][j]) isEmptyRow = false; 
        }
      }
      if (!isEmptyRow) rows.push(rowObj);
    }

    return createJsonResponse({ status: "success", data: rows });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- REGISTRO DE NUEVOS USUARIOS (PROGRESSIVE PROFILING) ---
function handleRegisterUser(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("_USERS");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    
    const emailIdx = headers.indexOf("email");
    const email = String(params.email).toLowerCase().trim();

    // Detección de columnas
    const nameIdx = headers.indexOf("name") > -1 ? headers.indexOf("name") : headers.indexOf("nombre");
    const lastNameIdx = headers.indexOf("lastname") > -1 ? headers.indexOf("lastname") : headers.indexOf("apellido");
    const phoneIdx = headers.indexOf("telefono") > -1 ? headers.indexOf("telefono") : headers.indexOf("phone");
    const parishIdx = headers.indexOf("parroquia") > -1 ? headers.indexOf("parroquia") : headers.indexOf("parish");
    const addressIdx = headers.indexOf("address") > -1 ? headers.indexOf("address") : headers.indexOf("direccion");
    const timestampIdx = headers.indexOf("timestamp");

    const newRow = new Array(headers.length).fill("");
    
    if (emailIdx > -1) newRow[emailIdx] = email;
    if (nameIdx > -1) newRow[nameIdx] = params.name || "";
    if (lastNameIdx > -1) newRow[lastNameIdx] = params.lastname || "";
    if (phoneIdx > -1) newRow[phoneIdx] = params.phone || ""; 
    if (parishIdx > -1) newRow[parishIdx] = params.parish || ""; 
    if (addressIdx > -1) newRow[addressIdx] = params.address || "";
    if (timestampIdx > -1) newRow[timestampIdx] = new Date();

    sheet.appendRow(newRow);
    
    // ✨ BULLETPROOF FIX: Automatically generate the email here and hardcode the destination!
    return handleRequestMagicLink({
      email: email,
      dest: "settings"
    });
    
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

// --- VERIFICAR SI EL CORREO EXISTE ---
function handleCheckEmail(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("_USERS");
    const data = sheet.getDataRange().getValues();
    const emailIdx = data[0].map(h => String(h).toLowerCase().trim()).indexOf("email");
    
    if (emailIdx === -1) return createJsonResponse({ status: "error", message: "Columna email no encontrada." });
    
    const email = String(params.email).toLowerCase().trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][emailIdx]).toLowerCase().trim() === email) {
        return createJsonResponse({ status: "success", exists: true });
      }
    }
    return createJsonResponse({ status: "success", exists: false });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}




function handleConferenceRegistration(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("conferencia"); // Asegúrate de crear esta pestaña
    
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "La pestaña 'conferencia' no existe en Google Sheets." });
    }

    // Preparar los datos
    const timestamp = new Date();
    const nombre = params.nombre || "";
    const apellido = params.apellido || "";
    const correo = params.correo || "";
    const telefono = params.telefono || "";
    const asistentes = params.asistentes || 1;
    const interes = params.interes_reydavid ? "Sí" : "No";

    // Agregar fila
    sheet.appendRow([timestamp, nombre, apellido, correo, telefono, asistentes, interes]);

    return createJsonResponse({ status: "success", message: "Registro completado." });
    
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}