const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "Registration.xlsx");

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const allData = XLSX.utils.sheet_to_json(sheet);
    console.log(`Total rows read by XLSX: ${allData.length}`);

    // Skip the two header rows as we do in the import script
    const dataRows = allData.slice(2);
    console.log(`Rows after skipping headers: ${dataRows.length}`);

    const validGuides = [];
    const missingName = [];
    const missingReg = [];
    const duplicates = {};

    dataRows.forEach((row, index) => {
        const regNo = row["Registration No"];
        const name = row["Guide's Information"];

        if (!regNo && !name) return; // Completely empty row

        if (!regNo) {
            missingReg.push({ index: index + 3, name });
        } else if (!name) {
            missingName.push({ index: index + 3, regNo });
        } else {
            validGuides.push({ regNo, name });
            const key = String(regNo).trim().toUpperCase();
            if (duplicates[key]) {
                duplicates[key].count++;
                duplicates[key].names.push(name);
            } else {
                duplicates[key] = { count: 1, names: [name] };
            }
        }
    });

    console.log(`Potential valid guides (both name and reg): ${validGuides.length}`);
    console.log(`Missing Registration No: ${missingReg.length}`);
    console.log(`Missing Name: ${missingName.length}`);

    const realDuplicates = Object.keys(duplicates).filter(k => duplicates[k].count > 1);
    console.log(`Duplicate Registration Numbers: ${realDuplicates.length}`);
    if (realDuplicates.length > 0) {
        console.log("Details:");
        realDuplicates.forEach(k => {
            console.log(` - ${k}: ${duplicates[k].count} occurrences (${duplicates[k].names.join(", ")})`);
        });
    }

} catch (err) {
    console.error("Error:", err.message);
}
