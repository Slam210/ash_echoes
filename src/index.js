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
import ownedtracesList from "./Definitions/ownedtraces.js";

// Configurations
dotenv.config();
const sheetId = process.env.GOOGLE_SHEET_ID;
const range = "Inheritance Skills!A1:H150";
const config = {
  targetCharacter: null,
  initialSources: null,
};

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

function greedyPickAllCombinations(
  reverseMap,
  maxSources,
  targetCharacter,
  preselect,
  ownedtracesList,
) {
  if (!targetCharacter) {
    const validTargets = targetCharactersList.filter((char) =>
      ownedcharactersList.includes(char),
    );
    if (validTargets.length > 0) {
      targetCharacter =
        validTargets[Math.floor(Math.random() * validTargets.length)];
    } else {
      console.warn("No valid target characters available.");
      return {
        character: null,
        sources: [],
        totalInheritances: 0,
        totalScore: 0,
        details: [],
        targets: [],
      };
    }
  }

  // Add the character type (e.g., "CHAR") to the reverse map for selection
  if (!reverseMap[targetCharacter]) {
    reverseMap[targetCharacter] = { type: "CHAR", inheritances: [] };
  }

  const nonCharacters = Object.entries(reverseMap).filter(
    ([source]) => reverseMap[source].type !== "CHAR",
  );

  const allSources = Array.from(
    new Set([...nonCharacters.map(([source]) => source), ...(preselect || [])]),
  );

  // Add the character to the selected set, but it won't be a part of the "allSources" for source selection
  const selected = new Set([targetCharacter]);

  // Remove the character from the available sources for inheritance selection
  const sourcesWithoutChar = allSources.filter(
    (source) => source !== targetCharacter,
  );

  // Separate sources into owned and non-owned
  const ownedSources = sourcesWithoutChar.filter((source) =>
    ownedtracesList.includes(source),
  );
  const remainingSources = sourcesWithoutChar.filter(
    (source) => !ownedtracesList.includes(source),
  );

  // We will now proceed to select sources one by one, making decisions at each step
  while (selected.size < maxSources) {
    const candidates = [];

    // First, we simulate the "decision tree" at each slot
    const allCandidates = [];

    // Draw from ownedSources or remainingSources based on potential gain at each slot
    for (const source of [...ownedSources, ...remainingSources]) {
      if (selected.has(source)) continue;

      let gain = 0;
      const tempTypeCount = {};
      const tempInheritanceCount = new Map();

      const inheritances = reverseMap[source];
      if (Array.isArray(inheritances)) {
        const seenInheritances = new Set();

        inheritances.forEach(({ name, level, rarity }) => {
          if (seenInheritances.has(name)) return;
          seenInheritances.add(name);

          tempInheritanceCount.set(name, {
            level: parseInt(level, 10) || 0,
            count: 1,
            rarity,
          });
        });
      }

      // Simple gain: count of unique inheritances + bonus for types
      gain += tempInheritanceCount.size * 5;

      // We simulate the effect of drawing this source
      allCandidates.push({ source, gain });
    }

    // Now we need to sort by the potential gain at this step and pick the best option
    if (allCandidates.length === 0) break;

    // Sort candidates by gain (highest first)
    allCandidates.sort((a, b) => b.gain - a.gain);

    // Select the top candidate with the highest gain
    const bestCandidate = allCandidates[0]; // The one with the highest gain
    selected.add(bestCandidate.source);
  }

  // FINAL recomputation of inheritanceCount and typeCount
  const inheritanceCount = new Map();
  const typeCount = {};

  for (const source of selected) {
    const type = reverseMap[source]?.type;
    if (type) typeCount[type] = (typeCount[type] || 0) + 1;

    const inheritances = reverseMap[source];
    if (Array.isArray(inheritances)) {
      const seenInheritances = new Set();

      inheritances.forEach(({ name, level, rarity }) => {
        if (seenInheritances.has(name)) return;
        seenInheritances.add(name);

        if (!inheritanceCount.has(name)) {
          inheritanceCount.set(name, {
            level: parseInt(level, 10) || 0,
            count: 1,
            rarity,
          });
        } else {
          const entry = inheritanceCount.get(name);
          entry.count += 1;
          const newLevel = parseInt(level, 10) || 0;
          if (newLevel > entry.level) {
            entry.level = newLevel;
          }
        }
      });
    }
  }

  // Now calculate total score
  let totalScore = 0;
  const details = [];

  inheritanceCount.forEach(({ level, count, rarity }, name) => {
    let score = 0;
    if (count >= 2) {
      score = rarity === "gold" ? 50 : rarity === "white" ? 10 : 0;
    }
    totalScore += score;
    details.push({ name, level, count, rarity, score });
  });

  const targets = details
    .filter((d) => d.count >= 2)
    .sort((a, b) => b.score - a.score);

  const sortedDetails = details.sort((a, b) => b.score - a.score);

  return {
    character: targetCharacter, // Character is still part of the final result
    sources: [...selected].filter((source) => source !== targetCharacter), // Remove character from sources list
    totalInheritances: inheritanceCount.size,
    totalScore,
    sortedDetails,
    targets,
  };
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

    const result = greedyPickAllCombinations(
      reverseMap,
      7,
      config.targetCharacter,
      config.initialSources,
      ownedtracesList,
    );

    console.log("Character Selected: ", result.character);
    console.log(
      "Sources Selected:",
      result.sources.map((source) => {
        const entry = reverseMap[source];
        const type = entry?.type || "?";
        return `(${type}) ${source}`;
      }),
    );

    console.log("Unique Inheritances:", result.totalInheritances);
    console.log("Total Score (with overlaps):", result.totalScore);
    console.table(result.sortedDetails);
  } catch (err) {
    console.error("Error reading sheet:", err);
    return;
  }
}

// Run Main
main();
