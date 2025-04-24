// Imports
import dotenv from "dotenv";
import { readSheet } from "./sheets.js";

// Configurations
dotenv.config();
const sheetId = process.env.GOOGLE_SHEET_ID;
const range = "Sheet1!A1:H150";

/*
Function that is utilized to extract columns
Rows represents the data we extracted using the range
ColumnsNames represents the columns we want to extact from the data
*/
function extractColumns(rows, columnsNames) {
  // Remove first row with headers
  const [headers, ...data] = rows;

  // Correspond each column name to an index within the data
  const indexes = columnsNames.map((name) => headers.indexOf(name));

  // For each row, we create and return the object that stores only the columns we want
  return data.map((row) => {
    const obj = {};
    columnsNames.forEach((name, i) => {
      obj[name] = row[indexes[i]];
    });
    return obj;
  });
}

// Main function that runs the program
async function main() {
  const columnsNames = ["Inheritance Name", "Level", "Acquired By"];
  try {
    const data = await readSheet(sheetId, range);
    const processedData = extractColumns(data, columnsNames);
    // Console for loop that confirms the information is correct
    /*for (let i = 0; i < 10; i++) {
      console.log("Sheet Data:", processedData[i], "\n");
    }*/
  } catch (err) {
    console.error("Error reading sheet:", err);
  }
}

// Run Main
main();
