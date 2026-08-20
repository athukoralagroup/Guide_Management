const mongoose = require("mongoose");
const XLSX = require("xlsx");

// MongoDB connection
const MONGO_URI = 'mongodb+srv://athukoralateacenter:kavinda%402001@cluster0.t60zehz.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected successfully to Atlas"))
    .catch(err => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });

// Guide Schema (Sync with index.js)
const guideSchema = new mongoose.Schema({
  registrationNo: { type: String, unique: true },
  date: { type: Date, default: Date.now },
  hotelOrAgency: { type: String, default: '' },
  agencyAddress: { type: String, default: '' },
  agencyTel: { type: String, default: '' },
  agencyGmail: { type: String, default: '' },
  agencyAccountDetails: { type: String, default: '' },
  guideName: { type: String, required: true },
  guideIdCardNo: { type: String, default: '' },
  guideAddress: { type: String, default: '' },
  guideMobileNo: { type: String, default: '' },
  guidePhoto: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankBranch: { type: String, default: '' },
  bankAccountName: { type: String, default: '' },
  bankAccountNo: { type: String, default: '' },
  remarks: [{
    date: { type: Date, default: Date.now },
    text: { type: String, required: true }
  }],
  visitCount: { type: Number, default: 0 },
  totalGuests: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  visits: [{
    date: { type: Date, default: Date.now },
    guests: { type: Number, default: 0 },
    sales: { type: Number, default: 0 }
  }]
}, { timestamps: true });

const Guide = mongoose.model("Guide", guideSchema);

// Helper to parse DD/MM/YYYY
function parseExcelDate(dateVal) {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    
    if (typeof dateVal === 'string') {
        const parts = dateVal.split('/');
        if (parts.length === 3) {
            // DD/MM/YYYY
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    
    // Fallback for Excel serial numbers
    if (typeof dateVal === 'number') {
        const date = XLSX.SSF.parse_date_code(dateVal);
        return new Date(date.y, date.m - 1, date.d);
    }

    const d = new Date(dateVal);
    return isNaN(d) ? new Date() : d;
}

async function importData() {
    try {
        console.log("Reading Registration.xlsx...");
        const workbook = XLSX.readFile("Registration.xlsx");
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        let data = XLSX.utils.sheet_to_json(sheet);
        
        console.log(`Initial rows found: ${data.length}`);
        
        // Skip the two header-label rows (Name/Adress labels and Bank Name labels)
        // Based on inspection, data starts from index 2
        data = data.slice(2);

        console.log(`Processing ${data.length} actual data rows.`);

        let successCount = 0;
        let skipCount = 0;

        for (const row of data) {
            try {
                // Mapping based on inspectExcel.js output:
                const regNo = row["Registration No"];
                const primaryName = row["Guide's Information"];
                const fallbackName = row["__EMPTY_12"]; // Bank Account Name often matches
                
                if (!regNo) {
                    // console.log(`Skipping row without Registration No`);
                    continue;
                }

                const gName = (primaryName || fallbackName || "Unknown Guide").toString().trim();

                const existing = await Guide.findOne({ registrationNo: String(regNo) });
                if (existing) {
                    // console.log(`Skipping existing registration: ${regNo}`);
                    skipCount++;
                    continue;
                }

                const guideData = {
                    registrationNo: String(regNo),
                    date: parseExcelDate(row["Date"]),
                    hotelOrAgency: row["Hotel/ Travel Agent"] || "",
                    guideName: gName,
                    guideIdCardNo: String(row["__EMPTY_7"] || ""),
                    guideAddress: row["__EMPTY_8"] || "",
                    guideMobileNo: String(row["__EMPTY_9"] || ""),
                    bankName: row["__EMPTY_10"] || "",
                    bankBranch: row["__EMPTY_11"] || "",
                    bankAccountName: String(row["__EMPTY_12"] || ""),
                    bankAccountNo: String(row["__EMPTY_13"] || ""),
                    visits: [],
                    remarks: []
                };

                const guide = new Guide(guideData);
                await guide.save();
                successCount++;
                if (successCount % 50 === 0) console.log(`Imported ${successCount} records...`);
            } catch (err) {
                console.error(`Error importing row ${row["Registration No"]}:`, err.message);
            }
        }

        console.log("\n--- Import Summary ---");
        console.log(`Successfully imported: ${successCount}`);
        console.log(`Skipped (existing/invalid): ${skipCount}`);
        console.log("------------------------");

    } catch (err) {
        console.error("Fatal error during import:", err);
    } finally {
        mongoose.connection.close();
        console.log("Database connection closed.");
    }
}

importData();