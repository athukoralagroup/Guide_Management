const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://athukoralateacenter:kavinda%402001@cluster0.t60zehz.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'athukorala-secret-key-2026';

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  permissions: [{ type: String }] // 'register', 'edit', 'scan', 'rankings', 'view'
});

const User = mongoose.model('User', userSchema);

// Guide Schema
const guideSchema = new mongoose.Schema({
  registrationNo: { type: String, unique: true },
  date: { type: Date, default: Date.now },

  // Hotel/Agency info
  hotelOrAgency: { type: String, default: '' },
  agencyAddress: { type: String, default: '' },
  agencyTel: { type: String, default: '' },
  agencyGmail: { type: String, default: '' },
  agencyAccountDetails: { type: String, default: '' },

  // Guide info
  guideName: { type: String, required: true },
  guideIdCardNo: { type: String, default: '' },
  guideAddress: { type: String, default: '' },
  guideMobileNo: { type: String, default: '' },
  guidePhoto: { type: String, default: '' },

  // Guide bank details
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
    sales: { type: Number, default: 0 },
    netSale: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    exchangeRate: { type: Number, default: 300 }
  }]
}, { timestamps: true });

guideSchema.index({ registrationNo: 1 });
guideSchema.index({ guideName: 1 });
guideSchema.index({ hotelOrAgency: 1 });
guideSchema.index({ 'visits.date': -1 });
guideSchema.index({ createdAt: -1 });

const Guide = mongoose.model('Guide', guideSchema);

// Create initial admin if not exists
async function initAdmin() {
  const count = await User.countDocuments();
  if (count === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      password: hashed,
      role: 'admin',
      permissions: ['register', 'edit', 'scan', 'rankings', 'view', 'users']
    });
    console.log('Default admin created: admin / admin123');
  }
}
initAdmin();

// Auto-generate registration number
async function generateRegNo() {
  const last = await Guide.findOne({}, {}, { sort: { createdAt: -1 } });
  if (!last || !last.registrationNo) return 'AGTC001';
  const num = parseInt(last.registrationNo.replace('AGTC', '')) + 1;
  return 'AGTC' + String(num).padStart(3, '0');
}

// ─── Auth Middleware ───
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const hasPermission = (perm) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.permissions?.includes(perm)) return next();
  return res.status(403).json({ error: `Permission denied: ${perm}` });
};

