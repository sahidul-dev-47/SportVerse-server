const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet } = require('jose-cjs');

dotenv.config();

const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
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

async function run() {
  try {

    const db = client.db('SportVerse');

    const facilitiesCollection = db.collection('facilities');
    const bookingsCollection = db.collection('bookings');

    // =========================
    // GET ALL FACILITIES
    // =========================
    app.get('/facilities', async (req, res) => {
      try {

        const { ownerEmail } = req.query;

        let query = {};

        // If ownerEmail exists → only return that user's facilities
        if (ownerEmail) {
          query.ownerEmail = ownerEmail.trim().toLowerCase();
        }

        const result = await facilitiesCollection.find(query).toArray();

        res.json(result);

      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Server Error'
        });
      }
    });

    // =========================
    // GET SINGLE FACILITY
    // =========================
    app.get('/facilities/:id', async (req, res) => {
      try {

        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: 'Invalid Facility ID'
          });
        }

        const result = await facilitiesCollection.findOne({
          _id: new ObjectId(id)
        });

        if (!result) {
          return res.status(404).send({
            message: 'Facility not found'
          });
        }

        res.json(result);

      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Server Error'
        });
      }
    });

    // =========================
    // ADD FACILITY
    // =========================
    app.post('/facilities', async (req, res) => {
      try {

        const facilitiesData = req.body;

        facilitiesData.ownerEmail = facilitiesData.ownerEmail
          ?.trim()
          .toLowerCase();

        const result = await facilitiesCollection.insertOne(
          facilitiesData
        );

        res.json(result);

      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Server Error'
        });
      }
    });

    // =========================
    // UPDATE FACILITY
    // =========================
    app.patch('/facilities/:id', async (req, res) => {
      try {

        const { id } = req.params;

        const {
          ownerEmail,
          ...updatedData
        } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: 'Invalid Facility ID'
          });
        }

        const existingFacility =
          await facilitiesCollection.findOne({
            _id: new ObjectId(id)
          });

        if (!existingFacility) {
          return res.status(404).send({
            message: 'Facility not found'
          });
        }

        if (
          existingFacility.ownerEmail?.trim().toLowerCase() !==
          ownerEmail?.trim().toLowerCase()
        ) {
          return res.status(403).send({
            message:
              'Unauthorized! You do not own this facility.'
          });
        }

        delete updatedData._id;

        const result =
          await facilitiesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: updatedData
            }
          );

        if (
          result.modifiedCount === 0 &&
          result.matchedCount > 0
        ) {
          return res.send(existingFacility);
        }

        const updatedDocument =
          await facilitiesCollection.findOne({
            _id: new ObjectId(id)
          });

        res.send(updatedDocument);

      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Server Error'
        });
      }
    });

    // =========================
    // DELETE FACILITY
    // =========================
    app.delete('/facilities/:id', async (req, res) => {
      try {

        const { id } = req.params;

        const ownerEmail = req.body?.ownerEmail;

        if (!ownerEmail) {
          return res.status(400).send({
            message: 'Owner Email is required'
          });
        }

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: 'Invalid Facility ID'
          });
        }

        const existingFacility =
          await facilitiesCollection.findOne({
            _id: new ObjectId(id)
          });

        if (!existingFacility) {
          return res.status(404).send({
            message: 'Facility not found'
          });
        }

        if (
          existingFacility.ownerEmail?.trim().toLowerCase() !==
          ownerEmail?.trim().toLowerCase()
        ) {
          return res.status(403).send({
            message: 'Unauthorized operation'
          });
        }

        const result =
          await facilitiesCollection.deleteOne({
            _id: new ObjectId(id)
          });

        res.send(result);

      } catch (error) {
        console.error('DELETE ERROR:', error);

        res.status(500).send({
          message: error.message || 'Server Error'
        });
      }
    });

    // =========================
    // BOOKINGS
    // =========================
    app.post('/bookings', async (req, res) => {
      try {

        const bookingData = req.body;

        const result =
          await bookingsCollection.insertOne(
            bookingData
          );

        res.json(result);

      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: 'Server Error'
        });
      }
    });

    console.log(
      'Pinged your deployment. Successfully connected to MongoDB!'
    );

  } finally {
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('SportVerse server is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});