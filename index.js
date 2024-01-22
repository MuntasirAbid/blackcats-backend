const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const { query } = require('express');
const stripe = require("stripe")(process.env.STRIPE_SK);
const app = express()
const port = process.env.PORT || 10000


app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tkhdgb3.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send('unauthorized access');
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next();
  })

}

async function run() {
  try {

    const productsCollection = client.db("buyAndSellDB").collection("products")
    const categoriesCollection = client.db("buyAndSellDB").collection("categories")
    const usersCollection = client.db("buyAndSellDB").collection("users")
    const bookingsCollection = client.db("buyAndSellDB").collection("bookings")
    const paymentsCollection = client.db("buyAndSellDB").collection("payments")

    // admin verify 
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'Admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    // Seller verify
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'Seller') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }


    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user) {
        const token = jwt.sign({ email }, process.env.TOKEN, { expiresIn: "1d" })

        res.send({ bookToken: token })
      }

      else {
        res.status(403).send({ bookToken: "" })
      }
    })

    // products

    app.get("/categories", async (req, res) => {
      const query = {}
      const categories = await categoriesCollection.find(query).toArray()

      res.send(categories)
    })
    app.get("/categories/:name", async (req, res) => {
      const genre = req.params.name;

      const query = { genre: genre, status: "Available" }
      const products = await productsCollection.find(query).toArray()


      res.send(products)
    })

    app.get("/productsAd", async (req, res) => {
      // const genre = req.params.name;

      const query = { advertise: true, status: "Available" }
      const products = await productsCollection.find(query).toArray()

      res.send(products)
    })

    app.get("/products/reported", async (req, res) => {

      const query = { reported: true }

      const products = await productsCollection.find(query).toArray()

      res.send(products)
    })

    app.delete("/products/reported/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }

      const products = await productsCollection.deleteOne(query)

      res.send(products)
    })

    app.get('/bookGenre', async (req, res) => {
      const query = {}
      const result = await categoriesCollection.find(query).project({ genre: 1 }).toArray();
      res.send(result);

    })



    app.get('/advertiseProducts', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const search = req.query.search;
      // const query = { advertise: true, status: "Available",productQuantity: { $gt: 0 }};

      let query = {
        advertise: true, status: "Available"
      };
      if (search) {
        query = {
          $text: {
            $search: search
          }
        };
      }

      const cursor = productsCollection.find(query);
      const advertiseItems = await cursor.skip(page * size).limit(size).toArray();
      const count = await productsCollection.countDocuments(query);

      res.send({ count, advertiseItems });
    });


    app.post('/products', verifyJWT, verifySeller, async (req, res) => {
      const user = req.body
      const post = Date()
      const result = await productsCollection.insertOne({ ...user, post: post })

      res.send(result)
    })


    app.get('/product/:productId', async (req, res) => {
      try {
        const productId = req.params.productId;

        // Find the specific product using the ObjectId
        const product = await productsCollection.findOne({ _id: ObjectId(productId) });

        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }

        // Respond with the specific product
        res.json(product);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error from here' });
      }
    });

    // users

    app.post("/users", async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)

      res.send(result)
    })


    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)

      res.send(user.role === "Seller")
    })

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)

      res.send(user.role === "Admin")
    })

    // seller
    app.get("/sellers", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const query = { role: "Seller" };
        const sellers = await usersCollection.find(query).toArray();
        res.send(sellers);
      } catch (error) {
        console.error("Error fetching sellers:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });


    app.delete('/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await usersCollection.deleteOne(query)

      res.send(result)
    })


    app.put('/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id), role: "Seller" }

      const seller = await usersCollection.findOne(query)
      const email = seller.email;
      const filter = { sellerEmail: email }
      const updateDoc = {
        $set: {
          verify: true
        },
      };
      const result = await productsCollection.updateOne(filter, updateDoc)
      const resultUser = await usersCollection.updateOne(query, updateDoc)

      res.send(resultUser)
    })

    // temporary update


    // app.get('/allproducts', async (req, res) => {

    //   const query = {}


    //   const updateDoc = {
    //     $set: {
    //       reported:false
    //     },
    //   };
    //   const result = await productsCollection.updateMany(query, updateDoc)
    //   console.log(result)
    //   res.send(result)
    // })


    // buyers 

    app.get("/buyers", verifyJWT, verifyAdmin, async (req, res) => {

      const query = { role: "Buyer" }
      const sellers = await usersCollection.find(query).toArray()


      res.send(sellers)
    })

    app.delete('/buyers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await usersCollection.deleteOne(query)

      res.send(result)
    })

    app.get('/bookings/:email', async (req, res) => {
      const email = req.params.email;

      const query = { buyerEmail: email }
      const buyerBookings = await bookingsCollection.find(query).toArray()

      res.send(buyerBookings)
    })


    // seller-products

    app.get('/products/:email', async (req, res) => {
      const email = req.params.email;

      const query = { sellerEmail: email }
      const products = await productsCollection.find(query).toArray()

      res.send(products)
    })

    app.get('/bookings/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { sellerEmail: email }
      const products = await bookingsCollection.find(query).toArray()

      res.send(products)
    })

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await productsCollection.deleteOne(query)

      res.send(result)
    })


    app.put('/products/:id', verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          advertise: true
        },
      };
      const result = await productsCollection.updateOne(query, updateDoc, options)

      res.send(result)
    })


    // booking

    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;

      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = { _id: ObjectId(id) }

      const query = { sellerEmail: payment.sellerEmail, name: payment.book }
      const updatedDoc = {
        $set: {
          status: "Sold",
          transactionId: payment.transactionId
        }
      }

      const booking = await bookingsCollection.findOne(filter);
      const product = await productsCollection.findOne(query);


      const updatedProduct = {
        $set: {
          productQuantity: product.productQuantity - booking.quantity,
        }
      }
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
      const updatedProducts = await productsCollection.updateOne(query, updatedProduct)

      console.log(updatedProducts, updatedResult)
      res.send(result);
    })


    app.get('/payment/:id', async (req, res) => {

      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await bookingsCollection.findOne(query)

      res.send(result)

    })

    app.post("/bookings", async (req, res) => {
      const booking = req.body
      const result = await bookingsCollection.insertOne(booking)

      res.send(result)
    })

    app.put("/products/report/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) }

      const upDoc = {
        $set: {
          reported: true
        }
      }

      const reportItem = await productsCollection.updateOne(query, upDoc)
      res.send(reportItem)
    })

  }

  finally {


  }
}


run().catch(er => console.error(er))

app.get('/', (req, res) => {
  res.send('Server running')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})