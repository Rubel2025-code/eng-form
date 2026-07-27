/**
 * ============================================================================
 * GROUP REGISTRATION BACKEND
 * Google Apps Script + Google Sheets
 * ============================================================================
 * This script receives JSON registration data via HTTP POST, validates it,
 * checks for duplicates, enforces registration rules (open/closed, deadline,
 * max capacity), stores the data in a Google Sheet, and returns a JSON
 * response. No HTML is ever returned.
 *
 * CORS NOTE:
 * Apps Script Web Apps cannot attach custom CORS headers to a preflight
 * (OPTIONS) response. The reliable fix lives on the CLIENT: the frontend
 * must send the request with Content-Type: text/plain so the browser
 * treats it as a "simple request" and skips the OPTIONS preflight
 * entirely. This script already parses the body as JSON regardless of
 * the declared Content-Type, so no backend change was required for that.
 * A doOptions() is included below only as a defensive no-op in case some
 * environment sends a preflight anyway.
 * ============================================================================
 */

// ============================================================================
// ADMIN CONFIGURATION
// Edit these values to control registration behavior. No other code changes
// are required to open/close registration, change capacity, or change the
// deadline.
// ============================================================================

// Set to false to immediately stop accepting new registrations.
var REGISTRATION_OPEN = true;

// Maximum number of groups that may register. Once this many rows exist,
// further submissions are rejected.
var MAX_REGISTRATIONS = 100;

// Registration deadline in "YYYY-MM-DD" format (24-hour cutoff at end of day,
// spreadsheet timezone). Submissions after this date are rejected.
var REGISTRATION_END_DATE = "2026-08-15";

// Name of the sheet (tab) inside the spreadsheet where data is stored.
var SHEET_NAME = "Registrations";

// Number of team members required per group (fixed at 3 per project spec).
var REQUIRED_MEMBER_COUNT = 3;

// ============================================================================
// COLUMN LAYOUT (for reference — must match the header row in the sheet)
// 1: Timestamp
// 2: Group Name
// 3: Member 1 Name
// 4: Member 1 ID
// 5: Member 2 Name
// 6: Member 2 ID
// 7: Member 3 Name
// 8: Member 3 ID
// 9: Registration Status
// ============================================================================

var COL_TIMESTAMP = 1;
var COL_GROUP_NAME = 2;
var COL_MEMBER1_NAME = 3;
var COL_MEMBER1_ID = 4;
var COL_MEMBER2_NAME = 5;
var COL_MEMBER2_ID = 6;
var COL_MEMBER3_NAME = 7;
var COL_MEMBER3_ID = 8;
var COL_STATUS = 9;

var STATUS_CONFIRMED = "Confirmed";

// ============================================================================
// ENTRY POINT: doPost
// Handles all incoming POST requests from the frontend's Fetch API call.
// Always returns JSON. Never throws an uncaught exception to the client.
//
// The frontend sends Content-Type: text/plain (see CORS NOTE above), but
// the body is still a JSON string, so JSON.parse(e.postData.contents)
// below works exactly the same as before. No change was needed here.
// ============================================================================
function doPost(e) {
  try {
    // ------------------------------------------------------------------
    // Step 1: Confirm a request body was actually sent.
    // ------------------------------------------------------------------
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse(false, "No data received. Malformed request.");
    }

    // ------------------------------------------------------------------
    // Step 2: Parse JSON safely. Invalid JSON must never crash the script.
    // ------------------------------------------------------------------
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logEvent("ERROR", "JSON parse failure: " + parseError.message);
      return createResponse(false, "Invalid JSON format. Please check your submission data.");
    }

    if (!data || typeof data !== "object") {
      return createResponse(false, "Malformed request payload.");
    }

    // ------------------------------------------------------------------
    // Step 3: Check whether registration is currently open at all.
    // ------------------------------------------------------------------
    if (!isRegistrationOpen()) {
      return createResponse(false, "Registration is currently closed.");
    }

    // ------------------------------------------------------------------
    // Step 4: Check deadline.
    // ------------------------------------------------------------------
    if (isDeadlinePassed()) {
      return createResponse(false, "Registration deadline has passed.");
    }

    // ------------------------------------------------------------------
    // Step 5: Check capacity before doing any writes.
    // ------------------------------------------------------------------
    var sheet = getRegistrationSheet();
    if (isRegistrationFull(sheet)) {
      return createResponse(false, "Registration limit has been reached. No more spots available.");
    }

    // ------------------------------------------------------------------
    // Step 6: Validate & sanitize incoming data (trims whitespace, ignores
    // unexpected properties, ensures required fields exist and are non-empty).
    // ------------------------------------------------------------------
    var validation = validateData(data);
    if (!validation.valid) {
      return createResponse(false, validation.message);
    }
    var clean = validation.data; // sanitized fields only

    // ------------------------------------------------------------------
    // Step 7: Duplicate protection — Group Name.
    // ------------------------------------------------------------------
    if (checkDuplicateGroup(sheet, clean.groupName)) {
      return createResponse(false, "Group name already exists.");
    }

    // ------------------------------------------------------------------
    // Step 8: Duplicate protection — Student IDs (checked against all
    // existing member ID columns, and against each other within this
    // same submission).
    // ------------------------------------------------------------------
    var submittedIds = [clean.member1Id, clean.member2Id, clean.member3Id];

    // Check for duplicates within the submission itself.
    var uniqueIds = {};
    for (var i = 0; i < submittedIds.length; i++) {
      if (uniqueIds[submittedIds[i]]) {
        return createResponse(false, "Student ID already registered.");
      }
      uniqueIds[submittedIds[i]] = true;
    }

    // Check for duplicates against existing sheet records.
    if (checkDuplicateStudent(sheet, submittedIds)) {
      return createResponse(false, "Student ID already registered.");
    }

    // ------------------------------------------------------------------
    // Step 9: Append the validated, sanitized registration to the sheet.
    // ------------------------------------------------------------------
    appendRegistration(sheet, clean);

    logEvent("INFO", "Registration successful for group: " + clean.groupName);
    return createResponse(true, "Registration Successful");

  } catch (unexpectedError) {
    // Catch-all safety net. The script must never crash or return HTML.
    logEvent("ERROR", "Unexpected exception: " + unexpectedError.message);
    return createResponse(false, "An unexpected server error occurred. Please try again later.");
  }
}

