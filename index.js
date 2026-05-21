const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const {
  createRemoteJWKSet,
  jwtVerify,
} = require("jose-cjs");

dotenv.config();

const app = express();

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).send({
        message: "No Token Provided",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).send({
        message: "Invalid Token",
      });
    }

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    req.userEmail = payload.email;

    next();
  } catch (error) {
    console.error("VERIFY TOKEN ERROR:", error);

    return res.status(401).send({
      message: "Unauthorized Access",
    });
  }
};

async function run() {
  try {
    // await client.connect();

    console.log("MongoDB Connected Successfully");

    const db = client.db("SportVerse");

    const facilitiesCollection =
      db.collection("facilities");

    const bookingsCollection =
      db.collection("bookings");

    
    // GET ALL FACILITIES


    app.get("/facilities", async (req, res) => {
      try {
        const { ownerEmail } = req.query;

        let query = {};

        if (ownerEmail) {
          query.ownerEmail =
            ownerEmail.trim().toLowerCase();
        }

        const result =
          await facilitiesCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Server Error",
        });
      }
    });

    
    // GET FEATURED FACILITIES
    

    app.get("/featured", async (req, res) => {
      try {
        const result =
          await facilitiesCollection
            .find()
            .limit(6)
            .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Server Error",
        });
      }
    });

   
    // GET SINGLE FACILITY
   

    app.get(
      "/facilities/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).send({
              message: "Invalid Facility ID",
            });
          }

          const result =
            await facilitiesCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!result) {
            return res.status(404).send({
              message: "Facility Not Found",
            });
          }

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );

   
    // ADD FACILITY
   
    app.post(
      "/facilities",
      verifyToken,
      async (req, res) => {
        try {
          const facilitiesData = req.body;

          console.log(
            "TOKEN EMAIL:",
            req.userEmail
          );

          console.log(
            "BODY EMAIL:",
            facilitiesData.ownerEmail
          );

          if (!facilitiesData.ownerEmail) {
            return res.status(400).send({
              message: "Owner Email Missing",
            });
          }

          if (
            req.userEmail?.toLowerCase() !==
            facilitiesData.ownerEmail
              ?.trim()
              .toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const newFacility = {
            ...facilitiesData,
            ownerEmail:
              facilitiesData.ownerEmail
                .trim()
                .toLowerCase(),
            createdAt: new Date(),
          };

          const result =
            await facilitiesCollection.insertOne(
              newFacility
            );

          res.status(201).send({
            acknowledged: result.acknowledged,
            insertedId: result.insertedId,
          });
        } catch (error) {
          console.error(
            "ADD FACILITY ERROR:",
            error
          );

          res.status(500).send({
            message:
              error.message || "Server Error",
          });
        }
      }
    );

  
    // UPDATE FACILITY
    
    app.patch(
      "/facilities/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).send({
              message: "Invalid Facility ID",
            });
          }

          const existingFacility =
            await facilitiesCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!existingFacility) {
            return res.status(404).send({
              message: "Facility Not Found",
            });
          }

          if (
            existingFacility.ownerEmail !==
            req.userEmail?.toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const updatedData = req.body;

          delete updatedData._id;
          delete updatedData.ownerEmail;

          const result =
            await facilitiesCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $set: updatedData,
              }
            );

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );

    
    // DELETE FACILITY
    
    app.delete(
      "/facilities/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).send({
              message: "Invalid Facility ID",
            });
          }

          const existingFacility =
            await facilitiesCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!existingFacility) {
            return res.status(404).send({
              message: "Facility Not Found",
            });
          }

          if (
            existingFacility.ownerEmail !==
            req.userEmail?.toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const result =
            await facilitiesCollection.deleteOne({
              _id: new ObjectId(id),
            });

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );

  
    // CREATE BOOKING
   
    app.post(
      "/bookings",
      verifyToken,
      async (req, res) => {
        try {
          const bookingData = req.body;

          if (
            req.userEmail?.toLowerCase() !==
            bookingData.userEmail
              ?.trim()
              .toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const newBooking = {
            ...bookingData,
            status: "pending",
            createdAt: new Date(),
          };

          const result =
            await bookingsCollection.insertOne(
              newBooking
            );

          res.status(201).send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );

    // GET USER BOOKINGS
  
    app.get(
      "/bookings",
      verifyToken,
      async (req, res) => {
        try {
          const { userEmail } = req.query;

          if (
            req.userEmail?.toLowerCase() !==
            userEmail?.trim().toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const result =
            await bookingsCollection
              .find({
                userEmail:
                  userEmail.trim().toLowerCase(),
              })
              .sort({
                createdAt: -1,
              })
              .toArray();

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );

    
    // DELETE BOOKING
    
    app.delete(
      "/bookings/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).send({
              message: "Invalid Booking ID",
            });
          }

          const existingBooking =
            await bookingsCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!existingBooking) {
            return res.status(404).send({
              message: "Booking Not Found",
            });
          }

          if (
            existingBooking.userEmail !==
            req.userEmail?.toLowerCase()
          ) {
            return res.status(403).send({
              message: "Forbidden Access",
            });
          }

          const result =
            await bookingsCollection.deleteOne({
              _id: new ObjectId(id),
            });

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).send({
            message: "Server Error",
          });
        }
      }
    );
  } catch (error) {
    console.error(
      "MONGODB CONNECTION ERROR:",
      error
    );
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SportVerse Server Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});