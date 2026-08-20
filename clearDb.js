const mongoose = require("mongoose");

// MongoDB connection
const MONGO_URI = 'mongodb+srv://athukoralateacenter:kavinda%402001@cluster0.t60zehz.mongodb.net/?appName=Cluster0';

async function clearDatabase() {
    try {
        console.log("Connecting to MongoDB Atlas...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.");

        // We only have the 'Guide' collection based on current project
        console.log("Deleting all guides from the database...");
        const result = await mongoose.connection.collection('guides').deleteMany({});
        
        console.log(`--- Clear Summary ---`);
        console.log(`Documents deleted: ${result.deletedCount}`);
        console.log(`----------------------`);

    } catch (err) {
        console.error("Error clearing database:", err);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
}

clearDatabase();