// ============================================================================
// doGet
// Provided so that visiting the Web App URL directly (e.g. for a health
// check) returns a clean JSON response instead of an error page. The
// frontend should only ever use POST for actual registrations.
// ============================================================================
function doGet(e) {
  return createResponse(true, "Group Registration API is online. Use POST to submit registrations.");
}

// ============================================================================
// doOptions
// Defensive no-op. Apps Script Web Apps cannot set the CORS headers needed
// to make a real preflight succeed, so this does NOT "fix" CORS by itself.
// The actual fix is the frontend sending Content-Type: text/plain, which
// makes the browser skip the preflight entirely (see CORS NOTE at top of
// file). This handler just prevents an uncaught-route error in case a
// browser or proxy sends an OPTIONS request anyway.
// ============================================================================
function doOptions(e) {
  return ContentService.createTextOutput("");
}

// ============================================================================
// validateData
// Validates and sanitizes the incoming payload. Trims whitespace, ignores
// any unexpected properties, and confirms every required field is present
// and non-empty. Returns { valid: boolean, message: string, data: object }.
// ============================================================================
function validateData(data) {
  var requiredFields = [
    "groupName",
    "member1Name", "member1Id",
    "member2Name", "member2Id",
    "member3Name", "member3Id"
  ];

  var clean = {};

  for (var i = 0; i < requiredFields.length; i++) {
    var field = requiredFields[i];
    var rawValue = data[field];

    // Reject if field is missing entirely.
    if (rawValue === undefined || rawValue === null) {
      return { valid: false, message: "Missing required field: " + field + "." };
    }

    // Force to string and trim whitespace (also guards against non-string
    // types like numbers/objects being passed maliciously).
    var value = String(rawValue).trim();

    if (value.length === 0) {
      return { valid: false, message: "Field '" + field + "' cannot be empty." };
    }

    clean[field] = value;
  }

  // Explicit group name check (already covered above, but kept for clarity
  // per spec requirement "Group Name is empty").
  if (!clean.groupName) {
    return { valid: false, message: "Group Name is required." };
  }

  // Explicit check that exactly 3 members' worth of data exists.
  // Since the schema only defines member1-3, "less than 3" is caught by the
  // required-field checks above. "More than 3" is caught by only ever
  // reading member1-3 and ignoring any extra properties (member4, etc.)
  // the client might send — those are silently discarded here.
  var memberCount = 0;
  if (clean.member1Name && clean.member1Id) memberCount++;
  if (clean.member2Name && clean.member2Id) memberCount++;
  if (clean.member3Name && clean.member3Id) memberCount++;

  if (memberCount < REQUIRED_MEMBER_COUNT) {
    return { valid: false, message: "All " + REQUIRED_MEMBER_COUNT + " members must be provided." };
  }

  return { valid: true, message: "", data: clean };
}

