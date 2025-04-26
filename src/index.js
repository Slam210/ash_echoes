// Imports
import dotenv from "dotenv";
import { readSheet } from "./sheets.js";
import attackList from "./Definitions/attack.js";
import defenseList from "./Definitions/defense.js";
import mstList from "./Definitions/mst.js";
import trmList from "./Definitions/trm.js";
import vitList from "./Definitions/vit.js";
import charactersList from "./Definitions/characters.js";
import ownedcharactersList from "./Definitions/ownedcharacters.js";
import targetCharactersList from "./Definitions/targetCharacters.js";

// Configurations
dotenv.config();
const sheetId = process.env.GOOGLE_SHEET_ID;
const range = "Inheritance Skills!A1:H150";
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
  const characters = Object.entries(reverseMap).filter(([source]) => {
    const isChar = reverseMap[source].type === "CHAR";
    const isOwned = ownedcharactersList.includes(source);
    const isTargetOk =
      targetCharactersList.length === 0 ||
      targetCharactersList.includes(source);
    const isValidChar = charactersList.includes(source);
    return isChar && isOwned && isTargetOk && isValidChar;
  });

  const nonCharacters = Object.entries(reverseMap).filter(
    ([source]) => reverseMap[source].type !== "CHAR"
  );

  let bestResult = null;

  for (const [charSource] of characters) {
    const picked = new Set([charSource]);
    const inheritanceCount = new Map();
    const typeCount = { [reverseMap[charSource].type]: 1 };

    const sortedSources = nonCharacters.sort(([, aInherits], [, bInherits]) => {
      const goldA = aInherits.filter((i) => i.rarity === "gold").length;
      const goldB = bInherits.filter((i) => i.rarity === "gold").length;
      return goldB - goldA;
    });

    for (const [source, inheritances] of sortedSources) {
      if (picked.size >= maxSources + 1) break;
      if (picked.has(source)) continue;

      picked.add(source);
      const type = reverseMap[source].type;
      typeCount[type] = (typeCount[type] || 0) + 1;

      for (const { name, level, rarity } of inheritances) {
        if (!inheritanceCount.has(name)) {
          inheritanceCount.set(name, { level, count: 1, rarity });
        } else {
          inheritanceCount.get(name).count += 1;
        }
      }
    }

    // Ensure at least 2 types have 2+ sources
    const validTypeSpread =
      Object.values(typeCount).filter((c) => c >= 2).length >= 2;

    if (!validTypeSpread) continue;

    // Scoring
    let totalScore = 0;
    const details = [];

    for (const [name, { level, count, rarity }] of inheritanceCount.entries()) {
      let score = 0;
      if (count >= 2) {
        score = rarity === "gold" ? 50 : rarity === "white" ? 10 : 0;
      }
      totalScore += score;
      details.push({ name, level, count, rarity, score });
    }

    const targets = details
      .filter((d) => d.count >= 2)
      .sort((a, b) => b.score - a.score);

    if (!bestResult || totalScore > bestResult.totalScore) {
      bestResult = {
        sources: [charSource, ...[...picked].filter((s) => s !== charSource)],
        totalInheritances: inheritanceCount.size,
        totalScore,
        details,
        targets,
      };
    }
  }

  return (
    bestResult || {
      sources: [],
      totalInheritances: 0,
      totalScore: 0,
      details: [],
      targets: [],
    }
  );
}

// Main function that runs the program
async function main() {
  const columnsNames = ["Inheritance Name", "Level", "Acquired By", "Rarity"];
  try {
    const data = await readSheet(sheetId, range);
    const processedData = extractColumns(data, columnsNames);
    // // Console for loop that confirms the information is correct
    // // console.log("Sheet Data:");
    // // for (let i = 0; i < 10; i++) {
    // //   console.log(processedData[i], "\n");
    // // }

    // // Normalize Acquired By columns into an array, removing the newlines that seperate each entry
    const normalizedData = processedData.map((entry) => ({
      ...entry,
      "Acquired By": entry["Acquired By"]
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean),
    }));

    // // Console for loop that confirms the information is correct
    // // console.log("Normalized Data:");
    // // for (let i = 0; i < 10; i++) {
    // //   console.log(normalizedData[i], "\n");
    // // }

    // // Filter out level 3 inheritances
    const filteredData = normalizedData.filter((entry) => entry.Level !== "3");

    const reverseMap = {};

    filteredData.forEach((entry) => {
      const inheritance = entry["Inheritance Name"];
      const level = entry.Level;
      const sources = entry["Acquired By"];
      const rarity = entry["Rarity"];

      sources.forEach((source) => {
        if (!reverseMap[source]) {
          let type = null;
          if (attackList.includes(source)) type = "ATK";
          else if (defenseList.includes(source)) type = "DEF";
          else if (vitList.includes(source)) type = "VIT";
          else if (mstList.includes(source)) type = "MST";
          else if (trmList.includes(source)) type = "TRM";
          else if (charactersList.includes(source)) type = "CHAR";
          reverseMap[source] = [];
          reverseMap[source].type = type;
        }

        reverseMap[source].push({ name: inheritance, level, rarity });
      });
    });

    // // Console for loop that confirms the information is correct
    // console.log("Reversed Map Data: ", reverseMap);

    // console.log("Sources with missing type:");
    // for (const source in reverseMap) {
    //   if (!reverseMap[source].type) {
    //     console.log(source);
    //   }
    // }

    const result = greedyPick(reverseMap, 6);

    console.log(
      "Sources Selected:",
      result.sources.map(
        (source) => `(${reverseMap[source].type || "?"}) ${source}`
      )
    );
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
