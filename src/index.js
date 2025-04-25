// Imports
import dotenv from "dotenv";
import { readSheet } from "./sheets.js";

// Configurations
dotenv.config();
const sheetId = process.env.GOOGLE_SHEET_ID;
const range = "Inheritance !A1:H150";
const levelScore = { 0: 3, 1: 2, 2: 1 };

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

// Initial Draft that caused memory to run out.
// // Get all 6-item combinations
// function combinations(arr, k) {
//   const result = [];

//   function helper(start, combo) {
//     if (combo.length === k) {
//       result.push(combo);
//       return;
//     }
//     for (let i = start; i < arr.length; i++) {
//       helper(i + 1, combo.concat(arr[i]));
//     }
//   }

//   helper(0, []);
//   return result;
// }

// function scoreCombo(sources, reverseMap) {
//   const inheritanceMap = new Map();

//   sources.forEach((source) => {
//     const inheritances = reverseMap[source] || [];
//     inheritances.forEach(({ name, level }) => {
//       if (!inheritanceMap.has(name)) {
//         inheritanceMap.set(name, levelScore[level] || 0);
//       }
//     });
//   });

//   const totalScore = [...inheritanceMap.values()].reduce(
//     (sum, val) => sum + val,
//     0
//   );

//   return {
//     sources,
//     totalInheritances: inheritanceMap.size,
//     score: totalScore,
//     details: [...inheritanceMap.entries()].map(([name, score]) => ({
//       name,
//       score,
//     })),
//   };
// }

function greedyPick(reverseMap, maxSources) {
  const picked = new Set();
  const inheritanceCount = new Map();

  // Sort the reverseMap so that gold rarity is processed first
  const sortedReverseMap = Object.entries(reverseMap).sort(
    ([sourceA, inheritancesA], [sourceB, inheritancesB]) => {
      // Prioritize "gold" rarity over "white"
      const goldCountA = inheritancesA.filter(
        (item) => item.rarity === "gold"
      ).length;
      const goldCountB = inheritancesB.filter(
        (item) => item.rarity === "gold"
      ).length;

      return goldCountB - goldCountA; // Sort so that golds come first
    }
  );

  while (picked.size < maxSources) {
    let bestSource = null;
    let bestGain = -1;
    let tempAdds = [];

    for (const [source, inheritances] of sortedReverseMap) {
      if (picked.has(source)) continue;

      let gain = 0;
      const adds = [];

      for (const { name, level, rarity } of inheritances) {
        const score = levelScore[level] || 0;

        // Only add points for duplicates (count >= 2)
        if (
          rarity === "gold" &&
          inheritances.filter((item) => item.rarity === "gold").length >= 2
        ) {
          gain += 100;
        } else if (
          rarity === "white" &&
          inheritances.filter((item) => item.rarity === "white").length >= 2
        ) {
          gain += 10;
        }

        adds.push({ name, level, rarity });
      }

      if (gain > bestGain) {
        bestSource = source;
        bestGain = gain;
        tempAdds = adds;
      }
    }

    if (!bestSource) break;

    picked.add(bestSource);

    // Update inheritance counts, including rarity and applying counts
    for (const { name, level, rarity } of tempAdds) {
      if (!inheritanceCount.has(name)) {
        inheritanceCount.set(name, { level, count: 1, rarity });
      } else {
        const existing = inheritanceCount.get(name);
        existing.count += 1;
      }
    }
  }

  // Final score includes overlaps and rarity
  let totalScore = 0;
  const details = [];

  // Assign scores based on count and rarity
  for (const [name, { level, count, rarity }] of inheritanceCount.entries()) {
    let score = 0;

    if (count >= 2) {
      if (rarity === "gold") {
        score = 100; // 2 gold dupes give 100 points
      } else if (rarity === "white") {
        score = 10; // 2 white dupes give 10 points
      }
    }

    totalScore += score;
    details.push({ name, level, count, rarity, score }); // Include rarity and score
  }

  // Filter and sort by score
  const targets = details
    .filter((item) => item.count >= 2) // Only include items with count >= 2
    .sort((a, b) => b.score - a.score); // Sort by score in descending order

  return {
    sources: [...picked],
    totalInheritances: inheritanceCount.size,
    totalScore,
    details,
    targets,
  };
}

// Main function that runs the program
async function main() {
  const columnsNames = ["Inheritance Name", "Level", "Acquired By", "Rarity"];
  try {
    const data = await readSheet(sheetId, range);
    const processedData = extractColumns(data, columnsNames);
    // Console for loop that confirms the information is correct
    // console.log("Sheet Data:");
    // for (let i = 0; i < 10; i++) {
    //   console.log(processedData[i], "\n");
    // }

    // Normalize Acquired By columns into an array, removing the newlines that seperate each entry
    const normalizedData = processedData.map((entry) => ({
      ...entry,
      "Acquired By": entry["Acquired By"]
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean),
    }));

    // Console for loop that confirms the information is correct
    // console.log("Normalized Data:");
    // for (let i = 0; i < 10; i++) {
    //   console.log(normalizedData[i], "\n");
    // }

    // Filter out level 3 inheritances
    const filteredData = normalizedData.filter((entry) => entry.Level !== "3");

    const reverseMap = {};

    filteredData.forEach((entry) => {
      const inheritance = entry["Inheritance Name"];
      const level = entry.Level;
      const sources = entry["Acquired By"];
      const rarity = entry["Rarity"];

      sources.forEach((source) => {
        if (!reverseMap[source]) {
          reverseMap[source] = [];
        }
        reverseMap[source].push({ name: inheritance, level, rarity });
      });
    });

    // Console for loop that confirms the information is correct
    // console.log("Reversed Map Data: ", reverseMap);

    const result = greedyPick(reverseMap, 6);

    console.log("Sources Selected:", result.sources);
    console.log("Unique Inheritances:", result.totalInheritances);
    console.log("Total Score (with overlaps):", result.totalScore);
    console.table(result.targets);
  } catch (err) {
    console.error("Error reading sheet:", err);
    return;
  }
}

// Run Main
main();
