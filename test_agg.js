const mongoose = require('mongoose');

const guideSchema = new mongoose.Schema({
  registrationNo: String,
  date: { type: Date, default: Date.now },
  visits: [{ date: Date, guests: Number }]
}, { timestamps: true });

const Guide = mongoose.model('GuideTest', guideSchema);

async function run() {
  await mongoose.connect('mongodb+srv://athukoralateacenter:kavinda%402001@cluster0.t60zehz.mongodb.net/?appName=Cluster0');
  await Guide.deleteMany({});
  
  // 1. Old guide, recent visit
  await Guide.create({
    registrationNo: 'G1',
    createdAt: new Date(Date.now() - 10000000),
    visits: [{ date: new Date(Date.now() - 1000), guests: 1 }]
  });
  
  // 2. New guide, no visits
  await Guide.create({
    registrationNo: 'G2',
    createdAt: new Date(),
    visits: []
  });

  const guides = await Guide.aggregate([
    {
      $addFields: {
        lastVisitDate: {
          $ifNull: [{ $max: "$visits.date" }, new Date(0)]
        },
        sortDate: {
          $max: [
            { $ifNull: [{ $max: "$visits.date" }, new Date(0)] },
            "$createdAt"
          ]
        }
      }
    },
    { $sort: { sortDate: -1 } }
  ]);
  
  console.log(guides.map(g => g.registrationNo));
  process.exit(0);
}
run().catch(console.error);
