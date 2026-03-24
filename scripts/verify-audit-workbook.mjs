import assert from "node:assert/strict";
import path from "node:path";

import ExcelJS from "exceljs";

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: npm run verify:audit-workbook -- <path-to-xlsx>");
  process.exit(1);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(targetPath);

const visibleSheetNames = workbook.worksheets
  .filter((sheet) => sheet.state === "visible")
  .map((sheet) => sheet.name);

assert.deepEqual(visibleSheetNames, ["Transactions", "Dashboard"]);

for (const hiddenSheetName of ["_members", "_allocations", "_calc"]) {
  const sheet = workbook.getWorksheet(hiddenSheetName);
  assert.ok(sheet, `Missing helper sheet: ${hiddenSheetName}`);
  assert.equal(sheet.state, "hidden", `${hiddenSheetName} must stay hidden`);
}

const dashboardSheet = workbook.getWorksheet("Dashboard");
assert.ok(dashboardSheet, "Missing Dashboard sheet");
assert.equal(typeof dashboardSheet.getCell("B6").formula, "string");
assert.equal(typeof dashboardSheet.getCell("C6").formula, "string");
assert.equal(typeof dashboardSheet.getCell("D6").formula, "string");

const calcSheet = workbook.getWorksheet("_calc");
assert.ok(calcSheet, "Missing _calc sheet");
assert.equal(typeof calcSheet.getCell("B3").formula, "string");

const fileName = path.basename(targetPath);
assert.match(fileName, /-audit-\d{8}-\d{4}\.xlsx$/);

console.log("Workbook smoke check passed.");
console.log(`Visible sheets: ${visibleSheetNames.join(", ")}`);
