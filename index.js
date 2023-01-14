const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const { query } = require('express');
const stripe = require("stripe")(process.env.STRIPE_SK);
const app = express()
const port = process.env.PORT || 10000


app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tkhdgb3.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

  const authHeader = req.headers.authorization;
  console.log(authHeader)
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

    const bookCollection = client.db("bookShopDB").collection("books")
    const categoriesCollection = client.db("bookShopDB").collection("categories")
    const usersCollection = client.db("bookShopDB").collection("users")
    const bookingsCollection = client.db("bookShopDB").collection("bookings")
    const paymentsCollection = client.db("bookShopDB").collection("payments")

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
      console.log(user)
      if (user) {
        const token = jwt.sign({ email }, process.env.TOKEN, { expiresIn: "1d" })
        console.log(token)
        res.send({ bookToken: token })
      }

      else {
        res.status(403).send({ bookToken: "" })
      }
    })


    // books

    app.get("/categories", async (req, res) => {
      const query = {}
      const categories = await categoriesCollection.find(query).toArray()

      res.send(categories)
    })
    app.get("/categories/:name", async (req, res) => {
      const genre = req.params.name;
      console.log(genre)
      const query = { genre: genre, status: "Available" }
      const books = await bookCollection.find(query).toArray()

      res.send(books)
    })
    app.get("/booksAd", async (req, res) => {
      // const genre = req.params.name;
      // console.log(genre)
      const query = { advertise: true, status: "Available" }
      const books = await bookCollection.find(query).toArray()

      res.send(books)
    })
    app.get("/books/reported", async (req, res) => {

      const query = { reported: true }

      const books = await bookCollection.find(query).toArray()

      res.send(books)
    })
    app.delete("/books/reported/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }

      const books = await bookCollection.deleteOne(query)

      res.send(books)
    })

    app.get('/bookGenre', async (req, res) => {
      const query = {}
      const result = await categoriesCollection.find(query).project({ genre: 1 }).toArray();
      res.send(result);


    })

    app.get('/advertiseBooks', async (req, res) => {
      const query = { advertise: true, status: "Available" }
      const books = await bookCollection.find(query).limit(10).toArray()
      res.send(books)
    })

    app.post('/books', verifyJWT, verifySeller, async (req, res) => {
      const user = req.body
      const post = Date()
      const result = await bookCollection.insertOne({ ...user, post: post })
      console.log(result)
      res.send(result)
    })


    // users

    app.post("/users", async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      console.log(result)
      res.send(result)
    })


    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      console.log(user.role === "Seller")
      res.send(user.role === "Seller")
    })
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      console.log(user.role === "Admin")
      res.send(user.role === "Admin")
    })

    // seller
    app.get("/sellers", verifyJWT, verifyAdmin, async (req, res) => {

      const query = { role: "Seller" }
      const sellers = await usersCollection.find(query).toArray()

      console.log(sellers)
      res.send(sellers)
    })

    app.delete('/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      console.log(result)
      res.send(result)
    })


    app.put('/sellers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: ObjectId(id), role: "Seller" }

      const seller = await usersCollection.findOne(query)
      const email = seller.email;
      const filter = { sellerEmail: email }
      const updateDoc = {
        $set: {
          verify: true
        },
      };
      const result = await bookCollection.updateOne(filter, updateDoc)
      const resultUser = await usersCollection.updateOne(query, updateDoc)
      console.log(result)
      res.send(resultUser)
    })

    // temporary update


    // app.get('/allBooks', async (req, res) => {

    //   const query = {}


    //   const updateDoc = {
    //     $set: {
    //       reported:false
    //     },
    //   };
    //   const result = await bookCollection.updateMany(query, updateDoc)
    //   console.log(result)
    //   res.send(result)
    // })


    // buyers 

    app.get("/buyers", verifyJWT, verifyAdmin, async (req, res) => {

      const query = { role: "Buyer" }
      const sellers = await usersCollection.find(query).toArray()

      console.log(sellers)
      res.send(sellers)
    })

    app.delete('/buyers/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      console.log(result)
      res.send(result)
    })

    app.get('/bookings/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const query = { buyerEmail: email }
      const buyerBookings = await bookingsCollection.find(query).toArray()
      console.log(buyerBookings)
      res.send(buyerBookings)
    })


    // seller-books

    app.get('/books/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const query = { sellerEmail: email }
      const books = await bookCollection.find(query).toArray()

      res.send(books)
    })
    app.get('/bookings/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const query = { sellerEmail: email }
      const books = await bookingsCollection.find(query).toArray()

      res.send(books)
    })

    app.delete('/books/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await bookCollection.deleteOne(query)
      console.log(result)
      res.send(result)
    })


    app.put('/books/:id', verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          advertise: true
        },
      };
      const result = await bookCollection.updateOne(query, updateDoc, options)
      console.log(result)
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
      console.log(payment)
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = { _id: ObjectId(id) }
      console.log(payment.sellerEmail)
      const query = { sellerEmail: payment.sellerEmail, name: payment.book }
      const updatedDoc = {
        $set: {
          status: "Sold",
          transactionId: payment.transactionId
        }
      }
      const updatedBook = {
        $set: {
          status: "Sold",

        }
      }
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
      const updatedbook = await bookCollection.updateOne(query, updatedBook)

      console.log(updatedbook, updatedResult)
      res.send(result);
    })


    app.get('/payment/:id', async (req, res) => {

      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await bookingsCollection.findOne(query)
      console.log(result)
      res.send(result)

    })

    app.post("/bookings", async (req, res) => {
      const booking = req.body
      const result = await bookingsCollection.insertOne(booking)
      console.log(result)
      res.send(result)
    })

    app.put("/books/report/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) }

      const upDoc = {
        $set: {
          reported: true
        }
      }

      const reportItem = await bookCollection.updateOne(query, upDoc)
      res.send(reportItem)
    })



  }

  finally {


  }
}


run().catch(er => console.error(er))







app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})