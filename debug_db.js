const mongoose = require("mongoose");

const MONGO_URI = 'mongodb+srv://kavinda:kavinda-2001@kavinda.firzq.mongodb.net/?appName=kavinda';

async function checkData() {
    try {
        await mongoose.connect(MONGO_URI);
        const guideSchema = new mongoose.Schema({
            guideName: String,
            visits: [{
                date: Date,
                guests: Number,
                sales: Number
            }]
        });
        const Guide = mongoose.model('Guide', guideSchema);
        
        const guides = await Guide.find({});
        console.log(`Total guides: ${guides.length}`);
        
        let hasVisits = false;
        guides.forEach(g => {
            if (g.visits && g.visits.length > 0) {
                hasVisits = true;
                console.log(`Guide: ${g.guideName}, Visits count: ${g.visits.length}`);
                g.visits.slice(0, 2).forEach(v => {
                    console.log(`  Visit Date: ${v.date}, Sales: ${v.sales}`);
                });
            }
        });
        
        if (!hasVisits) {
            console.log("No guides have any visits logged in the 'visits' array.");
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkData();
