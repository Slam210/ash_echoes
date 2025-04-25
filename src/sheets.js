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

  // Retrieving grid data (including background color)
  const formattingRes = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    fields: "sheets.data.rowData.values.userEnteredFormat.backgroundColor",
  });

  const rows = res.data.values;
  const gridData = formattingRes.data.sheets[0].data[0].rowData;

  // Map to get the background color of column A (the first column)
  const backgroundColors = gridData.map((row) => {
    return row.values && row.values[0]?.userEnteredFormat?.backgroundColor;
  });

  // Add rarity based on the background color of column A
  const processedData = rows.map((row, index) => {
    const rarity =
      index === 0
        ? "Rarity"
        : backgroundColors[index] &&
          (backgroundColors[index].red !== 1 ||
            backgroundColors[index].green !== 1 ||
            backgroundColors[index].blue !== 1)
        ? "gold"
        : "white";

    return [...row, rarity]; // Add the rarity column at the end
  });

  return processedData;
}