// Routes
const router = express.Router();

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Management Routes
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashed, role, permissions });
    res.status(201).json({ id: user._id, username: user.username, role: user.role, permissions: user.permissions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { password, role, permissions } = req.body;
    const updates = { role, permissions };
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ id: user._id, username: user.username, role: user.role, permissions: user.permissions });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all guides (with search)
router.get('/guides', async (req, res) => {
  try {
    const { search } = req.query;
    let match = {};
    if (search) {
      match = {
        $or: [
          { guideName: { $regex: search, $options: 'i' } },
          { registrationNo: { $regex: search, $options: 'i' } },
          { hotelOrAgency: { $regex: search, $options: 'i' } },
          { guideIdCardNo: { $regex: search, $options: 'i' } },
        ]
      };
    }

    const guides = await Guide.aggregate([
      { $match: match },
      {
        $project: {
          guideName: 1,
          registrationNo: 1,
          hotelOrAgency: 1,
          visitCount: 1,
          totalGuests: 1,
          totalSales: 1,
          createdAt: 1,
          lastVisitDate: { $ifNull: [{ $max: "$visits.date" }, new Date(0)] }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(guides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET top 10 performers by monthly or annual sales
router.get('/rankings', async (req, res) => {
  try {
    const { month, year, type } = req.query;
    const now = new Date();

    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month !== undefined ? parseInt(month) : now.getMonth();
    const isAnnual = type === 'annual';

    let startDate, endDate;
    if (isAnnual) {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear + 1, 0, 1);
    } else {
      startDate = new Date(targetYear, targetMonth, 1);
      endDate = new Date(targetYear, targetMonth + 1, 1);
    }

    const top10 = await Guide.aggregate([
      { $unwind: "$visits" },
      {
        $match: {
          "visits.date": { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: "$_id",
          guideName: { $first: "$guideName" },
          registrationNo: { $first: "$registrationNo" },
          hotelOrAgency: { $first: "$hotelOrAgency" },
          guidePhoto: { $first: "$guidePhoto" },
          monthlySales: { $sum: "$visits.sales" },
          totalVisitsThisMonth: { $sum: 1 }
        }
      },
      { $match: { monthlySales: { $gt: 0 } } },
      { $sort: { monthlySales: -1 } },
      { $limit: 10 }
    ]);

    res.json(top10);
  } catch (err) {
    console.error('Rankings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const now = new Date();
    const last14DaysStart = new Date();
    last14DaysStart.setDate(now.getDate() - 13);
    last14DaysStart.setHours(0, 0, 0, 0);

    const last7DaysStart = new Date();
    last7DaysStart.setDate(now.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);

    // Get basic stats
    const statsResult = await Guide.aggregate([
      {
        $group: {
          _id: null,
          totalGuides: { $sum: 1 },
          totalVisits: { $sum: "$visitCount" },
          totalGuests: { $sum: "$totalGuests" },
          totalSales: { $sum: "$totalSales" }
        }
      }
    ]);

    const stats = statsResult[0] || { totalGuides: 0, totalVisits: 0, totalGuests: 0, totalSales: 0 };

    // Get daily sales for last 14 days
    const dailySales = await Guide.aggregate([
      { $unwind: "$visits" },
      {
        $match: {
          "visits.date": { $gte: last14DaysStart }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$visits.date" } },
          amount: { $sum: "$visits.sales" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days for the chart
    const last14DaysLabels = new Array(14).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (13 - i));
      return d.toISOString().split('T')[0];
    });

    const salesDataMap = {};
    dailySales.forEach(d => salesDataMap[d._id] = d.amount);

    const salesData = last14DaysLabels.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      amount: salesDataMap[date] || 0
    }));

    // Get weekly top guides
    const weeklyTopGuides = await Guide.aggregate([
      { $unwind: "$visits" },
      {
        $match: {
          "visits.date": { $gte: last7DaysStart }
        }
      },
      {
        $group: {
          _id: "$_id",
          guideName: { $first: "$guideName" },
          registrationNo: { $first: "$registrationNo" },
          guidePhoto: { $first: "$guidePhoto" },
          weeklyVisits: { $sum: 1 },
          weeklySales: { $sum: "$visits.sales" }
        }
      },
      { $sort: { weeklyVisits: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      stats,
      salesData,
      weeklyTopGuides
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET public guide view (only non-sensitive fields, no auth required)
router.get('/public/guides/:id', async (req, res) => {
  try {
    let guide = null;
    const lookupId = req.params.id;

    // Try to find by MongoDB ObjectId first if it is valid
    if (mongoose.Types.ObjectId.isValid(lookupId)) {
      guide = await Guide.findById(lookupId, 'guideName registrationNo guidePhoto visits');
    }

    // If not found or not a valid ObjectId, search by registrationNo
    if (!guide) {
      guide = await Guide.findOne(
        { registrationNo: { $regex: new RegExp(`^${lookupId}$`, 'i') } },
        'guideName registrationNo guidePhoto visits'
      );
    }

    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    res.json(guide);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET single guide
router.get('/guides/:id', async (req, res) => {
  try {
    const guide = await Guide.findById(req.params.id);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    res.json(guide);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create guide
router.post('/guides', async (req, res) => {
  try {
    const regNo = await generateRegNo();
    const guideData = { ...req.body, registrationNo: regNo };
    const guide = await Guide.create(guideData);
    res.status(201).json(guide);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete guide
router.delete('/guides/:id', async (req, res) => {
  try {
    await Guide.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log visit
router.post('/guides/:id/visit', async (req, res) => {
  try {
    const { guests, sales, netSale, commissionRate, commissionAmount, exchangeRate } = req.body;
    console.log(`Recording visit for ${req.params.id}: guests=${guests}, sales=${sales}`);

    const gCount = parseInt(guests) || 0;
    const sAmount = parseFloat(sales) || 0;

    const update = {
      $inc: {
        visitCount: 1,
        totalGuests: gCount,
        totalSales: sAmount
      },
      $push: {
        visits: {
          guests: gCount,
          sales: sAmount,
          date: new Date()
        }
      }
    };

    const guide = await Guide.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    console.log(`Updated totals for ${guide.guideName}: visits=${guide.visitCount}, guests=${guide.totalGuests}, sales=${guide.totalSales}`);
    res.json(guide);
  } catch (err) {
    console.error('Visit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update guide details
router.put('/guides/:id', async (req, res) => {
  try {
    let updateData = { ...req.body };

    // If visits array is being updated, recalculate totals to maintain consistency
    if (updateData.visits) {
      const visits = updateData.visits || [];
      updateData.visitCount = visits.length;
      updateData.totalGuests = visits.reduce((sum, v) => sum + (Number(v.guests) || 0), 0);
      updateData.totalSales = visits.reduce((sum, v) => sum + (parseFloat(v.sales) || 0), 0);
    }

    const guide = await Guide.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    res.json(guide);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PDF generation endpoint
router.get('/guides/:id/pdf', async (req, res) => {
  try {
    const guide = await Guide.findById(req.params.id);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=guide-${guide.registrationNo}.pdf`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = 50;

    // Header box
    doc.rect(margin, 30, pageWidth - margin * 2, 55).stroke('#2d6a4f');

    // Logo circle placeholder
    doc.circle(75, 57, 20).fillAndStroke('#2d6a4f', '#2d6a4f');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text('AG', 65, 51);

    // Company name
    doc.fillColor('#2d6a4f').fontSize(18).font('Helvetica-Bold').text('Athukorala Tea Factory', 105, 35);
    doc.fillColor('#555').fontSize(9).font('Helvetica').text('Tea Center Information', 105, 57);

    // TC-01 box
    doc.rect(pageWidth - 120, 38, 55, 22).stroke('#999');
    doc.fillColor('#333').fontSize(10).font('Helvetica').text('TC-01', pageWidth - 113, 43);

    // Title
    doc.moveDown(2);
    doc.fillColor('#111').fontSize(14).font('Helvetica-Bold').text('Guide Registration Form', { align: 'center' });

    const dateStr = new Date(guide.date).toLocaleDateString('en-GB').replace(/\//g, '.');
    doc.fontSize(10).font('Helvetica').fillColor('#333')
      .text(`Date: - ${dateStr}`, { align: 'center' })
      .text(`Registration No:- ${guide.registrationNo}`, { align: 'center' });

    doc.moveDown(1.2);

    // Section: Hotel/Agency
    const leftX = margin;
    const lineH = 22;
    let y = doc.y;

    const fields1 = [
      ['01)', 'Hotel OR Travel Agency :-', guide.hotelOrAgency],
      ['02)', 'Address :-', guide.agencyAddress],
      ['03)', 'Tel :-', guide.agencyTel],
      ['04)', 'Gmail Address :-', guide.agencyGmail],
      ['05)', 'Account Details :-', guide.agencyAccountDetails],
    ];

    fields1.forEach(([num, label, val]) => {
      doc.fillColor('#222').fontSize(10).font('Helvetica')
        .text(`${num} ${label}`, leftX, y)
        .text(val || '', leftX + 200, y);
      // Underline for value
      doc.moveTo(leftX + 200, y + 13).lineTo(pageWidth - margin, y + 13).stroke('#ccc');
      y += lineH;
    });

    doc.moveDown(0.5);
    y += 8;

    // Guide Information heading
    doc.fillColor('#222').fontSize(11).font('Helvetica-Bold').text('Guide Information', leftX, y);
    // Underline the word "Guid" style
    doc.moveTo(leftX, y + 14).lineTo(leftX + 70, y + 14).stroke('#222');
    y += 22;

    const fields2 = [
      ['01)', 'Name :-', guide.guideName],
      ['02)', 'Id card no:-', guide.guideIdCardNo],
      ['03)', 'Address:-', guide.guideAddress],
      ['04)', 'Mobile No:-', guide.guideMobileNo],
    ];

    fields2.forEach(([num, label, val]) => {
      doc.fillColor('#222').fontSize(10).font('Helvetica')
        .text(`${num} ${label}`, leftX, y)
        .text(val || '', leftX + 200, y);
      doc.moveTo(leftX + 200, y + 13).lineTo(pageWidth - margin, y + 13).stroke('#ccc');
      y += lineH;
    });

    y += 6;
    doc.fillColor('#222').fontSize(10).font('Helvetica').text('05) Account Details:-', leftX, y);
    y += lineH;

    // Bank details indented
    const bankIndent = leftX + 40;
    const bankFields = [
      ['Bank Name :-', guide.bankName],
      ['Branch :-', guide.bankBranch],
      ['Name :-', guide.bankAccountName],
      ['Account No :-', guide.bankAccountNo],
    ];

    bankFields.forEach(([label, val]) => {
      doc.fillColor('#222').fontSize(10).font('Helvetica')
        .text(label, bankIndent, y)
        .text(val || '', bankIndent + 120, y);
      doc.moveTo(bankIndent + 120, y + 13).lineTo(pageWidth - margin, y + 13).stroke('#ccc');
      y += lineH;
    });

    y += 40;

    // Agreement text
    doc.fontSize(10).font('Helvetica').fillColor('#222')
      .text('I hereby confirm that I am aware of the payment method of commission by Athukorala Group (Pvt) Ltd and I agree to all of them.', leftX, y, { width: pageWidth - margin * 2 });

    y += 70;
    // Signature line
    doc.moveTo(leftX, y).lineTo(leftX + 180, y).stroke('#333');
    doc.fillColor('#555').fontSize(9).text('Signature', leftX, y + 4);

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', router);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
