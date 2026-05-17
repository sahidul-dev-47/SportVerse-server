const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config()
const port = process.env.PORT || 5000;
const app = express()
app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    await client.connect();

    const db = client.db('SportVerse')
    const facilitiesCollection = db.collection('facilities')
    const bookingsCollection = db.collection('bookings')

    app.get('/facilities', async (req,res) => {
        const result = await facilitiesCollection.find().toArray()
        res.send(result)
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