// ============================================================================
// checkDuplicateGroup
// Returns true if the given group name already exists in the sheet
// (case-insensitive comparison).
// ============================================================================
function checkDuplicateGroup(sheet, groupName) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false; // only header row exists, no data yet

  var existingNames = sheet.getRange(2, COL_GROUP_NAME, lastRow - 1, 1).getValues();
  var target = groupName.toLowerCase();

  for (var i = 0; i < existingNames.length; i++) {
    var existing = String(existingNames[i][0]).trim().toLowerCase();
    if (existing === target) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// checkDuplicateStudent
// Returns true if any of the submitted student IDs already exist anywhere
// in the Member ID columns (Member 1 ID, Member 2 ID, Member 3 ID).
// ============================================================================
function checkDuplicateStudent(sheet, submittedIds) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false; // only header row exists, no data yet

  var idColumns = [COL_MEMBER1_ID, COL_MEMBER2_ID, COL_MEMBER3_ID];
  var normalizedSubmitted = submittedIds.map(function (id) {
    return String(id).trim().toLowerCase();
  });

  for (var c = 0; c < idColumns.length; c++) {
    var values = sheet.getRange(2, idColumns[c], lastRow - 1, 1).getValues();
    for (var r = 0; r < values.length; r++) {
      var existingId = String(values[r][0]).trim().toLowerCase();
      if (existingId.length === 0) continue;
      if (normalizedSubmitted.indexOf(existingId) !== -1) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// isRegistrationOpen
// Reads the REGISTRATION_OPEN admin flag.
// ============================================================================
function isRegistrationOpen() {
  return REGISTRATION_OPEN === true;
}

// ============================================================================
// isDeadlinePassed
// Compares the current date (in the spreadsheet's timezone) against
// REGISTRATION_END_DATE. Returns true if the deadline has passed.
// ============================================================================
function isDeadlinePassed() {
  try {
    var timezone = getSpreadsheetTimezone();
    var todayStr = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");

    var today = new Date(todayStr + "T00:00:00");
    var deadline = new Date(REGISTRATION_END_DATE + "T23:59:59");

    return today > deadline;
  } catch (err) {
    // Fail safe: if the date comparison itself breaks, do not block
    // registration due to an internal error — log it and allow through,
    // since MAX_REGISTRATIONS and REGISTRATION_OPEN provide backup control.
    logEvent("ERROR", "Deadline check failed: " + err.message);
    return false;
  }
}

// ============================================================================
// isRegistrationFull
// Returns true if the number of existing registrations has reached or
// exceeded MAX_REGISTRATIONS.
// ============================================================================
function isRegistrationFull(sheet) {
  var lastRow = sheet.getLastRow();
  var currentCount = lastRow > 1 ? lastRow - 1 : 0; // subtract header row
  return currentCount >= MAX_REGISTRATIONS;
}

// ============================================================================
// appendRegistration
// Appends a new validated row to the sheet, including a timestamp (in the
// spreadsheet's timezone) and a fixed "Confirmed" registration status.
// ============================================================================
function appendRegistration(sheet, clean) {
  var timezone = getSpreadsheetTimezone();
  var timestamp = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd HH:mm:ss");

  var row = [
    timestamp,
    clean.groupName,
    clean.member1Name,
    clean.member1Id,
    clean.member2Name,
    clean.member2Id,
    clean.member3Name,
    clean.member3Id,
    STATUS_CONFIRMED
  ];

  sheet.appendRow(row);
}

// ============================================================================
// getRegistrationSheet
// Retrieves the target sheet by name, creating it with headers if it does
// not yet exist. Throws a descriptive error if the spreadsheet itself
// cannot be accessed (e.g. this script is not bound to a Sheet and no
// Sheet ID has been configured — see SPREADSHEET_ID note below).
// ============================================================================
function getRegistrationSheet() {
  var ss;
  try {
    // If this script is bound to a Google Sheet (Extensions > Apps Script),
    // getActiveSpreadsheet() works directly.
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    ss = null;
  }

  if (!ss) {
    throw new Error("Spreadsheet unavailable. Ensure this script is bound to a Google Sheet.");
  }

  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    // Create the sheet with proper headers if it doesn't exist yet.
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      "Timestamp",
      "Group Name",
      "Member 1 Name",
      "Member 1 ID",
      "Member 2 Name",
      "Member 2 ID",
      "Member 3 Name",
      "Member 3 ID",
      "Registration Status"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// ============================================================================
// getSpreadsheetTimezone
// Returns the spreadsheet's configured timezone, falling back to the
// script's default timezone if unavailable.
// ============================================================================
function getSpreadsheetTimezone() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  } catch (err) {
    return Session.getScriptTimeZone();
  }
}

// ============================================================================
// createResponse
// Builds a standardized JSON response as a TextOutput. This is the ONLY
// function that should be used to return data to the client — ensures every
// response has the correct { success, message } shape and MIME type.
// ============================================================================
function createResponse(success, message) {
  var payload = {
    success: success,
    message: message
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// logEvent
// Lightweight logging helper. Writes to the Apps Script Logger (visible in
// Executions / Logs) so admins can debug issues without exposing internal
// details to the client.
// ============================================================================
function logEvent(level, message) {
  Logger.log("[" + level + "] " + new Date().toISOString() + " - " + message);
}
