const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json())



/* ---------------------------- MongoDB Part HERE ------------------------------ */


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bjkyc58.mongodb.net/?retryWrites=true&w=majority`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    // Collection Here
    const classCollection = client.db('cookingDb').collection('class');
    const instructorCollection = client.db('cookingDb').collection('instructor');
    const bookedCollection = client.db('cookingDb').collection('booked');
    
    // Class collection
    app.get('/class', async(req, res) => {
        const result = await classCollection.find().toArray();
        res.send(result);
    });



    // instructor collection
    app.get('/instructor', async(req, res) => {
        const result = await instructorCollection.find().toArray();
        res.send(result);
    })


    // Booked collection apis
    app.get('/booked', async(req, res) => {
        const email = req.query.email;
        if(!email){
            res.send([]);
        }
        const query = { email : email};
        const result = await bookedCollection.find(query).toArray();
        res.send(result);
    })
    
    app.post('/booked', async(req, res) => {
        const item = req.body;
        console.log(item);
        const result = await bookedCollection.insertOne(item);
        res.send(result);
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



/* ---------------------------- MongoDB Part HERE ------------------------------ */



app.get('/', (req, res) => {
    res.send('Cooking Camp is running');
});

app.listen(port, () => {
    console.log(`Cooking Camp is running on port : ${port}`);
})