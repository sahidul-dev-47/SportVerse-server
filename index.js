const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();

const port = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    req.userEmail = payload.email; 
    next();
  } catch {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db('SportVerse');
    const facilitiesCollection = db.collection('facilities');
    const bookingsCollection = db.collection('bookings');

    
    // GET ALL FACILITIES
  
    app.get('/facilities', async (req, res) => {
      try {
        const { ownerEmail } = req.query;
        let query = {};
        if (ownerEmail) {
          query.ownerEmail = ownerEmail.trim().toLowerCase();
        }
        const result = await facilitiesCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server Error' });
      }
    });


    // GET FEATURED FACILITIES
  
    app.get('/featured', async (req, res) => {
      try {
        const result = await facilitiesCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server Error' });
      }
    });

  
    // GET SINGLE FACILITY
    app.get('/facilities/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Facility ID' });
        }
        const result = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
        if (!result) {
          return res.status(404).send({ message: 'Facility not found' });
        }
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server Error' });
      }
    });

  
    // ADD FACILITY
    
    app.post('/facilities', async (req, res) => {
      try {
        const facilitiesData = req.body;
        facilitiesData.ownerEmail = facilitiesData.ownerEmail?.trim().toLowerCase();
        const result = await facilitiesCollection.insertOne(facilitiesData);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server Error' });
      }
    });

  
    // UPDATE FACILITY
    
    app.patch('/facilities/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { ownerEmail, ...updatedData } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Facility ID' });
        }

        const existingFacility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
        if (!existingFacility) {
          return res.status(404).send({ message: 'Facility not found' });
        }

        if (existingFacility.ownerEmail?.trim().toLowerCase() !== ownerEmail?.trim().toLowerCase()) {
          return res.status(403).send({ message: 'Unauthorized! You do not own this facility.' });
        }

        delete updatedData._id;

        const result = await facilitiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.modifiedCount === 0 && result.matchedCount > 0) {
          return res.send(existingFacility);
        }

        const updatedDocument = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
        res.send(updatedDocument);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server Error' });
      }
    });

    
    // DELETE FACILITY
  
    app.delete('/facilities/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const ownerEmail = req.body?.ownerEmail;

        if (!ownerEmail) {
          return res.status(400).send({ message: 'Owner Email is required' });
        }

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Facility ID' });
        }

        const existingFacility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
        if (!existingFacility) {
          return res.status(404).send({ message: 'Facility not found' });
        }

        if (existingFacility.ownerEmail?.trim().toLowerCase() !== ownerEmail?.trim().toLowerCase()) {
          return res.status(403).send({ message: 'Unauthorized operation' });
        }

        const result = await facilitiesCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error('DELETE ERROR:', error);
        res.status(500).send({ message: error.message || 'Server Error' });
      }
    });

  
    // POST BOOKING
    
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const { facilityId, userEmail, bookingDate, timeSlot } = req.body;

        if (!facilityId || !userEmail || !bookingDate || !timeSlot) {
          return res.status(400).send({ message: "Missing required fields" });
        }

      
        if (req.userEmail?.toLowerCase() !== userEmail?.trim().toLowerCase()) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const newBooking = {
          ...req.body,
          userEmail: userEmail.trim().toLowerCase(),
          status: "pending",
          createdAt: new Date(),
        };

        const result = await bookingsCollection.insertOne(newBooking);
        res.status(201).send({ ...newBooking, _id: result.insertedId });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    
    // GET BOOKINGS BY USER
  
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const { userEmail } = req.query;

        if (!userEmail) {
          return res.status(400).send({ message: "userEmail required" });
        }

  
        if (req.userEmail?.toLowerCase() !== userEmail.trim().toLowerCase()) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const bookings = await bookingsCollection
          .find({ userEmail: { $regex: new RegExp(`^${userEmail.trim()}$`, "i") } })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(bookings);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

  
    // DELETE (CANCEL) BOOKING
  
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID" });
        }

        const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        if (booking.userEmail?.toLowerCase() !== req.userEmail?.toLowerCase()) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send({ message: "Cancelled successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    console.log('Successfully connected to MongoDB!');

  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('SportVerse server is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});