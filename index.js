const express = require('express')
const app = express()
const cors=require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port =process.env.PORT || 3000
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pd9mpbl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
var admin = require("firebase-admin");

const decoded=Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
var serviceAccount = JSON.parse(decoded);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
 const verifyFireBaseToken=async(req,res, next) => { 
    const authHeaders=req.headers?.authorization;
   
    if (!authHeaders || !authHeaders.startsWith('Bearer ')) {
      return res.status(401).send({message:'unauthorized access'})
    }
   const accessToken= authHeaders.split(' ')[1]

   try {
    const decoded=await admin.auth().verifyIdToken(accessToken)
  
    req.decoded=decoded;
    next()
   } catch (error) {
    return res.status(401).send({message:'unauthorized access'})
   }
   
   
 }

async function run() {
  try {


const db = client.db("sportsclub");
  const  userCollection = db.collection("users");
  const  courtCollection = db.collection("courts");
  const  announcementCollection = db.collection("announcements");
  const  couponCollection = db.collection("coupons");
  const  bookingCollection = db.collection("bookings");
 
// user
 app.get('/users/:email',verifyFireBaseToken, async (req, res) => {
  const email = req.params.email; 
  const user = await userCollection.findOne({ email: email });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.send(user);
});


  app.post('/users',async(req,res)=>{
  const email=req.body.email
  const userExists=await userCollection.findOne({email})
  if (userExists) {
    return res.status(200).send({message:'USer already exists', inserted:false})
  }
  const user=req.body
  const result=await userCollection.insertOne(user)
  res.send(result)
})
// bookings
app.post('/bookings', verifyFireBaseToken, async (req, res) => {
  
      const email = req.decoded.email;
      if (!email) return res.status(401).json({ message: 'Unauthorized' });

      const {
        user_email = email,
        user_name,
        court_id,
        date,
        slots,
        price_per_session,
        total_price,
      } = req.body;

      if (!court_id || !date || !Array.isArray(slots) || !slots.length) {
        return res.status(400).json({ message: 'court_id, date, slots required' });
      }

      // Optional: verify court and price server-side
      const court = await courtCollection.findOne({ _id: new ObjectId(court_id) });
      if (!court) return res.status(404).json({ message: 'Court not found' });

      const sessionCount = slots.length;
      const serverTotal = court.price * sessionCount;

      const now = new Date().toISOString();
      const doc = {
        user_email,
        user_name: user_name || null,
        court_id: court._id,
        court_type: court.type,
        date, // store as string YYYY-MM-DD
        slots,
        session_count: sessionCount,
        price_per_session: court.price,
        total_price: serverTotal, // ignore client total; trust server
        status: 'pending',
        created_at: now,
        updated_at: now,
        approved_at: null,
        approved_by: null,
      };

      const result = await bookingCollection.insertOne(doc);
      res.send(result)
    })

// courts
  app.get('/courts', verifyFireBaseToken, async (req, res) => {
   
      const courts = await courtCollection.find().toArray();
      res.send(courts);
    
  });
  app.post('/courts', verifyFireBaseToken, async (req, res) => {
    const { type, image, price, slots } = req.body;
      if (!type || !image || price == null) {
        return res.status(400).json({ message: 'type, image, price required' });
      }
      const doc = {
        type,
        image,
        price: Number(price),
        slots: Array.isArray(slots) ? slots : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await courtCollection.insertOne(doc);
      res.send(result)
    
  });

  app.patch('/courts/:id', verifyFireBaseToken, async (req, res) => {
   
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid court id' });
      }
      const { type, image, price, slots } = req.body;
      const update = { updated_at: new Date().toISOString() };
      if (type !== undefined) update.type = type;
      if (image !== undefined) update.image = image;
      if (price !== undefined) update.price = Number(price);
      if (slots !== undefined) update.slots = Array.isArray(slots) ? slots : [];

      const result = await courtCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );
      if (!result.matchedCount) {
        return res.status(404).json({ message: 'Court not found' });}
     res.send(result)
    
  });
  app.delete('/courts/:id', verifyFireBaseToken, async (req, res) => {
   
          const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid court id' });
      }
      const result = await courtCollection.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) {
        return res.status(404).json({ message: 'Court not found' });
      }
      res.send(result)
    
  });

  // announcements

  app.get('/announcements', verifyFireBaseToken, async (req, res) => {
   
      const courts = await announcementCollection.find().sort({ created_at: -1 }).toArray();
      res.send(courts);
    
  });
  app.post('/announcements', verifyFireBaseToken, async (req, res) => {
     let { title, message, image, startDate, endDate, active } = req.body;
      if (!title || !message) {
        return res.status(400).json({ message: 'title & message required' });
      }
      title = String(title).trim();
      message = String(message).trim();
      image = image?.trim() || null;
      startDate = startDate ? new Date(startDate).toISOString() : null;
      endDate = endDate ? new Date(endDate).toISOString() : null;
      active = !!active;
      const email = req.decoded?.email || null; // admin making it

      const now = new Date().toISOString();
      const doc = { title, message, image, startDate, endDate, active, created_by: email, created_at: now, updated_at: now };
      const result = await announcementCollection.insertOne(doc);
     res.send(result)
    
  });

  app.patch('/announcements/:id', verifyFireBaseToken, async (req, res) => {
   
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const u = { updated_at: new Date().toISOString() };
      const b = req.body;
      if (b.title !== undefined) u.title = String(b.title).trim();
      if (b.message !== undefined) u.message = String(b.message).trim();
      if (b.image !== undefined) u.image = b.image?.trim() || null;
      if (b.startDate !== undefined) u.startDate = b.startDate ? new Date(b.startDate).toISOString() : null;
      if (b.endDate !== undefined) u.endDate = b.endDate ? new Date(b.endDate).toISOString() : null;
      if (b.active !== undefined) u.active = !!b.active;

      const result = await announcementCollection.updateOne({ _id: new ObjectId(id) }, { $set: u });
      if (!result.matchedCount) return res.status(404).json({ message: 'Announcement not found' });
    res.send(result)
     
    
  });
  app.delete('/announcements/:id', verifyFireBaseToken, async (req, res) => {
   
        const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const result = await announcementCollection.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) return res.status(404).json({ message: 'Announcement not found' });
      res.send(result)
    
  });

