const express = require('express')
const app = express()
const cors=require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
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

async function run() {
  try {


const db = client.db("sportsclub");
  const  userCollection = db.collection("users");

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
