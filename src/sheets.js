// Imports
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Needed to simulate __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Authorize google sheets connection using credentials
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(
    __dirname,
    "../credentials/ashechoes-457822-1a1cb36fdb9c.json"
  ),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

// Function to read the google sheet given an id and range
export async function readSheet(spreadsheetId, range) {
  // Connection to google sheet
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  // Retrieving values from google sheets
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values;
}
