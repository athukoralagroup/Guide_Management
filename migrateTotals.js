const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Extract the MONGO_URI dynamically from index.js
let MONGO_URI;
try {
  const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const match = indexContent.match(/const MONGO_URI = process\.env\.MONGO_URI \|\| ['"]([^'"]+)['"];/);
  MONGO_URI = process.env.MONGO_URI || (match ? match[1] : null);
} catch (e) {
  console.error("Failed to read MONGO_URI from index.js:", e.message);
}

if (!MONGO_URI) {
  console.error("Error: Could not determine MONGO_URI.");
  process.exit(1);
}

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully!");

    // Define the Guide schema matching the structure in index.js
    const guideSchema = new mongoose.Schema({
      registrationNo: String,
      guideName: String,
      visitCount: { type: Number, default: 0 },
      totalGuests: { type: Number, default: 0 },
      totalSales: { type: Number, default: 0 },
      visits: [{
        date: Date,
        guests: Number,
        sales: Number,
        netSale: Number,
        commissionRate: Number,
        commissionAmount: Number,
        exchangeRate: Number
      }]
    });

    const Guide = mongoose.model('Guide', guideSchema);

    const guides = await Guide.find({});
    console.log(`Found ${guides.length} guides to check.`);

    let updatedCount = 0;

    for (const guide of guides) {
      const visits = guide.visits || [];
      const calculatedVisitCount = visits.length;
      const calculatedTotalGuests = visits.reduce((sum, v) => sum + (Number(v.guests) || 0), 0);
      const calculatedTotalSales = visits.reduce((sum, v) => sum + (parseFloat(v.sales) || 0), 0);

      // Check if we need to update
      if (
        guide.visitCount !== calculatedVisitCount ||
        guide.totalGuests !== calculatedTotalGuests ||
        guide.totalSales !== calculatedTotalSales
      ) {
        console.log(`Updating guide: ${guide.guideName} (${guide.registrationNo || 'No Reg No'})`);
        console.log(`  Old totals -> visits: ${guide.visitCount}, guests: ${guide.totalGuests}, sales: ${guide.totalSales}`);
        console.log(`  New totals -> visits: ${calculatedVisitCount}, guests: ${calculatedTotalGuests}, sales: ${calculatedTotalSales}`);
        
        guide.visitCount = calculatedVisitCount;
        guide.totalGuests = calculatedTotalGuests;
        guide.totalSales = calculatedTotalSales;
        
        await guide.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete! Updated ${updatedCount} guides.`);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrate();