// coupons
app.get('/coupons', verifyFireBaseToken, async (req, res) => {
   
      const courts = await couponCollection.find().toArray();
      res.send(courts);
    
  });
  app.post('/coupons', verifyFireBaseToken, async (req, res) => {
      let { code, description, discountType, amount, minSpend, maxDiscount, startDate, endDate, active, usageLimit } = req.body;
      if (!code || !discountType || amount == null) {
        return res.status(400).json({ message: 'code, discountType, amount required' });
      }
      code = String(code).trim().toUpperCase();
      description = description?.trim() || '';
      discountType = discountType === 'fixed' ? 'fixed' : 'percent';
      amount = Number(amount);
      minSpend = minSpend == null ? null : Number(minSpend);
      maxDiscount = maxDiscount == null ? null : Number(maxDiscount);
      startDate = startDate ? new Date(startDate).toISOString() : null;
      endDate = endDate ? new Date(endDate).toISOString() : null;
      active = !!active;
      usageLimit = usageLimit == null || usageLimit === '' ? null : Number(usageLimit);

      const now = new Date().toISOString();
      const doc = { code, description, discountType, amount, minSpend, maxDiscount, startDate, endDate, active, usageLimit, usedCount: 0, created_at: now, updated_at: now };
      const result = await couponCollection.insertOne(doc);
      res.send(result)
    
  });

  app.patch('/coupons/:id', verifyFireBaseToken, async (req, res) => {
   
       const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const u = { updated_at: new Date().toISOString() };
      const b = req.body;
      if (b.code !== undefined) u.code = String(b.code).trim().toUpperCase();
      if (b.description !== undefined) u.description = b.description?.trim() || '';
      if (b.discountType !== undefined) u.discountType = b.discountType === 'fixed' ? 'fixed' : 'percent';
      if (b.amount !== undefined) u.amount = Number(b.amount);
      if (b.minSpend !== undefined) u.minSpend = b.minSpend == null || b.minSpend === '' ? null : Number(b.minSpend);
      if (b.maxDiscount !== undefined) u.maxDiscount = b.maxDiscount == null || b.maxDiscount === '' ? null : Number(b.maxDiscount);
      if (b.startDate !== undefined) u.startDate = b.startDate ? new Date(b.startDate).toISOString() : null;
      if (b.endDate !== undefined) u.endDate = b.endDate ? new Date(b.endDate).toISOString() : null;
      if (b.active !== undefined) u.active = !!b.active;
      if (b.usageLimit !== undefined) u.usageLimit = b.usageLimit == null || b.usageLimit === '' ? null : Number(b.usageLimit);

      const result = await couponCollection.updateOne({ _id: new ObjectId(id) }, { $set: u });
      if (!result.matchedCount) return res.status(404).json({ message: 'Coupon not found' });
    res.send(result)
     
    
  });
  app.delete('/coupons/:id', verifyFireBaseToken, async (req, res) => {
   
     const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
      const result = await couponCollection.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) return res.status(404).json({ message: 'Coupon not found' });
      res.send(result)
    
  });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Sports!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
