const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "Registration.xlsx");

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get headers
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    console.log("--- Headers ---");
    console.log(headers);

    // Get first 3 rows of data
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 3);
    console.log("\n--- First 3 Rows ---");
    console.log(JSON.stringify(data, null, 2));

} catch (err) {
    console.error("Error reading Excel:", err.message);
}
